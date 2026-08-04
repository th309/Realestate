"use client";

import { SlidersHorizontal } from "lucide-react";
import type { GeoLevel, MetricCategory } from "../types";
import { MetricTitle } from "@/app/components/MetricTitle";

interface MetricPickerButtonProps {
  metricCategories: MetricCategory[];
  selectedMetric: string;
  geoLevel: GeoLevel;
  /** Opens the catalogue — expands the sidebar on desktop, the sheet on mobile. */
  onOpen: () => void;
}

/**
 * Shows which metric the map is currently painting, and opens the catalogue.
 *
 * The catalogue itself stays in the sidebar — all seven categories keep their
 * question subtitles ("Can I afford to live here?"). What was missing is any
 * statement of the ACTIVE metric outside that sidebar: collapse it, or open
 * the map on a narrow screen, and nothing on the page said what the colours
 * meant. This button always does, and clicking it brings the catalogue back.
 */
export function MetricPickerButton({
  metricCategories,
  selectedMetric,
  geoLevel,
  onOpen,
}: MetricPickerButtonProps) {
  // Category comes from the sidebar catalogue, but the metric NAME comes from
  // MetricTitle — the same source the legend uses. Taking the name from the
  // catalogue instead had this button reading "Home Value" while the legend
  // beside it read "Median Home Value" for the same metric (CLAUDE.md 1.1:
  // one source of truth for metric names).
  const categoryName = findCategoryName(metricCategories, selectedMetric);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Change metric"
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
    </button>
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
