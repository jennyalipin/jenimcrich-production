/**
 * Lightweight heuristic resume-text parser for the Matchmaker's paste box.
 *
 * Turns free resume text into the `ScoreCandidateInput` shape so pasted
 * resumes can be ranked with the same `matchScore()` engine as stored
 * candidates. Heuristics only (no LLM yet — that is the Phase 2 plan in
 * docs/ARCHITECTURE.md): skills come from a dictionary scan, years from
 * "N years" patterns, certifications from a section + known-cert scan.
 *
 * Pure module — no I/O, safe in client components. Never throws.
 */

import type { CandidateSkill } from "@/lib/data/types";

export interface ParsedResume {
  name: string;
  yearsExp: number;
  skills: CandidateSkill[];
  certifications: string[];
  summary: string;
}

export const FALLBACK_NAME = "Pasted candidate";

const MAX_SKILLS = 12;
const MAX_CERTS = 6;

/** "12 years", "12+ yrs", "12 yr" → captures the number. */
const ANY_YEARS = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/i;

/** "14 years of (professional) experience" — the strongest total-years signal. */
const TOTAL_EXPERIENCE =
  /(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:['’])?(?:\s+of)?\s+(?:professional\s+|industry\s+|relevant\s+|hands-on\s+|work(?:ing)?\s+)?experience/i;

/** Heavy-industry certifications commonly seen in this agency's resumes. */
const KNOWN_CERTS =
  /\b(ISO\s?\d{4,5}(?:\s?Lead Auditor)?|Six Sigma(?:\s+(?:Black|Green|Yellow)\s+Belt)?|Lean Six Sigma|CMRP|CRL|PMP|PE License|NEBOSH(?:\s+IGC)?|OSHA(?:\s?\d{2})?|MSHA|First Aid|Licensed Blaster(?:\s?\([^)\n]{0,30}\))?)\b/gi;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch);
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Case-insensitive whole-word search; returns the match index or -1. */
function findSkill(haystackLower: string, skillLower: string): number {
  let from = 0;
  while (from <= haystackLower.length - skillLower.length) {
    const idx = haystackLower.indexOf(skillLower, from);
    if (idx === -1) return -1;
    const before = haystackLower[idx - 1];
    const after = haystackLower[idx + skillLower.length];
    if (!isWordChar(before) && !isWordChar(after)) return idx;
    from = idx + 1;
  }
  return -1;
}

export function parseResumeText(
  text: string,
  skillDictionary: readonly string[],
): ParsedResume {
  const clean = text.replace(/\r\n?/g, "\n").trim();
  const lines = clean.split("\n").map((l) => l.trim());
  const lower = clean.toLowerCase();

  /* ---------------- name ---------------- */
  let name = FALLBACK_NAME;
  const explicitName = lines.find((l) => /^name\s*[:\-]/i.test(l));
  if (explicitName) {
    const value = normalizeSpaces(explicitName.replace(/^name\s*[:\-]\s*/i, ""));
    if (value) name = value;
  } else {
    // First few lines: 2–4 capitalized words, no digits or emails.
    const headerLine = lines
      .slice(0, 5)
      .find(
        (l) =>
          /^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3}$/.test(l) && !/[\d@]/.test(l),
      );
    if (headerLine) name = headerLine;
  }

  /* ---------------- total years ---------------- */
  let yearsExp = 0;
  const totalMatch = clean.match(TOTAL_EXPERIENCE);
  if (totalMatch) yearsExp = Number(totalMatch[1]);

  /* ---------------- skills ---------------- */
  const skills: CandidateSkill[] = [];
  const seenSkills = new Set<string>();
  for (const skill of skillDictionary) {
    if (skills.length >= MAX_SKILLS) break;
    const key = skill.toLowerCase();
    if (seenSkills.has(key)) continue;
    const idx = findSkill(lower, key);
    if (idx === -1) continue;
    seenSkills.add(key);
    // Per-skill tenure: a "N yrs" mention within ~40 chars after the skill,
    // e.g. "Kiln Management (11 years)" or "Kiln Management – 11 yrs".
    const windowText = clean.slice(idx + skill.length, idx + skill.length + 40);
    const near = windowText.match(ANY_YEARS);
    skills.push({ skill, years: near ? Number(near[1]) : 0 });
  }

  // Fall back for total years: strongest per-skill tenure, then any mention.
  if (yearsExp === 0) yearsExp = skills.reduce((max, s) => Math.max(max, s.years), 0);
  if (yearsExp === 0) {
    const any = clean.match(ANY_YEARS);
    if (any) yearsExp = Number(any[1]);
  }

  // Skills without an explicit tenure: assume roughly half the candidate's
  // total experience (conservative; keeps presence worth the 50% base).
  const assumedYears = Math.max(1, Math.round(yearsExp / 2));
  for (const s of skills) {
    if (s.years === 0) s.years = assumedYears;
  }

  /* ---------------- certifications ---------------- */
  const certs: string[] = [];
  const seenCerts = new Set<string>();
  const addCert = (raw: string) => {
    const value = normalizeSpaces(raw.replace(/^[-–—*•·\s]+/, ""));
    const key = value.toLowerCase();
    if (value.length < 3 || value.length > 60 || seenCerts.has(key)) return;
    if (certs.length >= MAX_CERTS) return;
    seenCerts.add(key);
    certs.push(value);
  };

  const certHeaderIdx = lines.findIndex((l) => /^certifications?\b\s*[:\-]?\s*/i.test(l));
  if (certHeaderIdx !== -1) {
    const inline = lines[certHeaderIdx].replace(/^certifications?\b\s*[:\-]?\s*/i, "");
    const collected: string[] = inline ? [inline] : [];
    for (let i = certHeaderIdx + 1; i < lines.length && collected.length < 8; i++) {
      const line = lines[i];
      if (!line) break; // blank line ends the section
      if (/^[A-Za-z ]{2,30}:$/.test(line)) break; // next section header
      collected.push(line);
    }
    for (const chunk of collected) {
      for (const part of chunk.split(/[;,•·]|\s[–—]\s/)) addCert(part);
    }
  }
  for (const match of clean.matchAll(KNOWN_CERTS)) addCert(match[1] ?? match[0]);

  /* ---------------- summary ---------------- */
  let summary = "";
  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => normalizeSpaces(p))
    .filter(Boolean);
  summary =
    paragraphs.find((p) => p.length >= 40 && !p.startsWith(name)) ?? paragraphs[0] ?? "";
  if (summary.length > 240) summary = `${summary.slice(0, 239).trimEnd()}…`;

  return { name, yearsExp, skills, certifications: certs, summary };
}
