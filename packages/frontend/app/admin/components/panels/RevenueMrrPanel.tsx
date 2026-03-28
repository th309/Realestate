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
} from "recharts";
import type { TimeRange } from "../hooks/useTimeRange";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

interface RevenueEntry {
  timestamp: string;
  mrr_cents: number;
  paywall_views: number;
  conversions: number;
}

interface ChartPoint {
  date: string;
  mrrDollars: number;
}

function formatMrr(cents: number): string {
  const dollars = cents / 100;
  if (dollars < 1000) return `$${dollars.toFixed(0)}`;
  return `$${(dollars / 1000).toFixed(1)}K`;
}

function buildChartData(entries: RevenueEntry[]): ChartPoint[] {
  const byDate = new Map<string, number>();
  for (const e of entries) {
    const date = e.timestamp.slice(0, 10);
    const prev = byDate.get(date) ?? 0;
    byDate.set(date, Math.max(prev, e.mrr_cents));
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cents]) => ({ date, mrrDollars: cents / 100 }));
}

function latestStats(entries: RevenueEntry[]) {
  if (!entries.length) return { mrr: 0, paywallViews: 0, conversions: 0, cvr: 0 };
  const sorted = [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = sorted[0];
  const totalViews = entries.reduce((s, e) => s + e.paywall_views, 0);
  const totalConversions = entries.reduce((s, e) => s + e.conversions, 0);
  return {
    mrr: latest.mrr_cents,
    paywallViews: totalViews,
    conversions: totalConversions,
    cvr: totalViews > 0 ? (totalConversions / totalViews) * 100 : 0,
  };
}

export function RevenueMrrPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<RevenueEntry[]>(
    "user-history",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const chartData = useMemo(() => buildChartData(data ?? []), [data]);
  const stats = useMemo(() => latestStats(data ?? []), [data]);

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
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Latest MRR", value: formatMrr(stats.mrr) },
          { label: "Paywall Views", value: stats.paywallViews.toLocaleString() },
          { label: "Conversions", value: stats.conversions.toLocaleString() },
          { label: "CVR %", value: `${stats.cvr.toFixed(1)}%` },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-surface-container rounded-xl p-3 text-center"
          >
            <p className="text-lg font-semibold text-on-surface">{s.value}</p>
            <p className="text-xs text-on-surface-variant">{s.label}</p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          MRR Trend
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`}
            />
            <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "MRR"]} />
            <Line
              type="monotone"
              dataKey="mrrDollars"
              stroke="var(--color-primary)"
              name="MRR"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
