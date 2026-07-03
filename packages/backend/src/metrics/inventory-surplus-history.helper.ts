import { SupabaseClient } from '@supabase/supabase-js';
import { PAGE_SIZE } from './inventory-surplus.types';

/**
 * Get historical inventory data for the same month across multiple years
 */
export async function getHistoricalInventory(
  supabase: SupabaseClient,
  table: string,
  idField: string,
  targetYear: number,
  targetMonth: number,
  targetDay: number,
  yearsBack: number = 5,
): Promise<Map<string, number[]>> {
  const historicalByRegion = new Map<string, number[]>();

  // Build date filters for same month in previous years (before current data year)
  const dateFilters: string[] = [];

  for (let i = 1; i <= yearsBack; i++) {
    const year = targetYear - i;
    const month = String(targetMonth).padStart(2, '0');
    const day = String(targetDay).padStart(2, '0');
    dateFilters.push(`${year}-${month}-${day}`);
  }

  // Query historical data for each year
  for (const dateStr of dateFilters) {
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('period_date', dateStr)
      .not('active_listing_count', 'is', null);

    if (data) {
      for (const row of data) {
        const regionId = row[idField];
        const count = row.active_listing_count;

        if (!historicalByRegion.has(regionId)) {
          historicalByRegion.set(regionId, []);
        }
        historicalByRegion.get(regionId)!.push(count);
      }
    }
  }

  return historicalByRegion;
}

/**
 * Get historical inventory data with pagination (for large tables)
 */
export async function getHistoricalInventoryPaginated(
  supabase: SupabaseClient,
  table: string,
  idField: string,
  targetYear: number,
  targetMonth: number,
  targetDay: number,
  yearsBack: number = 5,
): Promise<Map<string, number[]>> {
  const historicalByRegion = new Map<string, number[]>();

  for (let i = 1; i <= yearsBack; i++) {
    const year = targetYear - i;
    const month = String(targetMonth).padStart(2, '0');
    const day = String(targetDay).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from(table)
        .select('*')
        .eq('period_date', dateStr)
        .not('active_listing_count', 'is', null)
        .range(offset, offset + PAGE_SIZE - 1);

      if (!data || data.length === 0) break;

      for (const row of data) {
        const regionId = row[idField];
        const count = row.active_listing_count;

        if (!historicalByRegion.has(regionId)) {
          historicalByRegion.set(regionId, []);
        }
        historicalByRegion.get(regionId)!.push(count);
      }

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return historicalByRegion;
}
