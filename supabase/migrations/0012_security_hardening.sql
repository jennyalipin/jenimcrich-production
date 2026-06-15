-- 0012_security_hardening.sql — close two RLS gaps found in the security review.
--
-- (A) storage.objects policies for the private `candidate-documents` bucket.
--     The bucket is `public = false`, but with NO object-level RLS any
--     authenticated user could call the Storage API directly and read/write
--     objects, bypassing the `public.documents` table RLS that the app relies
--     on. The app itself only ever reaches Storage server-side via short-lived
--     signed URLs created AFTER an RLS-checked `documents` lookup, so these
--     policies do not change app behaviour — they just deny the direct path.
--
-- (B) Candidates must never be hard-deleted (soft-delete via `archived_at`).
--     The previous `for all` policy let recruiters issue DELETE. Split it so
--     recruiters/admins can INSERT/UPDATE (archiving is an UPDATE), but only
--     admins can DELETE. Child tables (skills, tags, notes…) are intentionally
--     left as-is: removing a skill row is a legitimate recruiter action.
--
-- Idempotent: every policy is dropped-if-exists before being (re)created.

-- ----------------------------------------------------------------------------
-- (A) Storage object policies — bucket id is `candidate-documents` (see 0005).
-- ----------------------------------------------------------------------------
drop policy if exists "candidate-documents: staff read" on storage.objects;
create policy "candidate-documents: staff read"
  on storage.objects for select to authenticated
  using (bucket_id = 'candidate-documents' and (select public.is_staff()));

drop policy if exists "candidate-documents: recruiters and admins upload" on storage.objects;
create policy "candidate-documents: recruiters and admins upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'candidate-documents' and (select public.has_role('recruiter', 'admin')));

drop policy if exists "candidate-documents: recruiters and admins update" on storage.objects;
create policy "candidate-documents: recruiters and admins update"
  on storage.objects for update to authenticated
  using (bucket_id = 'candidate-documents' and (select public.has_role('recruiter', 'admin')))
  with check (bucket_id = 'candidate-documents' and (select public.has_role('recruiter', 'admin')));

drop policy if exists "candidate-documents: recruiters and admins delete" on storage.objects;
create policy "candidate-documents: recruiters and admins delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'candidate-documents' and (select public.has_role('recruiter', 'admin')));

-- ----------------------------------------------------------------------------
-- (B) Candidates: split `for all` so only admins may hard-delete.
-- ----------------------------------------------------------------------------
drop policy if exists "candidates: recruiters and admins manage" on public.candidates;

create policy "candidates: recruiters and admins insert"
  on public.candidates for insert to authenticated
  with check ((select public.has_role('recruiter', 'admin')));

create policy "candidates: recruiters and admins update"
  on public.candidates for update to authenticated
  using ((select public.has_role('recruiter', 'admin')))
  with check ((select public.has_role('recruiter', 'admin')));

-- Soft-delete (setting archived_at) is an UPDATE above; hard DELETE is admin-only.
create policy "candidates: admins delete"
  on public.candidates for delete to authenticated
  using ((select public.has_role('admin')));
