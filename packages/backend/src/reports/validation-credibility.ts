/**
 * Validation Credibility Layer
 *
 * Provides real validation statistics from backtest results for use as
 * template variables in AI-generated report narratives. These stats let
 * the AI cite concrete validation evidence, increasing report credibility.
 *
 * Numbers sourced from the PropertyIQ validation report (2026-06-13):
 *   - packages/frontend/app/scores/methodology/validation-report.md
 *   - scripts/analysis/monolithic-discovery/data/{claims_stats,validation_rank2,*_score_backtest}.json
 *
 * NOTE: the legacy 3-score system (HomeReady/InvestorEdge/MarketHealth) was
 * retired. There is a single PropertyIQ Score. The *_homeready / *_investoredge
 * field and var names are kept only for backward compatibility with existing
 * report templates; they all now carry the same unified PropertyIQ values.
 */

export interface ValidationStats {
  /** Total metro areas in the validation sample */
  metros_validated: number;
  /** Total counties in the validation sample */
  counties_validated: number;
  /** Total ZIP codes in the validation sample */
  zips_validated: number;
  /** Total scored observations across all geos and periods */
  total_observations: string;

  /** Human-readable PropertyIQ homebuyer quintile performance statement */
  propertyiq_homebuyer_quintile_performance: string;
  /** Human-readable PropertyIQ investor quintile performance statement */
  propertyiq_investor_quintile_performance: string;

  /** Information coefficient summary */
  information_coefficient_homebuyer: string;
  information_coefficient_investor: string;

  /** Years of backtest data */
  backtest_years: number;
  /** Walk-forward windows used */
  walkforward_windows: number;

  /** Plain-language methodology explanation for homebuyer reports */
  methodology_summary_homebuyer: string;
  /** Plain-language methodology explanation for investor reports */
  methodology_summary_investor: string;

  /** Comma-separated list of data sources */
  data_sources_list: string;
  /** Number of distinct data sources */
  data_sources_count: number;

  /** OOS validation reliability across score types */
  oos_hit_rate_homeready: string;
  oos_hit_rate_investoredge: string;

  /** Dollar alpha per property (conservative OOS estimates) */
  annual_dollar_alpha_homeready: string;
  annual_dollar_alpha_investoredge: string;

  /** Validation formula identifier */
  formula_version: string;
}

/**
 * Returns validation statistics extracted from real backtest results.
 *
 * All numbers come from the single PropertyIQ Score validation:
 * - Formula: +z(zhvi_yoy) +z(zhvi_mom_3m) -z(median_days_on_market)
 *   -z(price_reduced_share); equal weights, no fitted parameters
 * - Target: 3-year forward excess return vs state median appreciation
 * - Out-of-sample by construction (scores evaluated only against later returns),
 *   summarized per calendar year across 2001-2023
 */
export function getValidationStats(): ValidationStats {
  // Metro-level figures (the level cited in narratives). Out-of-sample,
  // 3-year excess return vs state. Source: validation-report.md.
  const quintilePerformance =
    'Top-band PropertyIQ markets (score 95-99) have historically outperformed ' +
    'bottom-band markets (score 1-5) in the same state by about 1.7 percentage ' +
    'points per year over the following 3 years (out-of-sample, excess vs state).';
  const icSummary =
    'Out-of-sample information coefficient of 0.27 across 865 metros, positive ' +
    'in every validated year (2001-2023).';
  const methodology =
    'PropertyIQ scores predict which markets will outperform their state over ' +
    'the next 3 years. The score combines Zillow home-value momentum (3- and ' +
    '12-month) with Realtor.com market-flow signals (how fast homes sell and how ' +
    'often sellers cut prices). It is validated with forward-looking, ' +
    'out-of-sample testing across 865 metros and more than two decades of price ' +
    'outcomes; the score-to-return relationship was positive in every validated year.';

  return {
    // Validation sample (regions with an observed 3-year forward outcome)
    metros_validated: 865,
    counties_validated: 3061,
    zips_validated: 25783,
    total_observations: '5,706,569',

    // Quintile performance (single PropertyIQ score; both kept for template compat)
    propertyiq_homebuyer_quintile_performance: quintilePerformance,
    propertyiq_investor_quintile_performance: quintilePerformance,

    // Information coefficient (out-of-sample, metro)
    information_coefficient_homebuyer: icSummary,
    information_coefficient_investor: icSummary,

    // Backtest period: 2001-2023 scoring vintages with 3Y forward outcomes
    backtest_years: 22,
    walkforward_windows: 8,

    // Methodology summaries (single score)
    methodology_summary_homebuyer: methodology,
    methodology_summary_investor: methodology,

    // Data sources used by the score
    data_sources_list: 'Zillow, Realtor.com',
    data_sources_count: 2,

    // OOS reliability: positive in every validated calendar year
    oos_hit_rate_homeready: 'positive in 100% of validated years',
    oos_hit_rate_investoredge: 'positive in 100% of validated years',

    // Dollar alpha: within-state top-vs-bottom band excess, ~$21,741 over 3 years
    annual_dollar_alpha_homeready: '$7,247',
    annual_dollar_alpha_investoredge: '$7,247',

    // Non-versioned identifier (the formula IS the PropertyIQ score)
    formula_version: 'PropertyIQ demand signal',
  };
}

/**
 * Returns a subset of validation stats formatted as template variables
 * ready to be spread into the narrative template var map.
 */
export function getValidationTemplateVars(): Record<string, string | number> {
  const stats = getValidationStats();
  return {
    // Direct stats for {{placeholder}} use in prompts
    validation_metros_validated: stats.metros_validated,
    validation_counties_validated: stats.counties_validated,
    validation_zips_validated: stats.zips_validated,
    validation_total_observations: stats.total_observations,
    validation_backtest_years: stats.backtest_years,
    validation_formula_version: stats.formula_version,
    validation_data_sources: stats.data_sources_list,
    validation_data_sources_count: stats.data_sources_count,

    // Quintile performance
    validation_homeready_quintile:
      stats.propertyiq_homebuyer_quintile_performance,
    validation_investoredge_quintile:
      stats.propertyiq_investor_quintile_performance,

    // IC stats
    validation_ic_homeready: stats.information_coefficient_homebuyer,
    validation_ic_investoredge: stats.information_coefficient_investor,

    // Reliability
    validation_hit_rate_homeready: stats.oos_hit_rate_homeready,
    validation_hit_rate_investoredge: stats.oos_hit_rate_investoredge,

    // Dollar alpha
    validation_dollar_alpha_homeready: stats.annual_dollar_alpha_homeready,
    validation_dollar_alpha_investoredge:
      stats.annual_dollar_alpha_investoredge,

    // Methodology summaries
    methodology_summary_homebuyer: stats.methodology_summary_homebuyer,
    methodology_summary_investor: stats.methodology_summary_investor,
  };
}
