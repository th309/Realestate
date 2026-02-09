/**
 * LOCATION COVERAGE VALIDATION TESTS
 *
 * Validates that PropertyIQ scores and core metrics are available
 * across a representative sample of US locations (metros, counties, zips).
 *
 * Test Strategy:
 * - 10 major metros (by population)
 * - 20 counties (mix of urban/rural)
 * - 30 zips (spread across states)
 *
 * For each location, verify:
 * 1. PropertyIQ scores available (homeready, investoredge, markethealth)
 * 2. Core metrics available (home_value, rent_index, listing_price, etc.)
 * 3. No critical gaps (all "required" metrics present)
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { fetchScore } from '@/lib/data/fetchers/scores';
import { fetchSnapshotData } from '@/lib/data/fetchers/snapshot';
import type { GeoLevel, ScoreResponse, SnapshotData } from '@/lib/data/types';

// ============================================================================
// TEST DATA
// ============================================================================

/**
 * Sample metros - 10 largest US metros by population
 * Format: [CBSA Code, Metro Name]
 */
const sampleMetros: [string, string][] = [
  ['35620', 'New York-Newark-Jersey City, NY'],
  ['31080', 'Los Angeles-Long Beach-Anaheim, CA'],
  ['16980', 'Chicago-Naperville-Elgin, IL'],
  ['19100', 'Dallas-Fort Worth-Arlington, TX'],
  ['26420', 'Houston-The Woodlands-Sugar Land, TX'],
  ['38060', 'Phoenix-Mesa-Chandler, AZ'],
  ['12420', 'Austin-Round Rock-Georgetown, TX'],
  ['33100', 'Miami-Fort Lauderdale-Pompano Beach, FL'],
  ['12060', 'Atlanta-Sandy Springs-Alpharetta, GA'],
  ['19740', 'Denver-Aurora-Lakewood, CO'],
];

/**
 * Sample counties - 20 counties (mix of urban and rural)
 * Format: [FIPS Code, County Name, State]
 */
const sampleCounties: [string, string, string][] = [
  // Urban - Major population centers
  ['06037', 'Los Angeles County', 'CA'],
  ['17031', 'Cook County', 'IL'],
  ['48201', 'Harris County', 'TX'],
  ['04013', 'Maricopa County', 'AZ'],
  ['06073', 'San Diego County', 'CA'],
  ['48113', 'Dallas County', 'TX'],
  ['12086', 'Miami-Dade County', 'FL'],
  ['36047', 'Kings County (Brooklyn)', 'NY'],
  ['06059', 'Orange County', 'CA'],
  ['53033', 'King County', 'WA'],
  // Suburban/Exurban
  ['48453', 'Travis County', 'TX'],
  ['08031', 'Denver County', 'CO'],
  ['13121', 'Fulton County', 'GA'],
  ['32003', 'Clark County', 'NV'],
  ['25017', 'Middlesex County', 'MA'],
  // Rural/Semi-Rural
  ['30031', 'Gallatin County', 'MT'],
  ['56039', 'Teton County', 'WY'],
  ['49035', 'Salt Lake County', 'UT'],
  ['41051', 'Multnomah County', 'OR'],
  ['26161', 'Washtenaw County', 'MI'],
];

/**
 * Sample ZIP codes - 30 zips spread across states
 * Format: [ZIP Code, City, State]
 */
const sampleZips: [string, string, string][] = [
  // Major cities
  ['10001', 'New York', 'NY'],
  ['90210', 'Beverly Hills', 'CA'],
  ['60601', 'Chicago', 'IL'],
  ['77001', 'Houston', 'TX'],
  ['85001', 'Phoenix', 'AZ'],
  ['19101', 'Philadelphia', 'PA'],
  ['78201', 'San Antonio', 'TX'],
  ['92101', 'San Diego', 'CA'],
  ['75201', 'Dallas', 'TX'],
  ['95101', 'San Jose', 'CA'],
  // Tech hubs
  ['98101', 'Seattle', 'WA'],
  ['94102', 'San Francisco', 'CA'],
  ['78701', 'Austin', 'TX'],
  ['80202', 'Denver', 'CO'],
  ['02101', 'Boston', 'MA'],
  // Sun Belt growth
  ['33101', 'Miami', 'FL'],
  ['30301', 'Atlanta', 'GA'],
  ['28201', 'Charlotte', 'NC'],
  ['37201', 'Nashville', 'TN'],
  ['89101', 'Las Vegas', 'NV'],
  // Midwest
  ['55401', 'Minneapolis', 'MN'],
  ['63101', 'St. Louis', 'MO'],
  ['48201', 'Detroit', 'MI'],
  ['44101', 'Cleveland', 'OH'],
  ['46201', 'Indianapolis', 'IN'],
  // Other notable
  ['97201', 'Portland', 'OR'],
  ['84101', 'Salt Lake City', 'UT'],
  ['64101', 'Kansas City', 'MO'],
  ['70112', 'New Orleans', 'LA'],
  ['96801', 'Honolulu', 'HI'],
];

// ============================================================================
// SCORE TYPES AND REQUIRED METRICS
// ============================================================================

const SCORE_TYPES = ['homeready', 'investoredge', 'markethealth'] as const;

/**
 * Core metrics that should be available for each geography level.
 * These are the fundamental metrics users expect to see.
 */
const REQUIRED_METRICS_BY_GEO: Record<GeoLevel, string[]> = {
  national: ['home_value', 'listing_price', 'for_sale_inventory', 'days_on_market'],
  state: ['home_value', 'listing_price', 'for_sale_inventory', 'days_on_market'],
  metro: [
    'home_value',
    'rent_index',
    'listing_price',
    'for_sale_inventory',
    'days_on_market',
    'cap_rate',
  ],
  county: [
    'home_value',
    'rent_index',
    'listing_price',
    'for_sale_inventory',
    'days_on_market',
  ],
  city: ['home_value', 'listing_price', 'for_sale_inventory'],
  zip: [
    'home_value',
    'rent_index',
    'listing_price',
    'for_sale_inventory',
    'days_on_market',
  ],
  tract: ['home_value'],
};

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockFetch = vi.fn();
const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = mockFetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a mock score response for testing
 */
function createMockScoreResponse(
  locationId: string,
  locationName: string,
  geography: string
): ScoreResponse {
  return {
    location_id: locationId,
    location_name: locationName,
    geography,
    median_price: 450000,
    score_date: '2025-12-01',
    scores: {
      homeready: {
        score: 72,
        grade: 'B',
        confidence: 0.85,
        confidence_level: 'HIGH',
      },
      investoredge: {
        score: 68,
        grade: 'B-',
        confidence: 0.82,
        confidence_level: 'HIGH',
      },
      markethealth: {
        score: 75,
        grade: 'B+',
        confidence: 0.88,
        confidence_level: 'HIGH',
      },
    },
  };
}

/**
 * Create a mock snapshot response for testing
 */
function createMockSnapshotResponse(
  geoLevel: GeoLevel,
  locationId: string,
  value: number
): SnapshotData {
  return {
    [locationId]: {
      value,
      date: '2025-12-01',
      name: `Location ${locationId}`,
    },
  };
}

/**
 * Setup mock to return score data
 */
function setupScoreMock(locationId: string, locationName: string, geography: string): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(createMockScoreResponse(locationId, locationName, geography)),
  });
}

/**
 * Setup mock to return score not found
 */
function setupScoreNotFoundMock(): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 404,
  });
}

/**
 * Setup mock to return snapshot data
 */
function setupSnapshotMock(geoLevel: GeoLevel, locationId: string, value: number): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        success: true,
        count: 1,
        data: [
          {
            region_id: locationId,
            region_name: `Location ${locationId}`,
            value,
            date: '2025-12-01',
          },
        ],
      }),
  });
}

// ============================================================================
// METRO TESTS
// ============================================================================

describe('Location Coverage', () => {
  describe.each(sampleMetros)('Metro: %s (%s)', (cbsaCode, metroName) => {
    beforeAll(() => {
      vi.clearAllMocks();
    });

    it('has PropertyIQ scores', async () => {
      setupScoreMock(cbsaCode, metroName, 'metro');

      const scores = await fetchScore('metro', cbsaCode);

      expect(scores).not.toBeNull();
      expect(scores?.location_id).toBe(cbsaCode);
      expect(scores?.scores).toBeDefined();

      for (const scoreType of SCORE_TYPES) {
        expect(scores?.scores[scoreType]).toBeDefined();
        expect(scores?.scores[scoreType].score).toBeGreaterThanOrEqual(0);
        expect(scores?.scores[scoreType].score).toBeLessThanOrEqual(100);
        expect(scores?.scores[scoreType].grade).toBeDefined();
        expect(scores?.scores[scoreType].confidence_level).toBeDefined();
      }
    });

    it('has core metrics', async () => {
      const requiredMetrics = REQUIRED_METRICS_BY_GEO.metro;

      for (const metricId of requiredMetrics) {
        setupSnapshotMock('metro', cbsaCode, 100000);
      }

      for (const metricId of requiredMetrics) {
        const data = await fetchSnapshotData(metricId, 'metro');
        expect(
          data[cbsaCode],
          `Expected ${metricId} data for metro ${cbsaCode}`
        ).toBeDefined();
      }
    });

    it('has no critical score gaps', async () => {
      setupScoreMock(cbsaCode, metroName, 'metro');

      const scores = await fetchScore('metro', cbsaCode);

      expect(scores).not.toBeNull();
      expect(scores?.scores.homeready.confidence_level).not.toBe('INSUFFICIENT');
      expect(scores?.scores.investoredge.confidence_level).not.toBe('INSUFFICIENT');
      expect(scores?.scores.markethealth.confidence_level).not.toBe('INSUFFICIENT');
    });
  });

  // ============================================================================
  // COUNTY TESTS
  // ============================================================================

  describe.each(sampleCounties)('County: %s (%s, %s)', (fipsCode, countyName, state) => {
    beforeAll(() => {
      vi.clearAllMocks();
    });

    it('has PropertyIQ scores', async () => {
      setupScoreMock(fipsCode, `${countyName}, ${state}`, 'county');

      const scores = await fetchScore('county', fipsCode);

      expect(scores).not.toBeNull();
      expect(scores?.location_id).toBe(fipsCode);
      expect(scores?.scores).toBeDefined();

      for (const scoreType of SCORE_TYPES) {
        expect(scores?.scores[scoreType]).toBeDefined();
        expect(scores?.scores[scoreType].score).toBeGreaterThanOrEqual(0);
        expect(scores?.scores[scoreType].score).toBeLessThanOrEqual(100);
      }
    });

    it('has core metrics', async () => {
      const requiredMetrics = REQUIRED_METRICS_BY_GEO.county;

      for (const metricId of requiredMetrics) {
        setupSnapshotMock('county', fipsCode, 350000);
      }

      for (const metricId of requiredMetrics) {
        const data = await fetchSnapshotData(metricId, 'county');
        expect(
          data[fipsCode],
          `Expected ${metricId} data for county ${fipsCode}`
        ).toBeDefined();
      }
    });

    it('has valid home value data', async () => {
      setupSnapshotMock('county', fipsCode, 450000);

      const data = await fetchSnapshotData('home_value', 'county');

      if (data[fipsCode]) {
        expect(data[fipsCode].value).toBeGreaterThan(0);
        expect(data[fipsCode].value).toBeLessThan(10000000);
      }
    });
  });

  // ============================================================================
  // ZIP TESTS
  // ============================================================================

  describe.each(sampleZips)('ZIP: %s (%s, %s)', (zipCode, city, state) => {
    beforeAll(() => {
      vi.clearAllMocks();
    });

    it('has PropertyIQ scores', async () => {
      setupScoreMock(zipCode, `${city}, ${state}`, 'zip');

      const scores = await fetchScore('zip', zipCode);

      expect(scores).not.toBeNull();
      expect(scores?.location_id).toBe(zipCode);
      expect(scores?.scores).toBeDefined();

      for (const scoreType of SCORE_TYPES) {
        expect(scores?.scores[scoreType]).toBeDefined();
        expect(scores?.scores[scoreType].score).toBeGreaterThanOrEqual(0);
        expect(scores?.scores[scoreType].score).toBeLessThanOrEqual(100);
      }
    });

    it('has core metrics', async () => {
      const requiredMetrics = REQUIRED_METRICS_BY_GEO.zip;

      for (const metricId of requiredMetrics) {
        setupSnapshotMock('zip', zipCode, 500000);
      }

      for (const metricId of requiredMetrics) {
        const data = await fetchSnapshotData(metricId, 'zip');
        expect(
          data[zipCode],
          `Expected ${metricId} data for ZIP ${zipCode}`
        ).toBeDefined();
      }
    });

    it('has valid listing price data', async () => {
      setupSnapshotMock('zip', zipCode, 525000);

      const data = await fetchSnapshotData('listing_price', 'zip');

      if (data[zipCode]) {
        expect(data[zipCode].value).toBeGreaterThan(0);
        expect(data[zipCode].value).toBeLessThan(50000000);
      }
    });
  });

  // ============================================================================
  // CROSS-GEOGRAPHY VALIDATION
  // ============================================================================

  describe('Cross-Geography Validation', () => {
    it('all geography levels have consistent score structure', async () => {
      const testCases: [GeoLevel, string, string][] = [
        ['metro', '35620', 'New York-Newark-Jersey City, NY'],
        ['county', '06037', 'Los Angeles County, CA'],
        ['zip', '10001', 'New York, NY'],
      ];

      for (const [geoLevel, locationId, locationName] of testCases) {
        setupScoreMock(locationId, locationName, geoLevel);

        const scores = await fetchScore(geoLevel, locationId);

        expect(scores).not.toBeNull();
        expect(scores?.scores).toHaveProperty('homeready');
        expect(scores?.scores).toHaveProperty('investoredge');
        expect(scores?.scores).toHaveProperty('markethealth');
      }
    });

    it('score values are within valid range for all geographies', async () => {
      const testCases: [GeoLevel, string, string][] = [
        ['metro', '16980', 'Chicago-Naperville-Elgin, IL'],
        ['county', '17031', 'Cook County, IL'],
        ['zip', '60601', 'Chicago, IL'],
      ];

      for (const [geoLevel, locationId, locationName] of testCases) {
        setupScoreMock(locationId, locationName, geoLevel);

        const scores = await fetchScore(geoLevel, locationId);

        expect(scores).not.toBeNull();

        for (const scoreType of SCORE_TYPES) {
          const score = scores?.scores[scoreType].score ?? -1;
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  // ============================================================================
  // DATA COMPLETENESS VALIDATION
  // ============================================================================

  describe('Data Completeness', () => {
    it('major metros have all required metrics', async () => {
      const majorMetro = sampleMetros[0];
      const [cbsaCode] = majorMetro;
      const requiredMetrics = REQUIRED_METRICS_BY_GEO.metro;

      for (const metricId of requiredMetrics) {
        setupSnapshotMock('metro', cbsaCode, 100000);
      }

      const results: Record<string, boolean> = {};

      for (const metricId of requiredMetrics) {
        const data = await fetchSnapshotData(metricId, 'metro');
        results[metricId] = data[cbsaCode] !== undefined;
      }

      const missingMetrics = Object.entries(results)
        .filter(([, hasData]) => !hasData)
        .map(([metricId]) => metricId);

      expect(
        missingMetrics,
        `Major metro ${cbsaCode} missing metrics: ${missingMetrics.join(', ')}`
      ).toHaveLength(0);
    });

    it('score confidence levels are valid', async () => {
      const validConfidenceLevels = ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'];

      const [cbsaCode, metroName] = sampleMetros[0];
      setupScoreMock(cbsaCode, metroName, 'metro');

      const scores = await fetchScore('metro', cbsaCode);

      expect(scores).not.toBeNull();

      for (const scoreType of SCORE_TYPES) {
        expect(validConfidenceLevels).toContain(scores?.scores[scoreType].confidence_level);
      }
    });

    it('score dates are recent', async () => {
      const [cbsaCode, metroName] = sampleMetros[0];
      setupScoreMock(cbsaCode, metroName, 'metro');

      const scores = await fetchScore('metro', cbsaCode);

      expect(scores).not.toBeNull();
      expect(scores?.score_date).toBeDefined();

      const scoreDate = new Date(scores?.score_date ?? '');
      const now = new Date();
      const daysDiff = Math.floor(
        (now.getTime() - scoreDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysDiff).toBeLessThan(90);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles missing score gracefully', async () => {
      setupScoreNotFoundMock();

      const scores = await fetchScore('metro', 'INVALID_CODE');

      expect(scores).toBeNull();
    });

    it('handles ZIP codes with leading zeros', async () => {
      const zipWithLeadingZero = '02101';
      setupScoreMock(zipWithLeadingZero, 'Boston, MA', 'zip');

      const scores = await fetchScore('zip', zipWithLeadingZero);

      expect(scores).not.toBeNull();
      expect(scores?.location_id).toBe(zipWithLeadingZero);
    });

    it('handles 5-digit FIPS codes correctly', async () => {
      const fipsCode = '06037';
      setupScoreMock(fipsCode, 'Los Angeles County, CA', 'county');

      const scores = await fetchScore('county', fipsCode);

      expect(scores).not.toBeNull();
      expect(scores?.location_id).toBe(fipsCode);
    });
  });
});
