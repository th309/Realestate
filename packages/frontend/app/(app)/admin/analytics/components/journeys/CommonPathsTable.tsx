/**
 * CommonPathsTable
 *
 * Displays the most common multi-page session paths as breadcrumb-style chip
 * sequences. Each row shows the path steps, session count, and conversion rate
 * where available. Rows are clickable for drill-down.
 */

"use client";

import { ChevronRight } from "lucide-react";
import type { PathSequence } from "@/lib/data/fetchers/admin-analytics.types";

interface CommonPathsTableProps {
  paths: PathSequence[];
  onDrillDown?: (key: string, value: string) => void;
}

function PathBreadcrumb({ steps }: { steps: string[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, index) => (
        <span key={index} className="flex items-center gap-1">
          <span
            className="inline-block px-2 py-0.5 rounded bg-surface-container text-xs font-mono text-on-surface border border-outline-variant/50 max-w-[140px] truncate"
            title={step}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <ChevronRight className="w-3 h-3 text-on-surface-variant flex-shrink-0" />
          )}
        </span>
      ))}
    </div>
  );
}

export function CommonPathsTable({
  paths,
  onDrillDown,
}: CommonPathsTableProps) {
  const sortedPaths = [...paths].sort((a, b) => b.sessions - a.sessions);

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant">
        <h3 className="text-sm font-medium text-on-surface">Common Paths</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Most frequent multi-step session journeys
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Path
              </th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                Sessions
              </th>
              <th className="text-right py-2.5 px-4 text-xs font-medium text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                Conv. Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedPaths.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-10 text-center text-xs text-on-surface-variant"
                >
                  No path data available for this period.
                </td>
              </tr>
            ) : (
              sortedPaths.map((pathSeq, index) => (
                <tr
                  key={index}
                  onClick={() =>
                    onDrillDown?.("path", pathSeq.path.join(" → "))
                  }
                  className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <PathBreadcrumb steps={pathSeq.path} />
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-on-surface">
                    {pathSeq.sessions.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-on-surface-variant">
                    {pathSeq.conversionRate != null
                      ? `${(pathSeq.conversionRate * 100).toFixed(1)}%`
                      : "—"}
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
