"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { getVertexModel, isAIEnabled } from "@/lib/ai";
import { MERGE_FIELDS } from "@/lib/merge";

const schema = z.object({
  subject: z.string().describe("Email subject line"),
  body: z.string().describe("Email body using the allowed merge-field placeholders, with a sign-off"),
});

export type DraftTemplateResult =
  | { ok: true; subject: string; body: string }
  | { ok: false; error: string };

/**
 * Draft an email template (subject + body) with Vertex/Gemini, constrained to
 * the app's merge fields. Read-only assist — the recruiter reviews/edits before
 * saving. No-ops with a clear message when AI isn't configured.
 */
export async function draftTemplateWithAI(input: {
  purpose: string;
  category: string;
}): Promise<DraftTemplateResult> {
  if (!isAIEnabled()) return { ok: false, error: "The AI assistant isn't configured yet." };

  const purpose = (input.purpose ?? "").trim();
  if (purpose.length < 3) {
    return { ok: false, error: "Name the template first — that's the prompt the AI drafts from." };
  }

  try {
    const fields = MERGE_FIELDS.map((f) => `{{${f}}}`).join(", ");
    const { object } = await generateObject({
      model: getVertexModel("fast"),
      schema,
      prompt: [
        "Write a professional recruitment email template for Jenny Mcrich Recruitment, a staffing agency",
        "placing candidates into heavy-industry roles (cement, mining, aggregates, steel), including US TN-visa roles.",
        `Category: ${input.category}. Purpose: ${purpose}.`,
        `Use ONLY these merge-field placeholders where natural, with exact double-brace syntax: ${fields}.`,
        "Personalize with {{candidate_name}} and reference {{job_title}} / {{client}} where relevant.",
        "Keep it concise, warm, and professional. End the body with a sign-off from {{recruiter_name}}, Jenny Mcrich Recruitment.",
        "Do not invent any placeholders outside the allowed list.",
      ].join(" "),
    });
    return { ok: true, subject: object.subject.trim(), body: object.body.trim() };
  } catch {
    return { ok: false, error: "Couldn't draft the template. Please try again." };
  }
}
