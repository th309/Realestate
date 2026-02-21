/**
 * Scoring Data Fetcher
 *
 * Assembles LocationMetrics objects by querying multiple data sources:
 * - Realtor (hotness, demand, supply, pending ratio, etc.)
 * - Census (population YoY, rent, homeownership)
 * - Economic (unemployment)
 * - Calculated (rent-to-price ratio, affordability)
 * - ZIP inheritance from parent counties
 *
 * These functions are used by ScoringService.calculateAllScores() to build
 * the full dataset before z-score and formula calculations.
 *
 * All functions accept a SupabaseClient and are pure from a DI perspective.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyLevel } from './formula-weights';
import { LocationMetrics } from './scoring.types';
import type { GeographyChainService } from '../metric-resolution/geography-chain.service';

// ============================================================================
// Table / Column Lookups
// ============================================================================

export function getRealtorTable(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro': return 'realtor_metro';
    case 'county': return 'realtor_county';
    case 'zip': return 'realtor_zip';
    default: return 'realtor_metro';
  }
}

export function getIdColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro': return 'cbsa_code';
    case 'county': return 'county_fips';
    case 'zip': return 'postal_code';
    default: return 'cbsa_code';
  }
}

export function getNameColumn(geography: GeographyLevel): string {
  switch (geography) {
    case 'metro': return 'cbsa_title';
    case 'county': return 'county_name';
    case 'zip': return 'zip_name';
    default: return 'cbsa_title';
  }
}

/**
 * Get the latest Realtor period_date for a geography level.
 */
export async function getLatestRealtorDate(
  supabase: SupabaseClient,
  geography: GeographyLevel,
): Promise<string | null> {
  const table = getRealtorTable(geography);
  const { data } = await supabase
    .from(table)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1);

  return data?.[0]?.period_date || null;
}

// ============================================================================
// Primary Fetch Pipeline
// ============================================================================

/**
 * Fetch all metrics for all locations at a geography level.
 * Orchestrates Realtor + Census + Economic + Calculated queries.
 */
export async function fetchAllMetrics(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate: string,
  geoChainService?: GeographyChainService,
): Promise<LocationMetrics[]> {
  const table = getRealtorTable(geography);
  const idCol = getIdColumn(geography);
  const nameCol = getNameColumn(geography);

  // Fetch Realtor data (paginated to avoid Supabase 1000 row limit)
  const pageSize = 1000;
  const realtorData: Array<Record<string, any>> = [];
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(`${idCol}, ${nameCol}, hotness_score, demand_score, supply_score, pending_ratio, price_reduced_share, median_days_on_market, active_listing_count_yy, price_reduced_count_yy, median_listing_price`)
      .eq('period_date', periodDate)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch realtor data: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    realtorData.push(...data);
    if (data.length < pageSize) break;
    page += 1;
  }

  if (!realtorData || realtorData.length === 0) return [];

  // Build location metrics map
  const locationsMap = new Map<string, LocationMetrics>();

  for (const row of realtorData) {
    const r = row as Record<string, any>;
    const locationId = r[idCol];
    locationsMap.set(locationId, {
      location_id: locationId,
      location_name: r[nameCol] || locationId,
      median_price: r.median_listing_price,
      hotness_score: r.hotness_score,
      demand_score: r.demand_score,
      supply_score: r.supply_score,
      pending_ratio: r.pending_ratio,
      price_reduced_share: r.price_reduced_share,
      median_days_on_market: r.median_days_on_market,
      active_listing_count_yy: r.active_listing_count_yy,
      price_reduced_count_yy: r.price_reduced_count_yy,
    });
  }

  // Fetch census/economic data for all geographies
  if (geography === 'metro' || geography === 'county') {
    await fetchCensusData(supabase, locationsMap, geography, periodDate);
    await fetchEconomicData(supabase, locationsMap, geography, periodDate);
  } else if (geography === 'zip') {
    await backfillFromCounty(supabase, locationsMap, periodDate, ['demand_score', 'hotness_score'], geoChainService);
    await fetchZipCensusData(supabase, locationsMap, periodDate);
  }

  // Fetch calculated metrics (rent_price_ratio, affordability_ratio) for all geographies
  await fetchCalculatedMetrics(supabase, locationsMap, geography, periodDate);

  return Array.from(locationsMap.values());
}

// ============================================================================
// Individual Data Source Fetchers
// ============================================================================

/**
 * Fetch census data (population_yoy, median_gross_rent, homeownership_rate)
 */
async function fetchCensusData(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  geography: GeographyLevel,
  periodDate: string,
): Promise<void> {
  const table = geography === 'metro' ? 'census_metro' : 'census_county';
  const idCol = geography === 'metro' ? 'cbsa_code' : 'fips_code';
  const year = new Date(periodDate).getFullYear();

  const pageSize = 1000;
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(`${idCol}, population_yoy, median_gross_rent, homeownership_rate`)
      .eq('year', year)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch census data: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      const location = locationsMap.get(row[idCol]);
      if (location) {
        location.population_yoy = row.population_yoy;
        location.median_gross_rent = row.median_gross_rent;
        location.homeownership_rate = row.homeownership_rate;
      }
    }
    if (data.length < pageSize) break;
    page += 1;
  }
}

/**
 * Fetch economic data (unemployment_rate_yoy)
 */
async function fetchEconomicData(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  geography: GeographyLevel,
  periodDate: string,
): Promise<void> {
  const table = geography === 'metro' ? 'economic_metro' : 'economic_county';
  const idCol = geography === 'metro' ? 'cbsa_code' : 'fips_code';

  const pageSize = 1000;
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(`${idCol}, unemployment_rate_yoy`)
      .eq('period_date', periodDate)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch economic data: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      const location = locationsMap.get(row[idCol]);
      if (location) {
        location.unemployment_rate_yoy = row.unemployment_rate_yoy;
      }
    }
    if (data.length < pageSize) break;
    page += 1;
  }
}

/**
 * Fetch census data for ZIP geography from census_zip table.
 */
async function fetchZipCensusData(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  periodDate: string,
): Promise<void> {
  const year = new Date(periodDate).getFullYear();

  const pageSize = 1000;
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('census_zip')
      .select('zcta, population_yoy, median_gross_rent, homeownership_rate, median_home_value, median_household_income')
      .eq('year', year)
      .order('zcta', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch ZIP census data: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      const location = locationsMap.get(row.zcta);
      if (location) {
        if (row.population_yoy != null) location.population_yoy = row.population_yoy;
        if (row.median_gross_rent != null) location.median_gross_rent = row.median_gross_rent;
        if (row.homeownership_rate != null) location.homeownership_rate = row.homeownership_rate;
        if (location.median_price == null && row.median_home_value != null) {
          location.median_price = row.median_home_value;
        }
      }
    }
    if (data.length < pageSize) break;
    page += 1;
  }
}

/**
 * Fetch calculated metrics (affordability_ratio, rent_price_ratio).
 * Maps from DB column rent_to_price_ratio -> LocationMetrics.rent_price_ratio
 * Computes affordability_ratio from census data already on the location.
 */
async function fetchCalculatedMetrics(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  geography: GeographyLevel,
  periodDate: string,
): Promise<void> {
  // calculated_metrics uses end-of-month dates for rent_to_price_ratio,
  // but scoring uses first-of-month dates. Try both: exact match first,
  // then fall back to end of previous month.
  const endOfPrevMonth = new Date(periodDate);
  endOfPrevMonth.setDate(endOfPrevMonth.getDate() - 1);
  const fallbackDate = endOfPrevMonth.toISOString().split('T')[0];

  const datesToTry = [periodDate, fallbackDate];

  for (const dateToQuery of datesToTry) {
    let foundAny = false;
    const pageSize = 1000;
    let page = 0;
    while (true) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from('calculated_metrics')
        .select('geography_id, rent_to_price_ratio')
        .eq('geography_type', geography)
        .eq('period_date', dateToQuery)
        .not('rent_to_price_ratio', 'is', null)
        .order('geography_id', { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch calculated metrics: ${error.message}`);
      }
      if (!data || data.length === 0) break;
      foundAny = true;
      for (const row of data) {
        const location = locationsMap.get(row.geography_id);
        if (location && row.rent_to_price_ratio != null) {
          location.rent_price_ratio = row.rent_to_price_ratio;
        }
      }
      if (data.length < pageSize) break;
      page += 1;
    }
    if (foundAny) break;
  }

  // Compute affordability_ratio from census data already loaded on locations
  for (const location of locationsMap.values()) {
    if (location.median_price != null && location.median_gross_rent != null && location.median_gross_rent > 0) {
      location.affordability_ratio = location.median_price / (location.median_gross_rent * 12);
    }
  }
}

// ============================================================================
// ZIP → County Inheritance
// ============================================================================

/**
 * For ZIP codes, inherit census data from parent county.
 */
export async function inheritCountyData(
  supabase: SupabaseClient,
  locations: LocationMetrics[],
): Promise<void> {
  const zipCodes = locations.map(l => l.location_id);

  const { data: zipMapping } = await supabase
    .from('zillow_zip')
    .select('zip_code, county_fips')
    .in('zip_code', zipCodes);

  if (!zipMapping) return;

  const zipToCounty = new Map<string, string>();
  for (const row of zipMapping) {
    if (row.county_fips) {
      zipToCounty.set(row.zip_code, row.county_fips);
    }
  }

  const countyFips = [...new Set(zipToCounty.values())];
  const year = new Date().getFullYear();

  const { data: countyData } = await supabase
    .from('census_county')
    .select('fips_code, population_yoy')
    .eq('year', year)
    .in('fips_code', countyFips);

  const { data: economicData } = await supabase
    .from('economic_county')
    .select('fips_code, unemployment_rate_yoy')
    .in('fips_code', countyFips);

  const countyPopulation = new Map<string, number>();
  const countyUnemployment = new Map<string, number>();

  if (countyData) {
    for (const row of countyData) {
      if (row.population_yoy != null) {
        countyPopulation.set(row.fips_code, row.population_yoy);
      }
    }
  }

  if (economicData) {
    for (const row of economicData) {
      if (row.unemployment_rate_yoy != null) {
        countyUnemployment.set(row.fips_code, row.unemployment_rate_yoy);
      }
    }
  }

  for (const location of locations) {
    const county = zipToCounty.get(location.location_id);
    if (!county) continue;

    const inherited: string[] = [];

    if (location.population_yoy == null && countyPopulation.has(county)) {
      location.population_yoy = countyPopulation.get(county);
      inherited.push('population_yoy');
    }

    if (location.unemployment_rate_yoy == null && countyUnemployment.has(county)) {
      location.unemployment_rate_yoy = countyUnemployment.get(county);
      inherited.push('unemployment_rate_yoy');
    }

    if (inherited.length > 0) {
      location._inherited = [...(location._inherited || []), ...inherited];
    }
  }
}

/**
 * Backfill missing ZIP metrics from parent county Realtor data.
 * For ZIPs missing demand_score/hotness_score, looks up the parent county
 * via geography_crosswalk and copies the county's values.
 */
async function backfillFromCounty(
  supabase: SupabaseClient,
  locationsMap: Map<string, LocationMetrics>,
  periodDate: string,
  metricsToInherit: string[],
  geoChainService?: GeographyChainService,
): Promise<void> {
  // 1. Find ZIPs missing any of the metrics
  const missingZips: string[] = [];
  for (const [zipId, location] of locationsMap) {
    for (const metric of metricsToInherit) {
      if ((location as any)[metric] == null) {
        missingZips.push(zipId);
        break;
      }
    }
  }

  if (missingZips.length === 0) return;

  // 2. Bulk-fetch ZIP→county mappings via GeographyChainService (centralized)
  //    Falls back to direct geography_crosswalk query if service not available.
  let zipToCounty: Map<string, string>;

  if (geoChainService) {
    zipToCounty = await geoChainService.getZipToCountyMap(missingZips);
  } else {
    zipToCounty = new Map<string, string>();
    const pageSize = 1000;
    for (let i = 0; i < missingZips.length; i += pageSize) {
      const batch = missingZips.slice(i, i + pageSize);
      const { data, error } = await supabase
        .from('geography_crosswalk')
        .select('zip_code, county_fips')
        .in('zip_code', batch);

      if (error) {
        console.warn(`Failed to fetch geography_crosswalk: ${error.message}`);
        return;
      }
      if (data) {
        for (const row of data) {
          if (row.county_fips) {
            zipToCounty.set(row.zip_code, row.county_fips);
          }
        }
      }
    }
  }

  if (zipToCounty.size === 0) return;

  // 3. Get unique county FIPS codes and fetch their Realtor data
  const uniqueCounties = [...new Set(zipToCounty.values())];
  const countyMetrics = new Map<string, Record<string, number | null>>();

  for (let i = 0; i < uniqueCounties.length; i += pageSize) {
    const batch = uniqueCounties.slice(i, i + pageSize);
    const selectCols = ['county_fips', ...metricsToInherit].join(', ');
    const from = 0;
    const to = batch.length - 1;
    const { data, error } = await supabase
      .from('realtor_county')
      .select(selectCols)
      .eq('period_date', periodDate)
      .in('county_fips', batch)
      .order('county_fips', { ascending: true })
      .range(from, to);

    if (error) {
      console.warn(`Failed to fetch county Realtor data: ${error.message}`);
      return;
    }
    if (data) {
      for (const row of data as any[]) {
        const values: Record<string, number | null> = {};
        for (const metric of metricsToInherit) {
          values[metric] = row[metric] ?? null;
        }
        countyMetrics.set(row.county_fips, values);
      }
    }
  }

  // 4. Backfill missing ZIP values from parent county
  for (const [zipId, countyFips] of zipToCounty) {
    const location = locationsMap.get(zipId);
    const county = countyMetrics.get(countyFips);
    if (!location || !county) continue;

    for (const metric of metricsToInherit) {
      if ((location as any)[metric] == null && county[metric] != null) {
        (location as any)[metric] = county[metric];
        if (!location._inherited) location._inherited = [];
        location._inherited.push(metric);
      }
    }
  }
}
