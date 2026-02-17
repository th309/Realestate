/**
 * BENCHMARK DATA FETCHERS
 *
 * API functions for realtor benchmark comparisons.
 */

import { API_URL } from './base';

export interface BenchmarkData {
  location: Record<string, number | null>;
  state: Record<string, number | null>;
  national: Record<string, number | null>;
  locationName: string;
  stateName: string | null;
}

/**
 * Fetch benchmark comparison data (local vs state vs national).
 */
export async function fetchBenchmarks(
  geoLevel: string,
  regionId: string,
  stateId?: string,
): Promise<BenchmarkData> {
  const params = new URLSearchParams({ geoLevel, regionId });
  if (stateId) {
    params.append('stateId', stateId);
  }

  const response = await fetch(`${API_URL}/api/realtor/benchmarks?${params}`);
  if (!response.ok) {
    throw new Error(`Benchmark API error: ${response.status}`);
  }

  return response.json();
}
