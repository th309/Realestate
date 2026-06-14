"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { METRICS } from "@/lib/data";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MapConfiguratorProps {
  onUrlChange: (url: string | null) => void;
}

interface ToggleConfig {
  key: string;
  label: string;
  param: string;
  defaultOn: boolean;
}

const TOGGLES: ToggleConfig[] = [
  { key: "sidebar", label: "Sidebar", param: "sidebar", defaultOn: false },
  { key: "search", label: "Search bar", param: "search", defaultOn: true },
  { key: "legend", label: "Legend", param: "legend", defaultOn: true },
  { key: "scores", label: "Score cards", param: "scores", defaultOn: false },
  {
    key: "geo_pills",
    label: "Geo level pills",
    param: "geo_pills",
    defaultOn: true,
  },
  {
    key: "metric_picker",
    label: "Metric picker",
    param: "metric_picker",
    defaultOn: true,
  },
  {
    key: "detail_panel",
    label: "Detail panel",
    param: "detail_panel",
    defaultOn: true,
  },
];

const GEO_LEVELS = [
  { value: "state", label: "State" },
  { value: "metro", label: "Metro" },
  { value: "county", label: "County" },
  { value: "zip", label: "ZIP" },
] as const;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MapConfigurator({ onUrlChange }: MapConfiguratorProps) {
  const buildDefaultToggles = useCallback(
    () => Object.fromEntries(TOGGLES.map((t) => [t.key, t.defaultOn])),
    [],
  );

  const [toggles, setToggles] =
    useState<Record<string, boolean>>(buildDefaultToggles);
  const [metric, setMetric] = useState("home_value");
  const [geoLevel, setGeoLevel] = useState("state");

  const metricOptions = useMemo(
    () =>
      Object.values(METRICS)
        .map((m) => ({ value: m.id, label: m.title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    for (const toggle of TOGGLES) {
      params.set(toggle.param, toggles[toggle.key] ? "1" : "0");
    }
    params.set("metric", metric);
    params.set("geo", geoLevel);
    onUrlChange(`/embed/map-full?${params.toString()}`);
  }, [toggles, metric, geoLevel, onUrlChange]);

  function handleToggle(key: string) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      {/* UI Toggles */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-2">
          Visible UI Elements
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TOGGLES.map((toggle) => (
            <label
              key={toggle.key}
              className="flex items-center gap-2 text-sm text-on-surface cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={toggles[toggle.key] ?? toggle.defaultOn}
                onChange={() => handleToggle(toggle.key)}
                className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
              />
              {toggle.label}
            </label>
          ))}
        </div>
      </div>

      {/* Initial metric */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Initial Metric
        </label>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="w-full h-12 px-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-200"
        >
          {metricOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Initial geo level */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Initial Geography Level
        </label>
        <select
          value={geoLevel}
          onChange={(e) => setGeoLevel(e.target.value)}
          className="w-full h-12 px-3 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-200"
        >
          {GEO_LEVELS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
