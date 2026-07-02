import { GeoType } from './market-snapshot.types';

// ============================================================================
// Key / Name Column Helpers
//
// Pure per-geoType lookups for the DB key + display-name columns each data
// source uses. Extracted from MarketSnapshotService so the fetchers can share
// them without carrying `this`.
// ============================================================================

export function getRealtorKeyCol(geoType: GeoType): string {
  switch (geoType) {
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'county_fips';
    case 'zip':
      return 'postal_code';
    case 'state':
      return 'state_id';
    default:
      return 'cbsa_code';
  }
}

export function getRealtorNameCol(geoType: GeoType): string {
  switch (geoType) {
    case 'metro':
      return 'cbsa_title';
    case 'county':
      return 'county_name';
    case 'zip':
      return 'zip_name';
    case 'state':
      return 'state_name';
    default:
      return 'cbsa_title';
  }
}

export function getZillowKeyCol(geoType: GeoType): string {
  switch (geoType) {
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'fips_code';
    case 'zip':
      return 'region_name';
    case 'state':
      return 'state_code';
    default:
      return 'region_id';
  }
}

export function getCensusKeyCol(geoType: GeoType): string | null {
  switch (geoType) {
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'fips_code';
    case 'zip':
      return 'zcta';
    case 'state':
      return 'state_fips';
    default:
      return null;
  }
}

export function getCensusNameCol(geoType: GeoType): string {
  switch (geoType) {
    case 'metro':
      return 'cbsa_title';
    case 'county':
      return 'county_name';
    case 'zip':
      return 'zcta';
    case 'state':
      return 'state_name';
    default:
      return 'cbsa_title';
  }
}

export function getEconomicKeyCol(geoType: GeoType): string | null {
  switch (geoType) {
    case 'metro':
      return 'cbsa_code';
    case 'county':
      return 'fips_code';
    case 'state':
      return 'state_fips';
    default:
      return null;
  }
}

export function getEconomicNameCol(geoType: GeoType): string {
  switch (geoType) {
    case 'metro':
      return 'cbsa_title';
    case 'county':
      return 'county_name';
    case 'state':
      return 'state_name';
    default:
      return 'cbsa_title';
  }
}
