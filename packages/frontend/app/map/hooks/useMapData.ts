'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, MarketStats } from '@/lib/api/client';
import type { GeoLevel, ForecastHorizon, RentIndexType, RenterDemandType, MapData } from '../types';
import { METRO_ONLY_METRICS } from '../config';

interface UseMapDataReturn {
  mapData: MapData;
  stats: MarketStats | null;
  dataLoading: boolean;
  fetchMapData: (
    level: GeoLevel,
    state?: string,
    metric?: string,
    horizon?: ForecastHorizon,
    rentType?: RentIndexType,
    demandType?: RenterDemandType
  ) => Promise<void>;
}

// Metrics that are ONLY available from Zillow (specialty data)
const ZILLOW_ONLY_METRICS = new Set([
  // Rent metrics (Zillow ZORI)
  'rent_index',
  'rent_growth',
  // Renter demand (Zillow ZORDI)
  'rent_for_houses',
  // Forecasts (Zillow ZHVF)
  'home_price_forecast',
  // Affordability (Zillow metro only)
  'income_to_buy',
  'income_to_rent',
  'affordable_home_price',
  'years_to_save',
  'homeowner_affordability',
  'renter_affordability',
  // New construction (Zillow metro only)
  'new_construction_sales',
  'new_construction_price',
  'new_construction_ppsf',
  // Sale prices (Zillow metro only)
  'sale_price',
  'sale_to_list',
  'home_sales',
  'sales_yoy',
  'days_to_close',
  // Market heat (Zillow metro only)
  'market_health',
  'market_heat',
  // SFH/Condo specific (Zillow)
  'sfh_value',
  'sfh_value_yoy',
  'condo_value',
  'condo_value_yoy',
  // Calculated metrics (from calculated_metrics table)
  'cap_rate',
  'gross_yield',
  'overvalued_pct',
]);

// METRO_ONLY_METRICS is imported from ../config (single source of truth)

// Hotness metrics only available at Metro/County/ZIP from Realtor
const REALTOR_HOTNESS_METRICS = new Set([
  'hotness_score',
  'hotness_rank',
  'supply_score',
  'demand_score',
]);

// Fetch Realtor data based on metric and geographic level
async function fetchRealtorMetric(
  level: GeoLevel,
  metric: string,
  state?: string
): Promise<MapData> {
  switch (metric) {
    // Home Value metrics - from Realtor median_listing_price (city from Zillow)
    case 'home_value':
    case 'list_price':
    case 'listing_price':
      switch (level) {
        case 'national':
          return api.getRealtorNationalHomeValues();
        case 'state':
          return api.getRealtorStateHomeValues();
        case 'metro':
          return api.getRealtorMetroHomeValues();
        case 'county':
          return api.getRealtorCountyHomeValues();
        case 'city':
          return state ? api.getCityHomeValues(state) : {};
        case 'zip':
          return api.getRealtorZipHomeValues(state);
        default:
          return {};
      }

    // Home Value YoY - from Realtor median_listing_price_yy (no city data)
    case 'home_value_yoy':
      switch (level) {
        case 'national':
          return api.getRealtorNationalHomeValueYoy();
        case 'state':
          return api.getRealtorStateHomeValueYoy();
        case 'metro':
          return api.getRealtorMetroHomeValueYoy();
        case 'county':
          return api.getRealtorCountyHomeValueYoy();
        case 'city':
          return {}; // No city YoY data available
        case 'zip':
          return api.getRealtorZipHomeValueYoy(state);
        default:
          return {};
      }

    // Home Value MoM - from Realtor median_listing_price_mm (no city data)
    case 'home_value_mom':
      switch (level) {
        case 'national':
          return api.getRealtorNationalHomeValueMom();
        case 'state':
          return api.getRealtorStateHomeValueMom();
        case 'metro':
          return api.getRealtorMetroHomeValueMom();
        case 'county':
          return api.getRealtorCountyHomeValueMom();
        case 'city':
          return {}; // No city MoM data available
        case 'zip':
          return api.getRealtorZipHomeValueMom(state);
        default:
          return {};
      }

    // Home Value 5-Year Growth - calculated from Realtor median_listing_price
    case 'home_value_5yr':
      switch (level) {
        case 'national':
        case 'state':
          return api.getStateHomeValue5Yr();
        case 'metro':
          return api.getMetroHomeValue5Yr();
        case 'county':
          return api.getCountyHomeValue5Yr();
        case 'city':
          return {}; // No city 5-year growth data
        case 'zip':
          return api.getZipHomeValue5Yr(state);
        default:
          return {};
      }

    // Inventory Surplus - calculated: Current Inventory - 5-Year Average (no city data)
    case 'inventory_surplus':
      switch (level) {
        case 'national': {
          const nationalValue = await api.getNationalInventorySurplus();
          return nationalValue != null ? { 'United States': nationalValue } : {};
        }
        case 'state':
          return api.getStateInventorySurplus();
        case 'metro':
          return api.getMetroInventorySurplus();
        case 'county':
          return api.getCountyInventorySurplus();
        case 'city':
          return {}; // No city inventory surplus data
        case 'zip':
          return api.getZipInventorySurplus(state);
        default:
          return {};
      }

    // Inventory - from Realtor active_listing_count (no city data)
    case 'for_sale_inventory':
      switch (level) {
        case 'national':
          return api.getRealtorNationalInventory();
        case 'state':
          return api.getRealtorStateInventory();
        case 'metro':
          return api.getRealtorMetroInventory();
        case 'county':
          return api.getRealtorCountyInventory();
        case 'city':
          return {}; // No city inventory data
        case 'zip':
          return api.getRealtorZipInventory(state);
        default:
          return {};
      }

    // Inventory YoY - from Realtor active_listing_count_yy (no city data)
    case 'inventory_yoy':
      switch (level) {
        case 'national':
          return api.getRealtorNationalInventoryYoy();
        case 'state':
          return api.getRealtorStateInventoryYoy();
        case 'metro':
          return api.getRealtorMetroInventoryYoy();
        case 'county':
          return api.getRealtorCountyInventoryYoy();
        case 'city':
          return {}; // No city inventory YoY data
        case 'zip':
          return api.getRealtorZipInventoryYoy(state);
        default:
          return {};
      }

    // Days on Market - from Realtor median_days_on_market (no city data)
    case 'days_on_market':
      switch (level) {
        case 'national':
          return api.getRealtorNationalDom();
        case 'state':
          return api.getRealtorStateDom();
        case 'metro':
          return api.getRealtorMetroDom();
        case 'county':
          return api.getRealtorCountyDom();
        case 'city':
          return {}; // No city DOM data
        case 'zip':
          return api.getRealtorZipDom(state);
        default:
          return {};
      }

    // New Listings - from Realtor new_listing_count (no city data)
    case 'new_listings':
      switch (level) {
        case 'national':
          return api.getRealtorNationalNewListings();
        case 'state':
          return api.getRealtorStateNewListings();
        case 'metro':
          return api.getRealtorMetroNewListings();
        case 'county':
          return api.getRealtorCountyNewListings();
        case 'city':
          return {}; // No city new listings data
        case 'zip':
          return api.getRealtorZipNewListings(state);
        default:
          return {};
      }

    // New Listings YoY - from Realtor new_listing_count_yy
    case 'new_listings_yoy':
      switch (level) {
        case 'national':
          return api.getRealtorNationalNewListingsYoy();
        case 'state':
          return api.getRealtorStateNewListingsYoy();
        case 'metro':
          return api.getRealtorMetroNewListingsYoy();
        case 'county':
          return api.getRealtorCountyNewListingsYoy();
        case 'city':
          return {}; // No city data
        case 'zip':
          return api.getRealtorZipNewListingsYoy(state);
        default:
          return {};
      }

    // Pending Listings - from Realtor pending_listing_count (no city data)
    case 'pending_listings':
      switch (level) {
        case 'national':
          return api.getRealtorNationalPendingListings();
        case 'state':
          return api.getRealtorStatePendingListings();
        case 'metro':
          return api.getRealtorMetroPendingListings();
        case 'county':
          return api.getRealtorCountyPendingListings();
        case 'city':
          return {}; // No city pending listings data
        case 'zip':
          return api.getRealtorZipPendingListings(state);
        default:
          return {};
      }

    // Price Cut % - from Realtor price_reduced_share (no city data)
    case 'price_cut_pct':
      switch (level) {
        case 'national':
          return api.getRealtorNationalPriceReduced();
        case 'state':
          return api.getRealtorStatePriceReduced();
        case 'metro':
          return api.getRealtorMetroPriceReduced();
        case 'county':
          return api.getRealtorCountyPriceReduced();
        case 'city':
          return {}; // No city price reduced data
        case 'zip':
          return api.getRealtorZipPriceReduced(state);
        default:
          return {};
      }

    // Price per Sq Ft - from Realtor median_listing_price_per_square_foot (no city data)
    case 'price_per_sqft':
      switch (level) {
        case 'national':
          return api.getRealtorNationalPricePerSqft();
        case 'state':
          return api.getRealtorStatePricePerSqft();
        case 'metro':
          return api.getRealtorMetroPricePerSqft();
        case 'county':
          return api.getRealtorCountyPricePerSqft();
        case 'city':
          return {}; // No city price per sqft data
        case 'zip':
          return api.getRealtorZipPricePerSqft(state);
        default:
          return {};
      }

    // Pending Ratio - from Realtor pending_ratio (no city data)
    case 'pending_ratio':
      switch (level) {
        case 'national':
          return api.getRealtorNationalPendingRatio();
        case 'state':
          return api.getRealtorStatePendingRatio();
        case 'metro':
          return api.getRealtorMetroPendingRatio();
        case 'county':
          return api.getRealtorCountyPendingRatio();
        case 'city':
          return {}; // No city pending ratio data
        case 'zip':
          return api.getRealtorZipPendingRatio(state);
        default:
          return {};
      }

    // Hotness Score - from Realtor (metro/county/zip only)
    case 'hotness_score':
    case 'hotness_rank':
      switch (level) {
        case 'metro':
          return api.getRealtorMetroHotness();
        case 'county':
          return api.getRealtorCountyHotness();
        case 'zip':
          return api.getRealtorZipHotness(state);
        default:
          return {}; // Not available at state/national
      }

    // Supply Score - from Realtor (metro/county/zip only)
    case 'supply_score':
      switch (level) {
        case 'metro':
          return api.getRealtorMetroSupplyScore();
        case 'county':
          return api.getRealtorCountySupplyScore();
        case 'zip':
          return api.getRealtorZipSupplyScore(state);
        default:
          return {};
      }

    // Demand Score - from Realtor (metro/county/zip only)
    case 'demand_score':
      switch (level) {
        case 'metro':
          return api.getRealtorMetroDemandScore();
        case 'county':
          return api.getRealtorCountyDemandScore();
        case 'zip':
          return api.getRealtorZipDemandScore(state);
        default:
          return {};
      }

    // Default to home values
    default:
      switch (level) {
        case 'state':
        case 'national':
          return api.getRealtorStateHomeValues();
        case 'metro':
          return api.getRealtorMetroHomeValues();
        case 'county':
          return api.getRealtorCountyHomeValues();
        case 'city':
          return state ? api.getCityHomeValues(state) : {};
        case 'zip':
          return api.getRealtorZipHomeValues(state);
        default:
          return {};
      }
  }
}

// Fetch Zillow specialty data (rent, forecasts, affordability, etc.)
async function fetchZillowMetric(
  level: GeoLevel,
  metric: string,
  state?: string,
  rentType: string = 'all',
  demandType: string = 'all',
  horizon?: string
): Promise<MapData> {
  // Metro-only metrics (from central config)
  if (METRO_ONLY_METRICS.has(metric) && level !== 'metro') {
    return {};
  }

  switch (metric) {
    // Rent metrics (from zillow_zori)
    case 'rent_index':
    case 'rent_growth':
      switch (level) {
        case 'metro':
          return api.getMetroRent(rentType);
        case 'county':
          return api.getCountyRent(rentType);
        case 'zip':
          return state ? api.getZipRent(state, rentType) : {};
        default:
          return {};
      }

    // Renter demand (from zillow_zordi)
    case 'rent_for_houses':
      switch (level) {
        case 'metro':
          return api.getMetroRenterDemand(demandType);
        case 'zip':
          return state ? api.getZipRenterDemand(state, demandType) : {};
        default:
          return {};
      }

    // Forecasts (from zillow_zhvf)
    case 'home_price_forecast':
      switch (level) {
        case 'metro':
          return api.getMetroForecast(horizon);
        case 'zip':
          return state ? api.getZipForecast(state, horizon) : {};
        default:
          return {};
      }

    // Affordability metrics
    case 'income_to_buy':
      // Income to Buy now supports all geography levels via calculated_metrics
      switch (level) {
        case 'national': {
          // Fetch both national and state data, merge them
          const [nationalData, stateData] = await Promise.all([
            api.getNationalIncomeToBuy(),
            api.getStateIncomeToBuy()
          ]);
          return { ...stateData, ...nationalData };
        }
        case 'state':
          return api.getStateIncomeToBuy();
        case 'metro':
          return api.getMetroIncomeToBuy();
        case 'county':
          return api.getCountyIncomeToBuy();
        case 'zip':
          return state ? api.getZipIncomeToBuy(state) : {};
        default:
          return {};
      }
    case 'income_to_rent':
      return api.getMetroIncomeToRent();
    case 'affordable_home_price':
      // Affordable Home Price now supports all geography levels via calculated_metrics
      switch (level) {
        case 'national': {
          // Fetch both national and state data, merge them
          const [nationalData, stateData] = await Promise.all([
            api.getNationalAffordableHomePrice(),
            api.getStateAffordableHomePrice()
          ]);
          return { ...stateData, ...nationalData };
        }
        case 'state':
          return api.getStateAffordableHomePrice();
        case 'metro':
          return api.getMetroAffordableHomePrice();
        case 'county':
          return api.getCountyAffordableHomePrice();
        case 'zip':
          return state ? api.getZipAffordableHomePrice(state) : {};
        default:
          return {};
      }
    case 'years_to_save':
      // Years to Save now supports all geography levels via calculated_metrics
      switch (level) {
        case 'national': {
          // Fetch both national and state data, merge them
          const [nationalData, stateData] = await Promise.all([
            api.getNationalYearsToSave(),
            api.getStateYearsToSave()
          ]);
          return { ...stateData, ...nationalData };
        }
        case 'state':
          return api.getStateYearsToSave();
        case 'metro':
          return api.getMetroYearsToSave();
        case 'county':
          return api.getCountyYearsToSave();
        case 'zip':
          return state ? api.getZipYearsToSave(state) : {};
        default:
          return {};
      }
    case 'homeowner_affordability':
      return api.getMetroHomeownerAffordability();
    case 'overvalued_pct':
      return api.getMetroOvervalued();
    case 'cap_rate':
    case 'gross_yield':
      switch (level) {
        case 'metro':
          return api.getMetroCapRate();
        case 'county':
          return api.getCountyCapRate();
        case 'zip':
          return state ? api.getZipCapRate(state) : {};
        default:
          return {};
      }
    case 'renter_affordability':
      return api.getMetroRenterAffordability();

    // New Construction (Zillow metro only)
    case 'new_construction_sales':
      return api.getMetroNewConstructionSales();
    case 'new_construction_price':
      return api.getMetroNewConstructionPrice();
    case 'new_construction_ppsf':
      return api.getMetroNewConstructionPPSF();

    // Sale metrics (Zillow metro only)
    case 'sale_price':
      return api.getMetroSalePrice();
    case 'sale_to_list':
      return api.getMetroSaleToList();
    case 'home_sales':
    case 'sales_yoy':
      return api.getMetroSalesCount();
    case 'days_to_close':
      return api.getMetroDaysToClose();

    // Market heat (Zillow metro only)
    case 'market_health':
    case 'market_heat':
      return api.getMetroMarketHeat();

    // SFH/Condo values (from Zillow ZHVI by property type)
    case 'sfh_value':
    case 'sfh_value_yoy':
    case 'condo_value':
    case 'condo_value_yoy':
      switch (level) {
        case 'metro':
          return api.getMetroHomeValues();
        default:
          return {};
      }

    default:
      return {};
  }
}

export function useMapData(): UseMapDataReturn {
  const [mapData, setMapData] = useState<MapData>({});
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Fetch map data based on geo level and metric
  // Uses Realtor as primary source, Zillow for specialty data only
  const fetchMapData = useCallback(async (
    level: GeoLevel,
    state?: string,
    metric?: string,
    horizon?: ForecastHorizon,
    rentType: RentIndexType = 'all',
    demandType: RenterDemandType = 'all'
  ) => {
    setDataLoading(true);
    try {
      let data: MapData = {};
      const currentMetric = metric || 'home_value';

      // Check if this is a Zillow-only metric
      const isZillowOnly = ZILLOW_ONLY_METRICS.has(currentMetric);

      // Check if hotness metric at unsupported level
      const isHotnessAtUnsupportedLevel =
        REALTOR_HOTNESS_METRICS.has(currentMetric) &&
        (level === 'state' || level === 'national');

      if (isHotnessAtUnsupportedLevel) {
        // Hotness metrics not available at state/national level
        data = {};
      } else if (isZillowOnly) {
        // Use Zillow for specialty metrics
        data = await fetchZillowMetric(level, currentMetric, state, rentType, demandType, horizon);
      } else {
        // Use Realtor for all other metrics (primary source)
        data = await fetchRealtorMetric(level, currentMetric, state);
      }

      setMapData(data);
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
    mapData,
    stats,
    dataLoading,
    fetchMapData,
  };
}
