"use client";

import { useMemo } from "react";
import type { TimeRange } from "../hooks/useTimeRange";
import { useAdminTimeSeries } from "../hooks/useAdminTimeSeries";

interface PanelProps {
  timeRange: TimeRange;
  refreshTrigger: number;
}

interface ScoreHistoryEntry {
  timestamp: string;
  score_type: string;
  correlation_1y: number | null;
  hit_rate_1y: number | null;
  scores_validated: number;
}

interface ModelRow {
  scoreType: string;
  correlation: number | null;
  hitRate: number | null;
  validated: number;
  pending: number;
  failed: number;
}

function capitalize(str: string): string {
  return str
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildModelRows(entries: ScoreHistoryEntry[]): ModelRow[] {
  const latest = new Map<string, ScoreHistoryEntry>();
  for (const e of entries) {
    const prev = latest.get(e.score_type);
    if (!prev || e.timestamp > prev.timestamp) latest.set(e.score_type, e);
  }
  return Array.from(latest.values())
    .sort((a, b) => a.score_type.localeCompare(b.score_type))
    .map((e) => ({
      scoreType: capitalize(e.score_type),
      correlation: e.correlation_1y,
      hitRate: e.hit_rate_1y,
      validated: e.scores_validated,
      pending: 0,
      failed: 0,
    }));
}

export function MlOpsPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<ScoreHistoryEntry[]>(
    "score-history",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const rows = useMemo(() => buildModelRows(data ?? []), [data]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-surface-container rounded-xl" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-on-surface-variant">No data recorded yet</p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-on-surface mb-3">
        Score Models
      </h3>
      <div className="border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-container">
            <tr>
              <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Score Type</th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Correlation</th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Hit Rate</th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Validated</th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Pending</th>
              <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Failed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.scoreType} className="border-t border-outline-variant">
                <td className="px-3 py-2">{r.scoreType}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.correlation != null ? `${r.correlation}%` : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {r.hitRate != null ? `${r.hitRate}%` : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono">{r.validated}</td>
                <td className="px-3 py-2 text-right font-mono">{r.pending}</td>
                <td className={`px-3 py-2 text-right font-mono ${r.failed > 0 ? "text-red-500 font-semibold" : ""}`}>
                  {r.failed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
