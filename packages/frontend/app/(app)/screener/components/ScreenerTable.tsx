"use client";

import React from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import type { ScreenerRow, ScreenerQuery, MoverWindow } from "@/lib/data";
import { formatMetricValue } from "@/lib/data";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import {
  WINDOW_TO_COLUMN,
  WINDOW_META,
  getScoreChangeColor,
  formatScoreChange,
} from "../lib/score-change";

type SortableCol = NonNullable<ScreenerQuery["sortBy"]>;

interface ColumnDef {
  key: SortableCol | null;
  label: string;
  align: "left" | "right";
}

interface ScreenerTableProps {
  rows: ScreenerRow[];
  sortBy: SortableCol;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
  isFetching: boolean;
  onSort: (col: SortableCol) => void;
  /** Active score-change window; drives the Δ column's value + sort key. */
  changeWindow?: MoverWindow;
  /** Human-readable active filters, shown in the empty state for context. */
  activeFilters?: string[];
  /** Resets every active filter (state, score/price, preset) to defaults. */
  onClearFilters?: () => void;
}

function ScoreCell({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="font-[family-name:var(--font-roboto-mono)] text-on-surface-variant">
        —
      </span>
    );
  }

  const color = getScoreColor(score);

  // No percentile letter-grade badge here: the PropertyIQ Score is a momentum
  // signal, so a harsh "F"-style grade undercuts the reframe. Show the number
  // only. (This is NOT the data-quality confidence badge, which is unrelated.)
  return (
    <span
      className="font-[family-name:var(--font-roboto-mono)] font-semibold text-sm"
      style={{ color }}
    >
      {score}
    </span>
  );
}

function SortIcon({
  col,
  sortBy,
  sortOrder,
}: {
  col: SortableCol;
  sortBy: SortableCol;
  sortOrder: "asc" | "desc";
}) {
  if (sortBy !== col) {
    return <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />;
  }
  return sortOrder === "asc" ? (
    <ArrowUp className="w-3.5 h-3.5 text-primary" />
  ) : (
    <ArrowDown className="w-3.5 h-3.5 text-primary" />
  );
}

export function ScreenerTable({
  rows,
  sortBy,
  sortOrder,
  page,
  pageSize,
  isFetching,
  onSort,
  changeWindow = "3m",
  activeFilters = [],
  onClearFilters,
}: ScreenerTableProps) {
  const baseRank = page * pageSize + 1;
  const changeCol = WINDOW_TO_COLUMN[changeWindow];
  const columns: ColumnDef[] = [
    { key: null, label: "#", align: "right" },
    { key: "region_name", label: "Market", align: "left" },
    { key: "score", label: "Score", align: "right" },
    {
      key: changeCol,
      label: `Δ ${WINDOW_META[changeWindow].label}`,
      align: "right",
    },
    { key: "median_price", label: "Median Price", align: "right" },
    { key: null, label: "Rent", align: "right" },
    { key: "cap_rate", label: "Cap Rate", align: "right" },
    { key: "months_of_supply", label: "MoS", align: "right" },
    { key: "overvalued_pct", label: "Overvalued %", align: "right" },
  ];

  return (
    <div
      className={`
        bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant
        overflow-hidden transition-opacity duration-200
        ${isFetching ? "opacity-60" : "opacity-100"}
      `}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Market screener results">
          <thead>
            <tr className="bg-surface-container border-b border-outline-variant">
              {columns.map((col) => (
                <th
                  key={col.label}
                  scope="col"
                  className={`
                    px-4 py-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant
                    whitespace-nowrap select-none
                    ${col.align === "right" ? "text-right" : "text-left"}
                    ${col.key ? "cursor-pointer hover:text-primary hover:bg-primary-container/20 transition-colors" : ""}
                  `}
                  onClick={() => col.key && onSort(col.key)}
                  aria-sort={
                    col.key && sortBy === col.key
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : col.key
                        ? "none"
                        : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    {col.align === "right" && col.key && (
                      <SortIcon
                        col={col.key}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    )}
                    {col.label}
                    {col.align === "left" && col.key && (
                      <SortIcon
                        col={col.key}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <p className="text-on-surface font-medium">
                      No markets match your current filters.
                    </p>
                    {activeFilters.length > 0 ? (
                      <>
                        <p className="text-sm text-on-surface-variant max-w-md">
                          The screener is working — these active filters just
                          narrowed everything out. Loosen or clear them to see
                          results.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
                          {activeFilters.map((label) => (
                            <span
                              key={label}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-surface-container text-on-surface-variant border border-outline-variant font-[family-name:var(--font-roboto-mono)]"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                        {onClearFilters && (
                          <button
                            type="button"
                            onClick={onClearFilters}
                            className="mt-1 px-4 py-2 rounded-full text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 transition-colors"
                          >
                            Clear filters
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-on-surface-variant">
                        Try a different geography or adjust your filters.
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={`${row.geo_level}-${row.region_id}`}
                  className="
                    animate-screener-row
                    border-b border-outline-variant/40 last:border-0
                    hover:bg-primary-container/10 transition-colors duration-100
                  "
                  style={{
                    animationDelay: `${Math.min(i * 20, 300)}ms`,
                  }}
                >
                  {/* Rank */}
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-xs text-on-surface-variant w-12">
                    {baseRank + i}
                  </td>

                  {/* Market name */}
                  <td className="px-4 py-3 text-left min-w-[180px]">
                    <span className="font-medium text-on-surface">
                      {row.region_name}
                    </span>
                    {row.state_code && (
                      <span className="ml-1.5 text-xs text-on-surface-variant">
                        {row.state_code}
                      </span>
                    )}
                  </td>

                  {/* Score */}
                  <td className="px-4 py-3 text-right">
                    <ScoreCell score={row.score} />
                  </td>

                  {/* Δ Score (active window) */}
                  <td
                    className={`px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] ${getScoreChangeColor(
                      row[changeCol] as number | null,
                    )}`}
                  >
                    {(() => {
                      const d = row[changeCol] as number | null;
                      if (d === null) return "—";
                      const arrow = d > 0 ? "▲ " : d < 0 ? "▼ " : "";
                      return `${arrow}${formatScoreChange(d)}`;
                    })()}
                  </td>

                  {/* Median Price */}
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface">
                    {row.median_price !== null
                      ? formatMetricValue(row.median_price, "currency")
                      : "—"}
                  </td>

                  {/* Rent (ZORI) — exact monthly $, not the $K currency bucket */}
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface-variant">
                    {row.rent !== null
                      ? `$${formatMetricValue(Math.round(row.rent), "number")}`
                      : "—"}
                  </td>

                  {/* Cap Rate */}
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface">
                    {row.cap_rate !== null
                      ? formatMetricValue(row.cap_rate, "percent_abs")
                      : "—"}
                  </td>

                  {/* Months of Supply */}
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface">
                    {row.months_of_supply !== null
                      ? row.months_of_supply.toFixed(1)
                      : "—"}
                  </td>

                  {/* Overvalued % */}
                  <td
                    className={`
                      px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)]
                      ${
                        row.overvalued_pct !== null
                          ? row.overvalued_pct > 0
                            ? "text-error"
                            : "text-tertiary"
                          : "text-on-surface"
                      }
                    `}
                  >
                    {row.overvalued_pct !== null
                      ? `${row.overvalued_pct > 0 ? "+" : ""}${row.overvalued_pct.toFixed(1)}%`
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
