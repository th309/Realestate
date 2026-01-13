import { Controller, Get, Query, Param } from '@nestjs/common';
import { ZillowService } from './zillow.service';

@Controller('api/zillow')
export class ZillowController {
  constructor(private readonly zillowService: ZillowService) { }

  @Get('states')
  async getStateHomeValues(@Query('date') date?: string) {
    const data = await this.zillowService.getStateHomeValues(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      data,
    };
  }

  @Get('metros')
  async getMetroHomeValues(
    @Query('date') date?: string,
    @Query('state') state?: string,
  ) {
    const data = await this.zillowService.getMetroHomeValues(date, state);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      data,
    };
  }

  @Get('counties')
  async getCountyHomeValues(
    @Query('date') date?: string,
    @Query('state') state?: string,
  ) {
    const data = await this.zillowService.getCountyHomeValues(date, state);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      data,
    };
  }

  @Get('zips')
  async getZipHomeValues(
    @Query('state') state: string,
    @Query('county') county?: string,
    @Query('date') date?: string,
  ) {
    if (!state) {
      return {
        success: false,
        error: 'State parameter is required for ZIP-level data',
      };
    }
    const data = await this.zillowService.getZipHomeValues(state, county, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      data,
    };
  }

  @Get('cities')
  async getCityHomeValues(@Query('state') state?: string) {
    const data = await this.zillowService.getCityHomeValues(state);
    return {
      success: true,
      count: data.length,
      geography: 'City',
      data,
    };
  }

  @Get('dates')
  async getAvailableDates(@Query('geography') geography: string = 'State') {
    const dates = await this.zillowService.getAvailableDates(geography);
    return {
      success: true,
      geography,
      dates,
    };
  }

  @Get('timeseries/:regionId')
  async getTimeSeries(
    @Param('regionId') regionId: string,
    @Query('geography') geography: string = 'State',
  ) {
    const data = await this.zillowService.getTimeSeries(regionId, geography);
    return {
      success: true,
      regionId,
      geography,
      count: data.length,
      data,
    };
  }

  // ============================================================================
  // ZHVF (Forecast) Endpoints
  // ============================================================================

  @Get('forecast/metros')
  async getMetroForecast(@Query('horizon') horizon: string = '12m') {
    const data = await this.zillowService.getMetroForecast(horizon);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      horizon,
      data,
    };
  }

  @Get('forecast/zips')
  async getZipForecast(
    @Query('state') state?: string,
    @Query('horizon') horizon: string = '12m',
  ) {
    const data = await this.zillowService.getZipForecast(state, horizon);
    return {
      success: true,
      count: data.length,
      geography: 'Zip',
      horizon,
      data,
    };
  }

  // ============================================================================
  // ZORI (Rent Index) Endpoints
  // ============================================================================

  @Get('rent/metros')
  async getMetroRent(
    @Query('date') date?: string,
    @Query('propertyType') propertyType: string = 'all',
  ) {
    const data = await this.zillowService.getMetroRent(date, propertyType);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      propertyType,
      data,
    };
  }

  @Get('rent/counties')
  async getCountyRent(
    @Query('date') date?: string,
    @Query('state') state?: string,
    @Query('propertyType') propertyType: string = 'all',
  ) {
    const data = await this.zillowService.getCountyRent(date, propertyType, state);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      propertyType,
      data,
    };
  }

  @Get('rent/zips')
  async getZipRent(
    @Query('state') state: string,
    @Query('date') date?: string,
    @Query('propertyType') propertyType: string = 'all',
  ) {
    if (!state) {
      return {
        success: false,
        error: 'State parameter is required for ZIP-level data',
      };
    }
    const data = await this.zillowService.getZipRent(state, propertyType, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      propertyType,
      data,
    };
  }

  // ============================================================================
  // ZORDI (Renter Demand Index) Endpoints
  // ============================================================================

  @Get('demand/metros')
  async getMetroRenterDemand(
    @Query('date') date?: string,
    @Query('propertyType') propertyType: string = 'all',
  ) {
    const data = await this.zillowService.getMetroRenterDemand(date, propertyType);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      propertyType,
      data,
    };
  }

  @Get('demand/zips')
  async getZipRenterDemand(
    @Query('state') state: string,
    @Query('date') date?: string,
    @Query('propertyType') propertyType: string = 'all',
  ) {
    if (!state) {
      return {
        success: false,
        error: 'State parameter is required for ZIP-level data',
      };
    }
    const data = await this.zillowService.getZipRenterDemand(state, propertyType, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      propertyType,
      data,
    };
  }

  // ============================================================================
  // Market Indicators Endpoints
  // ============================================================================

  @Get('inventory/metros')
  async getMetroInventory(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroInventory(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'inventory',
      data,
    };
  }

  @Get('new-listings/metros')
  async getMetroNewListings(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroNewListings(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'new_listings',
      data,
    };
  }

  @Get('pending-listings/metros')
  async getMetroPendingListings(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroPendingListings(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'pending_listings',
      data,
    };
  }

  @Get('list-price/metros')
  async getMetroListPrice(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroListPrice(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'median_list_price',
      data,
    };
  }

  @Get('sales-count/metros')
  async getMetroSalesCount(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroSalesCount(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'sales_count',
      data,
    };
  }

  @Get('sale-price/metros')
  async getMetroSalePrice(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroSalePrice(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'median_sale_price',
      data,
    };
  }

  @Get('sale-to-list/metros')
  async getMetroSaleToList(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroSaleToList(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'sale_to_list_ratio',
      data,
    };
  }

  @Get('days-to-pending/metros')
  async getMetroDaysToPending(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroDaysToPending(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'days_to_pending',
      data,
    };
  }

  @Get('days-to-close/metros')
  async getMetroDaysToClose(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroDaysToClose(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'days_to_close',
      data,
    };
  }

  @Get('market-heat/metros')
  async getMetroMarketHeat(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroMarketHeat(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'market_heat_index',
      data,
    };
  }

  // ============================================================================
  // Price Cuts Endpoint (Combined)
  // ============================================================================

  @Get('price-cuts/metros')
  async getMetroPriceCuts(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroPriceCuts(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'price_cuts',
      data,
    };
  }

  // ============================================================================
  // New Construction Endpoint (Combined)
  // ============================================================================

  @Get('new-construction/metros')
  async getMetroNewConstruction(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroNewConstruction(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'new_construction',
      data,
    };
  }

  // ============================================================================
  // Affordability Endpoint (All metrics combined)
  // ============================================================================

  @Get('affordability/metros')
  async getMetroAffordability(@Query('date') date?: string) {
    const data = await this.zillowService.getMetroAffordability(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'affordability',
      data,
    };
  }
}
