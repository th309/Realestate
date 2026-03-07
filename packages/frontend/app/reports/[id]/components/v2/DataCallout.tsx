"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataCalloutItem {
  /** Short label describing the metric */
  label: string;
  /** Formatted display value (e.g. "$425K", "3.2%") */
  value: string;
  /** Optional explanatory text below the value */
  subtext?: string;
  /** Optional trend direction */
  trend?: "up" | "down" | "flat";
}

export interface DataCalloutProps {
  /** Array of data items to display */
  items: DataCalloutItem[];
  /** Display variant: compact (inline grid) or full (titled card) */
  variant?: "compact" | "full";
  /** Optional title for the full variant */
  title?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TREND_CONFIG = {
  up: {
    icon: TrendingUp,
    colorClass: "text-[var(--report-success)]",
  },
  down: {
    icon: TrendingDown,
    colorClass: "text-[var(--report-error)]",
  },
  flat: {
    icon: Minus,
    colorClass: "text-[var(--report-stone-light)]",
  },
} as const;

function TrendIndicator({ trend }: { trend: "up" | "down" | "flat" }) {
  const { icon: Icon, colorClass } = TREND_CONFIG[trend];
  return (
    <Icon className={`w-4 h-4 ${colorClass}`} aria-label={`Trend: ${trend}`} />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DataCallout - Compact data visualization box for key numbers.
 *
 * Displays important metrics in a visually distinct card with large values,
 * small labels, and optional trend arrows. Supports two variants:
 * - `compact`: 2-column inline grid, no outer title
 * - `full`: Card with optional title header
 *
 * @example
 * ```tsx
 * <DataCallout
 *   variant="full"
 *   title="Key Metrics"
 *   items={[
 *     { label: 'Median Home Value', value: '$425K', trend: 'up', subtext: '+5.2% YoY' },
 *     { label: 'Days on Market', value: '28', trend: 'down', subtext: '-12 from last year' },
 *   ]}
 * />
 * ```
 */
export function DataCallout({
  items,
  variant = "compact",
  title,
}: DataCalloutProps): React.ReactElement {
  const gridContent = (
    <div className="grid grid-cols-2 gap-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="report-metric-label truncate">{item.label}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="report-metric-value text-lg">{item.value}</span>
            {item.trend && <TrendIndicator trend={item.trend} />}
          </div>
          {item.subtext && (
            <p className="text-xs text-[var(--report-stone-light)] mt-1 truncate">
              {item.subtext}
            </p>
          )}
        </div>
      ))}
    </div>
  );

  if (variant === "compact") {
    return (
      <div className="bg-[var(--report-cream-dark)] rounded-xl p-4 my-4">
        {gridContent}
      </div>
    );
  }

  // Full variant: card with optional title
  return (
    <div className="report-card p-5 my-4">
      {title && (
        <h3
          className="report-heading-sm mb-4 pb-3"
          style={{ borderBottom: "1px solid rgba(29, 27, 32, 0.06)" }}
        >
          {title}
        </h3>
      )}
      {gridContent}
    </div>
  );
}
