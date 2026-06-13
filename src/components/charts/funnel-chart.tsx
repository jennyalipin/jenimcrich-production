"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

export interface FunnelDatum {
  /** Stage display label ("Applied"). */
  label: string;
  /** Applications that reached this stage or further. */
  count: number;
  /** Bar fill (per-stage hue). */
  color: string;
}

export interface FunnelChartProps {
  data: FunnelDatum[];
  height?: number;
}

/** Horizontal hiring-funnel bars — mirrors the prototype's `anFunnel` chart. */
export function FunnelChart({ data, height = 230 }: FunnelChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 18, bottom: 0, left: 0 }}
        barCategoryGap="26%"
      >
        <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={84}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip cursor={CURSOR_FILL} contentStyle={TOOLTIP_CONTENT_STYLE} />
        <Bar
          dataKey="count"
          name="Reached stage"
          radius={[0, 6, 6, 0]}
          maxBarSize={26}
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
