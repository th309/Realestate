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

interface ComputationRow {
  scoreType: string;
  validated: number;
  pending: number;
  failed: number;
  total: number;
  pctComplete: number;
}

function capitalize(str: string): string {
  return str
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildComputationRows(entries: ScoreHistoryEntry[]): ComputationRow[] {
  const grouped = new Map<string, { validated: number; pending: number; failed: number }>();
  for (const e of entries) {
    const prev = grouped.get(e.score_type) ?? { validated: 0, pending: 0, failed: 0 };
    prev.validated += e.scores_validated;
    grouped.set(e.score_type, prev);
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, stats]) => {
      const total = stats.validated + stats.pending + stats.failed;
      return {
        scoreType: capitalize(type),
        ...stats,
        total,
        pctComplete: total > 0 ? Math.round((stats.validated / total) * 100) : 0,
      };
    });
}

export function ScoreComputationPanel({ timeRange, refreshTrigger }: PanelProps) {
  const { data, isLoading } = useAdminTimeSeries<ScoreHistoryEntry[]>(
    "score-history",
    { from: timeRange.from, to: timeRange.to },
    { refreshTrigger },
  );

  const rows = useMemo(() => buildComputationRows(data ?? []), [data]);

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
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">
          Computation Progress
        </h3>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.scoreType}>
              <div className="flex justify-between text-xs text-on-surface-variant mb-1">
                <span>{r.scoreType}</span>
                <span>{r.pctComplete}%</span>
              </div>
              <div className="h-4 bg-surface-container rounded-full overflow-hidden flex">
                {r.validated > 0 && (
                  <div
                    className="bg-green-500 h-full"
                    style={{ width: `${r.total > 0 ? (r.validated / r.total) * 100 : 0}%` }}
                  />
                )}
                {r.pending > 0 && (
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${r.total > 0 ? (r.pending / r.total) * 100 : 0}%` }}
                  />
                )}
                {r.failed > 0 && (
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${r.total > 0 ? (r.failed / r.total) * 100 : 0}%` }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Validated
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Failed
          </span>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-on-surface mb-3">Summary</h3>
        <div className="border border-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="text-left px-3 py-2 text-on-surface-variant font-medium">Score Type</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Validated</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Pending</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Failed</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">Total</th>
                <th className="text-right px-3 py-2 text-on-surface-variant font-medium">% Complete</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.scoreType} className="border-t border-outline-variant">
                  <td className="px-3 py-2">{r.scoreType}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-600">{r.validated}</td>
                  <td className="px-3 py-2 text-right font-mono text-amber-600">{r.pending}</td>
                  <td className={`px-3 py-2 text-right font-mono ${r.failed > 0 ? "text-red-500 font-semibold" : ""}`}>
                    {r.failed}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.total}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.pctComplete}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
