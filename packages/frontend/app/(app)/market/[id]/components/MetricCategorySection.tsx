"use client";

import React from "react";
import { motion } from "framer-motion";
import { getBenchmarkForMetric } from "@/lib/benchmarks/hooks";
import { MetricCard } from "./MetricCard";
import type { MetricCardData } from "./types";

interface MetricCategorySectionProps {
  categoryName: string;
  subtext?: string;
  icon: React.ReactNode;
  metricIds: string[];
  factorsData: Record<string, MetricCardData>;
  benchmarks?: import("@/lib/benchmarks/api").BenchmarkResult[];
  hasBenchmarkAccess?: boolean;
  delay?: number;
  /** Geography context passed through to each MetricCard's alert bell. */
  geographyType?: string;
  geographyId?: string;
  geographyName?: string;
}

export function MetricCategorySection({
  categoryName,
  subtext,
  icon,
  metricIds,
  factorsData,
  benchmarks = [],
  hasBenchmarkAccess = false,
  delay = 0,
  geographyType,
  geographyId,
  geographyName,
}: MetricCategorySectionProps) {
  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-on-surface">
            {categoryName}
          </h4>
          {subtext && (
            <p className="text-xs text-on-surface-variant">{subtext}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {metricIds.map((metricId, i) => {
          const datum = factorsData[metricId];
          const benchmarkData = hasBenchmarkAccess
            ? getBenchmarkForMetric(benchmarks, metricId)
            : null;
          const benchmarkProp =
            benchmarkData?.diff != null &&
            benchmarkData?.direction &&
            benchmarkData?.parentGeo
              ? {
                  diff: benchmarkData.diff,
                  direction: benchmarkData.direction,
                  parentGeoName: benchmarkData.parentGeo.name,
                }
              : null;

          return (
            <MetricCard
              key={metricId}
              metricId={metricId}
              formattedValue={datum?.formattedValue ?? "\u2014"}
              value={datum?.value}
              isLoading={!!datum?.isLoading}
              trendPercent={datum?.percentChange ?? null}
              trendDirection={datum?.direction ?? "stable"}
              source={datum?.source}
              sourceGeoLevel={datum?.sourceGeoLevel}
              isInherited={datum?.isInherited}
              isFallback={datum?.isFallback}
              benchmark={benchmarkProp}
              delay={delay + i * 0.03}
              geographyType={geographyType}
              geographyId={geographyId}
              geographyName={geographyName}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
