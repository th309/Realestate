"use client";

import { useState } from "react";
import { useTimeSeriesData, type GeoLevel } from "@/lib/data";
import { AnimatedTimeSeriesChart } from "@/app/graphs/components/AnimatedTimeSeriesChart";
import type { TimeFrame } from "@/app/graphs/hooks/useGraphsState";
import { timeFrameToHistoryMonths } from "./market-rail-metrics";

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

  const { data, isLoading, error } = useTimeSeriesData(
    metricId,
    geoType,
    geoId,
    {
      historyMonths: timeFrameToHistoryMonths(timeFrame),
    },
  );

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
        <AnimatedTimeSeriesChart
          primaryData={data}
          primaryLabel={marketName}
          metricId={metricId}
          timeFrame={timeFrame}
          onTimeFrameChange={setTimeFrame}
          isLoading={isLoading}
          error={error ? error.message : null}
        />
      </div>
    </div>
  );
}

export default MarketPrimaryChart;
