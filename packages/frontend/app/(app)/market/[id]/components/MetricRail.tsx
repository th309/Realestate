"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  type MarketSnapshotCard,
  type BenchmarkResult,
  getMetricTitle,
} from "@/lib/data";
import { ScoreGaugeWidget } from "@/app/components/scoring/ScoreGaugeWidget";
import { MetricTitle } from "@/app/components/MetricTitle";
import { InheritedBadge } from "@/app/components/scoring/InheritedBadge";
import { BenchmarkBadge } from "@/components/benchmarks";
import { MetricAlertBell } from "@/components/alerts";
import { getBenchmarkForMetric } from "@/lib/benchmarks/hooks";

interface MetricRailProps {
  geoType: string;
  geoId: string;
  geoName: string;
  cards: Record<string, MarketSnapshotCard>;
  metricIds: string[];
  selectedMetricId: string;
  onSelectMetric: (id: string) => void;
  benchmarks?: BenchmarkResult[];
  hasBenchmarkAccess?: boolean;
}

export function MetricRail({
  geoType,
  geoId,
  geoName,
  cards,
  metricIds,
  selectedMetricId,
  onSelectMetric,
  benchmarks = [],
  hasBenchmarkAccess = false,
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

          const inheritedLevel =
            card?.isInherited &&
            card?.sourceGeoLevel &&
            ["county", "metro", "state", "national"].includes(
              card.sourceGeoLevel,
            )
              ? (card.sourceGeoLevel as
                  | "county"
                  | "metro"
                  | "state"
                  | "national")
              : null;

          const benchmarkResult = hasBenchmarkAccess
            ? getBenchmarkForMetric(benchmarks, metricId)
            : null;
          const benchmarkProp =
            benchmarkResult?.diff != null &&
            benchmarkResult?.direction &&
            benchmarkResult?.parentGeo
              ? {
                  diff: benchmarkResult.diff,
                  direction: benchmarkResult.direction,
                  parentGeoName: benchmarkResult.parentGeo.name,
                }
              : null;

          const metricTitle = getMetricTitle(metricId);

          return (
            <div
              key={metricId}
              className={`relative flex items-center gap-1 rounded-xl border px-4 py-3 transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-outline-variant/30 bg-surface-container hover:border-outline-variant/60"
              }`}
            >
              {/* Stretched click target for the whole row. A real <button>
                  cannot contain other interactive content (the info icon in
                  MetricTitle, InheritedBadge's focusable tooltip, the alert
                  bell below), so this empty overlay button sits BEHIND the
                  row's content; those specific islands opt back in via
                  pointer-events-auto so they stay independently clickable. */}
              <button
                type="button"
                aria-pressed={isSelected}
                aria-label={`Chart ${metricTitle}`}
                onClick={() => onSelectMetric(metricId)}
                className="absolute inset-0 rounded-xl"
              />
              <div className="relative flex-1 min-w-0 flex flex-col gap-1 pointer-events-none">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant min-w-0 truncate pointer-events-auto">
                    <MetricTitle
                      metricId={metricId}
                      resolvedMetric={{
                        source: card?.source ?? null,
                        sourceGeoLevel: card?.sourceGeoLevel ?? null,
                        isInherited: !!card?.isInherited,
                        isFallback: !!card?.isFallback,
                      }}
                    />
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
                </div>
                {(card?.isFallback || inheritedLevel || benchmarkProp) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {card?.isFallback && (
                      <span
                        className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                        title={
                          card?.source
                            ? `Resolved from fallback source: ${card.source}`
                            : "Resolved from fallback source"
                        }
                      >
                        Fallback
                      </span>
                    )}
                    {inheritedLevel && (
                      <span className="pointer-events-auto">
                        <InheritedBadge sourceType={inheritedLevel} />
                      </span>
                    )}
                    {benchmarkProp && <BenchmarkBadge {...benchmarkProp} />}
                  </div>
                )}
              </div>
              <div className="relative">
                <MetricAlertBell
                  metricId={metricId}
                  currentValue={card?.value}
                  geographyType={geoType}
                  geographyId={geoId}
                  geographyName={geoName}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MetricRail;
