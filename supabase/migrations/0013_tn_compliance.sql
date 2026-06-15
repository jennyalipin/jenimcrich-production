-- ============================================================================
-- 0013_tn_compliance.sql — TN / USMCA visa-compliance module
--
-- Adds the document + activity enum values the TN checklist needs, and a
-- `tn_compliance` record (one per application) that captures the eligibility
-- screen, the legal-review interlock, and the immigration-document retention
-- window.
--
-- ⚠️ DO NOT apply this to any live database without sign-off. The eligibility
-- screen it backs is NOT legal advice (see src/lib/tn-eligibility.ts): the
-- USMCA occupation list and its title→profession mapping require review by a
-- licensed US immigration attorney before influencing any client/candidate
-- decision. `legal_review_required` / `legal_review_cleared_at` exist precisely
-- so an attorney's clearance is recorded before the result is relied upon.
--
-- Conventions (CLAUDE.md): every table has id uuid pk, created_at, updated_at,
-- soft-delete via archived_at; timestamps in UTC; RLS on every table.
--
-- NOTE: `alter type ... add value` cannot run in the same transaction block as
-- statements that then USE the new value (Postgres restriction). The enum
-- alters are therefore grouped at the very top, ahead of the table DDL below.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enum extensions (must precede any use of the new values)
-- ----------------------------------------------------------------------------

alter type public.document_category add value if not exists 'tn_support_letter';
alter type public.document_category add value if not exists 'credential_evaluation';
alter type public.document_category add value if not exists 'i94_record';
alter type public.document_category add value if not exists 'passport_copy';
alter type public.document_category add value if not exists 'tn_approval';

alter type public.activity_type add value if not exists 'compliance';
alter type public.activity_type add value if not exists 'legal_review';

-- ----------------------------------------------------------------------------
-- tn_compliance — one row per application that has been TN-screened.
-- ----------------------------------------------------------------------------

create table public.tn_compliance (
  id                        uuid primary key default gen_random_uuid(),
  application_id            uuid not null unique
                              references public.applications (id) on delete cascade,

  -- Snapshot of what was screened (job titles change; keep the value checked).
  job_title_at_check        text,

  -- Eligibility screen result (mirrors src/lib/tn-eligibility.ts).
  tn_eligible               boolean,                      -- null = not yet screened
  matched_occupation        text,
  eligibility_confidence    text
                              check (eligibility_confidence in ('exact', 'keyword', 'none')),

  -- Legal-review interlock. Required while the occupation mapping is unsigned;
  -- cleared (by an admin) once a licensed attorney has reviewed the case.
  legal_review_required     boolean not null default false,
  legal_review_cleared_at   timestamptz,
  legal_review_cleared_by   uuid references public.profiles (id) on delete set null,
  legal_review_notes        text,

  -- Immigration-document retention window. TN paperwork is kept for 3 years
  -- after hire, or 1 year after employment ends, whichever is later.
  hired_at                  timestamptz,
  employment_ended_at       timestamptz,
  retention_until           timestamptz generated always as (
                              case
                                when hired_at is null then null
                                when employment_ended_at is null
                                  then hired_at + interval '3 years'
                                else greatest(
                                  hired_at + interval '3 years',
                                  employment_ended_at + interval '1 year'
                                )
                              end
                            ) stored,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  archived_at               timestamptz
);

create index tn_compliance_application_id_idx on public.tn_compliance (application_id);

create trigger tn_compliance_set_updated_at
  before update on public.tn_compliance
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — mirrors the candidate-data matrix (domain rule 7):
--   * SELECT: all staff
--   * INSERT/UPDATE: recruiters + admins
--   * DELETE: admins only (records are otherwise soft-deleted via archived_at)
-- ----------------------------------------------------------------------------

alter table public.tn_compliance enable row level security;

create policy "tn_compliance: staff can read"
  on public.tn_compliance for select to authenticated
  using ((select public.is_staff()));

create policy "tn_compliance: recruiters and admins insert"
  on public.tn_compliance for insert to authenticated
  with check ((select public.has_role('recruiter', 'admin')));

create policy "tn_compliance: recruiters and admins update"
  on public.tn_compliance for update to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

create policy "tn_compliance: admins delete"
  on public.tn_compliance for delete to authenticated
  using ((select public.has_role('admin')));

-- ----------------------------------------------------------------------------
-- Admin-only legal-review interlock. The UPDATE policy above lets recruiters
-- edit the row (eligibility result, retention dates), but the attorney-signoff
-- columns must be admin-only. Postgres has no column-level RLS, so a BEFORE
-- UPDATE trigger blocks any non-admin from changing them. This is the real DB
-- gate behind clearLegalReviewAction's app-level admin re-check. (A service-role
-- request has no auth.uid() and is intentionally not blocked — trusted server.)
-- ----------------------------------------------------------------------------
create or replace function public.tn_compliance_guard_legal_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.legal_review_required   is distinct from old.legal_review_required
      or new.legal_review_cleared_at is distinct from old.legal_review_cleared_at
      or new.legal_review_cleared_by is distinct from old.legal_review_cleared_by
      or new.legal_review_notes      is distinct from old.legal_review_notes)
     and public.current_user_role() is distinct from 'admin'
     and auth.uid() is not null then
    raise exception 'Only an admin may change the legal-review interlock columns';
  end if;
  return new;
end;
$$;

create trigger tn_compliance_guard_legal_review
  before update on public.tn_compliance
  for each row execute function public.tn_compliance_guard_legal_review();
