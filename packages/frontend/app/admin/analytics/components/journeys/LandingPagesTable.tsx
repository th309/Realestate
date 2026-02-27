/**
 * LandingPagesTable
 *
 * Displays the top landing pages with session count, bounce rate, and
 * average session duration. Clickable rows emit a drill-down event.
 */

"use client";

import type { LandingPageMetric } from "@/lib/data/fetchers/admin-analytics.types";

interface LandingPagesTableProps {
  pages: LandingPageMetric[];
  onDrillDown?: (key: string, value: string) => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function BounceRatePill({ rate }: { rate: number }) {
  const percent = (rate * 100).toFixed(1);
  const isHigh = rate > 0.6;
  const isMedium = rate > 0.4;

  const colorClass = isHigh
    ? "bg-error/10 text-error"
    : isMedium
      ? "bg-warning/10 text-warning"
      : "bg-tertiary/10 text-tertiary";

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
    >
      {percent}%
    </span>
  );
}

export function LandingPagesTable({
  pages,
  onDrillDown,
}: LandingPagesTableProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant">
        <h3 className="text-sm font-medium text-on-surface">Landing Pages</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          First pages visited per session
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Page
              </th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Sessions
              </th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Bounce Rate
              </th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Avg Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-10 text-center text-xs text-on-surface-variant"
                >
                  No landing page data available.
                </td>
              </tr>
            ) : (
              pages.map((page) => (
                <tr
                  key={page.page}
                  onClick={() => onDrillDown?.("page", page.page)}
                  className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <td
                    className="py-3 px-4 font-mono text-xs text-on-surface max-w-[180px] truncate"
                    title={page.page}
                  >
                    {page.page}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-on-surface">
                    {page.sessions.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <BounceRatePill rate={page.bounceRate} />
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-on-surface-variant">
                    {formatDuration(page.avgDuration)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
