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

export type StateHomeValues = Record<string, number>;
export type MetroHomeValues = Record<string, number>;
export type CountyHomeValues = Record<string, number>;
export type ZipHomeValues = Record<string, number>;

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
    if (key && item.value) {
      result[key] = item.value;
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

  // ZHVF Forecast endpoints - returns forecast % growth values
  // horizon: '1m' | '3m' | '12m' - which forecast horizon to use
  getMetroForecast: async (horizon: string = '12m'): Promise<MetroHomeValues> => {
    const response = await fetchAPI<ZillowForecastResponse>(`/api/zillow/forecast/metros?horizon=${horizon}`);
    // Use CBSA code to match GeoJSON
    const result: Record<string, number> = {};
    response.data?.forEach(item => {
      const key = item.cbsa_code || item.region_id;
      if (key && item.value !== null) {
        result[key] = item.value;
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
      if (key && item.value !== null) {
        result[key] = item.value;
      }
    });
    return result;
  },
};