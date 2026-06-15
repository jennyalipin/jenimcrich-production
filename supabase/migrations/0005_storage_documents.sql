-- ============================================================================
-- 0005_storage_documents.sql — private bucket for candidate documents
--
-- Résumés / certs / offer letters live here. The bucket is PRIVATE; the app
-- uploads/reads via the service-role client in server actions (gated by the
-- user's RLS-scoped session) and serves short-lived signed URLs. No public
-- access; documents.storage_path points at objects in this bucket.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-documents', 'candidate-documents', false, 10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png', 'image/jpeg', 'text/plain'
  ]
)
on conflict (id) do nothing;
