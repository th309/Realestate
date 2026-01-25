/**
 * Check why Market Factors in the right panel show "--".
 * Verifies that source tables used by the time-series API have data for the default
 * metrics (Appreciation=home_value, Yield=cap_rate, Demand=pending_ratio, Inventory=inventory_yoy)
 * at a given geography level and region.
 *
 * Default sources (from backend TimeSeriesService):
 *   home_value     → zillow_county (fips_code, metric_name=zhvi)
 *   cap_rate       → calculated_metrics (geography_type, geography_id)
 *   pending_ratio  → realtor_county (county_fips)
 *   inventory_yoy  → realtor_county (county_fips, active_listing_count_yy)
 *
 * Run from repo root:
 *   npx tsx scripts/check-market-factors-data.ts [geoLevel] [regionId]
 * Examples:
 *   npx tsx scripts/check-market-factors-data.ts county 20163
 *   npx tsx scripts/check-market-factors-data.ts metro 31080
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'packages/frontend/.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_METRICS = [
  { id: 'home_value', label: 'Appreciation', source: 'zillow', table: 'zillow_county', geoCol: 'fips_code', extra: { metric_name: 'zhvi' } },
  { id: 'cap_rate', label: 'Yield Potential', source: 'calculated', table: 'calculated_metrics', geoCol: 'geography_id', extra: { geography_type: 'county' } },
  { id: 'pending_ratio', label: 'Demand', source: 'realtor', table: 'realtor_county', geoCol: 'county_fips' },
  { id: 'inventory_yoy', label: 'Inventory Change', source: 'realtor', table: 'realtor_county', geoCol: 'county_fips' },
] as const;

async function checkTable(
  table: string,
  geoLevel: string,
  regionId: string,
  geoCol: string,
  extra?: Record<string, string>
): Promise<{ count: number; hasDates: boolean; sample?: Record<string, unknown> }> {
  let query = supabase
    .from(table)
    .select('*', { count: 'exact', head: false })
    .limit(5);

  const level = geoLevel.toLowerCase();
  if (table === 'zillow_county' && level === 'county') {
    query = query.eq('fips_code', regionId.trim());
    if (extra?.metric_name) query = query.eq('metric_name', extra.metric_name);
  } else if (table === 'realtor_county' && level === 'county') {
    query = query.eq('county_fips', regionId.trim());
  } else if (table === 'calculated_metrics') {
    query = query.eq('geography_type', level).eq('geography_id', regionId.trim());
  } else {
    return { count: 0, hasDates: false };
  }

  const { data, count, error } = await query;
  if (error) {
    console.log(`    Error: ${error.message}`);
    return { count: 0, hasDates: false };
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const dateField = table === 'calculated_metrics' ? 'period_date' : 'period_date';
  const hasDates = rows.some(r => r.period_date != null || r.score_date != null);
  return {
    count: count ?? rows.length,
    hasDates,
    sample: rows[0],
  };
}

async function main() {
  const geoLevel = process.argv[2] || 'county';
  const regionId = process.argv[3] || '20163'; // Rooks, KS

  console.log('=== Market Factors data availability ===\n');
  console.log(`Geography: ${geoLevel}, Region ID: ${regionId}\n`);

  if (geoLevel !== 'county') {
    console.log('This script currently only checks county-level sources (zillow_county, realtor_county, calculated_metrics).');
    console.log('For metro/zip, the backend uses different tables; add cases in the script as needed.\n');
  }

  for (const metric of DEFAULT_METRICS) {
    const { table, geoCol, extra } = metric;
    const res = await checkTable(table, geoLevel, regionId, geoCol, extra as Record<string, string>);
    const status = res.count > 0 ? 'OK' : 'NO DATA';
    console.log(`${metric.label} (${metric.id})`);
    console.log(`  Source: ${metric.source}, table: ${table}`);
    console.log(`  Rows for this region: ${res.count} — ${status}`);
    if (res.count > 0 && res.sample) {
      const dateVal = res.sample.period_date ?? res.sample.score_date ?? 'n/a';
      console.log(`  Sample date: ${dateVal}`);
    }
    console.log('');
  }

  console.log('--- Why "--" appears ---');
  console.log('If a metric shows "NO DATA", the right-panel Market Factor will display "--".');
  console.log('Ensure the backend time-series API can reach Supabase and the tables above have rows for your selected region.');
  console.log('Frontend uses: GET /api/timeseries/{metric}/{geoLevel}/{regionId}?startDate=...&endDate=...');
}

main().catch(console.error);
