import { Controller, Get, Query } from '@nestjs/common';
import { RealtorService } from './realtor.service';

@Controller('api/realtor')
export class RealtorController {
  constructor(private readonly realtorService: RealtorService) {}

  // ============================================================================
  // National Average (for benchmarks)
  // ============================================================================

  @Get('national-average')
  async getNationalAverage(@Query('metric') metric: string) {
    const data = await this.realtorService.getNationalAverage(metric);
    return { success: true, ...data };
  }

  @Get('benchmarks')
  async getBenchmarks(
    @Query('geoLevel') geoLevel: string,
    @Query('regionId') regionId: string,
    @Query('stateId') stateId?: string,
  ) {
    const data = await this.realtorService.getBenchmarks(geoLevel, regionId, stateId);
    return { success: true, ...data };
  }

  // ============================================================================
  // Home Value (median_listing_price)
  // ============================================================================

  @Get('home-value/states')
  async getStateHomeValues(@Query('date') date?: string) {
    const data = await this.realtorService.getStateHomeValues(date);
    return { success: true, count: data.length, geography: 'State', metric: 'median_listing_price', data };
  }

  @Get('home-value/metros')
  async getMetroHomeValues(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHomeValues(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'median_listing_price', data };
  }

  @Get('home-value/counties')
  async getCountyHomeValues(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHomeValues(date);
    return { success: true, count: data.length, geography: 'County', metric: 'median_listing_price', data };
  }

  @Get('home-value/zips')
  async getZipHomeValues(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipHomeValues(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'median_listing_price', data };
  }

  // ============================================================================
  // Home Value YoY (median_listing_price_yy)
  // ============================================================================

  @Get('home-value-yoy/states')
  async getStateHomeValueYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getStateHomeValueYoy(date);
    return { success: true, count: data.length, geography: 'State', metric: 'median_listing_price_yy', data };
  }

  @Get('home-value-yoy/metros')
  async getMetroHomeValueYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHomeValueYoy(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'median_listing_price_yy', data };
  }

  @Get('home-value-yoy/counties')
  async getCountyHomeValueYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHomeValueYoy(date);
    return { success: true, count: data.length, geography: 'County', metric: 'median_listing_price_yy', data };
  }

  @Get('home-value-yoy/zips')
  async getZipHomeValueYoy(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipHomeValueYoy(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'median_listing_price_yy', data };
  }

  // ============================================================================
  // Home Value MoM (median_listing_price_mm)
  // ============================================================================

  @Get('home-value-mom/states')
  async getStateHomeValueMom(@Query('date') date?: string) {
    const data = await this.realtorService.getStateHomeValueMom(date);
    return { success: true, count: data.length, geography: 'State', metric: 'median_listing_price_mm', data };
  }

  @Get('home-value-mom/metros')
  async getMetroHomeValueMom(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHomeValueMom(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'median_listing_price_mm', data };
  }

  @Get('home-value-mom/counties')
  async getCountyHomeValueMom(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHomeValueMom(date);
    return { success: true, count: data.length, geography: 'County', metric: 'median_listing_price_mm', data };
  }

  @Get('home-value-mom/zips')
  async getZipHomeValueMom(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipHomeValueMom(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'median_listing_price_mm', data };
  }

  // ============================================================================
  // Inventory (active_listing_count)
  // ============================================================================

  @Get('inventory/states')
  async getStateInventory(@Query('date') date?: string) {
    const data = await this.realtorService.getStateInventory(date);
    return { success: true, count: data.length, geography: 'State', metric: 'active_listing_count', data };
  }

  @Get('inventory/metros')
  async getMetroInventory(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroInventory(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'active_listing_count', data };
  }

  @Get('inventory/counties')
  async getCountyInventory(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyInventory(date);
    return { success: true, count: data.length, geography: 'County', metric: 'active_listing_count', data };
  }

  @Get('inventory/zips')
  async getZipInventory(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipInventory(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'active_listing_count', data };
  }

  // ============================================================================
  // Inventory YoY (active_listing_count_yy)
  // ============================================================================

  @Get('inventory-yoy/states')
  async getStateInventoryYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getStateInventoryYoy(date);
    return { success: true, count: data.length, geography: 'State', metric: 'active_listing_count_yy', data };
  }

  @Get('inventory-yoy/metros')
  async getMetroInventoryYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroInventoryYoy(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'active_listing_count_yy', data };
  }

  @Get('inventory-yoy/counties')
  async getCountyInventoryYoy(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyInventoryYoy(date);
    return { success: true, count: data.length, geography: 'County', metric: 'active_listing_count_yy', data };
  }

  @Get('inventory-yoy/zips')
  async getZipInventoryYoy(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipInventoryYoy(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'active_listing_count_yy', data };
  }

  // ============================================================================
  // Days on Market (median_days_on_market)
  // ============================================================================

  @Get('dom/states')
  async getStateDom(@Query('date') date?: string) {
    const data = await this.realtorService.getStateDom(date);
    return { success: true, count: data.length, geography: 'State', metric: 'median_days_on_market', data };
  }

  @Get('dom/metros')
  async getMetroDom(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroDom(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'median_days_on_market', data };
  }

  @Get('dom/counties')
  async getCountyDom(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyDom(date);
    return { success: true, count: data.length, geography: 'County', metric: 'median_days_on_market', data };
  }

  @Get('dom/zips')
  async getZipDom(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipDom(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'median_days_on_market', data };
  }

  // ============================================================================
  // New Listings (new_listing_count)
  // ============================================================================

  @Get('new-listings/states')
  async getStateNewListings(@Query('date') date?: string) {
    const data = await this.realtorService.getStateNewListings(date);
    return { success: true, count: data.length, geography: 'State', metric: 'new_listing_count', data };
  }

  @Get('new-listings/metros')
  async getMetroNewListings(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroNewListings(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'new_listing_count', data };
  }

  @Get('new-listings/counties')
  async getCountyNewListings(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyNewListings(date);
    return { success: true, count: data.length, geography: 'County', metric: 'new_listing_count', data };
  }

  @Get('new-listings/zips')
  async getZipNewListings(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipNewListings(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'new_listing_count', data };
  }

  // ============================================================================
  // Pending Listings (pending_listing_count)
  // ============================================================================

  @Get('pending-listings/states')
  async getStatePendingListings(@Query('date') date?: string) {
    const data = await this.realtorService.getStatePendingListings(date);
    return { success: true, count: data.length, geography: 'State', metric: 'pending_listing_count', data };
  }

  @Get('pending-listings/metros')
  async getMetroPendingListings(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroPendingListings(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'pending_listing_count', data };
  }

  @Get('pending-listings/counties')
  async getCountyPendingListings(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyPendingListings(date);
    return { success: true, count: data.length, geography: 'County', metric: 'pending_listing_count', data };
  }

  @Get('pending-listings/zips')
  async getZipPendingListings(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipPendingListings(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'pending_listing_count', data };
  }

  // ============================================================================
  // Price Reduced Share (price_reduced_share)
  // ============================================================================

  @Get('price-reduced/states')
  async getStatePriceReduced(@Query('date') date?: string) {
    const data = await this.realtorService.getStatePriceReduced(date);
    return { success: true, count: data.length, geography: 'State', metric: 'price_reduced_share', data };
  }

  @Get('price-reduced/metros')
  async getMetroPriceReduced(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroPriceReduced(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'price_reduced_share', data };
  }

  @Get('price-reduced/counties')
  async getCountyPriceReduced(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyPriceReduced(date);
    return { success: true, count: data.length, geography: 'County', metric: 'price_reduced_share', data };
  }

  @Get('price-reduced/zips')
  async getZipPriceReduced(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipPriceReduced(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'price_reduced_share', data };
  }

  // ============================================================================
  // Price per Sq Ft (median_listing_price_per_square_foot)
  // ============================================================================

  @Get('price-per-sqft/states')
  async getStatePricePerSqft(@Query('date') date?: string) {
    const data = await this.realtorService.getStatePricePerSqft(date);
    return { success: true, count: data.length, geography: 'State', metric: 'median_listing_price_per_square_foot', data };
  }

  @Get('price-per-sqft/metros')
  async getMetroPricePerSqft(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroPricePerSqft(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'median_listing_price_per_square_foot', data };
  }

  @Get('price-per-sqft/counties')
  async getCountyPricePerSqft(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyPricePerSqft(date);
    return { success: true, count: data.length, geography: 'County', metric: 'median_listing_price_per_square_foot', data };
  }

  @Get('price-per-sqft/zips')
  async getZipPricePerSqft(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipPricePerSqft(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'median_listing_price_per_square_foot', data };
  }

  // ============================================================================
  // Hotness Score (hotness_score) - Metro/County/ZIP only
  // ============================================================================

  @Get('hotness/metros')
  async getMetroHotness(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHotness(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'hotness_score', data };
  }

  @Get('hotness/counties')
  async getCountyHotness(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHotness(date);
    return { success: true, count: data.length, geography: 'County', metric: 'hotness_score', data };
  }

  @Get('hotness/zips')
  async getZipHotness(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipHotness(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'hotness_score', data };
  }

  // ============================================================================
  // Supply Score (supply_score) - Metro/County/ZIP only
  // ============================================================================

  @Get('supply-score/metros')
  async getMetroSupplyScore(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroSupplyScore(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'supply_score', data };
  }

  @Get('supply-score/counties')
  async getCountySupplyScore(@Query('date') date?: string) {
    const data = await this.realtorService.getCountySupplyScore(date);
    return { success: true, count: data.length, geography: 'County', metric: 'supply_score', data };
  }

  @Get('supply-score/zips')
  async getZipSupplyScore(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipSupplyScore(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'supply_score', data };
  }

  // ============================================================================
  // Demand Score (demand_score) - Metro/County/ZIP only
  // ============================================================================

  @Get('demand-score/metros')
  async getMetroDemandScore(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroDemandScore(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'demand_score', data };
  }

  @Get('demand-score/counties')
  async getCountyDemandScore(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyDemandScore(date);
    return { success: true, count: data.length, geography: 'County', metric: 'demand_score', data };
  }

  @Get('demand-score/zips')
  async getZipDemandScore(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipDemandScore(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'demand_score', data };
  }

  // ============================================================================
  // Pending Ratio (pending_ratio)
  // ============================================================================

  @Get('pending-ratio/states')
  async getStatePendingRatio(@Query('date') date?: string) {
    const data = await this.realtorService.getStatePendingRatio(date);
    return { success: true, count: data.length, geography: 'State', metric: 'pending_ratio', data };
  }

  @Get('pending-ratio/metros')
  async getMetroPendingRatio(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroPendingRatio(date);
    return { success: true, count: data.length, geography: 'Metro', metric: 'pending_ratio', data };
  }

  @Get('pending-ratio/counties')
  async getCountyPendingRatio(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyPendingRatio(date);
    return { success: true, count: data.length, geography: 'County', metric: 'pending_ratio', data };
  }

  @Get('pending-ratio/zips')
  async getZipPendingRatio(@Query('state') state?: string, @Query('date') date?: string) {
    const data = await this.realtorService.getZipPendingRatio(state, date);
    return { success: true, count: data.length, geography: 'ZIP', metric: 'pending_ratio', data };
  }
}
