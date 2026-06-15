"use server";

import { z } from "zod";
import { parseResumeWithAI } from "@/lib/ai";
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
