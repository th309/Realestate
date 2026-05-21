import { piq } from "./piqTokens";

export type DirectionalVariant = "neutral" | "directional" | "score";

export type DirectionalThreshold = {
  good: number;
  warning: number;
};

export interface DirectionalColorOpts {
  value: number;
  variant: DirectionalVariant;
  threshold?: DirectionalThreshold;
}

/**
 * Resolve a piq palette color string for a value based on variant + thresholds.
 *
 * Named `use*` for call-site discipline (React component-only, top-level) but
 * pure — no React state, safe to call any number of times per render.
 *
 *   variant="neutral"      → always text-primary
 *   variant="directional"  → with threshold:    >= good → green, >= warning → amber, else red
 *                            without threshold:  > 0 → green, < 0 → red, === 0 → muted
 *   variant="score"        → 70+ → green, 40-69 → amber, 0-39 → red
 *
 * Non-finite values (NaN, Infinity) collapse to text-primary regardless of
 * variant — matches the analyzer convention of rendering "—" for missing data.
 */
export function useDirectionalColor({
  value,
  variant,
  threshold,
}: DirectionalColorOpts): string {
  if (variant === "neutral" || !Number.isFinite(value)) {
    return piq.textPrimary;
  }

  if (variant === "score") {
    if (value >= 70) return piq.green;
    if (value >= 40) return piq.amber;
    return piq.red;
  }

  // variant === "directional"
  if (threshold) {
    if (value >= threshold.good) return piq.green;
    if (value >= threshold.warning) return piq.amber;
    return piq.red;
  }

  if (value > 0) return piq.green;
  if (value < 0) return piq.red;
  return piq.textMuted;
}
