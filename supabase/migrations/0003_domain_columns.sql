-- ============================================================================
-- 0003_domain_columns.sql — align schema with the app's domain types
--
-- The TS domain (`src/lib/data/types.ts`) carries two fields the initial
-- schema omitted. Add them so the data layer maps 1:1 instead of degrading:
--   * jobs.requirements        — bulleted JD requirements (rendered on /jobs/[id])
--   * interviews.duration_minutes — slot length (booking flow; default 60)
-- ============================================================================

alter table public.jobs
  add column if not exists requirements text[] not null default '{}';

alter table public.interviews
  add column if not exists duration_minutes integer not null default 60
  check (duration_minutes > 0 and duration_minutes <= 600);

-- candidates.location — shown across the candidate UI (detail, header, intake form)
alter table public.candidates
  add column if not exists location text;
