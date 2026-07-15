"use client";

import { useState } from "react";
import {
  useTimeSeriesData,
  metricHasTimeSeries,
  getMetricConfig,
  type GeoLevel,
} from "@/lib/data";
import { AnimatedTimeSeriesChart } from "@/app/graphs/components/AnimatedTimeSeriesChart";
import type { TimeFrame } from "@/app/graphs/hooks/useGraphsState";
import { timeFrameToStartDate } from "./market-rail-metrics";

interface MarketPrimaryChartProps {
  geoType: GeoLevel;
  geoId: string;
  marketName: string;
  metricId: string;
}

const TIME_FRAMES: TimeFrame[] = ["1Y", "3Y", "5Y", "10Y", "Max"];

export function MarketPrimaryChart({
  geoType,
  geoId,
  marketName,
  metricId,
}: MarketPrimaryChartProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("5Y");
  const chartable = metricHasTimeSeries(metricId);

  const { data, isLoading, error, gated, tierRequired } = useTimeSeriesData(
    metricId,
    geoType,
    geoId,
    {
      startDate: timeFrameToStartDate(timeFrame),
      enabled: chartable,
    },
  );

  const metricTitle = getMetricConfig(metricId)?.title ?? metricId;

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant/30 p-4">
      {/* Timeframe pills */}
      <div className="flex items-center justify-end gap-1 mb-2">
        {TIME_FRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            aria-pressed={tf === timeFrame}
            onClick={() => setTimeFrame(tf)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              tf === timeFrame
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Primary chart — single market (comparison/baseline omitted). */}
      <div className="w-full h-[380px]">
        {!chartable ? (
          <div
            data-testid="chart-no-history"
            className="flex h-full items-center justify-center px-6 text-center"
          >
            <p className="text-sm text-on-surface-variant">
              No historical trend is available for {metricTitle}. Pick another
              metric from the list to see how it has moved over time.
            </p>
          </div>
        ) : gated ? (
          <div
            data-testid="chart-gated"
            className="flex h-full items-center justify-center px-6 text-center"
          >
            <p className="text-sm text-on-surface-variant">
              {metricTitle} history requires{" "}
              {tierRequired ? `the ${tierRequired} plan` : "an upgraded plan"}.
              Upgrade to see this trend.
            </p>
          </div>
        ) : (
          <AnimatedTimeSeriesChart
            primaryData={data}
            primaryLabel={marketName}
            metricId={metricId}
            timeFrame={timeFrame}
            onTimeFrameChange={setTimeFrame}
            isLoading={isLoading}
            error={error ? error.message : null}
          />
        )}
      </div>
    </div>
  );
}

export default MarketPrimaryChart;
