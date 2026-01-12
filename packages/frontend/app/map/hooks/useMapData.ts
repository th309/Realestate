'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, MarketStats } from '@/lib/api/client';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, HomeValues } from '../types';

interface UseMapDataReturn {
  homeValues: HomeValues;
  stats: MarketStats | null;
  dataLoading: boolean;
  fetchHomeValues: (
    level: GeoLevel,
    state?: string,
    metric?: string,
    horizon?: ForecastHorizon,
    rentType?: RentIndexType,
    demandType?: RenterDemandType
  ) => Promise<void>;
}

// Metrics that are only available at Metro level
const METRO_ONLY_METRICS = new Set([
  'for_sale_inventory',
  'inventory_yoy',
  'new_listings',
  'pending_listings',
  'days_on_market',
  'days_to_close',
  'home_sales',
  'sales_yoy',
  'sale_to_list',
  'price_cut_pct',
  'price_cut_amount',
  'list_price',
  'sale_price',
  'price_per_sqft',
  'new_construction_sales',
  'new_construction_price',
  'new_construction_ppsf',
  'income_to_buy',
  'income_to_rent',
  'affordable_home_price',
  'years_to_save',
  'homeowner_affordability',
  'renter_affordability',
  'market_health',
]);

// Helper to fetch metro-level data for a specific metric
async function fetchMetroMetric(metric: string, rentType: string, demandType: string, horizon?: string): Promise<HomeValues> {
  switch (metric) {
    // Home Value metrics (from zillow_zhvi)
    case 'home_value':
    case 'home_value_yoy':
    case 'home_value_5yr':
    case 'home_value_mom':
    case 'sfh_value':
    case 'sfh_value_yoy':
    case 'condo_value':
    case 'condo_value_yoy':
      return api.getMetroHomeValues();

    // Forecast metrics (from zillow_zhvf)
    case 'home_price_forecast':
      return api.getMetroForecast(horizon);

    // Rent metrics (from zillow_zori)
    case 'rent_index':
    case 'rent_growth':
      return api.getMetroRent(rentType);

    // Renter demand metrics (from zillow_zordi)
    case 'rent_for_houses':
      return api.getMetroRenterDemand(demandType);

    // Market Indicators - Supply (from zillow_inventory, zillow_new_listings, zillow_pending_listings)
    case 'for_sale_inventory':
    case 'inventory_yoy':
      return api.getMetroInventory();
    case 'new_listings':
      return api.getMetroNewListings();
    case 'pending_listings':
      return api.getMetroPendingListings();

    // Market Indicators - Velocity (from zillow_days_to_pending, zillow_days_to_close, zillow_sales_count, zillow_sale_to_list)
    case 'days_on_market':
      return api.getMetroDaysToPending();
    case 'days_to_close':
      return api.getMetroDaysToClose();
    case 'home_sales':
    case 'sales_yoy':
      return api.getMetroSalesCount();
    case 'sale_to_list':
      return api.getMetroSaleToList();

    // Market Indicators - Pricing (from zillow_median_list_price, zillow_sales_price, zillow_price_cut_*)
    case 'list_price':
      return api.getMetroListPrice();
    case 'sale_price':
      return api.getMetroSalePrice();
    case 'price_cut_pct':
      return api.getMetroPriceCutShare();
    case 'price_cut_amount':
      return api.getMetroPriceCutAmount();

    // New Construction (from zillow_new_construction_*)
    case 'new_construction_sales':
      return api.getMetroNewConstructionSales();
    case 'new_construction_price':
      return api.getMetroNewConstructionPrice();
    case 'new_construction_ppsf':
    case 'price_per_sqft':
      return api.getMetroNewConstructionPPSF();

    // Affordability (from zillow_affordability)
    case 'income_to_buy':
      return api.getMetroIncomeToBuy();
    case 'income_to_rent':
      return api.getMetroIncomeToRent();
    case 'affordable_home_price':
      return api.getMetroAffordableHomePrice();
    case 'years_to_save':
      return api.getMetroYearsToSave();
    case 'homeowner_affordability':
    case 'overvalued_pct': // Map overvalued to affordability for now
      return api.getMetroHomeownerAffordability();
    case 'renter_affordability':
      return api.getMetroRenterAffordability();

    // Market Health (from zillow_market_heat_index)
    case 'market_health':
      return api.getMetroMarketHeat();

    // Default to home values
    default:
      return api.getMetroHomeValues();
  }
}

export function useMapData(): UseMapDataReturn {
  const [homeValues, setHomeValues] = useState<HomeValues>({});
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch home values based on geo level and metric
  const fetchHomeValues = useCallback(async (
    level: GeoLevel,
    state?: string,
    metric?: string,
    horizon?: ForecastHorizon,
    rentType: RentIndexType = 'all',
    demandType: RenterDemandType = 'all'
  ) => {
    setDataLoading(true);
    try {
      let data: HomeValues = {};
      const currentMetric = metric || 'home_value';

      // Check if metric is metro-only and we're at a different level
      const isMetroOnlyMetric = METRO_ONLY_METRICS.has(currentMetric);

      switch (level) {
        case 'state':
        case 'national':
          // State level only supports home values
          if (currentMetric === 'rent_index' || currentMetric === 'rent_for_houses' || isMetroOnlyMetric) {
            data = {};
          } else {
            data = await api.getStateHomeValues();
          }
          break;

        case 'metro':
          data = await fetchMetroMetric(currentMetric, rentType, demandType, horizon);
          break;

        case 'county':
          // County level supports home values and rent
          if (isMetroOnlyMetric) {
            data = {};
          } else if (currentMetric === 'rent_index' || currentMetric === 'rent_growth') {
            data = await api.getCountyRent(rentType);
          } else if (currentMetric === 'rent_for_houses') {
            data = {};
          } else {
            data = await api.getCountyHomeValues();
          }
          break;

        case 'city':
          // City-level data not yet available - boundaries only
          data = {};
          break;

        case 'zip':
          if (state) {
            if (isMetroOnlyMetric) {
              data = {};
            } else if (currentMetric === 'home_price_forecast') {
              data = await api.getZipForecast(state, horizon);
            } else if (currentMetric === 'rent_index' || currentMetric === 'rent_growth') {
              data = await api.getZipRent(state, rentType);
            } else if (currentMetric === 'rent_for_houses') {
              data = await api.getZipRenterDemand(state, demandType);
            } else {
              data = await api.getZipHomeValues(state);
            }
          }
          break;

        case 'tract':
          // Tract-level data not yet available - boundaries only
          data = {};
          break;
      }
      setHomeValues(data);
    } catch (err) {
      console.error('Error loading data for metric:', metric, err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Load stats on mount
  useEffect(() => {
    api.getStats().then(setStats).catch(console.error);
  }, []);

  return {
    homeValues,
    stats,
    dataLoading,
    fetchHomeValues,
  };
}
