"use server";

/**
 * Document storage actions — résumés/offers/certs to a PRIVATE Supabase
 * Storage bucket with signed-URL downloads (CLAUDE.md gotcha).
 *
 * The file bytes go through the service-role admin client (Storage), but only
 * after the RLS-scoped user client confirms the caller is signed in and can
 * see the candidate / document. The bucket is never public; downloads are
 * short-lived signed URLs.
 */

import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { currentProfileId } from "@/lib/data/supabase-mutations";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/data/types";

const BUCKET = "candidate-documents";
const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadResult {
  ok: boolean;
  error?: string;
}

function isCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const candidateId = String(formData.get("candidate_id") ?? "").trim();
  const category = String(formData.get("category") ?? "resume");
  const file = formData.get("file");

  if (!candidateId) return { ok: false, error: "Missing candidate." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (file.size > MAX_BYTES) return { ok: false, error: "That file is larger than 10 MB." };
  if (!isCategory(category)) return { ok: false, error: "Pick a document type." };

  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Storage is not configured." };

  // Caller must be signed in and able to see the candidate (RLS).
  const { data: candidate } = await supabase
    .from("candidates")
    .select("id")
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidate) return { ok: false, error: "That candidate could not be found." };

  const profileId = await currentProfileId(supabase);
  const safeName = (file.name.replace(/[^\w.\- ]+/g, "_").trim().slice(0, 120) || "file");
  const path = `${candidateId}/${crypto.randomUUID()}-${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upErr) return { ok: false, error: "Upload failed. Please try again." };

  const { error: dbErr } = await supabase.from("documents").insert({
    candidate_id: candidateId,
    storage_path: path,
    file_name: file.name.slice(0, 200),
    category,
    uploaded_by: profileId,
  });
  if (dbErr) {
    // Don't leave an orphaned object if the row insert is rejected.
    await admin.storage.from(BUCKET).remove([path]);
    return { ok: false, error: "Could not save the document. Please try again." };
  }

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}

export async function getDocumentSignedUrl(
  documentId: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseAdminClient();
  if (!supabase || !admin) return { error: "Storage is not configured." };

  // RLS decides whether this user may see the document.
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, file_name")
    .eq("id", documentId)
    .is("archived_at", null)
    .maybeSingle();
  if (!doc) return { error: "That document could not be found." };

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (error || !data) return { error: "Could not generate a download link." };
  return { url: data.signedUrl };
}
