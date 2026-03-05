/**
 * Match Source Routing
 *
 * Maps market-match metric IDs to their primary database source tables
 * and columns for bulk queries. Mirrors the fallback registry's primary
 * source but returns table routing info suitable for SELECT queries
 * across all regions at a geography level.
 *
 * Used by MarketMatchService.fetchMetricForAllRegions() to avoid
 * per-region resolution when scoring all markets at once.
 */

import { GeoLevel } from '../metric-resolution/metric-resolution.types';

export interface SourceTableRoute {
  table: string;
  idColumn: string;
  valueColumn: string;
}

/**
 * Resolve the source table, ID column, and value column for a metric
 * at a given geography level. Returns null if the metric is not mapped.
 */
export function getMatchSourceTable(
  metricId: string,
  geoLevel: GeoLevel,
): SourceTableRoute | null {
  const geoSuffix = geoLevel === 'national' ? 'state' : geoLevel;

  const defaultIdColumns: Record<string, string> = {
    state: 'state_fips',
    metro: 'cbsa_code',
    county: 'county_fips',
    zip: 'postal_code',
  };
  const defaultIdCol = defaultIdColumns[geoSuffix] ?? 'cbsa_code';

  const zillowIdColumns: Record<string, string> = {
    state: 'state_abbrev',
    metro: 'cbsa_code',
    county: 'county_fips',
    zip: 'zip_code',
  };

  // Metric → { table template, valueColumn, tableFamily }
  const sourceMap: Record<
    string,
    { table: string; valueColumn: string; family: string }
  > = {
    home_value: {
      table: `zillow_${geoSuffix}`,
      valueColumn: 'zhvi',
      family: 'zillow',
    },
    home_value_yoy: {
      table: `realtor_${geoSuffix}`,
      valueColumn: 'median_listing_price_yy',
      family: 'realtor',
    },
    home_price_forecast: {
      table: `zillow_${geoSuffix}`,
      valueColumn: 'zhvf_12m',
      family: 'zillow',
    },
    rent_index: {
      table: `zillow_${geoSuffix}`,
      valueColumn: 'zori',
      family: 'zillow',
    },
    days_on_market: {
      table: `realtor_${geoSuffix}`,
      valueColumn: 'median_days_on_market',
      family: 'realtor',
    },
    for_sale_inventory: {
      table: `realtor_${geoSuffix}`,
      valueColumn: 'active_listing_count',
      family: 'realtor',
    },
    unemployment_rate: {
      table: 'economic_indicators',
      valueColumn: 'unemployment_rate',
      family: 'economic',
    },
    job_growth: {
      table: 'economic_indicators',
      valueColumn: 'employment_yoy',
      family: 'economic',
    },
    income_growth: {
      table: `census_${geoSuffix}`,
      valueColumn: 'income_yoy',
      family: 'census',
    },
    population_growth: {
      table: `census_${geoSuffix}`,
      valueColumn: 'population_yoy',
      family: 'census',
    },
    gross_yield: {
      table: 'calculated_metrics',
      valueColumn: 'annual_rent_price_ratio',
      family: 'calculated',
    },
    cap_rate: {
      table: 'calculated_metrics',
      valueColumn: 'cap_rate_proxy',
      family: 'calculated',
    },
    income_to_buy: {
      table: 'calculated_metrics',
      valueColumn: 'income_to_buy',
      family: 'calculated',
    },
    years_to_save: {
      table: `zillow_${geoSuffix}`,
      valueColumn: 'years_to_save',
      family: 'zillow',
    },
  };

  const config = sourceMap[metricId];
  if (!config) return null;

  // Select ID column based on table family
  let idColumn: string;
  switch (config.family) {
    case 'zillow':
      idColumn = zillowIdColumns[geoSuffix] ?? defaultIdCol;
      break;
    case 'calculated':
    case 'economic':
      idColumn = 'region_id';
      break;
    default:
      idColumn = defaultIdCol;
      break;
  }

  return {
    table: config.table,
    idColumn,
    valueColumn: config.valueColumn,
  };
}
