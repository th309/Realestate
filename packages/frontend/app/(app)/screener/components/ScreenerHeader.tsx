"use client";

import React from "react";
import { Download, Lock } from "lucide-react";

interface ScreenerHeaderProps {
  /** Snapshot freshness (rows share one monthly as_of); null hides the stamp. */
  dataAsOf: string | null;
  canExport: boolean;
  exportDisabled: boolean;
  onExport: () => void;
}

/**
 * Screener page header: eyebrow + title + freshness stamp, and the CSV export
 * button (Pro-gated). Extracted from ScreenerPageInner to keep that component
 * under the file-size limit (CLAUDE.md §1.3).
 */
export function ScreenerHeader({
  dataAsOf,
  canExport,
  exportDisabled,
  onExport,
}: ScreenerHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
          Market Intelligence
        </p>
        <h1 className="text-3xl font-bold text-on-surface mt-1 tracking-tight">
          Market Screener
        </h1>
        <p className="text-on-surface-variant mt-1 text-sm">
          Screen and rank markets by score, price, cash-flow, and supply.
        </p>
        {dataAsOf && (
          <p className="mt-1 text-xs text-on-surface-variant/70">
            Data as of{" "}
            {new Date(`${dataAsOf.slice(0, 10)}T00:00:00`).toLocaleDateString(
              "en-US",
              { year: "numeric", month: "short", day: "numeric" },
            )}
          </p>
        )}
      </div>

      <div className="flex-shrink-0">
        {canExport ? (
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className="
              inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium
              border border-outline transition-all duration-200
              text-on-surface-variant hover:border-primary hover:text-primary hover:bg-primary-container/20
              disabled:opacity-40 disabled:cursor-not-allowed
            "
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        ) : (
          <button
            type="button"
            disabled
            title="Upgrade to Pro to export"
            className="
              inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium
              border border-outline-variant text-on-surface-variant/50 cursor-not-allowed
            "
          >
            <Lock className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>
    </div>
  );
}
