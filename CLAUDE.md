# CLAUDE.md — JeniMcRich Recruitment Platform

This file gives Claude Code the context it needs to work on this project. Read it fully before making changes.

## What this project is

A recruitment/ATS web application for **JeniMcRich Recruitment**, an agency placing candidates into heavy-industry roles (cement, mining, aggregates, steel) for client companies, including US roles with visa constraints (TN visa — Canadians only, or Canadian/Mexican).

A fully working single-file HTML prototype exists at `prototype/JeniMcRich-Recruitment-App.html`. **It is the source of truth for UX, workflows, and the match-scoring algorithm.** When in doubt about how a feature should behave, open the prototype and replicate it.

Key reference docs (read before large tasks):
- `docs/PRD.md` — full product requirements with priorities
- `docs/MVP.md` — what ships in v1; the cut line
- `docs/ARCHITECTURE.md` — stack, data model, integrations
- `docs/ROADMAP.md` — build phases

## Tech stack

- **Framework:** Next.js 14+ (App Router), TypeScript strict mode
- **Styling:** Tailwind CSS. Theme: dark slate (#0f172a) headers/sidebar, white cards, emerald (#059669) primary, amber for warnings. Match the prototype's look.
- **Backend:** Supabase — Postgres, Auth, Storage (resumes/documents), Row Level Security on every table
- **Email:** Resend (transactional + bulk with per-recipient merge)
- **Charts:** Recharts
- **Drag & drop:** @dnd-kit (kanban board)
- **Hosting:** Vercel
- **Validation:** Zod on all API inputs

## Commands

This machine uses **pnpm** (no standalone npm).

```bash
pnpm dev                  # local dev server
pnpm build                # production build — must pass before any PR
pnpm lint                 # eslint — must pass
pnpm typecheck            # tsc --noEmit — must pass
pnpm test                 # vitest unit tests
pnpm dlx supabase db push # apply local migrations
```

## Project structure

```
src/
  app/                # Next.js App Router pages
    (auth)/login/
    dashboard/
    candidates/       # list + [id] detail (tabs: overview, notes, scorecards, documents, schedule, activity)
    pipeline/         # kanban board
    matchmaker/       # resume upload → ranked JD matches
    jobs/             # list + [id] drill-down KPIs
    calendar/
    templates/
    analytics/
    settings/
  components/         # shared UI (Badge, ScorePill, Modal, Toast, DataTable…)
  lib/
    scoring.ts        # match-scoring engine — port from prototype, keep pure & unit-tested
    merge.ts          # email merge fields {{candidate_name}} etc.
    jd-parser.ts      # JD text → structured job fields (incl. visa detection)
    supabase/         # client helpers, typed queries
  types/              # shared TS types generated from DB schema
supabase/
  migrations/
docs/
```

## Domain rules (do not change without asking)

1. **Pipeline stages are fixed:** Applied → Screening → Interview → Offer → Hired, plus Rejected. Stage changes must always write to `activity_log` and update `stage_entered_at`.
2. **Match scoring:** weighted skill overlap (weights 1–3 per JD skill) + years-of-experience ratio + certification bonus, normalized to 0–100. Port the exact algorithm from the prototype's `matchScore()`. Green ≥80, amber 60–79, red <60.
3. **Stalled candidate:** no stage movement/note/email within N days (configurable: 3/5/7/10, default 5). Excludes Hired/Rejected.
4. **Visa field on jobs** is first-class, not a tag: enum includes `TN_CANADIAN_ONLY`, `TN_CANADIAN_OR_MEXICAN`, `US_CITIZEN_GC_ONLY`, `H1B_TRANSFER`, `SPONSORSHIP_AVAILABLE`, `LOCAL`, `UNSPECIFIED`, plus free-text notes. Always render the 🛂 badge when restrictive.
5. **Interview booking** must prevent double-booking an interviewer's slot.
6. **Bulk email** always shows per-recipient preview before send; sends are logged to `email_log` AND each candidate's `activity_log`.
7. **Permissions:** `admin`, `recruiter`, `hiring_manager`. Hiring managers can edit jobs and add job notes; recruiters manage candidates and move cards; only admins delete jobs or manage templates' approval. Enforce via Supabase RLS, not just UI.

## Conventions

- Server Components by default; `"use client"` only where interaction requires it.
- All mutations through server actions or route handlers with Zod validation — never trust client input.
- Every table: `id uuid pk`, `created_at`, `updated_at`. Soft-delete via `archived_at` (never hard-delete candidates).
- Money/salary stored as text ranges for now (agency works across currencies); revisit in Phase 3.
- Dates in UTC in DB; render in user's locale.
- No `any`. No localStorage for business data (prototype habit — do not carry over).
- Tests required for: `scoring.ts`, `jd-parser.ts`, `merge.ts`, RLS policies.

## Gotchas

- The prototype simulates email/calendar/parsing — production must implement them for real (Resend, Google Calendar API in Phase 3, PDF text extraction + LLM for resume parsing).
- Resume/document files go to Supabase Storage with signed URLs; bucket is private.
- Candidate PII: never log emails/phones to console or error trackers.
- The agency's user (owner) is non-technical — error messages must be human-readable.
