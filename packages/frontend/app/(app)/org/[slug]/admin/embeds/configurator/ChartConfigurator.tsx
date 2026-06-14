"use client";

import { useState, useEffect, useMemo } from "react";
import { METRICS } from "@/lib/data";
import { GeographySearch, type GeographySelection } from "./GeographySearch";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChartConfiguratorProps {
  onUrlChange: (url: string | null) => void;
}

const TIME_RANGES = ["1Y", "3Y", "5Y", "10Y"] as const;
const CHART_TYPES = ["line", "area"] as const;
const MAX_GEOGRAPHIES = 3;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ChartConfigurator({ onUrlChange }: ChartConfiguratorProps) {
  const [metricId, setMetricId] = useState("");
  const [geographies, setGeographies] = useState<GeographySelection[]>([]);
  const [timeRange, setTimeRange] =
    useState<(typeof TIME_RANGES)[number]>("3Y");
  const [chartType, setChartType] =
    useState<(typeof CHART_TYPES)[number]>("line");
  const [showNational, setShowNational] = useState(false);

  const metricOptions = useMemo(
    () =>
      Object.values(METRICS)
        .map((m) => ({ value: m.id, label: m.title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  useEffect(() => {
    if (!metricId || geographies.length === 0) {
      onUrlChange(null);
      return;
    }

    const geoLevel = geographies[0].geoLevel;
    const ids = geographies.map((g) => g.id).join(",");
    const params = new URLSearchParams({
      metric: metricId,
      geo: geoLevel,
      ids,
      range: timeRange,
      chart_type: chartType,
      show_national: showNational ? "1" : "0",
    });
    onUrlChange(`/embed/chart?${params.toString()}`);
  }, [metricId, geographies, timeRange, chartType, showNational, onUrlChange]);

  function handleAddGeography(geo: GeographySelection) {
    setGeographies((prev) => {
      if (prev.some((g) => g.id === geo.id && g.geoLevel === geo.geoLevel)) {
        return prev;
      }
      if (prev.length >= MAX_GEOGRAPHIES) return prev;
      return [...prev, geo];
    });
  }

  function handleRemoveGeography(index: number) {
    setGeographies((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {/* Metric */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Metric
        </label>
        <select
          value={metricId}
          onChange={(e) => setMetricId(e.target.value)}
          className="w-full h-12 px-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-200"
        >
          <option value="">Select a metric...</option>
          {metricOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Geographies */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Locations (up to {MAX_GEOGRAPHIES})
        </label>
        {geographies.length > 0 && (
          <ul className="mb-2 space-y-1">
            {geographies.map((geo, index) => (
              <li
                key={`${geo.geoLevel}-${geo.id}`}
                className="flex items-center justify-between bg-surface-container rounded-lg px-3 py-2 text-sm text-on-surface"
              >
                <span className="truncate">{geo.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveGeography(index)}
                  className="ml-2 shrink-0 text-on-surface-variant hover:text-error transition-colors"
                  aria-label={`Remove ${geo.name}`}
                >
                  <RemoveIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
        {geographies.length < MAX_GEOGRAPHIES && (
          <GeographySearch
            onSelect={handleAddGeography}
            placeholder={
              geographies.length === 0
                ? "Search for a location..."
                : "Add another location..."
            }
          />
        )}
      </div>

      {/* Time range */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Time Range
        </label>
        <div className="flex gap-2">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors duration-200 ${
                timeRange === range
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface text-on-surface border-outline-variant hover:bg-surface-container"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart type */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Chart Type
        </label>
        <div className="flex gap-2">
          {CHART_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setChartType(type)}
              className={`px-4 py-2 text-sm font-medium rounded-full border capitalize transition-colors duration-200 ${
                chartType === type
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface text-on-surface border-outline-variant hover:bg-surface-container"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* National benchmark */}
      <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showNational}
          onChange={(e) => setShowNational(e.target.checked)}
          className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
        />
        Show national benchmark
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal icon                                                      */
/* ------------------------------------------------------------------ */

function RemoveIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
