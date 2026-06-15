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

export interface StageTimeDatum {
  /** Stage display label ("Screening"). */
  label: string;
  /** Average days current applications have sat in the stage. */
  days: number;
}

export interface TimeInStageChartProps {
  data: StageTimeDatum[];
  height?: number;
}

/** Average-days-in-current-stage bars — mirrors the prototype's `anStage` chart. */
export function TimeInStageChart({ data, height = 220 }: TimeInStageChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip cursor={CURSOR_FILL} contentStyle={TOOLTIP_CONTENT_STYLE} />
        <Bar
          dataKey="days"
          name="Avg days"
          unit=" days"
          fill="#059669"
          radius={[6, 6, 0, 0]}
          maxBarSize={52}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
