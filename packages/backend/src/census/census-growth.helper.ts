import { SupabaseClient } from '@supabase/supabase-js';
import { CensusDataPoint } from './census.types';
import { getLatestYear } from './census-fetchers.helper';

/**
 * Compute YoY growth by comparing two consecutive years of data.
 * Used when the database doesn't store pre-computed growth columns.
 */
export async function computeYoYGrowth(
  supabase: SupabaseClient,
  baseMetricGetter: (year?: number) => Promise<CensusDataPoint[]>,
  table: string,
  year?: number,
): Promise<CensusDataPoint[]> {
  const latestYear = year || (await getLatestYear(supabase, table));
  if (!latestYear) return [];

  const [current, previous] = await Promise.all([
    baseMetricGetter(latestYear),
    baseMetricGetter(latestYear - 1),
  ]);

  const prevMap = new Map(
    previous
      .filter((d) => d.value != null)
      .map((d) => [d.region_id, d.value as number]),
  );

  return current.map((d) => {
    const prev = prevMap.get(d.region_id);
    let growth: number | null = null;
    if (d.value != null && prev != null && prev !== 0) {
      growth = Number((((d.value - prev) / prev) * 100).toFixed(2));
    }
    return { ...d, value: growth };
  });
}
