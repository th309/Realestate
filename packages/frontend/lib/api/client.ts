// Use local backend in development, production URL otherwise
// Updated 2026-01-19: Cap rate data validation fix
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchAPI<T>(endpoint: string): Promise<T> {
  const url = `${API_URL}${endpoint}`;
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
  date?: string;
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

// Transform Zillow API response including date for "as of" display
function transformZillowResponseWithDates(
  response: ZillowApiResponse,
  keyField: 'region_id' | 'region_name' | 'county_fips' | 'cbsa_code' = 'region_id'
): Record<string, { value: number; date?: string }> {
  const result: Record<string, { value: number; date?: string }> = {};
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
      result[key] = {
        value: Number(item.value),
        date: item.date,
      };
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

  // Market Heat Index (market_health) - includes dates for "as of" display
  getMetroMarketHeat: async (): Promise<Record<string, { value: number; date?: string }>> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/market-heat/metros');
    return transformZillowResponseWithDates(response, 'cbsa_code');
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

  // Income Needed to Buy (income_to_buy) - from calculated_metrics
  getNationalIncomeToBuy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ region_name: string; income_to_buy: number }> }>('/api/metrics/income-to-buy/national');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.region_name && item.income_to_buy != null) {
        result[item.region_name] = Number(item.income_to_buy);
      }
    });
    return result;
  },

  getStateIncomeToBuy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ region_name: string; income_to_buy: number }> }>('/api/metrics/income-to-buy/states');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.region_name && item.income_to_buy != null) {
        result[item.region_name] = Number(item.income_to_buy);
      }
    });
    return result;
  },

  getMetroIncomeToBuy: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ cbsa_code: string; income_to_buy: number }> }>('/api/metrics/income-to-buy/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.cbsa_code && item.income_to_buy != null) {
        result[item.cbsa_code] = Number(item.income_to_buy);
      }
    });
    return result;
  },

  getCountyIncomeToBuy: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ county_fips: string; income_to_buy: number }> }>('/api/metrics/income-to-buy/counties');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.county_fips && item.income_to_buy != null) {
        result[item.county_fips] = Number(item.income_to_buy);
      }
    });
    return result;
  },

  getZipIncomeToBuy: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/metrics/income-to-buy/zips?state=${state}` : '/api/metrics/income-to-buy/zips';
    const response = await fetchAPI<{ success: boolean; data: Array<{ postal_code: string; income_to_buy: number }> }>(url);
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.postal_code && item.income_to_buy != null) {
        result[item.postal_code] = Number(item.income_to_buy);
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

  // Affordable Home Price (affordable_home_price) - from calculated_metrics
  getNationalAffordableHomePrice: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ region_name: string; affordable_home_price: number }> }>('/api/metrics/affordable-home-price/national');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.region_name && item.affordable_home_price != null) {
        result[item.region_name] = Number(item.affordable_home_price);
      }
    });
    return result;
  },

  getStateAffordableHomePrice: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ region_name: string; affordable_home_price: number }> }>('/api/metrics/affordable-home-price/states');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.region_name && item.affordable_home_price != null) {
        result[item.region_name] = Number(item.affordable_home_price);
      }
    });
    return result;
  },

  getMetroAffordableHomePrice: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ cbsa_code: string; affordable_home_price: number }> }>('/api/metrics/affordable-home-price/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.cbsa_code && item.affordable_home_price != null) {
        result[item.cbsa_code] = Number(item.affordable_home_price);
      }
    });
    return result;
  },

  getCountyAffordableHomePrice: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ county_fips: string; affordable_home_price: number }> }>('/api/metrics/affordable-home-price/counties');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.county_fips && item.affordable_home_price != null) {
        result[item.county_fips] = Number(item.affordable_home_price);
      }
    });
    return result;
  },

  getZipAffordableHomePrice: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/metrics/affordable-home-price/zips?state=${state}` : '/api/metrics/affordable-home-price/zips';
    const response = await fetchAPI<{ success: boolean; data: Array<{ postal_code: string; affordable_home_price: number }> }>(url);
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.postal_code && item.affordable_home_price != null) {
        result[item.postal_code] = Number(item.affordable_home_price);
      }
    });
    return result;
  },

  // Years to Save (years_to_save) - from calculated_metrics
  getNationalYearsToSave: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ region_name: string; years_to_save: number }> }>('/api/metrics/years-to-save/national');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.region_name && item.years_to_save != null) {
        result[item.region_name] = Number(item.years_to_save);
      }
    });
    return result;
  },

  getStateYearsToSave: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ region_name: string; years_to_save: number }> }>('/api/metrics/years-to-save/states');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.region_name && item.years_to_save != null) {
        result[item.region_name] = Number(item.years_to_save);
      }
    });
    return result;
  },

  getMetroYearsToSave: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ cbsa_code: string; years_to_save: number }> }>('/api/metrics/years-to-save/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.cbsa_code && item.years_to_save != null) {
        result[item.cbsa_code] = Number(item.years_to_save);
      }
    });
    return result;
  },

  getCountyYearsToSave: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<{ success: boolean; data: Array<{ county_fips: string; years_to_save: number }> }>('/api/metrics/years-to-save/counties');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.county_fips && item.years_to_save != null) {
        result[item.county_fips] = Number(item.years_to_save);
      }
    });
    return result;
  },

  getZipYearsToSave: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/metrics/years-to-save/zips?state=${state}` : '/api/metrics/years-to-save/zips';
    const response = await fetchAPI<{ success: boolean; data: Array<{ postal_code: string; years_to_save: number }> }>(url);
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      if (item.postal_code && item.years_to_save != null) {
        result[item.postal_code] = Number(item.years_to_save);
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
  // CALCULATED METRICS ENDPOINTS
  // ============================================================================

  // Overvalued % (calculated from ZHVI and median income benchmark)
  getMetroOvervalued: async (): Promise<MetroHomeValues> => {
    interface OvervaluedResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        cbsa_code?: string;
        overvalued_pct: number;
      }>;
    }
    const response = await fetchAPI<OvervaluedResponse>('/api/metrics/overvalued/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.overvalued_pct != null) {
        result[key] = Number(item.overvalued_pct);
      }
    });
    return result;
  },

  // Cap Rate (calculated from ZORI and ZHVI)
  getMetroCapRate: async (): Promise<MetroHomeValues> => {
    interface CapRateResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        cbsa_code?: string;
        cap_rate: number;
      }>;
    }
    const response = await fetchAPI<CapRateResponse>('/api/metrics/cap-rate/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.cap_rate != null) {
        result[key] = Number(item.cap_rate);
      }
    });
    return result;
  },

  getCountyCapRate: async (): Promise<CountyHomeValues> => {
    interface CapRateResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        county_fips?: string;
        cap_rate: number;
      }>;
    }
    const response = await fetchAPI<CapRateResponse>('/api/metrics/cap-rate/counties');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.county_fips || item.region_id;
      if (key && item.cap_rate != null) {
        result[key] = Number(item.cap_rate);
      }
    });
    return result;
  },

  getZipCapRate: async (state?: string): Promise<ZipHomeValues> => {
    interface CapRateResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        postal_code?: string;
        cap_rate: number;
      }>;
    }
    const url = state ? `/api/metrics/cap-rate/zips?state=${state}` : '/api/metrics/cap-rate/zips';
    const response = await fetchAPI<CapRateResponse>(url);
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.postal_code || item.region_id;
      if (key && item.cap_rate != null) {
        result[key] = Number(item.cap_rate);
      }
    });
    return result;
  },

  // 5-Year Home Value Growth (CAGR from Zillow ZHVI)
  getMetroHomeValue5Yr: async (): Promise<MetroHomeValues> => {
    interface GrowthResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        cbsa_code?: string;
        cagr_5yr: number;
      }>;
    }
    const response = await fetchAPI<GrowthResponse>('/api/metrics/home-value-5yr/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.cagr_5yr != null) {
        result[key] = Number(item.cagr_5yr);
      }
    });
    return result;
  },

  getStateHomeValue5Yr: async (): Promise<StateHomeValues> => {
    interface GrowthResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        region_name?: string;
        cagr_5yr: number;
      }>;
    }
    const response = await fetchAPI<GrowthResponse>('/api/metrics/home-value-5yr/states');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.region_name || item.region_id;
      if (key && item.cagr_5yr != null) {
        result[key] = Number(item.cagr_5yr);
      }
    });
    return result;
  },

  getCountyHomeValue5Yr: async (): Promise<CountyHomeValues> => {
    interface GrowthResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        county_fips?: string;
        cagr_5yr: number;
      }>;
    }
    const response = await fetchAPI<GrowthResponse>('/api/metrics/home-value-5yr/counties');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.county_fips || item.region_id;
      if (key && item.cagr_5yr != null) {
        result[key] = Number(item.cagr_5yr);
      }
    });
    return result;
  },

  getZipHomeValue5Yr: async (state?: string): Promise<ZipHomeValues> => {
    interface GrowthResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        postal_code?: string;
        cagr_5yr: number;
      }>;
    }
    const url = state
      ? `/api/metrics/home-value-5yr/zips?state=${encodeURIComponent(state)}`
      : '/api/metrics/home-value-5yr/zips';
    const response = await fetchAPI<GrowthResponse>(url);
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.postal_code || item.region_id;
      if (key && item.cagr_5yr != null) {
        result[key] = Number(item.cagr_5yr);
      }
    });
    return result;
  },

  // ============================================================================
  // REALTOR API ENDPOINTS (Primary Source for Most Metrics)
  // ============================================================================

  // Helper to transform Realtor response based on geography type
  // Set asPercent=true to multiply decimal values by 100 (e.g., 0.05 -> 5)
  transformRealtorResponse: (
    response: RealtorApiResponse,
    keyField: 'region_id' | 'region_name' | 'state_id' | 'cbsa_code' | 'county_fips' | 'postal_code' = 'region_id',
    asPercent: boolean = false
  ): Record<string, number> => {
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
        const value = Number(item.value);
        result[key] = asPercent ? value * 100 : value;
      }
    });
    return result;
  },

  // --- National Data (from realtor_national table) ---
  // Returns { 'United States': value } for national level display
  getRealtorNationalHomeValues: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value/national');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorNationalHomeValueYoy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-yoy/national');
    return api.transformRealtorResponse(response, 'region_name', true);
  },

  getRealtorNationalHomeValueMom: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-mom/national');
    return api.transformRealtorResponse(response, 'region_name', true);
  },

  getRealtorNationalInventory: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory/national');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorNationalInventoryYoy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory-yoy/national');
    return api.transformRealtorResponse(response, 'region_name', true);
  },

  getRealtorNationalDom: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/dom/national');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorNationalNewListings: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/new-listings/national');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorNationalPendingListings: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/pending-listings/national');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorNationalPriceReduced: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/price-reduced/national');
    return api.transformRealtorResponse(response, 'region_name', true);
  },

  getRealtorNationalPricePerSqft: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/price-per-sqft/national');
    return api.transformRealtorResponse(response, 'region_name');
  },

  getRealtorNationalPendingRatio: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/pending-ratio/national');
    return api.transformRealtorResponse(response, 'region_name', true);
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
  // Note: Values are stored as decimals (0.05 = 5%), converting to percentage display
  getRealtorStateHomeValueYoy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-yoy/states');
    return api.transformRealtorResponse(response, 'region_name', true);
  },

  getRealtorMetroHomeValueYoy: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-yoy/metros');
    return api.transformRealtorResponse(response, 'cbsa_code', true);
  },

  getRealtorCountyHomeValueYoy: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-yoy/counties');
    return api.transformRealtorResponse(response, 'county_fips', true);
  },

  getRealtorZipHomeValueYoy: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/home-value-yoy/zips?state=${state}` : '/api/realtor/home-value-yoy/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code', true);
  },

  // --- Home Value MoM (median_listing_price_mm) ---
  // Note: Values are stored as decimals (0.01 = 1%), converting to percentage display
  getRealtorStateHomeValueMom: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-mom/states');
    return api.transformRealtorResponse(response, 'region_name', true);
  },

  getRealtorMetroHomeValueMom: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-mom/metros');
    return api.transformRealtorResponse(response, 'cbsa_code', true);
  },

  getRealtorCountyHomeValueMom: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/home-value-mom/counties');
    return api.transformRealtorResponse(response, 'county_fips', true);
  },

  getRealtorZipHomeValueMom: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/home-value-mom/zips?state=${state}` : '/api/realtor/home-value-mom/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code', true);
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
  // Note: Values are stored as decimals (0.05 = 5%), converting to percentage display
  getRealtorStateInventoryYoy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory-yoy/states');
    return api.transformRealtorResponse(response, 'region_name', true);
  },

  getRealtorMetroInventoryYoy: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory-yoy/metros');
    return api.transformRealtorResponse(response, 'cbsa_code', true);
  },

  getRealtorCountyInventoryYoy: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/inventory-yoy/counties');
    return api.transformRealtorResponse(response, 'county_fips', true);
  },

  getRealtorZipInventoryYoy: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/inventory-yoy/zips?state=${state}` : '/api/realtor/inventory-yoy/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code', true);
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

  // --- New Listings YoY (new_listing_count_yy) ---
  getRealtorStateNewListingsYoy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/new-listings-yoy/states');
    return api.transformRealtorResponse(response, 'region_name', true);
  },

  getRealtorMetroNewListingsYoy: async (): Promise<MetroHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/new-listings-yoy/metros');
    return api.transformRealtorResponse(response, 'cbsa_code', true);
  },

  getRealtorCountyNewListingsYoy: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/new-listings-yoy/counties');
    return api.transformRealtorResponse(response, 'county_fips', true);
  },

  getRealtorNationalNewListingsYoy: async (): Promise<StateHomeValues> => {
    const response = await fetchAPI<RealtorApiResponse>('/api/realtor/new-listings-yoy/national');
    return api.transformRealtorResponse(response, 'region_name', true);
  },

  getRealtorZipNewListingsYoy: async (state?: string): Promise<ZipHomeValues> => {
    const url = state ? `/api/realtor/new-listings-yoy/zips?state=${state}` : '/api/realtor/new-listings-yoy/zips';
    const response = await fetchAPI<RealtorApiResponse>(url);
    return api.transformRealtorResponse(response, 'postal_code', true);
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

  // ============================================================================
  // INVENTORY SURPLUS (Calculated Metric)
  // Formula: Current Inventory - 5-Year Historical Average
  // ============================================================================

  getNationalInventorySurplus: async (): Promise<number | null> => {
    interface SurplusResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        inventory_surplus: number;
      }>;
    }
    const response = await fetchAPI<SurplusResponse>('/api/metrics/inventory-surplus/national');
    if (response.data && response.data.length > 0) {
      return response.data[0].inventory_surplus;
    }
    return null;
  },

  getStateInventorySurplus: async (): Promise<StateHomeValues> => {
    interface SurplusResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        region_name?: string;
        inventory_surplus: number;
      }>;
    }
    const response = await fetchAPI<SurplusResponse>('/api/metrics/inventory-surplus/states');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.region_name || item.region_id;
      if (key && item.inventory_surplus != null) {
        result[key] = Number(item.inventory_surplus);
      }
    });
    return result;
  },

  getMetroInventorySurplus: async (): Promise<MetroHomeValues> => {
    interface SurplusResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        cbsa_code?: string;
        inventory_surplus: number;
      }>;
    }
    const response = await fetchAPI<SurplusResponse>('/api/metrics/inventory-surplus/metros');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.inventory_surplus != null) {
        result[key] = Number(item.inventory_surplus);
      }
    });
    return result;
  },

  getCountyInventorySurplus: async (): Promise<CountyHomeValues> => {
    interface SurplusResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        county_fips?: string;
        inventory_surplus: number;
      }>;
    }
    const response = await fetchAPI<SurplusResponse>('/api/metrics/inventory-surplus/counties');
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.county_fips || item.region_id;
      if (key && item.inventory_surplus != null) {
        result[key] = Number(item.inventory_surplus);
      }
    });
    return result;
  },

  getZipInventorySurplus: async (state?: string): Promise<ZipHomeValues> => {
    interface SurplusResponse {
      success: boolean;
      data?: Array<{
        region_id: string;
        postal_code?: string;
        inventory_surplus: number;
      }>;
    }
    const url = state
      ? `/api/metrics/inventory-surplus/zips?state=${encodeURIComponent(state)}`
      : '/api/metrics/inventory-surplus/zips';
    const response = await fetchAPI<SurplusResponse>(url);
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.postal_code || item.region_id;
      if (key && item.inventory_surplus != null) {
        result[key] = Number(item.inventory_surplus);
      }
    });
    return result;
  },

  // ============================================================================
  // SCORING API ENDPOINTS
  // ============================================================================

  // Get PropertyIQ score for a specific geography
  getScore: async (geographyType: string, geographyId: string): Promise<ScoreResponse | null> => {
    try {
      const response = await fetchAPI<ScoreResponse>(`/api/scoring/${geographyType}/${geographyId}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch score:', error);
      return null;
    }
  },

  // Get scores for multiple geographies
  getBatchScores: async (geographyType: string, ids: string[]): Promise<BatchScoreResponse | null> => {
    try {
      const response = await fetchAPI<BatchScoreResponse>(
        `/api/scoring/batch/${geographyType}?ids=${ids.join(',')}`
      );
      return response;
    } catch (error) {
      console.error('Failed to fetch batch scores:', error);
      return null;
    }
  },
};

// Scoring API response types
export interface ScoreResponse {
  geographyId: string;
  geographyName?: string;
  geographyType: string;
  periodDate: string;
  homereadyScore: number;
  investoredgeScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  components?: {
    homeready?: {
      affordability: number;
      valueGrowth: number;
      marketHealth: number;
      inventoryHealth: number;
    };
    investoredge?: {
      cashFlow: number;
      appreciation: number;
      demandRisk: number;
      marketLiquidity: number;
    };
  };
}

export interface BatchScoreResponse {
  geographyType: string;
  periodDate?: string;
  scores: (ScoreResponse | { geographyId: string; error: string })[];
}

// ============================================================================
// TIME SERIES API - Historical data for graphs
// ============================================================================

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface TimeSeriesResponse {
  success: boolean;
  metric: string;
  geoLevel: string;
  regionId: string;
  count: number;
  data: TimeSeriesDataPoint[];
}

export interface DateRangeResponse {
  success: boolean;
  metric: string;
  geoLevel: string;
  minDate: string;
  maxDate: string;
  count: number;
}

// Add to api export object
export const timeSeriesApi = {
  /**
   * Get historical time-series data for a specific metric/geography/region
   * @param metric - Metric ID (e.g., 'listing_price', 'home_value', etc.)
   * @param geoLevel - Geography level (national, state, metro, county, city, zip)
   * @param regionId - Region identifier (state name, CBSA code, FIPS, ZIP, etc.)
   * @param startDate - Optional start date filter (YYYY-MM-DD)
   * @param endDate - Optional end date filter (YYYY-MM-DD)
   * @param limit - Optional limit on number of data points
   */
  getTimeSeries: async (
    metric: string,
    geoLevel: string,
    regionId: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
  ): Promise<TimeSeriesResponse> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (limit) params.append('limit', limit.toString());

    const queryString = params.toString();
    const url = `/api/timeseries/${metric}/${geoLevel}/${encodeURIComponent(regionId)}${queryString ? `?${queryString}` : ''}`;

    return fetchAPI<TimeSeriesResponse>(url);
  },

  /**
   * Get available date range for a metric/geography combination
   */
  getAvailableDates: async (metric: string, geoLevel: string): Promise<DateRangeResponse> => {
    return fetchAPI<DateRangeResponse>(`/api/timeseries/dates/${metric}/${geoLevel}`);
  },
};