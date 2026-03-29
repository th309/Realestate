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

/** v4 Demand Signal Validation Claims — single PropertyIQ Score */
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
