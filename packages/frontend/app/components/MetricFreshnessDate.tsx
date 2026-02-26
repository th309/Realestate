"use client";

import type { GeoLevel } from "@/lib/data";
import { useMetricFreshness } from "@/lib/data/hooks";

interface MetricFreshnessDateProps {
  metricId: string;
  geoLevel?: GeoLevel;
  fallback?: string;
}

export function MetricFreshnessDate({
  metricId,
  geoLevel,
  fallback = "\u2014",
}: MetricFreshnessDateProps) {
  const { formattedDate, isLoading } = useMetricFreshness(metricId, geoLevel);

  if (isLoading) {
    return (
      <span className="inline-block w-20 h-4 bg-surface-container animate-pulse rounded" />
    );
  }

  return <>{formattedDate || fallback}</>;
}

export default MetricFreshnessDate;
