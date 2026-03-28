"use client";

import { ShieldCheck } from "lucide-react";
import { DashboardCard } from "../shared/DashboardCard";
import { StatusDot } from "../shared/StatusDot";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface HealthSnapshot {
  timestamp: string;
  source_name: string;
  available: boolean;
  fresh: boolean;
  days_since_update: number | null;
  response_time_ms: number | null;
  error_message: string | null;
}

interface DataQualityCardProps {
  refreshTrigger: number;
  onClick: () => void;
}

export function DataQualityCard({
  refreshTrigger,
  onClick,
}: DataQualityCardProps) {
  const { data, isLoading, error } = useAdminTimeSeries<HealthSnapshot[]>(
    "health-history",
    undefined,
    { refreshTrigger },
  );

  const rows = data ?? [];
  // Get latest snapshot per source
  const latestBySource = new Map<string, HealthSnapshot>();
  for (const row of rows) {
    const existing = latestBySource.get(row.source_name);
    if (!existing || row.timestamp > existing.timestamp) {
      latestBySource.set(row.source_name, row);
    }
  }
  const sources = Array.from(latestBySource.values());
  const staleCount = sources.filter((s) => !s.fresh).length;
  const errorCount = sources.filter((s) => !s.available).length;
  const issueCount = staleCount + errorCount;

  return (
    <DashboardCard
      title="Data Quality"
      icon={ShieldCheck}
      badge={{
        text: issueCount === 0 ? "All Clean" : `${issueCount} issues`,
        color:
          issueCount === 0
            ? "bg-green-500/10 text-green-700"
            : errorCount > 0
              ? "bg-red-500/10 text-red-700"
              : "bg-amber-500/10 text-amber-700",
      }}
      loading={isLoading}
      error={error?.message ?? null}
      onClick={onClick}
    >
      {sources.length > 0 ? (
        <div className="space-y-2">
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <StatusDot variant="success" size="sm" />{" "}
              {sources.length - issueCount} clean
            </span>
            {staleCount > 0 && (
              <span className="flex items-center gap-1">
                <StatusDot variant="warning" size="sm" /> {staleCount} stale
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1">
                <StatusDot variant="error" size="sm" /> {errorCount} errors
              </span>
            )}
          </div>
          {issueCount > 0 && (
            <ul className="space-y-1">
              {sources
                .filter((s) => !s.fresh || !s.available)
                .slice(0, 3)
                .map((s) => (
                  <li
                    key={s.source_name}
                    className="flex items-center gap-2 text-xs"
                  >
                    <StatusDot
                      variant={!s.available ? "error" : "warning"}
                      size="sm"
                    />
                    <span className="text-on-surface truncate">
                      {s.source_name}
                    </span>
                    {s.error_message && (
                      <span className="text-on-surface-variant truncate max-w-[120px]">
                        {s.error_message}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">
          No health data available
        </p>
      )}
    </DashboardCard>
  );
}
