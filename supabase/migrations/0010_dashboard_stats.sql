-- Dashboard aggregation in Postgres so the dashboard (and the notification bell
-- poll, which calls getDashboardStats every 60s) no longer hydrate the whole
-- store. Returns the KPI aggregates plus the top-N stalled applications (the
-- dashboard shows ~8) with just the fields the table renders. Interviews and
-- the activity feed are fetched as separate bounded queries in the data layer.
-- Stalled logic mirrors domain rule 3 (active-stage apps past the threshold).

create or replace function public.dashboard_stats(
  p_stalled_enabled boolean,
  p_stalled_days int,
  p_stalled_limit int
)
returns jsonb
language sql
security invoker
stable
as $$
  with live_apps as (
    select a.id, a.candidate_id, a.job_id, a.stage, a.stage_entered_at, a.applied_at,
           c.full_name candidate_name, c.flagged candidate_flagged
    from public.applications a
    join public.candidates c on c.id = a.candidate_id
    where c.archived_at is null
  ),
  stage_counts as (
    select stage::text stage, count(*)::int n from live_apps group by stage
  ),
  open_jobs as (
    select id, client_id from public.jobs where archived_at is null and status = 'open'
  ),
  hire as (
    select coalesce(
             round(avg(greatest(0, floor(extract(epoch from (stage_entered_at - applied_at)) / 86400)))),
             0
           )::int avg_days
    from live_apps where stage = 'hired'
  ),
  stalled_all as (
    select la.id application_id, la.candidate_id, la.candidate_name, la.candidate_flagged,
           j.title job_title, cl.name client_name, la.stage::text stage,
           floor(extract(epoch from (now() - greatest(
             la.stage_entered_at,
             coalesce((select max(n.created_at) from public.notes n where n.candidate_id = la.candidate_id), to_timestamp(0)),
             coalesce((select max(e.created_at) from public.email_log e where e.candidate_id = la.candidate_id), to_timestamp(0))
           ))) / 86400)::int days_stalled
    from live_apps la
    join public.jobs j on j.id = la.job_id
    join public.clients cl on cl.id = j.client_id
    where p_stalled_enabled and la.stage in ('applied', 'screening', 'interview', 'offer')
  ),
  stalled_f as (
    select * from stalled_all where days_stalled >= p_stalled_days
  )
  select jsonb_build_object(
    'stage_counts', (select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) from stage_counts),
    'active_candidates', (
      select count(distinct candidate_id)::int from live_apps
      where stage in ('applied', 'screening', 'interview', 'offer')
    ),
    'flagged_candidates', (select count(*)::int from public.candidates where archived_at is null and flagged),
    'open_jobs', (select count(*)::int from open_jobs),
    'open_clients', (select count(distinct client_id)::int from open_jobs),
    'hired_total', coalesce((select n from stage_counts where stage = 'hired'), 0),
    'avg_time_to_hire_days', (select avg_days from hire),
    'stalled_count', (select count(*)::int from stalled_f),
    'stalled', (
      select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      from (
        select application_id, candidate_id, candidate_name, candidate_flagged,
               job_title, client_name, stage, days_stalled
        from stalled_f order by days_stalled desc limit p_stalled_limit
      ) s
    )
  );
$$;

grant execute on function public.dashboard_stats(boolean, int, int) to authenticated;
