/**
 * Usage Summary Table
 *
 * Displays aggregated AI usage log data per test run:
 * cost, tokens, duration, success rate.
 */

"use client";

import type { UsageSummary } from "@/lib/data/fetchers/ai-models";

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function UsageSummaryTable({ data }: { data: UsageSummary[] }) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-on-surface-variant text-sm">
        No test runs recorded yet. Set a Test Run ID above, then generate
        reports.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-container text-on-surface-variant text-left">
            <th className="px-4 py-3 font-medium">Test Run ID</th>
            <th className="px-4 py-3 font-medium">Model</th>
            <th className="px-4 py-3 font-medium text-right">Cost</th>
            <th className="px-4 py-3 font-medium text-right">Calls</th>
            <th className="px-4 py-3 font-medium text-right">Tokens</th>
            <th className="px-4 py-3 font-medium text-right">Avg Duration</th>
            <th className="px-4 py-3 font-medium text-right">Success</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const successRate =
              row.total_calls > 0
                ? Math.round((row.successful_calls / row.total_calls) * 100)
                : 0;
            return (
              <tr
                key={row.test_run_id}
                className="border-t border-outline-variant hover:bg-surface-container-low transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-primary">
                  {row.test_run_id}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-on-surface">
                    {row.model}
                  </span>
                  <span className="text-on-surface-variant ml-1 text-xs">
                    ({row.provider})
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-on-surface">
                  {formatCost(row.total_cost_usd)}
                </td>
                <td className="px-4 py-3 text-right text-on-surface-variant">
                  {row.total_calls}
                </td>
                <td className="px-4 py-3 text-right text-on-surface-variant">
                  {formatTokens(row.total_tokens)}
                </td>
                <td className="px-4 py-3 text-right text-on-surface-variant">
                  {formatDuration(row.avg_duration_ms)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`font-medium ${
                      successRate === 100
                        ? "text-green-600"
                        : successRate >= 80
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {successRate}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
