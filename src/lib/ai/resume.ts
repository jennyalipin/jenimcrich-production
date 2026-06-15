/**
 * Server-only AI-assisted resume parsing.
 *
 * Extracts structured candidate data with Vertex (Gemini) when AI is enabled,
 * and falls back to the pure heuristic parser otherwise — or on any error.
 * Supports both pasted resume text and uploaded resume files (PDF/Word/image)
 * via the multimodal file content part.
 *
 * These functions NEVER throw and NEVER log candidate PII (names, emails,
 * phones, resume bodies, file bytes or URLs). On failure they log only a
 * generic message.
 */

import { generateObject } from "ai";
import { z } from "zod";

import {
  FALLBACK_NAME,
  parseResumeText,
  type ParsedResume,
} from "@/app/matchmaker/resume-parser";
import { detectVisa } from "@/lib/jd-parser";

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
  workAuthHint: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Any explicit work-authorization or visa statement, quoted verbatim " +
        "from the resume (e.g. 'TN visa eligible (Canadian citizen)'). " +
        "Empty/omit when the resume says nothing about work authorization.",
    ),
});

const INSTRUCTIONS = [
  "You are a resume-parsing assistant for a recruitment agency that places",
  "candidates into heavy-industry roles (cement, mining, aggregates, steel).",
  "Extract structured data from the resume.",
  "",
  "Rules:",
  "- Prefer the following skill vocabulary when a skill matches, normalizing",
  "  wording to these exact labels. You may also include other clearly-stated",
  "  skills that are not in the list.",
];

const TRAILING_RULES = [
  "- yearsExp is the candidate's total years of professional experience.",
  "- For each skill, give the years of experience with that skill (0 if not stated).",
  "- certifications are credentials/licenses explicitly named in the resume.",
  "- summary is a concise one-paragraph professional overview.",
  "- workAuthHint: copy any explicit work-authorization / visa statement",
  "  verbatim; omit it if the resume says nothing about work authorization.",
  "- If the candidate's name is not stated, return an empty string for name.",
];

function vocabularyLine(skillDictionary: readonly string[]): string {
  return `  Preferred skills: ${skillDictionary.join(", ")}`;
}

function buildPrompt(text: string, skillDictionary: readonly string[]): string {
  return [
    ...INSTRUCTIONS,
    vocabularyLine(skillDictionary),
    ...TRAILING_RULES,
    "",
    "Resume:",
    text,
  ].join("\n");
}

/** Instruction block for the multimodal (file) path — the file is attached separately. */
function buildFileInstructions(skillDictionary: readonly string[]): string {
  return [
    ...INSTRUCTIONS,
    vocabularyLine(skillDictionary),
    ...TRAILING_RULES,
    "",
    "The resume is attached as a file. Read it and extract the fields.",
  ].join("\n");
}

/**
 * Map a validated model object to a ParsedResume, deriving `visaHint` from any
 * explicit work-authorization statement (falling back to the summary text).
 */
function toParsedResume(object: z.infer<typeof ResumeSchema>): ParsedResume {
  const name = object.name.trim() || FALLBACK_NAME;
  const visa = detectVisa(object.workAuthHint ?? object.summary ?? "");

  return {
    name,
    yearsExp: object.yearsExp,
    skills: object.skills.map((s) => ({ skill: s.skill, years: s.years })),
    certifications: object.certifications,
    summary: object.summary,
    // Only surface a hint when the parser actually inferred a requirement;
    // "UNSPECIFIED" carries no signal, so leave it undefined.
    visaHint: visa === "UNSPECIFIED" ? undefined : visa,
  };
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

    return toParsedResume(object);
  } catch {
    // Never surface candidate details or the resume body in logs.
    console.error("AI resume parse failed; using heuristic fallback");
    return parseResumeText(text, skillDictionary);
  }
}

/**
 * Parse an uploaded resume file (PDF / Word / image) into a ParsedResume by
 * sending the raw bytes to Vertex as a multimodal file content part.
 *
 * When AI is disabled there is no text to fall back on (the bytes are an
 * unparsed binary), so this returns an empty heuristic result — the caller
 * decides what to surface. NEVER throws; NEVER logs bytes, URLs or PII.
 */
export async function parseResumeFromFile(
  bytes: Uint8Array,
  mimeType: string,
  skillDictionary: readonly string[],
): Promise<ParsedResume> {
  if (!isAIEnabled()) {
    // No extracted text available on the offline path — return an empty,
    // valid ParsedResume rather than guessing from binary.
    return parseResumeText("", skillDictionary);
  }

  try {
    const { object } = await generateObject({
      model: getVertexModel("fast"),
      schema: ResumeSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildFileInstructions(skillDictionary) },
            { type: "file", data: bytes, mediaType: mimeType },
          ],
        },
      ],
    });

    return toParsedResume(object);
  } catch {
    // Generic message only — no bytes, no file name, no candidate details.
    console.error("AI resume file parse failed; returning empty result");
    return parseResumeText("", skillDictionary);
  }
}
