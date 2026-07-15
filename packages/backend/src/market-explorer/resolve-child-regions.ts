import { SupabaseClient } from '@supabase/supabase-js';
import { ScopeRegion } from './market-explorer.types';

export const NATIONAL_METRO_CAP = 40;
export const CHILD_CAP = 60;

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

async function distinctCrosswalkIds(
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

async function snapshotRoster(
  supabase: SupabaseClient,
  geoLevel: string,
  ids: string[],
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
  return out.slice(0, CHILD_CAP);
}

/**
 * Ordered, capped roster of a scope's child regions.
 * National metro scope (no parent) = top NATIONAL_METRO_CAP scored metros by population.
 * Deeper scopes resolve child IDs from geography_crosswalk, then names/population from screener_snapshot.
 */
export async function resolveChildRegions(
  supabase: SupabaseClient,
  geoLevel: string,
  parentLevel: string | undefined,
  parentId: string | undefined,
  _includeNearby: boolean,
): Promise<ScopeRegion[]> {
  if (geoLevel === 'state') return [];

  if (geoLevel === 'metro' && !parentId) {
    const { data } = await supabase
      .from('screener_snapshot')
      .select('region_id, region_name, state_code, population')
      .eq('geo_level', 'metro')
      .not('population', 'is', null)
      .order('population', { ascending: false, nullsFirst: false })
      .limit(NATIONAL_METRO_CAP);
    return (data ?? []).map((r: any) => ({
      id: r.region_id,
      name: r.region_name,
      state: r.state_code,
      population: r.population ?? null,
    }));
  }

  if (!parentLevel || !parentId) return [];
  const ids = await distinctCrosswalkIds(
    supabase,
    CHILD_COL[geoLevel],
    PARENT_COL[parentLevel],
    parentId,
  );
  return snapshotRoster(supabase, geoLevel, ids);
}
