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

/** Median home value used for dollar impact calculations */
export const MEDIAN_HOME_VALUE = 240_000;

/** OOS quintile spreads in percentage points (top quintile − bottom quintile) */
export const OOS_QUINTILE_SPREAD = {
  metro_homeready: 2.66,
  metro_investoredge: 5.55,
  county_homeready: 2.49,
  county_investoredge: 2.49,
  zip_homeready: 1.69,
  zip_investoredge: 1.69,
} as const;

/** OOS information coefficients (score vs 3-year excess return correlation) */
export const OOS_IC = {
  metro_homeready: 0.3,
  metro_investoredge: 0.37,
  county_homeready: 0.246,
  county_investoredge: 0.246,
  zip_homeready: 0.184,
  zip_investoredge: 0.184,
} as const;

/** OOS hit rates (% of time top quintile outperforms bottom quintile) */
export const OOS_HIT_RATE = {
  metro_homeready: 63.8,
  metro_investoredge: 69.5,
} as const;

/** Validation scope */
export const VALIDATION_SCOPE = {
  totalObservations: 828_000, // Conservative: actual OOS observations
  metrosValidated: 924,
  countiesValidated: 2_482,
  zipsValidated: 19_923,
  backtestYears: 6,
  walkForwardWindows: 4,
  formulaVersion: "v3.0",
} as const;

/**
 * Derived homepage claims — computed from OOS data above.
 * These are what appear on the landing page.
 */
export function getHomepageClaims() {
  // Primary claim: InvestorEdge annual dollar alpha (strongest score)
  const annualAlphaInvestorEdge =
    (OOS_QUINTILE_SPREAD.metro_investoredge / 100) * MEDIAN_HOME_VALUE;
  const threeYearAlphaInvestorEdge = annualAlphaInvestorEdge * 3;

  // Secondary claim: HomeReady annual dollar alpha
  const annualAlphaHomeReady =
    (OOS_QUINTILE_SPREAD.metro_homeready / 100) * MEDIAN_HOME_VALUE;

  // Relative outperformance: top vs bottom quintile
  // From OOS data: top quintile avg excess ~+2.8pp, bottom ~-2.8pp
  // Relative outperformance = spread / abs(bottom quintile avg)
  // Conservative: use the spread as the claim, not a relative %
  const spreadPp = OOS_QUINTILE_SPREAD.metro_investoredge;

  // Alpha insight value (used in AlphaCallout)
  // Based on InvestorEdge annual dollar alpha
  const alphaInsightValue = annualAlphaInvestorEdge;

  return {
    /** Annual dollar alpha for InvestorEdge (top vs bottom quintile) */
    annualAlphaInvestorEdge: Math.round(annualAlphaInvestorEdge),
    /** 3-year dollar alpha for InvestorEdge */
    threeYearAlphaInvestorEdge: Math.round(threeYearAlphaInvestorEdge),
    /** Annual dollar alpha for HomeReady */
    annualAlphaHomeReady: Math.round(annualAlphaHomeReady),
    /** OOS quintile spread in pp */
    spreadPp,
    /** Hit rate for InvestorEdge */
    hitRate: OOS_HIT_RATE.metro_investoredge,
    /** Alpha insight dollar value (for AlphaCallout) */
    alphaInsightValue: Math.round(alphaInsightValue),
    /** Total OOS observations */
    totalObservations: VALIDATION_SCOPE.totalObservations,
    /** Backtest years */
    backtestYears: VALIDATION_SCOPE.backtestYears,
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
