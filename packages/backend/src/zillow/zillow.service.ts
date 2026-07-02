/**
 * Zillow Service
 * Provides home value, forecast, rent, and renter demand data
 *
 * The data-fetching logic lives in ./helpers/*.helper.ts modules (split out
 * for file-size compliance). This service is the @Injectable() facade: each
 * public method delegates to a helper, passing the Supabase client. Method
 * signatures and behavior are unchanged.
 */

import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

// Types (re-exported for backward compatibility)
import type {
  HomeValueData,
  ForecastData,
  MarketIndicatorData,
  AffordabilityData,
  PriceCutsData,
  NewConstructionData,
  MarketIndicatorMetric,
} from './types';
export type { HomeValueData, ForecastData };

// Helper functions
import { getLatestDateForMetric } from './helpers/queries';
import {
  getNationalHomeValue,
  getStateHomeValues,
  getMetroHomeValues,
  getCountyHomeValues,
  getCityHomeValues,
} from './helpers/home-value.helper';
import {
  getZipHomeValues,
  getAllZipHomeValues,
} from './helpers/home-value-zip.helper';
import {
  getZhviAvailableDates,
  getZhviTimeSeries,
} from './helpers/home-value-dates.helper';
import { getMetroForecast } from './helpers/forecast-metro.helper';
import {
  debugForecastData,
  getZipForecast,
} from './helpers/forecast-zip.helper';
import { getMetroRent, getAllZipRent } from './helpers/rent.helper';
import { getCountyRent, getZipRent } from './helpers/rent-county-zip.helper';
import {
  getMetroRenterDemand,
  getZipRenterDemand,
  getAllZipRenterDemand,
} from './helpers/renter-demand.helper';
import {
  getMetroMarketIndicator,
  getMetroPriceCuts,
  getMetroNewConstruction,
  getMetroAffordability,
} from './helpers/market-indicators.helper';

@Injectable()
export class ZillowService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // ZHVF debug
  async debugForecastData(): Promise<any> {
    return debugForecastData(this.supabase);
  }

  // ZHVI (Home Value) methods
  async getNationalHomeValue(): Promise<HomeValueData[]> {
    return getNationalHomeValue(this.supabase);
  }

  async getStateHomeValues(date?: string): Promise<HomeValueData[]> {
    return getStateHomeValues(this.supabase, date);
  }

  async getMetroHomeValues(
    date?: string,
    stateFilter?: string,
  ): Promise<HomeValueData[]> {
    return getMetroHomeValues(this.supabase, date, stateFilter);
  }

  async getCountyHomeValues(
    date?: string,
    stateFilter?: string,
  ): Promise<HomeValueData[]> {
    return getCountyHomeValues(this.supabase, date, stateFilter);
  }

  async getZipHomeValues(
    stateFilter: string,
    countyFilter?: string,
    date?: string,
  ): Promise<HomeValueData[]> {
    return getZipHomeValues(this.supabase, stateFilter, countyFilter, date);
  }

  async getAllZipHomeValues(
    date?: string,
    limit: number = 100,
  ): Promise<HomeValueData[]> {
    return getAllZipHomeValues(this.supabase, date, limit);
  }

  async getCityHomeValues(stateFilter?: string): Promise<HomeValueData[]> {
    return getCityHomeValues(this.supabase, stateFilter);
  }

  async getLatestDate(geography: string): Promise<string> {
    return getLatestDateForMetric(this.supabase, 'zhvi', geography);
  }

  async getAvailableDates(geography: string): Promise<string[]> {
    return getZhviAvailableDates(this.supabase, geography);
  }

  async getTimeSeries(regionId: string, geography: string): Promise<any[]> {
    return getZhviTimeSeries(this.supabase, regionId, geography);
  }

  // ZHVF (Forecast) methods
  async getMetroForecast(horizon: string = '12m'): Promise<ForecastData[]> {
    return getMetroForecast(this.supabase, horizon);
  }

  async getZipForecast(
    stateFilter?: string,
    horizon: string = '12m',
  ): Promise<ForecastData[]> {
    return getZipForecast(this.supabase, stateFilter, horizon);
  }

  // ZORI (Rent Index) methods
  async getMetroRent(
    date?: string,
    propertyType: string = 'all',
  ): Promise<HomeValueData[]> {
    return getMetroRent(this.supabase, date, propertyType);
  }

  async getCountyRent(
    date?: string,
    propertyType: string = 'all',
    stateFilter?: string,
  ): Promise<HomeValueData[]> {
    return getCountyRent(this.supabase, date, propertyType, stateFilter);
  }

  async getZipRent(
    stateFilter: string,
    propertyType: string = 'all',
    date?: string,
  ): Promise<HomeValueData[]> {
    return getZipRent(this.supabase, stateFilter, propertyType, date);
  }

  async getAllZipRent(
    date?: string,
    propertyType: string = 'all',
    limit: number = 100,
  ): Promise<HomeValueData[]> {
    return getAllZipRent(this.supabase, date, propertyType, limit);
  }

  // ZORDI (Renter Demand Index) methods
  async getMetroRenterDemand(
    date?: string,
    propertyType: string = 'all',
  ): Promise<HomeValueData[]> {
    return getMetroRenterDemand(this.supabase, date, propertyType);
  }

  async getZipRenterDemand(
    stateFilter: string,
    propertyType: string = 'all',
    date?: string,
  ): Promise<HomeValueData[]> {
    return getZipRenterDemand(this.supabase, stateFilter, propertyType, date);
  }

  async getAllZipRenterDemand(
    date?: string,
    propertyType: string = 'all',
    limit: number = 100,
  ): Promise<HomeValueData[]> {
    return getAllZipRenterDemand(this.supabase, date, propertyType, limit);
  }

  // Market Indicators
  /**
   * Generic method to get market indicator data for metros.
   * When no date is provided, returns the latest available data per region.
   */
  async getMetroMarketIndicator(
    metricName: MarketIndicatorMetric,
    date?: string,
    propertyType: string = 'sfrcondo',
  ): Promise<MarketIndicatorData[]> {
    return getMetroMarketIndicator(
      this.supabase,
      metricName,
      date,
      propertyType,
    );
  }

  async getMetroInventory(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('inventory', date);
  }

  async getMetroNewListings(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('new_listings', date);
  }

  async getMetroPendingListings(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('pending_sales', date);
  }

  async getMetroListPrice(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('list_price', date);
  }

  async getMetroSalesCount(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('sale_price', date);
  }

  async getMetroSalePrice(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('sale_price', date);
  }

  async getMetroSaleToList(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('sale_to_list', date);
  }

  async getMetroDaysToPending(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('dom', date);
  }

  async getMetroDaysToClose(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('dom', date);
  }

  async getMetroMarketHeat(date?: string): Promise<MarketIndicatorData[]> {
    return this.getMetroMarketIndicator('market_heat', date);
  }

  // Combined / derived metro metrics
  async getMetroPriceCuts(date?: string): Promise<PriceCutsData[]> {
    return getMetroPriceCuts(this.supabase, date);
  }

  async getMetroNewConstruction(date?: string): Promise<NewConstructionData[]> {
    return getMetroNewConstruction(this.supabase, date);
  }

  async getMetroAffordability(date?: string): Promise<AffordabilityData[]> {
    return getMetroAffordability(this.supabase, date);
  }
}
