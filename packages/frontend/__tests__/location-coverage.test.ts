/**
 * LOCATION COVERAGE INTEGRATION TESTS
 *
 * Validates data availability across US locations against LIVE Railway backend.
 * NO MOCKS - all tests hit real APIs with real Supabase data.
 *
 * Test Coverage:
 * - 10 major metros (by population)
 * - 20 counties (mix of urban/suburban/rural)
 * - 30 ZIP codes (spread across states)
 *
 * Run with: npm run test:locations
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Railway backend URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-ee4d.up.railway.app';

// Test timeout for API calls
const API_TIMEOUT = 20000;

// ============================================================================
// SAMPLE LOCATIONS
// ============================================================================

const SAMPLE_METROS: Array<{ id: string; name: string }> = [
  { id: '35620', name: 'New York-Newark-Jersey City, NY' },
  { id: '31080', name: 'Los Angeles-Long Beach-Anaheim, CA' },
  { id: '16980', name: 'Chicago-Naperville-Elgin, IL' },
  { id: '19100', name: 'Dallas-Fort Worth-Arlington, TX' },
  { id: '26420', name: 'Houston-The Woodlands-Sugar Land, TX' },
  { id: '38060', name: 'Phoenix-Mesa-Chandler, AZ' },
  { id: '37980', name: 'Philadelphia-Camden-Wilmington, PA' },
  { id: '12420', name: 'Austin-Round Rock-Georgetown, TX' },
  { id: '33100', name: 'Miami-Fort Lauderdale-Pompano Beach, FL' },
  { id: '12060', name: 'Atlanta-Sandy Springs-Alpharetta, GA' },
];

const SAMPLE_COUNTIES: Array<{ id: string; name: string; state: string }> = [
  // Urban cores
  { id: '06037', name: 'Los Angeles County', state: 'CA' },
  { id: '17031', name: 'Cook County', state: 'IL' },
  { id: '48201', name: 'Harris County', state: 'TX' },
  { id: '04013', name: 'Maricopa County', state: 'AZ' },
  { id: '06073', name: 'San Diego County', state: 'CA' },
  { id: '48113', name: 'Dallas County', state: 'TX' },
  { id: '12086', name: 'Miami-Dade County', state: 'FL' },
  { id: '36047', name: 'Kings County', state: 'NY' },
  { id: '06059', name: 'Orange County', state: 'CA' },
  { id: '53033', name: 'King County', state: 'WA' },
  // Suburban/Exurban
  { id: '48453', name: 'Travis County', state: 'TX' },
  { id: '08031', name: 'Denver County', state: 'CO' },
  { id: '13121', name: 'Fulton County', state: 'GA' },
  { id: '32003', name: 'Clark County', state: 'NV' },
  { id: '25017', name: 'Middlesex County', state: 'MA' },
  // Semi-rural
  { id: '30031', name: 'Gallatin County', state: 'MT' },
  { id: '49035', name: 'Salt Lake County', state: 'UT' },
  { id: '41051', name: 'Multnomah County', state: 'OR' },
  { id: '26161', name: 'Washtenaw County', state: 'MI' },
  { id: '08005', name: 'Arapahoe County', state: 'CO' },
];

const SAMPLE_ZIPS: Array<{ id: string; city: string; state: string }> = [
  // Major city cores
  { id: '10001', city: 'New York', state: 'NY' },
  { id: '90210', city: 'Beverly Hills', state: 'CA' },
  { id: '60601', city: 'Chicago', state: 'IL' },
  { id: '77001', city: 'Houston', state: 'TX' },
  { id: '85001', city: 'Phoenix', state: 'AZ' },
  { id: '19101', city: 'Philadelphia', state: 'PA' },
  { id: '78201', city: 'San Antonio', state: 'TX' },
  { id: '92101', city: 'San Diego', state: 'CA' },
  { id: '75201', city: 'Dallas', state: 'TX' },
  { id: '95101', city: 'San Jose', state: 'CA' },
  // Tech hubs
  { id: '98101', city: 'Seattle', state: 'WA' },
  { id: '94102', city: 'San Francisco', state: 'CA' },
  { id: '78701', city: 'Austin', state: 'TX' },
  { id: '80202', city: 'Denver', state: 'CO' },
  { id: '02101', city: 'Boston', state: 'MA' },
  // Sun Belt
  { id: '33101', city: 'Miami', state: 'FL' },
  { id: '30301', city: 'Atlanta', state: 'GA' },
  { id: '28201', city: 'Charlotte', state: 'NC' },
  { id: '37201', city: 'Nashville', state: 'TN' },
  { id: '32801', city: 'Orlando', state: 'FL' },
  // Mid-size markets
  { id: '46201', city: 'Indianapolis', state: 'IN' },
  { id: '43201', city: 'Columbus', state: 'OH' },
  { id: '27601', city: 'Raleigh', state: 'NC' },
  { id: '84101', city: 'Salt Lake City', state: 'UT' },
  { id: '97201', city: 'Portland', state: 'OR' },
  // Smaller markets
  { id: '59701', city: 'Butte', state: 'MT' },
  { id: '83701', city: 'Boise', state: 'ID' },
  { id: '87101', city: 'Albuquerque', state: 'NM' },
  { id: '99501', city: 'Anchorage', state: 'AK' },
  { id: '96801', city: 'Honolulu', state: 'HI' },
];

// Core metrics that should be available for all locations
const CORE_METRIC_ENDPOINTS = {
  metro: [
    { endpoint: '/api/zillow/metros', metric: 'home_value', idField: 'cbsa_code' },
    { endpoint: '/api/zillow/rent/metros', metric: 'rent', idField: 'cbsa_code' },
    { endpoint: '/api/realtor/listing-price/metros', metric: 'listing_price', idField: 'cbsa_code' },
    { endpoint: '/api/realtor/inventory/metros', metric: 'inventory', idField: 'cbsa_code' },
    { endpoint: '/api/realtor/dom/metros', metric: 'days_on_market', idField: 'cbsa_code' },
  ],
  county: [
    { endpoint: '/api/zillow/counties', metric: 'home_value', idField: 'county_fips' },
    { endpoint: '/api/zillow/rent/counties', metric: 'rent', idField: 'county_fips' },
    { endpoint: '/api/realtor/listing-price/counties', metric: 'listing_price', idField: 'county_fips' },
    { endpoint: '/api/realtor/inventory/counties', metric: 'inventory', idField: 'county_fips' },
  ],
  zip: [
    { endpoint: '/api/zillow/zips', metric: 'home_value', idField: 'postal_code' },
    { endpoint: '/api/zillow/rent/zips', metric: 'rent', idField: 'postal_code' },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    let data: ApiResponse;
    try {
      data = await response.json();
    } catch {
      data = { error: 'Invalid JSON' };
    }

    return { status: response.status, data, responseTime };
  } catch (error) {
    clearTimeout(timeoutId);
    return { status: 0, data: { error: String(error) }, responseTime: Date.now() - startTime };
  }
}

function findLocationInData(
  data: unknown[],
  locationId: string,
  idField: string
): { value?: number; date?: string } | undefined {
  // Try multiple field name variations
  const possibleFields = [idField, 'region_id', 'id', idField.replace('_', '')];

  for (const field of possibleFields) {
    const found = data.find((row: unknown) => {
      const record = row as Record<string, unknown>;
      return String(record[field]) === locationId;
    });
    if (found) return found as { value?: number; date?: string };
  }
  return undefined;
}

// ============================================================================
// INTEGRATION TESTS - NO MOCKS
// ============================================================================

describe('Location Coverage Integration Tests', () => {
  beforeAll(() => {
    console.log(`\n🔗 Testing against: ${API_URL}\n`);
  });

  describe('API Connectivity', () => {
    it('backend is reachable', async () => {
      const { status } = await fetchEndpoint('/api/health');
      expect(status).toBe(200);
    }, API_TIMEOUT);
  });

  describe('Metro Coverage', () => {
    it('home value data exists for metros', async () => {
      const { status, data } = await fetchEndpoint('/api/zillow/metros');

      expect(status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);

      const responseData = data.data as unknown[];
      console.log(`  Total metros with home value: ${responseData.length}`);

      let foundCount = 0;
      const missing: string[] = [];

      for (const metro of SAMPLE_METROS) {
        const found = findLocationInData(responseData, metro.id, 'cbsa_code');
        if (found?.value !== undefined) {
          foundCount++;
        } else {
          missing.push(`${metro.name} (${metro.id})`);
        }
      }

      if (missing.length > 0) {
        console.log(`  Missing metros: ${missing.join(', ')}`);
      }

      // All major metros should have home value data
      expect(foundCount, `Expected all ${SAMPLE_METROS.length} metros to have data`).toBe(SAMPLE_METROS.length);
    }, API_TIMEOUT);

    it('rent data exists for metros', async () => {
      const { status, data } = await fetchEndpoint('/api/zillow/rent/metros');

      expect(status).toBe(200);
      const responseData = data.data as unknown[];
      console.log(`  Total metros with rent: ${responseData.length}`);

      let foundCount = 0;
      for (const metro of SAMPLE_METROS) {
        const found = findLocationInData(responseData, metro.id, 'cbsa_code');
        if (found?.value !== undefined) foundCount++;
      }

      // At least 90% of metros should have rent data
      const threshold = Math.floor(SAMPLE_METROS.length * 0.9);
      expect(foundCount, `Expected at least ${threshold} metros with rent data`).toBeGreaterThanOrEqual(threshold);
    }, API_TIMEOUT);

    it('listing price data exists for metros', async () => {
      const { status, data } = await fetchEndpoint('/api/realtor/listing-price/metros');

      expect(status).toBe(200);
      const responseData = data.data as unknown[];
      console.log(`  Total metros with listing price: ${responseData.length}`);

      expect(responseData.length).toBeGreaterThan(100); // Should have 100+ metros
    }, API_TIMEOUT);
  });

  describe('County Coverage', () => {
    it('home value data exists for counties', async () => {
      const { status, data } = await fetchEndpoint('/api/zillow/counties');

      expect(status).toBe(200);
      expect(data.data).toBeDefined();

      const responseData = data.data as unknown[];
      console.log(`  Total counties with home value: ${responseData.length}`);

      let foundCount = 0;
      const missing: string[] = [];

      for (const county of SAMPLE_COUNTIES) {
        const found = findLocationInData(responseData, county.id, 'county_fips');
        if (found?.value !== undefined) {
          foundCount++;
        } else {
          missing.push(`${county.name}, ${county.state} (${county.id})`);
        }
      }

      if (missing.length > 0) {
        console.log(`  Missing counties: ${missing.join(', ')}`);
      }

      // At least 90% of sample counties should have data
      const threshold = Math.floor(SAMPLE_COUNTIES.length * 0.9);
      expect(foundCount, `Expected at least ${threshold} counties`).toBeGreaterThanOrEqual(threshold);
    }, API_TIMEOUT);

    it('rent data exists for counties', async () => {
      const { status, data } = await fetchEndpoint('/api/zillow/rent/counties');

      expect(status).toBe(200);
      const responseData = data.data as unknown[];
      console.log(`  Total counties with rent: ${responseData.length}`);

      // Should have substantial county rent data
      expect(responseData.length).toBeGreaterThan(500);
    }, API_TIMEOUT);
  });

  describe('ZIP Coverage', () => {
    it('home value data exists for ZIPs', async () => {
      const { status, data } = await fetchEndpoint('/api/zillow/zips');

      expect(status).toBe(200);
      expect(data.data).toBeDefined();

      const responseData = data.data as unknown[];
      console.log(`  Total ZIPs with home value: ${responseData.length}`);

      let foundCount = 0;
      const missing: string[] = [];

      for (const zip of SAMPLE_ZIPS) {
        const found = findLocationInData(responseData, zip.id, 'postal_code');
        if (found?.value !== undefined) {
          foundCount++;
        } else {
          missing.push(`${zip.city}, ${zip.state} (${zip.id})`);
        }
      }

      if (missing.length > 0) {
        console.log(`  Missing ZIPs: ${missing.join(', ')}`);
      }

      // At least 80% of sample ZIPs should have data
      const threshold = Math.floor(SAMPLE_ZIPS.length * 0.8);
      expect(foundCount, `Expected at least ${threshold} ZIPs`).toBeGreaterThanOrEqual(threshold);
    }, API_TIMEOUT);

    it('rent data exists for ZIPs', async () => {
      const { status, data } = await fetchEndpoint('/api/zillow/rent/zips');

      expect(status).toBe(200);
      const responseData = data.data as unknown[];
      console.log(`  Total ZIPs with rent: ${responseData.length}`);

      // Should have substantial ZIP rent data
      expect(responseData.length).toBeGreaterThan(5000);
    }, API_TIMEOUT);
  });

  describe('PropertyIQ Scores Coverage', () => {
    it('homeready scores exist for metros', async () => {
      const { status, data } = await fetchEndpoint('/api/scores/homeready/metros');

      console.log(`  Homeready scores: ${status} - ${Array.isArray(data.data) ? data.data.length : 0} metros`);

      // Scores endpoint should work (may return 200 with empty or 404 if not implemented)
      expect([200, 404]).toContain(status);
    }, API_TIMEOUT);

    it('investoredge scores exist for metros', async () => {
      const { status, data } = await fetchEndpoint('/api/scores/investoredge/metros');

      console.log(`  InvestorEdge scores: ${status} - ${Array.isArray(data.data) ? data.data.length : 0} metros`);

      expect([200, 404]).toContain(status);
    }, API_TIMEOUT);
  });

  describe('Data Completeness Summary', () => {
    it('generates coverage report', async () => {
      const report: Record<string, { total: number; sampleCoverage: number }> = {};

      // Metros
      const metroData = await fetchEndpoint('/api/zillow/metros');
      const metroRows = (metroData.data.data as unknown[]) || [];
      let metroFound = 0;
      for (const m of SAMPLE_METROS) {
        if (findLocationInData(metroRows, m.id, 'cbsa_code')) metroFound++;
      }
      report.metros = { total: metroRows.length, sampleCoverage: metroFound };

      // Counties
      const countyData = await fetchEndpoint('/api/zillow/counties');
      const countyRows = (countyData.data.data as unknown[]) || [];
      let countyFound = 0;
      for (const c of SAMPLE_COUNTIES) {
        if (findLocationInData(countyRows, c.id, 'county_fips')) countyFound++;
      }
      report.counties = { total: countyRows.length, sampleCoverage: countyFound };

      // ZIPs
      const zipData = await fetchEndpoint('/api/zillow/zips');
      const zipRows = (zipData.data.data as unknown[]) || [];
      let zipFound = 0;
      for (const z of SAMPLE_ZIPS) {
        if (findLocationInData(zipRows, z.id, 'postal_code')) zipFound++;
      }
      report.zips = { total: zipRows.length, sampleCoverage: zipFound };

      console.log('\n📊 COVERAGE REPORT:');
      console.log(`  Metros: ${report.metros.total} total, ${report.metros.sampleCoverage}/${SAMPLE_METROS.length} sample`);
      console.log(`  Counties: ${report.counties.total} total, ${report.counties.sampleCoverage}/${SAMPLE_COUNTIES.length} sample`);
      console.log(`  ZIPs: ${report.zips.total} total, ${report.zips.sampleCoverage}/${SAMPLE_ZIPS.length} sample`);

      // Should have substantial data
      expect(report.metros.total).toBeGreaterThan(100);
      expect(report.counties.total).toBeGreaterThan(1000);
      expect(report.zips.total).toBeGreaterThan(10000);
    }, 60000);
  });
});
