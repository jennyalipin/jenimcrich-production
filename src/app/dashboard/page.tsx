import type { Metadata } from "next";
import Link from "next/link";
import {
  getDashboardStats,
  getInterviews,
  getSettings,
  INTERVIEW_TYPE_LABELS,
  displayNow,
  type ActivityFeedItem,
  type ActivityType,
  type DashboardInterview,
  type DashboardStalled,
} from "@/lib/data";
import { formatDayLabel, formatTime, relativeTime } from "@/lib/format";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Icon,
  StageBadge,
  type IconName,
} from "@/components/ui";
import { PipelineSummaryBar } from "@/components/charts/pipeline-summary-bar";
import { StatCard } from "@/components/charts/stat-card";

export const metadata: Metadata = {
  title: "Dashboard — Jenny Mcrich Recruitment",
};

const DAY_MS = 86_400_000;

const ACTIVITY_ICONS: Record<ActivityType, IconName> = {
  stage: "stage",
  note: "note",
  email: "email",
  doc: "doc",
  interview: "interview",
  tag: "tag",
  flag: "flag",
  scorecard: "scorecard",
  compliance: "visa",
  legal_review: "verified",
  system: "system",
};

const thClass =
  "micro-label px-4 py-2.5 text-left text-slate-500 first:pl-5 last:pr-5";
const tdClass = "px-4 py-2.5 align-middle first:pl-5 last:pr-5";

function TodayBanner({ interviews }: { interviews: DashboardInterview[] }) {
  if (interviews.length === 0) return null;
  return (
    <Card className="flex items-start gap-2.5 px-5 py-3.5">
      <Icon name="calendar" size={16} className="mt-0.5 shrink-0 text-slate-500" />
      <p className="text-[13px] leading-relaxed text-slate-600">
        <span className="font-semibold text-ink">Today:</span>{" "}
        {interviews
          .map(
            (iv) =>
              `${iv.candidate_name} (${INTERVIEW_TYPE_LABELS[iv.interview_type]}, ${formatTime(iv.starts_at)})`,
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

function UpcomingInterviews({ interviews }: { interviews: DashboardInterview[] }) {
  if (interviews.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="interview" size={20} />}
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
              {iv.candidate_name}
            </Link>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {INTERVIEW_TYPE_LABELS[iv.interview_type]} · {formatDayLabel(iv.starts_at)}{" "}
              {formatTime(iv.starts_at)} · {iv.interviewer_name}
            </p>
          </div>
          <StageBadge stage={iv.stage} />
        </li>
      ))}
    </ul>
  );
}

function StalledTable({ stalled, total }: { stalled: DashboardStalled[]; total: number }) {
  if (stalled.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="success" size={20} />}
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
          {stalled.slice(0, 8).map((app) => (
            <tr key={app.application_id} className="hover:bg-slate-50">
              <td className={`${tdClass} font-semibold text-ink`}>
                {app.candidate_name}
                {app.candidate_flagged ? (
                  <Icon
                    name="flag"
                    size={13}
                    label="Flagged priority"
                    className="ml-1 inline-block align-[-1px] text-amber-600"
                  />
                ) : null}
              </td>
              <td className={`${tdClass} text-slate-600`}>
                {app.job_title}
                <span className="block text-xs text-slate-400">{app.client_name}</span>
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
      {total > 8 ? (
        <div className="border-t border-slate-100 px-5 py-2.5">
          <Link href="/candidates" className="text-[13px] text-primary hover:underline">
            Showing 8 of {total} — view all in Candidates →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ActivityFeed({ activity }: { activity: ActivityFeedItem[] }) {
  if (activity.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="note" size={20} />}
        title="No activity yet"
        hint="Stage moves, notes, and emails will appear here as the team works."
      />
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {activity.slice(0, 8).map((item) => (
        <li key={item.id} className="flex gap-3 px-5 py-3">
          <span
            aria-hidden="true"
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-slate-100"
          >
            <Icon name={ACTIVITY_ICONS[item.type]} size={14} className="text-slate-500" />
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
              {relativeTime(item.created_at, displayNow())} · {item.actor_name}
            </p>
          </div>
        </li>
      ))}
      {activity.length > 8 ? (
        <li className="px-5 py-2.5 text-xs text-slate-400">Showing recent activity</li>
      ) : null}
    </ul>
  );
}

export default async function DashboardPage() {
  const nowMs = displayNow().getTime();
  const todayStartMs = nowMs - (nowMs % DAY_MS);
  const [stats, settings, weekInterviews] = await Promise.all([
    getDashboardStats(),
    getSettings(),
    getInterviews({
      from: new Date(todayStartMs).toISOString(),
      to: new Date(todayStartMs + 7 * DAY_MS).toISOString(),
      status: "scheduled",
    }),
  ]);

  // Greeting in the agency's timezone (PH, UTC+8); editorial focal header.
  const phHour = (displayNow().getUTCHours() + 8) % 24;
  const greeting =
    phHour < 12 ? "Good morning" : phHour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-4 p-6">
      <header className="pb-1">
        <p className="eyebrow">Recruiter workspace</p>
        <p className="heading-tight mt-1 text-[26px] text-ink">
          {greeting}, Jenny — the{" "}
          <span className="text-primary">pipeline</span> is moving
        </p>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          {stats.active_candidates} candidates active across {stats.open_jobs} open
          role{stats.open_jobs === 1 ? "" : "s"} · {stats.stalled_count} need a nudge ·{" "}
          {weekInterviews.length} interview{weekInterviews.length === 1 ? "" : "s"} this week
        </p>
      </header>

      <TodayBanner interviews={stats.todays_interviews} />

      <section aria-labelledby="dashboard-kpis">
        <h2 id="dashboard-kpis" className="sr-only">
          Key metrics
        </h2>
        <div className="stagger-children grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
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

      <section aria-labelledby="dashboard-pipeline" className="stagger-children grid gap-4 lg:grid-cols-2">
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
        className="stagger-children grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
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
          <StalledTable stalled={stats.stalled} total={stats.stalled_count} />
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
