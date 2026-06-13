"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_LINE,
  AXIS_TICK,
  CURSOR_FILL,
  GRID_STROKE,
  TOOLTIP_CONTENT_STYLE,
} from "./theme";

export interface HiresDatum {
  /** Month label ("Mar"). */
  label: string;
  hires: number;
}

export interface HiresPerMonthChartProps {
  data: HiresDatum[];
  height?: number;
}

/** Monthly placements, emerald bars (the agency's "win" color). */
export function HiresPerMonthChart({ data, height = 220 }: HiresPerMonthChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip cursor={CURSOR_FILL} contentStyle={TOOLTIP_CONTENT_STYLE} />
        <Bar
          dataKey="hires"
          name="Hires"
          fill="#10b981"
          radius={[6, 6, 0, 0]}
          maxBarSize={52}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
