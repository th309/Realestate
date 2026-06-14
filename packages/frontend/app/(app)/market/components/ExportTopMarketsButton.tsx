"use client";

import React, { useState } from "react";
import { Download, Lock } from "lucide-react";
import { useEntitlements } from "@/lib/entitlements";
import { PaywallCard } from "@/components/entitlements/PaywallCard";
import { downloadCsv } from "@/lib/export";

interface TopMarketEntry {
  location_id: string;
  location_name: string;
  score: number;
  grade: string;
}

interface ExportTopMarketsButtonProps {
  data: TopMarketEntry[];
  geography: string;
  scoreType: string;
  stateFilter: string;
}

export function ExportTopMarketsButton({
  data,
  geography,
  scoreType,
  stateFilter,
}: ExportTopMarketsButtonProps) {
  const [showPaywall, setShowPaywall] = useState(false);
  const { canAccess } = useEntitlements();
  const canExport = canAccess("feature", "export_csv");

  const handleExport = () => {
    if (!canExport) {
      setShowPaywall(true);
      return;
    }

    const exportData = data.map((m, i) => ({
      rank: i + 1,
      location_name: m.location_name,
      score: m.score.toFixed(1),
      grade: m.grade,
      geography,
    }));
    const columns = [
      { key: "rank", label: "Rank" },
      { key: "location_name", label: "Location" },
      { key: "score", label: `${scoreType} Score` },
      { key: "grade", label: "Grade" },
      { key: "geography", label: "Geography" },
    ];
    const stateSuffix = stateFilter ? `-${stateFilter}` : "";
    const filename = `top-markets-${scoreType}-${geography}${stateSuffix}`;
    downloadCsv(exportData, columns, filename);
  };

  return (
    <>
      <button
        onClick={handleExport}
        disabled={data.length === 0}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs sm:text-sm font-medium rounded-lg transition-colors border border-outline-variant disabled:opacity-50 ${
          canExport
            ? "bg-surface-container-lowest text-on-surface hover:bg-surface-container"
            : "bg-surface-container-lowest text-on-surface-variant opacity-70"
        }`}
        title={
          canExport ? "Export rankings as CSV" : "Upgrade to Pro to export"
        }
      >
        {canExport ? (
          <Download className="w-3.5 h-3.5" />
        ) : (
          <Lock className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">Export</span>
      </button>

      {showPaywall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40"
          onClick={() => setShowPaywall(false)}
        >
          <div className="max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <PaywallCard
              type="feature"
              id="export_csv"
              title="Unlock Data Export"
              description="Export top market rankings to CSV for your own analysis and presentations."
            />
          </div>
        </div>
      )}
    </>
  );
}
