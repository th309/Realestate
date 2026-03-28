/**
 * FeatureCorrelationChart
 *
 * Horizontal grouped BarChart. Each feature is a row with two bars:
 *   - Gray bar: non-converter usage rate
 *   - Primary bar: converter usage rate
 * Rows are sorted by signal strength (gap between the two bars) descending.
 * Signal strength is shown as a label on the right.
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { FeatureConvMetric } from "@/lib/data/fetchers/admin-analytics.types";

interface FeatureCorrelationChartProps {
  data: FeatureConvMetric[];
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

export function FeatureCorrelationChart({
  data,
}: FeatureCorrelationChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-on-surface-variant">
        No feature correlation data available
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.signalStrength - a.signalStrength);

  return (
    <div className="space-y-2">
      <p className="text-xs text-on-surface-variant">
        Features sorted by signal strength &mdash; gap between converter and
        non-converter usage rate
      </p>

      <ResponsiveContainer
        width="100%"
        height={Math.max(200, sorted.length * 44)}
      >
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
          barGap={2}
          barCategoryGap="30%"
        >
          <XAxis
            type="number"
            domain={[0, 1]}
            tickFormatter={formatPct}
            tick={{ fontSize: 10, fill: "var(--color-on-surface-variant)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="feature"
            width={110}
            tick={{ fontSize: 11, fill: "var(--color-on-surface-variant)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatPct(value),
              name,
            ]}
            contentStyle={{
              backgroundColor: "var(--color-surface-container-high)",
              border: "1px solid var(--color-outline-variant)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
            iconType="square"
            iconSize={10}
          />

          {/* Non-converter bar (gray) */}
          <Bar
            dataKey="nonConverterRate"
            name="Non-converter rate"
            fill="#94a3b8"
            radius={[0, 3, 3, 0]}
          />

          {/* Converter bar (primary) */}
          <Bar
            dataKey="converterRate"
            name="Converter rate"
            fill="#3949AB"
            radius={[0, 3, 3, 0]}
          >
            <LabelList
              dataKey="signalStrength"
              position="right"
              formatter={(v: number) => `+${formatPct(v)}`}
              style={{
                fontSize: 10,
                fill: "var(--color-primary)",
                fontWeight: 600,
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
