/**
 * Shared constants for all snapshot recorder sub-services.
 */

export interface DataSourceTableConfig {
  table: string;
  dateColumn: string;
  expectedFreshnessDays: number;
}

/**
 * Maps source names to the actual Supabase table used for freshness checks.
 *
 * Table names and date columns are aligned with the working DataSourcesHealthService
 * and DataFreshnessService in packages/backend/src/health/ to ensure consistency.
 */
export const DATA_SOURCE_TABLE_MAP: Record<string, DataSourceTableConfig> = {
  zillow: {
    table: 'zillow_metro',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
  },
  realtor: {
    table: 'realtor_metro',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
  },
  census_acs: {
    table: 'census_county',
    dateColumn: 'year',
    expectedFreshnessDays: 900,
  },
  bls: {
    table: 'economic_county',
    dateColumn: 'period_date',
    expectedFreshnessDays: 95,
  },
  fred: {
    table: 'economic_national',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
  },
  hud_fmr: {
    table: 'hud_fmr',
    dateColumn: 'year',
    expectedFreshnessDays: 438,
  },
  building_permits: {
    table: 'permits_county',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
  },
  redfin_sales: {
    table: 'redfin_metro',
    dateColumn: 'period_end',
    expectedFreshnessDays: 60,
  },
  redfin_rental: {
    table: 'redfin_rental_city',
    dateColumn: 'period_date',
    expectedFreshnessDays: 60,
  },
};

export const SCORE_TYPES = ['propertyiq'] as const;
export type ScoreType = (typeof SCORE_TYPES)[number];
