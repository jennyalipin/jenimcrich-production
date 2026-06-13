import { Card } from "@/components/ui";
import {
  ACTIVE_STAGES,
  displayNow,
  getCandidates,
  getClients,
  getJobs,
  type JobStatus,
  type JobWithStats,
} from "@/lib/data";
import { daysSince } from "@/lib/format";
import { DEFAULT_SKILL_DICTIONARY } from "@/lib/jd-parser";
import { listLocalJobs } from "./_lib/job-store";
import { JobsTable, type JobRow } from "./jobs-table";
import { NewJobButton } from "./new-job-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Jobs — JeniMcRich Recruitment" };

const STATUS_ORDER: Record<JobStatus, number> = { open: 0, on_hold: 1, closed: 2 };

/** Case-insensitive union of every known skill (live jobs + candidates first,
 *  prototype dictionary as the cold-start fallback) for the JD parser. */
function buildSkillDictionary(
  jobs: JobWithStats[],
  candidateSkills: string[],
): string[] {
  const seen = new Map<string, string>();
  const names = [
    ...jobs.flatMap((j) => j.skills.map((s) => s.skill)),
    ...candidateSkills,
    ...DEFAULT_SKILL_DICTIONARY,
  ];
  for (const name of names) {
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()];
}

export default async function JobsPage() {
  const [dataJobs, localJobs, clients, candidates] = await Promise.all([
    getJobs(),
    listLocalJobs(),
    getClients(),
    getCandidates(),
  ]);

  // Locally created jobs surface at the top of their status group
  // (Array.prototype.sort is stable).
  const jobs = [...localJobs, ...dataJobs].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );

  const rows: JobRow[] = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    client_name: job.client_name,
    location: job.location,
    salary_range: job.salary_range,
    min_years: job.min_years,
    visa: job.visa,
    visa_notes: job.visa_notes,
    status: job.status,
    open_count: ACTIVE_STAGES.reduce((n, stage) => n + job.stage_counts[stage], 0),
    applicant_count: job.applicant_count,
    days_open: daysSince(job.opened_at, displayNow()),
    skills: job.skills,
  }));

  const openCount = jobs.filter((j) => j.status === "open").length;
  const onHoldCount = jobs.filter((j) => j.status === "on_hold").length;
  const closedCount = jobs.filter((j) => j.status === "closed").length;

  const skillDictionary = buildSkillDictionary(
    jobs,
    candidates.flatMap((c) => c.skills.map((s) => s.skill)),
  );

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-slate-500">
          <span className="font-semibold text-slate-700">{openCount}</span> open ·{" "}
          <span className="font-semibold text-slate-700">{onHoldCount}</span> on hold ·{" "}
          <span className="font-semibold text-slate-700">{closedCount}</span> closed
        </p>
        <NewJobButton
          clientNames={clients.map((c) => c.name)}
          skillDictionary={skillDictionary}
        />
      </div>

      <Card className="overflow-hidden">
        <JobsTable rows={rows} />
      </Card>
    </div>
  );
}
