"use client";

/**
 * DauChart — Card wrapper around TrendLineChart for Daily Active Users.
 * Receives pre-fetched time series data and annotations from OverviewTab.
 */

import { TrendLineChart } from "../shared/TrendLineChart";
import type {
  AnalyticsTimeSeriesPoint,
  Annotation,
} from "@/lib/data/fetchers/admin-analytics.types";

interface DauChartProps {
  data: AnalyticsTimeSeriesPoint[];
  annotations: Annotation[];
}

function mapAnnotations(annotations: Annotation[]) {
  return annotations.map((ann) => ({
    date: ann.annotationDate,
    label: ann.label,
  }));
}

export function DauChart({ data, annotations }: DauChartProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-medium text-on-surface">
          Daily Active Users
        </h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Unique users active per day
        </p>
      </div>
      <TrendLineChart
        data={data}
        annotations={mapAnnotations(annotations)}
        height={220}
      />
    </div>
  );
}
