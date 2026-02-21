/**
 * Score Data Fetcher - Loads and merges Realtor, Census, and Economic data
 * for PropertyIQ score calculations.
 *
 * Handles pagination for large tables and merges data sources into
 * a unified record set for z-score calculation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeoLevel } from './score-formula-weights';

// ---------------------------------------------------------------------------
// Geography configuration
// ---------------------------------------------------------------------------

export interface ScoreGeoConfig {
  geoLevel: GeoLevel;
  realtorTable: string;
  censusTable: string | null;
  economicTable: string | null;
  idColumn: string;
  nameColumn: string;
  priceColumn: string;
}

export const SCORE_GEO_CONFIGS: ScoreGeoConfig[] = [
  {
    geoLevel: 'metro',
    realtorTable: 'realtor_metro',
    censusTable: 'census_metro',
    economicTable: 'economic_metro',
    idColumn: 'cbsa_code',
    nameColumn: 'cbsa_title',
    priceColumn: 'median_listing_price',
  },
  {
    geoLevel: 'county',
    realtorTable: 'realtor_county',
    censusTable: 'census_county',
    economicTable: 'economic_county',
    idColumn: 'county_fips',
    nameColumn: 'county_name',
    priceColumn: 'median_listing_price',
  },
  {
    geoLevel: 'zip',
    realtorTable: 'realtor_zip',
    censusTable: null,
    economicTable: null,
    idColumn: 'postal_code',
    nameColumn: 'postal_code',
    priceColumn: 'median_listing_price',
  },
];

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

export async function getLatestPeriodDate(
  supabase: SupabaseClient,
  tableName: string,
): Promise<string | null> {
  const { data } = await supabase
    .from(tableName)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1);

  return data?.[0]?.period_date || null;
}

async function fetchAllRecordsWithPagination(
  supabase: SupabaseClient,
  tableName: string,
  columns: string,
  periodDate: string,
): Promise<any[]> {
  const allRecords: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .eq('period_date', periodDate)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`  Error fetching from ${tableName} at offset ${offset}: ${error.message}`);
      break;
    }

    if (data && data.length > 0) {
      allRecords.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

async function fetchCensusData(
  supabase: SupabaseClient,
  tableName: string,
  idColumn: string,
  year: number,
): Promise<Map<string, any>> {
  const censusMap = new Map<string, any>();

  const { data } = await supabase
    .from(tableName)
    .select(`${idColumn}, population_yoy, median_gross_rent, homeownership_rate`)
    .eq('year', year);

  if (data) {
    for (const row of data) {
      const rowAny = row as Record<string, any>;
      censusMap.set(String(rowAny[idColumn]), row);
    }
  }

  return censusMap;
}

async function fetchEconomicData(
  supabase: SupabaseClient,
  tableName: string,
  idColumn: string,
  periodDate: string,
): Promise<Map<string, any>> {
  const economicMap = new Map<string, any>();

  const { data } = await supabase
    .from(tableName)
    .select(`${idColumn}, unemployment_rate_yoy`)
    .eq('period_date', periodDate);

  if (data) {
    for (const row of data) {
      const rowAny = row as Record<string, any>;
      economicMap.set(String(rowAny[idColumn]), row);
    }
  }

  return economicMap;
}

// ---------------------------------------------------------------------------
// Main fetch + merge
// ---------------------------------------------------------------------------

/**
 * Fetch and merge all data sources for a geography level.
 * Returns unified records with realtor, census, and economic fields merged.
 */
export async function fetchAllDataForGeo(
  supabase: SupabaseClient,
  config: ScoreGeoConfig,
  periodDate: string,
): Promise<any[]> {
  const realtorCols = [
    config.idColumn, config.nameColumn, config.priceColumn,
    'hotness_score', 'demand_score', 'pending_ratio',
    'price_reduced_share', 'active_listing_count_yy', 'price_reduced_count_yy',
  ].join(', ');

  const realtorData = await fetchAllRecordsWithPagination(
    supabase, config.realtorTable, realtorCols, periodDate,
  );

  if (realtorData.length === 0) return [];

  // Build location map
  const locationsMap = new Map<string, any>();
  for (const row of realtorData) {
    const id = String(row[config.idColumn]);
    locationsMap.set(id, {
      ...row,
      id,
      name: row[config.nameColumn] || id,
      median_price: row[config.priceColumn],
    });
  }

  // Merge census data
  if (config.censusTable) {
    const year = new Date(periodDate).getFullYear();
    const censusData = await fetchCensusData(supabase, config.censusTable, config.idColumn, year);
    for (const [id, census] of censusData) {
      const location = locationsMap.get(id);
      if (location) {
        location.population_yoy = census.population_yoy;
        location.median_gross_rent = census.median_gross_rent;
        location.homeownership_rate = census.homeownership_rate;
      }
    }
  }

  // Merge economic data
  if (config.economicTable) {
    const economicData = await fetchEconomicData(supabase, config.economicTable, config.idColumn, periodDate);
    for (const [id, economic] of economicData) {
      const location = locationsMap.get(id);
      if (location) {
        location.unemployment_rate_yoy = economic.unemployment_rate_yoy;
      }
    }
  }

  return Array.from(locationsMap.values());
}
