/**
 * Server-only AI-assisted resume parsing.
 *
 * Extracts structured candidate data with Vertex (Gemini) when AI is enabled,
 * and falls back to the pure heuristic parser otherwise — or on any error.
 *
 * This function NEVER throws and NEVER logs candidate PII (names, emails,
 * phones, resume bodies). On failure it logs only a generic message.
 */

import { generateObject } from "ai";
import { z } from "zod";

import {
  FALLBACK_NAME,
  parseResumeText,
  type ParsedResume,
} from "@/app/matchmaker/resume-parser";

import { getVertexModel, isAIEnabled } from "./vertex";

const ResumeSchema = z.object({
  name: z
    .string()
    .describe("Full name of the candidate, or empty string if unknown"),
  yearsExp: z
    .number()
    .int()
    .min(0)
    .max(60)
    .describe("Total years of professional experience"),
  skills: z
    .array(z.object({ skill: z.string(), years: z.number().int().min(0).max(60) }))
    .max(12),
  certifications: z.array(z.string()).max(8),
  summary: z.string().max(300).describe("One-paragraph professional summary"),
});

function buildPrompt(text: string, skillDictionary: readonly string[]): string {
  const vocabulary = skillDictionary.join(", ");
  return [
    "You are a resume-parsing assistant for a recruitment agency that places",
    "candidates into heavy-industry roles (cement, mining, aggregates, steel).",
    "Extract structured data from the resume below.",
    "",
    "Rules:",
    "- Prefer the following skill vocabulary when a skill matches, normalizing",
    "  wording to these exact labels. You may also include other clearly-stated",
    "  skills that are not in the list.",
    `  Preferred skills: ${vocabulary}`,
    "- yearsExp is the candidate's total years of professional experience.",
    "- For each skill, give the years of experience with that skill (0 if not stated).",
    "- certifications are credentials/licenses explicitly named in the resume.",
    "- summary is a concise one-paragraph professional overview.",
    "- If the candidate's name is not stated, return an empty string for name.",
    "",
    "Resume:",
    text,
  ].join("\n");
}

/**
 * Parse resume text into a ParsedResume. Uses Vertex AI when enabled; falls
 * back to the heuristic parser when AI is disabled or on any error.
 */
export async function parseResumeWithAI(
  text: string,
  skillDictionary: readonly string[],
): Promise<ParsedResume> {
  if (!isAIEnabled()) {
    return parseResumeText(text, skillDictionary);
  }

  try {
    const { object } = await generateObject({
      model: getVertexModel("fast"),
      schema: ResumeSchema,
      prompt: buildPrompt(text, skillDictionary),
    });

    const name = object.name.trim() || FALLBACK_NAME;

    return {
      name,
      yearsExp: object.yearsExp,
      skills: object.skills.map((s) => ({ skill: s.skill, years: s.years })),
      certifications: object.certifications,
      summary: object.summary,
    };
  } catch {
    // Never surface candidate details or the resume body in logs.
    console.error("AI resume parse failed; using heuristic fallback");
    return parseResumeText(text, skillDictionary);
  }
}
