# Product Requirements Document — JeniMcRich Recruitment Platform

**Version:** 1.0 · **Date:** June 2026 · **Owner:** Jenny Maquidato (JeniMcRich Recruitment)
**Status:** Approved for MVP build · **Prototype:** `JeniMcRich-Recruitment-App.html` (validated)

---

## 1. Problem statement

JeniMcRich Recruitment places candidates into specialized heavy-industry roles (cement, mining, aggregates, steel) across PH and North American clients. Today the workflow lives in spreadsheets, email threads, and memory. This causes lost candidates, slow client responses, missed follow-ups, no objective way to compare applicants, and zero visibility into pipeline health. Off-the-shelf ATS products are priced for enterprises and don't handle the agency's niche needs (per-client roles, visa constraints like TN-Canadian-only, weighted skill matching for technical industrial roles).

## 2. Goals & success metrics

| Goal | Metric | Target (6 months post-launch) |
|---|---|---|
| Faster placements | Average time-to-hire | −25% vs. baseline |
| No candidate falls through cracks | Candidates stalled >7 days | <5% of active pipeline |
| Objective evaluation | Roles with ≥2 completed scorecards before offer | >80% |
| Recruiter efficiency | Time spent on manual data entry & follow-up emails | −50% (self-reported) |
| Client confidence | Monthly KPI report delivered per client | 100% |

## 3. Users

- **Recruiter (primary, daily):** sources candidates, screens, moves pipeline, sends emails, books interviews.
- **Hiring Manager (weekly):** reviews shortlists, fills scorecards, edits job details, adds job notes.
- **Admin/Owner (Jenny):** everything above + manages users, templates, settings, exports reports.
- **Candidate (Phase 4):** applies via public job portal, self-schedules interviews.

## 4. Functional requirements

Priorities: **P0** = MVP must-have · **P1** = fast-follow · **P2** = later.

### 4.1 Authentication & roles
- P0: Email/password login (Supabase Auth); roles: admin, recruiter, hiring_manager.
- P0: RLS-enforced permissions (HM edits jobs; recruiters manage candidates; admin deletes/configures).
- P2: SSO (Google Workspace).

### 4.2 Jobs
- P0: CRUD job listings: title, client, location, salary range, min years, weighted skills (1–3), requirements, description, status (Open/On Hold/Closed).
- P0: **Work authorization field** (enum: TN–Canadians only, TN–Canadian or Mexican, US Citizen/GC only, H-1B transfer, sponsorship available, local, unspecified) + free-text visa notes. Restrictive visas render an amber 🛂 badge everywhere the job appears.
- P0: **JD auto-fill:** paste or upload JD text → parse title, client, location, salary, years, requirements, skills, visa terms into the form for review.
- P1: JD auto-fill from PDF/DOCX (server-side extraction + LLM structuring).
- P0: **Hiring manager notes** per job: timestamped, attributed, added over time.
- P0: Per-job drill-down: applicants by stage, funnel chart, source effectiveness, time-to-fill, interview→offer rate.

### 4.3 Candidates
- P0: CRUD candidate profiles: contact info, source, years exp, skills(+years), certifications, expected salary, notice period, summary.
- P0: Resume & document storage (private bucket, signed URLs), categorized (Resume/Portfolio/Certification/Offer Letter).
- P0: List view: search (name, skills, resume keywords), filter sidebar (stage, role, tags, flagged), priority flag ⭐, tags, sort by match score.
- P0: Bulk actions with confirmation: move stage, tag, archive, bulk email. Checkboxes + select-all.
- P0: Notes: categorized (General/Screening/Interview Feedback/Client Feedback/Technical/Compensation), timestamped, attributed, searchable, team-only.
- P0: Activity log per candidate: every stage change, note, email, document, interview — filterable timeline.
- P1: Resume parsing: upload PDF → auto-extract contact, skills, experience into profile fields.
- P1: Side-by-side comparison of 2–3 candidates (skills, scores, notes).
- P2: Talent pipeline (candidates not tied to an open role, tagged for future search).

### 4.4 Matching
- P0: Scoring engine: weighted skill overlap + experience ratio + certification bonus → 0–100; pros, gaps ("cons"), and "The Edge" highlight per job.
- P0: Matchmaker view: upload/select resume → ranked matches against all open JDs with staged progress UI.
- P0: Score displayed on candidate list, kanban cards, and job drill-downs.

### 4.5 Pipeline (kanban)
- P0: Drag-and-drop board: Applied → Screening → Interview → Offer → Hired, + Rejected. Drop updates status, logs activity.
- P0: Moving to Interview triggers optional interview-invitation email (template prefilled, recruiter confirms).
- P0: Stalled indicator on cards (amber edge + days-in-stage).

### 4.6 Email & templates
- P0: Template library with categories and merge fields ({{candidate_name}}, {{job_title}}, {{client}}, {{recruiter_name}}, {{stage}}, {{interview_date}}).
- P0: Bulk send via Resend with **per-recipient preview**, edit/remove recipients, confirmation for ≥10 recipients; all sends logged to email_log + candidate activity.
- P0: Offer letter generator: template + candidate/job data → preview, edit, send; archived to candidate documents; auto-moves stage to Offer.
- P1: Delivery/open/bounce tracking (Resend webhooks).
- P2: Centralized inbox (reply threading onto candidate profiles).
- P2: E-signature for offers (DocuSign/Dropbox Sign); on signature, stage → Hired.

### 4.7 Scheduling & calendar
- P0: Interview booking from candidate profile: date, slot, type, interviewer; double-booking prevented; confirmations emailed.
- P0: Calendar month view of all interviews, pulled from candidate records.
- P1: In-app + email reminders 1 hour before interviews; interviewer feedback nudge 24h after.
- P2: Google Calendar two-way sync; candidate self-scheduling links.

### 4.8 Scorecards
- P0: Structured scorecard per interview: 6 weighted competencies (Technical, Industry Experience, Communication, Leadership, Culture Fit, Problem-Solving) on 1–5 stars, mandatory summary, recommendation (Strong Hire/Hire/Consider/No Hire). Aggregate weighted average on profile.
- P2: Admin-configurable scorecard templates per job type.

### 4.9 Notifications & automation
- P0: Stalled-candidate alerts: configurable threshold (3/5/7/10 days) + on/off toggle; notification bell + dashboard list, sorted by urgency; snooze.
- P1: Daily digest email to recruiters: today's interviews + overdue items.
- P1: Auto-task for assigned recruiter when candidate stalls.
- P2: Candidate-facing reminders (missing documents).

### 4.10 Analytics & reporting
- P0: Dashboard: active candidates, open roles, avg time-to-hire, stalled count, pipeline snapshot, upcoming interviews.
- P0: Analytics page: funnel with stage conversion rates, source effectiveness (total vs qualified), avg days-in-stage, recruiter activity, offer acceptance rate.
- P0: CSV export (candidates, metrics); print-to-PDF report.
- P1: Filters by client/recruiter/date range; monthly PDF summary.

### 4.11 Public job portal (Phase 4)
- P2: Public listing page per open job (visa requirements shown), application form (incl. expected salary + notice period), auto-creates candidate record, dedupe by email.

## 5. Non-functional requirements

- **Security:** RLS on all tables; private storage; PII never in logs; HTTPS only.
- **Performance:** list views <1s for 5,000 candidates; kanban drag feels instant (optimistic updates).
- **Reliability:** email sends idempotent (no double-sends); daily DB backups (Supabase PITR).
- **Usability:** owner is non-technical — plain-language errors, confirmation dialogs on destructive/bulk actions.
- **Compliance:** candidate data export & delete-on-request (PH DPA / GDPR-style hygiene).

## 6. Explicitly out of scope (v1)

Payroll/onboarding, background checks, LinkedIn scraping, chat/messaging between users, mobile apps (responsive web only), multi-agency white-labeling, AI-written outreach (templates only).

## 7. Open questions

1. Which email domain will Resend send from? (needs DNS access)
2. Do clients ever get login access, or only emailed reports? (affects roles in Phase 3+)
3. Salary normalization across PHP/USD/CAD — needed for analytics later?
4. Data migration: is there an existing spreadsheet of candidates to import at launch?
