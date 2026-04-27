/**
 * Ranking Queries — query helpers for RankingResolverService.
 *
 * Two responsibilities:
 *   1. Translate user scope (state / metro) into the set of region IDs eligible
 *      for the ranking (via geography_crosswalk).
 *   2. Pull PIQ score rows from propertyiq_scores (the canonical PIQ ranking
 *      pattern, already used by RankingsV1Controller and score-mover queries).
 *
 * Raw market metrics go through the canonical metric-resolution layer
 * (SourceFetcherBulkService) — no duplicate query logic needed here.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { GeoLevel, ScopeType } from './ranking-resolver.service';

const logger = new Logger('RankingQueries');

// ---------------------------------------------------------------------------
// Scope filtering — map (scope_type, scope_id) → set of region IDs
// ---------------------------------------------------------------------------

function crosswalkColForGeo(geoLevel: GeoLevel): string {
  if (geoLevel === 'county') return 'county_fips';
  if (geoLevel === 'zip') return 'zip_code';
  return 'cbsa_code';
}

/**
 * Returns region IDs in scope, or null for national (no filter).
 * Returns [] if the scope is set but has no matching IDs (caller filters all out).
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
    return [];
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const val = (row as unknown as Record<string, unknown>)[selectCol];
    if (val) ids.add(String(val));
  }
  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// PIQ score helpers — query propertyiq_scores directly
// ---------------------------------------------------------------------------

export interface PiqRankingRow {
  location_id: string;
  location_name: string;
  score: number;
  score_date: string;
}

export async function fetchPiqRankings(
  client: SupabaseClient,
  geoLevel: GeoLevel,
  scopeRegionIds: string[] | null,
  ascending: boolean,
  limit: number,
): Promise<PiqRankingRow[]> {
  const { data: dateRow } = await client
    .from('propertyiq_scores')
    .select('score_date')
    .eq('geography', geoLevel)
    .eq('score_type', 'propertyiq')
    .order('score_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestDate = (dateRow as { score_date?: string } | null)?.score_date;
  if (!latestDate) return [];

  // Over-fetch so we have headroom to drop display-name duplicates.
  // propertyiq_scores carries both MSA and metro-division CBSAs (e.g. SF-Oakland
  // 41860 and SF-MD 41884), both of which display as "San Francisco, CA". Two
  // identical names in a top-10 reads as a credibility error to viewers.
  const fetchLimit = limit * 3;

  let query = client
    .from('propertyiq_scores')
    .select('location_id, location_name, score, score_date')
    .eq('geography', geoLevel)
    .eq('score_type', 'propertyiq')
    .eq('score_date', latestDate)
    .not('score', 'is', null)
    .order('score', { ascending })
    .limit(fetchLimit);

  if (scopeRegionIds !== null) {
    if (scopeRegionIds.length === 0) return [];
    query = query.in('location_id', scopeRegionIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`PIQ ranking query failed: ${error.message}`);

  // Dedupe by parsed (name, state) — keep first occurrence (highest score
  // because rows are already sorted by score). Backfills the slot from
  // the over-fetched tail. See parseLocationName for suffix handling.
  const rows = (data ?? []) as PiqRankingRow[];
  const seen = new Set<string>();
  const deduped: PiqRankingRow[] = [];
  for (const row of rows) {
    const parsed = parseLocationName(row.location_name);
    const key = `${parsed.name}|${parsed.state ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length === limit) break;
  }
  return deduped;
}

// ---------------------------------------------------------------------------
// parseLocationName — split "Austin–Round Rock, TX" into (name, state)
// ---------------------------------------------------------------------------

/**
 * Strip suffixes that some sources append to the canonical "City, ST" form.
 * propertyiq_scores.location_name uses "Foo, ST metro area" for 922 / 935 metro
 * rows; without stripping, state extraction fails and downstream script
 * validation rejects the run.
 */
const NAME_SUFFIXES_TO_STRIP = [
  /\s+metro\s+area$/i,
  /\s+statistical\s+area$/i,
  /\s+\(.*\)$/, // trailing parens, e.g. "Honolulu, HI (Urban Honolulu)"
];

export function parseLocationName(locationName: string): {
  name: string;
  state: string | null;
} {
  let stripped = locationName.trim();
  for (const re of NAME_SUFFIXES_TO_STRIP) {
    stripped = stripped.replace(re, '').trim();
  }
  const m = stripped.match(/^(.+),\s*([A-Z]{2})$/);
  if (m) return { name: m[1], state: m[2] };
  return { name: stripped, state: null };
}
