import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Icon,
  ScorePill,
  cn,
} from "@/components/ui";
import {
  DataLayerError,
  JOB_STATUS_LABELS,
  displayNow,
  STAGES,
  STAGE_LABELS,
  VISA_LABELS,
  getApplicationsForJob,
  getJob,
  isRestrictiveVisa,
  toScoreCandidate,
  toScoreJob,
  type ApplicationWithRelations,
  type JobStatus,
} from "@/lib/data";
import { formatDate, formatDateTime, daysSince } from "@/lib/format";
import { matchScore } from "@/lib/scoring";
import { getJobNotes, getLocalJob } from "../_lib/job-store";
import { AddJobNoteForm } from "./add-note-form";
import { ApplicantsTable, type ApplicantRow } from "./applicants-table";

const statusVariant: Record<JobStatus, "success" | "warning" | "default"> = {
  open: "success",
  on_hold: "warning",
  closed: "default",
};

const WEIGHT_NAMES: Record<1 | 2 | 3, string> = {
  1: "Nice-to-have",
  2: "Important",
  3: "Must-have",
};

function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="micro-label text-slate-500">{label}</p>
      <div className="mt-1 text-2xl font-bold tracking-tight text-ink">{value}</div>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </Card>
  );
}

function WeightDots({ weight }: { weight: 1 | 2 | 3 }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn("size-1.5 rounded-full", i <= weight ? "bg-primary" : "bg-slate-200")}
        />
      ))}
    </span>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = (await getJob(id)) ?? (await getLocalJob(id));
  if (!job) notFound();

  // Locally created jobs are unknown to the shared demo data layer — they
  // simply have no applications yet.
  let applications: ApplicationWithRelations[] = [];
  try {
    applications = await getApplicationsForJob(job.id);
  } catch (error) {
    if (!(error instanceof DataLayerError && error.code === "NOT_FOUND")) throw error;
  }

  const notes = await getJobNotes(job.id);

  // --- KPIs -----------------------------------------------------------------
  const scoreJob = toScoreJob(job);
  const ranked = applications
    .map((app) => ({ app, match: matchScore(toScoreCandidate(app.candidate), scoreJob) }))
    .sort((a, b) => b.match.score - a.match.score);

  const total = applications.length;
  const avgScore =
    total > 0 ? Math.round(ranked.reduce((sum, r) => sum + r.match.score, 0) / total) : null;
  const daysOpen = daysSince(job.opened_at, displayNow());
  const reachedInterview = applications.filter((a) =>
    a.stage === "interview" || a.stage === "offer" || a.stage === "hired",
  ).length;
  const offers = applications.filter((a) => a.stage === "offer" || a.stage === "hired").length;
  const activeCount = applications.filter(
    (a) => a.stage !== "hired" && a.stage !== "rejected",
  ).length;
  const interviewRate = total > 0 ? Math.round((reachedInterview / total) * 100) : 0;

  const applicantRows: ApplicantRow[] = ranked.map(({ app, match }) => ({
    application_id: app.id,
    candidate_id: app.candidate_id,
    name: app.candidate.full_name,
    score: match.score,
    stage: app.stage,
    days_in_stage: app.days_in_stage,
    is_stalled: app.is_stalled,
    expected_salary: app.candidate.expected_salary,
    flagged: app.candidate.flagged,
  }));

  const pipeline = STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: job.stage_counts[stage],
    names: applications
      .filter((a) => a.stage === stage)
      .map((a) => a.candidate.full_name),
  }));

  return (
    <div className="p-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:text-primary-strong hover:underline"
      >
        <Icon name="chevronRight" size={15} className="rotate-180" />
        Back to jobs
      </Link>

      {/* Overview */}
      <Card className="mt-3">
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink">{job.title}</h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {job.client_name} · {job.location || "Location TBC"} ·{" "}
                {job.salary_range || "Salary TBC"} · opened {formatDate(job.opened_at)}
              </p>
            </div>
            <Badge variant={statusVariant[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
          </div>

          {job.visa !== "UNSPECIFIED" ? (
            <div
              className={cn(
                "mt-3 flex flex-wrap items-center gap-2 rounded-control border px-3 py-2",
                isRestrictiveVisa(job.visa)
                  ? "border-warning-soft bg-warning-soft/40"
                  : "border-slate-200 bg-slate-50",
              )}
            >
              <Badge variant={isRestrictiveVisa(job.visa) ? "visa" : "default"}>
                {VISA_LABELS[job.visa]}
              </Badge>
              {job.visa_notes ? (
                <span className="text-xs text-slate-600">{job.visa_notes}</span>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Work authorization: not specified</p>
          )}

          {job.description ? (
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{job.description}</p>
          ) : null}

          {job.requirements.length > 0 ? (
            <div className="mt-3">
              <p className="micro-label text-slate-500">Requirements</p>
              <ul className="mt-1.5 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {job.requirements.map((req) => (
                  <li key={req} className="flex gap-2 text-[13px] text-slate-600">
                    <Icon name="check" size={15} className="mt-0.5 shrink-0 text-primary" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* KPIs */}
      <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total applicants"
          value={total}
          sub={`${activeCount} active in pipeline`}
        />
        <StatCard
          label="Avg match score"
          value={avgScore === null ? <span className="text-slate-300">—</span> : <ScorePill score={avgScore} label="Average match score" className="text-base" />}
          sub={avgScore === null ? "No applicants scored yet" : `across ${total} applicant${total === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Interview rate"
          value={`${interviewRate}%`}
          sub={`${reachedInterview} reached interview · ${offers} offer${offers === 1 ? "" : "s"}`}
        />
        <StatCard label="Days open" value={`${daysOpen}d`} sub={`since ${formatDate(job.opened_at)}`} />
      </div>

      {/* Applicant mini-pipeline */}
      <Card className="mt-4 overflow-hidden">
        <CardHeader>
          <CardTitle>Applicant pipeline</CardTitle>
          <span className="text-xs text-slate-500">
            {activeCount} active · {total} total
          </span>
        </CardHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {pipeline.map(({ stage, label, count, names }) => (
            <div
              key={stage}
              className="border-b border-r border-slate-100 p-3 last:border-r-0 lg:border-b-0"
            >
              <p className="micro-label text-slate-500">{label}</p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums",
                  count > 0 ? "text-ink" : "text-slate-300",
                )}
              >
                {count}
              </p>
              <div className="mt-1 space-y-0.5">
                {names.slice(0, 3).map((name) => (
                  <p key={name} className="truncate text-[11px] text-slate-500">
                    {name}
                  </p>
                ))}
                {names.length > 3 ? (
                  <p className="text-[11px] font-medium text-slate-400">+{names.length - 3} more</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Ranked applicants */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Applicants — ranked by match</CardTitle>
              <span className="text-xs text-slate-500">
                Scored against this JD&apos;s weighted skills
              </span>
            </CardHeader>
            <ApplicantsTable rows={applicantRows} />
          </Card>

          {/* Hiring-manager notes */}
          <Card>
            <CardHeader>
              <CardTitle>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="note" size={16} className="text-slate-500" />
                Hiring manager notes
              </span>
            </CardTitle>
              <span className="text-xs text-slate-500">Visible to the hiring team only</span>
            </CardHeader>
            <CardBody>
              {notes.length > 0 ? (
                <ul className="space-y-2.5">
                  {notes.map((note) => (
                    <li
                      key={note.id}
                      className="rounded-control border border-slate-200 bg-slate-50 px-3 py-2.5"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-700">{note.author_name}</p>
                        <p className="whitespace-nowrap text-[11px] text-slate-400">
                          {formatDateTime(note.created_at)}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] text-slate-600">
                        {note.body}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-slate-500">
                  No notes yet — capture how the search evolves, e.g. “HM now prefers candidates
                  with kiln experience” or “budget approved up to $150k”.
                </p>
              )}
              <AddJobNoteForm jobId={job.id} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Weighted skills */}
          <Card>
            <CardHeader>
              <CardTitle>Weighted skills</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {job.skills.length > 0 ? (
                <ul>
                  {job.skills.map((skill) => (
                    <li
                      key={skill.skill}
                      className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-2.5 last:border-b-0"
                    >
                      <span className="inline-flex items-center text-[13px] font-medium text-slate-700">
                        {skill.skill}
                        {skill.weight === 3 ? (
                          <Icon
                            name="star"
                            size={13}
                            fill
                            className="ml-1 text-warning"
                            label="Must-have"
                          />
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <WeightDots weight={skill.weight} />
                        <span className="w-20 text-right text-[11px] font-medium text-slate-400">
                          {WEIGHT_NAMES[skill.weight]}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-[13px] text-slate-500">No skills captured for this JD.</p>
              )}
            </CardBody>
          </Card>

          {/* Full JD text */}
          <Card>
            <CardHeader>
              <CardTitle>Job description text</CardTitle>
            </CardHeader>
            <CardBody>
              {job.jd_text ? (
                <pre className="scrollbar-slim max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-slate-600">
                  {job.jd_text}
                </pre>
              ) : (
                <p className="text-[13px] text-slate-500">
                  No JD text on file — paste one when editing the listing to power the matchmaker.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
