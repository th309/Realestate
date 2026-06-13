/**
 * Homepage Validation Claims — Single Source of Truth
 *
 * All marketing claims on the homepage are derived from OOS (out-of-sample)
 * walk-forward validation results. When validation reports are re-run:
 *
 *   1. Update these numbers from the latest backtest artifacts
 *   2. Update the matching values in packages/backend/src/reports/validation-credibility.ts
 *   3. Both files stay in sync — frontend claims match AI report citations
 *
 * Source (2026-06-12): scripts/analysis/monolithic-discovery/data/claims_stats.json,
 *   derived from data/{level}_score_history.parquet joined to zhvi_forward_returns
 *   (the three committed metro/county/zip score backtests + the monolithic feature
 *   discovery, docs/superpowers/results/2026-06-12-*).
 * Formula: PropertyIQ demand signal = +z(zhvi_yoy) +z(zhvi_mom_3m)
 *   -z(median_days_on_market) -z(price_reduced_share); equal weights, no fitted params.
 * Claims window: full-formula era only (2016+), metro level unless noted.
 *
 * Semantics (from claims_stats.json _meta): IC values are horizon-specific median
 *   yearly Spearman(score, excess-vs-state). spread_*_pp and quintile excess are
 *   ANNUALIZED (3y) / 1-year percentage points. simple_all_years dollar deltas are
 *   CUMULATIVE 3-year ZHVI appreciation (score 99 vs 1). within_state dollar deltas
 *   are top-band (95-99) vs bottom-band (1-5) annualized excess compounded over 3y
 *   on a 4%/yr state base.
 */

/** PropertyIQ Demand Signal Validation Claims — single PropertyIQ Score */
export const V4_CLAIMS = {
  /** Top vs bottom band dollar gap, 3Y, within-state, metro (median home $251,629).
   *  Source: metro.dollar_examples.within_state.dollar_delta */
  metroGap3Y: 21_741,
  /** 1Y within-state dollar gap, metro — NO 1Y field in claims_stats.json;
   *  retained from the prior artifact (no current source). */
  metroGap1Y: 9_199,
  /** Score 99 vs Score 1 cumulative 3Y dollar gap, metro.
   *  Source: metro.dollar_examples.simple_all_years.dollar_delta */
  scoreExtreme3YGap: 41_166,
  /** Score 99 vs Score 1 dollar gap, 1Y, metro — NO 1Y field in claims_stats.json;
   *  retained from the prior artifact (no current source). */
  scoreExtreme1YGap: 9_199,
  /** 3Y decile spread, ANNUALIZED, percentage points.
   *  Source: metro.spread_3y_decile_pp */
  alpha3Y_pp: 2.28,
  /** 1Y decile spread, percentage points.
   *  Source: metro.spread_1y_decile_pp */
  alpha1Y_pp: 3.25,
  /** % of years with positive median IC (1Y hit rate).
   *  Source: metro.ic_1y_pct_positive_years */
  yearHitRate1Y: 100,
  /** % of years with positive median IC (3Y hit rate).
   *  Source: metro.ic_3y_pct_positive_years */
  yearHitRate3Y: 100,
  /** OOS Information Coefficient (median yearly Spearman).
   *  Source: metro.ic_1y_median_yearly (0.2332) / ic_3y_median_yearly (0.2731) */
  ic1Y: 0.23,
  ic3Y: 0.27,
  /** Information Ratio — NO field in claims_stats.json; retained from prior
   *  artifact (no current source). */
  ir1Y: 3.65,
  ir3Y: 6.56,
  /** Coverage (distinct regions in the claims window).
   *  Source: {metro,county,zip}.coverage.n_regions */
  metrosValidated: 865,
  countiesValidated: 3_073,
  zipsValidated: 26_307,
  /** Total scored region-month rows across all three levels.
   *  Source: sum of {level}.coverage.n_scored_rows (94,019 + 328,862 + 2,706,066) */
  totalObservations: 3_128_947,
  /** Years of backtest history — NO direct field in claims_stats.json (the
   *  claims window spans 2016+ full-formula era; the underlying score history
   *  runs 2001–2023). Retained from prior artifact pending an explicit field. */
  backtestYears: 13,
  /** Median home value used for dollar calculations.
   *  Source: metro.median_home_value */
  medianHomeValue: 251_629,
  /** Score 80+ (band 81-99) ANNUALIZED 3Y excess vs state, pp.
   *  Source: metro.quintile_mean_excess_3y_pp["81-99"].mean_excess_pp */
  topQuintile3YExcess: 0.38,
  /** Score 20 (band 1-20) ANNUALIZED 3Y excess vs state, pp.
   *  Source: metro.quintile_mean_excess_3y_pp["1-20"].mean_excess_pp */
  bottomQuintile3YExcess: -1.29,
} as const;

/** Returns formatted claims for homepage hero section */
export function getV4HomepageClaims() {
  return {
    dollarGap: `$${V4_CLAIMS.scoreExtreme3YGap.toLocaleString()}`,
    dollarGapRaw: V4_CLAIMS.scoreExtreme3YGap,
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
