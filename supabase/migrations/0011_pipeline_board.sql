-- Pipeline board in Postgres: instead of loading + re-scoring every application
-- (the 15k ceiling), return the top-N cards per stage using the CACHED
-- applications.match_score, plus the true per-stage counts. days_in_stage and
-- the stalled flag (domain rule 3) are computed in SQL. The board caps each
-- column; the count shows the real total and a "+N more" footer appears beyond
-- the cap (invisible at normal scale where a stage has fewer than the limit).

create or replace function public.pipeline_board(
  p_stalled_enabled boolean,
  p_stalled_days int,
  p_limit_per_stage int
)
returns jsonb
language sql
security invoker
stable
as $$
  with live_apps as (
    select a.id, a.candidate_id, a.job_id, a.stage, a.stage_entered_at, a.match_score,
           c.full_name candidate_name, c.flagged candidate_flagged
    from public.applications a
    join public.candidates c on c.id = a.candidate_id
    where c.archived_at is null
  ),
  enriched as (
    select la.id application_id, la.candidate_id, la.candidate_name,
           la.candidate_flagged, la.job_id, j.title job_title, j.visa::text visa,
           coalesce(la.match_score, 0)::int score, la.stage::text stage, la.stage_entered_at,
           floor(extract(epoch from (now() - la.stage_entered_at)) / 86400)::int days_in_stage,
           (
             p_stalled_enabled
             and la.stage in ('applied', 'screening', 'interview', 'offer')
             and floor(extract(epoch from (now() - greatest(
                   la.stage_entered_at,
                   coalesce((select max(n.created_at) from public.notes n where n.candidate_id = la.candidate_id), to_timestamp(0)),
                   coalesce((select max(e.created_at) from public.email_log e where e.candidate_id = la.candidate_id), to_timestamp(0))
                 )) / 86400)) >= p_stalled_days
           ) is_stalled,
           row_number() over (partition by la.stage order by la.stage_entered_at asc) rn
    from live_apps la
    join public.jobs j on j.id = la.job_id
  ),
  counts as (select stage::text stage, count(*)::int n from live_apps group by stage)
  select jsonb_build_object(
    'counts', (select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) from counts),
    'cards', (
      select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
      from (
        select application_id, candidate_id, candidate_name, candidate_flagged,
               job_id, job_title, visa, score, stage, days_in_stage, is_stalled
        from enriched
        where rn <= p_limit_per_stage
        order by stage, stage_entered_at asc
      ) x
    )
  );
$$;

grant execute on function public.pipeline_board(boolean, int, int) to authenticated;
