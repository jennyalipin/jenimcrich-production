"use client";

import { useRouter } from "next/navigation";
import {
  DataTable,
  EmptyState,
  ScorePill,
  StageBadge,
  type DataTableColumn,
} from "@/components/ui";
import { STAGES, type Stage } from "@/lib/data/types";
import { formatDaysCompact, formatSalary } from "@/lib/format";

/** Plain, serializable applicant row — scored and ranked by the server page. */
export interface ApplicantRow {
  application_id: string;
  candidate_id: string;
  name: string;
  score: number;
  stage: Stage;
  days_in_stage: number;
  is_stalled: boolean;
  expected_salary: string;
  flagged: boolean;
}

const stageRank = (stage: Stage) => STAGES.indexOf(stage);

const columns: ReadonlyArray<DataTableColumn<ApplicantRow>> = [
  {
    key: "name",
    header: "Candidate",
    cell: (row) => (
      <span className="font-semibold text-ink">
        {row.flagged ? (
          <span aria-hidden="true" className="mr-1 text-warning" title="Flagged top candidate">
            ⚑
          </span>
        ) : null}
        {row.name}
      </span>
    ),
    sortValue: (row) => row.name,
  },
  {
    key: "score",
    header: "Match",
    cell: (row) => <ScorePill score={row.score} />,
    sortValue: (row) => row.score,
    className: "w-20",
  },
  {
    key: "stage",
    header: "Stage",
    cell: (row) => <StageBadge stage={row.stage} />,
    sortValue: (row) => stageRank(row.stage),
    className: "w-28",
  },
  {
    key: "days_in_stage",
    header: "In stage",
    align: "right",
    cell: (row) =>
      row.is_stalled ? (
        <span
          className="font-semibold tabular-nums text-warning-ink"
          title="Stalled — no activity recently"
        >
          {formatDaysCompact(row.days_in_stage)} ⚠
        </span>
      ) : (
        <span className="tabular-nums text-slate-500">{formatDaysCompact(row.days_in_stage)}</span>
      ),
    sortValue: (row) => row.days_in_stage,
    className: "w-24",
  },
  {
    key: "expected",
    header: "Expected",
    cell: (row) => <span className="whitespace-nowrap">{formatSalary(row.expected_salary)}</span>,
  },
];

export function ApplicantsTable({ rows }: { rows: ApplicantRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      ariaLabel="Applicants ranked by match score"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.application_id}
      onRowClick={(row) => router.push(`/candidates/${row.candidate_id}`)}
      initialSort={{ key: "score", direction: "desc" }}
      dense
      empty={
        <EmptyState
          icon="🎯"
          title="No applicants yet"
          hint="Candidates linked to this job will appear here, ranked by match score."
        />
      }
    />
  );
}
