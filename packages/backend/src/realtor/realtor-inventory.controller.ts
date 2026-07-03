import { Controller, Get, Query } from '@nestjs/common';
import { RealtorService } from './realtor.service';

@Controller('api/realtor')
export class RealtorInventoryController {
  constructor(private readonly realtorService: RealtorService) {}

  // ============================================================================
  // Inventory National (active_listing_count)
  // ============================================================================

  @Get('inventory/national')
  async getNationalInventory(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'active_listing_count',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'active_listing_count',
      data,
    };
  }

  @Get('inventory-yoy/national')
  async getNationalInventoryYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'active_listing_count_yy',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'active_listing_count_yy',
      data,
    };
  }

  @Get('dom/national')
  async getNationalDom(@Query('date') date?: string) {
    const data = await this.realtorService.getNationalData(
      'median_days_on_market',
      date,
    );
    return {
      success: true,
      count: data.length,
      geography: 'National',
      metric: 'median_days_on_market',
      data,
    };
  }

  // ============================================================================
  // Inventory (active_listing_count)
  // ============================================================================

  @Get('inventory/states')
  async getStateInventory(@Query('date') date?: string) {
    const data = await this.realtorService.getStateInventory(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'active_listing_count',
      data,
    };
  }

  @Get('inventory/metros')
  async getMetroInventory(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroInventory(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'active_listing_count',
      data,
    };
  }

  @Get('inventory/counties')
  async getCountyInventory(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyInventory(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'active_listing_count',
      data,
    };
  }

  @Get('inventory/zips')
  async getZipInventory(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipInventory(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'active_listing_count',
      data,
    };
  }

  // ============================================================================
  // Inventory YoY (active_listing_count_yy)
  // ============================================================================

  @Get('inventory-yoy/states')
  async getStateInventoryYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getStateInventoryYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'active_listing_count_yy',
      data,
    };
  }

  @Get('inventory-yoy/metros')
  async getMetroInventoryYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroInventoryYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'active_listing_count_yy',
      data,
    };
  }

  @Get('inventory-yoy/counties')
  async getCountyInventoryYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyInventoryYoy(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'active_listing_count_yy',
      data,
    };
  }

  @Get('inventory-yoy/zips')
  async getZipInventoryYoy(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipInventoryYoy(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'active_listing_count_yy',
      data,
    };
  }

  // ============================================================================
  // Days on Market (median_days_on_market)
  // ============================================================================

  @Get('dom/states')
  async getStateDom(@Query('date') date?: string) {
    const data = await this.realtorService.getStateDom(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      metric: 'median_days_on_market',
      data,
    };
  }

  @Get('dom/metros')
  async getMetroDom(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroDom(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'median_days_on_market',
      data,
    };
  }

  @Get('dom/counties')
  async getCountyDom(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyDom(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'median_days_on_market',
      data,
    };
  }

  @Get('dom/zips')
  async getZipDom(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipDom(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'median_days_on_market',
      data,
    };
  }
}
