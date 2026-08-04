"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown, MoreVertical } from "lucide-react";
import type { ScreenerRow, ScreenerQuery, MoverWindow } from "@/lib/data";
import { formatMetricValue, formatGeoDisplayName } from "@/lib/data";
import { useRouter } from "next/navigation";
import { DataTable, ScorePill, type Column } from "@/app/components/app-shell";
import {
  WINDOW_TO_COLUMN,
  WINDOW_META,
  getScoreChangeColor,
  formatScoreChange,
} from "../lib/score-change";
import { ScrollShadowContainer } from "./ScrollShadowContainer";
import { ScreenerRowMenu } from "./ScreenerRowMenu";

type SortableCol = NonNullable<ScreenerQuery["sortBy"]>;

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

const DASH = "—";

function SortIcon({
  active,
  order,
}: {
  active: boolean;
  order: "asc" | "desc";
}) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-30" />;
  return order === "asc" ? (
    <ArrowUp className="size-3 text-primary" />
  ) : (
    <ArrowDown className="size-3 text-primary" />
  );
}

/** Header label plus its sort affordance, per the mockup's `.sh` span. */
function SortableHeader({
  label,
  col,
  sortBy,
  sortOrder,
  align,
}: {
  label: string;
  col: SortableCol;
  sortBy: SortableCol;
  sortOrder: "asc" | "desc";
  align: "left" | "right";
}) {
  const icon = <SortIcon active={sortBy === col} order={sortOrder} />;
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {align === "right" ? icon : null}
      {label}
      {align === "left" ? icon : null}
    </span>
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
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-surface-container text-on-surface-variant border border-outline-variant font-mono"
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

  const sortHeader = (
    label: string,
    col: SortableCol,
    align: "left" | "right",
  ) => (
    <SortableHeader
      label={label}
      col={col}
      sortBy={sortBy}
      sortOrder={sortOrder}
      align={align}
    />
  );

  const columns: Column<ScreenerRow>[] = [
    {
      key: "rank",
      header: "#",
      align: "right",
      sortable: false,
      width: "w-11",
      cellClassName: () => "text-[11px] text-on-surface-variant",
      render: (_row, i) => baseRank + i,
    },
    {
      key: "region_name",
      header: sortHeader("Market", "region_name", "left"),
      align: "left",
      // Market name already carries ", ST"; the separate state_code is
      // redundant, so fall back to it only when the name is missing.
      cellClassName: () => "min-w-[180px] font-semibold text-primary",
      render: (row) => formatGeoDisplayName(row.region_name) || row.state_code,
    },
    {
      key: "score",
      header: sortHeader("Score", "score", "right"),
      align: "right",
      render: (row) =>
        row.score === null ? DASH : <ScorePill score={row.score} />,
    },
    {
      key: changeCol,
      header: sortHeader(
        `Δ ${WINDOW_META[changeWindow].label}`,
        changeCol,
        "right",
      ),
      align: "right",
      cellClassName: (row) =>
        getScoreChangeColor(row[changeCol] as number | null),
      render: (row) => {
        const d = row[changeCol] as number | null;
        if (d === null) return DASH;
        const arrow = d > 0 ? "▲ " : d < 0 ? "▼ " : "";
        return `${arrow}${formatScoreChange(d)}`;
      },
    },
    {
      key: "median_price",
      header: sortHeader("Median Price", "median_price", "right"),
      align: "right",
      render: (row) =>
        row.median_price !== null
          ? formatMetricValue(row.median_price, "currency")
          : DASH,
    },
    {
      key: "rent",
      header: "Rent",
      align: "right",
      sortable: false,
      cellClassName: () => "text-on-surface-variant",
      // Exact monthly $, not the $K currency bucket.
      render: (row) =>
        row.rent !== null
          ? `$${formatMetricValue(Math.round(row.rent), "number")}`
          : DASH,
    },
    {
      key: "cap_rate",
      header: sortHeader("Cap Rate", "cap_rate", "right"),
      align: "right",
      render: (row) =>
        row.cap_rate !== null
          ? formatMetricValue(row.cap_rate, "percent_abs")
          : DASH,
    },
    {
      key: "months_of_supply",
      header: sortHeader("MoS", "months_of_supply", "right"),
      align: "right",
      render: (row) =>
        row.months_of_supply !== null ? row.months_of_supply.toFixed(1) : DASH,
    },
    {
      key: "overvalued_pct",
      header: sortHeader("Overvalued %", "overvalued_pct", "right"),
      align: "right",
      cellClassName: (row) =>
        row.overvalued_pct === null
          ? ""
          : row.overvalued_pct > 0
            ? "text-error"
            : "text-tertiary",
      render: (row) =>
        row.overvalued_pct !== null
          ? `${row.overvalued_pct > 0 ? "+" : ""}${row.overvalued_pct.toFixed(1)}%`
          : DASH,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      sortable: false,
      width: "w-10",
      render: (row) => (
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
          <MoreVertical className="size-4" />
        </button>
      ),
    },
  ];

  return (
    <div
      className={`
        bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant
        overflow-hidden transition-opacity duration-200
        ${isFetching ? "opacity-60" : "opacity-100"}
      `}
    >
      <ScrollShadowContainer ariaLabel="Scroll horizontally for more columns">
        <DataTable
          scroll={false}
          ariaLabel="Market screener results"
          columns={columns}
          rows={rows}
          sortKey={sortBy}
          sortDir={sortOrder}
          onSort={(key) => onSort(key as SortableCol)}
          rowKey={(row) => `${row.geo_level}-${row.region_id}`}
          onRowClick={handleRowClick}
          rowClassName={() => "animate-screener-row"}
          rowStyle={(_row, i) => ({
            animationDelay: `${Math.min(i * 20, 300)}ms`,
          })}
          empty={
            <ScreenerEmptyState
              activeFilters={activeFilters}
              onClearFilters={onClearFilters}
            />
          }
        />
      </ScrollShadowContainer>
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
