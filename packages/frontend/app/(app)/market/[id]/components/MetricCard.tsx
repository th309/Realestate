"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { MetricTitle } from "@/app/components/MetricTitle";
import { InheritedBadge } from "@/app/components/scoring/InheritedBadge";
import { BenchmarkBadge } from "@/components/benchmarks";
import { Skeleton } from "@/components/ui/Skeleton";

interface MetricCardProps {
  metricId: string;
  formattedValue: string;
  trendPercent: number | null;
  trendDirection: "up" | "down" | "stable";
  source?: string;
  sourceGeoLevel?: "metro" | "county" | "zip" | "state" | "national" | null;
  isInherited?: boolean;
  isFallback?: boolean;
  benchmark?: {
    diff: number;
    direction: "better" | "worse" | "similar";
    parentGeoName: string;
  } | null;
  isLoading?: boolean;
  delay?: number;
}

export function MetricCard({
  metricId,
  formattedValue,
  trendPercent,
  trendDirection,
  source,
  sourceGeoLevel,
  isInherited,
  isFallback,
  benchmark,
  isLoading = false,
  delay = 0,
}: MetricCardProps) {
  const inheritedLevel =
    isInherited &&
    sourceGeoLevel &&
    ["county", "metro", "state", "national"].includes(sourceGeoLevel)
      ? (sourceGeoLevel as "county" | "metro" | "state" | "national")
      : null;
  const sourceLabel = source
    ? source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <motion.div
      className="bg-surface-container rounded-xl p-4 border border-outline-variant/30 hover:shadow-md hover:border-outline-variant/50 transition-all"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs font-medium text-on-surface-variant uppercase tracking-wide min-w-0">
          <MetricTitle
            metricId={metricId}
            resolvedMetric={{
              source: source ?? null,
              sourceGeoLevel: sourceGeoLevel ?? null,
              isInherited: !!isInherited,
              isFallback: !!isFallback,
            }}
          />
        </div>
        {trendPercent != null && (
          <div
            className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${
              trendDirection === "up"
                ? "text-green-600"
                : trendDirection === "down"
                  ? "text-red-600"
                  : "text-on-surface-variant"
            }`}
          >
            {trendDirection === "up" && (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
            {trendDirection === "down" && (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {trendPercent >= 0 ? "+" : ""}
            {trendPercent.toFixed(1)}%
          </div>
        )}
      </div>
      {(isFallback || inheritedLevel) && (
        <div className="flex items-center gap-1 mb-2">
          {isFallback && (
            <span
              className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
              title={
                sourceLabel
                  ? `Resolved from fallback source: ${sourceLabel}`
                  : "Resolved from fallback source"
              }
            >
              Fallback
            </span>
          )}
          {inheritedLevel && <InheritedBadge sourceType={inheritedLevel} />}
        </div>
      )}
      <div className="text-xl font-bold text-on-surface">
        {isLoading ? (
          // Height 28px matches text-xl's line-height exactly (no shift on swap).
          <Skeleton variant="text" width={80} height={28} />
        ) : (
          formattedValue
        )}
      </div>
      {benchmark && (
        <div className="mt-2">
          <BenchmarkBadge
            diff={benchmark.diff}
            direction={benchmark.direction}
            parentGeoName={benchmark.parentGeoName}
          />
        </div>
      )}
    </motion.div>
  );
}
