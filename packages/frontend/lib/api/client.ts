const API_URL = 'https://backend-production-ee4d.up.railway.app';

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

export const api = {
  getStats: () => fetchAPI<MarketStats>('/markets/stats'),
  getStates: () => fetchAPI<State[]>('/markets/states'),
};