import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { normalizeStateToCode } from '../common/geo';
import { CalculatedMetricsService } from './calculated-metrics.service';

@ApiTags('metrics')
@Controller('api/metrics')
export class MetricsGrowthController {
  constructor(
    private readonly calculatedMetricsService: CalculatedMetricsService,
  ) {}

  /**
   * Get 5-year home value CAGR for metros
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   */
  @Get('home-value-5yr/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroHomeValue5YrGrowth(@Query('date') date?: string) {
    const result =
      await this.calculatedMetricsService.get5YrGrowthForMap('metro');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error:
          'No pre-calculated CAGR data available for metros. Run the calculated metrics pipeline to generate data.',
        geography: 'Metro',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'Metro',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get 5-year home value CAGR for national
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   */
  @Get('home-value-5yr/national')
  @Header('Cache-Control', 'public, max-age=21600')
  async getNationalHomeValue5YrGrowth(@Query('date') date?: string) {
    const result =
      await this.calculatedMetricsService.get5YrGrowthForMap('national');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error:
          'No pre-calculated CAGR data available for national. Run the calculated metrics pipeline to generate data.',
        geography: 'National',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'National',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get 5-year home value CAGR for states
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   */
  @Get('home-value-5yr/states')
  @Header('Cache-Control', 'public, max-age=21600')
  async getStateHomeValue5YrGrowth(@Query('date') date?: string) {
    const result =
      await this.calculatedMetricsService.get5YrGrowthForMap('state');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error:
          'No pre-calculated CAGR data available for states. Run the calculated metrics pipeline to generate data.',
        geography: 'State',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'State',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get 5-year home value CAGR for counties
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   */
  @Get('home-value-5yr/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyHomeValue5YrGrowth(@Query('date') date?: string) {
    const result =
      await this.calculatedMetricsService.get5YrGrowthForMap('county');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error:
          'No pre-calculated CAGR data available for counties. Run the calculated metrics pipeline to generate data.',
        geography: 'County',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'County',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get 5-year home value CAGR for zip codes
   * Reads from pre-calculated table (calculated_metrics)
   * CAGR is calculated during data ingestion by CalculatedMetricsService
   * Note: State filtering should be done via the data layer or a dedicated filtered endpoint
   */
  @Get('home-value-5yr/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipHomeValue5YrGrowth(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const result =
      await this.calculatedMetricsService.get5YrGrowthForMap('zip');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error:
          'No pre-calculated CAGR data available for ZIP codes. Run the calculated metrics pipeline to generate data.',
        geography: 'ZIP',
        metric: 'home_value_5yr_cagr',
        data: [],
      };
    }

    // Apply state filter if provided (filter pre-calculated data)
    let filteredData = result.data;
    if (state) {
      const normalizedState = normalizeStateToCode(state);
      const statePattern = `, ${normalizedState.toUpperCase()}`;
      filteredData = result.data.filter((item: any) =>
        item.region_name?.toUpperCase().endsWith(statePattern),
      );
    }

    return {
      success: true,
      count: filteredData.length,
      geography: 'ZIP',
      metric: 'home_value_5yr_cagr',
      source: 'pre-calculated',
      state_filter: state || null,
      data: filteredData,
    };
  }

  /**
   * Get rent YoY growth for metros (from calculated_metrics, includes HUD FMR proxy)
   */
  @Get('rent-yoy/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroRentYoy() {
    const result =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'zori_yoy' as any,
        'metro',
      );
    return {
      success: result.success,
      count: result.data.length,
      geography: 'Metro',
      metric: 'zori_yoy',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get rent 5-year CAGR for metros (from calculated_metrics, includes HUD FMR proxy)
   */
  @Get('rent-5yr/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroRent5yr() {
    const result =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'zori_5y_cagr' as any,
        'metro',
      );
    return {
      success: result.success,
      count: result.data.length,
      geography: 'Metro',
      metric: 'zori_5y_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }

  /**
   * Get 3-year home value CAGR for metros (from calculated_metrics, uses Realtor data)
   */
  @Get('home-value-3yr/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroHomeValue3YrGrowth() {
    const result =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'zhvi_3y_cagr' as any,
        'metro',
      );
    return {
      success: result.success,
      count: result.data.length,
      geography: 'Metro',
      metric: 'zhvi_3y_cagr',
      source: 'pre-calculated',
      data: result.data,
    };
  }
}
