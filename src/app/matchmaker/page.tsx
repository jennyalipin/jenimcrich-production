import { getCandidates, getJobs } from "@/lib/data";
import { ScoringDisclosure } from "@/components/scoring/scoring-disclosure";
import { DEFAULT_SKILL_DICTIONARY } from "@/lib/jd-parser";
import {
  MatchmakerClient,
  type MatchCandidate,
  type MatchJob,
} from "./matchmaker-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Matchmaker — Jenny Mcrich Recruitment" };

/** Jobs/candidates mutate in-memory via other pages' actions — stay fresh. */
export const dynamic = "force-dynamic";

export default async function MatchmakerPage() {
  const [openJobs, candidates] = await Promise.all([
    getJobs({ status: "open" }),
    getCandidates(),
  ]);

  // Trim to the plain serializable shapes the client island needs.
  const jobs: MatchJob[] = openJobs.map((job) => ({
    id: job.id,
    title: job.title,
    client_name: job.client_name,
    location: job.location,
    salary_range: job.salary_range,
    min_years: job.min_years,
    visa: job.visa,
    visa_notes: job.visa_notes,
    skills: job.skills,
    applicant_count: job.applicant_count,
  }));

  const matchCandidates: MatchCandidate[] = candidates.map((candidate) => ({
    id: candidate.id,
    full_name: candidate.full_name,
    years_exp: candidate.years_exp,
    location: candidate.location,
    source: candidate.source,
    summary: candidate.summary,
    flagged: candidate.flagged,
    skills: candidate.skills,
    certifications: candidate.certifications,
    applications: candidate.applications.map((app) => ({
      job_id: app.job_id,
      stage: app.stage,
    })),
  }));

  // Live skill dictionary for resume parsing: prototype defaults plus every
  // skill currently on a job or candidate (deduped case-insensitively).
  const seen = new Set<string>();
  const skillDictionary: string[] = [];
  for (const skill of [
    ...DEFAULT_SKILL_DICTIONARY,
    ...openJobs.flatMap((job) => job.skills.map((s) => s.skill)),
    ...candidates.flatMap((candidate) => candidate.skills.map((s) => s.skill)),
  ]) {
    const key = skill.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      skillDictionary.push(skill);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <ScoringDisclosure />
      <MatchmakerClient
        jobs={jobs}
        candidates={matchCandidates}
        skillDictionary={skillDictionary}
      />
    </div>
  );
}
