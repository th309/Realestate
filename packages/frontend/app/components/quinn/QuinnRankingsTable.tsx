'use client';

import type { QuinnRankingsData } from './QuinnStructuredData.types';

function formatScore(v: number | undefined): string {
  if (v == null) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function formatPct(v: number | undefined): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

export function QuinnRankingsTable({ data }: { data: QuinnRankingsData }) {
  const { title, direction, items } = data;
  const hasScore = items.some((i) => i.score != null);
  const hasAppreciation = items.some((i) => i.appreciation != null);
  const label = direction === 'bottom' ? 'Bottom' : 'Top';

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-surface-container-high text-on-surface font-medium text-sm border-b border-outline-variant">
          {title}
        </div>
      )}
      <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-container-high text-on-surface-variant">
            <tr>
              <th className="text-left px-4 py-2 font-medium w-10">#</th>
              <th className="text-left px-4 py-2 font-medium">Market</th>
              {hasScore && (
                <th className="text-right px-4 py-2 font-medium">Score</th>
              )}
              {hasAppreciation && (
                <th className="text-right px-4 py-2 font-medium">12m %</th>
              )}
              <th className="text-left px-4 py-2 font-medium w-12">State</th>
            </tr>
          </thead>
          <tbody className="text-on-surface divide-y divide-outline-variant/50">
            {items.slice(0, 15).map((row, idx) => (
              <tr
                key={`${row.name}-${idx}`}
                className={idx < 3 ? 'bg-primary/5' : undefined}
              >
                <td className="px-4 py-2 font-medium text-on-surface-variant">
                  {row.rank}
                </td>
                <td className="px-4 py-2 font-medium">{row.name}</td>
                {hasScore && (
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatScore(row.score)}
                  </td>
                )}
                {hasAppreciation && (
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatPct(row.appreciation)}
                  </td>
                )}
                <td className="px-4 py-2 text-on-surface-variant text-xs">
                  {row.state ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > 15 && (
        <div className="px-4 py-1.5 bg-surface-container-high/80 text-on-surface-variant text-xs border-t border-outline-variant">
          Showing top 15 of {items.length}
        </div>
      )}
    </div>
  );
}
