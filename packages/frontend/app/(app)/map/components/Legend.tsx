"use client";

import type { GeoLevel, ForecastHorizon, MapData } from "../types";
import {
  COLOR_SCALE,
  NO_DATA_COLOR,
  getMetricFormat,
  calculateValueRange,
  formatValue,
} from "../utils";
import { MetricTitle } from "@/app/components/MetricTitle";
import { useMetricFreshness } from "@/lib/data/hooks";
import { getMetricConfig } from "@/lib/data";

interface LegendProps {
  selectedMetric: string;
  forecastHorizon: ForecastHorizon;
  geoLevel: GeoLevel;
  mapData: MapData;
  /** Override the metric title shown in the legend (e.g. "Market Match Score") */
  overrideTitle?: string;
}

/**
 * Docked scale strip for the map.
 *
 * Two things changed here. It used to float over the Pacific as an absolutely
 * positioned card, covering the very geography it described, with the "No data
 * available" key stacked inside it. It is now a header strip above the canvas,
 * laid out on one line: title, seven-swatch scale, min and max in monospace,
 * the no-data key, and the as-of date.
 *
 * It also had SEVEN branches — percent, percent_abs, index, number, days and
 * currency were byte-identical, differing only in the comment above them. They
 * collapse to one; only the single-value case (one swatch, no range) is
 * genuinely different.
 */
export function Legend({
  selectedMetric,
  geoLevel,
  mapData,
  overrideTitle,
}: LegendProps) {
  const titleElement = overrideTitle ? (
    <span>{overrideTitle}</span>
  ) : (
    <MetricTitle metricId={selectedMetric} geoLevel={geoLevel} />
  );
  const metricFormat = getMetricFormat(selectedMetric);

  // Source-coverage note (e.g. Realtor ranks only higher-volume markets) shown
  // beside the "No data available" swatch so greyed regions read as expected, not broken.
  const coverageNote = getMetricConfig(selectedMetric)?.coverageNote;

  // Use shared range calculation - ensures consistency with map layer colors
  // Pass selectedMetric and geoLevel (e.g., permits 0–200+ scale only at county)
  const { min, max, maxLabelSuffix } = calculateValueRange(
    mapData,
    metricFormat,
    selectedMetric,
    geoLevel,
  );

  // Use shared formatValue for labels - ensures consistency with map
  const minLabel = formatValue(min, metricFormat, "min", selectedMetric);
  const maxLabel =
    formatValue(max, metricFormat, "max", selectedMetric) +
    (maxLabelSuffix ?? "");

  const { formattedDate: dataDate } = useMetricFreshness(
    selectedMetric,
    geoLevel,
  );

  // National level can yield a single data point, which has no range to show.
  const isSingleValue = min === max || Math.abs(max - min) < 0.001;

  return (
    <div
      data-map-legend
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-outline-variant bg-surface-container-low px-4 py-2"
    >
      <span className="text-[11px] font-bold text-on-surface">
        {titleElement}
      </span>

      {isSingleValue ? (
        <span className="flex items-center gap-2">
          <span
            className="h-3 w-6 rounded-sm"
            style={{ backgroundColor: COLOR_SCALE[3] }}
          />
          <span className="font-mono text-[11px] tabular-nums text-on-surface-variant">
            {minLabel}
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-on-surface-variant">
            {minLabel}
          </span>
          <span className="flex items-center gap-px">
            {COLOR_SCALE.map((color, i) => (
              <span
                key={i}
                className="h-3 w-5 first:rounded-l-sm last:rounded-r-sm"
                style={{ backgroundColor: color }}
              />
            ))}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-on-surface-variant">
            {maxLabel}
          </span>
        </span>
      )}

      {/* No-data key, on the same line rather than stacked inside a card. */}
      <span className="flex items-center gap-1.5">
        <span
          className="h-3 w-5 rounded-sm border border-outline"
          style={{ backgroundColor: NO_DATA_COLOR }}
        />
        <span className="text-[11px] text-on-surface-variant">No data</span>
      </span>

      {coverageNote ? (
        <span className="max-w-[280px] text-[10px] leading-snug text-on-surface-variant">
          {coverageNote}
        </span>
      ) : null}

      <span className="ml-auto font-mono text-[10px] text-outline">
        {dataDate ? `as of ${dataDate}` : "as of —"}
      </span>
    </div>
  );
}
