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

interface PerfEntry {
  timestamp: string;
  endpoint: string;
  p50_ms: number;
  p95_ms: number;
  request_count: number;
  error_count: number;
  error_rate: number;
}

interface ChartPoint {
  time: string;
  p50: number;
  p95: number;
}

interface EndpointAggregate {
  endpoint: string;
  requests: number;
  p95Avg: number;
  errorPct: number;
}

function buildChartData(entries: PerfEntry[]): ChartPoint[] {
  const map = new Map<
    string,
    { p50Sum: number; p95Sum: number; count: number }
  >();
  for (const e of entries) {
    const time = e.timestamp.slice(0, 16); // group to minute
    const prev = map.get(time) ?? { p50Sum: 0, p95Sum: 0, count: 0 };
    prev.p50Sum += e.p50_ms;
    prev.p95Sum += e.p95_ms;
    prev.count += 1;
    map.set(time, prev);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, v]) => ({
      time: time.slice(5), // trim year
      p50: Math.round(v.p50Sum / v.count),
      p95: Math.round(v.p95Sum / v.count),
    }));
}

function aggregateEndpoints(entries: PerfEntry[]): EndpointAggregate[] {
  const map = new Map<
    string,
    { requests: number; p95Sum: number; errors: number; count: number }
  >();
  for (const e of entries) {
    const prev = map.get(e.endpoint) ?? {
      requests: 0,
      p95Sum: 0,
      errors: 0,
      count: 0,
    };
    prev.requests += e.request_count;
    prev.p95Sum += e.p95_ms;
    prev.errors += e.error_count;
    prev.count += 1;
    map.set(e.endpoint, prev);
  }
  return Array.from(map.entries())
    .map(([endpoint, v]) => ({
      endpoint,
      requests: v.requests,
      p95Avg: Math.round(v.p95Sum / v.count),
      errorPct: v.requests > 0 ? (v.errors / v.requests) * 100 : 0,
    }))
    .sort((a, b) => b.requests - a.requests);
}

export function ApiPerformancePanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<PerfEntry[]>(
    "api-performance",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const chartData = useMemo(() => buildChartData(data ?? []), [data]);
  const endpoints = useMemo(() => aggregateEndpoints(data ?? []), [data]);

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
          Latency Trend
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="ms" />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="p50"
              stroke="var(--color-primary)"
              dot={false}
              name="p50"
            />
            <Line
              type="monotone"
              dataKey="p95"
              stroke="#ef4444"
              dot={false}
              name="p95"
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          Per-Endpoint Breakdown
        </h3>
        <div className="border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="text-left px-3 py-2 text-on-surface-variant font-medium">
                  Endpoint
                </th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">
                  Requests
                </th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">
                  p95 Avg
                </th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">
                  Error %
                </th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep) => (
                <tr
                  key={ep.endpoint}
                  className="border-t border-outline-variant"
                >
                  <td className="px-3 py-2 font-mono text-xs">{ep.endpoint}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {ep.requests.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {ep.p95Avg}ms
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className={ep.errorPct > 5 ? "text-red-500" : ""}>
                      {ep.errorPct.toFixed(1)}%
                    </span>
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
