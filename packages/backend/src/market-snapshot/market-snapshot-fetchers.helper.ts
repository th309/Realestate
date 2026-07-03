import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeZipKey } from '../common/zip';
import { normalizeStateRegionId, normalizeCountyFips } from '../common/geo';
import { GeoType } from './market-snapshot.types';
import {
  REALTOR_COLUMN_MAP,
  CENSUS_COLUMN_MAP,
  ECONOMIC_COLUMN_MAP,
  CALC_COLUMN_MAP,
  PERMITS_COLUMN_MAP,
} from './market-snapshot.types';
import {
  getRealtorKeyCol,
  getRealtorNameCol,
  getCensusKeyCol,
  getCensusNameCol,
  getEconomicKeyCol,
  getEconomicNameCol,
} from './market-snapshot-column-helpers';

// ============================================================================
// Data Source Fetchers
//
// I/O-heavy fetchers extracted from MarketSnapshotService. Each takes the
// SupabaseClient as an explicit first parameter (instead of reading
// `this.supabase`) so it can live outside the service class unchanged.
// (fetchZillow lives in market-snapshot-zillow-fetcher.helper.ts.)
// ============================================================================

export async function fetchRealtor(
  supabase: SupabaseClient,
  geoType: GeoType,
  geoId: string,
): Promise<{
  data: Record<string, any>;
  name: string | null;
  date: string | null;
} | null> {
  const table = `realtor_${geoType}`;
  const keyCol = getRealtorKeyCol(geoType);
  const nameCol = getRealtorNameCol(geoType);
  const cols = [
    ...Object.keys(REALTOR_COLUMN_MAP),
    'pending_listing_count_yy',
    'period_date',
    nameCol,
  ].join(',');

  // Realtor state_id stores 2-letter abbreviations (e.g. 'KS'), not FIPS codes (e.g. '20')
  const filterVal =
    geoType === 'state'
      ? (normalizeStateRegionId(geoId)?.stateCode ?? geoId)
      : geoId;

  const { data, error } = await supabase
    .from(table)
    .select(cols)
    .eq(keyCol, filterVal)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  const row = data as Record<string, any>;
  return {
    data: row,
    name: row[nameCol] ?? null,
    date: row.period_date ?? null,
  };
}

export async function fetchCensus(
  supabase: SupabaseClient,
  geoType: GeoType,
  geoId: string,
): Promise<{
  data: Record<string, any>;
  name: string | null;
} | null> {
  const table = `census_${geoType}`;
  const keyCol = getCensusKeyCol(geoType);
  const nameCol = getCensusNameCol(geoType);

  if (!keyCol) return null;

  const cols = [
    ...Object.keys(CENSUS_COLUMN_MAP),
    'median_home_value',
    'median_gross_rent',
    'year',
    nameCol,
  ].join(',');

  const { data, error } = await supabase
    .from(table)
    .select(cols)
    .eq(keyCol, geoType === 'zip' ? normalizeZipKey(geoId) : geoId)
    .order('year', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  const row = data as Record<string, any>;
  return {
    data: row,
    name: row[nameCol] ?? null,
  };
}

export async function fetchEconomic(
  supabase: SupabaseClient,
  geoType: GeoType,
  geoId: string,
): Promise<{
  data: Record<string, any>;
  name: string | null;
} | null> {
  const table = `economic_${geoType}`;
  const keyCol = getEconomicKeyCol(geoType);
  const nameCol = getEconomicNameCol(geoType);

  if (!keyCol) return null;

  const cols = [
    ...Object.keys(ECONOMIC_COLUMN_MAP),
    'period_date',
    nameCol,
  ].join(',');

  const { data, error } = await supabase
    .from(table)
    .select(cols)
    .eq(keyCol, geoId)
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  const row = data as Record<string, any>;
  return {
    data: row,
    name: row[nameCol] ?? null,
  };
}

export async function fetchCalculated(
  supabase: SupabaseClient,
  geoType: GeoType,
  geoId: string,
): Promise<{
  data: Record<string, any>;
} | null> {
  // Fetch latest 3 rows and merge (different batch jobs write at different dates)
  const cols = [
    ...Object.keys(CALC_COLUMN_MAP),
    'years_to_save',
    'period_date',
  ].join(',');

  const { data, error } = await supabase
    .from('calculated_metrics')
    .select(cols)
    .eq('geography_id', geoId)
    .eq('geography_type', geoType)
    .order('period_date', { ascending: false })
    .limit(3);

  if (error || !data || data.length === 0) return null;
  const rows = data as Record<string, any>[];

  // Merge: latest non-null value per column wins
  const merged: Record<string, any> = {};
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (merged[key] == null && row[key] != null) {
        merged[key] = row[key];
      }
    }
  }

  return { data: merged };
}

export async function fetchPermits(
  supabase: SupabaseClient,
  geoId: string,
): Promise<{
  data: Record<string, any>;
} | null> {
  const cols = [
    ...Object.keys(PERMITS_COLUMN_MAP),
    'total_value',
    'period_date',
  ].join(',');

  const { data, error } = await supabase
    .from('permits_county')
    .select(cols)
    .eq('fips_code', normalizeCountyFips(geoId))
    .order('period_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return { data: data as Record<string, any> };
}

// Order MUST match the Promise.allSettled fan-out in buildSnapshot.
const FETCH_LABELS = [
  'realtor',
  'zillow',
  'census',
  'economic',
  'calculated',
  'permits',
  'scores',
] as const;

export function logRejectedFetches(
  logger: Logger,
  results: PromiseSettledResult<unknown>[],
  geoType: GeoType,
  geoId: string,
): void {
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      logger.error(
        `fetchData[${FETCH_LABELS[i]}] rejected for ${geoType}/${geoId}: ${(results[i] as PromiseRejectedResult).reason}`,
      );
    }
  }
}
