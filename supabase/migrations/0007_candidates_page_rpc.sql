-- ============================================================================
-- 0007_candidates_page_rpc.sql
--   search_candidates_page() — server-side filtered + paginated candidate
--   search. Does all filtering in SQL (EXISTS subqueries for tag/stage so it
--   scales to large tables) and returns the page's candidate ids + the total
--   match count (window function). SECURITY INVOKER (default) → the caller's
--   RLS on candidates/applications applies. Indexed columns back the filters.
-- ============================================================================

create or replace function public.search_candidates_page(
  p_q                text    default null,
  p_flagged          boolean default false,
  p_sources          text[]  default null,
  p_tags             text[]  default null,
  p_stages           text[]  default null,
  p_job_ids          uuid[]  default null,
  p_include_archived boolean default false,
  p_limit            int     default 25,
  p_offset           int     default 0
)
returns table (id uuid, total bigint)
language sql
stable
as $$
  with filtered as (
    select c.id, c.full_name
      from public.candidates c
     where (p_include_archived or c.archived_at is null)
       and (not p_flagged or c.flagged)
       and (p_sources is null or c.source::text = any (p_sources))
       and (
         p_tags is null
         or exists (
           select 1 from public.candidate_tags ct
            where ct.candidate_id = c.id and ct.tag = any (p_tags)
         )
       )
       and (
         (p_stages is null and p_job_ids is null)
         or exists (
           select 1 from public.applications a
            where a.candidate_id = c.id
              and (p_stages is null or a.stage::text = any (p_stages))
              and (p_job_ids is null or a.job_id = any (p_job_ids))
         )
       )
       and (
         p_q is null or p_q = ''
         or c.full_name ilike '%' || p_q || '%'
         or coalesce(c.email, '') ilike '%' || p_q || '%'
         or coalesce(c.location, '') ilike '%' || p_q || '%'
         or coalesce(c.summary, '') ilike '%' || p_q || '%'
         or coalesce(c.resume_text, '') ilike '%' || p_q || '%'
         or exists (select 1 from public.candidate_skills cs
                     where cs.candidate_id = c.id and cs.skill ilike '%' || p_q || '%')
         or exists (select 1 from public.candidate_certifications cc
                     where cc.candidate_id = c.id and cc.name ilike '%' || p_q || '%')
         or exists (select 1 from public.candidate_tags ct2
                     where ct2.candidate_id = c.id and ct2.tag ilike '%' || p_q || '%')
       )
  )
  select f.id, count(*) over () as total
    from filtered f
   order by f.full_name asc
   limit p_limit offset p_offset;
$$;
