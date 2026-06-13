import type { Metadata } from "next";
import {
  getAnalytics,
  getApplicationsByStage,
  REFERENCE_NOW,
  type AnalyticsData,
} from "@/lib/data";
import { formatDate } from "@/lib/format";
import { Card, CardBody, CardHeader, CardTitle, EmptyState, cn } from "@/components/ui";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { HiresPerMonthChart, type HiresDatum } from "@/components/charts/hires-per-month-chart";
import { SourceDonutChart } from "@/components/charts/source-donut-chart";
import { StatCard } from "@/components/charts/stat-card";
import { TimeInStageChart } from "@/components/charts/time-in-stage-chart";
import { STAGE_CHART_COLORS } from "@/components/charts/theme";

export const metadata: Metadata = {
  title: "Analytics & Reports — JeniMcRich Recruitment",
};

const MONTHS_SHOWN = 6;

/** Bucket hires into the last N calendar months (UTC) ending at REFERENCE_NOW. */
function buildHiresPerMonth(hiredEnteredAt: readonly string[]): HiresDatum[] {
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  const year = REFERENCE_NOW.getUTCFullYear();
  const month = REFERENCE_NOW.getUTCMonth();

  const buckets = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const offset = MONTHS_SHOWN - 1 - i;
    const start = Date.UTC(year, month - offset, 1);
    const end = Date.UTC(year, month - offset + 1, 1);
    return { label: monthFmt.format(start), start, end, hires: 0 };
  });

  for (const iso of hiredEnteredAt) {
    const t = Date.parse(iso);
    const bucket = buckets.find((b) => t >= b.start && t < b.end);
    if (bucket) bucket.hires += 1;
  }
  return buckets.map(({ label, hires }) => ({ label, hires }));
}

function ConversionStrip({ funnel }: { funnel: AnalyticsData["funnel"] }) {
  const pairs = funnel.slice(1).map((step, i) => ({
    key: step.stage,
    from: funnel[i]?.label ?? "",
    to: step.label,
    pct: step.conversion_pct,
  }));
  return (
    <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
      {pairs.map((p, i) => (
        <span key={p.key} className="whitespace-nowrap">
          {i > 0 ? <span className="mx-1.5 text-slate-300">·</span> : null}
          {p.from}→{p.to}:{" "}
          <span className="font-semibold text-slate-700 tabular-nums">{p.pct}%</span>
        </span>
      ))}
    </p>
  );
}

interface ActivityTileProps {
  label: string;
  value: number;
  warning?: boolean;
}

function ActivityTile({ label, value, warning = false }: ActivityTileProps) {
  return (
    <div className="bg-surface px-5 py-4">
      <div className="micro-label text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1.5 text-xl font-bold leading-none tabular-nums",
          warning && value > 0 ? "text-warning" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const [analytics, byStage] = await Promise.all([getAnalytics(), getApplicationsByStage()]);

  const funnelData = analytics.funnel.map((step) => ({
    label: step.label,
    count: step.count,
    color: STAGE_CHART_COLORS[step.stage],
  }));
  const stageTimeData = analytics.time_in_stage.map((s) => ({
    label: s.label,
    days: s.avg_days,
  }));
  const sourceData = analytics.source_breakdown.map((s) => ({
    source: s.source,
    total: s.total,
    qualified: s.qualified,
  }));
  const hiresData = buildHiresPerMonth(byStage.hired.map((app) => app.stage_entered_at));
  const totalHiresShown = hiresData.reduce((sum, d) => sum + d.hires, 0);
  const counts = analytics.activity_counts;

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-slate-500">
          Live metrics computed from your pipeline data.
        </p>
        <p className="text-xs text-slate-400">As of {formatDate(REFERENCE_NOW)}</p>
      </div>

      <section aria-labelledby="analytics-kpis">
        <h2 id="analytics-kpis" className="sr-only">
          Headline numbers
        </h2>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Total candidates"
            value={analytics.total_candidates}
            sub={`${analytics.offers_accepted} hired to date`}
          />
          <StatCard
            label="Avg time-to-hire"
            value={`${analytics.avg_time_to_hire_days}d`}
            sub="applied → hired, across all hires"
          />
          <StatCard
            label="Offer acceptance"
            value={`${analytics.offer_acceptance_pct}%`}
            sub={`${analytics.offers_accepted}/${analytics.offers_extended} offers accepted`}
          />
          <StatCard
            label="Interview → Offer"
            value={`${analytics.interview_to_offer_pct}%`}
            sub="of interviewed candidates reach offer"
          />
        </div>
      </section>

      <section aria-labelledby="analytics-funnel" className="grid gap-4 lg:grid-cols-2">
        <h2 id="analytics-funnel" className="sr-only">
          Funnel and sources
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Hiring funnel — where we lose candidates</CardTitle>
          </CardHeader>
          <CardBody>
            <FunnelChart data={funnelData} />
            <ConversionStrip funnel={analytics.funnel} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source breakdown</CardTitle>
            <p className="text-xs text-slate-500">qualified = reached Interview+</p>
          </CardHeader>
          <CardBody>
            {analytics.total_candidates > 0 ? (
              <SourceDonutChart data={sourceData} />
            ) : (
              <EmptyState
                icon="🧭"
                title="No candidates yet"
                hint="Source effectiveness appears once candidates enter the pipeline."
              />
            )}
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="analytics-velocity" className="grid gap-4 lg:grid-cols-2">
        <h2 id="analytics-velocity" className="sr-only">
          Stage velocity and hires
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Average days in current stage</CardTitle>
            <p className="text-xs text-slate-500">active applications only</p>
          </CardHeader>
          <CardBody>
            <TimeInStageChart data={stageTimeData} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hires per month</CardTitle>
            <p className="text-xs text-slate-500">last {MONTHS_SHOWN} months</p>
          </CardHeader>
          <CardBody>
            {totalHiresShown > 0 ? (
              <HiresPerMonthChart data={hiresData} />
            ) : (
              <EmptyState
                icon="🏁"
                title="No hires in this window"
                hint="Placements will chart here as candidates reach Hired."
              />
            )}
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="analytics-activity">
        <h2 id="analytics-activity" className="sr-only">
          Recruiter activity
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Recruiter activity</CardTitle>
            <p className="text-xs text-slate-500">all-time, demo dataset</p>
          </CardHeader>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-card bg-slate-100 sm:grid-cols-3 lg:grid-cols-5">
            <ActivityTile label="Emails sent" value={counts.emails_sent} />
            <ActivityTile label="Notes logged" value={counts.notes_logged} />
            <ActivityTile label="Scorecards submitted" value={counts.scorecards_submitted} />
            <ActivityTile label="Interviews scheduled" value={counts.interviews_scheduled} />
            <ActivityTile label="Stalled right now" value={counts.stalled_now} warning />
          </div>
        </Card>
      </section>
    </div>
  );
}
