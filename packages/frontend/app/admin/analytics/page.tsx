"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { AnalyticsDateRange } from "./components/AnalyticsDateRange";
import { AnalyticsFilterBar } from "./components/AnalyticsFilterBar";
import { AnalyticsTabNav } from "./components/AnalyticsTabNav";
import { DrillDownChips } from "./components/DrillDownChips";
import { ExportCsvButton } from "./components/ExportCsvButton";
import { AnnotationPopover } from "./components/AnnotationPopover";
import { AiInsightsPanel } from "./components/AiInsightsPanel";
import {
  fetchAnnotations,
  createAnnotation,
} from "@/lib/data/fetchers/admin-analytics";
import type {
  AnalyticsFilters,
  Annotation,
} from "@/lib/data/fetchers/admin-analytics.types";

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

/** Derive the effective date window from days or custom range. */
function computeDateWindow(
  days: number,
  customRange: { start: string; end: string } | null,
): { startDate: string; endDate: string } {
  if (customRange) {
    return { startDate: customRange.start, endDate: customRange.end };
  }
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { startDate, endDate };
}

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

  const { startDate, endDate } = useMemo(
    () => computeDateWindow(days, customRange),
    [days, customRange],
  );

  // Fetch annotations for the active date window
  const { data: annotations = [], refetch: refetchAnnotations } = useQuery<
    Annotation[]
  >({
    queryKey: ["analytics", "annotations", startDate, endDate],
    queryFn: () => fetchAnnotations(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });

  const handleSaveAnnotation = useCallback(
    async (date: string, label: string, description?: string) => {
      await createAnnotation(date, label, description);
      refetchAnnotations();
    },
    [refetchAnnotations],
  );

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
    annotations,
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

          {/* Action icon buttons */}
          <div className="flex items-center gap-1 border-l border-outline-variant pl-3">
            <ExportCsvButton
              activeTab={activeTab}
              days={days}
              filters={effectiveFilters}
            />
            <AnnotationPopover onSave={handleSaveAnnotation} />
          </div>
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

      {/* AI Marketing Insights */}
      <AiInsightsPanel
        days={days}
        filters={effectiveFilters}
        focusArea={activeTab}
      />
    </div>
  );
}
