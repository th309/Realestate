/**
 * ZHVF Metro Forecast Helper
 *
 * Metro-level home value forecast fetcher extracted from zillow.service.ts for
 * file-size compliance — behavior unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { ForecastData } from '../types';
import { getLatestDate, getForecastValue } from './queries';

export async function getMetroForecast(
  supabase: SupabaseClient,
  horizon: string = '12m',
): Promise<ForecastData[]> {
  // Find latest date across ALL forecast horizons (zhvf_1m, zhvf_3m, zhvf_12m)
  // This ensures we get data even if one horizon has a different date
  const latestDates = await Promise.all([
    getLatestDate(supabase, 'metro', 'zhvf_1m'),
    getLatestDate(supabase, 'metro', 'zhvf_3m'),
    getLatestDate(supabase, 'metro', 'zhvf_12m'),
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
    `[ZHVF Metro] Latest dates: 1m=${latestDates[0]}, 3m=${latestDates[1]}, 12m=${latestDates[2]}, using=${latestDate}, horizon=${horizon}`,
  );

  if (!latestDate || latestDate === '2025-10-31') {
    console.log(
      '[ZHVF Metro] No valid latest date found (all dates are fallback or null), returning empty',
    );
    return [];
  }

  // Query all forecast metrics for that date
  // Need to paginate because there are ~2685 records (895 metros × 3 horizons)
  // and Supabase has a default 1000 row limit
  const allForecasts: any[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const { data: pageData, error } = await supabase
      .from('zillow_metro')
      .select(
        'region_id, region_name, cbsa_code, state_code, metric_name, value, period_date',
      )
      .in('metric_name', ['zhvf_1m', 'zhvf_3m', 'zhvf_12m'])
      .eq('period_date', latestDate)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching metro forecasts:', error.message);
      break;
    }

    if (!pageData || pageData.length === 0) break;

    allForecasts.push(...pageData);

    if (pageData.length < pageSize) break; // Last page
    page++;
  }

  console.log(`[ZHVF Metro] Fetched ${allForecasts.length} forecast records`);
  if (allForecasts.length === 0) {
    console.log('[ZHVF Metro] No records found, returning empty');
    return [];
  }

  // Load crosswalk to get cbsa_code mappings by zillow_region_id
  // Paginate to get all crosswalk entries (there are ~891 metros)
  const cbsaMap = new Map<number, string>();
  let crosswalkPage = 0;
  const crosswalkPageSize = 1000;

  while (true) {
    const { data: crosswalk, error: crosswalkError } = await supabase
      .from('zillow_metro_crosswalk')
      .select('zillow_region_id, cbsa_code')
      .not('cbsa_code', 'is', null)
      .range(
        crosswalkPage * crosswalkPageSize,
        (crosswalkPage + 1) * crosswalkPageSize - 1,
      );

    if (crosswalkError) {
      console.error(
        '[ZHVF Metro] Error loading crosswalk:',
        crosswalkError.message,
      );
      break;
    }

    if (!crosswalk || crosswalk.length === 0) break;

    crosswalk.forEach((row) => {
      if (row.zillow_region_id && row.cbsa_code) {
        cbsaMap.set(row.zillow_region_id, row.cbsa_code);
      }
    });

    if (crosswalk.length < crosswalkPageSize) break;
    crosswalkPage++;
  }

  console.log(
    `[ZHVF Metro] Loaded ${cbsaMap.size} CBSA mappings from crosswalk`,
  );

  const forecasts = allForecasts;

  // Group by region_id to combine forecast metrics
  const byRegion = new Map<number, any>();
  for (const f of forecasts) {
    if (!byRegion.has(f.region_id)) {
      // Use cbsa_code from crosswalk if not in record
      const cbsaCode = f.cbsa_code || cbsaMap.get(f.region_id) || null;
      byRegion.set(f.region_id, {
        region_id: String(f.region_id),
        region_name: f.region_name,
        cbsa_code: cbsaCode,
        state_abbrev: f.state_code,
        forecast_1m: null,
        forecast_3m: null,
        forecast_12m: null,
        date: f.period_date,
        geography: 'Metro',
      });
    }
    const entry = byRegion.get(f.region_id);
    if (f.metric_name === 'zhvf_1m') entry.forecast_1m = f.value;
    if (f.metric_name === 'zhvf_3m') entry.forecast_3m = f.value;
    if (f.metric_name === 'zhvf_12m') entry.forecast_12m = f.value;
  }

  // Log how many have cbsa_code now
  const withCbsa = [...byRegion.values()].filter((r) => r.cbsa_code).length;
  console.log(
    `[ZHVF Metro] Records with cbsa_code after crosswalk: ${withCbsa}/${byRegion.size}`,
  );

  // Filter out records without cbsa_code - they can't be displayed on the map
  // The map GeoJSON uses CBSA codes as keys, so records without cbsa_code won't match
  // Also filter out records where the selected horizon value is null (but allow 0 as valid)
  const result = [...byRegion.values()]
    .filter((f) => {
      // Must have cbsa_code
      if (!f.cbsa_code) return false;
      // Must have a non-null value for the selected horizon (0 is valid, null is not)
      const horizonField =
        horizon === '1m'
          ? 'forecast_1m'
          : horizon === '3m'
            ? 'forecast_3m'
            : 'forecast_12m';
      const horizonValue = f[horizonField];
      return horizonValue != null;
    })
    .map((f) => ({ ...f, value: getForecastValue(f, horizon) }))
    .sort(
      (a, b) => getForecastValue(b, horizon) - getForecastValue(a, horizon),
    );

  console.log(
    `[ZHVF Metro] Returning ${result.length} unique metros (filtered to only those with cbsa_code and valid ${horizon} forecast)`,
  );
  if (result.length === 0) {
    console.log('[ZHVF Metro] WARNING: No records returned. Diagnostic info:');
    console.log(`  - Latest date used: ${latestDate}`);
    console.log(`  - Horizon requested: ${horizon}`);
    console.log(
      `  - Total forecast records fetched from DB: ${allForecasts.length}`,
    );
    console.log(`  - Unique regions after grouping: ${byRegion.size}`);
    const regionsWithCbsa = [...byRegion.values()].filter((r) => r.cbsa_code);
    console.log(`  - Regions with cbsa_code: ${regionsWithCbsa.length}`);
    const horizonField =
      horizon === '1m'
        ? 'forecast_1m'
        : horizon === '3m'
          ? 'forecast_3m'
          : 'forecast_12m';
    const regionsWithHorizonValue = [...byRegion.values()].filter(
      (r) => r[horizonField] != null,
    );
    console.log(
      `  - Regions with non-null ${horizonField}: ${regionsWithHorizonValue.length}`,
    );
    if (byRegion.size > 0) {
      const sampleRegion = [...byRegion.values()][0];
      console.log(`  - Sample region:`, {
        region_id: sampleRegion.region_id,
        region_name: sampleRegion.region_name,
        cbsa_code: sampleRegion.cbsa_code,
        forecast_1m: sampleRegion.forecast_1m,
        forecast_3m: sampleRegion.forecast_3m,
        forecast_12m: sampleRegion.forecast_12m,
      });
    }
    if (regionsWithCbsa.length > 0 && regionsWithHorizonValue.length === 0) {
      const sampleWithCbsa = regionsWithCbsa[0];
      console.log(
        `  - Sample region WITH cbsa_code but missing ${horizonField}:`,
        {
          region_id: sampleWithCbsa.region_id,
          cbsa_code: sampleWithCbsa.cbsa_code,
          [horizonField]: sampleWithCbsa[horizonField],
        },
      );
    }
  }
  return result;
}
