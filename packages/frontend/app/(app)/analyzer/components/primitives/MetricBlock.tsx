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

const SIZE = {
  sm: { value: "text-base", label: "text-[11px]" },
  md: { value: "text-xl", label: "text-xs" },
  lg: { value: "text-4xl", label: "text-[13px]" },
  xl: { value: "text-[56px]", label: "text-sm" },
} as const;

function formatNumericValue(
  raw: number,
  format: NonNullable<MetricBlockProps["format"]>,
  decimals: number,
): string {
  if (!Number.isFinite(raw)) return "—";
  if (format === "raw") return String(raw);

  if (format === "currency") {
    const abs = Math.abs(raw);
    const sign = raw < 0 ? "−" : "";
    if (abs >= 1000) return `${sign}$${Math.round(abs).toLocaleString()}`;
    return `${sign}$${abs.toFixed(2)}`;
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
      <div
        className={`${sz.label} font-medium`}
        style={{
          color: piq.textMuted,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>
      <div
        className={`${sz.value} font-semibold`}
        style={{
          color: valueColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
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
