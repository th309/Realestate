/**
 * ExportCsvButton
 *
 * Icon button that exports the current analytics tab data as a CSV file.
 * Shows a loading spinner during the download. Uses the Download icon from lucide.
 */

"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { exportAnalyticsCsv } from "@/lib/data";
import type { AnalyticsFilters } from "@/lib/data/fetchers/admin-analytics.types";

interface ExportCsvButtonProps {
  activeTab: string;
  days: number;
  filters: AnalyticsFilters;
}

export function ExportCsvButton({
  activeTab,
  days,
  filters,
}: ExportCsvButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportAnalyticsCsv(activeTab, days, filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `analytics-${activeTab}-${days}d.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — the data layer already handles error logging
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      title="Export CSV"
      className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
    >
      {exporting ? (
        <svg
          className="animate-spin h-[18px] w-[18px]"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-25"
          />
          <path
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            fill="currentColor"
            className="opacity-75"
          />
        </svg>
      ) : (
        <Download size={18} />
      )}
    </button>
  );
}
