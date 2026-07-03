import { Controller, Get, Header, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { CalculatedMetricsService } from './calculated-metrics.service';
import { computeMetroCapRate } from './metrics-cap-rate.helper';

@ApiTags('metrics')
@Controller('api/metrics')
export class MetricsYieldController {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly calculatedMetricsService: CalculatedMetricsService,
  ) {}

  /**
   * Get cap rate proxy for metros
   * Calculated as: (ZORI * 12 * 0.6) / ZHVI * 100
   */
  @Get('cap-rate/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroCapRate(@Query('date') date?: string) {
    return computeMetroCapRate(
      this.supabase,
      this.calculatedMetricsService,
      date,
    );
  }

  /**
   * Get cap rate for counties
   */
  @Get('cap-rate/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyCapRate() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'cap_rate',
        'county',
      );

    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'County',
        metric: 'cap_rate',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    return {
      success: false,
      error:
        'No calculated Cap Rate data available for counties. Run batch calculation.',
      data: [],
    };
  }

  /**
   * Get cap rate for zip codes
   */
  @Get('cap-rate/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipCapRate() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'cap_rate',
        'zip',
      );

    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Zip',
        metric: 'cap_rate',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    return {
      success: false,
      error:
        'No calculated Cap Rate data available for ZIPs. Run batch calculation.',
      data: [],
    };
  }

  /**
   * Get gross yield for metros (from pre-calculated data, with fallback)
   */
  @Get('gross-yield/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroGrossYield() {
    // Try pre-calculated data first
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'gross_yield',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Metro',
        metric: 'gross_yield',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    // Fall back to on-the-fly calculation (similar to cap-rate endpoint)
    return this.getMetroCapRate(); // Uses same data sources
  }

  @Get('gross-yield/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyGrossYield() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'gross_yield',
        'county',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'County',
        metric: 'gross_yield',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }
    return {
      success: false,
      error:
        'No Gross Yield data available for counties. Run batch calculation.',
      data: [],
    };
  }

  @Get('gross-yield/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipGrossYield() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'gross_yield',
        'zip',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Zip',
        metric: 'gross_yield',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }
    return {
      success: false,
      error: 'No Gross Yield data available for ZIPs. Run batch calculation.',
      data: [],
    };
  }
}
