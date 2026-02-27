/**
 * PaywallEffectiveness
 *
 * Data table: Resource | Views | Clicks | CTR | Conversions.
 * Rows are sorted by conversion count descending.
 * CTR is color-coded: green above 5%, amber 2-5%, red below 2%.
 */

"use client";

import type { PaywallMetric } from "@/lib/data/fetchers/admin-analytics.types";

interface PaywallEffectivenessProps {
  data: PaywallMetric[];
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function ctrColorClass(ctr: number): string {
  if (ctr >= 0.05) return "text-green-600 font-medium";
  if (ctr >= 0.02) return "text-amber-600 font-medium";
  return "text-red-600 font-medium";
}

export function PaywallEffectiveness({ data }: PaywallEffectivenessProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-on-surface-variant">
        No paywall effectiveness data available
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.conversions - a.conversions);

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant">
      <table className="w-full text-sm">
        <thead className="bg-surface-container-low">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Resource
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Views
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Clicks
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              CTR
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Conversions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {sorted.map((row) => (
            <tr
              key={row.resource}
              className="hover:bg-surface-container-low transition-colors"
            >
              <td className="px-4 py-3 font-medium text-on-surface max-w-[200px] truncate">
                {row.resource}
              </td>
              <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                {row.views.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                {row.clicks.toLocaleString()}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${ctrColorClass(row.ctr)}`}>
                {formatPercent(row.ctr)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-on-surface tabular-nums">
                {row.conversions.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
