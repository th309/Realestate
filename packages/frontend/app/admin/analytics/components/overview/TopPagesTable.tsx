"use client";

/**
 * TopPagesTable — Sortable table of top pages by views.
 * Clicking a row fires the drill-down callback to filter by page path.
 */

import { DataTable } from "../shared/DataTable";
import type { PageMetric } from "@/lib/data/fetchers/admin-analytics.types";

interface TopPagesTableProps {
  pages: PageMetric[];
  onRowClick: (page: PageMetric) => void;
}

const COLUMNS = [
  { key: "pagePath", label: "Page", align: "left" as const },
  { key: "pageGroup", label: "Group", align: "left" as const },
  { key: "views", label: "Views", align: "right" as const },
  { key: "bounceRateDisplay", label: "Bounce Rate", align: "right" as const },
  { key: "avgTimeDisplay", label: "Avg Time", align: "right" as const },
  { key: "conversionRateDisplay", label: "Conv %", align: "right" as const },
];

/** Formats seconds into "Xm Ys" for display. */
function formatAvgTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/** Formats a fraction (0–1 or 0–100) as "XX.X%". */
function formatPercent(value: number): string {
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(1)}%`;
}

function buildTableRows(pages: PageMetric[]): Record<string, unknown>[] {
  return pages.map((page) => ({
    pagePath: page.pagePath,
    pageGroup: page.pageGroup ?? "—",
    views: page.views,
    bounceRateDisplay: formatPercent(page.bounceRate),
    avgTimeDisplay: formatAvgTime(page.avgTimeSeconds),
    conversionRateDisplay: formatPercent(page.conversionRate),
    // Keep the original for the row-click callback
    _original: page,
  }));
}

export function TopPagesTable({ pages, onRowClick }: TopPagesTableProps) {
  const rows = buildTableRows(pages);

  function handleRowClick(row: Record<string, unknown>) {
    const original = row._original as PageMetric;
    onRowClick(original);
  }

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-outline-variant">
        <h2 className="text-base font-medium text-on-surface">Top Pages</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Click a row to filter the dashboard by page
        </p>
      </div>
      <div className="p-0">
        <DataTable
          columns={COLUMNS}
          data={rows}
          onRowClick={handleRowClick}
          sortable
        />
      </div>
    </div>
  );
}
