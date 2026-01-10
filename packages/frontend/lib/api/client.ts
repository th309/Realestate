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
}

interface ZillowApiResponse {
  success: boolean;
  count: number;
  data: ZillowHomeValue[];
}

export type StateHomeValues = Record<string, number>;
export type MetroHomeValues = Record<string, number>;
export type CountyHomeValues = Record<string, number>;
export type ZipHomeValues = Record<string, number>;

// Transform Zillow API response to Record<region_id, value> format
function transformZillowResponse(response: ZillowApiResponse, keyField: 'region_id' | 'region_name' | 'county_fips' = 'region_id'): Record<string, number> {
  const result: Record<string, number> = {};
  response.data?.forEach(item => {
    const key = keyField === 'county_fips' ? (item.county_fips || item.region_id) :
                keyField === 'region_name' ? item.region_name : item.region_id;
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
    return transformZillowResponse(response, 'region_id');
  },

  getCountyHomeValues: async (): Promise<CountyHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/counties');
    // Counties use FIPS code as key to match GeoJSON
    return transformZillowResponse(response, 'county_fips');
  },

  getZipHomeValues: async (): Promise<ZipHomeValues> => {
    const response = await fetchAPI<ZillowApiResponse>('/api/zillow/zips');
    return transformZillowResponse(response, 'region_id');
  },
};