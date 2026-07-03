/**
 * ZHVI Date & Time-Series Helpers
 *
 * ZHVI available-date discovery and per-region time-series fetchers extracted
 * from zillow.service.ts for file-size compliance — behavior unchanged.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export async function getZhviAvailableDates(
  supabase: SupabaseClient,
  geography: string,
): Promise<string[]> {
  // Use the appropriate long-format table based on geography
  const table =
    geography.toLowerCase() === 'state'
      ? 'zillow_state'
      : geography.toLowerCase() === 'metro'
        ? 'zillow_metro'
        : geography.toLowerCase() === 'county'
          ? 'zillow_county'
          : geography.toLowerCase() === 'zip'
            ? 'zillow_zip'
            : geography.toLowerCase() === 'city'
              ? 'zillow_city'
              : 'zillow_metro';

  const { data } = await supabase
    .from(table)
    .select('period_date')
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: false })
    .limit(100);

  const dates = data?.map((d) => d.period_date as string) || [];
  return [...new Set(dates)];
}

export async function getZhviTimeSeries(
  supabase: SupabaseClient,
  regionId: string,
  geography: string,
): Promise<any[]> {
  // Use the appropriate long-format table based on geography
  const table =
    geography.toLowerCase() === 'state'
      ? 'zillow_state'
      : geography.toLowerCase() === 'metro'
        ? 'zillow_metro'
        : geography.toLowerCase() === 'county'
          ? 'zillow_county'
          : geography.toLowerCase() === 'zip'
            ? 'zillow_zip'
            : geography.toLowerCase() === 'city'
              ? 'zillow_city'
              : 'zillow_metro';

  const { data, error } = await supabase
    .from(table)
    .select('period_date, value')
    .eq('region_id', regionId)
    .eq('metric_name', 'zhvi')
    .order('period_date', { ascending: true });

  if (error) throw new Error(error.message);
  return data?.map((d) => ({ date: d.period_date, value: d.value })) || [];
}
