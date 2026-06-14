import { Injectable } from '@nestjs/common';
import { RealtorDataService } from './realtor-data.service';
import { RealtorNationalService } from './realtor-national.service';
import { RealtorBenchmarkService } from './realtor-benchmark.service';

export type { RealtorDataPoint } from './realtor.types';

/**
 * Public Realtor data facade consumed by RealtorController. Keeps the exact
 * method surface the controller depends on, delegating to the focused services:
 * - {@link RealtorDataService}: per-metric state/metro/county/zip data
 * - {@link RealtorNationalService}: national values + averages
 * - {@link RealtorBenchmarkService}: state averages + benchmark comparison
 */
@Injectable()
export class RealtorService {
  constructor(
    private readonly data: RealtorDataService,
    private readonly national: RealtorNationalService,
    private readonly benchmark: RealtorBenchmarkService,
  ) {}

  // National + benchmarks
  getNationalData(metric: string, date?: string) {
    return this.national.getNationalData(metric, date);
  }
  getNationalAverage(metricId: string) {
    return this.national.getNationalAverage(metricId);
  }
  getBenchmarks(geoLevel: string, regionId: string, stateId?: string) {
    return this.benchmark.getBenchmarks(geoLevel, regionId, stateId);
  }

  // Home Value (median_listing_price)
  getStateHomeValues(date?: string) {
    return this.data.getStateData('median_listing_price', date);
  }
  getMetroHomeValues(date?: string, state?: string) {
    return this.data.getMetroData('median_listing_price', date, state);
  }
  getCountyHomeValues(date?: string, state?: string) {
    return this.data.getCountyData('median_listing_price', date, state);
  }
  getZipHomeValues(state?: string, date?: string) {
    return this.data.getZipData('median_listing_price', state, date);
  }

  // Home Value YoY (median_listing_price_yy)
  getStateHomeValueYoy(date?: string) {
    return this.data.getStateData('median_listing_price_yy', date);
  }
  getMetroHomeValueYoy(date?: string) {
    return this.data.getMetroData('median_listing_price_yy', date);
  }
  getCountyHomeValueYoy(date?: string) {
    return this.data.getCountyData('median_listing_price_yy', date);
  }
  getZipHomeValueYoy(state?: string, date?: string) {
    return this.data.getZipData('median_listing_price_yy', state, date);
  }

  // Home Value MoM (median_listing_price_mm)
  getStateHomeValueMom(date?: string) {
    return this.data.getStateData('median_listing_price_mm', date);
  }
  getMetroHomeValueMom(date?: string) {
    return this.data.getMetroData('median_listing_price_mm', date);
  }
  getCountyHomeValueMom(date?: string) {
    return this.data.getCountyData('median_listing_price_mm', date);
  }
  getZipHomeValueMom(state?: string, date?: string) {
    return this.data.getZipData('median_listing_price_mm', state, date);
  }

  // Inventory (active_listing_count)
  getStateInventory(date?: string) {
    return this.data.getStateData('active_listing_count', date);
  }
  getMetroInventory(date?: string) {
    return this.data.getMetroData('active_listing_count', date);
  }
  getCountyInventory(date?: string) {
    return this.data.getCountyData('active_listing_count', date);
  }
  getZipInventory(state?: string, date?: string) {
    return this.data.getZipData('active_listing_count', state, date);
  }

  // Inventory YoY (active_listing_count_yy)
  getStateInventoryYoy(date?: string) {
    return this.data.getStateData('active_listing_count_yy', date);
  }
  getMetroInventoryYoy(date?: string) {
    return this.data.getMetroData('active_listing_count_yy', date);
  }
  getCountyInventoryYoy(date?: string) {
    return this.data.getCountyData('active_listing_count_yy', date);
  }
  getZipInventoryYoy(state?: string, date?: string) {
    return this.data.getZipData('active_listing_count_yy', state, date);
  }

  // Days on Market (median_days_on_market)
  getStateDom(date?: string) {
    return this.data.getStateData('median_days_on_market', date);
  }
  getMetroDom(date?: string) {
    return this.data.getMetroData('median_days_on_market', date);
  }
  getCountyDom(date?: string) {
    return this.data.getCountyData('median_days_on_market', date);
  }
  getZipDom(state?: string, date?: string) {
    return this.data.getZipData('median_days_on_market', state, date);
  }

  // New Listings (new_listing_count)
  getStateNewListings(date?: string) {
    return this.data.getStateData('new_listing_count', date);
  }
  getMetroNewListings(date?: string) {
    return this.data.getMetroData('new_listing_count', date);
  }
  getCountyNewListings(date?: string) {
    return this.data.getCountyData('new_listing_count', date);
  }
  getZipNewListings(state?: string, date?: string) {
    return this.data.getZipData('new_listing_count', state, date);
  }

  // New Listings YoY (new_listing_count_yy)
  getStateNewListingsYoy(date?: string) {
    return this.data.getStateData('new_listing_count_yy', date);
  }
  getMetroNewListingsYoy(date?: string, state?: string) {
    return this.data.getMetroData('new_listing_count_yy', date, state);
  }
  getCountyNewListingsYoy(date?: string, state?: string) {
    return this.data.getCountyData('new_listing_count_yy', date, state);
  }
  getZipNewListingsYoy(state?: string, date?: string) {
    return this.data.getZipData('new_listing_count_yy', state, date);
  }

  // Pending Listings (pending_listing_count)
  getStatePendingListings(date?: string) {
    return this.data.getStateData('pending_listing_count', date);
  }
  getMetroPendingListings(date?: string) {
    return this.data.getMetroData('pending_listing_count', date);
  }
  getCountyPendingListings(date?: string) {
    return this.data.getCountyData('pending_listing_count', date);
  }
  getZipPendingListings(state?: string, date?: string) {
    return this.data.getZipData('pending_listing_count', state, date);
  }

  // Home Sales (pending_listing_count - proxy for sales activity)
  getStateHomeSales(date?: string) {
    return this.data.getStateData('pending_listing_count', date);
  }
  getMetroHomeSales(date?: string) {
    return this.data.getMetroData('pending_listing_count', date);
  }
  getCountyHomeSales(date?: string) {
    return this.data.getCountyData('pending_listing_count', date);
  }
  getZipHomeSales(state?: string, date?: string) {
    return this.data.getZipData('pending_listing_count', state, date);
  }

  // Home Sales YoY (pending_listing_count_yy)
  getStateHomeSalesYoy(date?: string) {
    return this.data.getStateData('pending_listing_count_yy', date);
  }
  getMetroHomeSalesYoy(date?: string) {
    return this.data.getMetroData('pending_listing_count_yy', date);
  }
  getCountyHomeSalesYoy(date?: string) {
    return this.data.getCountyData('pending_listing_count_yy', date);
  }
  getZipHomeSalesYoy(state?: string, date?: string) {
    return this.data.getZipData('pending_listing_count_yy', state, date);
  }

  // Price Reduced Share (price_reduced_share)
  getStatePriceReduced(date?: string) {
    return this.data.getStateData('price_reduced_share', date);
  }
  getMetroPriceReduced(date?: string) {
    return this.data.getMetroData('price_reduced_share', date);
  }
  getCountyPriceReduced(date?: string) {
    return this.data.getCountyData('price_reduced_share', date);
  }
  getZipPriceReduced(state?: string, date?: string) {
    return this.data.getZipData('price_reduced_share', state, date);
  }

  // Price per Square Foot (median_listing_price_per_square_foot)
  getStatePricePerSqft(date?: string) {
    return this.data.getStateData('median_listing_price_per_square_foot', date);
  }
  getMetroPricePerSqft(date?: string) {
    return this.data.getMetroData('median_listing_price_per_square_foot', date);
  }
  getCountyPricePerSqft(date?: string) {
    return this.data.getCountyData(
      'median_listing_price_per_square_foot',
      date,
    );
  }
  getZipPricePerSqft(state?: string, date?: string) {
    return this.data.getZipData(
      'median_listing_price_per_square_foot',
      state,
      date,
    );
  }

  // Hotness Score (hotness_score) - Metro/County/ZIP only
  getMetroHotness(date?: string) {
    return this.data.getMetroData('hotness_score', date);
  }
  getCountyHotness(date?: string) {
    return this.data.getCountyData('hotness_score', date);
  }
  getZipHotness(state?: string, date?: string) {
    return this.data.getZipData('hotness_score', state, date);
  }

  // Supply Score (supply_score) - Metro/County/ZIP only
  getMetroSupplyScore(date?: string) {
    return this.data.getMetroData('supply_score', date);
  }
  getCountySupplyScore(date?: string) {
    return this.data.getCountyData('supply_score', date);
  }
  getZipSupplyScore(state?: string, date?: string) {
    return this.data.getZipData('supply_score', state, date);
  }

  // Demand Score (demand_score) - Metro/County/ZIP only
  getMetroDemandScore(date?: string) {
    return this.data.getMetroData('demand_score', date);
  }
  getCountyDemandScore(date?: string) {
    return this.data.getCountyData('demand_score', date);
  }
  getZipDemandScore(state?: string, date?: string) {
    return this.data.getZipData('demand_score', state, date);
  }

  // Pending Ratio (pending_ratio)
  getStatePendingRatio(date?: string) {
    return this.data.getStateData('pending_ratio', date);
  }
  getMetroPendingRatio(date?: string) {
    return this.data.getMetroData('pending_ratio', date);
  }
  getCountyPendingRatio(date?: string) {
    return this.data.getCountyData('pending_ratio', date);
  }
  getZipPendingRatio(state?: string, date?: string) {
    return this.data.getZipData('pending_ratio', state, date);
  }

  // Price Increased Share (price_increased_share)
  getStatePriceIncreased(date?: string) {
    return this.data.getStateData('price_increased_share', date);
  }
  getMetroPriceIncreased(date?: string) {
    return this.data.getMetroData('price_increased_share', date);
  }
  getCountyPriceIncreased(date?: string) {
    return this.data.getCountyData('price_increased_share', date);
  }
  getZipPriceIncreased(state?: string, date?: string) {
    return this.data.getZipData('price_increased_share', state, date);
  }

  // Listing Price (median_listing_price) - alias for home value from Realtor
  getStateListingPrice(date?: string) {
    return this.data.getStateData('median_listing_price', date);
  }
  getMetroListingPrice(date?: string) {
    return this.data.getMetroData('median_listing_price', date);
  }
  getCountyListingPrice(date?: string) {
    return this.data.getCountyData('median_listing_price', date);
  }
  getZipListingPrice(state?: string, date?: string) {
    return this.data.getZipData('median_listing_price', state, date);
  }
}
