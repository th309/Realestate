"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { TimeRange } from "../hooks/useTimeRange";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

interface ScoreHistoryEntry {
  timestamp: string;
  score_type: string;
  correlation_1y: number | null;
  hit_rate_1y: number | null;
  scores_validated: number;
}

interface ChartPoint {
  date: string;
  hitRate: number | null;
  correlation: number | null;
}

function buildChartData(entries: ScoreHistoryEntry[]): ChartPoint[] {
  const byDate = new Map<
    string,
    { hitRates: number[]; correlations: number[] }
  >();
  for (const e of entries) {
    const date = e.timestamp.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, { hitRates: [], correlations: [] });
    const bucket = byDate.get(date)!;
    if (e.hit_rate_1y != null) bucket.hitRates.push(e.hit_rate_1y);
    if (e.correlation_1y != null) bucket.correlations.push(e.correlation_1y);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { hitRates, correlations }]) => ({
      date,
      hitRate: hitRates.length
        ? Math.round(hitRates.reduce((s, v) => s + v, 0) / hitRates.length)
        : null,
      correlation: correlations.length
        ? Math.round(
            correlations.reduce((s, v) => s + v, 0) / correlations.length,
          )
        : null,
    }));
}

export function ScoreHealthPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<ScoreHistoryEntry[]>(
    "score-history",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const chartData = useMemo(() => buildChartData(data ?? []), [data]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-surface-container rounded-xl" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-on-surface-variant">No data recorded yet</p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-on-surface mb-3">
        Score Validation Trends
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="hitRate"
            stroke="var(--color-primary)"
            name="Hit Rate %"
            connectNulls
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="correlation"
            stroke="#5C6BC0"
            name="Correlation %"
            connectNulls
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
