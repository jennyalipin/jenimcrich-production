"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TooltipContentProps } from "recharts";
import { sourceColor } from "./theme";

export interface SourceDatum {
  source: string;
  /** Candidates from this source. */
  total: number;
  /** Candidates who reached Interview stage or beyond. */
  qualified: number;
}

interface ColoredSourceDatum extends SourceDatum {
  color: string;
}

function DonutTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload as ColoredSourceDatum | undefined;
  if (!datum) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-raised">
      <div className="font-semibold text-slate-900">{datum.source}</div>
      <div className="mt-0.5 text-slate-600">
        {datum.total} candidate{datum.total === 1 ? "" : "s"} · {datum.qualified} qualified
      </div>
    </div>
  );
}

export interface SourceDonutChartProps {
  data: SourceDatum[];
  /** Diameter of the donut in px. */
  size?: number;
}

/**
 * Source-breakdown donut (share of candidates per source) with a count legend
 * that also carries each source's qualified number (reached Interview+).
 */
export function SourceDonutChart({ data, size = 184 }: SourceDonutChartProps) {
  const withColor: ColoredSourceDatum[] = data.map((d, i) => ({ ...d, color: sourceColor(i) }));
  const slices = withColor.filter((d) => d.total > 0);
  const total = withColor.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Tooltip content={DonutTooltip} />
            <Pie
              data={slices}
              dataKey="total"
              nameKey="source"
              innerRadius="64%"
              outerRadius="94%"
              paddingAngle={2}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {slices.map((d) => (
                <Cell key={d.source} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none text-slate-900">{total}</span>
          <span className="micro-label mt-1 text-slate-500">candidates</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {withColor.map((d) => (
          <li key={d.source} className="flex items-center gap-2 text-[13px]">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="min-w-0 flex-1 truncate text-slate-600">{d.source}</span>
            <span className="font-semibold tabular-nums text-slate-900">{d.total}</span>
            <span className="w-20 text-right text-xs tabular-nums text-slate-400">
              {d.qualified} qualified
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
