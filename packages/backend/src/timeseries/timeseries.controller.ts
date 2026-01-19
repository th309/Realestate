import { Controller, Get, Query, Param } from '@nestjs/common';
import { TimeSeriesService } from './timeseries.service';

@Controller('api/timeseries')
export class TimeSeriesController {
  constructor(private readonly timeSeriesService: TimeSeriesService) {}

  /**
   * Get historical time-series data for any metric/geography/region combination
   *
   * @param metric - Metric ID (e.g., 'listing_price', 'home_value', 'population', etc.)
   * @param geoLevel - Geography level (national, state, metro, county, city, zip)
   * @param regionId - Region identifier (state name, CBSA code, FIPS, ZIP, etc.)
   * @param startDate - Optional start date (YYYY-MM-DD)
   * @param endDate - Optional end date (YYYY-MM-DD)
   * @param limit - Optional limit on number of data points (default: all)
   */
  @Get(':metric/:geoLevel/:regionId')
  async getTimeSeries(
    @Param('metric') metric: string,
    @Param('geoLevel') geoLevel: string,
    @Param('regionId') regionId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.timeSeriesService.getTimeSeries(
      metric,
      geoLevel,
      regionId,
      startDate,
      endDate,
      limit ? parseInt(limit) : undefined,
    );

    return {
      success: true,
      metric,
      geoLevel,
      regionId,
      count: data.length,
      data,
    };
  }

  /**
   * Get available date range for a specific metric/geography combination
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
}
