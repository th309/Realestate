/**
 * TrendLineChart
 *
 * Line chart using Recharts with optional compare data and annotations.
 * Colors come from `@/lib/visualizations/chart-theme` — never inline a raw
 * `var(--token)` here, or an unresolvable custom property will silently render
 * the line with `stroke: none`.
 *
 * `height` accepts a pixel number, or a CSS length such as "100%" when the
 * chart should fill a flex/grid parent that already has a definite height.
 */

"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  CHART_AXIS_LINE,
  chartAxisTick,
} from "@/lib/visualizations/chart-theme";

interface DataPoint {
  date: string;
  value: number;
}

interface AnnotationMark {
  date: string;
  label: string;
}

interface TrendLineChartProps {
  data: DataPoint[];
  compareData?: DataPoint[];
  annotations?: AnnotationMark[];
  /** Pixel height, or a CSS length like "100%" to fill the parent. */
  height?: number | string;
}

function formatDateTick(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TrendLineChart({
  data,
  compareData,
  annotations,
  height = 280,
}: TrendLineChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-on-surface-variant"
        style={{ height }}
      >
        No trend data available
      </div>
    );
  }

  // Merge primary and compare data for shared x-axis
  const mergedData = data.map((point, idx) => ({
    date: point.date,
    value: point.value,
    compareValue: compareData?.[idx]?.value ?? undefined,
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={mergedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.grid}
            opacity={0.5}
          />
          <XAxis
            dataKey="date"
            tick={chartAxisTick()}
            tickLine={false}
            axisLine={CHART_AXIS_LINE}
            tickFormatter={formatDateTick}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={chartAxisTick()}
            tickLine={false}
            axisLine={CHART_AXIS_LINE}
            width={48}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelFormatter={formatDateTick}
            formatter={(val: number, name: string) => [
              val.toLocaleString(undefined, { maximumFractionDigits: 2 }),
              name === "compareValue" ? "Previous period" : "Current",
            ]}
          />

          {/* Annotation reference lines */}
          {annotations?.map((ann) => (
            <ReferenceLine
              key={ann.date}
              x={ann.date}
              stroke={CHART_COLORS.reference}
              strokeDasharray="4 4"
              label={{
                value: ann.label,
                position: "insideTopRight",
                fill: CHART_COLORS.axisText,
                fontSize: 10,
              }}
            />
          ))}

          {/* Compare line (rendered first so primary is on top) */}
          {compareData && (
            <Line
              type="monotone"
              dataKey="compareValue"
              stroke={CHART_COLORS.comparisonSeries}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 3, fill: CHART_COLORS.comparisonSeries }}
            />
          )}

          {/* Primary line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.primarySeries}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.primarySeries }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
