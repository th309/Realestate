/**
 * Reports Data Fetcher — benchmarks
 *
 * State- and national-level benchmark metric fetchers used for report
 * comparisons. Extracted from reports-data-fetcher.ts for file-size compliance.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

const logger = new Logger('ReportsDataFetcher');

/**
 * Fetch state-level benchmark metrics from realtor_state table.
 * Returns key metrics for comparison: median_listing_price, days_on_market,
 * active_listing_count, inventory_yoy, hotness_score.
 *
 * @param supabaseClient - Supabase client instance
 * @param stateCode - State abbreviation (e.g., "CA", "TX") or FIPS code
 */
export async function fetchStateBenchmark(
  supabaseClient: SupabaseClient,
  stateCode: string,
): Promise<Record<string, any>> {
  const benchmarks: Record<string, any> = {};

  try {
    // realtor_state uses state_id as the abbreviation (e.g., "NV", "CA")
    // If stateCode looks like a FIPS (2-digit number), we still try it as-is
    // since the realtor service handles conversion elsewhere
    const { data: stateData } = await supabaseClient
      .from('realtor_state')
      .select('*')
      .eq('state_id', stateCode.toUpperCase())
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (stateData) {
      benchmarks.median_listing_price = stateData.median_listing_price;
      benchmarks.days_on_market = stateData.median_days_on_market;
      benchmarks.active_listing_count = stateData.active_listing_count;
      benchmarks.inventory_yoy = stateData.active_listing_count_yy;
      benchmarks.hotness_score = stateData.hotness_score;
      benchmarks.median_listing_price_yoy = stateData.median_listing_price_yy;
      benchmarks.pending_ratio = stateData.pending_ratio;
      benchmarks.price_reduced_share = stateData.price_reduced_share;
      benchmarks.demand_score = stateData.demand_score;
    }

    logger.log(
      `Fetched state benchmark for ${stateCode}: ${Object.keys(benchmarks).filter((k) => benchmarks[k] != null).length} fields`,
    );
  } catch (error) {
    logger.warn(`Failed to fetch state benchmark for ${stateCode}:`, error);
  }

  return benchmarks;
}

/**
 * Fetch national-level benchmark metrics from realtor_national table.
 * Returns key metrics for comparison: median_listing_price, days_on_market,
 * active_listing_count, inventory_yoy, hotness_score.
 *
 * @param supabaseClient - Supabase client instance
 */
export async function fetchNationalBenchmark(
  supabaseClient: SupabaseClient,
): Promise<Record<string, any>> {
  const benchmarks: Record<string, any> = {};

  try {
    const { data: nationalData } = await supabaseClient
      .from('realtor_national')
      .select('*')
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (nationalData) {
      benchmarks.median_listing_price = nationalData.median_listing_price;
      benchmarks.days_on_market = nationalData.median_days_on_market;
      benchmarks.active_listing_count = nationalData.active_listing_count;
      benchmarks.inventory_yoy = nationalData.active_listing_count_yy;
      benchmarks.hotness_score = nationalData.hotness_score;
      benchmarks.median_listing_price_yoy =
        nationalData.median_listing_price_yy;
      benchmarks.pending_ratio = nationalData.pending_ratio;
      benchmarks.price_reduced_share = nationalData.price_reduced_share;
      benchmarks.demand_score = nationalData.demand_score;
    }

    logger.log(
      `Fetched national benchmark: ${Object.keys(benchmarks).filter((k) => benchmarks[k] != null).length} fields`,
    );
  } catch (error) {
    logger.warn('Failed to fetch national benchmark:', error);
  }

  return benchmarks;
}
