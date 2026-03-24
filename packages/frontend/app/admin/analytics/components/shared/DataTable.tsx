/**
 * DataTable
 *
 * Sortable table with clickable rows.
 * M3 surface styling with outline-variant borders.
 */

"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  sortable?: boolean;
}

type SortDirection = "asc" | "desc";

function SortIcon({ direction }: { direction: SortDirection | null }) {
  if (direction === "asc") return <ChevronUp className="w-3.5 h-3.5" />;
  if (direction === "desc") return <ChevronDown className="w-3.5 h-3.5" />;
  return <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

export function DataTable({
  columns,
  data,
  onRowClick,
  sortable = true,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const handleSort = (key: string) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));

      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [data, sortKey, sortDir]);

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-on-surface-variant">
        No data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-container-low border-b border-outline-variant">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-medium text-on-surface-variant text-xs uppercase tracking-wider ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${sortable ? "cursor-pointer select-none hover:bg-surface-container" : ""}`}
                onClick={() => handleSort(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortable && (
                    <SortIcon
                      direction={sortKey === col.key ? sortDir : null}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-outline-variant/50 last:border-b-0 transition-colors ${
                onRowClick
                  ? "cursor-pointer hover:bg-surface-container-high"
                  : "hover:bg-surface-container-low/50"
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-on-surface ${
                    col.align === "right"
                      ? "text-right tabular-nums"
                      : "text-left"
                  }`}
                >
                  {formatCellValue(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
