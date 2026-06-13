/**
 * Shared visual constants for chart components.
 *
 * Plain data only — no React, no recharts — so Server Components (e.g. the
 * dashboard's pipeline summary bar) and "use client" charts can both import it.
 * Palettes mirror the prototype's Chart.js colors exactly.
 */

import type { Stage } from "@/lib/data/types";

/** Per-stage hues: slate → blue → cyan → amber → emerald; red is the exit. */
export const STAGE_CHART_COLORS: Record<Stage, string> = {
  applied: "#94a3b8",
  screening: "#3b82f6",
  interview: "#0891b2",
  offer: "#f59e0b",
  hired: "#10b981",
  rejected: "#ef4444",
};

/** Source palette, same order the prototype's source doughnut uses. */
export const SOURCE_CHART_COLORS: readonly string[] = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#0891b2",
  "#64748b",
];

export function sourceColor(index: number): string {
  return SOURCE_CHART_COLORS[index % SOURCE_CHART_COLORS.length] ?? "#64748b";
}

/** Slate axis text shared by all cartesian charts. */
export const AXIS_TICK = { fontSize: 12, fill: "#64748b" } as const;
export const AXIS_LINE = { stroke: "#e2e8f0" } as const;
export const GRID_STROKE = "#e2e8f0";
export const CURSOR_FILL = { fill: "rgba(148, 163, 184, 0.14)" } as const;

/** Card-matching chrome for the default recharts tooltip. */
export const TOOLTIP_CONTENT_STYLE = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgb(15 23 42 / 0.1)",
  fontSize: 12,
  padding: "8px 10px",
} as const;
