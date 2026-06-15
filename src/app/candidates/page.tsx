import type { Metadata } from "next";
import Link from "next/link";
import { Card, Icon, cn } from "@/components/ui";
import {
  STAGES,
  getCandidatesPage,
  getCandidateTags,
  getJobs,
  isRestrictiveVisa,
  toScoreCandidate,
  toScoreJob,
  type CandidateWithApplications,
  type Stage,
} from "@/lib/data";
import { matchScore } from "@/lib/scoring";
import type { CandidateFilters as CandidateQueryFilters } from "@/lib/data";
import { AddCandidateButton } from "./_components/add-candidate-button";
import { CandidateFilters } from "./_components/candidate-filters";
import { CandidatesTable } from "./_components/candidates-table";
import { ExportCandidatesButton } from "./_components/export-button";
import { ImportCandidatesButton } from "./_components/import-button";
import type { CandidateListRow } from "./_lib/view-types";

export const metadata: Metadata = { title: "Candidates — Jenny Mcrich Recruitment" };

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

  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "", 10) || 1);

  const queryFilters: CandidateQueryFilters = {
    q: q.trim() || undefined,
    stages: stages.length > 0 ? stages : undefined,
    tags: tags.length > 0 ? tags : undefined,
    flagged_only: flagged || undefined,
  };

  const [{ rows: pageRows, total }, allTags, openJobs] = await Promise.all([
    getCandidatesPage(queryFilters, page, PAGE_SIZE),
    getCandidateTags(),
    getJobs({ status: "open" }),
  ]);

  const rows = pageRows.map(toRow);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start">
      <CandidateFilters allTags={allTags} state={{ q, stages, tags, flagged }} />

      <section className="min-w-0 flex-1 space-y-3" aria-label="Candidate list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-slate-500">
            {total === 0
              ? "No candidates match these filters"
              : `Showing ${from}–${to} of ${total} candidate${total === 1 ? "" : "s"}`}
          </p>
          <div className="flex items-center gap-2">
            <ImportCandidatesButton />
            <ExportCandidatesButton filters={queryFilters} />
            <AddCandidateButton
              jobs={openJobs.map((j) => ({ id: j.id, title: j.title, clientName: j.client_name }))}
            />
          </div>
        </div>
        <Card>
          <CandidatesTable rows={rows} />
        </Card>
        {totalPages > 1 ? (
          <nav
            aria-label="Candidate pages"
            className="flex items-center justify-between gap-3 px-1 pt-1 text-[13px]"
          >
            <PageLink href={pageHref(sp, page - 1)} disabled={page <= 1} dir="prev" />
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <PageLink href={pageHref(sp, page + 1)} disabled={page >= totalPages} dir="next" />
          </nav>
        ) : null}
      </section>
    </div>
  );
}

const PAGE_SIZE = 25;

/** Build a /candidates URL preserving the active filters at a given page. */
function pageHref(sp: SearchParams, page: number): string {
  const params = new URLSearchParams();
  if (typeof sp.q === "string" && sp.q) params.set("q", sp.q);
  for (const s of toArray(sp.stage)) params.append("stage", s);
  for (const t of toArray(sp.tag)) params.append("tag", t);
  if (sp.flagged === "1") params.set("flagged", "1");
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/candidates?${qs}` : "/candidates";
}

function PageLink({ href, disabled, dir }: { href: string; disabled: boolean; dir: "prev" | "next" }) {
  const label = dir === "prev" ? "Previous" : "Next";
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 font-medium transition-colors",
    disabled
      ? "pointer-events-none border-slate-200 text-slate-300"
      : "border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50",
  );
  const content =
    dir === "prev" ? (
      <>
        <Icon name="chevronRight" size={15} className="rotate-180" /> {label}
      </>
    ) : (
      <>
        {label} <Icon name="chevronRight" size={15} />
      </>
    );
  return disabled ? (
    <span className={cls} aria-disabled="true">
      {content}
    </span>
  ) : (
    <Link href={href} className={cls}>
      {content}
    </Link>
  );
}
