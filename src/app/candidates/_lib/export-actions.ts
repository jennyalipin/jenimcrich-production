"use server";

import {
  STAGE_LABELS,
  getCandidates,
  toScoreCandidate,
  toScoreJob,
  type CandidateFilters,
  type CandidateWithApplications,
} from "@/lib/data";
import { matchScore } from "@/lib/scoring";

const COLUMNS = [
  "Name",
  "Email",
  "Phone",
  "Years experience",
  "Location",
  "Source",
  "Flagged",
  "Top skills",
  "Certifications",
  "Tags",
  "Stages",
  "Best match score",
] as const;

/**
 * Escape a single CSV field: wrap in double quotes and double any internal
 * quotes. Always quoting keeps commas, newlines and quotes safe in every cell.
 */
function csvEscape(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** Best match score across the candidate's applied jobs, or empty if none. */
function bestMatchScore(c: CandidateWithApplications): string {
  if (c.applications.length === 0) return "";
  const scoreInput = toScoreCandidate(c);
  const best = c.applications.reduce((top, app) => {
    const s = matchScore(scoreInput, toScoreJob(app.job)).score;
    return s > top ? s : top;
  }, Number.NEGATIVE_INFINITY);
  return best === Number.NEGATIVE_INFINITY ? "" : String(best);
}

function row(c: CandidateWithApplications): string {
  const topSkills = [...c.skills]
    .sort((a, b) => b.years - a.years)
    .slice(0, 5)
    .map((s) => `${s.skill} (${s.years}y)`)
    .join("; ");
  const stages = [...new Set(c.applications.map((a) => STAGE_LABELS[a.stage]))].join("; ");

  return [
    c.full_name,
    c.email,
    c.phone,
    c.years_exp,
    c.location,
    c.source,
    c.flagged ? "Yes" : "No",
    topSkills,
    c.certifications.join("; "),
    c.tags.join("; "),
    stages,
    bestMatchScore(c),
  ]
    .map(csvEscape)
    .join(",");
}

/**
 * Build a CSV string of the (optionally filtered) candidate list for
 * reporting/sharing. Never logs candidate data.
 */
export async function exportCandidatesCsv(filters?: CandidateFilters): Promise<string> {
  const candidates = await getCandidates(filters);
  const header = COLUMNS.map(csvEscape).join(",");
  const body = candidates.map(row).join("\r\n");
  return body ? `${header}\r\n${body}\r\n` : `${header}\r\n`;
}
