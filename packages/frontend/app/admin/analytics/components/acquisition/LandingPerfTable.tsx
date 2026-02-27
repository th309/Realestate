/**
 * LandingPerfTable
 *
 * Data table: Landing Page | Sessions | Bounce Rate | Avg Time | Signups | Conv%.
 * Rows are sorted by sessions descending. Bounce rate is color-coded.
 */

"use client";

import type { LandingPerf } from "@/lib/data/fetchers/admin-analytics.types";

interface LandingPerfTableProps {
  data: LandingPerf[];
}

function formatAvgTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function bounceRateClass(rate: number): string {
  if (rate > 0.7) return "text-red-600";
  if (rate > 0.5) return "text-amber-600";
  return "text-green-600";
}

export function LandingPerfTable({ data }: LandingPerfTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-on-surface-variant">
        No landing page performance data available
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.sessions - a.sessions);

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant">
      <table className="w-full text-sm">
        <thead className="bg-surface-container-low">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Landing Page
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Sessions
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Bounce Rate
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Avg Time
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Signups
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Conv%
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {sorted.map((row) => (
            <tr
              key={row.page}
              className="hover:bg-surface-container-low transition-colors"
            >
              <td className="px-4 py-3">
                <span
                  className="font-mono text-xs text-on-surface max-w-[220px] truncate block"
                  title={row.page}
                >
                  {row.page}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                {row.sessions.toLocaleString()}
              </td>
              <td className={`px-4 py-3 text-right font-medium tabular-nums ${bounceRateClass(row.bounceRate)}`}>
                {formatPercent(row.bounceRate)}
              </td>
              <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                {formatAvgTime(row.avgTime)}
              </td>
              <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                {row.signups.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right font-medium text-on-surface tabular-nums">
                {formatPercent(row.conversionRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
