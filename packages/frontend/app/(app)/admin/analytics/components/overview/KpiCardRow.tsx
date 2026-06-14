"use client";

/**
 * KpiCardRow — Grid of 6 MetricCards for the analytics overview.
 * Each card shows a key platform metric with trend and sparkline.
 */

import { MetricCard } from "../shared/MetricCard";
import type { MetricWithTrend } from "@/lib/data/fetchers/admin-analytics.types";

interface KpiCardRowProps {
  kpis: {
    uniqueVisitors: MetricWithTrend;
    totalSessions: MetricWithTrend;
    avgSessionDuration: MetricWithTrend;
    bounceRate: MetricWithTrend;
    pagesPerSession: MetricWithTrend;
    conversionRate: MetricWithTrend;
  };
  sparklines: Record<string, number[]>;
  compare: boolean;
}

/** Formats seconds into "Xm Ys" display string. */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

/** Formats a decimal (0.0–1.0 or 0–100) as a percentage string. */
function formatPercent(value: number): string {
  // Values already expressed as 0–100 pass through; fractions are multiplied
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(1)}%`;
}

/** Formats a large number with locale separators. */
function formatCount(value: number): string {
  return value.toLocaleString();
}

/** Formats a decimal with one fractional digit. */
function formatDecimal(value: number): string {
  return value.toFixed(1);
}

interface KpiDefinition {
  key: string;
  title: string;
  kpi: MetricWithTrend;
  format: (v: number) => string;
}

export function KpiCardRow({
  kpis,
  sparklines,
  compare: _compare,
}: KpiCardRowProps) {
  // _compare is reserved for future period-over-period display in MetricCard
  const kpiDefinitions: KpiDefinition[] = [
    {
      key: "uniqueVisitors",
      title: "Unique Visitors",
      kpi: kpis.uniqueVisitors,
      format: formatCount,
    },
    {
      key: "totalSessions",
      title: "Total Sessions",
      kpi: kpis.totalSessions,
      format: formatCount,
    },
    {
      key: "avgSessionDuration",
      title: "Avg Session",
      kpi: kpis.avgSessionDuration,
      format: formatDuration,
    },
    {
      key: "bounceRate",
      title: "Bounce Rate",
      kpi: kpis.bounceRate,
      format: formatPercent,
    },
    {
      key: "pagesPerSession",
      title: "Pages / Session",
      kpi: kpis.pagesPerSession,
      format: formatDecimal,
    },
    {
      key: "conversionRate",
      title: "Conversion Rate",
      kpi: kpis.conversionRate,
      format: formatPercent,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpiDefinitions.map(({ key, title, kpi, format }) => (
        <MetricCard
          key={key}
          title={title}
          value={format(kpi.current)}
          trend={kpi.changePercent}
          sparkline={sparklines[key]}
        />
      ))}
    </div>
  );
}
