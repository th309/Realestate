import { Controller, Get, Query } from '@nestjs/common';
import { RealtorService } from './realtor.service';

@Controller('api/realtor')
export class RealtorActivityController {
  constructor(private readonly realtorService: RealtorService) {}

  // ============================================================================
  // Home Sales (pending_listing_count - proxy for sales activity)
  // ============================================================================

  @Get('home-sales/national')
  async getNationalHomeSales(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'pending_listing_count',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'pending_listing_count',
      data,
    };
  }

  @Get('home-sales/states')
  async getStateHomeSales(@Query('date') date?: string) {
    const data = await this.realtorService.getStateHomeSales(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'pending_listing_count',
      data,
    };
  }

  @Get('home-sales/metros')
  async getMetroHomeSales(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHomeSales(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'pending_listing_count',
      data,
    };
  }

  @Get('home-sales/counties')
  async getCountyHomeSales(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHomeSales(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'pending_listing_count',
      data,
    };
  }

  @Get('home-sales/zips')
  async getZipHomeSales(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipHomeSales(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'pending_listing_count',
      data,
    };
  }

  // ============================================================================
  // Home Sales YoY (pending_listing_count_yy)
  // ============================================================================

  @Get('home-sales-yoy/national')
  async getNationalHomeSalesYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'pending_listing_count_yy',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'pending_listing_count_yy',
      data,
    };
  }

  @Get('home-sales-yoy/states')
  async getStateHomeSalesYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getStateHomeSalesYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'pending_listing_count_yy',
      data,
    };
  }

  @Get('home-sales-yoy/metros')
  async getMetroHomeSalesYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHomeSalesYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'pending_listing_count_yy',
      data,
    };
  }

  @Get('home-sales-yoy/counties')
  async getCountyHomeSalesYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHomeSalesYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'pending_listing_count_yy',
      data,
    };
  }

  @Get('home-sales-yoy/zips')
  async getZipHomeSalesYoy(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipHomeSalesYoy(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'pending_listing_count_yy',
      data,
    };
  }

  // ============================================================================
  // Pending Ratio (pending_ratio)
  // ============================================================================

  @Get('pending-ratio/national')
  async getNationalPendingRatio(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'pending_ratio',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'pending_ratio',
      data,
    };
  }

  @Get('pending-ratio/states')
  async getStatePendingRatio(@Query('date') date?: string) {
    const data = await this.realtorService.getStatePendingRatio(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'pending_ratio',
      data,
    };
  }

  @Get('pending-ratio/metros')
  async getMetroPendingRatio(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroPendingRatio(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'pending_ratio',
      data,
    };
  }

  @Get('pending-ratio/counties')
  async getCountyPendingRatio(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyPendingRatio(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'pending_ratio',
      data,
    };
  }

  @Get('pending-ratio/zips')
  async getZipPendingRatio(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipPendingRatio(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'pending_ratio',
      data,
    };
  }
}
