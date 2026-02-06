/**
 * MARKETS DATA FETCHER
 *
 * Fetches market-level data like stats, lists of metros/counties/zips, etc.
 */

import { fetchAPI } from './base';

export interface MarketStats {
  totalMarkets: number;
  totalStates: number;
  totalCounties: number;
  totalZips: number;
}

/**
 * Fetch market statistics (counts of markets by geography level)
 */
export async function fetchMarketStats(): Promise<MarketStats> {
  return fetchAPI<MarketStats>('/api/markets/stats');
}
