import { Controller, Get, Query } from '@nestjs/common';
import { RealtorService } from './realtor.service';

@Controller('api/realtor')
export class RealtorPriceController {
  constructor(private readonly realtorService: RealtorService) {}

  // ============================================================================
  // Listing Price (median_listing_price) - Realtor's home value
  // ============================================================================

  @Get('listing-price/national')
  async getNationalListingPrice(@Query('date') date?: string) {
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

  @Get('listing-price/states')
  async getStateListingPrice(@Query('date') date?: string) {
    const data = await this.realtorService.getStateListingPrice(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'median_listing_price',
      data,
    };
  }

  @Get('listing-price/metros')
  async getMetroListingPrice(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroListingPrice(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'median_listing_price',
      data,
    };
  }

  @Get('listing-price/counties')
  async getCountyListingPrice(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyListingPrice(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'median_listing_price',
      data,
    };
  }

  @Get('listing-price/zips')
  async getZipListingPrice(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipListingPrice(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'median_listing_price',
      data,
    };
  }

  // ============================================================================
  // Price per Sq Ft (median_listing_price_per_square_foot)
  // ============================================================================

  @Get('price-per-sqft/national')
  async getNationalPricePerSqft(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'median_listing_price_per_square_foot',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'median_listing_price_per_square_foot',
      data,
    };
  }

  @Get('price-per-sqft/states')
  async getStatePricePerSqft(@Query('date') date?: string) {
    const data = await this.realtorService.getStatePricePerSqft(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'median_listing_price_per_square_foot',
      data,
    };
  }

  @Get('price-per-sqft/metros')
  async getMetroPricePerSqft(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroPricePerSqft(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'median_listing_price_per_square_foot',
      data,
    };
  }

  @Get('price-per-sqft/counties')
  async getCountyPricePerSqft(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyPricePerSqft(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'median_listing_price_per_square_foot',
      data,
    };
  }

  @Get('price-per-sqft/zips')
  async getZipPricePerSqft(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipPricePerSqft(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'median_listing_price_per_square_foot',
      data,
    };
  }
}
