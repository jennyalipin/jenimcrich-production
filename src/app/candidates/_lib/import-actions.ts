"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sbImportCandidate } from "@/lib/data/supabase-mutations";
import { SOURCES, type Source } from "@/lib/data";

const rowSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  location: z.string().trim().default(""),
  source: z.string().trim().default(""),
  yearsExp: z.coerce.number().int().min(0).max(70).catch(0),
  summary: z.string().trim().default(""),
  skills: z
    .array(z.object({ skill: z.string().trim().min(1), years: z.coerce.number().int().min(0).max(70).catch(0) }))
    .default([]),
  certifications: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
});

const importSchema = z.array(rowSchema).min(1).max(5000);

function normSource(s: string): Source {
  const t = s.trim().toLowerCase();
  return SOURCES.find((src) => src.toLowerCase() === t) ?? "Agency";
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  total: number;
}

/**
 * Bulk-import candidates parsed from a CSV (no contact PII logged). Existing
 * emails are skipped, so re-importing the same file is safe.
 */
export async function importCandidates(rows: unknown): Promise<ImportResult> {
  const parsed = importSchema.safeParse(rows);
  if (!parsed.success) return { imported: 0, skipped: 0, errors: 1, total: 0 };

  const total = parsed.data.length;
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { imported: 0, skipped: 0, errors: total, total };

  let imported = 0;
  let skipped = 0;
  let errors = 0;
  for (const r of parsed.data) {
    try {
      const res = await sbImportCandidate(supabase, {
        full_name: r.name,
        email: r.email,
        phone: r.phone,
        location: r.location,
        source: normSource(r.source),
        years_exp: r.yearsExp,
        summary: r.summary,
        skills: r.skills,
        certifications: [...new Set(r.certifications)],
        tags: [...new Set(r.tags)],
      });
      if (res.duplicateEmail) skipped++;
      else imported++;
    } catch {
      errors++;
    }
  }

  revalidatePath("/candidates");
  return { imported, skipped, errors, total };
}
