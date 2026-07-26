// packages/backend/src/content-pipeline/gates/claim-tolerance.ts
import type { NumericClaim } from './gate.types';

const TOLERANCES_BALANCED: Record<string, number> = {
  price: 1000,
  percentage: 0.5,
  score: 0,
  ranking: 0,
  count: 0,
  duration: 0.1,
  date: 0,
};

/** VO hedges ("roughly fifteen months") — allow one extra month vs bundle math. */
function isHedgedDurationQuote(quote: string | undefined): boolean {
  if (!quote || typeof quote !== 'string') return false;
  return /\b(roughly|about|around|approximately|nearly|~|almost)\b/i.test(
    quote,
  );
}

function baseToleranceFor(
  cat: NumericClaim['category'],
  claimValue?: number,
): number {
  const strictness = process.env.CONTENT_PIPELINE_GATE_STRICTNESS ?? 'balanced';
  const multiplier =
    strictness === 'relaxed' ? 2 : strictness === 'strict' ? 0.5 : 1;
  const base = TOLERANCES_BALANCED[cat] ?? 0;
  // Prices use a 1% percentage floor so "about $1 million" matches $1,004,500.
  if (cat === 'price' && claimValue !== undefined) {
    return Math.max(base, Math.abs(claimValue) * 0.01) * multiplier;
  }
  // Count claims (populations, listings, etc.) tolerate 5% drift for
  // natural rounding: "over 2.1 million" against 2,050,000 is within norms
  // for a human-readable script. Scores, rankings, and dates stay strict.
  if (cat === 'count' && claimValue !== undefined) {
    return Math.max(base, Math.abs(claimValue) * 0.05) * multiplier;
  }
  // Month-span narration vs calendar-derived candidates: ±1 month slack when
  // the claim is a multi-month whole number (not DOM-style decimals).
  if (
    cat === 'duration' &&
    claimValue !== undefined &&
    claimValue >= 4 &&
    Number.isInteger(claimValue)
  ) {
    return Math.max(base, 1) * multiplier;
  }
  return base * multiplier;
}

/**
 * How far a script's number may drift from the data bundle before it counts
 * as a violation, given the claim's category, magnitude, and phrasing.
 */
export function toleranceForClaim(claim: NumericClaim): number {
  const tolerance = baseToleranceFor(claim.category, claim.value);
  if (claim.category === 'duration' && isHedgedDurationQuote(claim.quote)) {
    return tolerance + 1;
  }
  return tolerance;
}
