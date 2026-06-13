import type { Metadata } from "next";
import Link from "next/link";
import {
  getDashboardStats,
  getInterviews,
  getSettings,
  INTERVIEW_TYPE_LABELS,
  REFERENCE_NOW,
  type ActivityFeedItem,
  type ActivityType,
  type InterviewWithRelations,
  type StalledApplication,
} from "@/lib/data";
import { formatDayLabel, formatTime, relativeTime } from "@/lib/format";
import { Card, CardBody, CardHeader, CardTitle, EmptyState, StageBadge } from "@/components/ui";
import { PipelineSummaryBar } from "@/components/charts/pipeline-summary-bar";
import { StatCard } from "@/components/charts/stat-card";

export const metadata: Metadata = {
  title: "Dashboard — JeniMcRich Recruitment",
};

const DAY_MS = 86_400_000;

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  stage: "🔁",
  note: "📝",
  email: "✉️",
  doc: "📎",
  interview: "📅",
  tag: "🏷️",
  flag: "🚩",
  scorecard: "📋",
  system: "⚙️",
};

const thClass =
  "micro-label px-4 py-2.5 text-left text-slate-500 first:pl-5 last:pr-5";
const tdClass = "px-4 py-2.5 align-middle first:pl-5 last:pr-5";

function TodayBanner({ interviews }: { interviews: InterviewWithRelations[] }) {
  if (interviews.length === 0) return null;
  return (
    <Card className="border-l-4 border-l-accent px-5 py-3.5">
      <p className="text-[13px] leading-relaxed text-slate-600">
        <span aria-hidden="true">📅 </span>
        <span className="font-semibold text-ink">Today:</span>{" "}
        {interviews
          .map(
            (iv) =>
              `${iv.candidate.full_name} (${INTERVIEW_TYPE_LABELS[iv.interview_type]}, ${formatTime(iv.starts_at)})`,
          )
          .join(" · ")}{" "}
        —{" "}
        <Link href="/calendar" className="font-medium text-primary hover:underline">
          view calendar →
        </Link>
      </p>
    </Card>
  );
}

function UpcomingInterviews({ interviews }: { interviews: InterviewWithRelations[] }) {
  if (interviews.length === 0) {
    return (
      <EmptyState
        icon="📅"
        title="No interviews scheduled"
        hint="Book one from a candidate's Schedule tab — it will show up here."
      />
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {interviews.map((iv) => (
        <li key={iv.id} className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            <Link
              href={`/candidates/${iv.candidate_id}`}
              className="text-[13.5px] font-semibold text-ink hover:text-primary hover:underline"
            >
              {iv.candidate.full_name}
            </Link>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {INTERVIEW_TYPE_LABELS[iv.interview_type]} · {formatDayLabel(iv.starts_at)}{" "}
              {formatTime(iv.starts_at)} · {iv.interviewer_name}
            </p>
          </div>
          <StageBadge stage={iv.application.stage} />
        </li>
      ))}
    </ul>
  );
}

function StalledTable({ stalled }: { stalled: StalledApplication[] }) {
  if (stalled.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="All candidates moving on schedule"
        hint="Nobody has sat without a stage move, note, or email beyond the threshold."
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-slate-200">
            <th scope="col" className={thClass}>
              Candidate
            </th>
            <th scope="col" className={thClass}>
              Role
            </th>
            <th scope="col" className={thClass}>
              Stage
            </th>
            <th
              scope="col"
              className={thClass}
              title="Days since the last stage move, note, or email"
            >
              Stalled
            </th>
            <th scope="col" className={thClass}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stalled.map((app) => (
            <tr key={app.id} className="hover:bg-slate-50">
              <td className={`${tdClass} font-semibold text-ink`}>
                {app.candidate.full_name}
                {app.candidate.flagged ? (
                  <span aria-hidden="true" title="Flagged priority">
                    {" "}
                    🚩
                  </span>
                ) : null}
              </td>
              <td className={`${tdClass} text-slate-600`}>
                {app.job.title}
                <span className="block text-xs text-slate-400">{app.job.client_name}</span>
              </td>
              <td className={tdClass}>
                <StageBadge stage={app.stage} />
              </td>
              <td className={tdClass}>
                <span className="font-bold tabular-nums text-amber-600">
                  {app.days_stalled}d
                </span>
              </td>
              <td className={`${tdClass} text-right`}>
                <Link
                  href={`/candidates/${app.candidate_id}`}
                  className="inline-flex items-center rounded-control border border-slate-200 bg-surface px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityFeed({ activity }: { activity: ActivityFeedItem[] }) {
  if (activity.length === 0) {
    return (
      <EmptyState
        icon="🗒️"
        title="No activity yet"
        hint="Stage moves, notes, and emails will appear here as the team works."
      />
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {activity.map((item) => (
        <li key={item.id} className="flex gap-3 px-5 py-3">
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[13px]"
          >
            {ACTIVITY_ICONS[item.type]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug text-slate-700">
              <Link
                href={`/candidates/${item.candidate_id}`}
                className="font-semibold text-ink hover:text-primary hover:underline"
              >
                {item.candidate_name}
              </Link>{" "}
              — {item.body}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {relativeTime(item.created_at, REFERENCE_NOW)} · {item.actor_name}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const todayStartMs = REFERENCE_NOW.getTime() - (REFERENCE_NOW.getTime() % DAY_MS);
  const [stats, settings, weekInterviews] = await Promise.all([
    getDashboardStats(),
    getSettings(),
    getInterviews({
      from: new Date(todayStartMs).toISOString(),
      to: new Date(todayStartMs + 7 * DAY_MS).toISOString(),
      status: "scheduled",
    }),
  ]);

  return (
    <div className="space-y-4 p-6">
      <TodayBanner interviews={stats.todays_interviews} />

      <section aria-labelledby="dashboard-kpis">
        <h2 id="dashboard-kpis" className="sr-only">
          Key metrics
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Active candidates"
            value={stats.active_candidates}
            sub={`${stats.flagged_candidates} flagged priority`}
          />
          <StatCard
            label="Open jobs"
            value={stats.open_jobs}
            sub={`across ${stats.open_clients} client${stats.open_clients === 1 ? "" : "s"}`}
          />
          <StatCard
            label="Interviews this week"
            value={weekInterviews.length}
            sub={`${stats.todays_interviews.length} today`}
          />
          <StatCard
            label="Offers pending"
            value={stats.stage_counts.offer}
            sub={`${stats.hired_total} hired · avg ${stats.avg_time_to_hire_days}d to hire`}
          />
          <StatCard
            label="Stalled"
            value={stats.stalled_count}
            tone={stats.stalled_count > 0 ? "warning" : "success"}
            sub={`≥ ${settings.stalled_days} days without movement`}
          />
        </div>
      </section>

      <section aria-labelledby="dashboard-pipeline" className="grid gap-4 lg:grid-cols-2">
        <h2 id="dashboard-pipeline" className="sr-only">
          Pipeline and interviews
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Pipeline snapshot</CardTitle>
            <Link
              href="/pipeline"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Open board →
            </Link>
          </CardHeader>
          <CardBody>
            <PipelineSummaryBar stageCounts={stats.stage_counts} />
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
              {stats.stage_counts.rejected} rejected to date (kept out of the funnel)
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming interviews</CardTitle>
            <Link
              href="/calendar"
              className="text-[13px] font-medium text-primary hover:underline"
            >
              View calendar →
            </Link>
          </CardHeader>
          <UpcomingInterviews interviews={stats.upcoming_interviews} />
        </Card>
      </section>

      <section
        aria-labelledby="dashboard-attention"
        className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      >
        <h2 id="dashboard-attention" className="sr-only">
          Needs attention and recent activity
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Needs attention — stalled candidates</CardTitle>
            <p className="text-xs text-slate-500">
              threshold {settings.stalled_days}d ·{" "}
              <Link href="/settings" className="font-medium text-primary hover:underline">
                configure
              </Link>
            </p>
          </CardHeader>
          <StalledTable stalled={stats.stalled} />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <ActivityFeed activity={stats.recent_activity} />
        </Card>
      </section>
    </div>
  );
}
