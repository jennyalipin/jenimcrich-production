/**
 * JD text parser — port of `parseJD()` from
 * `prototype/JeniMcRich-Recruitment-App.html`.
 *
 * Pure regex/heuristic extraction of structured job fields from pasted
 * job-description text. Phase 2 adds LLM-structured extraction behind this
 * same interface (see docs/ARCHITECTURE.md).
 *
 * Unlike the prototype (which wrote straight into form inputs), this returns
 * a `ParsedJD`; the new-job form decides which blanks to fill.
 */

import type { JobSkill, SkillWeight, VisaRequirement } from "./types";

/** Structured fields extracted from raw JD text. Empty string / null / [] when not found. */
export interface ParsedJD {
  title: string;
  client: string;
  location: string;
  salary: string;
  /** Minimum years of experience; null when the JD doesn't state one. */
  minYears: number | null;
  /** Requirement bullet lines (bullet markers stripped), max 8. */
  requirements: string[];
  /** Detected skills with frequency-based weights, max 8. */
  skills: JobSkill[];
  visa: VisaRequirement;
  /** First line mentioning visa/sponsorship/work auth, trimmed to 120 chars. */
  visaNotes: string;
  /** First substantial paragraph, trimmed to 300 chars. */
  description: string;
}

/**
 * Known heavy-industry skills (union of every skill in the prototype's seed
 * jobs + candidates). Callers should pass a live dictionary built from their
 * own jobs/candidates and fall back to this for cold starts.
 */
export const DEFAULT_SKILL_DICTIONARY: readonly string[] = [
  "Plant Operations",
  "Kiln Management",
  "Safety Compliance",
  "Team Leadership",
  "Budgeting",
  "Quarry Operations",
  "Blasting",
  "Heavy Equipment",
  "Production Planning",
  "Reliability Engineering",
  "Predictive Maintenance",
  "SAP PM",
  "Root Cause Analysis",
  "Vibration Analysis",
  "HSE Management",
  "Incident Investigation",
  "Training",
  "Audit",
  "Electrical Systems",
  "PLC Programming",
  "Motor Control",
  "Power Distribution",
  "Logistics",
  "Dispatch",
  "ERP Systems",
  "Vendor Management",
  "Excel",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect the work-authorization requirement mentioned in JD text.
 * Returns "UNSPECIFIED" when nothing matches. Order of precedence (from the
 * prototype): TN → US citizens/green card → H-1B → sponsorship/international.
 */
export function detectVisa(text: string): VisaRequirement {
  const lo = text.toLowerCase();
  if (/tn\s*(visa|status)/.test(lo)) {
    const canadiansOnly =
      /canadian(s)?\s*(citizens?\s*)?only/.test(lo) ||
      (/canadian/.test(lo) && !/mexican/.test(lo));
    return canadiansOnly ? "TN_CANADIAN_ONLY" : "TN_CANADIAN_OR_MEXICAN";
  }
  if (/green\s*card|us\s*citizens?\s*only|must\s*be\s*authorized\s*to\s*work\s*in\s*the\s*(us|u\.s)/.test(lo)) {
    return "US_CITIZEN_GC_ONLY";
  }
  if (/h-?1b/.test(lo)) return "H1B_TRANSFER";
  if (/sponsorship\s*(is\s*)?available|open\s*to\s*international/.test(lo)) {
    return "SPONSORSHIP_AVAILABLE";
  }
  return "UNSPECIFIED";
}

/**
 * Parse raw JD text into structured job fields. Pure; never throws.
 *
 * @param text            Raw job-description text (pasted or extracted).
 * @param skillDictionary Known skill names to match against (frequency
 *                        weighting: mentioned ≥2× → weight 3, once → 2;
 *                        capitalized multi-word phrases found only in the
 *                        requirement bullets → weight 1).
 */
export function parseJD(
  text: string,
  skillDictionary: readonly string[] = DEFAULT_SKILL_DICTIONARY,
): ParsedJD {
  const lines = text.split("\n").map((l) => l.trim());

  const grab = (re: RegExp): string => {
    const m = text.match(re);
    const captured = m?.[1];
    return captured ? captured.trim().replace(/[.;,]+$/, "") : "";
  };

  // --- Title: labeled line, else first short non-empty line ---------------
  let title = grab(/(?:job\s*title|position|role)\s*[:\-–]\s*(.+)/i);
  if (!title) {
    title = lines.find((l) => l && l.length < 70) ?? "";
  }

  // --- Client / location / salary -----------------------------------------
  const client = grab(/(?:company|client|employer)\s*[:\-–]\s*(.+)/i);
  const location = grab(/(?:location|site|based in|work\s*site)\s*[:\-–]\s*(.+)/i);
  const salary =
    grab(/(?:salary|compensation|pay|rate)\s*(?:range)?\s*[:\-–]\s*(.+)/i) ||
    grab(
      /([$₱€£]\s?[\d,.]+\s*[kK]?(?:\s*[-–—to]+\s*[$₱€£]?\s?[\d,.]+\s*[kK]?)?(?:\s*(?:\/|per\s*)(?:yr|year|annum|mo|month|hr|hour))?)/,
    );

  // --- Minimum years --------------------------------------------------------
  const yearsMatch = text.match(/(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i);
  const minYears = yearsMatch?.[1] ? parseInt(yearsMatch[1], 10) : null;

  // --- Visa / work authorization -------------------------------------------
  const visa = detectVisa(text);
  const visaLine = lines.find((l) => /visa|sponsor|work\s*auth|citizen/i.test(l));
  const visaNotes = visaLine ? visaLine.replace(/^[-•*]\s*/, "").slice(0, 120) : "";

  // --- Requirement bullets ---------------------------------------------------
  const requirements = lines
    .filter((l) => /^[-•*▪◦]\s+/.test(l))
    .map((l) => l.replace(/^[-•*▪◦]\s+/, ""))
    .slice(0, 8);

  // --- Skills: dictionary matches with frequency weighting -------------------
  const found: Array<{ skill: string; weight: SkillWeight }> = [];
  for (const dictSkill of skillDictionary) {
    const re = new RegExp(escapeRegExp(dictSkill), "gi");
    const count = (text.match(re) ?? []).length;
    if (count > 0) found.push({ skill: dictSkill, weight: count >= 2 ? 3 : 2 });
  }
  // Also catch Capitalized Multi-Word phrases in the requirement bullets.
  const phraseSource = requirements.join(" ");
  for (const m of phraseSource.matchAll(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/g)) {
    const phrase = m[1];
    if (
      phrase &&
      phrase.split(" ").length > 1 &&
      !found.some((f) => f.skill.toLowerCase() === phrase.toLowerCase())
    ) {
      found.push({ skill: phrase, weight: 1 });
    }
  }
  const skills: JobSkill[] = found.slice(0, 8);

  // --- Description: first substantial paragraph ------------------------------
  const paragraph = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 60 && !/^[-•*]/.test(p));
  const description = (paragraph ?? "").slice(0, 300);

  return {
    title,
    client,
    location,
    salary,
    minYears,
    requirements,
    skills,
    visa,
    visaNotes,
    description,
  };
}
