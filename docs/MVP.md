# MVP Definition — JeniMcRich Recruitment Platform

The MVP is the smallest version Jenny's team can run their **entire daily workflow** on, replacing spreadsheets on day one. Everything here is P0 from the PRD. If a feature is not on this list, it does not block launch.

## The one-sentence test

> A recruiter can take a JD from a client, post the job (with visa terms), add candidates with real resumes, see who matches best, move them through the pipeline, email them from templates, book interviews without double-booking, collect scorecards, and show the client a funnel report — all in the app, with nothing falling through the cracks.

## In scope (must ship)

### Core
1. **Auth & roles** — login, admin/recruiter/hiring_manager, RLS enforced.
2. **Jobs** — CRUD, status, weighted skills, **visa field + notes**, **JD text auto-fill**, **HM notes**, per-job KPIs.
3. **Candidates** — CRUD, real file storage for resumes/documents, search/filter/tags/flags, categorized notes, full activity log.
4. **Match scoring** — ported 1:1 from prototype (`matchScore()`), unit-tested; scores everywhere candidates appear; Matchmaker view.
5. **Kanban pipeline** — drag & drop, auto status + logging, interview-email prompt, stalled indicators.
6. **Bulk actions** — move/tag/archive/email with confirmation + per-recipient preview.
7. **Email** — real sends via Resend, template library with merge fields, offer letter generator, full send log.
8. **Scheduling** — slot booking, double-book prevention, confirmations, calendar month view.
9. **Scorecards** — weighted 6-competency form, aggregate score, recommendation.
10. **Alerts** — stalled-candidate notifications with configurable threshold + snooze.
11. **Analytics** — dashboard stats, funnel + conversion, source effectiveness, days-in-stage, CSV export.

### Launch checklist (acceptance criteria)
- [ ] All P0 flows demo-able end-to-end with 2 real users (Jenny + 1 recruiter)
- [ ] Scoring engine unit tests pass and outputs match prototype on the 3 sample resumes (±2 points)
- [ ] RLS verified: hiring_manager cannot modify candidates; recruiter cannot delete jobs
- [ ] A real email lands in a real inbox from a template with correct merge fields
- [ ] A resume PDF uploads, downloads via signed URL, and is invisible to anonymous users
- [ ] Double-booking the same interviewer slot is impossible (tested concurrently)
- [ ] 1,000-candidate seed: list view loads <1s, kanban drag is instant
- [ ] Import of Jenny's existing candidate spreadsheet (CSV importer or one-time script)
- [ ] Daily backups confirmed; staging + production environments separated

## Out of MVP (fast-follows, in order)

1. PDF/DOCX resume & JD parsing (auto-extract) — *MVP accepts manual fields + pasted JD text*
2. Email open/bounce tracking
3. Interview reminders (1h before) + feedback nudges (24h after)
4. Daily digest email
5. Side-by-side candidate comparison
6. Google Calendar sync
7. Candidate self-scheduling
8. Public job portal
9. E-signature offers
10. Client-facing report exports (PDF, branded)

## Honest cut rationale

- **Parsing** is deferred because manual entry with the JD-paste auto-fill is tolerable for the team's volume, while robust PDF parsing is the single highest-effort item.
- **Portal** is deferred because inbound volume is currently agency-sourced; build it when clients start linking to listings.
- **Calendar sync** is deferred because the in-app calendar already prevents the main pain (double-booking); sync adds OAuth complexity.

## Estimated effort

Roughly 4–6 weeks for a solo developer working with Claude Code: week 1 schema/auth/RLS, weeks 2–3 candidates+jobs+pipeline+scoring, week 4 email+scheduling+scorecards, weeks 5–6 analytics, alerts, polish, import, launch checklist.
