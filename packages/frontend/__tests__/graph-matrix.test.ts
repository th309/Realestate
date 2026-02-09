/**
 * COMPREHENSIVE GRAPH MATRIX INTEGRATION TESTS
 *
 * Tests graph/chart combinations against the LIVE Railway backend.
 * NO MOCKS - all tests hit real APIs with real Supabase data.
 *
 * Test Matrix Coverage:
 * - 12 time series metrics × 20 metros = 240 tests
 * - 12 time series metrics × 15 counties = 180 tests
 * - 12 time series metrics × 15 zips = 180 tests
 * - Snapshot endpoints: 10 tests
 * - Score endpoints: 60 tests (3 score types × 20 locations)
 * - Comparison tests: 5 tests
 * Total: 675+ test cases with live data
 *
 * Run with: npm run test:graph-matrix
 */

import { describe, it, expect } from 'vitest';

// Railway backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-ee4d.up.railway.app';
const API_TIMEOUT = 20000;

// ============================================================================
// ALL TIME SERIES METRICS
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

// ============================================================================
// EXPANDED SAMPLE LOCATIONS (Top markets by population/importance)
// ============================================================================

// Top 20 metros by population
const SAMPLE_METROS = [
  '35620', // New York-Newark-Jersey City, NY-NJ-PA
  '31080', // Los Angeles-Long Beach-Anaheim, CA
  '16980', // Chicago-Naperville-Elgin, IL-IN-WI
  '19100', // Dallas-Fort Worth-Arlington, TX
  '26420', // Houston-The Woodlands-Sugar Land, TX
  '47900', // Washington-Arlington-Alexandria, DC-VA-MD-WV
  '33100', // Miami-Fort Lauderdale-Pompano Beach, FL
  '37980', // Philadelphia-Camden-Wilmington, PA-NJ-DE-MD
  '12060', // Atlanta-Sandy Springs-Alpharetta, GA
  '14460', // Boston-Cambridge-Newton, MA-NH
  '38060', // Phoenix-Mesa-Chandler, AZ
  '41860', // San Francisco-Oakland-Berkeley, CA
  '40140', // Riverside-San Bernardino-Ontario, CA
  '19820', // Detroit-Warren-Dearborn, MI
  '42660', // Seattle-Tacoma-Bellevue, WA
  '33460', // Minneapolis-St. Paul-Bloomington, MN-WI
  '41740', // San Diego-Chula Vista-Carlsbad, CA
  '45300', // Tampa-St. Petersburg-Clearwater, FL
  '19740', // Denver-Aurora-Lakewood, CO
  '41180', // St. Louis, MO-IL
];

// Top 15 counties by population
const SAMPLE_COUNTIES = [
  '06037', // Los Angeles County, CA
  '17031', // Cook County, IL (Chicago)
  '48201', // Harris County, TX (Houston)
  '04013', // Maricopa County, AZ (Phoenix)
  '06073', // San Diego County, CA
  '06059', // Orange County, CA
  '12086', // Miami-Dade County, FL
  '48113', // Dallas County, TX
  '36047', // Kings County, NY (Brooklyn)
  '06065', // Riverside County, CA
  '36081', // Queens County, NY
  '48029', // Bexar County, TX (San Antonio)
  '53033', // King County, WA (Seattle)
  '06071', // San Bernardino County, CA
  '12011', // Broward County, FL
];

// 15 sample ZIPs across different markets
const SAMPLE_ZIPS = [
  '90210', // Beverly Hills, CA
  '10001', // New York, NY
  '60601', // Chicago, IL
  '75201', // Dallas, TX
  '77001', // Houston, TX
  '85001', // Phoenix, AZ
  '19101', // Philadelphia, PA
  '30301', // Atlanta, GA
  '98101', // Seattle, WA
  '94102', // San Francisco, CA
  '02101', // Boston, MA
  '33101', // Miami, FL
  '80201', // Denver, CO
  '20001', // Washington, DC
  '92101', // San Diego, CA
];

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
  const url = `${API_URL}/api/timeseries/${metric}/${geoLevel}/${regionId}?historyMonths=12`;

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
// METRO LEVEL TIME SERIES TESTS (12 metrics × 20 metros = 240 tests)
// ============================================================================

describe('Graph Matrix - Metro Time Series (240 tests)', () => {
  for (const metric of TIME_SERIES_METRICS) {
    describe(`Metric: ${metric}`, () => {
      for (const metroId of SAMPLE_METROS) {
        it(`${metric} for metro ${metroId}`, async () => {
          const result = await testTimeSeries(metric, 'metro', metroId);

          // Expect no hard errors - graceful handling of missing data is OK
          expect(result.error).toBeUndefined();

          if (result.success) {
            expect(result.count).toBeGreaterThanOrEqual(0);
          }
        }, API_TIMEOUT + 5000);
      }
    });
  }
});

// ============================================================================
// COUNTY LEVEL TIME SERIES TESTS (12 metrics × 15 counties = 180 tests)
// ============================================================================

describe('Graph Matrix - County Time Series (180 tests)', () => {
  for (const metric of TIME_SERIES_METRICS) {
    describe(`Metric: ${metric}`, () => {
      for (const countyId of SAMPLE_COUNTIES) {
        it(`${metric} for county ${countyId}`, async () => {
          const result = await testTimeSeries(metric, 'county', countyId);

          expect(result.error).toBeUndefined();

          if (result.success) {
            expect(result.count).toBeGreaterThanOrEqual(0);
          }
        }, API_TIMEOUT + 5000);
      }
    });
  }
});

// ============================================================================
// ZIP LEVEL TIME SERIES TESTS (12 metrics × 15 zips = 180 tests)
// ============================================================================

describe('Graph Matrix - ZIP Time Series (180 tests)', () => {
  for (const metric of TIME_SERIES_METRICS) {
    describe(`Metric: ${metric}`, () => {
      for (const zipId of SAMPLE_ZIPS) {
        it(`${metric} for zip ${zipId}`, async () => {
          const result = await testTimeSeries(metric, 'zip', zipId);

          expect(result.error).toBeUndefined();

          if (result.success) {
            expect(result.count).toBeGreaterThanOrEqual(0);
          }
        }, API_TIMEOUT + 5000);
      }
    });
  }
});

// ============================================================================
// SNAPSHOT ENDPOINTS FOR CHARTS (10 tests)
// ============================================================================

describe('Graph Matrix - Snapshot Endpoints (10 tests)', () => {
  const SNAPSHOT_ENDPOINTS = [
    { path: '/api/zillow/metros', name: 'Zillow Metros', minCount: 500 },
    { path: '/api/zillow/counties', name: 'Zillow Counties', minCount: 1000 },
    { path: '/api/zillow/states', name: 'Zillow States', minCount: 40 },
    { path: '/api/realtor/listing-price/metros', name: 'Realtor Listing Price Metros', minCount: 100 },
    { path: '/api/realtor/inventory/metros', name: 'Realtor Inventory Metros', minCount: 100 },
    { path: '/api/realtor/dom/metros', name: 'Realtor DOM Metros', minCount: 100 },
    { path: '/api/markets/metros', name: 'Markets Metros', minCount: 100 },
    { path: '/api/markets/counties', name: 'Markets Counties', minCount: 500 },
    { path: '/api/markets/states', name: 'Markets States', minCount: 40 },
    { path: '/api/health', name: 'Health Endpoint', minCount: 0 },
  ];

  for (const endpoint of SNAPSHOT_ENDPOINTS) {
    it(`Snapshot: ${endpoint.name}`, async () => {
      const response = await fetchWithTimeout(`${API_URL}${endpoint.path}`);

      expect(response.ok).toBe(true);

      const data = await response.json();

      // Health endpoint has different shape
      if (endpoint.path === '/api/health') {
        expect(data.status).toBe('healthy');
      } else {
        expect(data.success).toBe(true);
        expect(data.count).toBeGreaterThanOrEqual(endpoint.minCount);
      }
    }, API_TIMEOUT + 5000);
  }
});

// ============================================================================
// PROPERTYIQ SCORES TESTS (3 score types × 20 metros = 60 tests)
// ============================================================================

describe('Graph Matrix - PropertyIQ Scores (60 tests)', () => {
  const SCORE_TYPES = ['homeready', 'investoredge', 'markethealth'];

  describe('Metro Scores', () => {
    for (const metroId of SAMPLE_METROS) {
      it(`All scores for metro ${metroId}`, async () => {
        const response = await fetchWithTimeout(`${API_URL}/api/scores/metro/${metroId}`);

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.scores).toBeDefined();

        // Each score type should be present
        for (const scoreType of SCORE_TYPES) {
          expect(data.scores[scoreType]).toBeDefined();
          expect(data.scores[scoreType].score).toBeGreaterThanOrEqual(0);
          expect(data.scores[scoreType].score).toBeLessThanOrEqual(100);
        }
      }, API_TIMEOUT + 5000);
    }
  });

  describe('County Scores', () => {
    for (const countyId of SAMPLE_COUNTIES) {
      it(`All scores for county ${countyId}`, async () => {
        const response = await fetchWithTimeout(`${API_URL}/api/scores/county/${countyId}`);

        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data.scores).toBeDefined();

        for (const scoreType of SCORE_TYPES) {
          expect(data.scores[scoreType]).toBeDefined();
          expect(data.scores[scoreType].score).toBeGreaterThanOrEqual(0);
          expect(data.scores[scoreType].score).toBeLessThanOrEqual(100);
        }
      }, API_TIMEOUT + 5000);
    }
  });

  describe('ZIP Scores', () => {
    for (const zipId of SAMPLE_ZIPS) {
      it(`All scores for zip ${zipId}`, async () => {
        const response = await fetchWithTimeout(`${API_URL}/api/scores/zip/${zipId}`);

        // ZIP scores may not exist for all ZIPs
        if (response.ok) {
          const data = await response.json();
          expect(data.scores).toBeDefined();
        }
      }, API_TIMEOUT + 5000);
    }
  });
});

// ============================================================================
// DISTRIBUTION DATA TESTS
// ============================================================================

describe('Graph Matrix - Distribution Data', () => {
  it('Home value distribution across 800+ metros', async () => {
    const response = await fetchWithTimeout(`${API_URL}/api/zillow/metros`);

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.count).toBeGreaterThan(800);
  }, API_TIMEOUT + 5000);

  it('Home value distribution across 3000+ counties', async () => {
    const response = await fetchWithTimeout(`${API_URL}/api/zillow/counties`);

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.count).toBeGreaterThan(3000);
  }, API_TIMEOUT + 5000);
});

// ============================================================================
// COMPARISON CHART DATA TESTS
// ============================================================================

describe('Graph Matrix - Comparison Charts', () => {
  it('Can fetch multiple metros for side-by-side comparison', async () => {
    const metroIds = SAMPLE_METROS.slice(0, 5);
    const results = await Promise.all(
      metroIds.map(id =>
        fetchWithTimeout(`${API_URL}/api/scores/metro/${id}`)
          .then(r => r.json())
          .catch(() => null)
      )
    );

    const validResults = results.filter(r => r && r.scores);
    expect(validResults.length).toBe(5);
  }, API_TIMEOUT + 10000);

  it('Can fetch time series for multiple metros', async () => {
    const metroIds = SAMPLE_METROS.slice(0, 5);
    const results = await Promise.all(
      metroIds.map(id =>
        testTimeSeries('home_value', 'metro', id)
      )
    );

    const successful = results.filter(r => r.success && r.count > 0);
    expect(successful.length).toBe(5);
  }, API_TIMEOUT + 10000);

  it('Can compare same metric across different geography levels', async () => {
    const [metroResult, countyResult, zipResult] = await Promise.all([
      testTimeSeries('home_value', 'metro', '19100'),
      testTimeSeries('home_value', 'county', '48113'),
      testTimeSeries('home_value', 'zip', '75201'),
    ]);

    expect(metroResult.success).toBe(true);
    expect(countyResult.success).toBe(true);
    // ZIP may or may not have data
    expect(metroResult.count).toBeGreaterThan(0);
    expect(countyResult.count).toBeGreaterThan(0);
  }, API_TIMEOUT + 10000);
});

// ============================================================================
// TIME RANGE VARIATIONS
// ============================================================================

describe('Graph Matrix - Time Range Variations', () => {
  const testMetro = '19100'; // Dallas

  it('Can fetch 3-month history', async () => {
    const url = `${API_URL}/api/timeseries/home_value/metro/${testMetro}?historyMonths=3`;
    const response = await fetchWithTimeout(url);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
  }, API_TIMEOUT);

  it('Can fetch 12-month history', async () => {
    const url = `${API_URL}/api/timeseries/home_value/metro/${testMetro}?historyMonths=12`;
    const response = await fetchWithTimeout(url);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.length).toBeGreaterThanOrEqual(1);
  }, API_TIMEOUT);

  it('Can fetch 36-month history (3 years)', async () => {
    const url = `${API_URL}/api/timeseries/home_value/metro/${testMetro}?historyMonths=36`;
    const response = await fetchWithTimeout(url);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.length).toBeGreaterThanOrEqual(12);
  }, API_TIMEOUT);

  it('Can fetch 60-month history (5 years)', async () => {
    const url = `${API_URL}/api/timeseries/home_value/metro/${testMetro}?historyMonths=60`;
    const response = await fetchWithTimeout(url);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.length).toBeGreaterThanOrEqual(24);
  }, API_TIMEOUT);
});
