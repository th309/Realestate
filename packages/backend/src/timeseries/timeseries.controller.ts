import { Controller, Get, Query, Param } from '@nestjs/common';
import { TimeSeriesService, TimeSeriesDataPoint } from './timeseries.service';
import { HISTORY_MONTHS_MAX, parseHistoryMonths } from '../common/history.constants';

@Controller('api/timeseries')
export class TimeSeriesController {
  constructor(private readonly timeSeriesService: TimeSeriesService) {}

  /**
   * Batch trend endpoint: returns trend data for multiple metrics in a single request.
   * Metrics are passed as comma-separated query param.
   *
   * IMPORTANT: This route MUST be defined BEFORE the generic :metric/:geoLevel/:regionId
   * route, otherwise NestJS matches "batch" as a metric ID.
   *
   * GET /api/timeseries/batch/:geoLevel/:regionId?metrics=home_value,rent_index&historyMonths=6
   */
  @Get('batch/:geoLevel/:regionId')
  async getBatchTrends(
    @Param('geoLevel') geoLevel: string,
    @Param('regionId') regionId: string,
    @Query('metrics') metricsParam?: string,
    @Query('historyMonths') historyMonths?: string,
  ) {
    const historyMonthsNum = parseHistoryMonths(historyMonths || '6');
    const metricIds = metricsParam ? metricsParam.split(',').filter(Boolean) : [];

    if (metricIds.length === 0) {
      return { success: true, trends: {} };
    }

    const lastPoints = (historyMonthsNum + 1) * 4;
    const trends: Record<string, {
      current: number | null;
      prior: number | null;
      percentChange: number | null;
      direction: 'up' | 'down' | 'stable';
    }> = {};

    await Promise.all(
      metricIds.map(async (metricId) => {
        try {
          const data = await this.timeSeriesService.getTimeSeries(
            metricId,
            geoLevel,
            regionId,
            undefined,
            undefined,
            undefined,
            lastPoints,
          );

          if (!data || data.length < 2) {
            trends[metricId] = {
              current: data?.[data.length - 1]?.value ?? null,
              prior: null,
              percentChange: null,
              direction: 'stable',
            };
            return;
          }

          const take = Math.min(historyMonthsNum + 1, data.length);
          const slice = data.slice(-take);
          const current = slice[slice.length - 1]?.value ?? null;
          const prior = slice[0]?.value ?? null;

          let percentChange: number | null = null;
          if (current != null && prior != null && prior !== 0) {
            percentChange = Number((((current - prior) / Math.abs(prior)) * 100).toFixed(1));
          }

          const direction: 'up' | 'down' | 'stable' =
            percentChange == null ? 'stable' :
            percentChange > 0.5 ? 'up' :
            percentChange < -0.5 ? 'down' : 'stable';

          trends[metricId] = { current, prior, percentChange, direction };
        } catch {
          trends[metricId] = { current: null, prior: null, percentChange: null, direction: 'stable' };
        }
      }),
    );

    return { success: true, trends };
  }

  /**
   * Get available date range for a specific metric/geography combination.
   *
   * IMPORTANT: This route with 'dates' literal prefix MUST be before the generic
   * :metric/:geoLevel/:regionId route.
   */
  @Get('dates/:metric/:geoLevel')
  async getAvailableDates(
    @Param('metric') metric: string,
    @Param('geoLevel') geoLevel: string,
  ) {
    const dates = await this.timeSeriesService.getAvailableDates(
      metric,
      geoLevel,
    );
    return {
      success: true,
      metric,
      geoLevel,
      ...dates,
    };
  }

  /**
   * Get historical time-series data for any metric/geography/region combination.
   * Optional historyMonths (0-6) returns last N months and adds current, prior, trend_change for real-time calculations.
   *
   * IMPORTANT: This generic parameterized route MUST be the LAST route in the controller.
   *
   * @param metric - Metric ID (e.g., 'listing_price', 'home_value', 'population', etc.)
   * @param geoLevel - Geography level (national, state, metro, county, city, zip)
   * @param regionId - Region identifier (state name, CBSA code, FIPS, ZIP, etc.)
   * @param startDate - Optional start date (YYYY-MM-DD)
   * @param endDate - Optional end date (YYYY-MM-DD)
   * @param limit - Optional limit on number of data points (default: all)
   * @param historyMonths - Optional 0-6; return last N months and include current, prior, trend_change, history
   */
  @Get(':metric/:geoLevel/:regionId')
  async getTimeSeries(
    @Param('metric') metric: string,
    @Param('geoLevel') geoLevel: string,
    @Param('regionId') regionId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('historyMonths') historyMonths?: string,
  ) {
    const historyMonthsNum = parseHistoryMonths(historyMonths);
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const useHistory = historyMonthsNum > 0;
    const lastPoints = useHistory ? (historyMonthsNum + 1) * 4 : undefined;

    let data = await this.timeSeriesService.getTimeSeries(
      metric,
      geoLevel,
      regionId,
      useHistory ? undefined : startDate,
      useHistory ? undefined : endDate,
      Number.isNaN(limitNum!) ? undefined : limitNum,
      lastPoints,
    );

    const body: {
      success: boolean;
      metric: string;
      geoLevel: string;
      regionId: string;
      count: number;
      data: TimeSeriesDataPoint[];
      historyMonths?: number;
      current?: number | null;
      prior?: number | null;
      trend_change?: number;
      history?: { data: TimeSeriesDataPoint[]; months: number; trend: 'up' | 'down' | 'stable'; change: number };
    } = {
      success: true,
      metric,
      geoLevel,
      regionId,
      count: data.length,
      data,
    };

    if (historyMonthsNum > 0 && data.length >= 2) {
      const take = Math.min(historyMonthsNum + 1, data.length);
      const slice = data.slice(-take);
      const current = slice[slice.length - 1]?.value ?? null;
      const prior = slice[slice.length - 2]?.value ?? null;
      const change = current != null && prior != null ? Number((current - prior).toFixed(4)) : 0;
      const trend = change > 0.0001 ? 'up' : change < -0.0001 ? 'down' : 'stable';

      body.historyMonths = historyMonthsNum;
      body.current = current;
      body.prior = prior;
      body.trend_change = change;
      body.history = {
        data: slice,
        months: historyMonthsNum,
        trend,
        change,
      };
      body.data = slice;
      body.count = slice.length;
    }

    return body;
  }
}
