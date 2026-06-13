/**
 * PropertyIQ Scoring Data Fetcher
 *
 * Fetches the 4 formula inputs:
 *   - zhvi_yoy, zhvi_mom_3m   — derived from Zillow ZHVI (16-month window)
 *   - median_days_on_market, price_reduced_share — Realtor.com monthly
 *
 * Regions are the UNION of Zillow and Realtor coverage; the engine scores
 * any region with >=2 features (Realtor-only regions get C confidence).
 * median_price is the region's current ZHVI.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyLevel } from './formula-weights';
import { LocationMetrics } from './scoring.types';
import { PAGE_SIZE, toEndOfMonth } from './scoring-data-helpers';

const ZILLOW_TABLES: Record<GeographyLevel, { table: string; idCol: string }> =
  {
    metro: { table: 'zillow_metro', idCol: 'cbsa_code' },
    county: { table: 'zillow_county', idCol: 'fips_code' },
    zip: { table: 'zillow_zip', idCol: 'region_name' }, // postal code lives in region_name
  };

const REALTOR_TABLES: Record<
  GeographyLevel,
  { table: string; idCol: string; nameCol: string }
> = {
  metro: { table: 'realtor_metro', idCol: 'cbsa_code', nameCol: 'cbsa_title' },
  county: {
    table: 'realtor_county',
    idCol: 'county_fips',
    nameCol: 'county_name',
  },
  zip: { table: 'realtor_zip', idCol: 'postal_code', nameCol: 'zip_name' },
};

const pad5 = (v: string) => String(v).padStart(5, '0');

function monthsBack(monthEnd: string, n: number): string {
  const [y, m] = monthEnd.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return toEndOfMonth(
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`,
  );
}

async function pageAll(
  supabase: SupabaseClient,
  build: (from: number, to: number) => any,
): Promise<Record<string, any>[]> {
  const rows: Record<string, any>[] = [];
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`scoring fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
  return rows;
}

/** Latest month-end scorable: min(latest zillow zhvi, latest realtor) for the geo. */
export async function getLatestScorableDate(
  supabase: SupabaseClient,
  geography: GeographyLevel,
): Promise<string | null> {
  const z = ZILLOW_TABLES[geography];
  const r = REALTOR_TABLES[geography];
  const [{ data: zd }, { data: rd }] = await Promise.all([
    supabase
      .from(z.table)
      .select('period_date')
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false })
      .limit(1),
    supabase
      .from(r.table)
      .select('period_date')
      .order('period_date', { ascending: false })
      .limit(1),
  ]);
  const zDate = zd?.[0]?.period_date;
  const rDate = rd?.[0]?.period_date;
  if (!zDate && !rDate) return null;
  // Compare by month; score the earlier of the two so all 4 inputs exist.
  const months = [zDate, rDate]
    .filter(Boolean)
    .map((d: string) => d.slice(0, 7))
    .sort();
  return toEndOfMonth(`${months[0]}-01`);
}

/** ZHVI rows for one month-end date, keyed by location id. */
async function fetchZhviAt(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  monthEnd: string,
): Promise<Map<string, number>> {
  const z = ZILLOW_TABLES[geography];
  const rows = await pageAll(supabase, (from, to) =>
    supabase
      .from(z.table)
      .select(`${z.idCol}, value`)
      .eq('metric_name', 'zhvi')
      .eq('period_date', monthEnd)
      .not(z.idCol, 'is', null)
      .order(z.idCol, { ascending: true })
      .range(from, to),
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = geography === 'zip' ? pad5(row[z.idCol]) : String(row[z.idCol]);
    if (row.value != null) map.set(id, Number(row.value));
  }
  return map;
}

/** Zillow display names (metro "City, ST"; county "X County, ST"; zip = id). */
async function fetchZillowNames(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  monthEnd: string,
): Promise<Map<string, string>> {
  const z = ZILLOW_TABLES[geography];
  const names = new Map<string, string>();
  if (geography === 'zip') return names; // zip display name is the postal code
  const rows = await pageAll(supabase, (from, to) =>
    supabase
      .from(z.table)
      .select(`${z.idCol}, region_name, state_code`)
      .eq('metric_name', 'zhvi')
      .eq('period_date', monthEnd)
      .not(z.idCol, 'is', null)
      .order(z.idCol, { ascending: true })
      .range(from, to),
  );
  for (const row of rows) {
    const id = String(row[z.idCol]);
    names.set(
      id,
      geography === 'county'
        ? `${row.region_name}, ${row.state_code}`
        : String(row.region_name),
    );
  }
  return names;
}

/** Realtor DOM + price_reduced_share for the month containing monthEnd. */
async function fetchRealtorAt(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  monthEnd: string,
): Promise<
  Map<string, { dom: number | null; prs: number | null; name: string }>
> {
  const r = REALTOR_TABLES[geography];
  const monthStart = `${monthEnd.slice(0, 7)}-01`;
  const rows = await pageAll(supabase, (from, to) =>
    supabase
      .from(r.table)
      .select(
        `${r.idCol}, median_days_on_market, price_reduced_share, ${r.nameCol}`,
      )
      .eq('period_date', monthStart)
      .order(r.idCol, { ascending: true })
      .range(from, to),
  );
  const map = new Map<
    string,
    { dom: number | null; prs: number | null; name: string }
  >();
  for (const row of rows) {
    map.set(String(row[r.idCol]), {
      dom:
        row.median_days_on_market != null
          ? Number(row.median_days_on_market)
          : null,
      prs:
        row.price_reduced_share != null
          ? Number(row.price_reduced_share)
          : null,
      name: String(row[r.nameCol] ?? row[r.idCol]),
    });
  }
  return map;
}

/**
 * Fetch the 4 PropertyIQ formula inputs for every region at a geography level.
 * periodDate may be any day in the target month; normalized to month-end.
 */
export async function fetchPropertyIqMetrics(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate: string,
): Promise<LocationMetrics[]> {
  const monthEnd = toEndOfMonth(periodDate);
  const [zhviNow, zhvi3m, zhvi12m, names, realtor] = await Promise.all([
    fetchZhviAt(supabase, geography, monthEnd),
    fetchZhviAt(supabase, geography, monthsBack(monthEnd, 3)),
    fetchZhviAt(supabase, geography, monthsBack(monthEnd, 12)),
    fetchZillowNames(supabase, geography, monthEnd),
    fetchRealtorAt(supabase, geography, monthEnd),
  ]);

  const allIds = new Set<string>([...zhviNow.keys(), ...realtor.keys()]);
  const results: LocationMetrics[] = [];

  for (const id of allIds) {
    const now = zhviNow.get(id);
    const prev3 = zhvi3m.get(id);
    const prev12 = zhvi12m.get(id);
    const rl = realtor.get(id);

    const loc: Record<string, any> = {
      location_id: id,
      location_name: (names.get(id) ?? rl?.name ?? id).replace(
        /\s+metro area$/i,
        '',
      ),
      median_price: now ?? undefined,
      zhvi_yoy:
        now != null && prev12 != null && prev12 !== 0 ? now / prev12 - 1 : null,
      zhvi_mom_3m:
        now != null && prev3 != null && prev3 !== 0 ? now / prev3 - 1 : null,
      median_days_on_market: rl?.dom ?? null,
      price_reduced_share: rl?.prs ?? null,
    };
    results.push(loc as LocationMetrics);
  }

  return results;
}
