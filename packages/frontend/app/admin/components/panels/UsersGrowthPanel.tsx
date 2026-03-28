"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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

interface UserHistoryEntry {
  timestamp: string;
  total_users: number;
  new_signups: number;
  active_trials: number;
}

interface ChartPoint {
  date: string;
  totalUsers: number;
  newSignups: number;
}

function buildChartData(entries: UserHistoryEntry[]): ChartPoint[] {
  const byDate = new Map<string, { totalUsers: number; newSignups: number }>();
  for (const e of entries) {
    const date = e.timestamp.slice(0, 10);
    const prev = byDate.get(date);
    // Keep latest entry per day for total, sum signups
    byDate.set(date, {
      totalUsers: Math.max(prev?.totalUsers ?? 0, e.total_users),
      newSignups: (prev?.newSignups ?? 0) + e.new_signups,
    });
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));
}

function latestStats(entries: UserHistoryEntry[]) {
  if (!entries.length)
    return { totalUsers: 0, activeTrials: 0, weeklySignups: 0 };
  // Sort descending by timestamp
  const sorted = [...entries].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
  const latest = sorted[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weeklySignups = entries
    .filter((e) => e.timestamp >= weekAgo)
    .reduce((sum, e) => sum + e.new_signups, 0);
  return {
    totalUsers: latest.total_users,
    activeTrials: latest.active_trials,
    weeklySignups,
  };
}

export function UsersGrowthPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<UserHistoryEntry[]>(
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
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Users", value: stats.totalUsers.toLocaleString() },
          {
            label: "Active Trials",
            value: stats.activeTrials.toLocaleString(),
          },
          {
            label: "Weekly Signups",
            value: stats.weeklySignups.toLocaleString(),
          },
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
          Total Users Over Time
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="totalUsers"
              stroke="var(--color-primary)"
              fill="var(--color-primary)"
              fillOpacity={0.2}
              name="Total Users"
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          Daily Signups
        </h3>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="newSignups"
              stroke="#5C6BC0"
              fill="#5C6BC0"
              fillOpacity={0.2}
              name="New Signups"
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
