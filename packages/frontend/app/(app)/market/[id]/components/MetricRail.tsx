"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { type MarketSnapshotCard } from "@/lib/data";
import { ScoreGaugeWidget } from "@/app/components/scoring/ScoreGaugeWidget";
import { MetricTitle } from "@/app/components/MetricTitle";

interface MetricRailProps {
  geoType: string;
  geoId: string;
  cards: Record<string, MarketSnapshotCard>;
  metricIds: string[];
  selectedMetricId: string;
  onSelectMetric: (id: string) => void;
}

export function MetricRail({
  geoType,
  geoId,
  cards,
  metricIds,
  selectedMetricId,
  onSelectMetric,
}: MetricRailProps) {
  return (
    <div className="space-y-4">
      {/* Score gauge — self-fetching; carries the sandbox tour step1 target. */}
      <div
        data-tour="propertyiq-score"
        className="bg-surface-container rounded-3xl p-6 border border-outline-variant/30 flex justify-center"
      >
        <ScoreGaugeWidget
          geographyType={geoType as "metro" | "county" | "zip"}
          geographyId={geoId}
          scoreType="propertyiq"
        />
      </div>

      {/* Secondary metric rows — click to chart; the charted one is highlighted. */}
      <div className="space-y-1.5">
        {metricIds.map((metricId) => {
          const card = cards[metricId];
          const trend = card?.percentChange ?? null;
          const direction = card?.direction ?? "stable";
          const isSelected = metricId === selectedMetricId;

          return (
            <button
              key={metricId}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectMetric(metricId)}
              className={`w-full flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-outline-variant/30 bg-surface-container hover:border-outline-variant/60"
              }`}
            >
              <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant min-w-0 truncate">
                <MetricTitle metricId={metricId} />
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-on-surface">
                  {card?.formattedValue ?? "—"}
                </span>
                {trend != null && (
                  <span
                    className={`flex items-center gap-0.5 text-xs font-medium ${
                      direction === "up"
                        ? "text-green-600"
                        : direction === "down"
                          ? "text-red-600"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {direction === "up" && (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    )}
                    {direction === "down" && (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {trend >= 0 ? "+" : ""}
                    {trend.toFixed(1)}%
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MetricRail;
