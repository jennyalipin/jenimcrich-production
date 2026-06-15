"use server";

import { z } from "zod";
import { parseResumeFromFile, parseResumeWithAI } from "@/lib/ai";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getDocumentSignedUrl } from "@/app/candidates/_lib/documents-actions";
import { DEFAULT_SKILL_DICTIONARY } from "@/lib/jd-parser";
import { parseResumeText, type ParsedResume } from "./resume-parser";

const schema = z.object({
  text: z.string().trim().min(40).max(20000),
  skillDictionary: z.array(z.string()).max(2000),
});

export async function analyzeResumeAction(input: unknown): Promise<ParsedResume> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    // Caller already validated length client-side; on bad input fall back safely.
    const text =
      typeof (input as { text?: unknown })?.text === "string"
        ? (input as { text: string }).text
        : "";
    return parseResumeText(text, []);
  }
  return parseResumeWithAI(parsed.data.text, parsed.data.skillDictionary);
}

/** Cap on the resume bytes we'll pull back for parsing (matches upload limit). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface ParseResumeFileResult {
  ok: boolean;
  error?: string;
  parsed?: ParsedResume;
}

/**
 * Parse an already-uploaded resume document with AI: resolve a short-lived
 * signed URL (RLS-checked), fetch the bytes server-side and run them through
 * the multimodal parser. Verifies the caller is signed in first. Logs nothing
 * sensitive (no URLs, bytes, names, emails or phones).
 */
export async function parseResumeFileAction(
  candidateId: string,
  documentId: string,
): Promise<ParseResumeFileResult> {
  if (!candidateId || !documentId) {
    return { ok: false, error: "Missing candidate or document." };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "AI parsing is not configured." };

  // Must be a signed-in user before we touch storage or call out to the model.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in to use AI parsing." };

  // getDocumentSignedUrl re-checks RLS visibility of the document.
  const signed = await getDocumentSignedUrl(documentId);
  if (!signed.url) {
    return { ok: false, error: signed.error ?? "That document could not be found." };
  }

  let bytes: Uint8Array;
  let mimeType: string;
  try {
    const res = await fetch(signed.url);
    if (!res.ok) return { ok: false, error: "Could not read that document." };
    mimeType = res.headers.get("content-type") ?? "application/pdf";
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_FILE_BYTES) {
      return { ok: false, error: "Could not read that document." };
    }
    bytes = new Uint8Array(buf);
  } catch {
    // No URL/bytes in the log — just a generic failure.
    console.error("Resume file fetch failed");
    return { ok: false, error: "Could not read that document." };
  }

  const parsed = await parseResumeFromFile(bytes, mimeType, DEFAULT_SKILL_DICTIONARY);
  return { ok: true, parsed };
}
