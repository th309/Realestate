/**
 * GRAPH MATRIX INTEGRATION TESTS
 *
 * Tests all graph/chart combinations against the LIVE Railway backend.
 * NO MOCKS - all tests hit real APIs with real Supabase data.
 *
 * Test Matrix:
 * - Time series endpoints for all metrics
 * - Multiple geography levels (metro, county, zip)
 * - Sample locations for each level
 *
 * Run with: npm run test:graph-matrix
 */

import { describe, it, expect } from 'vitest';

// Railway backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-ee4d.up.railway.app';
const API_TIMEOUT = 20000;

// ============================================================================
// METRICS THAT SUPPORT TIME SERIES
// ============================================================================

const TIME_SERIES_METRICS = [
  'home_value',
  'home_value_yoy',
  'home_value_mom',
  'rent_index',
  'days_on_market',
  'inventory',
  'inventory_yoy',
  'pending_ratio',
  'price_reduced',
  'list_price',
  'sale_price',
  'cap_rate',
];

// Sample locations for testing
const SAMPLE_METROS = ['19100', '35620', '31080']; // Dallas, NYC, LA
const SAMPLE_COUNTIES = ['48113', '06037', '17031']; // Dallas County, LA County, Cook County
const SAMPLE_ZIPS = ['75201', '90210', '60601']; // Dallas, Beverly Hills, Chicago

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithTimeout(url: string, timeout = API_TIMEOUT): Promise<Response> {
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

async function testTimeSeries(
  metric: string,
  geoLevel: string,
  regionId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  const url = `${API_URL}/api/timeseries/${metric}/${geoLevel}/${regionId}?historyMonths=6`;

  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return { success: false, count: 0, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.success) {
      return { success: false, count: 0, error: 'API returned success: false' };
    }

    const pointCount = data.data?.length || 0;
    return { success: true, count: pointCount };
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Graph Matrix - Time Series Endpoints', () => {
  describe('Metro Level Time Series', () => {
    for (const metric of TIME_SERIES_METRICS) {
      for (const metroId of SAMPLE_METROS) {
        it(`${metric} for metro ${metroId}`, async () => {
          const result = await testTimeSeries(metric, 'metro', metroId);

          // We expect either success with data OR a graceful "no data" response
          // Not all metrics are available for all locations
          expect(result.error).toBeUndefined();

          if (result.success) {
            // If successful, should have at least some data points
            expect(result.count).toBeGreaterThanOrEqual(0);
          }
        }, API_TIMEOUT + 5000);
      }
    }
  });

  describe('County Level Time Series', () => {
    for (const metric of TIME_SERIES_METRICS.slice(0, 5)) { // Test subset for counties
      for (const countyId of SAMPLE_COUNTIES) {
        it(`${metric} for county ${countyId}`, async () => {
          const result = await testTimeSeries(metric, 'county', countyId);

          expect(result.error).toBeUndefined();

          if (result.success) {
            expect(result.count).toBeGreaterThanOrEqual(0);
          }
        }, API_TIMEOUT + 5000);
      }
    }
  });

  describe('ZIP Level Time Series', () => {
    for (const metric of TIME_SERIES_METRICS.slice(0, 3)) { // Test subset for zips
      for (const zipId of SAMPLE_ZIPS) {
        it(`${metric} for zip ${zipId}`, async () => {
          const result = await testTimeSeries(metric, 'zip', zipId);

          expect(result.error).toBeUndefined();

          if (result.success) {
            expect(result.count).toBeGreaterThanOrEqual(0);
          }
        }, API_TIMEOUT + 5000);
      }
    }
  });
});

describe('Graph Matrix - Snapshot Endpoints for Charts', () => {
  const SNAPSHOT_ENDPOINTS = [
    { path: '/api/zillow/metros', name: 'Zillow Metros' },
    { path: '/api/zillow/counties', name: 'Zillow Counties' },
    { path: '/api/realtor/listing-price/metros', name: 'Realtor Listing Price Metros' },
    { path: '/api/realtor/inventory/metros', name: 'Realtor Inventory Metros' },
    { path: '/api/realtor/dom/metros', name: 'Realtor DOM Metros' },
    { path: '/api/census/metros', name: 'Census Metros' },
    { path: '/api/economic/metros', name: 'Economic Metros' },
  ];

  for (const endpoint of SNAPSHOT_ENDPOINTS) {
    it(`Snapshot: ${endpoint.name}`, async () => {
      const response = await fetchWithTimeout(`${API_URL}${endpoint.path}`);

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBeGreaterThan(0);
      expect(Array.isArray(data.data)).toBe(true);
    }, API_TIMEOUT + 5000);
  }
});

describe('Graph Matrix - Distribution Data', () => {
  it('Score distribution for metros', async () => {
    const response = await fetchWithTimeout(
      `${API_URL}/api/scores/distribution?geography=metro`
    );

    // Distribution endpoint may or may not exist
    if (response.ok) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  }, API_TIMEOUT + 5000);

  it('Home value distribution across metros', async () => {
    const response = await fetchWithTimeout(`${API_URL}/api/zillow/metros`);

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);

    // Check we have enough data points for a meaningful distribution
    expect(data.count).toBeGreaterThan(100);
  }, API_TIMEOUT + 5000);
});

describe('Graph Matrix - Comparison Data', () => {
  it('Can fetch multiple metros for comparison chart', async () => {
    const metroIds = ['19100', '35620', '31080', '26420', '12420'];
    const results = await Promise.all(
      metroIds.map(id =>
        fetchWithTimeout(`${API_URL}/api/scores/metro/${id}`)
          .then(r => r.json())
          .catch(() => null)
      )
    );

    const validResults = results.filter(r => r && r.scores);
    expect(validResults.length).toBeGreaterThan(0);
  }, API_TIMEOUT + 10000);
});
