/**
 * v4 Scoring Data Fetcher
 *
 * Fetches only the 3 Redfin metrics needed for v4 PropertyIQ demand signal scoring.
 * Much lighter than fetchAllMetrics (scoring-data-fetcher.ts) which pulls from 6+ tables.
 *
 * Kept in its own file to:
 *   1. Respect the 300-line hard limit on scoring-data-fetcher.ts
 *   2. Keep v4 code cleanly separated from the v3 data pipeline
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { GeographyLevel } from './formula-weights';
import { LocationMetrics } from './scoring.types';
import {
  PAGE_SIZE,
  getRedfinTable,
  getRedfinIdColumn,
  getRedfinNameColumn,
  toEndOfMonth,
} from './scoring-data-helpers';

/**
 * Fetch only the 3 Redfin metrics needed for v4 PropertyIQ scoring.
 *
 * Returns LocationMetrics[] with:
 *   - rf_sold_above_list, rf_median_dom, months_of_supply (dynamic key)
 *   - median_price (from median_sale_price)
 */
export async function fetchV4Metrics(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate: string,
): Promise<LocationMetrics[]> {
  const table = getRedfinTable(geography);
  const idCol = getRedfinIdColumn(geography);
  const nameCol = getRedfinNameColumn(geography);

  const selectCols = [
    idCol,
    nameCol,
    'sold_above_list',
    'median_dom',
    'months_of_supply',
    'median_sale_price',
  ].join(', ');

  const redfinDate = toEndOfMonth(periodDate);
  const results: LocationMetrics[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .eq('property_type', 'All Residential')
      .eq('period_end', redfinDate)
      .order(idCol, { ascending: true })
      .range(from, to);

    if (error) throw new Error(`v4 Redfin fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const r = row as Record<string, any>;
      const loc: LocationMetrics & { months_of_supply?: number } = {
        location_id: r[idCol],
        location_name: r[nameCol] || r[idCol],
        median_price: r.median_sale_price ?? undefined,
        rf_sold_above_list: r.sold_above_list ?? undefined,
        rf_median_dom: r.median_dom ?? undefined,
      };
      // months_of_supply is set as a dynamic property for the v4 engine
      if (r.months_of_supply != null) {
        (loc as Record<string, any>).months_of_supply = r.months_of_supply;
      }
      results.push(loc);
    }

    if (data.length < PAGE_SIZE) break;
    page += 1;
  }

  return results;
}
