# Roadmap — JeniMcRich Recruitment Platform

## Phase 0 — Prototype ✅ (done, June 2026)

Single-file HTML demo validating every workflow: matching, kanban, bulk actions, templates, scheduling, scorecards, analytics, alerts, JD auto-fill, visa field, HM notes. Used as the living spec.

## Phase 1 — Foundation (week 1)

- Next.js + TypeScript + Tailwind scaffold, theme matching prototype
- Supabase: schema migrations for all tables, RLS policies, seed script
- Auth: login, roles, protected routes
- Shared UI kit: Badge, ScorePill, Modal, Toast, DataTable, layout shell (sidebar + topbar + bell)
- CI: lint, typecheck, build, vitest on every push

**Exit:** Jenny can log in on staging; roles verified; empty-state pages for all routes.

## Phase 2 — Core ATS (weeks 2–3)

- Jobs CRUD + visa field + JD text auto-fill + HM notes + per-job KPIs
- Candidates CRUD + documents (real Supabase Storage) + notes + activity log + tags/flags
- Match scoring engine ported + unit tests + Matchmaker view
- Kanban with @dnd-kit; stage triggers; stalled indicators
- Bulk actions (move/tag/archive)

**Exit:** full candidate lifecycle works without email; demo to one friendly client.

## Phase 3 — Communication & evaluation (week 4)

- Resend integration: template library, merge fields, bulk send with preview, offer letters, email_log
- Interview scheduling + double-booking guard + calendar view + confirmations
- Scorecards + aggregates
- Stalled alerts + settings

**Exit:** MVP launch checklist (see MVP.md) passes; import real data; go live.

## Phase 4 — Fast-follows (weeks 5–8, reprioritize after launch feedback)

1. Resume/JD PDF parsing (extraction + LLM structuring)
2. Email delivery/open tracking (webhooks)
3. Interview reminders + feedback nudges + daily digest
4. Side-by-side comparison; saved filters
5. Analytics filters (client/recruiter/date) + branded PDF client reports

## Phase 5 — Growth (quarter 2)

- Public job portal with application form + dedupe
- Candidate self-scheduling links + Google Calendar sync
- E-signature offers → auto stage updates
- Talent pipeline (passive candidates)
- Client read-only access (decide after PRD open question #2)

## Principles for re-planning

Ship Phase 3 before touching Phase 4 — a live tool with manual entry beats a perfect parser in staging. After launch, reorder Phase 4 purely by what annoys the team most in real use. Revisit this file monthly; delete anything that hasn't been missed in 60 days.
