"use client";

import { useRouter } from "next/navigation";
import {
  Badge,
  DataTable,
  EmptyState,
  ScorePill,
  StageBadge,
  cn,
  type DataTableColumn,
} from "@/components/ui";
import type { CandidateListRow } from "../_lib/view-types";

const columns: ReadonlyArray<DataTableColumn<CandidateListRow>> = [
  {
    key: "flag",
    header: <span className="sr-only">Flagged</span>,
    cell: (r) =>
      r.flagged ? (
        <span title="Priority candidate" role="img" aria-label="Flagged priority">
          ⭐
        </span>
      ) : (
        <span className="text-slate-200" aria-hidden="true">
          ☆
        </span>
      ),
    sortValue: (r) => (r.flagged ? 1 : 0),
    className: "w-8",
    align: "center",
  },
  {
    key: "candidate",
    header: "Candidate",
    cell: (r) => (
      <div>
        <p className="font-semibold text-slate-800">{r.name}</p>
        <p className="text-[12px] text-slate-400">{r.email}</p>
      </div>
    ),
    sortValue: (r) => r.name,
  },
  {
    key: "role",
    header: "Best-fit role",
    cell: (r) =>
      r.roleTitle ? (
        <div>
          <p className="text-slate-700">
            {r.roleTitle}{" "}
            {r.restrictiveVisa ? (
              <span title="Restrictive visa requirement" role="img" aria-label="Restrictive visa requirement">
                🛂
              </span>
            ) : null}
          </p>
          <p className="text-[12px] text-slate-400">{r.roleClient}</p>
        </div>
      ) : (
        <span className="text-slate-400">No application</span>
      ),
    sortValue: (r) => r.roleTitle,
  },
  {
    key: "match",
    header: "Match",
    cell: (r) =>
      r.score === null ? <span className="text-slate-300">—</span> : <ScorePill score={r.score} />,
    sortValue: (r) => r.score,
    align: "center",
    className: "w-20",
  },
  {
    key: "stage",
    header: "Stage",
    cell: (r) =>
      r.stages.length === 0 ? (
        <span className="text-slate-300">—</span>
      ) : (
        <span className="inline-flex flex-wrap gap-1">
          {r.stages.map((stage) => (
            <StageBadge key={stage} stage={stage} />
          ))}
        </span>
      ),
    sortValue: (r) => r.stages[0] ?? null,
  },
  {
    key: "skills",
    header: "Top skills",
    cell: (r) => (
      <span className="inline-flex flex-wrap items-center gap-1">
        {r.topSkills.map((skill) => (
          <Badge key={skill}>{skill}</Badge>
        ))}
        {r.moreSkills > 0 ? <span className="text-[11px] text-slate-400">+{r.moreSkills}</span> : null}
      </span>
    ),
  },
  {
    key: "years",
    header: "Yrs",
    cell: (r) => <span className="tabular-nums">{r.years}y</span>,
    sortValue: (r) => r.years,
    align: "right",
    className: "w-14",
  },
  {
    key: "tags",
    header: "Tags",
    cell: (r) =>
      r.tags.length === 0 ? (
        <span className="text-slate-300">—</span>
      ) : (
        <span className="inline-flex flex-wrap gap-1">
          {r.tags.map((tag) => (
            <Badge key={tag} variant="info">
              {tag}
            </Badge>
          ))}
        </span>
      ),
  },
  {
    key: "instage",
    header: "In stage",
    cell: (r) =>
      r.daysInStage === null ? (
        <span className="text-slate-300">—</span>
      ) : (
        <span className={cn("tabular-nums", r.stalled && "font-bold text-warning-ink")}>
          {r.daysInStage}d{" "}
          {r.stalled ? (
            <span title="Stalled — no movement past the configured threshold" role="img" aria-label="Stalled">
              ⚠
            </span>
          ) : null}
        </span>
      ),
    sortValue: (r) => r.daysInStage,
    align: "right",
    className: "w-20",
  },
];

/** The candidates ledger — sorted by best match, rows open the profile. */
export function CandidatesTable({ rows }: { rows: CandidateListRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      onRowClick={(r) => router.push(`/candidates/${r.id}`)}
      initialSort={{ key: "match", direction: "desc" }}
      ariaLabel="Candidates"
      empty={
        <EmptyState
          icon="👥"
          title="No candidates match these filters"
          hint="Adjust the filters on the left, or add a candidate to get started."
        />
      }
    />
  );
}
