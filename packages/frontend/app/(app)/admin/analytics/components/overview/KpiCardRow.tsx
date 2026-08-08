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
  /**
   * False when the comparison window predates the instrumentation that
   * classifies a session as human. The trend badges are omitted in that case,
   * and this drives the note explaining their absence — a missing arrow with no
   * explanation is its own small mystery.
   */
  trendsComparable?: boolean;
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
  trendsComparable,
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
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiDefinitions.map(({ key, title, kpi, format }) => (
          <MetricCard
            key={key}
            title={title}
            value={format(kpi.current)}
            // null means the comparison window predates the instrumentation that
            // classifies a session as human, so a delta would measure coverage
            // rather than change. Undefined tells MetricCard to omit the badge
            // entirely — an arrow is read before any footnote is.
            trend={kpi.changePercent ?? undefined}
            sparkline={sparklines[key]}
          />
        ))}
      </div>

      {trendsComparable === false && (
        <p className="text-xs text-on-surface-variant">
          Period-over-period change is hidden: the comparison window predates
          the traffic classification that identifies real people, so a delta
          would measure how much of the data is classified rather than how much
          the traffic changed. Comparisons return once both windows sit after 28
          Jul 2026 — around 11 Aug for the 7-day view, 26 Sep for 30-day.
        </p>
      )}
    </div>
  );
}
