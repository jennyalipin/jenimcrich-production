"use client";

import { useRouter } from "next/navigation";
import { Badge, DataTable, EmptyState, Icon, type DataTableColumn } from "@/components/ui";
import {
  JOB_STATUS_LABELS,
  VISA_LABELS,
  isRestrictiveVisa,
  type JobSkill,
  type JobStatus,
  type VisaType,
} from "@/lib/data/types";
import { formatDaysCompact, formatSalary } from "@/lib/format";

/** Plain, serializable row shape — built by the server page. */
export interface JobRow {
  id: string;
  title: string;
  client_name: string;
  location: string;
  salary_range: string;
  min_years: number;
  visa: VisaType;
  visa_notes: string | null;
  status: JobStatus;
  /** Applications currently in Applied/Screening/Interview/Offer. */
  open_count: number;
  applicant_count: number;
  days_open: number;
  skills: JobSkill[];
}

const statusVariant: Record<JobStatus, "success" | "warning" | "default"> = {
  open: "success",
  on_hold: "warning",
  closed: "default",
};

const statusRank: Record<JobStatus, number> = { open: 0, on_hold: 1, closed: 2 };

const columns: ReadonlyArray<DataTableColumn<JobRow>> = [
  {
    key: "title",
    header: "Role",
    cell: (row) => (
      <div className="min-w-44">
        <p className="font-semibold text-ink">{row.title}</p>
        {row.skills.length > 0 ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {row.skills
              .slice(0, 3)
              .map((s) => s.skill)
              .join(" · ")}
            {row.skills.length > 3 ? " · …" : ""}
          </p>
        ) : null}
      </div>
    ),
    sortValue: (row) => row.title,
  },
  {
    key: "client",
    header: "Client",
    cell: (row) => row.client_name,
    sortValue: (row) => row.client_name,
  },
  {
    key: "location",
    header: "Location",
    cell: (row) => <span className="whitespace-nowrap">{row.location || "—"}</span>,
    sortValue: (row) => row.location,
  },
  {
    key: "visa",
    header: "Visa",
    cell: (row) =>
      row.visa === "UNSPECIFIED" ? (
        <span className="text-slate-400">—</span>
      ) : (
        <Badge
          variant={isRestrictiveVisa(row.visa) ? "visa" : "default"}
          title={row.visa_notes ?? undefined}
        >
          {VISA_LABELS[row.visa]}
        </Badge>
      ),
    sortValue: (row) => (row.visa === "UNSPECIFIED" ? null : VISA_LABELS[row.visa]),
  },
  {
    key: "salary",
    header: "Salary",
    cell: (row) => <span className="whitespace-nowrap">{formatSalary(row.salary_range)}</span>,
  },
  {
    key: "min_years",
    header: "Min yrs",
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.min_years}</span>,
    sortValue: (row) => row.min_years,
    className: "w-20",
  },
  {
    key: "open_apps",
    header: "Open apps",
    align: "right",
    cell: (row) => (
      <span
        className="font-semibold tabular-nums text-ink"
        title={`${row.applicant_count} total applicants`}
      >
        {row.open_count}
      </span>
    ),
    sortValue: (row) => row.open_count,
    className: "w-24",
  },
  {
    key: "days_open",
    header: "Open for",
    align: "right",
    cell: (row) => <span className="tabular-nums text-slate-500">{formatDaysCompact(row.days_open)}</span>,
    sortValue: (row) => row.days_open,
    className: "w-20",
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge variant={statusVariant[row.status]}>{JOB_STATUS_LABELS[row.status]}</Badge>,
    sortValue: (row) => statusRank[row.status],
    className: "w-24",
  },
];

export function JobsTable({ rows }: { rows: JobRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      ariaLabel="Job listings"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      onRowClick={(row) => router.push(`/jobs/${row.id}`)}
      empty={
        <EmptyState
          icon={<Icon name="jobs" size={22} className="text-slate-400" />}
          title="No job listings yet"
          hint="Create your first listing — paste a JD into the New job form and auto-fill does the heavy lifting."
        />
      }
    />
  );
}
