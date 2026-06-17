/**
 * Validation ("Validated track record") section for the listing-presentation report.
 *
 * HONESTY CONTRACT: PropertyIQ has NO per-market validation data — backtest
 * outcomes are stored per market, but accuracy/excess-return statistics are only
 * computed at the geo-TYPE level (across all metros / counties / ZIPs). So this
 * section presents the SANCTIONED, geo-type-level validated statistics verbatim
 * from `validation-credibility.ts` (the single vetted source used by production
 * report narratives) and the copy never claims accuracy "in this specific metro."
 */

import { getValidationStats } from '../reports/validation-credibility';

export interface ValidationSectionData {
  metrosValidated: number;
  countiesValidated: number;
  zipsValidated: number;
  backtestYears: number;
  /** within-state top-vs-bottom-band dollar alpha, e.g. "$7,247" */
  dollarAlpha: string;
  /** sanctioned out-of-sample information-coefficient statement */
  icStatement: string;
  /** sanctioned quintile/outperformance statement (excess vs state) */
  outperformanceStatement: string;
  /** sanctioned reliability statement, e.g. "positive in 100% of validated years" */
  hitRateStatement: string;
  /** the report's geo level, for downstream framing */
  geoLevel: string;
}

export function buildValidationSection(
  geoLevel: string,
): ValidationSectionData {
  const s = getValidationStats();
  return {
    metrosValidated: s.metros_validated,
    countiesValidated: s.counties_validated,
    zipsValidated: s.zips_validated,
    backtestYears: s.backtest_years,
    dollarAlpha: s.annual_dollar_alpha_homeready,
    icStatement: s.information_coefficient_homebuyer,
    outperformanceStatement: s.propertyiq_homebuyer_quintile_performance,
    hitRateStatement: s.oos_hit_rate_homeready,
    geoLevel,
  };
}
