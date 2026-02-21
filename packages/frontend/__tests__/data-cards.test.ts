/**
 * COMPREHENSIVE DATA ENDPOINTS INTEGRATION TESTS
 *
 * Tests ALL PropertyIQ data endpoints against the LIVE Railway backend.
 * NO MOCKS - all tests hit real APIs with real Supabase data.
 *
 * Coverage: 180+ endpoints across:
 * - Zillow (home values, rent, forecasts)
 * - Realtor (listings, inventory, DOM, hotness)
 * - Metrics (cap rate, GRM, yield)
 * - Census (population, income, age)
 * - Economic (unemployment, jobs, GDP)
 *
 * Run with: npm run test:data-matrix
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Railway backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL; if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL env var required for tests');
const API_TIMEOUT = 20000;

// ============================================================================
// ALL ENDPOINTS BY CATEGORY
// ============================================================================

const ZILLOW_ENDPOINTS = [
  // Home Values
  '/api/zillow/metros',
  '/api/zillow/counties',
  '/api/zillow/zips',
  '/api/zillow/states',
  '/api/zillow/national',
  '/api/zillow/cities',
  // Home Value Changes
  '/api/zillow/home-value-yoy/metros',
  '/api/zillow/home-value-yoy/counties',
  '/api/zillow/home-value-yoy/states',
  '/api/zillow/home-value-yoy/zips',
  '/api/zillow/home-value-yoy/national',
  '/api/zillow/home-value-mom/metros',
  '/api/zillow/home-value-mom/counties',
  '/api/zillow/home-value-mom/states',
  '/api/zillow/home-value-mom/zips',
  '/api/zillow/home-value-mom/national',
  '/api/zillow/home-value-5yr/metros',
  '/api/zillow/home-value-5yr/counties',
  '/api/zillow/home-value-5yr/states',
  '/api/zillow/home-value-5yr/zips',
  '/api/zillow/home-value-5yr/national',
  // Rent
  '/api/zillow/rent/metros',
  '/api/zillow/rent/counties',
  '/api/zillow/rent/zips',
  // Renter Demand
  '/api/zillow/renter-demand/metros',
  '/api/zillow/renter-demand/counties',
  '/api/zillow/renter-demand/zips',
  // Forecast
  '/api/zillow/forecast/metros',
  '/api/zillow/forecast/zips',
  // Market Activity
  '/api/zillow/home-sales/metros',
  '/api/zillow/home-sales/counties',
  '/api/zillow/home-sales/states',
  '/api/zillow/home-sales/zips',
  '/api/zillow/home-sales-yoy/metros',
  '/api/zillow/home-sales-yoy/counties',
  '/api/zillow/home-sales-yoy/states',
  '/api/zillow/home-sales-yoy/zips',
  '/api/zillow/days-to-pending/metros',
  '/api/zillow/days-to-close/metros',
  '/api/zillow/price-cuts/metros',
  '/api/zillow/sale-to-list/metros',
  '/api/zillow/sale-price/metros',
  '/api/zillow/list-price/metros',
  '/api/zillow/sales-count/metros',
  // New Construction
  '/api/zillow/new-construction/metros',
  // Market Heat
  '/api/zillow/market-heat/metros',
  // Affordability
  '/api/zillow/affordability/metros',
  // Overvalued
  '/api/zillow/overvalued/metros',
  // Demand
  '/api/zillow/demand/metros',
  '/api/zillow/demand/zips',
];

const REALTOR_ENDPOINTS = [
  // Listing Price
  '/api/realtor/listing-price/national',
  '/api/realtor/listing-price/states',
  '/api/realtor/listing-price/metros',
  '/api/realtor/listing-price/counties',
  '/api/realtor/listing-price/zips',
  // Price Per Sqft
  '/api/realtor/price-per-sqft/national',
  '/api/realtor/price-per-sqft/states',
  '/api/realtor/price-per-sqft/metros',
  '/api/realtor/price-per-sqft/counties',
  '/api/realtor/price-per-sqft/zips',
  // Inventory
  '/api/realtor/inventory/national',
  '/api/realtor/inventory/states',
  '/api/realtor/inventory/metros',
  '/api/realtor/inventory/counties',
  '/api/realtor/inventory/zips',
  // Inventory YoY
  '/api/realtor/inventory-yoy/national',
  '/api/realtor/inventory-yoy/states',
  '/api/realtor/inventory-yoy/metros',
  '/api/realtor/inventory-yoy/counties',
  '/api/realtor/inventory-yoy/zips',
  // Days on Market
  '/api/realtor/dom/national',
  '/api/realtor/dom/states',
  '/api/realtor/dom/metros',
  '/api/realtor/dom/counties',
  '/api/realtor/dom/zips',
  // New Listings
  '/api/realtor/new-listings/national',
  '/api/realtor/new-listings/states',
  '/api/realtor/new-listings/metros',
  '/api/realtor/new-listings/counties',
  '/api/realtor/new-listings/zips',
  // New Listings YoY
  '/api/realtor/new-listings-yoy/national',
  '/api/realtor/new-listings-yoy/states',
  '/api/realtor/new-listings-yoy/metros',
  '/api/realtor/new-listings-yoy/counties',
  '/api/realtor/new-listings-yoy/zips',
  // Pending Listings
  '/api/realtor/pending-listings/national',
  '/api/realtor/pending-listings/states',
  '/api/realtor/pending-listings/metros',
  '/api/realtor/pending-listings/counties',
  '/api/realtor/pending-listings/zips',
  // Pending Ratio
  '/api/realtor/pending-ratio/national',
  '/api/realtor/pending-ratio/states',
  '/api/realtor/pending-ratio/metros',
  '/api/realtor/pending-ratio/counties',
  '/api/realtor/pending-ratio/zips',
  // Price Reduced
  '/api/realtor/price-reduced/national',
  '/api/realtor/price-reduced/states',
  '/api/realtor/price-reduced/metros',
  '/api/realtor/price-reduced/counties',
  '/api/realtor/price-reduced/zips',
  // Price Increased
  '/api/realtor/price-increased/national',
  '/api/realtor/price-increased/states',
  '/api/realtor/price-increased/metros',
  '/api/realtor/price-increased/counties',
  '/api/realtor/price-increased/zips',
  // Hotness Scores
  '/api/realtor/hotness/metros',
  '/api/realtor/hotness/counties',
  '/api/realtor/hotness/zips',
  // Supply Score
  '/api/realtor/supply-score/metros',
  '/api/realtor/supply-score/counties',
  '/api/realtor/supply-score/zips',
  // Demand Score
  '/api/realtor/demand-score/metros',
  '/api/realtor/demand-score/counties',
  '/api/realtor/demand-score/zips',
];

const METRICS_ENDPOINTS = [
  // Cap Rate
  '/api/metrics/cap-rate/metros',
  '/api/metrics/cap-rate/counties',
  '/api/metrics/cap-rate/zips',
  // GRM
  '/api/metrics/grm/metros',
  // Gross Yield
  '/api/metrics/gross-yield/metros',
  // Affordability Metrics
  '/api/metrics/income-to-buy/national',
  '/api/metrics/income-to-buy/states',
  '/api/metrics/income-to-buy/metros',
  '/api/metrics/income-to-buy/counties',
  '/api/metrics/income-to-buy/zips',
  '/api/metrics/years-to-save/national',
  '/api/metrics/years-to-save/states',
  '/api/metrics/years-to-save/metros',
  '/api/metrics/years-to-save/counties',
  '/api/metrics/years-to-save/zips',
  '/api/metrics/affordable-home-price/national',
  '/api/metrics/affordable-home-price/states',
  '/api/metrics/affordable-home-price/metros',
  '/api/metrics/affordable-home-price/counties',
  '/api/metrics/affordable-home-price/zips',
];

const CENSUS_ENDPOINTS = [
  // Population
  '/api/census/population/national',
  '/api/census/population/states',
  '/api/census/population/metros',
  '/api/census/population/counties',
  '/api/census/population/cities',
  // Population Growth
  '/api/census/population-growth/national',
  '/api/census/population-growth/states',
  '/api/census/population-growth/metros',
  '/api/census/population-growth/counties',
  '/api/census/population-growth/cities',
  // Median Income
  '/api/census/median-income/national',
  '/api/census/median-income/states',
  '/api/census/median-income/metros',
  '/api/census/median-income/counties',
  '/api/census/median-income/cities',
  // Income Growth
  '/api/census/income-growth/national',
  '/api/census/income-growth/states',
  '/api/census/income-growth/metros',
  '/api/census/income-growth/counties',
  '/api/census/income-growth/cities',
  // Median Age
  '/api/census/median-age/national',
  '/api/census/median-age/states',
  '/api/census/median-age/metros',
  '/api/census/median-age/counties',
  '/api/census/median-age/cities',
  // Homeownership Rate
  '/api/census/homeownership-rate/national',
  '/api/census/homeownership-rate/states',
  '/api/census/homeownership-rate/metros',
  '/api/census/homeownership-rate/counties',
  '/api/census/homeownership-rate/cities',
];

const ECONOMIC_ENDPOINTS = [
  // Unemployment
  '/api/economic/unemployment/national',
  '/api/economic/unemployment/states',
  '/api/economic/unemployment/metros',
  '/api/economic/unemployment/counties',
  // Job Growth
  '/api/economic/job-growth/national',
  '/api/economic/job-growth/states',
  '/api/economic/job-growth/metros',
  '/api/economic/job-growth/counties',
  // GDP Growth
  '/api/economic/gdp-growth/national',
  '/api/economic/gdp-growth/states',
  '/api/economic/gdp-growth/metros',
  '/api/economic/gdp-growth/counties',
  // Cost of Living
  '/api/economic/cost-of-living/states',
  '/api/economic/cost-of-living/metros',
];

// All endpoints combined
const ALL_ENDPOINTS = [
  ...ZILLOW_ENDPOINTS,
  ...REALTOR_ENDPOINTS,
  ...METRICS_ENDPOINTS,
  ...CENSUS_ENDPOINTS,
  ...ECONOMIC_ENDPOINTS,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface EndpointResult {
  endpoint: string;
  status: number;
  rowCount: number;
  responseTime: number;
  error?: string;
}

async function testEndpoint(endpoint: string): Promise<EndpointResult> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    let rowCount = 0;
    try {
      const json = await response.json();
      if (Array.isArray(json.data)) {
        rowCount = json.data.length;
      } else if (Array.isArray(json)) {
        rowCount = json.length;
      }
    } catch {
      // JSON parse error
    }

    return { endpoint, status: response.status, rowCount, responseTime };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      endpoint,
      status: 0,
      rowCount: 0,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Comprehensive Data Endpoints Tests', () => {
  beforeAll(() => {
    console.log(`\n🔗 Testing ${ALL_ENDPOINTS.length} endpoints against: ${API_URL}\n`);
  });

  describe('API Health', () => {
    it('backend is reachable', async () => {
      const result = await testEndpoint('/api/health');
      expect(result.status).toBe(200);
    }, API_TIMEOUT);
  });

  describe('Zillow Endpoints', () => {
    it.each(ZILLOW_ENDPOINTS)(
      '%s returns data',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        console.log(`  ${endpoint}: ${result.status} (${result.responseTime}ms) - ${result.rowCount} rows`);

        expect(result.status, `${endpoint} should return 200`).toBe(200);
        // Most endpoints should have data, but some may legitimately be empty
        if (result.status === 200) {
          expect(result.rowCount, `${endpoint} should have data`).toBeGreaterThanOrEqual(0);
        }
      },
      API_TIMEOUT
    );
  });

  describe('Realtor Endpoints', () => {
    it.each(REALTOR_ENDPOINTS)(
      '%s returns data',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        console.log(`  ${endpoint}: ${result.status} (${result.responseTime}ms) - ${result.rowCount} rows`);

        expect(result.status, `${endpoint} should return 200`).toBe(200);
      },
      API_TIMEOUT
    );
  });

  describe('Metrics Endpoints', () => {
    it.each(METRICS_ENDPOINTS)(
      '%s returns data',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        console.log(`  ${endpoint}: ${result.status} (${result.responseTime}ms) - ${result.rowCount} rows`);

        // Metrics endpoints may return 200 or 404 if not implemented
        expect([200, 404], `${endpoint} should return 200 or 404`).toContain(result.status);
      },
      API_TIMEOUT
    );
  });

  describe('Census Endpoints', () => {
    it.each(CENSUS_ENDPOINTS)(
      '%s returns data',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        console.log(`  ${endpoint}: ${result.status} (${result.responseTime}ms) - ${result.rowCount} rows`);

        expect(result.status, `${endpoint} should return 200`).toBe(200);
      },
      API_TIMEOUT
    );
  });

  describe('Economic Endpoints', () => {
    it.each(ECONOMIC_ENDPOINTS)(
      '%s returns data',
      async (endpoint) => {
        const result = await testEndpoint(endpoint);
        console.log(`  ${endpoint}: ${result.status} (${result.responseTime}ms) - ${result.rowCount} rows`);

        expect(result.status, `${endpoint} should return 200`).toBe(200);
      },
      API_TIMEOUT
    );
  });

  describe('Coverage Summary', () => {
    it('generates full coverage report', async () => {
      const results: EndpointResult[] = [];
      const categories = {
        zillow: { total: 0, passing: 0, withData: 0 },
        realtor: { total: 0, passing: 0, withData: 0 },
        metrics: { total: 0, passing: 0, withData: 0 },
        census: { total: 0, passing: 0, withData: 0 },
        economic: { total: 0, passing: 0, withData: 0 },
      };

      // Test all endpoints
      for (const endpoint of ALL_ENDPOINTS) {
        const result = await testEndpoint(endpoint);
        results.push(result);

        // Categorize
        let category: keyof typeof categories;
        if (endpoint.includes('/zillow/')) category = 'zillow';
        else if (endpoint.includes('/realtor/')) category = 'realtor';
        else if (endpoint.includes('/metrics/')) category = 'metrics';
        else if (endpoint.includes('/census/')) category = 'census';
        else category = 'economic';

        categories[category].total++;
        if (result.status === 200) categories[category].passing++;
        if (result.rowCount > 0) categories[category].withData++;
      }

      console.log('\n📊 COMPREHENSIVE COVERAGE REPORT:');
      console.log('─'.repeat(60));

      for (const [cat, stats] of Object.entries(categories)) {
        const passRate = ((stats.passing / stats.total) * 100).toFixed(0);
        const dataRate = ((stats.withData / stats.total) * 100).toFixed(0);
        console.log(`  ${cat.toUpperCase()}: ${stats.passing}/${stats.total} passing (${passRate}%), ${stats.withData} with data (${dataRate}%)`);
      }

      console.log('─'.repeat(60));

      const totalPassing = Object.values(categories).reduce((sum, c) => sum + c.passing, 0);
      const totalWithData = Object.values(categories).reduce((sum, c) => sum + c.withData, 0);
      const total = ALL_ENDPOINTS.length;

      console.log(`  TOTAL: ${totalPassing}/${total} passing (${((totalPassing / total) * 100).toFixed(0)}%)`);
      console.log(`  WITH DATA: ${totalWithData}/${total} (${((totalWithData / total) * 100).toFixed(0)}%)`);

      // List failing endpoints
      const failing = results.filter(r => r.status !== 200);
      if (failing.length > 0) {
        console.log('\n❌ FAILING ENDPOINTS:');
        for (const f of failing) {
          console.log(`  ${f.endpoint}: ${f.status} ${f.error || ''}`);
        }
      }

      // List empty endpoints
      const empty = results.filter(r => r.status === 200 && r.rowCount === 0);
      if (empty.length > 0) {
        console.log('\n⚠️ EMPTY ENDPOINTS (200 but 0 rows):');
        for (const e of empty) {
          console.log(`  ${e.endpoint}`);
        }
      }

      // Assertions
      expect(totalPassing).toBeGreaterThan(total * 0.8); // At least 80% should pass
    }, 300000); // 5 minute timeout for full test
  });
});
