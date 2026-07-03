import { Controller, Get, Query } from '@nestjs/common';
import { RealtorService } from './realtor.service';

@Controller('api/realtor')
export class RealtorPriceChangeController {
  constructor(private readonly realtorService: RealtorService) {}

  // ============================================================================
  // Price Reduced Share (price_reduced_share)
  // ============================================================================

  @Get('price-reduced/national')
  async getNationalPriceReduced(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'price_reduced_share',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'price_reduced_share',
      data,
    };
  }

  @Get('price-reduced/states')
  async getStatePriceReduced(@Query('date') date?: string) {
    const data = await this.realtorService.getStatePriceReduced(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'price_reduced_share',
      data,
    };
  }

  @Get('price-reduced/metros')
  async getMetroPriceReduced(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroPriceReduced(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'price_reduced_share',
      data,
    };
  }

  @Get('price-reduced/counties')
  async getCountyPriceReduced(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyPriceReduced(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'price_reduced_share',
      data,
    };
  }

  @Get('price-reduced/zips')
  async getZipPriceReduced(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipPriceReduced(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'price_reduced_share',
      data,
    };
  }

  // ============================================================================
  // Price Increased Share (price_increased_share)
  // ============================================================================

  @Get('price-increased/national')
  async getNationalPriceIncreased(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'price_increased_share',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'price_increased_share',
      data,
    };
  }

  @Get('price-increased/states')
  async getStatePriceIncreased(@Query('date') date?: string) {
    const data = await this.realtorService.getStatePriceIncreased(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'price_increased_share',
      data,
    };
  }

  @Get('price-increased/metros')
  async getMetroPriceIncreased(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroPriceIncreased(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'price_increased_share',
      data,
    };
  }

  @Get('price-increased/counties')
  async getCountyPriceIncreased(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyPriceIncreased(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'price_increased_share',
      data,
    };
  }

  @Get('price-increased/zips')
  async getZipPriceIncreased(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipPriceIncreased(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'price_increased_share',
      data,
    };
  }
}
