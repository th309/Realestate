import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CalculatedMetricsService } from './calculated-metrics.service';

@ApiTags('metrics')
@Controller('api/metrics')
export class MetricsRentRatiosController {
  constructor(
    private readonly calculatedMetricsService: CalculatedMetricsService,
  ) {}

  /**
   * Get GRM (Gross Rent Multiplier) for metros
   */
  @Get('grm/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroGRM() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap('grm');
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Metro',
        metric: 'grm',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }

    return {
      success: false,
      error: 'No GRM data available. Run batch calculation first.',
      data: [],
    };
  }

  @Get('grm/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyGRM() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'grm',
        'county',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'County',
        metric: 'grm',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }
    return {
      success: false,
      error: 'No GRM data available for counties. Run batch calculation.',
      data: [],
    };
  }

  @Get('grm/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipGRM() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'grm',
        'zip',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Zip',
        metric: 'grm',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }
    return {
      success: false,
      error: 'No GRM data available for ZIPs. Run batch calculation.',
      data: [],
    };
  }

  /**
   * Rent-to-Price Ratio endpoints
   */
  @Get('rent-to-price/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroRentToPrice() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'rent_to_price_ratio',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Metro',
        metric: 'rent_to_price_ratio',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }
    return {
      success: false,
      error: 'No Rent-to-Price data available. Run batch calculation.',
      data: [],
    };
  }

  @Get('rent-to-price/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyRentToPrice() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'rent_to_price_ratio',
        'county',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'County',
        metric: 'rent_to_price_ratio',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }
    return {
      success: false,
      error:
        'No Rent-to-Price data available for counties. Run batch calculation.',
      data: [],
    };
  }

  @Get('rent-to-price/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipRentToPrice() {
    const preCalculated =
      await this.calculatedMetricsService.getInvestmentMetricsForMap(
        'rent_to_price_ratio',
        'zip',
      );
    if (preCalculated.success && preCalculated.data.length > 0) {
      return {
        success: true,
        count: preCalculated.data.length,
        geography: 'Zip',
        metric: 'rent_to_price_ratio',
        source: 'pre-calculated',
        data: preCalculated.data,
      };
    }
    return {
      success: false,
      error: 'No Rent-to-Price data available for ZIPs. Run batch calculation.',
      data: [],
    };
  }
}
