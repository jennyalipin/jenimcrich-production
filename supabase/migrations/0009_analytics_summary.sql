-- Analytics aggregation in Postgres so the Analytics page no longer hydrates
-- the entire store (loadStore) on every view — the 15k-candidate scalability
-- ceiling. One stable, security-invoker function (RLS keeps it staff-scoped)
-- returns every figure the page needs as a single jsonb payload. Stalled logic
-- mirrors the app's rule (domain rule 3): active-stage apps whose last touch
-- (stage move / note / email) is older than the configured threshold.

create or replace function public.analytics_summary(
  p_stalled_enabled boolean,
  p_stalled_days int
)
returns jsonb
language sql
security invoker
stable
as $$
  with live_apps as (
    select a.*
    from public.applications a
    join public.candidates c on c.id = a.candidate_id
    where c.archived_at is null
  ),
  stage_counts as (
    select stage::text stage, count(*)::int n from live_apps group by stage
  ),
  time_in_stage as (
    select stage::text stage,
           round(avg(floor(extract(epoch from (now() - stage_entered_at)) / 86400)))::int avg_days
    from live_apps
    where stage in ('applied', 'screening', 'interview', 'offer')   -- ACTIVE_STAGES
    group by stage
  ),
  source_breakdown as (
    select c.source::text source,
           count(*)::int total,
           count(*) filter (
             where exists (
               select 1 from public.applications a
               where a.candidate_id = c.id
                 and a.stage in ('interview', 'offer', 'hired')
             )
           )::int qualified
    from public.candidates c
    where c.archived_at is null
    group by c.source
  ),
  hire as (
    select coalesce(
             round(avg(greatest(0, floor(extract(epoch from (stage_entered_at - applied_at)) / 86400)))),
             0
           )::int avg_days
    from live_apps
    where stage = 'hired'
  ),
  stalled as (
    select count(*)::int n
    from live_apps a
    where p_stalled_enabled
      and a.stage in ('applied', 'screening', 'interview', 'offer')
      and floor(extract(epoch from (now() - greatest(
            a.stage_entered_at,
            coalesce((select max(n.created_at) from public.notes n where n.candidate_id = a.candidate_id), to_timestamp(0)),
            coalesce((select max(e.created_at) from public.email_log e where e.candidate_id = a.candidate_id), to_timestamp(0))
          ))) / 86400) >= p_stalled_days
  )
  select jsonb_build_object(
    'total_candidates', (select count(*)::int from public.candidates where archived_at is null),
    'stage_counts', (select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) from stage_counts),
    'avg_time_to_hire_days', (select avg_days from hire),
    'time_in_stage', (select coalesce(jsonb_object_agg(stage, avg_days), '{}'::jsonb) from time_in_stage),
    'source_breakdown', (
      select coalesce(jsonb_agg(jsonb_build_object('source', source, 'total', total, 'qualified', qualified)), '[]'::jsonb)
      from source_breakdown
    ),
    'activity_counts', jsonb_build_object(
      'emails_sent', (select count(*)::int from public.email_log),
      'notes_logged', (select count(*)::int from public.notes),
      'scorecards_submitted', (select count(*)::int from public.scorecards),
      'interviews_scheduled', (select count(*)::int from public.interviews),
      'stalled_now', (select n from stalled)
    )
  );
$$;

grant execute on function public.analytics_summary(boolean, int) to authenticated;
