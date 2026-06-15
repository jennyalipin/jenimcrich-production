"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DataLayerError, TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/data/types";
import { UnknownMergeFieldError, validateTemplate } from "@/lib/merge";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  sbDeleteTemplate,
  sbImportTemplates,
  sbSaveTemplate,
} from "@/lib/data/supabase-mutations";

/** Plain template shape exchanged with the client view. */
export interface SavedTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
}

export type SaveTemplateResult =
  | { ok: true; template: SavedTemplate }
  | { ok: false; error: string };

const templateSchema = z.object({
  id: z.string().min(1).nullable(),
  name: z
    .string()
    .trim()
    .min(1, { error: "Give the template a name." })
    .max(120, { error: "Template names are limited to 120 characters." }),
  category: z.enum(TEMPLATE_CATEGORIES),
  subject: z
    .string()
    .trim()
    .min(1, { error: "Add a subject line." })
    .max(200, { error: "Subject lines are limited to 200 characters." }),
  body: z
    .string()
    .trim()
    .min(1, { error: "Add a message body." })
    .max(8000, { error: "The message body is limited to 8,000 characters." }),
});

/**
 * Validate a template at save time (docs/ARCHITECTURE.md: merge.ts "throws on
 * unknown fields in templates at save time") and persist it to
 * `email_templates`. Without a Supabase client (local demo data layer) the
 * validated record is returned for the client view to keep in session state.
 */
export async function saveTemplateAction(input: unknown): Promise<SaveTemplateResult> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Please complete the template before saving.",
    };
  }

  try {
    // Subject and body are validated separately so the error names the
    // offending {{field}} wherever it appears.
    validateTemplate(parsed.data.subject);
    validateTemplate(parsed.data.body);
  } catch (error) {
    if (error instanceof UnknownMergeFieldError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "The template could not be validated. Please try again." };
  }

  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      // Session-only ids (tpl-…) come from the demo layer and never reach the DB.
      const id = parsed.data.id?.startsWith("tpl-") ? null : parsed.data.id;
      const saved = await sbSaveTemplate(supabase, { ...parsed.data, id });
      revalidatePath("/templates");
      return {
        ok: true,
        template: {
          id: saved.id,
          name: parsed.data.name,
          category: parsed.data.category,
          subject: parsed.data.subject,
          body: parsed.data.body,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof DataLayerError
            ? error.message
            : "The template could not be saved. Please try again.",
      };
    }
  }

  return {
    ok: true,
    template: {
      id: parsed.data.id ?? `tpl-${randomUUID()}`,
      name: parsed.data.name,
      category: parsed.data.category,
      subject: parsed.data.subject,
      body: parsed.data.body,
    },
  };
}

/** Soft-delete a template from the library. */
export async function deleteTemplateAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getSupabaseServerClient();
  // Session-only (demo) ids were never persisted — nothing to delete server-side.
  if (!supabase || id.startsWith("tpl-")) return { ok: true };
  try {
    await sbDeleteTemplate(supabase, id);
    revalidatePath("/templates");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DataLayerError
          ? error.message
          : "The template could not be deleted. Please try again.",
    };
  }
}

const importRowSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Each template needs a name." })
    .max(120),
  category: z.enum(TEMPLATE_CATEGORIES),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
});

export interface ImportTemplatesResult {
  imported: number;
  skipped: number;
  errors: number;
}

/**
 * Bulk-import templates (e.g. pasted from Gmail). Existing names are skipped so
 * re-importing the same set is safe. Pasted email text is freeform — merge
 * fields aren't required, and any literal {{…}} surfaces when the template is
 * opened in the editor.
 */
export async function importTemplatesAction(rows: unknown): Promise<ImportTemplatesResult> {
  const parsed = z.array(importRowSchema).min(1).max(500).safeParse(rows);
  if (!parsed.success) return { imported: 0, skipped: 0, errors: 1 };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { imported: 0, skipped: 0, errors: parsed.data.length };

  try {
    const res = await sbImportTemplates(supabase, parsed.data);
    revalidatePath("/templates");
    return { ...res, errors: 0 };
  } catch {
    return { imported: 0, skipped: 0, errors: parsed.data.length };
  }
}
