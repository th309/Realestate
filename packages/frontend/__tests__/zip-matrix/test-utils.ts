/**
 * ZIP Matrix Test Utilities
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { MetricConfig, ResultStatus, StateResults, ZipResults, MetricSummary } from './types';
import { ZIP_METRICS, METRO_ONLY_METRICS } from './metrics';

const API_URL = process.env.NEXT_PUBLIC_API_URL; if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL env var required for tests');
const API_TIMEOUT = 30000;
const RESULTS_DIR = join(__dirname, 'results');

// Ensure results directory exists
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, timeout: number = API_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Fetch all ZIPs for a state
 */
export async function fetchZipsForState(state: string): Promise<string[]> {
  const url = `${API_URL}/api/zillow/zips?state=${state}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.error(`Failed to fetch ZIPs for ${state}: ${res.status}`);
      return [];
    }

    const data = await res.json();

    if (!data.data || !Array.isArray(data.data)) {
      console.error(`Invalid ZIP data for ${state}`);
      return [];
    }

    // Extract ZIP codes - they might be in different fields
    return data.data.map((z: any) =>
      z.zip_code || z.region_name || z.region_id?.toString()
    ).filter(Boolean);
  } catch (error) {
    console.error(`Error fetching ZIPs for ${state}:`, error);
    return [];
  }
}

/**
 * Test a single metric for a ZIP
 */
export async function testMetricForZip(
  metric: MetricConfig,
  zip: string,
  state: string,
  stateData?: Map<string, any>,
  zipInfo?: any // Pre-fetched ZIP info from initial fetch
): Promise<ResultStatus> {
  // Metro-only metrics are always n/a
  if (!metric.zipLevel) {
    return 'n/a';
  }

  try {
    // For state-list endpoints, check the pre-fetched data
    if (metric.endpointType === 'state-list' && stateData) {
      const key = `${metric.endpoint}${metric.params ? JSON.stringify(metric.params) : ''}`;
      const data = stateData.get(key);

      if (!data || data.length === 0) {
        // If the endpoint returned no data, mark as empty
        return 'empty';
      }

      // Find this ZIP in the data - try multiple fields
      const zipData = data.find((d: any) => {
        const zipStr = zip.toString();
        return (
          d.zip_code === zipStr ||
          d.zip_code === zip ||
          d.region_name === zipStr ||
          d.region_name === zip ||
          d.region_id?.toString() === zipStr ||
          String(d.region_id) === zipStr
        );
      });

      if (!zipData) {
        return 'empty';
      }

      // Check if the value field exists and has data
      if (metric.valueField) {
        const value = zipData[metric.valueField];
        return value !== null && value !== undefined ? 'pass' : 'empty';
      }

      // If no specific valueField, check for 'value' field
      if (zipData.value !== null && zipData.value !== undefined) {
        return 'pass';
      }

      return 'pass';
    }

    // For individual endpoints, make API call
    let url = `${API_URL}${metric.endpoint}?geo=zip&geo_id=${zip}`;
    if (metric.params) {
      Object.entries(metric.params).forEach(([key, value]) => {
        url += `&${key}=${value}`;
      });
    }

    const res = await fetchWithTimeout(url, 10000);

    if (!res.ok) {
      return res.status === 404 ? 'empty' : 'fail';
    }

    const data = await res.json();

    // Check if data has meaningful value
    if (data.value !== null && data.value !== undefined) {
      return 'pass';
    }
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      return 'pass';
    }

    return 'empty';
  } catch (error) {
    console.error(`Error testing ${metric.id} for ZIP ${zip}:`, error);
    return 'fail';
  }
}

/**
 * Pre-fetch all state-list data for a state
 * This avoids making redundant API calls for each ZIP
 */
export async function prefetchStateData(state: string): Promise<Map<string, any[]>> {
  const stateData = new Map<string, any[]>();

  // Get unique endpoints that use state-list
  const stateListMetrics = ZIP_METRICS.filter(m => m.endpointType === 'state-list' && m.zipLevel);
  const endpoints = new Map<string, MetricConfig>();

  for (const metric of stateListMetrics) {
    const key = `${metric.endpoint}${metric.params ? JSON.stringify(metric.params) : ''}`;
    if (!endpoints.has(key)) {
      endpoints.set(key, metric);
    }
  }

  // Fetch each endpoint once
  for (const [key, metric] of endpoints) {
    try {
      let url = `${API_URL}${metric.endpoint}?state=${state}`;
      if (metric.params) {
        Object.entries(metric.params).forEach(([k, v]) => {
          url += `&${k}=${v}`;
        });
      }

      console.log(`Prefetching: ${url}`);
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          stateData.set(key, data.data);
          console.log(`  → Got ${data.data.length} records`);
        } else {
          console.log(`  → No data array in response`);
        }
      } else {
        console.log(`  → HTTP ${res.status}`);
      }
    } catch (error) {
      console.error(`Error prefetching ${key} for ${state}:`, error);
    }
  }

  return stateData;
}

/**
 * Test all metrics for a single ZIP
 */
export async function testAllMetricsForZip(
  zip: string,
  state: string,
  stateData: Map<string, any>
): Promise<ZipResults> {
  const results: ZipResults = {};

  for (const metric of ZIP_METRICS) {
    results[metric.id] = await testMetricForZip(metric, zip, state, stateData);
  }

  return results;
}

/**
 * Aggregate results for a state
 */
export function aggregateStateResults(
  state: string,
  startTime: number,
  zipResults: Map<string, ZipResults>
): StateResults {
  const summary: { [metricId: string]: MetricSummary } = {};

  // Initialize summary for each metric
  for (const metric of ZIP_METRICS) {
    summary[metric.id] = { pass: 0, empty: 0, fail: 0, 'n/a': 0 };
  }

  // Count results
  const zips: { [zipCode: string]: ZipResults } = {};
  for (const [zip, results] of zipResults) {
    zips[zip] = results;
    for (const [metricId, status] of Object.entries(results)) {
      if (summary[metricId]) {
        summary[metricId][status]++;
      }
    }
  }

  return {
    state,
    runDate: new Date().toISOString(),
    totalZips: zipResults.size,
    duration: Date.now() - startTime,
    summary,
    zips,
  };
}

/**
 * Write state results to JSON file
 */
export function writeStateResults(results: StateResults): void {
  const filePath = join(RESULTS_DIR, `${results.state}-results.json`);
  writeFileSync(filePath, JSON.stringify(results, null, 2));
  console.log(`Results written to ${filePath}`);
}

/**
 * Read state results from JSON file
 */
export function readStateResults(state: string): StateResults | null {
  const filePath = join(RESULTS_DIR, `${state}-results.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

/**
 * Check if critical metrics pass threshold
 */
export function checkCriticalMetrics(
  results: ZipResults,
  criticalMetrics: string[]
): boolean {
  return criticalMetrics.every(metricId => {
    const status = results[metricId];
    return status === 'pass' || status === 'n/a';
  });
}
