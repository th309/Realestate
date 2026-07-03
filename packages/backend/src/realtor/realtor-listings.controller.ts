import { Controller, Get, Query } from '@nestjs/common';
import { RealtorService } from './realtor.service';

@Controller('api/realtor')
export class RealtorListingsController {
  constructor(private readonly realtorService: RealtorService) {}

  // ============================================================================
  // Listings National (new_listing_count / pending_listing_count)
  // ============================================================================

  @Get('new-listings/national')
  async getNationalNewListings(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'new_listing_count',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'new_listing_count',
      data,
    };
  }

  @Get('pending-listings/national')
  async getNationalPendingListings(@Query('date') date?: string) {
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

  // ============================================================================
  // New Listings (new_listing_count)
  // ============================================================================

  @Get('new-listings/states')
  async getStateNewListings(@Query('date') date?: string) {
    const data = await this.realtorService.getStateNewListings(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'new_listing_count',
      data,
    };
  }

  @Get('new-listings/metros')
  async getMetroNewListings(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroNewListings(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'new_listing_count',
      data,
    };
  }

  @Get('new-listings/counties')
  async getCountyNewListings(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyNewListings(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'new_listing_count',
      data,
    };
  }

  @Get('new-listings/zips')
  async getZipNewListings(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipNewListings(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'new_listing_count',
      data,
    };
  }

  // ============================================================================
  // New Listings YoY (new_listing_count_yy)
  // ============================================================================

  @Get('new-listings-yoy/national')
  async getNationalNewListingsYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'new_listing_count_yy',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'new_listing_count_yy',
      data,
    };
  }

  @Get('new-listings-yoy/states')
  async getStateNewListingsYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getStateNewListingsYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'new_listing_count_yy',
      data,
    };
  }

  @Get('new-listings-yoy/metros')
  async getMetroNewListingsYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroNewListingsYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'new_listing_count_yy',
      data,
    };
  }

  @Get('new-listings-yoy/counties')
  async getCountyNewListingsYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyNewListingsYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'new_listing_count_yy',
      data,
    };
  }

  @Get('new-listings-yoy/zips')
  async getZipNewListingsYoy(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipNewListingsYoy(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'new_listing_count_yy',
      data,
    };
  }

  // ============================================================================
  // Pending Listings (pending_listing_count)
  // ============================================================================

  @Get('pending-listings/states')
  async getStatePendingListings(@Query('date') date?: string) {
    const data = await this.realtorService.getStatePendingListings(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'pending_listing_count',
      data,
    };
  }

  @Get('pending-listings/metros')
  async getMetroPendingListings(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroPendingListings(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'pending_listing_count',
      data,
    };
  }

  @Get('pending-listings/counties')
  async getCountyPendingListings(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyPendingListings(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'pending_listing_count',
      data,
    };
  }

  @Get('pending-listings/zips')
  async getZipPendingListings(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipPendingListings(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'pending_listing_count',
      data,
    };
  }
}
