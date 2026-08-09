"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type {
  ForecastHorizon,
  GeoLevel,
  MetricCategory,
  RentIndexType,
  RenterDemandType,
} from "../types";
import { MetricTitle } from "@/app/components/MetricTitle";
import { MetricPickerPopover } from "./MetricPickerPopover";

interface MetricPickerButtonProps {
  metricCategories: MetricCategory[];
  expandedCategories: string[];
  selectedMetric: string;
  geoLevel: GeoLevel;
  forecastHorizon: ForecastHorizon;
  rentIndexType: RentIndexType;
  renterDemandType: RenterDemandType;
  onToggleCategory: (id: string) => void;
  onSelectMetric: (id: string) => void;
  onForecastHorizonChange: (horizon: ForecastHorizon) => void;
  onRentIndexTypeChange: (type: RentIndexType) => void;
  onRenterDemandTypeChange: (type: RenterDemandType) => void;
}

/**
 * Shows which metric the map is currently painting, and IS the picker —
 * clicking it drops the full catalogue anchored right below the button, so
 * switching metrics never depends on the sidebar's collapsed/expanded state
 * (which, on desktop, is usually already open and doesn't visibly react to
 * this button — the previous behaviour looked like a dead label).
 */
export function MetricPickerButton({
  metricCategories,
  expandedCategories,
  selectedMetric,
  geoLevel,
  forecastHorizon,
  rentIndexType,
  renterDemandType,
  onToggleCategory,
  onSelectMetric,
  onForecastHorizonChange,
  onRentIndexTypeChange,
  onRenterDemandTypeChange,
}: MetricPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  // Stable identity — MetricPickerPopover's keydown/pointer-outside effect
  // depends on this, and this button re-renders on every category toggle
  // (expandedCategories is lifted state), so an inline arrow here churned
  // that effect on every expand/collapse click.
  const handleClose = useCallback(() => setOpen(false), []);

  // Category comes from the sidebar catalogue, but the metric NAME comes from
  // MetricTitle — the same source the legend uses. Taking the name from the
  // catalogue instead had this button reading "Home Value" while the legend
  // beside it read "Median Home Value" for the same metric (CLAUDE.md 1.1:
  // one source of truth for metric names).
  const categoryName = findCategoryName(metricCategories, selectedMetric);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Change metric"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-w-0 flex-shrink-0 items-center gap-2 rounded-[10px] border border-outline-variant bg-surface px-3 py-1.5 text-left transition-colors hover:border-primary"
      >
        <SlidersHorizontal className="size-3.5 flex-none text-on-surface-variant" />
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold leading-tight text-on-surface">
            <MetricTitle metricId={selectedMetric} geoLevel={geoLevel} />
          </span>
          {categoryName && (
            <span className="block truncate text-[10px] leading-tight text-on-surface-variant">
              {categoryName}
            </span>
          )}
        </span>
        <ChevronDown
          className={`size-3.5 flex-none text-on-surface-variant transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <MetricPickerPopover
        open={open}
        onClose={handleClose}
        anchorRef={anchorRef}
        metricCategories={metricCategories}
        expandedCategories={expandedCategories}
        selectedMetric={selectedMetric}
        geoLevel={geoLevel}
        forecastHorizon={forecastHorizon}
        rentIndexType={rentIndexType}
        renterDemandType={renterDemandType}
        onToggleCategory={onToggleCategory}
        onSelectMetric={onSelectMetric}
        onForecastHorizonChange={onForecastHorizonChange}
        onRentIndexTypeChange={onRentIndexTypeChange}
        onRenterDemandTypeChange={onRenterDemandTypeChange}
      />
    </>
  );
}

/**
 * Metrics live either directly on a category or inside one of its
 * sub-sections, so both have to be searched — looking only at
 * `category.metrics` silently misses every sub-sectioned metric.
 */
function findCategoryName(
  categories: MetricCategory[],
  metricId: string,
): string | null {
  for (const category of categories) {
    if (category.metrics?.some((m) => m.id === metricId)) return category.name;
    for (const section of category.subSections ?? []) {
      if (section.metrics.some((m) => m.id === metricId)) return category.name;
    }
  }
  return null;
}
