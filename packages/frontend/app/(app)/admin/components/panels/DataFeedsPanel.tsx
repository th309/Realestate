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
import { StatusDot } from "../shared/StatusDot";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

interface HealthEntry {
  timestamp: string;
  source_name: string;
  available: boolean;
  fresh: boolean;
  days_since_update: number | null;
  response_time_ms: number | null;
}

interface DailyPoint {
  date: string;
  fresh: number;
  total: number;
}

interface SourceRow {
  source_name: string;
  available: boolean;
  fresh: boolean;
  days_since_update: number | null;
  response_time_ms: number | null;
}

function aggregateByDay(entries: HealthEntry[]): DailyPoint[] {
  const map = new Map<string, { fresh: Set<string>; total: Set<string> }>();
  for (const e of entries) {
    const date = e.timestamp.slice(0, 10);
    if (!map.has(date)) map.set(date, { fresh: new Set(), total: new Set() });
    const bucket = map.get(date)!;
    bucket.total.add(e.source_name);
    if (e.fresh) bucket.fresh.add(e.source_name);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { fresh, total }]) => ({
      date,
      fresh: fresh.size,
      total: total.size,
    }));
}

function latestPerSource(entries: HealthEntry[]): SourceRow[] {
  const map = new Map<string, HealthEntry>();
  for (const e of entries) {
    const prev = map.get(e.source_name);
    if (!prev || e.timestamp > prev.timestamp) map.set(e.source_name, e);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.source_name.localeCompare(b.source_name),
  );
}

export function DataFeedsPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<HealthEntry[]>(
    "health-history",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const chartData = useMemo(() => aggregateByDay(data ?? []), [data]);
  const sources = useMemo(() => latestPerSource(data ?? []), [data]);

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
      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          Freshness Timeline
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-outline)"
              fill="var(--color-outline)"
              fillOpacity={0.15}
              name="Total Sources"
            />
            <Area
              type="monotone"
              dataKey="fresh"
              stroke="var(--color-primary)"
              fill="var(--color-primary)"
              fillOpacity={0.25}
              name="Fresh Sources"
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          Source Status
        </h3>
        <div className="border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="text-left px-3 py-2 text-on-surface-variant font-medium">
                  Source
                </th>
                <th className="text-center px-3 py-2 text-on-surface-variant font-medium">
                  Status
                </th>
                <th className="text-center px-3 py-2 text-on-surface-variant font-medium">
                  Fresh
                </th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">
                  Days Old
                </th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">
                  Response
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr
                  key={s.source_name}
                  className="border-t border-outline-variant"
                >
                  <td className="px-3 py-2">{s.source_name}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusDot variant={s.available ? "success" : "error"} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusDot variant={s.fresh ? "success" : "warning"} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.days_since_update ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.response_time_ms != null
                      ? `${s.response_time_ms}ms`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
