'use client';

import type { QuinnChartConfig } from './QuinnStructuredData.types';

export function QuinnDataChart({ data }: { data: QuinnChartConfig }) {
  const { title, data: series, referenceLine, referenceLabel } = data;
  const maxVal = Math.max(...series.map((d) => d.value), referenceLine ?? 0, 1);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-surface-container-high text-on-surface font-medium text-sm border-b border-outline-variant">
          {title}
        </div>
      )}
      <div className="p-4">
        <div className="flex flex-col gap-2 min-h-[160px] justify-end">
          {series.slice(0, 10).map((d, i) => {
            const pct = maxVal ? (d.value / maxVal) * 100 : 0;
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-24 truncate text-on-surface-variant" title={d.name}>
                  {d.name}
                </span>
                <div className="flex-1 h-6 bg-surface-container-high rounded overflow-hidden">
                  <div
                    className="h-full bg-primary/80 rounded transition-all duration-300"
                    style={{ width: `${pct}%`, minWidth: d.value ? 4 : 0 }}
                  />
                </div>
                <span className="w-12 text-right tabular-nums font-medium">
                  {typeof d.value === 'number' && Number.isInteger(d.value)
                    ? d.value
                    : d.value.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
        {referenceLine != null && referenceLabel && (
          <div className="mt-2 pt-2 border-t border-outline-variant/50 text-xs text-on-surface-variant">
            Reference: {referenceLabel} = {referenceLine}
          </div>
        )}
      </div>
    </div>
  );
}
