/**
 * Formatting + delta math for the insights dashboard. Kept pure and separate so
 * the 30d-vs-prior comparison logic (easy to get wrong at the zero-prior edge)
 * is unit-testable.
 */

const COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** e.g. 12345 → "12.3K", 1200000 → "1.2M". */
export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return COMPACT.format(n);
}

/** Signed compact, for net-change values like follower delta: "+1.2K" / "-340". */
export function formatSignedCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const magnitude = COMPACT.format(Math.abs(n));
  if (n > 0) return `+${magnitude}`;
  if (n < 0) return `-${magnitude}`;
  return magnitude;
}

export type DeltaDirection = "up" | "down" | "flat";

export interface DeltaResult {
  direction: DeltaDirection;
  /** Short label: a percent ("8%"), "New" (grew from nothing), or "—" (no basis). */
  label: string;
}

/**
 * Percent change of `current` vs `prior`. Higher is treated as "up" (these are
 * all grow-is-good metrics). Zero prior can't yield a percent, so a nonzero
 * current reads as "New" and a zero current as "—".
 */
export function computeDelta(current: number, prior: number): DeltaResult {
  if (prior === 0) {
    if (current === 0) return { direction: "flat", label: "—" };
    return { direction: current > 0 ? "up" : "down", label: "New" };
  }
  const pct = Math.round(((current - prior) / Math.abs(prior)) * 100);
  if (pct === 0) return { direction: "flat", label: "0%" };
  return { direction: pct > 0 ? "up" : "down", label: `${Math.abs(pct)}%` };
}
