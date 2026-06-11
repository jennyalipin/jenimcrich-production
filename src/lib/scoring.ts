/**
 * Match-scoring engine — exact port of `matchScore()` from
 * `prototype/JeniMcRich-Recruitment-App.html` (domain rule 2).
 *
 * Pure functions only: no I/O, no framework imports. Keep unit-tested.
 *
 * Algorithm (per JD skill of weight w ∈ 1..3):
 *   - possible points: w × 10
 *   - candidate has the skill (case-insensitive name match):
 *       ratio = min(candYears / max(minYears × 0.6, 1), 1)
 *       earned = w × 10 × (0.5 + 0.5 × ratio)
 *   - experience component: 20 possible, earned = 20 × min(yearsExp / minYears, 1)
 *   - certification bonus: 6 possible (always added to the denominator),
 *     earned = min(certCount × 2, 6) only when the candidate has any
 *   - score = round(earned / possible × 100), i.e. normalized 0–100
 */

import {
  SCORE_THRESHOLDS,
  type MatchResult,
  type ScoreBand,
  type ScoreCandidateInput,
  type ScoreJobInput,
} from "./types";

/**
 * Score one candidate against one job. Pure; never throws on valid shapes.
 *
 * Emits the same human-readable `pros`/`cons`/`gaps`/`edge` strings as the
 * prototype so the Matchmaker UI can render them verbatim.
 */
export function matchScore(candidate: ScoreCandidateInput, job: ScoreJobInput): MatchResult {
  let total = 0;
  let got = 0;
  const pros: string[] = [];
  const cons: string[] = [];
  const gaps: string[] = [];

  // --- Weighted skill overlap -------------------------------------------
  for (const { skill, weight } of job.skills) {
    total += weight * 10;
    const candidateSkill = candidate.skills.find(
      (s) => s.skill.toLowerCase() === skill.toLowerCase(),
    );
    if (candidateSkill) {
      const ratio = Math.min(candidateSkill.years / Math.max(job.minYears * 0.6, 1), 1);
      got += weight * 10 * (0.5 + 0.5 * ratio);
      pros.push(
        `${skill}: ${candidateSkill.years} yrs experience${ratio >= 1 ? " (exceeds requirement)" : ""}`,
      );
    } else {
      cons.push(`No demonstrated ${skill} experience`);
      gaps.push(skill);
    }
  }

  // --- Total-experience component (20 pts) -------------------------------
  total += 20;
  // Guard: the prototype divides by minYears directly; when minYears is 0
  // any experience trivially satisfies the requirement, so award full points
  // instead of producing NaN for the 0/0 case.
  const expRatio =
    job.minYears > 0 ? candidate.yearsExp / job.minYears : Number.POSITIVE_INFINITY;
  got += 20 * Math.min(expRatio, 1);
  if (candidate.yearsExp >= job.minYears) {
    pros.push(`${candidate.yearsExp} yrs total experience vs ${job.minYears} required`);
  } else {
    cons.push(`Only ${candidate.yearsExp} yrs total experience (${job.minYears} required)`);
  }

  // --- Certification bonus (≤6 pts; denominator always grows by 6) -------
  if (candidate.certifications.length > 0) {
    got += Math.min(candidate.certifications.length * 2, 6);
    total += 6;
    pros.push("Certifications: " + candidate.certifications.join(", "));
  } else {
    total += 6;
  }

  const score = Math.round((got / total) * 100);

  // --- "The Edge" one-liner ----------------------------------------------
  const topSkill = [...candidate.skills].sort((a, b) => b.years - a.years)[0];
  const firstName = candidate.name.split(" ")[0] ?? candidate.name;
  const firstCert = candidate.certifications[0];
  const edge = topSkill
    ? `${firstName}'s strongest edge: ${topSkill.years} years of ${topSkill.skill}` +
      `${firstCert ? ", backed by " + firstCert : ""}.`
    : "";

  return { score, pros, cons, gaps, edge };
}

/**
 * Score color band (domain rule 2): green ≥80 → "high", amber 60–79 → "mid",
 * red <60 → "low".
 */
export function scoreBand(score: number): ScoreBand {
  if (score >= SCORE_THRESHOLDS.high) return "high";
  if (score >= SCORE_THRESHOLDS.mid) return "mid";
  return "low";
}

/**
 * Rank a set of jobs for one candidate, best match first (Matchmaker view).
 * Generic so callers get their own job objects back, fully typed.
 */
export function rankJobs<J extends ScoreJobInput>(
  candidate: ScoreCandidateInput,
  jobs: readonly J[],
): Array<{ job: J; match: MatchResult }> {
  return jobs
    .map((job) => ({ job, match: matchScore(candidate, job) }))
    .sort((a, b) => b.match.score - a.match.score);
}
