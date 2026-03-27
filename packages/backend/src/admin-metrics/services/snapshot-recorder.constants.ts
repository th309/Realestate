/**
 * Shared constants for all snapshot recorder sub-services.
 */

export interface DataSourceTableConfig {
  table: string;
  dateColumn: string;
  expectedFreshnessDays: number;
}

/** Maps data_source_registry.source_name to the primary DB table used for freshness checks. */
export const DATA_SOURCE_TABLE_MAP: Record<string, DataSourceTableConfig> = {
  zillow: {
    table: 'zillow_metro',
    dateColumn: 'period_date',
    expectedFreshnessDays: 36,
  },
  realtor: {
    table: 'realtor_metro',
    dateColumn: 'period_date',
    expectedFreshnessDays: 36,
  },
  census_acs: {
    table: 'census_acs_metro',
    dateColumn: 'period_date',
    expectedFreshnessDays: 438,
  },
  bls: {
    table: 'bls_metro',
    dateColumn: 'period_date',
    expectedFreshnessDays: 36,
  },
  fred: {
    table: 'fred_national',
    dateColumn: 'period_date',
    expectedFreshnessDays: 36,
  },
  hud_fmr: {
    table: 'hud_fmr_county',
    dateColumn: 'period_date',
    expectedFreshnessDays: 438,
  },
  building_permits: {
    table: 'building_permits_metro',
    dateColumn: 'period_date',
    expectedFreshnessDays: 36,
  },
  redfin_sales: {
    table: 'redfin_metro_sales',
    dateColumn: 'period_date',
    expectedFreshnessDays: 14,
  },
  redfin_rental: {
    table: 'redfin_metro_rental',
    dateColumn: 'period_date',
    expectedFreshnessDays: 36,
  },
};

export const SCORE_TYPES = [
  'homeready',
  'investor_edge',
  'market_health',
] as const;
export type ScoreType = (typeof SCORE_TYPES)[number];
