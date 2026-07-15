"use client";

import React, { useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown, MoreVertical } from "lucide-react";
import type { ScreenerRow, ScreenerQuery, MoverWindow } from "@/lib/data";
import { formatMetricValue, formatGeoDisplayName } from "@/lib/data";
import { useRouter } from "next/navigation";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import {
  WINDOW_TO_COLUMN,
  WINDOW_META,
  getScoreChangeColor,
  formatScoreChange,
} from "../lib/score-change";
import { ScrollShadowContainer } from "./ScrollShadowContainer";
import { ScreenerRowMenu } from "./ScreenerRowMenu";

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

/** Rendered at card width (not inside the wide scrolling table) so the
    message stays centered and fully visible on narrow viewports. */
function ScreenerEmptyState({
  activeFilters,
  onClearFilters,
}: {
  activeFilters: string[];
  onClearFilters?: () => void;
}) {
  return (
    <div className="px-4 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-on-surface font-medium">
          No markets match your current filters.
        </p>
        {activeFilters.length > 0 ? (
          <>
            <p className="text-sm text-on-surface-variant max-w-md">
              The screener is working — these active filters just narrowed
              everything out. Loosen or clear them to see results.
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
    </div>
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
  const router = useRouter();
  const [menu, setMenu] = useState<{
    row: ScreenerRow;
    x: number;
    y: number;
  } | null>(null);

  const handleRowClick = (clickedRow: ScreenerRow) => {
    const params = new URLSearchParams({
      type: clickedRow.geo_level,
      view: "investor",
    });
    if (clickedRow.state_code) params.set("state", clickedRow.state_code);
    router.push(`/market/${clickedRow.region_id}?${params.toString()}`);
  };

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
    { key: null, label: "", align: "right" },
  ];

  return (
    <div
      className={`
        bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant
        overflow-hidden transition-opacity duration-200
        ${isFetching ? "opacity-60" : "opacity-100"}
      `}
    >
      {rows.length === 0 ? (
        <ScreenerEmptyState
          activeFilters={activeFilters}
          onClearFilters={onClearFilters}
        />
      ) : (
        <ScrollShadowContainer ariaLabel="Scroll horizontally for more columns">
          <table
            className="w-full text-sm"
            aria-label="Market screener results"
          >
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant">
                {columns.map((col) => (
                  <th
                    key={col.label}
                    scope="col"
                    className={`
                    px-3 sm:px-4 py-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant
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
              {rows.map((row, i) => (
                <tr
                  key={`${row.geo_level}-${row.region_id}`}
                  onClick={() => handleRowClick(row)}
                  className="
                    animate-screener-row cursor-pointer
                    border-b border-outline-variant/40 last:border-0
                    hover:bg-primary-container/10 transition-colors duration-100
                  "
                  style={{
                    animationDelay: `${Math.min(i * 20, 300)}ms`,
                  }}
                >
                  {/* Rank */}
                  <td className="px-3 sm:px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-xs text-on-surface-variant w-12">
                    {baseRank + i}
                  </td>

                  {/* Market name — region_name already carries ", ST"; the
                      separate state_code is redundant, so fall back to it only
                      when the name is missing. */}
                  <td className="px-3 sm:px-4 py-3 text-left min-w-[140px] sm:min-w-[180px]">
                    <span className="font-medium text-on-surface">
                      {formatGeoDisplayName(row.region_name) || row.state_code}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <ScoreCell score={row.score} />
                  </td>

                  {/* Δ Score (active window) */}
                  <td
                    className={`px-3 sm:px-4 py-3 text-right whitespace-nowrap font-[family-name:var(--font-roboto-mono)] ${getScoreChangeColor(
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
                  <td className="px-3 sm:px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface">
                    {row.median_price !== null
                      ? formatMetricValue(row.median_price, "currency")
                      : "—"}
                  </td>

                  {/* Rent (ZORI) — exact monthly $, not the $K currency bucket */}
                  <td className="px-3 sm:px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface-variant">
                    {row.rent !== null
                      ? `$${formatMetricValue(Math.round(row.rent), "number")}`
                      : "—"}
                  </td>

                  {/* Cap Rate */}
                  <td className="px-3 sm:px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface">
                    {row.cap_rate !== null
                      ? formatMetricValue(row.cap_rate, "percent_abs")
                      : "—"}
                  </td>

                  {/* Months of Supply */}
                  <td className="px-3 sm:px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] text-on-surface">
                    {row.months_of_supply !== null
                      ? row.months_of_supply.toFixed(1)
                      : "—"}
                  </td>

                  {/* Overvalued % */}
                  <td
                    className={`
                      px-3 sm:px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)]
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

                  {/* Row actions */}
                  <td className="px-2 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (
                          e.currentTarget as HTMLElement
                        ).getBoundingClientRect();
                        setMenu({ row, x: rect.right, y: rect.bottom });
                      }}
                      aria-label="Row actions"
                      className="rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollShadowContainer>
      )}
      {menu && (
        <ScreenerRowMenu
          row={menu.row}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
