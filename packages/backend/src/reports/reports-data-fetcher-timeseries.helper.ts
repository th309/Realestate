/**
 * Reports Data Fetcher — timeseries history
 *
 * Fetches historical time series for key report metrics and computes trend +
 * change percentage. Extracted from reports-data-fetcher.ts for file-size
 * compliance.
 */

import { Logger } from '@nestjs/common';
import {
  TimeSeriesService,
  TimeSeriesDataPoint,
} from '../timeseries/timeseries.service';
import { HISTORY_MONTHS_MAX } from '../common/history.constants';
import {
  HistoricalData,
  HistoricalMetricData,
} from './reports-data-fetcher.types';

const logger = new Logger('ReportsDataFetcher');

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
  const fetchPromises = metricsToFetch.map(
    async ({ reportKey, timeseriesId }) => {
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
          logger.debug(
            `No historical data for ${reportKey} in ${geographyType} ${geographyId}`,
          );
          return { reportKey, result: null };
        }

        // Calculate trend and change percentage
        const { trend, change_pct } = calculateTrendAndChange(data);

        return {
          reportKey,
          result: {
            data: data.map((d) => ({ date: d.date, value: d.value })),
            trend,
            change_pct,
          } as HistoricalMetricData,
        };
      } catch (error) {
        logger.warn(
          `Failed to fetch historical data for ${reportKey}: ${error.message}`,
        );
        return { reportKey, result: null };
      }
    },
  );

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
