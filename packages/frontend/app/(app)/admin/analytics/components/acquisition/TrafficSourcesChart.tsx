/**
 * TrafficSourcesChart
 *
 * Horizontal BarChart showing visitor breakdown by traffic source.
 * Bars are colored by entry type. Percentage labels rendered inline.
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { SourceMetric } from "@/lib/data/fetchers/admin-analytics.types";

interface TrafficSourcesChartProps {
  data: SourceMetric[];
}

const ENTRY_TYPE_COLORS: Record<string, string> = {
  direct: "#3949AB",
  organic: "#22c55e",
  utm: "#3b82f6",
  email: "#f59e0b",
  referral: "#ec4899",
  social: "#14b8a6",
};

function getEntryColor(entryType: string): string {
  return ENTRY_TYPE_COLORS[entryType.toLowerCase()] ?? "#94a3b8";
}

export function TrafficSourcesChart({ data }: TrafficSourcesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-on-surface-variant">
        No traffic source data available
      </div>
    );
  }

  const chartData = [...data].sort((a, b) => b.sessions - a.sessions);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {Object.entries(ENTRY_TYPE_COLORS).map(([type, color]) => {
          const hasType = data.some((d) => d.entryType.toLowerCase() === type);
          if (!hasType) return null;
          return (
            <div
              key={type}
              className="flex items-center gap-1.5 text-xs text-on-surface-variant"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </div>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 60, left: 8, bottom: 4 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="source"
            width={90}
            tick={{ fontSize: 12, fill: "var(--color-on-surface-variant)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number, _name: string, props) => [
              `${value.toLocaleString()} sessions (${props.payload?.percentage ?? 0}%)`,
              "Traffic",
            ]}
            contentStyle={{
              backgroundColor: "var(--color-surface-container-high)",
              border: "1px solid var(--color-outline-variant)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.source} fill={getEntryColor(entry.entryType)} />
            ))}
            <LabelList
              dataKey="percentage"
              position="right"
              formatter={(v: number) => `${v}%`}
              style={{ fontSize: 11, fill: "var(--color-on-surface-variant)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="text-xs text-on-surface-variant text-right">
        Total: {data.reduce((sum, d) => sum + d.sessions, 0).toLocaleString()}{" "}
        sessions
      </div>
    </div>
  );
}
