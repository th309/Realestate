// Use local backend in development, production URL otherwise
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchAPI<T>(endpoint: string): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  console.log('Fetching:', url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export interface MarketStats {
  totalMarkets: number;
  totalStates: number;
  totalCounties: number;
  totalZips: number;
}

export interface State {
  geoid: string;
  name: string;
  state_abbreviation: string;
  population: number;
}

// Zillow API response types
interface ZillowHomeValue {
  region_id: string;
  region_name: string;
  value: number;
  state_abbrev?: string;
  county_fips?: string;
  cbsa_code?: string;
}

interface ZillowForecast {
  region_id: string;
  region_name: string;
  value: number;  // forecast_12m used as main value
  forecast_1m: number | null;
  forecast_3m: number | null;
  forecast_12m: number | null;
  cbsa_code?: string;
  zip_code?: string;
  state_abbrev?: string;
}

interface ZillowApiResponse {
  success: boolean;
  count: number;
  data: ZillowHomeValue[];
}

interface ZillowForecastResponse {
  success: boolean;
  count: number;
  data: ZillowForecast[];
}

// Affordability data from zillow_affordability table
interface ZillowAffordability {
  region_id: string;
  region_name: string;
  cbsa_code?: string;
  state_abbrev?: string;
  homeowner_income_needed: number | null;
  renter_income_needed: number | null;
  affordable_home_price: number | null;
  years_to_save: number | null;
  homeowner_affordability_percent: number | null;
  renter_affordability_percent: number | null;
}

interface ZillowAffordabilityResponse {
  success: boolean;
  count: number;
  data: ZillowAffordability[];
}

// Price cuts data (combined from multiple tables)
interface ZillowPriceCuts {
  region_id: string;
  region_name: string;
  cbsa_code?: string;
  state_abbrev?: string;
  share_with_price_cut: number | null;
  median_price_cut_amount: number | null;
  median_price_cut_percent: number | null;
}

interface ZillowPriceCutsResponse {
  success: boolean;
  count: number;
  data: ZillowPriceCuts[];
}

// Realtor API response types
interface RealtorDataPoint {
  region_id: string;
  region_name: string;
  value: number;
  state_id?: string;
  cbsa_code?: string;
  county_fips?: string;
  postal_code?: string;
}

interface RealtorApiResponse {
  success: boolean;
  count: number;
  geography: string;
  metric: string;
  data: RealtorDataPoint[];
}

// New construction data (combined from multiple tables)
interface ZillowNewConstruction {
  region_id: string;
  region_name: string;
  cbsa_code?: string;
  state_abbrev?: string;
  sales_count: number | null;
  median_sale_price: number | null;
  price_per_sqft: number | null;
}

interface ZillowNewConstructionResponse {
  success: boolean;
  count: number;
  data: ZillowNewConstruction[];
}

export type StateHomeValues = Record<string, number>;
export type MetroHomeValues = Record<string, number>;
export type CountyHomeValues = Record<string, number>;
export type ZipHomeValues = Record<string, number>;
export type CityHomeValues = Record<string, number>;

// Transform Zillow API response to Record<region_id, value> format
function transformZillowResponse(response: ZillowApiResponse, keyField: 'region_id' | 'region_name' | 'county_fips' | 'cbsa_code' = 'region_id'): Record<string, number> {
  const result: Record<string, number> = {};
  response.data?.forEach(item => {
    let key: string | undefined;
    switch (keyField) {
      case 'county_fips':
        key = item.county_fips || item.region_id;
        break;
      case 'region_name':
        key = item.region_name;
        break;
      case 'cbsa_code':
        key = item.cbsa_code || item.region_id;
        break;
      default:
        key = item.region_id;
    }
    if (key && item.value != null) {
      // Ensure value is a number (DECIMAL from DB may come as string)
      result[key] = Number(item.value);
    }
  });
  return result;
}

export const api = {
  getStats: () => fetchAPI<MarketStats>('/markets/stats'),
  getStates: () => fetchAPI<State[]>('/markets/states'),

  // Zillow ZHVI endpoints - transform response to Record format
  getStateHomeValues: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/states');
    // States use region_name (state name) as key to match GeoJSON
    return transformZillowResponse(response, 'region_name');
  },

  getMetroHomeValues: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/metros');
    // Use CBSA code to match GeoJSON CBSAFP property
    return transformZillowResponse(response, 'cbsa_code');
  },

  getCountyHomeValues: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/counties');
    // Counties use FIPS code as key to match GeoJSON
    return transformZillowResponse(response, 'county_fips');
  },

  getZipHomeValues: async (state: string): Promise<ZipHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>(`/api/zillow/zips?state=${state}`);
    // ZIP codes use region_id (the ZIP code itself) as key
    return transformZillowResponse(response, 'region_id');
  },

  getCityHomeValues: async (state: string): Promise<CityHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>(`/api/zillow/cities?state=${state}`);
    // Cities use region_name as key to match tiger_places NAME
    return transformZillowResponse(response, 'region_name');
  },

  // ZHVF Forecast endpoints - returns forecast % growth values
  // horizon: '1m' | '3m' | '12m' - which forecast horizon to use
  getMetroForecast: async (horizon: string = '12m'): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowForecastResponse>(`/api/zillow/forecast/metros?horizon=${horizon}`);
    // Use CBSA code to match GeoJSON
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.value != null) {
        result[key] = Number(item.value);
      }
    });
    return result;
  },

  getZipForecast: async (state?: string, horizon: string = '12m'): Promise<ZipHomeValues> => {
    const params = new URLSearchParams();
    if (state) params.append('state', state);
    params.append('horizon', horizon);
    const url = `/api/zillow/forecast/zips?${params.toString()}`;
    const response = await fetchAPI<ZillowForecastResponse>(url);
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.zip_code || item.region_id;
      if (key && item.value != null) {
        result[key] = Number(item.value);
      }
    });
    return result;
  },

  // ZORI Rent Index endpoints
  // propertyType: 'all' | 'sfr' | 'mfr' (matches ZillowService.mapRentPropertyType)
  getMetroRent: async (propertyType: string = 'all'): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>(`/api/zillow/rent/metros?propertyType=${propertyType}`);
    // Use CBSA code to match GeoJSON
    return transformZillowResponse(response, 'cbsa_code');
  },

  getCountyRent: async (propertyType: string = 'all'): Promise<CountyHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>(`/api/zillow/rent/counties?propertyType=${propertyType}`);
    // Use FIPS code to match GeoJSON
    return transformZillowResponse(response, 'county_fips');
  },

  getZipRent: async (state: string, propertyType: string = 'all'): Promise<ZipHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>(`/api/zillow/rent/zips?state=${state}&propertyType=${propertyType}`);
    // Use ZIP code as key
    return transformZillowResponse(response, 'region_id');
  },

  // ZORDI Renter Demand Index endpoints
  // propertyType: 'all' | 'sfr' | 'mfr'
  getMetroRenterDemand: async (propertyType: string = 'all'): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>(`/api/zillow/demand/metros?propertyType=${propertyType}`);
    // Use CBSA code to match GeoJSON
    return transformZillowResponse(response, 'cbsa_code');
  },

  getZipRenterDemand: async (state: string, propertyType: string = 'all'): Promise<ZipHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>(`/api/zillow/demand/zips?state=${state}&propertyType=${propertyType}`);
    // Use ZIP code as key
    return transformZillowResponse(response, 'region_id');
  },

  // ============================================================================
  // Market Indicators Endpoints
  // ============================================================================

  // Inventory (for_sale_inventory)
  getMetroInventory: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/inventory/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // New Listings (new_listings)
  getMetroNewListings: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/new-listings/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // Pending Listings (pending_listings)
  getMetroPendingListings: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/pending-listings/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // Median List Price (list_price)
  getMetroListPrice: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/list-price/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // Sales Count (home_sales)
  getMetroSalesCount: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/sales-count/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // Median Sale Price (sale_price)
  getMetroSalePrice: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/sale-price/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // Sale-to-List Ratio (sale_to_list)
  getMetroSaleToList: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/sale-to-list/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // Days on Market / Days to Pending (days_on_market)
  getMetroDaysToPending: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/days-to-pending/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // Days to Close (days_to_close)
  getMetroDaysToClose: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/days-to-close/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // Market Heat Index (market_health)
  getMetroMarketHeat: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/market-heat/metros');
    return transformZillowResponse(response, 'cbsa_code');
  },

  // ============================================================================
  // Price Cuts Endpoints
  // ============================================================================

  // Price Cut Share % (price_cut_pct)
  getMetroPriceCutShare: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowPriceCutsResponse>('/api/zillow/price-cuts/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.share_with_price_cut != null) {
        result[key] = Number(item.share_with_price_cut);
      }
    });
    return result;
  },

  // Price Cut Amount $ (price_cut_amount)
  getMetroPriceCutAmount: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowPriceCutsResponse>('/api/zillow/price-cuts/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.median_price_cut_amount != null) {
        result[key] = Number(item.median_price_cut_amount);
      }
    });
    return result;
  },

  // ============================================================================
  // New Construction Endpoints
  // ============================================================================

  // New Construction Sales Count (new_construction_sales)
  getMetroNewConstructionSales: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowNewConstructionResponse>('/api/zillow/new-construction/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.sales_count != null) {
        result[key] = Number(item.sales_count);
      }
    });
    return result;
  },

  // New Construction Price (new_construction_price)
  getMetroNewConstructionPrice: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowNewConstructionResponse>('/api/zillow/new-construction/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.median_sale_price != null) {
        result[key] = Number(item.median_sale_price);
      }
    });
    return result;
  },

  // New Construction $/Sq Ft (new_construction_ppsf)
  getMetroNewConstructionPPSF: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowNewConstructionResponse>('/api/zillow/new-construction/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.price_per_sqft != null) {
        result[key] = Number(item.price_per_sqft);
      }
    });
    return result;
  },

  // ============================================================================
  // Affordability Endpoints
  // ============================================================================

  // Income Needed to Buy (income_to_buy)
  getMetroIncomeToBuy: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowAffordabilityResponse>('/api/zillow/affordability/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.homeowner_income_needed != null) {
        result[key] = Number(item.homeowner_income_needed);
      }
    });
    return result;
  },

  // Income Needed to Rent (income_to_rent)
  getMetroIncomeToRent: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowAffordabilityResponse>('/api/zillow/affordability/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.renter_income_needed != null) {
        result[key] = Number(item.renter_income_needed);
      }
    });
    return result;
  },

  // Affordable Home Price (affordable_home_price)
  getMetroAffordableHomePrice: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowAffordabilityResponse>('/api/zillow/affordability/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.affordable_home_price != null) {
        result[key] = Number(item.affordable_home_price);
      }
    });
    return result;
  },

  // Years to Save (years_to_save)
  getMetroYearsToSave: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowAffordabilityResponse>('/api/zillow/affordability/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.years_to_save != null) {
        result[key] = Number(item.years_to_save);
      }
    });
    return result;
  },

  // Homeowner Affordability % (homeowner_affordability)
  getMetroHomeownerAffordability: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowAffordabilityResponse>('/api/zillow/affordability/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.homeowner_affordability_percent != null) {
        result[key] = Number(item.homeowner_affordability_percent);
      }
    });
    return result;
  },

  // Renter Affordability % (renter_affordability)
  getMetroRenterAffordability: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowAffordabilityResponse>('/api/zillow/affordability/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.renter_affordability_percent != null) {
        result[key] = Number(item.renter_affordability_percent);
      }
    });
    return result;
  },

  // ============================================================================
  // REALTOR API ENDPOINTS (Primary Source for Most Metrics)
  // ============================================================================

  // Helper to transform Realtor response based on geography type
  transformRealtorResponse: (response: RealtorApiResponse, keyField: 'region_id' | 'region_name' | 'state_id' | 'cbsa_code' | 'county_fips' | 'postal_code' = 'region_id'): Record<string, number> => {
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      let key: string | undefined;
      switch (keyField) {
        case 'region_name':
          key = item.region_name;
          break;
        case 'state_id':
          key = item.state_id || item.region_id;
          break;
        case 'cbsa_code':
          key = item.cbsa_code || item.region_id;
          break;
        case 'county_fips':
          key = item.county_fips || item.region_id;
          break;
        case 'postal_code':
          key = item.postal_code || item.region_id;
          break;
        default:
          key = item.region_id;
      }
      if (key && item.value != null) {
        result[key] = Number(item.value);
      }
    });
    return result;
  },

  // --- Home Value (median_listing_price) ---
  getRealtorStateHomeValues: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value/states');
    // Use region_name (full state name) to match GeoJSON
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroHomeValues: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyHomeValues: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipHomeValues: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/home-value/zips?state=${state}` : '/api/realtor/home-value/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Home Value YoY (median_listing_price_yy) ---
  getRealtorStateHomeValueYoy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-yoy/states');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroHomeValueYoy: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-yoy/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyHomeValueYoy: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-yoy/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipHomeValueYoy: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/home-value-yoy/zips?state=${state}` : '/api/realtor/home-value-yoy/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Inventory (active_listing_count) ---
  getRealtorStateInventory: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory/states');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroInventory: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyInventory: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipInventory: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/inventory/zips?state=${state}` : '/api/realtor/inventory/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Inventory YoY (active_listing_count_yy) ---
  getRealtorStateInventoryYoy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory-yoy/states');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroInventoryYoy: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory-yoy/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyInventoryYoy: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory-yoy/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipInventoryYoy: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/inventory-yoy/zips?state=${state}` : '/api/realtor/inventory-yoy/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Days on Market (median_days_on_market) ---
  getRealtorStateDom: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/dom/states');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroDom: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/dom/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyDom: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/dom/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipDom: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/dom/zips?state=${state}` : '/api/realtor/dom/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- New Listings (new_listing_count) ---
  getRealtorStateNewListings: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/new-listings/states');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroNewListings: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/new-listings/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyNewListings: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/new-listings/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipNewListings: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/new-listings/zips?state=${state}` : '/api/realtor/new-listings/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Pending Listings (pending_listing_count) ---
  getRealtorStatePendingListings: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/pending-listings/states');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroPendingListings: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/pending-listings/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyPendingListings: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/pending-listings/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipPendingListings: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/pending-listings/zips?state=${state}` : '/api/realtor/pending-listings/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Price Reduced Share (price_reduced_share) ---
  getRealtorStatePriceReduced: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/price-reduced/states');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroPriceReduced: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/price-reduced/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyPriceReduced: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/price-reduced/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipPriceReduced: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/price-reduced/zips?state=${state}` : '/api/realtor/price-reduced/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Price per Sq Ft (median_listing_price_per_square_foot) ---
  getRealtorStatePricePerSqft: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/price-per-sqft/states');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroPricePerSqft: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/price-per-sqft/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyPricePerSqft: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/price-per-sqft/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipPricePerSqft: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/price-per-sqft/zips?state=${state}` : '/api/realtor/price-per-sqft/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Hotness Score (hotness_score) - Metro/County/ZIP only ---
  getRealtorMetroHotness: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/hotness/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyHotness: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/hotness/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipHotness: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/hotness/zips?state=${state}` : '/api/realtor/hotness/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Supply Score (supply_score) - Metro/County/ZIP only ---
  getRealtorMetroSupplyScore: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/supply-score/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountySupplyScore: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/supply-score/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipSupplyScore: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/supply-score/zips?state=${state}` : '/api/realtor/supply-score/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Demand Score (demand_score) - Metro/County/ZIP only ---
  getRealtorMetroDemandScore: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/demand-score/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyDemandScore: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/demand-score/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipDemandScore: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/demand-score/zips?state=${state}` : '/api/realtor/demand-score/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },

  // --- Pending Ratio (pending_ratio) ---
  getRealtorStatePendingRatio: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/pending-ratio/states');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorMetroPendingRatio: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/pending-ratio/metros');
    return api.transformRealtorResponse(response, 'cbsa_code');
  },

  getRealtorCountyPendingRatio: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/pending-ratio/counties');
    return api.transformRealtorResponse(response, 'county_fips');
  },

  getRealtorZipPendingRatio: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/pending-ratio/zips?state=${state}` : '/api/realtor/pending-ratio/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code');
  },
};