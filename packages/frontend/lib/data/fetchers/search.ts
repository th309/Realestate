/**
 * MARKET SEARCH FETCHERS
 *
 * API functions for loading geography search lists and geography typeahead search.
 */

import { API_URL } from './base';

// ---------------------------------------------------------------------------
// Geography search (typeahead)
// ---------------------------------------------------------------------------

export interface GeographySearchResult {
  geography_id: string;
  geography_type: string;
  name: string;
  state_code?: string;
  cbsa_code?: string;
  cbsa_name?: string;
  latitude?: number;
  longitude?: number;
  population?: number;
}

/**
 * Search geographies by name (typeahead).
 * Supports optional AbortSignal for request cancellation.
 */
export async function fetchGeographySearch(
  query: string,
  options?: { type?: string; limit?: number; signal?: AbortSignal },
): Promise<GeographySearchResult[]> {
  const params = new URLSearchParams({ query, limit: String(options?.limit ?? 15) });
  if (options?.type) params.set('type', options.type);

  const res = await fetch(`${API_URL}/api/geography/search?${params}`, {
    signal: options?.signal,
  });

  if (!res.ok) return [];
  return res.json();
}

// ---------------------------------------------------------------------------
// Market lists
// ---------------------------------------------------------------------------

/**
 * Fetch list of all metros.
 */
export async function fetchMetrosList<T = unknown>(): Promise<T[]> {
  const res = await fetch(`${API_URL}/api/markets/metros`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch list of all counties.
 */
export async function fetchCountiesList<T = unknown>(): Promise<T[]> {
  const res = await fetch(`${API_URL}/api/markets/counties`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch list of all ZIP codes.
 */
export async function fetchZipsList<T = unknown>(): Promise<T[]> {
  const res = await fetch(`${API_URL}/api/markets/zips`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch list of all cities.
 */
export async function fetchCitiesList<T = unknown>(): Promise<T[]> {
  const res = await fetch(`${API_URL}/api/markets/cities`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch markets list (without /api prefix — used by useReportSearch).
 */
export async function fetchMarketsMetros<T = unknown>(): Promise<T[]> {
  const res = await fetch(`${API_URL}/markets/metros`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

export async function fetchMarketsCounties<T = unknown>(): Promise<T[]> {
  const res = await fetch(`${API_URL}/markets/counties`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

export async function fetchMarketsZips<T = unknown>(): Promise<T[]> {
  const res = await fetch(`${API_URL}/markets/zips`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}

export async function fetchMarketsCities<T = unknown>(): Promise<T[]> {
  const res = await fetch(`${API_URL}/markets/cities`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json();
}
