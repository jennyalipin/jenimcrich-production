"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/data/types";
import { UnknownMergeFieldError, validateTemplate } from "@/lib/merge";

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
 * unknown fields in templates at save time"). The demo data layer has no
 * template mutations yet, so the validated record is returned for the client
 * view to keep in session state; once Supabase lands this action writes to
 * `email_templates` instead.
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
