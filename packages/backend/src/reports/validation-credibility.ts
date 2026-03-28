/**
 * Validation Credibility Layer
 *
 * Provides real validation statistics from backtest results for use as
 * template variables in AI-generated report narratives. These stats let
 * the AI cite concrete validation evidence, increasing report credibility.
 *
 * Numbers sourced from:
 *   - scripts/analysis/output/validation_report.md (v3.0 XGBoost/LightGBM tournament pipeline)
 */

export interface ValidationStats {
  /** Total metro areas validated across all backtest periods */
  metros_validated: number;
  /** Total counties validated */
  counties_validated: number;
  /** Total ZIP codes validated */
  zips_validated: number;
  /** Total scored observations across all geos and periods */
  total_observations: string;

  /** Human-readable HomeReady quintile performance statement */
  homeready_quintile_performance: string;
  /** Human-readable InvestorEdge quintile performance statement */
  investoredge_quintile_performance: string;

  /** Information coefficient summary */
  information_coefficient_homeready: string;
  information_coefficient_investoredge: string;

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

  /** OOS hit rate across score types */
  oos_hit_rate_homeready: string;
  oos_hit_rate_investoredge: string;

  /** Dollar alpha per property (conservative OOS estimates) */
  annual_dollar_alpha_homeready: string;
  annual_dollar_alpha_investoredge: string;

  /** Validation formula version */
  formula_version: string;
}

/**
 * Returns validation statistics extracted from real backtest results.
 *
 * All numbers sourced from the v3.0 scoring pipeline:
 * - XGBoost/LightGBM tournament with walk-forward cross-validation
 * - 4 walk-forward windows, state benchmarks
 * - SHAP-distilled linear weights
 */
export function getValidationStats(): ValidationStats {
  return {
    // Geography coverage (from v3 live validation: 924 metros, 2482 counties, 19923 ZIPs)
    metros_validated: 924,
    counties_validated: 2482,
    zips_validated: 19923,
    total_observations: '1,503,719',

    // Quintile performance (v3 OOS results)
    homeready_quintile_performance:
      'Top-quintile HomeReady markets outperform bottom-quintile by 2.66 percentage points annually (out-of-sample)',
    investoredge_quintile_performance:
      'Top-quintile InvestorEdge markets outperform bottom-quintile by 5.55 percentage points annually (out-of-sample)',

    // Information coefficients (v3 OOS, averaged across windows)
    information_coefficient_homeready:
      'Out-of-sample IC of 0.30 across 924 metros (4 walk-forward windows)',
    information_coefficient_investoredge:
      'Out-of-sample IC of 0.37 across 924 metros (4 walk-forward windows)',

    // Backtest period
    backtest_years: 6, // 2018-2023 training + 3Y outcome horizon
    walkforward_windows: 4,

    // Methodology summaries
    methodology_summary_homebuyer:
      'PropertyIQ HomeReady scores predict which markets will outperform their state peers ' +
      'over the next 3 years. The model was trained using walk-forward cross-validation ' +
      '(never seeing future data) on 6 years of real price outcomes across 924 metros. ' +
      'Scores rank markets reliably — top-quintile markets have outperformed 64% of the time.',
    methodology_summary_investor:
      'PropertyIQ InvestorEdge scores predict which markets will deliver the highest total return ' +
      '(appreciation plus rent growth) relative to state peers over 3 years. Trained on 6 years of ' +
      'actual returns across 924 metros using XGBoost with SHAP-distilled weights, the model achieves ' +
      'an out-of-sample information coefficient of 0.37 — top-quintile markets outperform 70% of the time.',

    // Data sources
    data_sources_list: 'Zillow, Redfin, Realtor.com, Census ACS, BLS, FRED',
    data_sources_count: 6,

    // OOS hit rates (v3)
    oos_hit_rate_homeready: '63.8%',
    oos_hit_rate_investoredge: '69.5%',

    // Dollar alpha (v3 OOS estimates on median home values)
    annual_dollar_alpha_homeready: '$3,537',
    annual_dollar_alpha_investoredge: '$11,144',

    // Formula version
    formula_version: 'v3.0',
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
    validation_homeready_quintile: stats.homeready_quintile_performance,
    validation_investoredge_quintile: stats.investoredge_quintile_performance,

    // IC stats
    validation_ic_homeready: stats.information_coefficient_homeready,
    validation_ic_investoredge: stats.information_coefficient_investoredge,

    // Hit rates
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
