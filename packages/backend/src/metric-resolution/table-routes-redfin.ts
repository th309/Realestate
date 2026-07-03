/**
 * Redfin Table Route Definitions
 *
 * Split out of table-routes.ts for file-size compliance. Covers both the
 * legacy `redfin_*` tables (frozen — Redfin stopped updating them) and the
 * go-forward `redfin_dc_housing_market_*` Data Center tables, plus the
 * metro-only Redfin migration table.
 *
 * Pure functions — no class, no DI, no DB access.
 */

import { GeoLevel, TableRoute } from './metric-resolution.types';

/**
 * Legacy Redfin tables (redfin_*). FROZEN — no longer updated. Kept only as a
 * last-resort fallback for metrics/geos the fresh sources don't yet cover.
 * Rows are keyed by true CBSA/FIPS/ZIP and carry a property_type dimension
 * (the single-value fetcher filters to 'All Residential').
 */
export function getRedfinRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case 'national':
      return {
        table: 'redfin_national',
        idColumn: 'region_name',
        dateColumn: 'period_end',
      };
    case 'state':
      return {
        table: 'redfin_state',
        idColumn: 'state_code',
        dateColumn: 'period_end',
      };
    case 'metro':
      return {
        table: 'redfin_metro',
        idColumn: 'cbsa_code',
        dateColumn: 'period_end',
      };
    case 'county':
      return {
        table: 'redfin_county',
        idColumn: 'fips_code',
        dateColumn: 'period_end',
      };
    case 'zip':
      return {
        table: 'redfin_zip',
        idColumn: 'zip_code',
        dateColumn: 'period_end',
      };
    default:
      return null;
  }
}

/**
 * Redfin Data Center monthly tables — the replacement for the frozen redfin_*
 * tables. One row per (region_id, period_end), all frequency='Monthly', so the
 * generic wide-table fetch (latest period) needs no property_type/frequency
 * filter. region_id is the true CBSA (metro) / county FIPS (county) / ZIP (zip),
 * so the standard per-level geo-id normalization applies unchanged.
 *
 * State is keyed by STATE FIPS ('08' = Colorado), NOT the 2-letter code — the
 * source-fetcher normalizes redfin_dc* state ids to FIPS (like census/economic)
 * so this route resolves correctly. National is intentionally unrouted: the DC
 * "country" table uses an opaque region_id we don't map to the 'national' geo.
 */
export function getRedfinDcRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case 'state':
      return {
        table: 'redfin_dc_housing_market_state',
        idColumn: 'region_id',
        dateColumn: 'period_end',
      };
    case 'metro':
      return {
        table: 'redfin_dc_housing_market_metro',
        idColumn: 'region_id',
        dateColumn: 'period_end',
      };
    case 'county':
      return {
        table: 'redfin_dc_housing_market_county',
        idColumn: 'region_id',
        dateColumn: 'period_end',
      };
    case 'zip':
      return {
        table: 'redfin_dc_housing_market_zip',
        idColumn: 'region_id',
        dateColumn: 'period_end',
      };
    default:
      return null;
  }
}

export function getRedfinMigrationRoute(geoLevel: GeoLevel): TableRoute | null {
  if (geoLevel !== 'metro') return null;
  return {
    table: 'redfin_migration_metro',
    idColumn: 'cbsa_code',
    dateColumn: 'period_date',
  };
}
