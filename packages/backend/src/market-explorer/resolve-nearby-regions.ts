import { SupabaseClient } from '@supabase/supabase-js';
import { ScopeRegion } from './market-explorer.types';
import { distinctCrosswalkIds, snapshotRoster } from './resolve-child-regions';
import { adjacentStateFips } from './us-tiles';

const uniq = (xs: string[]) => [...new Set(xs)];
const mark = (rows: ScopeRegion[]): ScopeRegion[] =>
  rows.map((r) => ({ ...r, nearby: true }));

async function lookupOne(
  supabase: SupabaseClient,
  selectCol: string,
  filterCol: string,
  val: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('geography_crosswalk')
    .select(selectCol)
    .eq(filterCol, val)
    .not(selectCol, 'is', null)
    .order(selectCol)
    .limit(1);
  const row = (data ?? [])[0] as any;
  return row?.[selectCol] ?? null;
}

/** Same-level peers of the current scope, per the prototype's nearbyEnts() branching. */
export async function resolveNearbyRegions(
  supabase: SupabaseClient,
  geoLevel: string,
  parentLevel: string | undefined,
  parentId: string | undefined,
): Promise<ScopeRegion[]> {
  if (!parentLevel || !parentId) return [];

  // Drilled into a state (showing metros) → metros of tile-adjacent states.
  if (geoLevel === 'metro' && parentLevel === 'state') {
    const cbsas: string[] = [];
    for (const fips of adjacentStateFips(parentId)) {
      cbsas.push(
        ...(await distinctCrosswalkIds(
          supabase,
          'cbsa_code',
          'state_fips',
          fips,
        )),
      );
    }
    return mark(await snapshotRoster(supabase, 'metro', uniq(cbsas)));
  }

  // Drilled into a metro (showing counties) → counties of sibling metros in the same state.
  if (geoLevel === 'county' && parentLevel === 'metro') {
    const stateFips = await lookupOne(
      supabase,
      'state_fips',
      'cbsa_code',
      parentId,
    );
    if (!stateFips) return [];
    const sibs = (
      await distinctCrosswalkIds(supabase, 'cbsa_code', 'state_fips', stateFips)
    ).filter((c) => c !== parentId);
    const countyLists = await Promise.all(
      sibs.map((c) =>
        distinctCrosswalkIds(supabase, 'county_fips', 'cbsa_code', c),
      ),
    );
    return mark(
      await snapshotRoster(supabase, 'county', uniq(countyLists.flat())),
    );
  }

  // Drilled into a county (showing zips) → zips of sibling counties in the same metro.
  if (geoLevel === 'zip' && parentLevel === 'county') {
    const cbsa = await lookupOne(
      supabase,
      'cbsa_code',
      'county_fips',
      parentId,
    );
    if (!cbsa) return [];
    const sibs = (
      await distinctCrosswalkIds(supabase, 'county_fips', 'cbsa_code', cbsa)
    ).filter((c) => c !== parentId);
    const zipLists = await Promise.all(
      sibs.map((c) =>
        distinctCrosswalkIds(supabase, 'zip_code', 'county_fips', c),
      ),
    );
    return mark(await snapshotRoster(supabase, 'zip', uniq(zipLists.flat())));
  }

  return [];
}
