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
  Legend,
} from "recharts";
import type { TimeRange } from "../hooks/useTimeRange";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

interface TierEntry {
  timestamp: string;
  tier_free: number;
  tier_starter: number;
  tier_pro: number;
  tier_enterprise: number;
}

interface ChartPoint {
  date: string;
  Free: number;
  Starter: number;
  Pro: number;
  Enterprise: number;
}

const TIER_COLORS = {
  Free: "#a1a1aa", // zinc-400
  Starter: "#3b82f6", // blue-500
  Pro: "#5C6BC0", // indigo (brand)
  Enterprise: "#f59e0b", // amber-500
} as const;

function buildChartData(entries: TierEntry[]): ChartPoint[] {
  const byDate = new Map<string, ChartPoint>();
  for (const e of entries) {
    const date = e.timestamp.slice(0, 10);
    byDate.set(date, {
      date,
      Free: e.tier_free,
      Starter: e.tier_starter,
      Pro: e.tier_pro,
      Enterprise: e.tier_enterprise,
    });
  }
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

function latestTierCounts(entries: TierEntry[]) {
  if (!entries.length) return { Free: 0, Starter: 0, Pro: 0, Enterprise: 0 };
  const sorted = [...entries].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
  const l = sorted[0];
  return {
    Free: l.tier_free,
    Starter: l.tier_starter,
    Pro: l.tier_pro,
    Enterprise: l.tier_enterprise,
  };
}

export function TierDistributionPanel({
  timeRange,
  refreshTrigger,
}: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<TierEntry[]>(
    "user-history",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const chartData = useMemo(() => buildChartData(data ?? []), [data]);
  const counts = useMemo(() => latestTierCounts(data ?? []), [data]);

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
        {(Object.entries(counts) as [keyof typeof TIER_COLORS, number][]).map(
          ([tier, count]) => (
            <div
              key={tier}
              className="bg-surface-container rounded-xl p-3 text-center"
            >
              <p className="text-lg font-semibold text-on-surface">
                {count.toLocaleString()}
              </p>
              <p className="text-xs text-on-surface-variant flex items-center justify-center gap-1">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: TIER_COLORS[tier] }}
                />
                {tier}
              </p>
            </div>
          ),
        )}
      </div>

      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          Tier Composition Over Time
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="Enterprise"
              stackId="1"
              stroke={TIER_COLORS.Enterprise}
              fill={TIER_COLORS.Enterprise}
              fillOpacity={0.7}
            />
            <Area
              type="monotone"
              dataKey="Pro"
              stackId="1"
              stroke={TIER_COLORS.Pro}
              fill={TIER_COLORS.Pro}
              fillOpacity={0.7}
            />
            <Area
              type="monotone"
              dataKey="Starter"
              stackId="1"
              stroke={TIER_COLORS.Starter}
              fill={TIER_COLORS.Starter}
              fillOpacity={0.7}
            />
            <Area
              type="monotone"
              dataKey="Free"
              stackId="1"
              stroke={TIER_COLORS.Free}
              fill={TIER_COLORS.Free}
              fillOpacity={0.7}
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
