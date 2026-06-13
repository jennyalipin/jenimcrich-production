# `src/lib/data` — the data layer

The app currently runs entirely on a rich in-memory demo database (Supabase
is not provisioned yet). This folder is the seam where that swap happens:
**pages never change, only this layer does.**

## Import rules

| Module | Who may import it | Contents |
|---|---|---|
| `@/lib/data` (`index.ts`) | Server Components, server actions, route handlers **only** (throws in the browser) | All async data accessors + mutations; re-exports everything from `./types` |
| `@/lib/data/types` | Anyone, including client components | Entity types, enums, labels (`STAGE_LABELS`, `VISA_LABELS`, …), `isRestrictiveVisa`, `DataLayerError`, `REFERENCE_NOW_ISO` |
| `@/lib/data/demo-data` | **Nobody except `index.ts`** | The seed + store factory |

Client components receive data via props from Server Components, or call
server actions that wrap the mutation functions here.

## Demo determinism

Every seed timestamp is built relative to `REFERENCE_NOW`
(`2026-06-11T08:00:00Z`, exported from `@/lib/data`), and all "days in
stage" / stalled / upcoming-interview math is computed against that same
instant — so SSR output is deterministic. Mutation timestamps use
`max(wall clock, REFERENCE_NOW)`.

All demo PII is clearly fake: `@example.com` emails and reserved
`555-01xx` phone numbers.

## Domain rules enforced here

- **Rule 1** — `moveApplicationStage` always updates `stage_entered_at` and
  appends to `activity_log`.
- **Rule 3** — stalled = no stage move / note / email within
  `settings.stalled_days` (default 5), excluding hired/rejected.
  Interviews, scorecards and documents do *not* reset the stall clock.
- **Rule 5** — `scheduleInterview` throws `DataLayerError("SLOT_TAKEN")`
  when the interviewer already has a scheduled interview at that instant
  (`isSlotTaken` exposes the check for slot pickers).
- **Rule 6** — `logEmail` (and the booking confirmation inside
  `scheduleInterview`) writes to `email_log` **and** the candidate's
  `activity_log`.

`DataLayerError.message` is human-readable and safe to show in a toast.

## Swapping to Supabase later

1. Keep `types.ts` as the contract (field names already mirror the
   Postgres schema in `docs/ARCHITECTURE.md`).
2. Reimplement each function in `index.ts` with typed Supabase queries
   (signatures must not change); move the double-booking and stage-change
   audit guarantees into the DB (partial unique index + trigger) and keep
   the same thrown `DataLayerError` codes.
3. Delete `demo-data.ts` (or keep it as the local-dev seed script source).

## Seed contents (for demos)

11 jobs across cement / aggregates / mining / steel — including US roles
covering every visa enum value (`TN_CANADIAN_ONLY`, `TN_CANADIAN_OR_MEXICAN`,
`US_CITIZEN_GC_ONLY`, `H1B_TRANSFER`, `SPONSORSHIP_AVAILABLE`, `LOCAL`,
`UNSPECIFIED`) — 24 candidates, 26 applications across all six stages
(including one visa-based rejection and one multi-application candidate),
11 interviews (incl. two different interviewers booked at the same instant
to prove the guard is per-interviewer), scorecards, notes, documents,
5 email templates with `{{merge_fields}}`, an email log, a generated
append-only activity log, and settings (`stalled_days: 5`).
