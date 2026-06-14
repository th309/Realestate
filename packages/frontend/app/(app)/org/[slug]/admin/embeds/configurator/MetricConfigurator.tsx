"use client";

import { useState, useEffect, useMemo } from "react";
import { METRICS } from "@/lib/data";
import { GeographySearch, type GeographySelection } from "./GeographySearch";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MetricConfiguratorProps {
  onUrlChange: (url: string | null) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MetricConfigurator({ onUrlChange }: MetricConfiguratorProps) {
  const [metricId, setMetricId] = useState("");
  const [geography, setGeography] = useState<GeographySelection | null>(null);

  const metricOptions = useMemo(
    () =>
      Object.values(METRICS)
        .map((m) => ({ value: m.id, label: m.title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  useEffect(() => {
    if (metricId && geography) {
      onUrlChange(
        `/embed/metric-card/${metricId}/${geography.geoLevel}/${geography.id}`,
      );
    } else {
      onUrlChange(null);
    }
  }, [metricId, geography, onUrlChange]);

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

      {/* Geography */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-1.5">
          Location
        </label>
        <GeographySearch
          onSelect={setGeography}
          value={geography?.name}
          placeholder="Search for a location..."
        />
      </div>
    </div>
  );
}
