"use client";

import { Activity } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { SparklineChart } from "../shared/SparklineChart";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface ApiMetricRow {
  timestamp: string;
  endpoint: string;
  p50_ms: number;
  p95_ms: number;
  request_count: number;
  error_count: number;
  error_rate: number;
}

interface ApiPerformanceCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function ApiPerformanceCard({
  refreshTrigger,
  onClick,
}: ApiPerformanceCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<ApiMetricRow[]>(
    "api-performance",
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  const latestRows = rows.slice(-10);
  const avgP50 =
    latestRows.length > 0
      ? Math.round(
          latestRows.reduce((sum, r) => sum + r.p50_ms, 0) / latestRows.length,
        )
      : 0;
  const avgP95 =
    latestRows.length > 0
      ? Math.round(
          latestRows.reduce((sum, r) => sum + r.p95_ms, 0) / latestRows.length,
        )
      : 0;
  const totalErrors = latestRows.reduce((sum, r) => sum + r.error_count, 0);
  const totalRequests = latestRows.reduce((sum, r) => sum + r.request_count, 0);
  const errorRate =
    totalRequests > 0
      ? ((totalErrors / totalRequests) * 100).toFixed(1)
      : "0.0";

  const sparklineData = rows.map((r) => r.p50_ms);

  const badgeColor =
    Number(errorRate) > 5
      ? "bg-red-500/10 text-red-700"
      : Number(errorRate) > 1
        ? "bg-amber-500/10 text-amber-700"
        : "bg-green-500/10 text-green-700";

  return (
    <DashboardCard
      title="API Performance"
      icon={Activity}
      badge={
        rows.length > 0
          ? { text: `${errorRate}% err`, color: badgeColor }
          : undefined
      }
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {rows.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-on-surface-variant">p50 / p95</div>
              <div className="text-lg font-semibold text-on-surface font-mono">
                {avgP50}
                <span className="text-xs text-on-surface-variant font-normal">
                  ms
                </span>
                {" / "}
                {avgP95}
                <span className="text-xs text-on-surface-variant font-normal">
                  ms
                </span>
              </div>
            </div>
            <SparklineChart
              data={sparklineData.slice(-20)}
              width={80}
              height={24}
            />
          </div>
          <div className="text-xs text-on-surface-variant">
            {totalRequests.toLocaleString()} requests &middot; {totalErrors}{" "}
            errors
          </div>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No API metrics recorded
        </p>
      )}
    </DashboardCard>
  );
}
