'use client';

import type { QuinnTableConfig } from './QuinnStructuredData.types';

function cellValue(v: string | number | null, type?: string): string {
  if (v == null) return '—';
  if (type === 'percent' && typeof v === 'number') return `${v.toFixed(1)}%`;
  if (type === 'score' && typeof v === 'number')
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
}

export function QuinnTableBlock({ data }: { data: QuinnTableConfig }) {
  const { title, columns, rows, maxRows = 10 } = data;
  const visible = rows.slice(0, maxRows);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-surface-container-high text-on-surface font-medium text-sm border-b border-outline-variant">
          {title}
        </div>
      )}
      <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-container-high text-on-surface-variant">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="text-left px-4 py-2 font-medium first:rounded-tl last:rounded-tr"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-on-surface divide-y divide-outline-variant/50">
            {visible.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-2 ${
                      col.type === 'number' || col.type === 'score' || col.type === 'percent'
                        ? 'text-right tabular-nums'
                        : ''
                    }`}
                  >
                    {cellValue(row[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <div className="px-4 py-1.5 bg-surface-container-high/80 text-on-surface-variant text-xs border-t border-outline-variant">
          Showing {maxRows} of {rows.length}
        </div>
      )}
    </div>
  );
}
