import { Controller, Get, Query } from '@nestjs/common';
import { RealtorService } from './realtor.service';

@Controller('api/realtor')
export class RealtorHomeValueController {
  constructor(private readonly realtorService: RealtorService) {}

  // ============================================================================
  // Home Value National (median_listing_price)
  // ============================================================================

  @Get('home-value/national')
  async getNationalHomeValue(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'median_listing_price',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'median_listing_price',
      data,
    };
  }

  @Get('home-value-yoy/national')
  async getNationalHomeValueYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'median_listing_price_yy',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'median_listing_price_yy',
      data,
    };
  }

  @Get('home-value-mom/national')
  async getNationalHomeValueMom(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'median_listing_price_mm',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'median_listing_price_mm',
      data,
    };
  }

  // ============================================================================
  // Home Value (median_listing_price)
  // ============================================================================

  @Get('home-value/states')
  async getStateHomeValues(@Query('date') date?: string) {
    const data = await this.realtorService.getStateHomeValues(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'median_listing_price',
      data,
    };
  }

  @Get('home-value/metros')
  async getMetroHomeValues(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHomeValues(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'median_listing_price',
      data,
    };
  }

  @Get('home-value/counties')
  async getCountyHomeValues(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHomeValues(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'median_listing_price',
      data,
    };
  }

  @Get('home-value/zips')
  async getZipHomeValues(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipHomeValues(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'median_listing_price',
      data,
    };
  }

  // ============================================================================
  // Home Value YoY (median_listing_price_yy)
  // ============================================================================

  @Get('home-value-yoy/states')
  async getStateHomeValueYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getStateHomeValueYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'median_listing_price_yy',
      data,
    };
  }

  @Get('home-value-yoy/metros')
  async getMetroHomeValueYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHomeValueYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'median_listing_price_yy',
      data,
    };
  }

  @Get('home-value-yoy/counties')
  async getCountyHomeValueYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHomeValueYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'median_listing_price_yy',
      data,
    };
  }

  @Get('home-value-yoy/zips')
  async getZipHomeValueYoy(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipHomeValueYoy(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'median_listing_price_yy',
      data,
    };
  }

  // ============================================================================
  // Home Value MoM (median_listing_price_mm)
  // ============================================================================

  @Get('home-value-mom/states')
  async getStateHomeValueMom(@Query('date') date?: string) {
    const data = await this.realtorService.getStateHomeValueMom(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'median_listing_price_mm',
      data,
    };
  }

  @Get('home-value-mom/metros')
  async getMetroHomeValueMom(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHomeValueMom(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'median_listing_price_mm',
      data,
    };
  }

  @Get('home-value-mom/counties')
  async getCountyHomeValueMom(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHomeValueMom(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'median_listing_price_mm',
      data,
    };
  }

  @Get('home-value-mom/zips')
  async getZipHomeValueMom(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipHomeValueMom(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'median_listing_price_mm',
      data,
    };
  }
}
