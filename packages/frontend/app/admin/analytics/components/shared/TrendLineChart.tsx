/**
 * TrendLineChart
 *
 * Line chart using Recharts with optional compare data and annotations.
 * Follows the existing codebase pattern for Recharts usage with M3 theming.
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
  height?: number;
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
            stroke="var(--outline-variant)"
            opacity={0.5}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--on-surface-variant)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--outline-variant)" }}
            tickFormatter={formatDateTick}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--on-surface-variant)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--outline-variant)" }}
            width={48}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface-container)",
              border: "1px solid var(--outline-variant)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
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
              stroke="var(--tertiary)"
              strokeDasharray="4 4"
              label={{
                value: ann.label,
                position: "insideTopRight",
                fill: "var(--on-surface-variant)",
                fontSize: 10,
              }}
            />
          ))}

          {/* Compare line (rendered first so primary is on top) */}
          {compareData && (
            <Line
              type="monotone"
              dataKey="compareValue"
              stroke="var(--outline)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 3, fill: "var(--outline)" }}
            />
          )}

          {/* Primary line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--primary)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
