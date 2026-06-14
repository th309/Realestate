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

interface CacheEntry {
  timestamp: string;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  eviction_count: number;
  memory_used_bytes: number;
  keys_count: number;
}

interface HitRatePoint {
  time: string;
  hitRate: number;
}

interface MemoryPoint {
  time: string;
  memoryMB: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CachePerformancePanel({
  timeRange,
  refreshTrigger,
}: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<CacheEntry[]>(
    "cache-performance",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const hitRateData = useMemo<HitRatePoint[]>(
    () =>
      (data ?? [])
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((e) => ({
          time: e.timestamp.slice(5, 16),
          hitRate: Math.round(e.hit_rate * 100) / 100,
        })),
    [data],
  );

  const memoryData = useMemo<MemoryPoint[]>(
    () =>
      (data ?? [])
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((e) => ({
          time: e.timestamp.slice(5, 16),
          memoryMB:
            Math.round((e.memory_used_bytes / (1024 * 1024)) * 100) / 100,
        })),
    [data],
  );

  const latest = data?.length ? data[data.length - 1] : null;
  const totalEvictions = useMemo(
    () => (data ?? []).reduce((sum, e) => sum + e.eviction_count, 0),
    [data],
  );

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
        <h3 className="text-sm font-medium text-on-surface mb-3">Hit Rate %</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={hitRateData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="hitRate"
              stroke="var(--color-primary)"
              dot={false}
              name="Hit Rate %"
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          Memory Usage
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={memoryData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" MB" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="memoryMB"
              stroke="#5C6BC0"
              dot={false}
              name="Memory (MB)"
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">Summary</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-container rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-on-surface-variant">Total Keys</p>
            <p className="text-lg font-semibold font-mono">
              {latest?.keys_count.toLocaleString() ?? "—"}
            </p>
          </div>
          <div className="bg-surface-container rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-on-surface-variant">Memory Used</p>
            <p className="text-lg font-semibold font-mono">
              {latest ? formatBytes(latest.memory_used_bytes) : "—"}
            </p>
          </div>
          <div className="bg-surface-container rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-on-surface-variant">Evictions</p>
            <p className="text-lg font-semibold font-mono">
              {totalEvictions.toLocaleString()}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
