-- ============================================================================
-- 0002_rls.sql — Row Level Security for every table
--
-- Security model (docs/ARCHITECTURE.md + CLAUDE.md domain rule #7):
--   * Roles: admin | recruiter | hiring_manager, read from public.profiles
--     via auth.uid(). Anonymous users get nothing (future public job board
--     will be a dedicated view).
--   * jobs / job_notes (and clients, which parent jobs): INSERT/UPDATE for
--     hiring_manager + admin; SELECT all staff; DELETE admin-only.
--   * candidates, applications, notes, scorecards, interviews, documents
--     (+ candidate child tables): full CRUD recruiter + admin;
--     hiring_manager SELECT everywhere plus INSERT on scorecards/job_notes.
--   * email_templates: SELECT all staff; mutations admin-only.
--   * activity_log / email_log: append-only for app roles (no UPDATE/DELETE
--     policies). Resend webhooks advance email_log.status via the service
--     role, which bypasses RLS.
--
-- Policies use the (select fn()) form so Postgres evaluates the helper once
-- per statement (initplan), not once per row.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so they can read public.profiles without
-- tripping the profiles RLS policies (avoids recursive policy evaluation).
-- ----------------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
    from public.profiles p
   where p.user_id = auth.uid()
     and p.archived_at is null;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
    from public.profiles p
   where p.user_id = auth.uid()
     and p.archived_at is null;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.current_user_role() is not null;
$$;

-- Usage: public.has_role('recruiter', 'admin')
create or replace function public.has_role(variadic required public.user_role[])
returns boolean
language sql
stable
set search_path = public
as $$
  select public.current_user_role() = any (required);
$$;

grant execute on function
  public.current_profile_id(),
  public.current_user_role(),
  public.is_staff(),
  public.has_role(public.user_role[])
to authenticated;

-- ----------------------------------------------------------------------------
-- Enable RLS everywhere (deny-by-default until a policy matches)
-- ----------------------------------------------------------------------------

alter table public.profiles                 enable row level security;
alter table public.clients                  enable row level security;
alter table public.jobs                     enable row level security;
alter table public.job_skills               enable row level security;
alter table public.job_notes                enable row level security;
alter table public.candidates               enable row level security;
alter table public.candidate_skills         enable row level security;
alter table public.candidate_certifications enable row level security;
alter table public.candidate_tags           enable row level security;
alter table public.applications             enable row level security;
alter table public.notes                    enable row level security;
alter table public.scorecards               enable row level security;
alter table public.interviews               enable row level security;
alter table public.documents                enable row level security;
alter table public.email_templates          enable row level security;
alter table public.email_log                enable row level security;
alter table public.activity_log             enable row level security;
alter table public.settings                 enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------

create policy "profiles: staff can read staff directory"
  on public.profiles for select to authenticated
  using ((select public.is_staff()));

-- Users may edit their own profile but cannot change their own role
-- (current_user_role() reads the pre-update snapshot of the row).
create policy "profiles: users update own profile, role frozen"
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and role = (select public.current_user_role())
  );

create policy "profiles: admins manage all"
  on public.profiles for all to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));

-- ----------------------------------------------------------------------------
-- clients (parent of jobs — mutations mirror the jobs matrix)
-- ----------------------------------------------------------------------------

create policy "clients: staff can read"
  on public.clients for select to authenticated
  using ((select public.is_staff()));

create policy "clients: hiring managers and admins insert"
  on public.clients for insert to authenticated
  with check ((select public.has_role('hiring_manager', 'admin')));

create policy "clients: hiring managers and admins update"
  on public.clients for update to authenticated
  using ((select public.has_role('hiring_manager', 'admin')))
  with check ((select public.has_role('hiring_manager', 'admin')));

create policy "clients: admins delete"
  on public.clients for delete to authenticated
  using ((select public.has_role('admin')));

-- ----------------------------------------------------------------------------
-- jobs
-- ----------------------------------------------------------------------------

create policy "jobs: staff can read"
  on public.jobs for select to authenticated
  using ((select public.is_staff()));

create policy "jobs: hiring managers and admins insert"
  on public.jobs for insert to authenticated
  with check ((select public.has_role('hiring_manager', 'admin')));

create policy "jobs: hiring managers and admins update"
  on public.jobs for update to authenticated
  using ((select public.has_role('hiring_manager', 'admin')))
  with check ((select public.has_role('hiring_manager', 'admin')));

create policy "jobs: admins delete"
  on public.jobs for delete to authenticated
  using ((select public.has_role('admin')));

-- job_skills are edited as part of editing a job (delete here = removing a
-- skill row from the JD, not deleting the job — so HM + admin may delete).

create policy "job_skills: staff can read"
  on public.job_skills for select to authenticated
  using ((select public.is_staff()));

create policy "job_skills: hiring managers and admins manage"
  on public.job_skills for all to authenticated
  using ((select public.has_role('hiring_manager', 'admin')))
  with check ((select public.has_role('hiring_manager', 'admin')));

-- ----------------------------------------------------------------------------
-- job_notes (hiring managers + admins write; authors own their notes)
-- ----------------------------------------------------------------------------

create policy "job_notes: staff can read"
  on public.job_notes for select to authenticated
  using ((select public.is_staff()));

create policy "job_notes: hiring managers and admins insert as themselves"
  on public.job_notes for insert to authenticated
  with check (
    (select public.has_role('hiring_manager', 'admin'))
    and (author_id is null or author_id = (select public.current_profile_id()))
  );

create policy "job_notes: authors update own, admins any"
  on public.job_notes for update to authenticated
  using (
    (select public.has_role('admin'))
    or ((select public.has_role('hiring_manager'))
        and author_id = (select public.current_profile_id()))
  )
  with check (
    (select public.has_role('admin'))
    or ((select public.has_role('hiring_manager'))
        and author_id = (select public.current_profile_id()))
  );

create policy "job_notes: authors delete own, admins any"
  on public.job_notes for delete to authenticated
  using (
    (select public.has_role('admin'))
    or ((select public.has_role('hiring_manager'))
        and author_id = (select public.current_profile_id()))
  );

-- ----------------------------------------------------------------------------
-- candidates + child tables: recruiter/admin CRUD, hiring_manager read-only
-- ----------------------------------------------------------------------------

create policy "candidates: staff can read"
  on public.candidates for select to authenticated
  using ((select public.is_staff()));

create policy "candidates: recruiters and admins manage"
  on public.candidates for all to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

create policy "candidate_skills: staff can read"
  on public.candidate_skills for select to authenticated
  using ((select public.is_staff()));

create policy "candidate_skills: recruiters and admins manage"
  on public.candidate_skills for all to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

create policy "candidate_certifications: staff can read"
  on public.candidate_certifications for select to authenticated
  using ((select public.is_staff()));

create policy "candidate_certifications: recruiters and admins manage"
  on public.candidate_certifications for all to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

create policy "candidate_tags: staff can read"
  on public.candidate_tags for select to authenticated
  using ((select public.is_staff()));

create policy "candidate_tags: recruiters and admins manage"
  on public.candidate_tags for all to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

-- ----------------------------------------------------------------------------
-- applications
-- ----------------------------------------------------------------------------

create policy "applications: staff can read"
  on public.applications for select to authenticated
  using ((select public.is_staff()));

create policy "applications: recruiters and admins manage"
  on public.applications for all to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

-- ----------------------------------------------------------------------------
-- notes (candidate notes)
-- ----------------------------------------------------------------------------

create policy "notes: staff can read"
  on public.notes for select to authenticated
  using ((select public.is_staff()));

create policy "notes: recruiters and admins manage"
  on public.notes for all to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

-- ----------------------------------------------------------------------------
-- scorecards (hiring managers may also submit — as themselves)
-- ----------------------------------------------------------------------------

create policy "scorecards: staff can read"
  on public.scorecards for select to authenticated
  using ((select public.is_staff()));

create policy "scorecards: staff insert (HMs only as themselves)"
  on public.scorecards for insert to authenticated
  with check (
    (select public.has_role('recruiter', 'admin'))
    or ((select public.has_role('hiring_manager'))
        and interviewer_id = (select public.current_profile_id()))
  );

create policy "scorecards: recruiters and admins update"
  on public.scorecards for update to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

create policy "scorecards: recruiters and admins delete"
  on public.scorecards for delete to authenticated
  using ((select public.has_role('recruiter', 'admin')));

-- ----------------------------------------------------------------------------
-- interviews
-- ----------------------------------------------------------------------------

create policy "interviews: staff can read"
  on public.interviews for select to authenticated
  using ((select public.is_staff()));

create policy "interviews: recruiters and admins manage"
  on public.interviews for all to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

-- ----------------------------------------------------------------------------
-- documents (metadata; binaries are in Storage — see notes at end of file)
-- ----------------------------------------------------------------------------

create policy "documents: staff can read"
  on public.documents for select to authenticated
  using ((select public.is_staff()));

create policy "documents: recruiters and admins manage"
  on public.documents for all to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

-- ----------------------------------------------------------------------------
-- email_templates (mutations admin-only; approval workflow later)
-- ----------------------------------------------------------------------------

create policy "email_templates: staff can read"
  on public.email_templates for select to authenticated
  using ((select public.is_staff()));

create policy "email_templates: admins manage"
  on public.email_templates for all to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));

-- ----------------------------------------------------------------------------
-- email_log (append-only for app roles; webhook status updates use the
-- service role which bypasses RLS — intentionally no UPDATE/DELETE policies)
-- ----------------------------------------------------------------------------

create policy "email_log: staff can read"
  on public.email_log for select to authenticated
  using ((select public.is_staff()));

create policy "email_log: recruiters and admins insert"
  on public.email_log for insert to authenticated
  with check ((select public.has_role('recruiter', 'admin')));

-- ----------------------------------------------------------------------------
-- activity_log (append-only audit trail: no UPDATE/DELETE policies at all)
-- ----------------------------------------------------------------------------

create policy "activity_log: staff can read"
  on public.activity_log for select to authenticated
  using ((select public.is_staff()));

create policy "activity_log: staff insert as themselves or system"
  on public.activity_log for insert to authenticated
  with check (
    (select public.is_staff())
    and (actor_id is null or actor_id = (select public.current_profile_id()))
  );

-- ----------------------------------------------------------------------------
-- settings (singleton)
-- ----------------------------------------------------------------------------

create policy "settings: staff can read"
  on public.settings for select to authenticated
  using ((select public.is_staff()));

create policy "settings: admins insert"
  on public.settings for insert to authenticated
  with check ((select public.has_role('admin')));

create policy "settings: admins update"
  on public.settings for update to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));

-- ============================================================================
-- Storage bucket "documents" — provisioning + policy notes (NOT executed here;
-- storage schema objects are managed when the Supabase project is provisioned.
-- Run the statements below once, via the dashboard SQL editor or a later
-- migration, after Storage is available.)
--
--   -- 1) Private bucket (resumes / certifications / offer letters):
--   -- insert into storage.buckets (id, name, public)
--   -- values ('documents', 'documents', false)
--   -- on conflict (id) do nothing;
--
--   -- 2) Object policies. Reads happen server-side via short-lived signed
--   --    URLs created AFTER an RLS-checked lookup of public.documents, so
--   --    browser roles never need SELECT on storage.objects. If direct
--   --    client access is ever wanted, use:
--   -- create policy "documents bucket: staff read"
--   --   on storage.objects for select to authenticated
--   --   using (bucket_id = 'documents' and (select public.is_staff()));
--
--   -- create policy "documents bucket: recruiters and admins upload"
--   --   on storage.objects for insert to authenticated
--   --   with check (bucket_id = 'documents' and (select public.has_role('recruiter', 'admin')));
--
--   -- create policy "documents bucket: recruiters and admins update"
--   --   on storage.objects for update to authenticated
--   --   using (bucket_id = 'documents' and (select public.has_role('recruiter', 'admin')))
--   --   with check (bucket_id = 'documents' and (select public.has_role('recruiter', 'admin')));
--
--   -- create policy "documents bucket: recruiters and admins delete"
--   --   on storage.objects for delete to authenticated
--   --   using (bucket_id = 'documents' and (select public.has_role('recruiter', 'admin')));
--
--   -- 3) Object key convention: candidates/<candidate_id>/<file_name>, kept
--   --    in sync with public.documents.storage_path (unique).
-- ============================================================================
