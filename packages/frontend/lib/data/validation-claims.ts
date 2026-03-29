/**
 * Homepage Validation Claims — Single Source of Truth
 *
 * All marketing claims on the homepage are derived from OOS (out-of-sample)
 * walk-forward validation results. When validation reports are re-run:
 *
 *   1. Update these numbers from the latest validation_report.md
 *   2. Update the matching values in packages/backend/src/reports/validation-credibility.ts
 *   3. Both files stay in sync — frontend claims match AI report citations
 *
 * Source: scripts/analysis/output/validation_report.md (v3, 2026-03-04)
 * Methodology: XGBoost/LightGBM tournament → SHAP-distilled linear weights
 * Validation: 4 non-overlapping walk-forward windows, 2018-2023
 */

/** PropertyIQ v4 Demand Signal Validation Claims — single PropertyIQ Score */
export const V4_CLAIMS = {
  /** Q5 vs Q1 dollar gap, 3Y, metro (median home $245,361) */
  metroGap3Y: 18_100,
  /** Q5 vs Q1 dollar gap, 1Y, metro */
  metroGap1Y: 9_199,
  /** 3Y quintile spread (percentage points) */
  alpha3Y_pp: 7.83,
  /** 1Y quintile spread (percentage points) */
  alpha1Y_pp: 2.9,
  /** % of years Q5 beat Q1 (1Y) */
  yearHitRate1Y: 100,
  /** % of years Q5 beat Q1 (3Y) */
  yearHitRate3Y: 100,
  /** OOS Information Coefficient */
  ic1Y: 0.24,
  ic3Y: 0.23,
  /** Information Ratio */
  ir1Y: 3.65,
  ir3Y: 6.56,
  /** Coverage */
  metrosValidated: 746,
  countiesValidated: 2_983,
  zipsValidated: 19_880,
  totalObservations: 3_177_707,
  backtestYears: 13,
  /** Median home value used for dollar calculations */
  medianHomeValue: 245_361,
  /** Score 80+ 3Y excess vs state */
  topQuintile3YExcess: 1.87,
  /** Score 20 3Y excess vs state */
  bottomQuintile3YExcess: -3.34,
} as const;

/** Returns formatted claims for homepage hero section */
export function getV4HomepageClaims() {
  return {
    dollarGap: `$${V4_CLAIMS.metroGap3Y.toLocaleString()}`,
    dollarGapRaw: V4_CLAIMS.metroGap3Y,
    alphaPp: `${V4_CLAIMS.alpha3Y_pp}pp`,
    yearHitRate: `${V4_CLAIMS.yearHitRate1Y}%`,
    metrosValidated: V4_CLAIMS.metrosValidated,
    backtestYears: V4_CLAIMS.backtestYears,
    totalMarkets:
      V4_CLAIMS.metrosValidated +
      V4_CLAIMS.countiesValidated +
      V4_CLAIMS.zipsValidated,
  };
}

/** Format a number as currency: $13,320 */
export function formatDollarClaim(value: number): string {
  return "$" + value.toLocaleString("en-US");
}

/** Format a number with K suffix: $13K */
export function formatDollarClaimShort(value: number): string {
  if (value >= 1_000) {
    const k = Math.round(value / 1_000);
    return `$${k.toLocaleString("en-US")}K`;
  }
  return formatDollarClaim(value);
}

/** Format observation count: "828,000+" */
export function formatObservations(count: number): string {
  return Math.round(count / 1_000).toLocaleString("en-US") + "K+";
}
