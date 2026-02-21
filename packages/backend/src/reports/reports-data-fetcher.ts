/**
 * Reports Data Fetcher
 *
 * Standalone functions extracted from ReportsService that handle
 * the data fetching pipeline for report generation:
 * - Market metrics (snapshot + historical supplement)
 * - State/national benchmarks
 * - Historical time series data
 * - Trend calculation
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { MarketSnapshotService } from '../market-snapshot/market-snapshot.service';
import { TimeSeriesService, TimeSeriesDataPoint } from '../timeseries/timeseries.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { HISTORY_MONTHS_MAX } from '../common/history.constants';
import { MarketMetrics } from './reports-market-comparison';

const logger = new Logger('ReportsDataFetcher');

/** Historical data for a single metric */
export interface HistoricalMetricData {
  data: Array<{ date: string; value: number }>;
  trend: 'up' | 'down' | 'stable';
  change_pct: number;
}

/** Historical data collection for all metrics */
export interface HistoricalData {
  [metricId: string]: HistoricalMetricData;
}

/**
 * Fetch market metrics using MarketSnapshotService (same data feed as market pages)
 * then supplement with historical calculations the snapshot doesn't provide.
 */
export async function fetchMarketMetrics(
  supabaseClient: SupabaseClient,
  marketSnapshotService: MarketSnapshotService,
  geographyId: string,
  geographyType: 'metro' | 'county' | 'zip',
  requiredMetrics?: string[],
  metricResolutionService?: MetricResolutionService,
): Promise<MarketMetrics> {
  const metrics: MarketMetrics = {};

  try {
    // Use MarketSnapshotService - same data feed as market pages
    const snapshot = await marketSnapshotService.getSnapshot(geographyType, geographyId);
    const sm = snapshot.metrics; // Record<string, { value, date }>

    // Map snapshot metric IDs to MarketMetrics field names
    const v = (id: string) => sm[id]?.value ?? undefined;

    // Price metrics
    metrics.zhvi = v('home_value');
    metrics.zhvi_yoy = v('home_value_yoy');
    metrics.zhvf_1yr_pct = v('home_price_forecast');
    metrics.median_listing_price = v('listing_price');
    metrics.median_listing_price_yoy = v('home_value_yoy');

    // Rent metrics
    metrics.zori = v('rent_index');
    metrics.zordi = v('rent_for_houses') ?? undefined;

    // Market activity
    metrics.hotness_score = v('hotness_score');
    metrics.demand_score = v('demand_score');
    metrics.supply_score = v('supply_score');
    metrics.days_on_market = v('days_on_market');
    metrics.active_listing_count = v('for_sale_inventory');
    metrics.inventory_yoy = v('inventory_yoy');
    metrics.pending_ratio = v('pending_ratio');
    metrics.price_reduced_share = v('price_cut_pct');
    metrics.sale_to_list_ratio = v('sale_to_list');

    // Investment metrics
    metrics.cap_rate = v('cap_rate');
    metrics.gross_yield = v('gross_yield');
    metrics.grm = v('grm');
    metrics.overvalued_pct = v('overvalued_pct');
    metrics.rent_to_price_ratio = v('rent_to_price_ratio');

    // Census/Economic
    metrics.population = v('population');
    metrics.median_income = v('median_income');
    metrics.median_household_income = v('median_income');
    metrics.median_age = v('median_age');
    metrics.population_growth_yoy = v('population_growth');
    metrics.unemployment_rate = v('unemployment_rate');
    metrics.job_growth_yoy = v('job_growth');
    metrics.income_growth_yoy = v('income_growth');
    metrics.homeownership_rate = v('homeownership_rate');

    // 5yr appreciation from calculated metrics
    metrics.zhvi_5y_cagr = v('home_value_5yr');

    // Fallbacks via centralized MetricResolutionService (source of truth: fallback-registry.ts)
    // home_value: Zillow ZHVI -> Census ACS -> Realtor listing price
    // rent_index: Zillow ZORI -> HUD FMR (ZIP) -> Census median_gross_rent
    // unemployment_rate: economic table with geo inheritance
    // hotness_score/demand_score: realtor with geo inheritance
    if (metricResolutionService) {
      const fallbackTargets: Array<{ metricId: string; field: keyof MarketMetrics }> = [];
      if (metrics.zhvi == null) fallbackTargets.push({ metricId: 'home_value', field: 'zhvi' });
      if (metrics.zori == null) fallbackTargets.push({ metricId: 'rent_index', field: 'zori' });
      if (metrics.unemployment_rate == null) fallbackTargets.push({ metricId: 'unemployment_rate', field: 'unemployment_rate' });
      if (metrics.hotness_score == null) fallbackTargets.push({ metricId: 'hotness_score', field: 'hotness_score' });
      if (metrics.demand_score == null) fallbackTargets.push({ metricId: 'demand_score', field: 'demand_score' });

      if (fallbackTargets.length > 0) {
        try {
          const resolved = await metricResolutionService.resolveMetricBatch(
            fallbackTargets.map(t => t.metricId),
            geographyType,
            geographyId,
          );
          for (const { metricId, field } of fallbackTargets) {
            const r = resolved[metricId];
            if (r?.value != null) {
              (metrics as any)[field] = r.value;
            }
          }
        } catch (err) {
          logger.warn(`MetricResolution fallback failed for ${geographyType}/${geographyId}:`, err);
        }
      }
    } else {
      // Legacy fallback when MetricResolutionService is not available
      if (metrics.zhvi == null && metrics.median_listing_price != null) {
        metrics.zhvi = metrics.median_listing_price;
      }
    }

    // --- Supplement with historical calculations the snapshot doesn't provide ---

    // Calculate 3yr/5yr CAGR and YoY from ZHVI history
    if (metrics.zhvi_3y_cagr == null || metrics.zori_yoy == null) {
      const zillowTable = geographyType === 'metro' ? 'zillow_metro'
        : geographyType === 'county' ? 'zillow_county' : 'zillow_zip';
      const zillowIdCol = geographyType === 'metro' ? 'cbsa_code'
        : geographyType === 'county' ? 'fips_code' : 'region_name';

      // ZHVI history for 3yr CAGR
      if (metrics.zhvi_3y_cagr == null) {
        const { data: zhviHistory } = await supabaseClient
          .from(zillowTable)
          .select('value, period_date')
          .eq(zillowIdCol, geographyId)
          .eq('metric_name', 'zhvi')
          .order('period_date', { ascending: false })
          .limit(61);

        if (zhviHistory && zhviHistory.length >= 1) {
          const current = zhviHistory[0]?.value;
          if (zhviHistory.length >= 36) {
            const threeYrAgo = zhviHistory[Math.min(36, zhviHistory.length - 1)]?.value;
            if (current && threeYrAgo && threeYrAgo > 0) {
              metrics.zhvi_3y_cagr = (Math.pow(current / threeYrAgo, 1 / 3) - 1) * 100;
            }
          }
          if (metrics.zhvi_5y_cagr == null && zhviHistory.length >= 60) {
            const fiveYrAgo = zhviHistory[Math.min(60, zhviHistory.length - 1)]?.value;
            if (current && fiveYrAgo && fiveYrAgo > 0) {
              metrics.zhvi_5y_cagr = (Math.pow(current / fiveYrAgo, 1 / 5) - 1) * 100;
            }
          }
        }
      }

      // ZORI history for rent YoY
      if (metrics.zori_yoy == null) {
        const { data: zoriHistory } = await supabaseClient
          .from(zillowTable)
          .select('value, period_date')
          .eq(zillowIdCol, geographyId)
          .eq('metric_name', 'zori')
          .order('period_date', { ascending: false })
          .limit(13);

        if (zoriHistory && zoriHistory.length >= 12) {
          const currentRent = zoriHistory[0]?.value;
          const rentYearAgo = zoriHistory[12]?.value;
          if (currentRent && rentYearAgo && rentYearAgo > 0) {
            metrics.zori_yoy = ((currentRent - rentYearAgo) / rentYearAgo) * 100;
          }
        }
      }
    }

    // Calculate population_growth_yoy from census if snapshot didn't provide it
    if (metrics.population_growth_yoy == null && metrics.population != null) {
      const censusTable = geographyType === 'metro' ? 'census_metro'
        : geographyType === 'county' ? 'census_county' : 'census_zip';
      const censusIdCol = geographyType === 'metro' ? 'cbsa_code'
        : geographyType === 'county' ? 'fips_code' : 'zcta';

      const { data: censusRows } = await supabaseClient
        .from(censusTable)
        .select('total_population')
        .eq(censusIdCol, geographyId)
        .order('year', { ascending: false })
        .limit(2);

      if (censusRows && censusRows.length >= 2) {
        const curr = censusRows[0]?.total_population;
        const prev = censusRows[1]?.total_population;
        if (curr && prev && prev > 0) {
          metrics.population_growth_yoy = ((curr - prev) / prev) * 100;
        }
      }
    }

    // Create aliases for template variable names
    metrics.market_heat_index = metrics.hotness_score;
    metrics.for_sale_inventory = metrics.active_listing_count;
    metrics.days_to_pending = metrics.days_on_market;
    metrics.cap_rate_proxy = metrics.cap_rate;
    metrics.gross_rent_multiplier = metrics.grm;
    metrics.price_cut_pct = metrics.price_reduced_share;

    logger.log(`Fetched market metrics via snapshot for ${geographyType} ${geographyId}: ${Object.keys(metrics).filter(k => metrics[k as keyof MarketMetrics] !== undefined).length} fields`);
  } catch (error) {
    logger.error(`Failed to fetch market metrics for ${geographyId}:`, error);
  }

  return metrics;
}

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

    logger.log(`Fetched state benchmark for ${stateCode}: ${Object.keys(benchmarks).filter(k => benchmarks[k] != null).length} fields`);
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
      benchmarks.median_listing_price_yoy = nationalData.median_listing_price_yy;
      benchmarks.pending_ratio = nationalData.pending_ratio;
      benchmarks.price_reduced_share = nationalData.price_reduced_share;
      benchmarks.demand_score = nationalData.demand_score;
    }

    logger.log(`Fetched national benchmark: ${Object.keys(benchmarks).filter(k => benchmarks[k] != null).length} fields`);
  } catch (error) {
    logger.warn('Failed to fetch national benchmark:', error);
  }

  return benchmarks;
}

/**
 * Fetch historical data for key metrics (last 6 months)
 *
 * Metrics with timeseries support:
 * - zhvi (home_value): Zillow Home Value Index
 * - zori (rent_index): Zillow Observed Rent Index
 * - days_on_market: Median days on market from Realtor
 * - active_listing_count (for_sale_inventory): Active listings from Realtor
 * - hotness_score: Market hotness from Realtor
 * - cap_rate: Calculated cap rate (computed from ZHVI + ZORI)
 *
 * @param timeSeriesService - TimeSeriesService instance for fetching time series data
 * @param geographyId - The geography ID (CBSA code, FIPS, or ZIP)
 * @param geographyType - Type of geography
 * @returns Historical data for each metric with trend and change percentage
 */
export async function fetchHistoricalData(
  timeSeriesService: TimeSeriesService,
  geographyId: string,
  geographyType: 'metro' | 'county' | 'zip',
): Promise<HistoricalData> {
  const historical: HistoricalData = {};

  // Key metrics that have timeseries data
  // Map report metric names to timeseries metricIds
  const metricsToFetch: Array<{ reportKey: string; timeseriesId: string }> = [
    { reportKey: 'zhvi', timeseriesId: 'home_value' },
    { reportKey: 'zori', timeseriesId: 'rent_index' },
    { reportKey: 'days_on_market', timeseriesId: 'days_on_market' },
    { reportKey: 'active_listing_count', timeseriesId: 'for_sale_inventory' },
    { reportKey: 'hotness_score', timeseriesId: 'hotness_score' },
    { reportKey: 'cap_rate', timeseriesId: 'cap_rate' },
  ];

  // Fetch all metrics in parallel for performance
  const fetchPromises = metricsToFetch.map(async ({ reportKey, timeseriesId }) => {
    try {
      // Use lastPoints to get the most recent N months of data
      // HISTORY_MONTHS_MAX = 6, so we fetch 6 data points
      const data = await timeSeriesService.getTimeSeries(
        timeseriesId,
        geographyType,
        geographyId,
        undefined, // startDate
        undefined, // endDate
        undefined, // limit
        HISTORY_MONTHS_MAX, // lastPoints - get last 6 months
      );

      if (!data || data.length === 0) {
        logger.debug(`No historical data for ${reportKey} in ${geographyType} ${geographyId}`);
        return { reportKey, result: null };
      }

      // Calculate trend and change percentage
      const { trend, change_pct } = calculateTrendAndChange(data);

      return {
        reportKey,
        result: {
          data: data.map(d => ({ date: d.date, value: d.value })),
          trend,
          change_pct,
        } as HistoricalMetricData,
      };
    } catch (error) {
      logger.warn(`Failed to fetch historical data for ${reportKey}: ${error.message}`);
      return { reportKey, result: null };
    }
  });

  // Wait for all fetches to complete
  const results = await Promise.all(fetchPromises);

  // Build the historical data object
  for (const { reportKey, result } of results) {
    if (result) {
      historical[reportKey] = result;
    }
  }

  logger.log(
    `Fetched historical data for ${geographyType} ${geographyId}: ${Object.keys(historical).length} metrics`,
  );

  return historical;
}

/**
 * Calculate trend direction and percentage change from timeseries data.
 * Pure function - no external dependencies required.
 *
 * @param data - Array of timeseries data points (ordered chronologically, oldest first)
 * @returns Object with trend ('up', 'down', 'stable') and change_pct
 */
export function calculateTrendAndChange(data: TimeSeriesDataPoint[]): {
  trend: 'up' | 'down' | 'stable';
  change_pct: number;
} {
  if (data.length < 2) {
    return { trend: 'stable', change_pct: 0 };
  }

  // First value is oldest, last value is most recent
  const oldestValue = data[0].value;
  const latestValue = data[data.length - 1].value;

  // Calculate percentage change
  let change_pct = 0;
  if (oldestValue !== 0) {
    change_pct = ((latestValue - oldestValue) / Math.abs(oldestValue)) * 100;
  }

  // Round to 2 decimal places
  change_pct = Math.round(change_pct * 100) / 100;

  // Determine trend with a threshold for "stable" (within +/- 1%)
  let trend: 'up' | 'down' | 'stable';
  if (change_pct > 1) {
    trend = 'up';
  } else if (change_pct < -1) {
    trend = 'down';
  } else {
    trend = 'stable';
  }

  return { trend, change_pct };
}
