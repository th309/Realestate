'use client';

/**
 * Data Table for Analytics Assistant
 *
 * Renders tabular data with sorting and styling.
 */

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'score' | 'percent' | 'rank';
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface TableRow {
  [key: string]: string | number | null | undefined;
}

export interface DataTableConfig {
  title?: string;
  columns: TableColumn[];
  rows: TableRow[];
  maxRows?: number;
  sortable?: boolean;
  highlightTop?: number;
  highlightBottom?: number;
}

function formatValue(
  value: string | number | null | undefined,
  type: TableColumn['type']
): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-on-surface-variant">—</span>;
  }

  switch (type) {
    case 'score':
      const score = Number(value);
      const scoreColor =
        score >= 70
          ? 'text-green-600 dark:text-green-400'
          : score >= 40
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-red-600 dark:text-red-400';
      return <span className={`font-semibold ${scoreColor}`}>{score.toFixed(1)}</span>;

    case 'percent':
      const pct = Number(value);
      const pctColor =
        pct > 0
          ? 'text-green-600 dark:text-green-400'
          : pct < 0
            ? 'text-red-600 dark:text-red-400'
            : 'text-on-surface-variant';
      const icon =
        pct > 0 ? (
          <TrendingUp className="w-3 h-3 inline mr-0.5" />
        ) : pct < 0 ? (
          <TrendingDown className="w-3 h-3 inline mr-0.5" />
        ) : (
          <Minus className="w-3 h-3 inline mr-0.5" />
        );
      return (
        <span className={`${pctColor} flex items-center gap-0.5`}>
          {icon}
          {pct > 0 ? '+' : ''}
          {pct.toFixed(2)}%
        </span>
      );

    case 'rank':
      const rank = Number(value);
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-container-high text-xs font-medium">
          {rank}
        </span>
      );

    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : value;

    default:
      return String(value);
  }
}

export function DataTable({ config }: { config: DataTableConfig }) {
  const {
    title,
    columns,
    rows,
    maxRows = 10,
    sortable = true,
    highlightTop = 0,
    highlightBottom = 0,
  } = config;

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows.slice(0, maxRows);

    const sorted = [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return sorted.slice(0, maxRows);
  }, [rows, sortKey, sortDir, maxRows]);

  const handleSort = (key: string) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 bg-surface-container rounded-lg">
        <p className="text-on-surface-variant text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <h4 className="text-sm font-medium text-on-surface mb-2">{title}</h4>
      )}
      <div className="overflow-x-auto rounded-lg border border-outline-variant">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-container-low">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-left font-medium text-on-surface-variant ${
                    sortable ? 'cursor-pointer hover:bg-surface-container select-none' : ''
                  } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortable && sortKey === col.key && (
                      sortDir === 'asc' ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIndex) => {
              const isTopHighlight = highlightTop > 0 && rowIndex < highlightTop;
              const isBottomHighlight =
                highlightBottom > 0 && rowIndex >= sortedRows.length - highlightBottom;

              return (
                <tr
                  key={rowIndex}
                  className={`border-t border-outline-variant ${
                    isTopHighlight
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : isBottomHighlight
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : 'hover:bg-surface-container-low'
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 text-on-surface ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : ''
                      }`}
                    >
                      {formatValue(row[col.key], col.type)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <p className="text-xs text-on-surface-variant mt-1 text-right">
          Showing {maxRows} of {rows.length} rows
        </p>
      )}
    </div>
  );
}
