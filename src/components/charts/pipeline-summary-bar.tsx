import { PIPELINE_STAGES, STAGE_LABELS, type Stage } from "@/lib/data/types";
import { cn } from "@/components/ui";
import { STAGE_CHART_COLORS } from "./theme";

export interface PipelineSummaryBarProps {
  /** Counts per stage; only the five pipeline stages are rendered. */
  stageCounts: Record<Stage, number>;
  className?: string;
}

/**
 * Segmented pipeline bar — one colored slice per stage, sized by its share of
 * the active pipeline (Applied → Hired), with a per-stage count legend.
 * Pure markup, no chart library: safe to render from Server Components.
 */
export function PipelineSummaryBar({ stageCounts, className }: PipelineSummaryBarProps) {
  const segments = PIPELINE_STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: stageCounts[stage] ?? 0,
    color: STAGE_CHART_COLORS[stage],
  }));
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className={className}>
      <div
        role="img"
        aria-label={
          total === 0
            ? "Pipeline is empty"
            : `Pipeline: ${segments.map((s) => `${s.label} ${s.count}`).join(", ")}`
        }
        className="flex h-3.5 w-full gap-px overflow-hidden rounded-full bg-slate-100"
      >
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.stage}
              title={`${s.label}: ${s.count}`}
              className="h-full"
              style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
            />
          ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        {segments.map((s) => (
          <div key={s.stage} className="min-w-0">
            <dt className="micro-label flex items-center gap-1.5 text-slate-500">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate">{s.label}</span>
            </dt>
            <dd
              className={cn(
                "mt-1 pl-3.5 text-lg font-bold leading-none tabular-nums",
                s.count === 0 ? "text-slate-400" : "text-ink",
              )}
            >
              {s.count}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
