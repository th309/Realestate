"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnalyticsDateRange } from "./components/AnalyticsDateRange";
import { AnalyticsFilterBar } from "./components/AnalyticsFilterBar";
import { AnalyticsTabNav } from "./components/AnalyticsTabNav";
import { DrillDownChips } from "./components/DrillDownChips";
import type { AnalyticsFilters } from "@/lib/data/fetchers/admin-analytics.types";

type TabId =
  | "overview"
  | "journeys"
  | "retention"
  | "acquisition"
  | "conversion";

const OverviewTab = dynamic(() =>
  import("./components/overview/OverviewTab").then((m) => ({
    default: m.OverviewTab,
  })),
);
const JourneysTab = dynamic(() =>
  import("./components/journeys/JourneysTab").then((m) => ({
    default: m.JourneysTab,
  })),
);
const RetentionTab = dynamic(() =>
  import("./components/retention/RetentionTab").then((m) => ({
    default: m.RetentionTab,
  })),
);
const AcquisitionTab = dynamic(() =>
  import("./components/acquisition/AcquisitionTab").then((m) => ({
    default: m.AcquisitionTab,
  })),
);
const ConversionTab = dynamic(() =>
  import("./components/conversion/ConversionTab").then((m) => ({
    default: m.ConversionTab,
  })),
);

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [days, setDays] = useState(30);
  const [customRange, setCustomRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [drillDownFilters, setDrillDownFilters] = useState<
    Record<string, string>
  >({});

  const effectiveFilters: AnalyticsFilters = {
    ...filters,
    ...drillDownFilters,
  };

  const handleDrillDown = (key: string, value: string) => {
    setDrillDownFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleRemoveDrillDown = (key: string) => {
    setDrillDownFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const tabProps = {
    days,
    filters: effectiveFilters,
    compare: compareEnabled,
    onDrillDown: handleDrillDown,
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-on-surface">Analytics</h1>
        <div className="flex items-center gap-3">
          <AnalyticsDateRange
            days={days}
            onDaysChange={setDays}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
          <button
            onClick={() => setCompareEnabled(!compareEnabled)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              compareEnabled
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Compare
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <AnalyticsFilterBar filters={filters} onChange={setFilters} />

      {/* Drill-down chips */}
      {Object.keys(drillDownFilters).length > 0 && (
        <DrillDownChips
          filters={drillDownFilters}
          onRemove={handleRemoveDrillDown}
          onClearAll={() => setDrillDownFilters({})}
        />
      )}

      {/* Tab navigation */}
      <AnalyticsTabNav activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === "overview" && <OverviewTab {...tabProps} />}
        {activeTab === "journeys" && <JourneysTab {...tabProps} />}
        {activeTab === "retention" && <RetentionTab {...tabProps} />}
        {activeTab === "acquisition" && <AcquisitionTab {...tabProps} />}
        {activeTab === "conversion" && <ConversionTab {...tabProps} />}
      </div>
    </div>
  );
}
