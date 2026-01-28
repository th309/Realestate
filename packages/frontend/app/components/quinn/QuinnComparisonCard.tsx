'use client';

import type { QuinnComparisonConfig } from './QuinnStructuredData.types';

function fmt(v: number | null, unit?: string): string {
  if (v == null) return '—';
  if (unit === 'percent') return `${v.toFixed(1)}%`;
  if (unit === 'score') return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

export function QuinnComparisonCard({ data }: { data: QuinnComparisonConfig }) {
  const { title, filteredLabel, benchmarkLabel, metrics } = data;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-surface-container-high text-on-surface font-medium text-sm border-b border-outline-variant">
          {title}
        </div>
      )}
      <div className="p-4 space-y-3">
        {metrics.map((m, i) => {
          const filteredNum = m.filtered ?? 0;
          const benchNum = m.benchmark ?? 0;
          const diff = filteredNum - benchNum;
          const better =
            m.higherIsBetter !== false ? diff >= 0 : diff <= 0;
          return (
            <div
              key={i}
              className="flex flex-col gap-1 text-sm"
            >
              <span className="text-on-surface-variant">{m.label}</span>
              <div className="grid grid-cols-3 gap-2 items-baseline">
                <div>
                  <span className="text-xs text-on-surface-variant block">
                    {filteredLabel}
                  </span>
                  <span className="font-medium tabular-nums">
                    {fmt(m.filtered, m.unit)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant block">
                    {benchmarkLabel}
                  </span>
                  <span className="tabular-nums text-on-surface-variant">
                    {fmt(m.benchmark, m.unit)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-on-surface-variant block">
                    Diff
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      better ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {diff >= 0 ? '+' : ''}
                    {m.unit === 'percent' ? `${diff.toFixed(1)}%` : diff.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
