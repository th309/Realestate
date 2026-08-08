"use client";

import { piq } from "./piqTokens";
import {
  useDirectionalColor,
  type DirectionalThreshold,
  type DirectionalVariant,
} from "./useDirectionalColor";

export type MetricBlockProps = {
  /** Muted label above the value. Sentence case ("Monthly cash flow"). */
  label: string;
  /** Raw value — MetricBlock owns the formatting. */
  value: number | string;
  /** Format applied to numeric values. Strings always pass through verbatim. */
  format?: "currency" | "percent" | "number" | "ratio" | "raw";
  /** Decimals for `percent` and `number`. Defaults to 1. */
  decimals?: number;
  /** Optional sub-line beneath the value (e.g., "Year 12 · 2038"). Tabular-nums, muted. */
  subLabel?: string;
  /** Optional change vs baseline. Signed; sign drives arrow + color. */
  delta?: number | null;
  deltaFormat?: "currency" | "percent" | "absolute";
  /** Trailing muted text after the delta ("vs market avg", "last month"). */
  deltaLabel?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: DirectionalVariant;
  threshold?: DirectionalThreshold;
  className?: string;
};

/**
 * Only the value scales. The label is a fixed 10px micro-label at every size —
 * it names the figure rather than competing with it, and holding it constant
 * is what lets a `lg` headline and an `sm` inline stat share a column without
 * reading as two different components.
 */
const SIZE = {
  sm: { value: "text-base" },
  md: { value: "text-xl" },
  lg: { value: "text-4xl" },
  xl: { value: "text-[56px]" },
} as const;

/**
 * Exported so the shared KpiTile can render the exact same string MetricBlock
 * would, rather than a second currency/percent implementation drifting beside it.
 */
export function formatNumericValue(
  raw: number,
  format: NonNullable<MetricBlockProps["format"]>,
  decimals: number,
): string {
  if (!Number.isFinite(raw)) return "—";
  if (format === "raw") return String(raw);

  if (format === "currency") {
    // Whole dollars at every magnitude. The old sub-$1,000 branch rendered
    // cents, so one cash-flow figure read "−$386.00" here and "−$386" in the
    // grading table -- two precisions for one quantity on one screen.
    const sign = raw < 0 ? "−" : "";
    return `${sign}$${Math.round(Math.abs(raw)).toLocaleString()}`;
  }

  if (format === "percent") return `${raw.toFixed(decimals)}%`;
  if (format === "ratio") return `${raw.toFixed(2)}x`;

  if (format === "number") {
    return raw.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return String(raw);
}

function formatDeltaValue(
  delta: number,
  deltaFormat: NonNullable<MetricBlockProps["deltaFormat"]>,
): string {
  const abs = Math.abs(delta);
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";

  if (deltaFormat === "currency") {
    if (abs >= 1000) return `${sign}$${Math.round(abs).toLocaleString()}`;
    return `${sign}$${abs.toFixed(2)}`;
  }
  if (deltaFormat === "percent") return `${sign}${abs.toFixed(1)}%`;
  return `${sign}${abs.toLocaleString()}`;
}

function arrowForDelta(delta: number): string {
  if (delta > 0) return "▲"; // ▲
  if (delta < 0) return "▼"; // ▼
  return "▶"; // ▶
}

export function MetricBlock({
  label,
  value,
  format = "raw",
  decimals = 1,
  subLabel,
  delta,
  deltaFormat = "absolute",
  deltaLabel,
  size = "lg",
  variant = "neutral",
  threshold,
  className = "",
}: MetricBlockProps) {
  const sz = SIZE[size];
  const numericValue = typeof value === "number" ? value : NaN;

  // Always call unconditionally — NaN + variant=neutral both collapse to text-primary.
  const valueColor = useDirectionalColor({
    value: numericValue,
    variant,
    threshold,
  });

  const deltaNumeric = delta ?? 0;
  const deltaColor = useDirectionalColor({
    value: deltaNumeric,
    variant: "directional",
  });

  const formattedValue =
    typeof value === "string"
      ? value
      : formatNumericValue(value, format, decimals);

  return (
    <div
      data-metric-block
      data-size={size}
      data-variant={variant}
      className={`flex flex-col gap-1 ${className}`}
    >
      {/* The spec's `.lab` — every micro-label on the page is 10px/700 at
          0.11em uppercase, so a headline's caption matches the KPI captions
          and card eyebrows instead of being a third label style. */}
      <div className="text-[10px] font-bold uppercase tracking-[0.11em] text-piq-muted">
        {label}
      </div>
      {/* Mono, not sans. This is the page's headline figure; the spec sets
          every number in the mono face, and a 36px sans value beside mono KPI
          tiles and a mono grading table read as a different quantity. */}
      <div
        className={`${sz.value} font-mono font-semibold`}
        style={{
          color: valueColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {formattedValue}
      </div>
      {subLabel && (
        <div
          className="text-xs font-medium"
          style={{
            color: piq.textMuted,
            letterSpacing: "0.01em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {subLabel}
        </div>
      )}
      {delta != null && Number.isFinite(delta) && (
        <div
          className="text-sm flex items-baseline gap-1.5 font-medium"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <span style={{ color: deltaColor }}>
            {arrowForDelta(delta)} {formatDeltaValue(delta, deltaFormat)}
          </span>
          {deltaLabel && (
            <span style={{ color: piq.textMuted }}>{deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
