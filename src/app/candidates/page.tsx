import type { Metadata } from "next";
import { Card } from "@/components/ui";
import {
  STAGES,
  getCandidates,
  getJobs,
  isRestrictiveVisa,
  toScoreCandidate,
  toScoreJob,
  type CandidateWithApplications,
  type Stage,
} from "@/lib/data";
import { matchScore } from "@/lib/scoring";
import { AddCandidateButton } from "./_components/add-candidate-button";
import { CandidateFilters } from "./_components/candidate-filters";
import { CandidatesTable } from "./_components/candidates-table";
import type { CandidateListRow } from "./_lib/view-types";

export const metadata: Metadata = { title: "Candidates — JeniMcRich Recruitment" };

// The demo store mutates between requests — always render fresh.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Score the candidate against every applied job; keep the best match. */
function toRow(c: CandidateWithApplications): CandidateListRow {
  const scoreInput = toScoreCandidate(c);
  const scored = c.applications.map((app) => ({
    app,
    score: matchScore(scoreInput, toScoreJob(app.job)).score,
  }));
  const best = scored.length > 0 ? scored.reduce((top, s) => (s.score > top.score ? s : top)) : null;
  const topSkills = [...c.skills].sort((a, b) => b.years - a.years).slice(0, 3);

  return {
    id: c.id,
    name: c.full_name,
    email: c.email,
    flagged: c.flagged,
    years: c.years_exp,
    topSkills: topSkills.map((s) => s.skill),
    moreSkills: Math.max(0, c.skills.length - topSkills.length),
    roleTitle: best?.app.job.title ?? null,
    roleClient: best?.app.job.client_name ?? null,
    restrictiveVisa: best !== null && isRestrictiveVisa(best.app.job.visa),
    score: best?.score ?? null,
    stages: [...new Set(c.applications.map((a) => a.stage))],
    tags: c.tags,
    source: c.source,
    daysInStage: best?.app.days_in_stage ?? null,
    stalled: c.applications.some((a) => a.is_stalled),
  };
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const stages = toArray(sp.stage).filter((s): s is Stage => (STAGES as readonly string[]).includes(s));
  const tags = toArray(sp.tag);
  const flagged = sp.flagged === "1";

  const [filtered, everyone, openJobs] = await Promise.all([
    getCandidates({
      q: q.trim() || undefined,
      stages: stages.length > 0 ? stages : undefined,
      tags: tags.length > 0 ? tags : undefined,
      flagged_only: flagged || undefined,
    }),
    getCandidates(),
    getJobs({ status: "open" }),
  ]);

  const allTags = [...new Set(everyone.flatMap((c) => c.tags))].sort();
  const rows = filtered.map(toRow);
  const shown = rows.length;

  return (
    <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start">
      <CandidateFilters allTags={allTags} state={{ q, stages, tags, flagged }} />

      <section className="min-w-0 flex-1 space-y-3" aria-label="Candidate list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-slate-500">
            {shown} candidate{shown === 1 ? "" : "s"} shown · sorted by match score
          </p>
          <AddCandidateButton
            jobs={openJobs.map((j) => ({ id: j.id, title: j.title, clientName: j.client_name }))}
          />
        </div>
        <Card>
          <CandidatesTable rows={rows} />
        </Card>
      </section>
    </div>
  );
}
