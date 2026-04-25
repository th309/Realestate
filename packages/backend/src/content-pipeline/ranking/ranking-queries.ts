/**
 * Ranking Queries
 *
 * Supabase query helpers for RankingResolverService — extracted to keep the
 * service file under the 300-line hard limit and separate query construction
 * from orchestration logic.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { RankingMetricConfig } from './ranking-metric-catalog';
import {
  GeoLevel,
  RankingDirection,
  ScopeType,
} from './ranking-resolver.service';

const logger = new Logger('RankingQueries');

// ---------------------------------------------------------------------------
// Scope resolution
// ---------------------------------------------------------------------------

function crosswalkColForGeo(geoLevel: GeoLevel): string {
  if (geoLevel === 'county') return 'county_fips';
  if (geoLevel === 'zip') return 'zip_code';
  return 'cbsa_code';
}

/**
 * Return region IDs in scope, or null for national (no filter).
 * geography_crosswalk columns: zip_code, county_fips, cbsa_code, state_abbrev.
 */
export async function resolveScopeRegionIds(
  client: SupabaseClient,
  scopeType: ScopeType,
  scopeId: string | null,
  geoLevel: GeoLevel,
): Promise<string[] | null> {
  if (scopeType === 'national') return null;

  const selectCol = crosswalkColForGeo(geoLevel);
  const filterCol = scopeType === 'state' ? 'state_abbrev' : 'cbsa_code';

  const { data, error } = await client
    .from('geography_crosswalk')
    .select(selectCol)
    .eq(filterCol, scopeId ?? '')
    .not(selectCol, 'is', null);

  if (error) {
    logger.warn(`Scope crosswalk lookup failed: ${error.message}`);
    return null;
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const val = (row as unknown as Record<string, unknown>)[selectCol];
    if (val) ids.add(String(val));
  }
  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// Staleness / excluded count
// ---------------------------------------------------------------------------

/**
 * Count rows that are excluded from ranking: NULL value OR date before cutoff.
 */
export async function countExcluded(
  client: SupabaseClient,
  tc: RankingMetricConfig,
  cutoffDate: string,
  scopeRegionIds: string[] | null,
): Promise<number> {
  let query = client
    .from(tc.sourceTable)
    .select('*', { count: 'exact', head: true })
    .or(`${tc.valueColumn}.is.null,${tc.dateColumn}.lt.${cutoffDate}`);

  if (tc.metricNameFilter) query = query.eq('metric_name', tc.metricNameFilter);
  if (scopeRegionIds !== null) query = query.in(tc.idColumn, scopeRegionIds);

  const { count, error } = await query;
  if (error) {
    logger.warn(`Excluded count query failed: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Ranked row fetch
// ---------------------------------------------------------------------------

/**
 * Fetch ranked rows from the source table, ordered by value.
 */
export async function fetchRankedRows(
  client: SupabaseClient,
  tc: RankingMetricConfig,
  cutoffDate: string,
  scopeRegionIds: string[] | null,
  direction: RankingDirection,
  fetchLimit: number,
): Promise<Record<string, unknown>[]> {
  const selectCols = [
    tc.idColumn,
    tc.nameColumn,
    tc.stateColumn,
    tc.valueColumn,
    tc.dateColumn,
  ]
    .filter(Boolean)
    .join(', ');

  let query = client
    .from(tc.sourceTable)
    .select(selectCols)
    .not(tc.valueColumn, 'is', null)
    .gte(tc.dateColumn, cutoffDate)
    .order(tc.valueColumn, { ascending: direction === 'bottom' })
    .limit(fetchLimit);

  if (tc.metricNameFilter) query = query.eq('metric_name', tc.metricNameFilter);
  if (scopeRegionIds !== null) query = query.in(tc.idColumn, scopeRegionIds);

  const { data, error } = await query;
  if (error) throw new Error(`Ranking query failed: ${error.message}`);
  return (data ?? []) as unknown as Record<string, unknown>[];
}
