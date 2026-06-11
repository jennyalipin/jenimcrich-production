# Architecture — JeniMcRich Recruitment Platform

## Stack & rationale

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router, TS) | One codebase for UI + API, server actions, Vercel-native |
| DB / Auth / Storage | Supabase | Postgres + RLS gives real multi-user security without building an auth server; Storage for resumes; generous free tier for an agency this size |
| Email | Resend | Simple API, per-recipient sends, webhooks for delivery/open tracking later |
| Charts | Recharts | Matches prototype charts (funnel/bar/doughnut) |
| Drag & drop | @dnd-kit | Accessible, maintained, works with React 18 |
| Hosting | Vercel | Zero-ops deploys, preview branches |
| Validation | Zod | Shared schemas between forms and server actions |

Alternatives considered: Firebase (weaker relational queries for funnel analytics), custom Node/Express + RDS (more ops burden than a 2–5 person agency needs).

## Data model

All tables have `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`. Soft delete via `archived_at`.

```
profiles            -- extends auth.users
  user_id fk, full_name, role enum(admin|recruiter|hiring_manager)

clients
  name, contact_name, contact_email, notes

jobs
  client_id fk, title, location, salary_range text, min_years int,
  description, status enum(open|on_hold|closed),
  visa enum(tn_canadian_only|tn_canadian_or_mexican|us_citizen_gc_only|
            h1b_transfer|sponsorship_available|local|unspecified),
  visa_notes text, jd_text text, opened_at

job_skills
  job_id fk, skill text, weight int check 1..3

job_notes                      -- hiring manager notes
  job_id fk, author_id fk, body text

candidates
  full_name, email unique-ish (dedupe key), phone, source enum,
  years_exp int, summary, expected_salary text, notice_period text,
  resume_text text (extracted), flagged bool, archived_at

candidate_skills
  candidate_id fk, skill text, years int

candidate_certifications
  candidate_id fk, name text

candidate_tags
  candidate_id fk, tag text

applications                   -- candidate ↔ job (a candidate can apply to several)
  candidate_id fk, job_id fk, stage enum(applied|screening|interview|offer|hired|rejected),
  stage_entered_at, applied_at
  -- match score computed in app code, optionally cached: match_score int, scored_at

notes
  candidate_id fk, author_id fk, category enum(general|screening|interview_feedback|
  client_feedback|technical|compensation), body text

scorecards
  application_id fk, interviewer_id fk,
  ratings jsonb  -- {competency: 1..5}, weights live in config
  summary text not null, recommendation enum(strong_hire|hire|consider|no_hire)

interviews
  application_id fk, interviewer_id fk, starts_at timestamptz, type enum,
  status enum(scheduled|completed|cancelled)
  -- UNIQUE (interviewer_id, starts_at) WHERE status='scheduled'  ← double-booking guard

documents
  candidate_id fk, storage_path, file_name, category enum(resume|portfolio|
  certification|offer_letter|other), uploaded_by fk

email_templates
  name, category enum, subject, body, created_by fk

email_log
  candidate_id fk, template_id fk nullable, to_email, subject,
  status enum(queued|sent|delivered|opened|bounced), resend_id text

activity_log                   -- the audit trail; append-only
  candidate_id fk, actor_id fk nullable, type enum(stage|note|email|doc|
  interview|tag|flag|scorecard|system), body text

settings                       -- singleton row or per-org later
  stalled_days int default 5, stalled_enabled bool default true
```

### Key constraints & triggers
- `interviews`: partial unique index prevents double-booking at the DB level (not just UI).
- `applications`: trigger on stage change → insert into `activity_log` + set `stage_entered_at` (so the audit trail can't be skipped).
- `candidates.email`: case-insensitive unique index for portal dedupe (deferred until Phase 4, warn-only in MVP).

## Security model (RLS sketch)

- All tables: `authenticated` role required; anonymous access only to (future) public job listings view.
- `jobs`, `job_notes`: UPDATE/INSERT for `hiring_manager` + `admin`; SELECT for all staff; DELETE admin-only.
- `candidates`, `applications`, `notes`, `scorecards`, `interviews`, `documents`: full CRUD for `recruiter` + `admin`; `hiring_manager` gets SELECT + INSERT on `scorecards`/`job_notes`.
- `email_templates`: SELECT all staff; mutations admin-only (template approval workflow later).
- Storage bucket `documents`: private; access via short-lived signed URLs generated server-side after an RLS-checked lookup.

## Core algorithms (ported from prototype — keep pure, keep tested)

- **`scoring.ts`** — for each JD skill (weight w): candidate has it → earn `w*10*(0.5+0.5*min(candYears/(minYears*0.6),1))`; plus experience component (20 pts, ratio of total years to required) and certification bonus (≤6 pts). Normalize to 0–100. Also emits `pros[]`, `gaps[]`, and `edge` (top skill + first cert).
- **`jd-parser.ts`** — regex/heuristic extraction of title, client, location, salary, min years, bullet requirements, skill dictionary matches with frequency weighting, and visa detection (TN/Canadian/Mexican/US-only/H-1B/sponsorship). Phase 2: add LLM-structured extraction behind the same interface.
- **`merge.ts`** — `{{candidate_name}} {{job_title}} {{client}} {{recruiter_name}} {{stage}} {{interview_date}}` substitution; throws on unknown fields in templates at save time.

## Integration plan

| Integration | Phase | Notes |
|---|---|---|
| Resend (send) | MVP | server-side only; idempotency key per (template, candidate, day) |
| Resend webhooks (delivered/opened/bounced) | 2 | updates `email_log.status` |
| PDF/DOCX text extraction (resume + JD) | 2 | `unpdf`/`mammoth` server-side, then LLM structuring via Claude API |
| Google Calendar | 3 | two-way sync; OAuth per interviewer |
| E-signature (Dropbox Sign) | 4 | webhook → stage auto-update to Hired |
| Public portal | 4 | separate route group, rate-limited, anti-spam |

## Environments

- `production` + `staging` Supabase projects; Vercel preview deploys point at staging.
- Secrets in Vercel env vars; never committed. `.env.example` lists required keys:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `RESEND_API_KEY`.

## Migration from prototype

The prototype's localStorage seed maps cleanly: `DB.jobs → jobs/job_skills`, `DB.candidates → candidates/*/applications`, `DB.templates → email_templates`. Write a one-time import script for Jenny's real spreadsheet data (CSV → candidates + applications) as part of the launch checklist.
