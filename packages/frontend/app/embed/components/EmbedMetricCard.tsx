import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmbedMetricCardProps {
  /** Metric display title (e.g. "Median Home Value") */
  metricTitle: string;
  /** Raw numeric value (null if unavailable) */
  value: number | null;
  /** Pre-formatted value string (e.g. "$499K", "4.2%") */
  formattedValue: string;
  /** Trend data — direction and formatted change string */
  trend?: {
    direction: "up" | "down" | "flat";
    /** Formatted change (e.g. "+3.2%", "-1.1%") */
    change: string;
  };
  /** Display name for the geography (e.g. "Dallas-Fort Worth, TX") */
  geoName: string;
  /** Data freshness date (e.g. "2026-02-01") */
  periodDate: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TREND_CONFIG = {
  up: { icon: "\u2191", color: "text-green-600" },
  down: { icon: "\u2193", color: "text-red-600" },
  flat: { icon: "\u2192", color: "text-on-surface-variant" },
} as const;

function formatPeriodDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EmbedMetricCard — Compact metric display for embed contexts (~280x180px).
 *
 * Shows metric title, large formatted value, trend arrow + change percentage,
 * geography name, and data freshness indicator.
 */
export function EmbedMetricCard({
  metricTitle,
  value,
  formattedValue,
  trend,
  geoName,
  periodDate,
}: EmbedMetricCardProps) {
  const trendStyle = trend ? TREND_CONFIG[trend.direction] : null;

  return (
    <div
      className="flex flex-col gap-2 p-4 rounded-xl bg-surface border border-outline-variant"
      style={{ maxWidth: 280, minHeight: 160 }}
    >
      {/* Metric title */}
      <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant truncate">
        {metricTitle}
      </span>

      {/* Value + trend row */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-on-surface leading-none">
          {value !== null ? formattedValue : "--"}
        </span>

        {trend && trendStyle && (
          <span className={`text-sm font-medium ${trendStyle.color}`}>
            {trendStyle.icon} {trend.change}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Geography name */}
      <span
        className="text-xs text-on-surface-variant truncate"
        title={geoName}
      >
        {geoName}
      </span>

      {/* Data freshness */}
      <span className="text-[10px] text-on-surface-variant opacity-70">
        Data as of {formatPeriodDate(periodDate)}
      </span>
    </div>
  );
}
