"use client";

import { HardDrive } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { SparklineChart } from "../shared/SparklineChart";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface CacheMetricRow {
  timestamp: string;
  hit_count: number;
  miss_count: number;
  hit_rate: number;
  eviction_count: number;
  memory_used_bytes: number;
  keys_count: number;
}

interface CachePerformanceCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function CachePerformanceCard({
  refreshTrigger,
  onClick,
}: CachePerformanceCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<CacheMetricRow[]>(
    "cache-performance",
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  const hitRateSparkline = rows.map((r) => r.hit_rate * 100);

  const hitRatePct = latest ? (latest.hit_rate * 100).toFixed(1) : "\u2014";
  const badgeColor = latest
    ? latest.hit_rate >= 0.9
      ? "bg-green-500/10 text-green-700"
      : latest.hit_rate >= 0.7
        ? "bg-amber-500/10 text-amber-700"
        : "bg-red-500/10 text-red-700"
    : "bg-surface-container text-on-surface-variant";

  return (
    <DashboardCard
      title="Cache Performance"
      icon={HardDrive}
      badge={
        latest ? { text: `${hitRatePct}% hit`, color: badgeColor } : undefined
      }
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {latest ? (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-on-surface-variant">Hit Rate</div>
              <div className="text-lg font-semibold text-on-surface font-mono">
                {hitRatePct}
                <span className="text-xs text-on-surface-variant font-normal">
                  %
                </span>
              </div>
            </div>
            <SparklineChart
              data={hitRateSparkline.slice(-20)}
              width={80}
              height={24}
            />
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span>{latest.keys_count.toLocaleString()} keys</span>
            <span>{formatBytes(latest.memory_used_bytes)}</span>
            <span>{latest.eviction_count} evictions</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No cache metrics recorded
        </p>
      )}
    </DashboardCard>
  );
}
