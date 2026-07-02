/**
 * ZHVF ZIP Forecast + Diagnostics Helpers
 *
 * ZIP-level home value forecast fetcher plus the ZHVF data diagnostic dump,
 * extracted from zillow.service.ts for file-size compliance — behavior
 * unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { normalizeStateToCode } from '../../common/geo';
import type { ForecastData } from '../types';
import { getLatestDate, getForecastValue } from './queries';

export async function debugForecastData(
  supabase: SupabaseClient,
): Promise<any> {
  const debug: any = {
    metro: {},
    zip: {},
    crosswalk: {},
  };

  // Check ZHVF records in zillow_metro
  const { data: metroSample, error: metroError } = await supabase
    .from('zillow_metro')
    .select(
      'region_id, region_name, cbsa_code, state_code, metric_name, value, period_date',
    )
    .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m'])
    .order('period_date', { ascending: false })
    .limit(10);

  debug.metro.error = metroError?.message || null;
  debug.metro.sampleCount = metroSample?.length || 0;
  debug.metro.sample = metroSample?.slice(0, 3) || [];
  debug.metro.withCbsaCode =
    metroSample?.filter((r) => r.cbsa_code).length || 0;

  // Get distinct dates for ZHVF
  const { data: metroDates } = await supabase
    .from('zillow_metro')
    .select('period_date')
    .eq('metric_name', 'zhvf_12m')
    .order('period_date', { ascending: false })
    .limit(5);
  debug.metro.availableDates = metroDates?.map((d) => d.period_date) || [];

  // Count total ZHVF records
  const { count: metroCount } = await supabase
    .from('zillow_metro')
    .select('*', { count: 'exact', head: true })
    .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m']);
  debug.metro.totalRecords = metroCount || 0;

  // Check crosswalk table
  const { data: crosswalkSample, error: cwError } = await supabase
    .from('zillow_metro_crosswalk')
    .select('zillow_region_id, cbsa_code, cbsa_title')
    .limit(5);

  debug.crosswalk.error = cwError?.message || null;
  debug.crosswalk.sampleCount = crosswalkSample?.length || 0;
  debug.crosswalk.sample = crosswalkSample || [];

  // Count crosswalk entries
  const { count: cwCount } = await supabase
    .from('zillow_metro_crosswalk')
    .select('*', { count: 'exact', head: true });
  debug.crosswalk.totalEntries = cwCount || 0;

  // Check if ZHVF region_ids match crosswalk
  if (
    metroSample &&
    metroSample.length > 0 &&
    crosswalkSample &&
    crosswalkSample.length > 0
  ) {
    const zhvfRegionIds = new Set(metroSample.map((r) => r.region_id));
    const cwRegionIds = new Set(crosswalkSample.map((r) => r.zillow_region_id));
    const overlap = [...zhvfRegionIds].filter((id) => cwRegionIds.has(id));
    debug.crosswalk.matchingSampleIds = overlap.length;
  }

  // Check ZIP forecast data
  const { data: zipSample, error: zipError } = await supabase
    .from('zillow_zip')
    .select(
      'region_id, region_name, state_code, metric_name, value, period_date',
    )
    .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m'])
    .order('period_date', { ascending: false })
    .limit(5);

  debug.zip.error = zipError?.message || null;
  debug.zip.sampleCount = zipSample?.length || 0;
  debug.zip.sample = zipSample?.slice(0, 3) || [];

  const { count: zipCount } = await supabase
    .from('zillow_zip')
    .select('*', { count: 'exact', head: true })
    .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m']);
  debug.zip.totalRecords = zipCount || 0;

  return debug;
}

export async function getZipForecast(
  supabase: SupabaseClient,
  stateFilter?: string,
  horizon: string = '12m',
): Promise<ForecastData[]> {
  stateFilter = stateFilter ? normalizeStateToCode(stateFilter) : undefined;
  // Find latest date across ALL forecast horizons (zhvf_1m, zhvf_3m, zhvf_12m)
  const latestDates = await Promise.all([
    getLatestDate(supabase, 'zip', 'zhvf_1m'),
    getLatestDate(supabase, 'zip', 'zhvf_3m'),
    getLatestDate(supabase, 'zip', 'zhvf_12m'),
  ]);

  // Use the most recent date across all horizons (excluding fallback dates)
  const validDates = latestDates.filter(
    (date) => date && date !== '2025-10-31',
  );
  const latestDate =
    validDates.length > 0
      ? validDates.sort().reverse()[0] // Most recent valid date
      : latestDates.find((date) => date) || null; // Fallback to any date if all are fallback

  console.log(
    `[ZHVF Zip] Latest dates: 1m=${latestDates[0]}, 3m=${latestDates[1]}, 12m=${latestDates[2]}, using=${latestDate}, horizon=${horizon}`,
  );

  if (!latestDate || latestDate === '2025-10-31') {
    console.log(
      '[ZHVF Zip] No valid latest date found (all dates are fallback or null), returning empty',
    );
    return [];
  }

  // Query all forecast metrics for that date with pagination
  const allForecasts: any[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    let query = supabase
      .from('zillow_zip')
      .select(
        'region_id, region_name, state_code, metric_name, value, period_date',
      )
      .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m'])
      .eq('period_date', latestDate)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (stateFilter) {
      query = query.eq('state_code', stateFilter.toUpperCase());
    }

    const { data: pageData, error } = await query;

    if (error) {
      console.error('Error fetching zip forecasts:', error.message);
      break;
    }

    if (!pageData || pageData.length === 0) break;

    allForecasts.push(...pageData);

    if (pageData.length < pageSize) break; // Last page
    page++;
  }

  console.log(`[ZHVF Zip] Fetched ${allForecasts.length} forecast records`);
  if (allForecasts.length === 0) {
    console.log('[ZHVF Zip] No records found, returning empty');
    return [];
  }
  const forecasts = allForecasts;

  // Group by region_id to combine forecast metrics
  const byRegion = new Map<number, any>();
  for (const f of forecasts) {
    if (!byRegion.has(f.region_id)) {
      byRegion.set(f.region_id, {
        region_id: String(f.region_id),
        region_name: f.region_name,
        zip_code: f.region_name, // region_name IS the ZIP code
        state_abbrev: f.state_code,
        forecast_1m: null,
        forecast_3m: null,
        forecast_12m: null,
        date: f.period_date,
        geography: 'Zip',
      });
    }
    const entry = byRegion.get(f.region_id);
    if (f.metric_name === 'zhvf_1m') entry.forecast_1m = f.value;
    if (f.metric_name === 'zhvf_3m') entry.forecast_3m = f.value;
    if (f.metric_name === 'zhvf_12m') entry.forecast_12m = f.value;
  }

  const result = [...byRegion.values()]
    .filter((f) => {
      // Must have a non-null value for the selected horizon (0 is valid, null is not)
      const horizonField =
        horizon === '1m'
          ? 'forecast_1m'
          : horizon === '3m'
            ? 'forecast_3m'
            : 'forecast_12m';
      return f[horizonField] != null;
    })
    .map((f) => ({ ...f, value: getForecastValue(f, horizon) }))
    .sort(
      (a, b) => getForecastValue(b, horizon) - getForecastValue(a, horizon),
    );

  console.log(
    `[ZHVF Zip] Returning ${result.length} unique ZIPs (filtered to only those with valid ${horizon} forecast)`,
  );
  if (result.length === 0 && allForecasts.length > 0) {
    console.log(
      `[ZHVF Zip] WARNING: Filtered out all ${allForecasts.length} records. Check horizon field values.`,
    );
  }
  return result;
}
