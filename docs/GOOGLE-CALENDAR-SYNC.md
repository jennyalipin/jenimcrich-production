# Google Calendar Sync — Implementation Plan

Status: **planned, not built.** This doc is the decision record + build guide for
connecting the interview calendar to Google Calendar. Nothing here is wired yet.

## 1. Where we are today

The calendar is a **database-backed internal scheduler** — no external calendar
is touched.

- `src/app/calendar/page.tsx` renders a UTC month grid from `getInterviews()`.
- Booking: `ScheduleInterviewButton` → `scheduleInterviewAction`
  (`src/app/calendar/actions.ts`, Zod-validated) → `scheduleInterview()` in the
  data layer (`src/lib/data`) → inserts an `interviews` row.
- Double-booking is guarded **inside the app** (`SLOT_TAKEN`); it has no idea
  what's on an interviewer's real Google calendar.
- No invites, no reminders, no Meet links. Times are stored/shown in **UTC**.

**Single insertion point:** every create flows through `scheduleInterview()`;
reschedule/cancel flow through sibling actions. That's the only place Google
calls need to hook in.

## 2. Scope — ship in levels

| Level | Capability | Build first? |
| ----- | ---------- | ------------ |
| **1** | One-way push: create/update/delete a Google event per interview, with candidate + interviewer as attendees (Google sends the invite email), optional Meet link | ✅ yes |
| **2** | Free/busy check against the interviewer's real calendar before confirming | later |
| **3** | Two-way sync: changes made in Google flow back via watch channels + sync tokens | later (high effort) |

This plan details **Level 1** and sketches 2–3.

## 3. Auth model — the key decision

> ⚠️ The previous session deleted the Google Cloud project (it was for the
> removed Google **sign-in**). Calendar sync needs a **fresh** project with the
> **Calendar API** enabled — a server-to-server integration, not user login.

**Recommended: one shared "JeniMcRich Interviews" calendar + a service account.**

- Create a Google Cloud **service account**; download its JSON key.
- Create (or designate) a Google Calendar "JeniMcRich Interviews" and **share it
  with the service account's email** with "Make changes to events" rights.
- The app authenticates as the service account and writes every interview to
  that one calendar. Candidates + interviewers are added as **attendees**, so
  Google emails them invites regardless of where they keep their own calendar.
- No per-interviewer OAuth, no token refresh dance, no Google app-verification
  for a personal-Gmail consent screen. Best fit for one non-technical owner.

Alternatives (only if needed):
- **Domain-wide delegation** (Workspace only): act *as* each interviewer so the
  event lands on their own calendar. Needs Workspace admin to authorize scopes.
- **Per-user OAuth**: each interviewer connects their account; store refresh
  tokens. Required if interviewers use personal Gmail and you want events on
  *their* calendars. Most setup; triggers Google verification for the calendar
  scope.

Scope needed: `https://www.googleapis.com/auth/calendar.events` (+ `calendar`
for free/busy at Level 2).

## 4. Secrets (Doppler — never `.env`)

```
GOOGLE_SA_CLIENT_EMAIL      # service account email
GOOGLE_SA_PRIVATE_KEY       # PEM; store with literal \n, unescape at runtime
GOOGLE_CALENDAR_ID          # the shared calendar's id
GOOGLE_CALENDAR_ENABLED     # "true" feature flag — off = today's behavior
```

Read via `doppler run -- pnpm dev`; sync to Vercel via the Doppler integration.
When `GOOGLE_CALENDAR_ENABLED` is unset/false, the calendar behaves exactly as
it does now (so the flag is a clean kill-switch).

## 5. Data model migration

`supabase/migrations/0006_interview_google_sync.sql`:

```sql
alter table interviews
  add column google_event_id text,        -- null until pushed; set after create
  add column google_html_link text,       -- link to the event in Google
  add column meet_link text;              -- Google Meet URL, if created
create index on interviews (google_event_id);
```

Regenerate `src/types` from the schema after applying.

## 6. Code architecture

**New module** `src/lib/google-calendar.ts` (server-only):

```ts
// Uses `googleapis`. Pure functions; no Next imports.
createInterviewEvent(input): Promise<{ eventId; htmlLink; meetLink? }>
updateInterviewEvent(eventId, input): Promise<void>
deleteInterviewEvent(eventId): Promise<void>
freeBusy(interviewerEmail, fromISO, toISO): Promise<Interval[]>   // Level 2
```

- Build a JWT auth client from the service-account secrets.
- Event payload: summary `"{type} — {candidate} / {job}"`, description with the
  candidate profile link, `attendees: [candidateEmail, interviewerEmail]`,
  `start`/`end` with an explicit **IANA timezone** (see §7),
  `conferenceData` (Meet) when the type is remote, `reminders` default.

**Wire into the data layer**, not the route action, so every caller benefits and
the DB stays the source of truth:

1. `scheduleInterview()` — after the row inserts and the internal `SLOT_TAKEN`
   guard passes, call `createInterviewEvent`, then persist `google_event_id`,
   `google_html_link`, `meet_link`.
2. Reschedule — `updateInterviewEvent(google_event_id, …)`.
3. Cancel — `deleteInterviewEvent(google_event_id)` (or update status=cancelled).

**Failure isolation:** a Google outage must **not** block booking. Wrap Google
calls in try/catch — on failure, keep the interview saved, leave
`google_event_id` null, and surface a soft toast ("Saved — calendar invite
pending"). A small retry/backfill (cron or a "resync" button) repushes nulls.
Never log candidate PII to the console/error tracker on failure.

## 7. Timezone

Today everything is UTC. For real invites, send events in the **agency's
timezone** (`Asia/Manila`, UTC+8) so the owner books in local time and Google
renders correctly for each attendee. Keep storing `starts_at` in UTC in the DB
(per `CLAUDE.md`); only the Google payload and the booking UI need the IANA tz.
Consider a `settings.timezone` field so it's not hard-coded.

## 8. Meet links

For `technical` / `hr_interview` (remote) types, set
`conferenceData.createRequest` on insert and read back `meet_link`. Render it on
the candidate Schedule tab and in the calendar chip tooltip.

## 9. Level 2 — free/busy (later)

Before confirming a slot, call `freeBusy(interviewerEmail, start, end)`. If the
interviewer's real calendar is busy, warn (soft block) in the booking modal
alongside the existing `SLOT_TAKEN` check. Needs the broader `calendar` scope.

## 10. Level 3 — two-way (later, high effort)

`events.watch` push channels → a webhook route that reconciles changes (moved or
deleted in Google) back into `interviews` using stored sync tokens. Adds webhook
infra, channel renewal (channels expire), and conflict resolution. Only worth it
if interviewers will edit events directly in Google.

## 11. Risks / checklist

- [ ] Fresh Google Cloud project + Calendar API enabled + service account key.
- [ ] Shared calendar shared with the SA email ("make changes").
- [ ] Secrets in Doppler + Vercel; `GOOGLE_CALENDAR_ENABLED` flag off by default.
- [ ] Migration applied; types regenerated.
- [ ] Booking switched to `Asia/Manila`; DB stays UTC.
- [ ] Google calls fail-soft; PII never logged.
- [ ] Meet-link creation requires conferencing enabled on the calendar/workspace.
- [ ] (Per-user OAuth path only) Google app verification for the calendar scope.

## 12. Rough effort

Level 1 (shared-calendar push + invites + Meet, behind the flag): ~½–1 day of
focused work, most of it Google Cloud setup + the `google-calendar.ts` module +
the migration. The data-layer hooks are small because there's one write path.
