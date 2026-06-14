"use client";

import { AlertTriangle } from "lucide-react";

import { formatMetricValue, getMetricFormat } from "@/lib/data";
import { MetricTitle } from "@/app/components/MetricTitle";

import type { SectionProps } from "../types";
import {
  getMetricWithAliases,
  getMetricProvenance,
} from "../utils/metricHelpers";
import { InheritedBadge } from "@/app/components/scoring/InheritedBadge";

export function MetricHighlight({ section, report }: SectionProps) {
  const metricId = section.config?.metric;
  const value = getMetricWithAliases(report, metricId);
  const label =
    section.config?.label ||
    metricId
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  const subtitle = section.config?.subtitle;
  const icon = section.config?.icon;

  if (value === null) {
    return (
      <div className="bg-primary/10 rounded-2xl p-6 text-center">
        {icon && <div className="text-4xl mb-2">{icon}</div>}
        <p className="text-sm text-primary font-medium mb-1">
          {metricId ? <MetricTitle metricId={metricId} /> : label}
        </p>
        <div className="flex items-center justify-center gap-2 text-on-surface-variant">
          <AlertTriangle className="w-5 h-5" />
          <span>Data not available</span>
        </div>
      </div>
    );
  }

  const format = getMetricFormat(metricId);
  const prov = metricId ? getMetricProvenance(report, metricId) : null;
  const inheritedLevel =
    prov?.isInherited &&
    prov.sourceGeoLevel &&
    ["county", "metro", "state", "national"].includes(prov.sourceGeoLevel)
      ? (prov.sourceGeoLevel as "county" | "metro" | "state" | "national")
      : null;

  return (
    <div className="bg-primary/10 rounded-2xl p-6 text-center">
      {icon && <div className="text-4xl mb-2">{icon}</div>}
      <p className="text-sm text-primary font-medium mb-1">
        {metricId ? (
          <MetricTitle
            metricId={metricId}
            resolvedMetric={
              prov
                ? {
                    source: prov.source,
                    sourceGeoLevel: prov.sourceGeoLevel as any,
                    isInherited: prov.isInherited,
                    isFallback: prov.isFallback,
                  }
                : undefined
            }
          />
        ) : (
          label
        )}
      </p>
      <p className="text-4xl font-bold text-on-surface mb-1">
        {formatMetricValue(value, format)}
      </p>
      {inheritedLevel && (
        <InheritedBadge sourceType={inheritedLevel} className="mt-1" />
      )}
      {subtitle && (
        <p className="text-sm text-on-surface-variant">{subtitle}</p>
      )}
    </div>
  );
}
