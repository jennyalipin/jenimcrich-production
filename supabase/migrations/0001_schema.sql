-- ============================================================================
-- 0001_schema.sql — JeniMcRich Recruitment ATS: core schema
--
-- Apply with: pnpm dlx supabase db push   (or supabase db reset for local dev)
-- Requires a Supabase project (references auth.users). Postgres 15+
-- (gen_random_uuid() is built in; no extension needed).
--
-- Conventions (CLAUDE.md):
--   * every table: id uuid pk default gen_random_uuid(), created_at, updated_at
--   * soft delete via archived_at (never hard-delete candidates)
--   * dates stored in UTC (timestamptz)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'recruiter', 'hiring_manager');

create type public.job_status as enum ('open', 'on_hold', 'closed');

-- NOTE: values intentionally match the TS union in src/types/db.ts and the
-- canonical spelling in CLAUDE.md domain rule #4 (uppercase), so DB rows and
-- app code never need mapping.
create type public.visa_requirement as enum (
  'TN_CANADIAN_ONLY',
  'TN_CANADIAN_OR_MEXICAN',
  'US_CITIZEN_GC_ONLY',
  'H1B_TRANSFER',
  'SPONSORSHIP_AVAILABLE',
  'LOCAL',
  'UNSPECIFIED'
);

create type public.candidate_source as enum (
  'linkedin', 'referral', 'job_portal', 'indeed', 'agency', 'other'
);

-- Pipeline stages are fixed (CLAUDE.md domain rule #1).
create type public.pipeline_stage as enum (
  'applied', 'screening', 'interview', 'offer', 'hired', 'rejected'
);

create type public.note_category as enum (
  'general', 'screening', 'interview_feedback', 'client_feedback',
  'technical', 'compensation'
);

create type public.scorecard_recommendation as enum (
  'strong_hire', 'hire', 'consider', 'no_hire'
);

create type public.interview_type as enum (
  'phone_screen', 'hr_interview', 'technical', 'panel', 'final_panel',
  'client_interview', 'other'
);

create type public.interview_status as enum ('scheduled', 'completed', 'cancelled');

create type public.document_category as enum (
  'resume', 'portfolio', 'certification', 'offer_letter', 'other'
);

create type public.email_template_category as enum (
  'interview', 'rejection', 'offer', 'update', 'outreach', 'other'
);

create type public.email_status as enum (
  'queued', 'sent', 'delivered', 'opened', 'bounced'
);

create type public.activity_type as enum (
  'stage', 'note', 'email', 'doc', 'interview', 'tag', 'flag', 'scorecard', 'system'
);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- Staff profiles. Extends auth.users; user_id is nullable so staff records can
-- be provisioned (and demo-seeded) before the person first signs in — the
-- on_auth_user_created trigger links them by email at first sign-up.
create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        public.user_role not null default 'recruiter',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create unique index profiles_email_lower_key on public.profiles (lower(email));

-- Client companies (the agency's customers).
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  contact_email text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  archived_at   timestamptz
);

-- Job requisitions. Visa is a first-class column, not a tag (domain rule #4).
create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete restrict,
  title        text not null,
  location     text,
  salary_range text,            -- text range for now (multi-currency); revisit Phase 3
  min_years    integer not null default 0 check (min_years >= 0),
  description  text,
  status       public.job_status not null default 'open',
  visa         public.visa_requirement not null default 'UNSPECIFIED',
  visa_notes   text,
  jd_text      text,            -- raw JD as pasted/uploaded (input to jd-parser)
  opened_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create index jobs_client_id_idx on public.jobs (client_id);
create index jobs_status_idx on public.jobs (status) where archived_at is null;

-- Weighted JD skills (weight 1–3 feeds the match-scoring engine).
create table public.job_skills (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs (id) on delete cascade,
  skill      text not null,
  weight     integer not null default 1 check (weight between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, skill)
);

create index job_skills_job_id_idx on public.job_skills (job_id);

-- Hiring-manager notes attached to a job.
create table public.job_notes (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create index job_notes_job_id_idx on public.job_notes (job_id);

create table public.candidates (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text,
  phone           text,
  source          public.candidate_source not null default 'other',
  years_exp       integer not null default 0 check (years_exp >= 0),
  summary         text,
  expected_salary text,
  notice_period   text,
  resume_text     text,         -- extracted text, input to the matchmaker
  flagged         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz   -- candidates are NEVER hard-deleted
);

-- Case-insensitive lookup for dedupe. Intentionally NOT unique in MVP
-- (warn-only dedupe); promote to a unique index in Phase 4 (public portal).
create index candidates_email_lower_idx on public.candidates (lower(email));
create index candidates_archived_idx on public.candidates (archived_at) where archived_at is null;

create table public.candidate_skills (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  skill        text not null,
  years        integer not null default 0 check (years >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (candidate_id, skill)
);

create index candidate_skills_candidate_id_idx on public.candidate_skills (candidate_id);

create table public.candidate_certifications (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (candidate_id, name)
);

create index candidate_certifications_candidate_id_idx
  on public.candidate_certifications (candidate_id);

create table public.candidate_tags (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  tag          text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (candidate_id, tag)
);

create index candidate_tags_candidate_id_idx on public.candidate_tags (candidate_id);

-- Candidate <-> job. One application per (candidate, job); a candidate may
-- hold applications to several jobs.
create table public.applications (
  id               uuid primary key default gen_random_uuid(),
  candidate_id     uuid not null references public.candidates (id) on delete cascade,
  job_id           uuid not null references public.jobs (id) on delete cascade,
  stage            public.pipeline_stage not null default 'applied',
  stage_entered_at timestamptz not null default now(),
  applied_at       timestamptz not null default now(),
  match_score      integer check (match_score between 0 and 100), -- app-computed cache
  scored_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  unique (candidate_id, job_id)
);

create index applications_candidate_id_idx on public.applications (candidate_id);
create index applications_job_id_idx on public.applications (job_id);
create index applications_stage_idx on public.applications (stage) where archived_at is null;

-- Candidate notes (distinct from job_notes).
create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  author_id    uuid references public.profiles (id) on delete set null,
  category     public.note_category not null default 'general',
  body         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create index notes_candidate_id_idx on public.notes (candidate_id);

create table public.scorecards (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  interviewer_id uuid references public.profiles (id) on delete set null,
  ratings        jsonb not null default '{}'::jsonb, -- {competency: 1..5}; weights live in app config
  summary        text not null,
  recommendation public.scorecard_recommendation not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz
);

create index scorecards_application_id_idx on public.scorecards (application_id);

create table public.interviews (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  interviewer_id uuid not null references public.profiles (id) on delete restrict,
  starts_at      timestamptz not null,
  type           public.interview_type not null default 'other',
  status         public.interview_status not null default 'scheduled',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  archived_at    timestamptz
);

create index interviews_application_id_idx on public.interviews (application_id);
create index interviews_starts_at_idx on public.interviews (starts_at);

-- Double-booking guard at the DB level (domain rule #5): an interviewer can
-- hold only one *scheduled* interview per exact slot. Cancelled/completed
-- rows free the slot.
create unique index interviews_interviewer_slot_key
  on public.interviews (interviewer_id, starts_at)
  where status = 'scheduled';

comment on index public.interviews_interviewer_slot_key is
  'Prevents double-booking an interviewer: unique (interviewer_id, starts_at) while status = scheduled.';

-- File metadata; binaries live in the private Supabase Storage bucket "documents".
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  storage_path text not null unique,  -- e.g. candidates/<candidate_id>/<file_name>
  file_name    text not null,
  category     public.document_category not null default 'other',
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create index documents_candidate_id_idx on public.documents (candidate_id);

create table public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  category    public.email_template_category not null default 'other',
  subject     text not null,
  body        text not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

-- Outbound email audit (Resend). Status is advanced by Resend webhooks
-- (service role) in Phase 2: queued -> sent -> delivered -> opened | bounced.
create table public.email_log (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  template_id  uuid references public.email_templates (id) on delete set null,
  to_email     text not null,
  subject      text not null,
  status       public.email_status not null default 'queued',
  resend_id    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index email_log_candidate_id_idx on public.email_log (candidate_id);

-- Append-only audit trail per candidate. No UPDATE/DELETE policies are
-- granted in 0002_rls.sql, which keeps it append-only for app roles.
create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  actor_id     uuid references public.profiles (id) on delete set null, -- null = system
  type         public.activity_type not null,
  body         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index activity_log_candidate_created_idx
  on public.activity_log (candidate_id, created_at desc);

-- Singleton settings row (per-org later). The unique check column guarantees
-- at most one row.
create table public.settings (
  id              uuid primary key default gen_random_uuid(),
  singleton       boolean not null default true unique check (singleton),
  stalled_days    integer not null default 5 check (stalled_days between 1 and 30), -- UI offers 3/5/7/10
  stalled_enabled boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- updated_at triggers (every table)
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'clients', 'jobs', 'job_skills', 'job_notes',
    'candidates', 'candidate_skills', 'candidate_certifications', 'candidate_tags',
    'applications', 'notes', 'scorecards', 'interviews', 'documents',
    'email_templates', 'email_log', 'activity_log', 'settings'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t
    );
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Applications: stage-change audit trigger (domain rule #1)
-- Stage changes ALWAYS write to activity_log and refresh stage_entered_at —
-- enforced here so the audit trail cannot be skipped by any code path.
-- ----------------------------------------------------------------------------

create or replace function public.handle_application_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor     uuid;
  v_job_title text;
begin
  if new.stage is distinct from old.stage then
    new.stage_entered_at := now();

    select p.id into v_actor
      from public.profiles p
     where p.user_id = auth.uid();

    select j.title into v_job_title
      from public.jobs j
     where j.id = new.job_id;

    insert into public.activity_log (candidate_id, actor_id, type, body)
    values (
      new.candidate_id,
      v_actor,
      'stage',
      format('Moved to %s (from %s) — %s',
             initcap(replace(new.stage::text, '_', ' ')),
             initcap(replace(old.stage::text, '_', ' ')),
             coalesce(v_job_title, 'unknown job'))
    );
  end if;
  return new;
end;
$$;

create trigger application_stage_change
  before update of stage on public.applications
  for each row execute function public.handle_application_stage_change();

-- New applications also land in the audit trail ("Application received via …"),
-- timestamped at applied_at so backdated imports keep a coherent timeline.
create or replace function public.handle_application_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor     uuid;
  v_source    public.candidate_source;
  v_job_title text;
  v_source_label text;
begin
  select p.id into v_actor
    from public.profiles p
   where p.user_id = auth.uid();

  select c.source into v_source
    from public.candidates c
   where c.id = new.candidate_id;

  select j.title into v_job_title
    from public.jobs j
   where j.id = new.job_id;

  v_source_label := case v_source
    when 'linkedin'   then 'LinkedIn'
    when 'job_portal' then 'Job Portal'
    else initcap(coalesce(v_source::text, 'other'))
  end;

  insert into public.activity_log (candidate_id, actor_id, type, body, created_at, updated_at)
  values (
    new.candidate_id,
    v_actor,
    'stage',
    format('Application received via %s — %s', v_source_label, coalesce(v_job_title, 'unknown job')),
    new.applied_at,
    new.applied_at
  );
  return new;
end;
$$;

create trigger application_created
  after insert on public.applications
  for each row execute function public.handle_application_created();

-- ----------------------------------------------------------------------------
-- Auth -> profile bootstrap: when a user signs up, link them to a
-- pre-provisioned profile by email, or create a fresh recruiter profile.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set user_id = new.id,
         updated_at = now()
   where user_id is null
     and lower(email) = lower(coalesce(new.email, ''));

  if not found then
    insert into public.profiles (user_id, email, full_name, role)
    values (
      new.id,
      coalesce(new.email, new.id::text || '@unknown.invalid'),
      coalesce(
        new.raw_user_meta_data ->> 'full_name',
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'New User'
      ),
      'recruiter'
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
