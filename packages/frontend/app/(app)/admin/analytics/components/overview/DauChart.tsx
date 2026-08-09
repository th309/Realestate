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
    // h-full + flex-col so the card fills its grid row (it sits beside the
    // taller QuickFunnel) and the chart absorbs the leftover height instead of
    // leaving dead space under a fixed 220px plot.
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 shadow-sm h-full flex flex-col">
      <div className="mb-4 shrink-0">
        <h2 className="text-base font-medium text-on-surface">
          Daily Active Users
        </h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Unique users active per day
        </p>
      </div>
      {/* flex-1 absorbs the leftover card height; min-h-[220px] keeps the
          original plot floor when the card is short (mobile, single column).
          Both give ResponsiveContainer a definite height to measure. */}
      <div className="flex-1 min-h-[220px]">
        <TrendLineChart
          data={data}
          annotations={mapAnnotations(annotations)}
          height="100%"
        />
      </div>
    </div>
  );
}
