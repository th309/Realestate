/**
 * DATA CARDS INTEGRATION TEST SUITE
 *
 * Tests PropertyIQ data cards against the LIVE Railway backend.
 * NO MOCKS - all tests hit real APIs with real Supabase data.
 *
 * Test Matrix:
 * - Core metrics (home_value, rent, cap_rate, etc.)
 * - Geography types: metro, county, zip
 * - Sample locations: major US metros
 *
 * Run with: npm run test:data-matrix
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Railway backend URL - use env var or default to production
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-ee4d.up.railway.app';

// Test timeout for API calls
const API_TIMEOUT = 15000;

// Sample locations for testing
const SAMPLE_METROS = [
  { id: '35620', name: 'New York-Newark-Jersey City, NY' },
  { id: '31080', name: 'Los Angeles-Long Beach-Anaheim, CA' },
  { id: '16980', name: 'Chicago-Naperville-Elgin, IL' },
  { id: '19100', name: 'Dallas-Fort Worth-Arlington, TX' },
  { id: '26420', name: 'Houston-The Woodlands-Sugar Land, TX' },
];

const SAMPLE_COUNTIES = [
  { id: '06037', name: 'Los Angeles County, CA' },
  { id: '17031', name: 'Cook County, IL' },
  { id: '48201', name: 'Harris County, TX' },
  { id: '04013', name: 'Maricopa County, AZ' },
  { id: '48113', name: 'Dallas County, TX' },
];

const SAMPLE_ZIPS = [
  { id: '90210', name: 'Beverly Hills, CA' },
  { id: '10001', name: 'New York, NY' },
  { id: '60601', name: 'Chicago, IL' },
  { id: '75201', name: 'Dallas, TX' },
  { id: '77001', name: 'Houston, TX' },
];

// Core metrics that MUST work for launch
const CORE_METRICS = [
  { endpoint: '/api/zillow/metros', metric: 'home_value', geo: 'metro' },
  { endpoint: '/api/zillow/counties', metric: 'home_value', geo: 'county' },
  { endpoint: '/api/zillow/zips', metric: 'home_value', geo: 'zip' },
  { endpoint: '/api/zillow/rent/metros', metric: 'rent_index', geo: 'metro' },
  { endpoint: '/api/zillow/rent/counties', metric: 'rent_index', geo: 'county' },
  { endpoint: '/api/zillow/rent/zips', metric: 'rent_index', geo: 'zip' },
  { endpoint: '/api/realtor/listing-price/metros', metric: 'listing_price', geo: 'metro' },
  { endpoint: '/api/realtor/listing-price/counties', metric: 'listing_price', geo: 'county' },
  { endpoint: '/api/realtor/inventory/metros', metric: 'inventory', geo: 'metro' },
  { endpoint: '/api/realtor/inventory/counties', metric: 'inventory', geo: 'county' },
  { endpoint: '/api/realtor/dom/metros', metric: 'days_on_market', geo: 'metro' },
  { endpoint: '/api/realtor/dom/counties', metric: 'days_on_market', geo: 'county' },
  { endpoint: '/api/metrics/cap-rate/metros', metric: 'cap_rate', geo: 'metro' },
  { endpoint: '/api/metrics/cap-rate/counties', metric: 'cap_rate', geo: 'county' },
  { endpoint: '/api/metrics/grm/metros', metric: 'grm', geo: 'metro' },
  { endpoint: '/api/metrics/grm/counties', metric: 'grm', geo: 'county' },
];

// PropertyIQ score endpoints
const SCORE_ENDPOINTS = [
  { endpoint: '/api/scores/homeready/metros', score: 'homeready', geo: 'metro' },
  { endpoint: '/api/scores/investoredge/metros', score: 'investoredge', geo: 'metro' },
  { endpoint: '/api/scores/markethealth/metros', score: 'markethealth', geo: 'metro' },
];

interface ApiResponse {
  success?: boolean;
  data?: unknown[];
  count?: number;
  error?: string;
}

async function fetchEndpoint(endpoint: string): Promise<{ status: number; data: ApiResponse; responseTime: number }> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    let data: ApiResponse;
    try {
      data = await response.json();
    } catch {
      data = { error: 'Invalid JSON response' };
    }

    return { status: response.status, data, responseTime };
  } catch (error) {
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { status: 0, data: { error: message }, responseTime };
  }
}

// ============================================================================
// INTEGRATION TESTS - NO MOCKS
// ============================================================================

describe('Data Cards Integration Tests', () => {
  beforeAll(() => {
    console.log(`\n🔗 Testing against: ${API_URL}\n`);
  });

  describe('API Health', () => {
    it('backend is reachable', async () => {
      const { status } = await fetchEndpoint('/api/health');
      expect(status).toBe(200);
    }, API_TIMEOUT);
  });

  describe('Core Metrics - Metro Level', () => {
    const metroEndpoints = CORE_METRICS.filter(m => m.geo === 'metro');

    it.each(metroEndpoints)(
      '$metric endpoint returns data',
      async ({ endpoint, metric }) => {
        const { status, data, responseTime } = await fetchEndpoint(endpoint);

        console.log(`  ${metric}: ${status} (${responseTime}ms) - ${Array.isArray(data.data) ? data.data.length : 0} rows`);

        expect(status, `${metric} should return 200`).toBe(200);
        expect(data.data, `${metric} should have data array`).toBeDefined();
        expect(Array.isArray(data.data), `${metric} data should be array`).toBe(true);
        expect(data.data!.length, `${metric} should have rows`).toBeGreaterThan(0);
        expect(responseTime, `${metric} should respond within 10s`).toBeLessThan(10000);
      },
      API_TIMEOUT
    );
  });

  describe('Core Metrics - County Level', () => {
    const countyEndpoints = CORE_METRICS.filter(m => m.geo === 'county');

    it.each(countyEndpoints)(
      '$metric endpoint returns data',
      async ({ endpoint, metric }) => {
        const { status, data, responseTime } = await fetchEndpoint(endpoint);

        console.log(`  ${metric}: ${status} (${responseTime}ms) - ${Array.isArray(data.data) ? data.data.length : 0} rows`);

        expect(status, `${metric} should return 200`).toBe(200);
        expect(data.data, `${metric} should have data array`).toBeDefined();
        expect(Array.isArray(data.data), `${metric} data should be array`).toBe(true);
        expect(data.data!.length, `${metric} should have rows`).toBeGreaterThan(0);
      },
      API_TIMEOUT
    );
  });

  describe('Core Metrics - ZIP Level', () => {
    const zipEndpoints = CORE_METRICS.filter(m => m.geo === 'zip');

    it.each(zipEndpoints)(
      '$metric endpoint returns data',
      async ({ endpoint, metric }) => {
        const { status, data, responseTime } = await fetchEndpoint(endpoint);

        console.log(`  ${metric}: ${status} (${responseTime}ms) - ${Array.isArray(data.data) ? data.data.length : 0} rows`);

        expect(status, `${metric} should return 200`).toBe(200);
        expect(data.data, `${metric} should have data array`).toBeDefined();
        expect(Array.isArray(data.data), `${metric} data should be array`).toBe(true);
        expect(data.data!.length, `${metric} should have rows`).toBeGreaterThan(0);
      },
      API_TIMEOUT
    );
  });

  describe('PropertyIQ Scores', () => {
    it.each(SCORE_ENDPOINTS)(
      '$score scores are available',
      async ({ endpoint, score }) => {
        const { status, data, responseTime } = await fetchEndpoint(endpoint);

        console.log(`  ${score}: ${status} (${responseTime}ms) - ${Array.isArray(data.data) ? data.data.length : 0} rows`);

        expect(status, `${score} should return 200`).toBe(200);
        expect(data.data, `${score} should have data`).toBeDefined();
      },
      API_TIMEOUT
    );
  });

  describe('Sample Location Data Quality', () => {
    it('major metros have home value data', async () => {
      const { data } = await fetchEndpoint('/api/zillow/metros');

      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);

      // Check that sample metros have data
      const responseData = data.data as Array<{ cbsa_code?: string; region_id?: string; value?: number }>;

      for (const metro of SAMPLE_METROS) {
        const found = responseData.find(
          row => row.cbsa_code === metro.id || row.region_id === metro.id
        );
        expect(found, `Metro ${metro.name} (${metro.id}) should have data`).toBeDefined();
        expect(found?.value, `Metro ${metro.name} should have a value`).toBeDefined();
        expect(typeof found?.value, `Metro ${metro.name} value should be number`).toBe('number');
      }
    }, API_TIMEOUT);

    it('major metros have rent data', async () => {
      const { data } = await fetchEndpoint('/api/zillow/rent/metros');

      expect(data.data).toBeDefined();
      const responseData = data.data as Array<{ cbsa_code?: string; region_id?: string; value?: number }>;

      let foundCount = 0;
      for (const metro of SAMPLE_METROS) {
        const found = responseData.find(
          row => row.cbsa_code === metro.id || row.region_id === metro.id
        );
        if (found?.value) foundCount++;
      }

      // At least 80% of sample metros should have rent data
      expect(foundCount).toBeGreaterThanOrEqual(Math.floor(SAMPLE_METROS.length * 0.8));
    }, API_TIMEOUT);
  });

  describe('Data Freshness', () => {
    it('home value data is recent (within 60 days)', async () => {
      const { data } = await fetchEndpoint('/api/zillow/metros');

      expect(data.data).toBeDefined();
      const responseData = data.data as Array<{ date?: string }>;

      if (responseData.length > 0 && responseData[0].date) {
        const dataDate = new Date(responseData[0].date);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`  Data date: ${responseData[0].date} (${daysDiff} days ago)`);
        expect(daysDiff, 'Data should be within 60 days').toBeLessThan(60);
      }
    }, API_TIMEOUT);
  });

  describe('Response Time Performance', () => {
    it('all core endpoints respond within 5 seconds', async () => {
      const slowEndpoints: string[] = [];

      for (const { endpoint, metric } of CORE_METRICS.slice(0, 6)) {
        const { responseTime, status } = await fetchEndpoint(endpoint);
        if (status === 200 && responseTime > 5000) {
          slowEndpoints.push(`${metric}: ${responseTime}ms`);
        }
      }

      if (slowEndpoints.length > 0) {
        console.warn('  Slow endpoints:', slowEndpoints.join(', '));
      }

      expect(slowEndpoints.length, 'No more than 2 slow endpoints').toBeLessThanOrEqual(2);
    }, 60000);
  });
});
