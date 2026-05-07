/**
 * Table Route Definitions
 *
 * Maps (dataSource, geoLevel) to the correct DB table, ID column,
 * name column, and date column. Extracted from SourceFetcherService
 * for file size compliance.
 *
 * Pure functions — no class, no DI, no DB access.
 */

import { GeoLevel, DataSource, TableRoute } from './metric-resolution.types';

export function getWideTableRoute(
  source: DataSource,
  geoLevel: GeoLevel,
): TableRoute | null {
  switch (source) {
    case 'realtor':
      return getRealtorRoute(geoLevel);
    case 'census':
      return getCensusRoute(geoLevel);
    case 'economic':
      return getEconomicRoute(geoLevel);
    case 'permits':
      return getPermitsRoute(geoLevel);
    case 'qcew':
      return getQcewRoute(geoLevel);
    case 'ces':
      return getCesRoute(geoLevel);
    case 'redfin_migration':
      return getRedfinMigrationRoute(geoLevel);
    case 'irs':
      return getIrsRoute(geoLevel);
    default:
      return null;
  }
}

export function getZillowRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case 'metro':
      return {
        table: 'zillow_metro',
        idColumn: 'cbsa_code',
        dateColumn: 'period_date',
      };
    case 'county':
      return {
        table: 'zillow_county',
        idColumn: 'fips_code',
        dateColumn: 'period_date',
      };
    case 'zip':
      return {
        table: 'zillow_zip',
        idColumn: 'region_name',
        dateColumn: 'period_date',
      };
    case 'state':
      return {
        table: 'zillow_state',
        idColumn: 'state_code',
        dateColumn: 'period_date',
      };
    default:
      return null;
  }
}

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

function getRealtorRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case 'metro':
      return {
        table: 'realtor_metro',
        idColumn: 'cbsa_code',
        nameColumn: 'cbsa_title',
        dateColumn: 'period_date',
      };
    case 'county':
      return {
        table: 'realtor_county',
        idColumn: 'county_fips',
        nameColumn: 'county_name',
        dateColumn: 'period_date',
      };
    case 'zip':
      return {
        table: 'realtor_zip',
        idColumn: 'postal_code',
        nameColumn: 'zip_name',
        dateColumn: 'period_date',
      };
    case 'state':
      return {
        table: 'realtor_state',
        idColumn: 'state_id',
        nameColumn: 'state_name',
        dateColumn: 'period_date',
      };
    default:
      return null;
  }
}

function getCensusRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case 'metro':
      return {
        table: 'census_metro',
        idColumn: 'cbsa_code',
        nameColumn: 'cbsa_title',
        dateColumn: 'year',
      };
    case 'county':
      return {
        table: 'census_county',
        idColumn: 'fips_code',
        nameColumn: 'county_name',
        dateColumn: 'year',
      };
    case 'zip':
      return { table: 'census_zip', idColumn: 'zcta', dateColumn: 'year' };
    case 'state':
      return {
        table: 'census_state',
        idColumn: 'state_fips',
        nameColumn: 'state_name',
        dateColumn: 'year',
      };
    default:
      return null;
  }
}

function getEconomicRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case 'metro':
      return {
        table: 'economic_metro',
        idColumn: 'cbsa_code',
        nameColumn: 'cbsa_title',
        dateColumn: 'period_date',
      };
    case 'county':
      return {
        table: 'economic_county',
        idColumn: 'fips_code',
        nameColumn: 'county_name',
        dateColumn: 'period_date',
      };
    case 'state':
      return {
        table: 'economic_state',
        idColumn: 'state_fips',
        nameColumn: 'state_name',
        dateColumn: 'period_date',
      };
    default:
      return null;
  }
}

function getPermitsRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case 'county':
      return {
        table: 'permits_county',
        idColumn: 'fips_code',
        dateColumn: 'period_date',
      };
    case 'state':
      return {
        table: 'permits_state',
        idColumn: 'state_fips',
        dateColumn: 'period_date',
      };
    case 'metro':
      return {
        table: 'permits_metro',
        idColumn: 'cbsa_code',
        dateColumn: 'period_date',
      };
    default:
      return null;
  }
}

export function getQcewRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case 'county':
      return {
        table: 'economic_county',
        idColumn: 'fips_code',
        dateColumn: 'period_date',
      };
    case 'metro':
      return {
        table: 'economic_metro',
        idColumn: 'cbsa_code',
        dateColumn: 'period_date',
      };
    default:
      return null;
  }
}

export function getCesRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case 'metro':
      return {
        table: 'economic_metro',
        idColumn: 'cbsa_code',
        dateColumn: 'ces_period_date',
      };
    case 'state':
      return {
        table: 'economic_state',
        idColumn: 'state_fips',
        dateColumn: 'ces_period_date',
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

export function getIrsRoute(geoLevel: GeoLevel): TableRoute | null {
  if (geoLevel !== 'county') return null;
  return {
    table: 'irs_migration_county_aggregates',
    idColumn: 'county_fips',
    dateColumn: 'tax_year',
  };
}
