/**
 * ExitPagesTable
 *
 * Displays exit pages sorted by exit count with a share-of-exits bar.
 * Clickable rows emit a drill-down event to filter the rest of the dashboard.
 */

"use client";

import type { ExitPageMetric } from "@/lib/data/fetchers/admin-analytics.types";

interface ExitPagesTableProps {
  pages: ExitPageMetric[];
  onDrillDown?: (key: string, value: string) => void;
}

function ExitShareBar({ share }: { share: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-surface-container rounded-full h-1.5 min-w-[60px]">
        <div
          className="h-1.5 rounded-full bg-primary/60"
          style={{ width: `${Math.min(share * 100, 100).toFixed(1)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-on-surface-variant w-10 text-right">
        {(share * 100).toFixed(1)}%
      </span>
    </div>
  );
}

export function ExitPagesTable({ pages, onDrillDown }: ExitPagesTableProps) {
  const totalExits = pages.reduce((sum, p) => sum + p.exits, 0);

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant">
        <h3 className="text-sm font-medium text-on-surface">Exit Pages</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Last pages visited before leaving
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Exit Page
              </th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Exits
              </th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider min-w-[120px]">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-10 text-center text-xs text-on-surface-variant"
                >
                  No exit page data available.
                </td>
              </tr>
            ) : (
              pages.map((page) => {
                const share = totalExits > 0 ? page.exits / totalExits : 0;

                return (
                  <tr
                    key={page.page}
                    onClick={() => onDrillDown?.("exitPage", page.page)}
                    className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    <td
                      className="py-3 px-4 font-mono text-xs text-on-surface max-w-[200px] truncate"
                      title={page.page}
                    >
                      {page.page}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-on-surface">
                      {page.exits.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <ExitShareBar share={share} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
