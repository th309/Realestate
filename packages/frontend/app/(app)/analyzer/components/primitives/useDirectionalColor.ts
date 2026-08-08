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
export type DirectionalLevel = "good" | "warn" | "bad" | "neutral" | "muted";

/**
 * The health verdict behind the colour, as a semantic level.
 *
 * Extracted so consumers that render tokens rather than piq colour strings —
 * the shared KpiTile, whose stripe and tone are Tailwind classes — can reuse
 * the exact same thresholds instead of re-deriving them and drifting.
 */
export function directionalLevel({
  value,
  variant,
  threshold,
}: DirectionalColorOpts): DirectionalLevel {
  if (variant === "neutral" || !Number.isFinite(value)) return "neutral";

  if (variant === "score") {
    if (value >= 70) return "good";
    if (value >= 40) return "warn";
    return "bad";
  }

  // variant === "directional"
  if (threshold) {
    if (value >= threshold.good) return "good";
    if (value >= threshold.warning) return "warn";
    return "bad";
  }

  if (value > 0) return "good";
  if (value < 0) return "bad";
  return "muted";
}

const LEVEL_COLOR: Record<DirectionalLevel, string> = {
  good: piq.green,
  warn: piq.amber,
  bad: piq.red,
  neutral: piq.textPrimary,
  muted: piq.textMuted,
};

export function useDirectionalColor(opts: DirectionalColorOpts): string {
  return LEVEL_COLOR[directionalLevel(opts)];
}
