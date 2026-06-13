/**
 * "Explain this score" breakdown for the Matchmaker.
 *
 * Mirrors `matchScore()` in src/lib/scoring.ts line-for-line (domain rule 2)
 * so the expandable explanation always reconciles with the headline number:
 *   - per JD skill (weight w): possible w×10; earned w×10×(0.5 + 0.5×ratio)
 *     where ratio = min(candYears / max(minYears×0.6, 1), 1)
 *   - experience: possible 20; earned 20×min(yearsExp / minYears, 1)
 *     (minYears 0 ⇒ full points, matching the scoring guard)
 *   - certifications: possible 6 (always in the denominator);
 *     earned min(count×2, 6) only when the candidate has any
 *   - score = round(earned / possible × 100)
 *
 * Pure module — safe in client components.
 */

import type { ScoreCandidateInput, ScoreJobInput } from "@/lib/types";

export interface ExplainRow {
  label: string;
  detail: string;
  earned: number;
  possible: number;
}

export interface ScoreExplanation {
  rows: ExplainRow[];
  earned: number;
  possible: number;
  /** Same integer `matchScore()` returns. */
  score: number;
}

export function explainScore(
  candidate: ScoreCandidateInput,
  job: ScoreJobInput,
): ScoreExplanation {
  const rows: ExplainRow[] = [];
  let earned = 0;
  let possible = 0;

  // --- Weighted skill overlap -------------------------------------------
  const benchmark = Math.max(job.minYears * 0.6, 1);
  for (const { skill, weight } of job.skills) {
    const skillPossible = weight * 10;
    possible += skillPossible;
    const candidateSkill = candidate.skills.find(
      (s) => s.skill.toLowerCase() === skill.toLowerCase(),
    );
    if (candidateSkill) {
      const ratio = Math.min(candidateSkill.years / benchmark, 1);
      const skillEarned = skillPossible * (0.5 + 0.5 * ratio);
      earned += skillEarned;
      rows.push({
        label: `${skill} (w${weight})`,
        detail: `${candidateSkill.years} yrs vs ~${round1(benchmark)} yr benchmark — 50% for having it + 50% × tenure`,
        earned: skillEarned,
        possible: skillPossible,
      });
    } else {
      rows.push({
        label: `${skill} (w${weight})`,
        detail: "Not found on the resume — skill gap",
        earned: 0,
        possible: skillPossible,
      });
    }
  }

  // --- Total-experience component (20 pts) -------------------------------
  possible += 20;
  const expRatio =
    job.minYears > 0 ? candidate.yearsExp / job.minYears : Number.POSITIVE_INFINITY;
  const expEarned = 20 * Math.min(expRatio, 1);
  earned += expEarned;
  rows.push({
    label: "Total experience",
    detail:
      job.minYears > 0
        ? `${candidate.yearsExp} yrs vs ${job.minYears} required`
        : `${candidate.yearsExp} yrs — no minimum on this JD`,
    earned: expEarned,
    possible: 20,
  });

  // --- Certification bonus (≤6 pts; denominator always grows by 6) -------
  possible += 6;
  const certCount = candidate.certifications.length;
  const certEarned = certCount > 0 ? Math.min(certCount * 2, 6) : 0;
  earned += certEarned;
  rows.push({
    label: "Certifications",
    detail:
      certCount > 0
        ? `${certCount} certification${certCount === 1 ? "" : "s"} × 2 pts (capped at 6)`
        : "None listed",
    earned: certEarned,
    possible: 6,
  });

  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  return { rows, earned, possible, score };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
