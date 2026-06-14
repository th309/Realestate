"use client";

import { useMemo } from "react";
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
  error_message: string | null;
}

interface IssueRow {
  sourceName: string;
  issue: "Stale" | "Unavailable";
  daysOld: number | null;
  errorMessage: string | null;
  lastCheck: string;
}

function buildIssueRows(entries: HealthEntry[]): IssueRow[] {
  // Get latest entry per source
  const latest = new Map<string, HealthEntry>();
  for (const e of entries) {
    const prev = latest.get(e.source_name);
    if (!prev || e.timestamp > prev.timestamp) latest.set(e.source_name, e);
  }
  // Filter to sources with issues
  return Array.from(latest.values())
    .filter((e) => !e.fresh || !e.available)
    .sort((a, b) => a.source_name.localeCompare(b.source_name))
    .map((e) => ({
      sourceName: e.source_name,
      issue: !e.available ? "Unavailable" : "Stale",
      daysOld: e.days_since_update,
      errorMessage: e.error_message,
      lastCheck: e.timestamp,
    }));
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DataQualityPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<HealthEntry[]>(
    "health-history",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const issues = useMemo(() => buildIssueRows(data ?? []), [data]);

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

  if (!issues.length) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-green-600 font-medium">All sources healthy</p>
        <p className="text-xs text-on-surface-variant mt-1">
          No freshness or availability issues detected
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-on-surface mb-3">
        Data Quality Issues ({issues.length})
      </h3>
      <div className="border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container">
            <tr>
              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Source</th>
              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Issue</th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Days Old</th>
              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Error</th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Last Check</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((row) => (
              <tr key={row.sourceName} className="border-t border-outline-variant">
                <td className="px-3 py-2">{row.sourceName}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot
                      variant={row.issue === "Unavailable" ? "error" : "warning"}
                    />
                    {row.issue}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {row.daysOld ?? "—"}
                </td>
                <td className="px-3 py-2 text-on-surface-variant truncate max-w-[200px]">
                  {row.errorMessage ?? "—"}
                </td>
                <td className="px-3 py-2 text-right text-on-surface-variant whitespace-nowrap">
                  {formatTimestamp(row.lastCheck)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
