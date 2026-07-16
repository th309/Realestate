import { SupabaseClient } from '@supabase/supabase-js';
import { ScopeRegion } from './market-explorer.types';

export const ZIP_FETCH_CAP = 70;

const CHILD_COL: Record<string, string> = {
  metro: 'cbsa_code',
  county: 'county_fips',
  zip: 'zip_code',
};
const PARENT_COL: Record<string, string> = {
  state: 'state_fips',
  metro: 'cbsa_code',
  county: 'county_fips',
};

export async function distinctCrosswalkIds(
  supabase: SupabaseClient,
  childCol: string,
  parentCol: string,
  parentId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('geography_crosswalk')
    .select(childCol)
    .eq(parentCol, parentId)
    .not(childCol, 'is', null)
    .limit(5000);
  if (error || !data) return [];
  return [
    ...new Set(
      (data as any[]).map((r) => r[childCol] as string).filter(Boolean),
    ),
  ];
}

/**
 * Ordered roster of screener_snapshot rows for the given region ids.
 * Uncapped unless `cap` is passed (only the ZIP tier caps today — see
 * resolveChildRegions and resolve-nearby-regions.ts).
 */
export async function snapshotRoster(
  supabase: SupabaseClient,
  geoLevel: string,
  ids: string[],
  cap?: number,
): Promise<ScopeRegion[]> {
  if (!ids.length) return [];
  const out: ScopeRegion[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase
      .from('screener_snapshot')
      .select('region_id, region_name, state_code, population')
      .eq('geo_level', geoLevel)
      .in('region_id', ids.slice(i, i + 300));
    for (const r of (data ?? []) as any[]) {
      out.push({
        id: r.region_id,
        name: r.region_name,
        state: r.state_code,
        population: r.population ?? null,
      });
    }
  }
  out.sort((a, b) => (b.population ?? -1) - (a.population ?? -1));
  return cap ? out.slice(0, cap) : out;
}

const SNAPSHOT_PAGE = 1000;

/**
 * Every screener_snapshot metro row, paginated past PostgREST's default
 * 1000-row cap. The real roster is ~935 today (includes micropolitan areas,
 * not just true CBSA metros — verified live) but this must not silently
 * truncate if it grows.
 */
async function allNationalMetros(
  supabase: SupabaseClient,
): Promise<ScopeRegion[]> {
  const rows: any[] = [];
  let offset = 0;
  let page: any[];
  do {
    const { data } = await supabase
      .from('screener_snapshot')
      .select('region_id, region_name, state_code, population')
      .eq('geo_level', 'metro')
      .order('population', { ascending: false, nullsFirst: false })
      .range(offset, offset + SNAPSHOT_PAGE - 1);
    page = (data ?? []) as any[];
    rows.push(...page);
    offset += page.length;
  } while (page.length === SNAPSHOT_PAGE);
  return rows.map((r) => ({
    id: r.region_id,
    name: r.region_name,
    state: r.state_code,
    population: r.population ?? null,
  }));
}

/**
 * Ordered roster of a scope's child regions. Uncapped for metro and county
 * (small at every real scope — largest state has ~50-67 metros, largest metro
 * has a few dozen counties); ZIP tier is capped at ZIP_FETCH_CAP because it
 * has thousands of possible county parent-scopes and real outlier counties
 * run 130-140 ZIPs, which is what actually drives Redis memory pressure (see
 * docs/superpowers/specs/2026-07-15-market-explorer-real-boundary-tiles-design.md §2).
 */
export async function resolveChildRegions(
  supabase: SupabaseClient,
  geoLevel: string,
  parentLevel: string | undefined,
  parentId: string | undefined,
  _includeNearby: boolean,
): Promise<ScopeRegion[]> {
  if (geoLevel === 'state') return [];
  if (geoLevel === 'metro' && !parentId) return allNationalMetros(supabase);
  if (!parentLevel || !parentId) return [];
  const ids = await distinctCrosswalkIds(
    supabase,
    CHILD_COL[geoLevel],
    PARENT_COL[parentLevel],
    parentId,
  );
  return snapshotRoster(
    supabase,
    geoLevel,
    ids,
    geoLevel === 'zip' ? ZIP_FETCH_CAP : undefined,
  );
}

/** Exact row count for a resolved id list at a geo level, without fetching the rows. */
async function countSnapshotRows(
  supabase: SupabaseClient,
  geoLevel: string,
  ids: string[],
): Promise<number> {
  if (!ids.length) return 0;
  let total = 0;
  for (let i = 0; i < ids.length; i += 300) {
    const { count } = await supabase
      .from('screener_snapshot')
      .select('region_id', { count: 'exact', head: true })
      .eq('geo_level', geoLevel)
      .in('region_id', ids.slice(i, i + 300));
    total += count ?? 0;
  }
  return total;
}

/**
 * Same as resolveChildRegions, but also reports how many rows existed before
 * any cap was applied — only meaningfully differs from regions.length at the
 * ZIP tier, since metro/county/national-metro are never capped.
 */
export async function resolveChildRegionsWithCount(
  supabase: SupabaseClient,
  geoLevel: string,
  parentLevel: string | undefined,
  parentId: string | undefined,
  includeNearby: boolean,
): Promise<{ regions: ScopeRegion[]; totalAvailable: number }> {
  const regions = await resolveChildRegions(
    supabase,
    geoLevel,
    parentLevel,
    parentId,
    includeNearby,
  );
  if (geoLevel !== 'zip' || !parentLevel || !parentId) {
    return { regions, totalAvailable: regions.length };
  }
  const ids = await distinctCrosswalkIds(
    supabase,
    CHILD_COL[geoLevel],
    PARENT_COL[parentLevel],
    parentId,
  );
  const totalAvailable = await countSnapshotRows(supabase, geoLevel, ids);
  return { regions, totalAvailable };
}
