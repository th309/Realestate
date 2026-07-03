import { Controller, Get, Header, Inject, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeStateToCode } from '../common/geo';
import { CalculatedMetricsService } from './calculated-metrics.service';
import { computeMetroOvervalued } from './metrics-overvalued.helper';
import { precalculatedMapResponse } from './metrics-controller.helpers';

@ApiTags('metrics')
@Controller('api/metrics')
export class MetricsMapPrecalcController {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly calculatedMetricsService: CalculatedMetricsService,
  ) {}

  /**
   * Get overvalued percentage for metros
   * Calculated as: ((ZHVI / median_income) - 3.5) / 3.5 * 100
   * Uses pre-calculated data from calculated_metrics when available; otherwise
   * computes from zillow_metro (long-format) ZHVI and Census median income.
   */
  @Get('overvalued/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroOvervalued(@Query('date') date?: string) {
    return computeMetroOvervalued(
      this.supabase,
      this.calculatedMetricsService,
      date,
    );
  }

  /**
   * Get overvalued percentage for counties (pre-calculated, latest period).
   */
  @Get('overvalued/counties')
  @ApiOperation({
    summary: 'Overvalued % for all counties (pre-calculated, latest period)',
  })
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyOvervalued() {
    return precalculatedMapResponse(
      this.calculatedMetricsService,
      'overvalued_pct',
      'county',
      'County',
    );
  }

  /**
   * Get overvalued percentage for ZIPs (pre-calculated, latest period).
   */
  @Get('overvalued/zips')
  @ApiOperation({
    summary: 'Overvalued % for all ZIPs (pre-calculated, latest period)',
  })
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipOvervalued() {
    return precalculatedMapResponse(
      this.calculatedMetricsService,
      'overvalued_pct',
      'zip',
      'Zip',
    );
  }

  // ============================================================================
  // RENTER DEMAND INDEX (calculated stand-in for Zillow ZORDI)
  // ============================================================================

  @Get('renter-demand/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroRenterDemand() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'renter_demand_index',
        'metro',
      );
    return {
      success: preCalculated.success,
      count: preCalculated.data.length,
      geography: 'Metro',
      metric: 'renter_demand_index',
      source: 'calculated_metrics',
      data: preCalculated.data,
    };
  }

  @Get('renter-demand/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyRenterDemand() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'renter_demand_index',
        'county',
      );
    return {
      success: preCalculated.success,
      count: preCalculated.data.length,
      geography: 'County',
      metric: 'renter_demand_index',
      source: 'calculated_metrics',
      data: preCalculated.data,
    };
  }

  @Get('renter-demand/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipRenterDemand(@Query('state') state?: string) {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'renter_demand_index',
        'zip',
      );
    // Filter by state if provided
    let data = preCalculated.data;
    if (state && preCalculated.data.length > 0) {
      const stateCode = normalizeStateToCode(state).toUpperCase();
      data = preCalculated.data.filter(
        (d: any) => d.state_code?.toUpperCase() === stateCode,
      );
    }
    return {
      success: preCalculated.success,
      count: data.length,
      geography: 'Zip',
      metric: 'renter_demand_index',
      source: 'calculated_metrics',
      data,
    };
  }

  /**
   * Months of supply (Realtor active/pending proxy) for the map — all geos,
   * pre-calculated in calculated_metrics on the latest period only.
   */
  @Get('months-of-supply/metros')
  @ApiOperation({ summary: 'Months of supply for all metros (latest period)' })
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroMonthsOfSupply() {
    return precalculatedMapResponse(
      this.calculatedMetricsService,
      'months_of_supply',
      'metro',
      'Metro',
    );
  }

  @Get('months-of-supply/counties')
  @ApiOperation({
    summary: 'Months of supply for all counties (latest period)',
  })
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyMonthsOfSupply() {
    return precalculatedMapResponse(
      this.calculatedMetricsService,
      'months_of_supply',
      'county',
      'County',
    );
  }

  @Get('months-of-supply/zips')
  @ApiOperation({ summary: 'Months of supply for all ZIPs (latest period)' })
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipMonthsOfSupply() {
    return precalculatedMapResponse(
      this.calculatedMetricsService,
      'months_of_supply',
      'zip',
      'Zip',
    );
  }

  @Get('investment/:geoType/:geoId')
  @Header('Cache-Control', 'public, max-age=21600')
  async getInvestmentMetrics(
    @Param('geoType') geoType: string,
    @Param('geoId') geoId: string,
  ) {
    const metrics = await this.calculatedMetricsService.getMetrics(
      geoId,
      geoType,
    );

    if (!metrics) {
      return {
        success: false,
        error: 'No calculated metrics found for this geography',
        data: null,
      };
    }

    return {
      success: true,
      geography_type: geoType,
      geography_id: geoId,
      data: {
        cap_rate: metrics.cap_rate,
        gross_yield: metrics.gross_yield,
        rent_to_price_ratio: metrics.rent_to_price_ratio,
        grm: metrics.grm,
        overvalued_pct: metrics.overvalued_pct,
        months_of_supply: metrics.months_of_supply,
        absorption_rate: metrics.absorption_rate,
      },
    };
  }
}
