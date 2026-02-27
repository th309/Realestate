/**
 * AttributionTable
 *
 * Data table: Source | Visitors | Signups | Trials | Paid | Conv% | ARPU.
 * Best-converting source row is highlighted with a subtle primary tint.
 */

"use client";

import type { AttributionRow } from "@/lib/data/fetchers/admin-analytics.types";

interface AttributionTableProps {
  data: AttributionRow[];
}

function formatCurrency(value: number | undefined): string {
  if (value == null) return "\u2014";
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function AttributionTable({ data }: AttributionTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-on-surface-variant">
        No attribution data available
      </div>
    );
  }

  const bestSourceIndex = data.reduce(
    (bestIdx, row, idx) =>
      row.conversionRate > data[bestIdx].conversionRate ? idx : bestIdx,
    0,
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant">
      <table className="w-full text-sm">
        <thead className="bg-surface-container-low">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Source
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Visitors
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Signups
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Trials
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Paid
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              Conv%
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-on-surface-variant uppercase tracking-wide">
              ARPU
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {data.map((row, idx) => {
            const isBest = idx === bestSourceIndex;
            return (
              <tr
                key={row.source}
                className={`transition-colors ${
                  isBest
                    ? "bg-primary/5"
                    : "hover:bg-surface-container-low"
                }`}
              >
                <td className="px-4 py-3 font-medium text-on-surface">
                  <div className="flex items-center gap-2">
                    {row.source}
                    {isBest && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        Best
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                  {row.visitors.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                  {row.signups.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                  {row.trials.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                  {row.paid.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium text-on-surface tabular-nums">
                  {formatPercent(row.conversionRate)}
                </td>
                <td className="px-4 py-3 text-right text-on-surface-variant tabular-nums">
                  {formatCurrency(row.arpu)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
