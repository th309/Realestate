/**
 * FULL MATRIX INTEGRATION TESTS - ALL COMBINATIONS
 *
 * Tests EVERY metric × EVERY location against the LIVE Railway backend.
 * NO MOCKS - all tests hit real APIs with real Supabase data.
 *
 * This fetches ALL locations from the database and tests ALL metrics.
 * Expected test count:
 * - 12 metrics × 881+ metros = 10,000+ tests
 * - 12 metrics × 3,073+ counties = 36,000+ tests
 * - 12 metrics × 9,855+ ZIPs = 118,000+ tests
 * - Score tests for all locations
 * Total: 165,000+ test cases
 *
 * Run with: npm run test:full-matrix
 */

import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-ee4d.up.railway.app';
const API_TIMEOUT = 30000;

// All time series metrics
const ALL_METRICS = [
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

// Will be populated from API
let ALL_METROS: string[] = [];
let ALL_COUNTIES: string[] = [];
let ALL_ZIPS: string[] = [];

// Test results tracking
const results = {
  metro: { total: 0, passed: 0, failed: 0, noData: 0 },
  county: { total: 0, passed: 0, failed: 0, noData: 0 },
  zip: { total: 0, passed: 0, failed: 0, noData: 0 },
  scores: { total: 0, passed: 0, failed: 0 },
  failures: [] as { metric: string; geoLevel: string; regionId: string; error: string }[],
};

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

async function fetchAllLocations() {
  console.log('\\n📊 Fetching ALL locations from database...');

  // Fetch all metros
  const metrosRes = await fetchWithTimeout(`${API_URL}/api/zillow/metros`);
  if (metrosRes.ok) {
    const data = await metrosRes.json();
    ALL_METROS = (data.data || []).map((m: any) => m.region_id || m.cbsa_code).filter(Boolean);
    console.log(`  ✓ Found ${ALL_METROS.length} metros`);
  }

  // Fetch all counties
  const countiesRes = await fetchWithTimeout(`${API_URL}/api/zillow/counties`);
  if (countiesRes.ok) {
    const data = await countiesRes.json();
    ALL_COUNTIES = (data.data || []).map((c: any) => c.region_id || c.fips_code).filter(Boolean);
    console.log(`  ✓ Found ${ALL_COUNTIES.length} counties`);
  }

  // Fetch all ZIPs (need to go state by state)
  const states = ['TX', 'CA', 'FL', 'NY', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI',
                  'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI',
                  'CO', 'MN', 'SC', 'AL', 'LA', 'KY', 'OR', 'OK', 'CT', 'UT',
                  'IA', 'NV', 'AR', 'MS', 'KS', 'NM', 'NE', 'ID', 'WV', 'HI',
                  'NH', 'ME', 'MT', 'RI', 'DE', 'SD', 'ND', 'AK', 'VT', 'WY', 'DC'];

  for (const state of states) {
    try {
      const zipsRes = await fetchWithTimeout(`${API_URL}/api/zillow/zips?state=${state}`, 10000);
      if (zipsRes.ok) {
        const data = await zipsRes.json();
        const stateZips = (data.data || []).map((z: any) => z.region_id || z.zip_code).filter(Boolean);
        ALL_ZIPS.push(...stateZips);
      }
    } catch (e) {
      // Skip failed states
    }
  }
  console.log(`  ✓ Found ${ALL_ZIPS.length} ZIPs`);

  const totalTests = (ALL_METROS.length + ALL_COUNTIES.length + ALL_ZIPS.length) * ALL_METRICS.length;
  console.log(`\\n🧪 Total test combinations: ${totalTests.toLocaleString()}`);
  console.log('\\n⏳ Starting comprehensive test run...\\n');
}

async function testTimeSeries(
  metric: string,
  geoLevel: string,
  regionId: string
): Promise<{ success: boolean; hasData: boolean; error?: string }> {
  const url = `${API_URL}/api/timeseries/${metric}/${geoLevel}/${regionId}?historyMonths=6`;

  try {
    const response = await fetchWithTimeout(url, 15000);

    if (!response.ok) {
      return { success: false, hasData: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (!data.success) {
      return { success: true, hasData: false };
    }

    const pointCount = data.data?.length || 0;
    return { success: true, hasData: pointCount > 0 };
  } catch (error) {
    return {
      success: false,
      hasData: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// FETCH ALL LOCATIONS BEFORE TESTS
// ============================================================================

beforeAll(async () => {
  await fetchAllLocations();
}, 120000);

// ============================================================================
// METRO TESTS - ALL METROS × ALL METRICS
// ============================================================================

describe('Full Matrix - ALL Metro Time Series', () => {
  it('tests all metrics for all metros', async () => {
    console.log(`\\n🏙️  Testing ${ALL_METROS.length} metros × ${ALL_METRICS.length} metrics = ${ALL_METROS.length * ALL_METRICS.length} combinations`);

    let processed = 0;
    const batchSize = 50; // Process in batches to avoid overwhelming the API

    for (const metroId of ALL_METROS) {
      for (const metric of ALL_METRICS) {
        results.metro.total++;

        const result = await testTimeSeries(metric, 'metro', metroId);

        if (result.success) {
          if (result.hasData) {
            results.metro.passed++;
          } else {
            results.metro.noData++;
          }
        } else {
          results.metro.failed++;
          results.failures.push({
            metric,
            geoLevel: 'metro',
            regionId: metroId,
            error: result.error || 'Unknown'
          });
        }

        processed++;
        if (processed % 1000 === 0) {
          console.log(`    Progress: ${processed.toLocaleString()} / ${ALL_METROS.length * ALL_METRICS.length}`);
        }
      }

      // Small delay between metros to avoid rate limiting
      if (ALL_METROS.indexOf(metroId) % batchSize === 0) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    console.log(`\\n  Metro Results: ${results.metro.passed} passed, ${results.metro.noData} no data, ${results.metro.failed} failed`);

    // At least 90% should succeed (either with data or graceful no-data)
    const successRate = (results.metro.passed + results.metro.noData) / results.metro.total;
    expect(successRate).toBeGreaterThan(0.9);
  }, 3600000); // 1 hour timeout
});

// ============================================================================
// COUNTY TESTS - ALL COUNTIES × ALL METRICS
// ============================================================================

describe('Full Matrix - ALL County Time Series', () => {
  it('tests all metrics for all counties', async () => {
    console.log(`\\n🏛️  Testing ${ALL_COUNTIES.length} counties × ${ALL_METRICS.length} metrics = ${ALL_COUNTIES.length * ALL_METRICS.length} combinations`);

    let processed = 0;
    const batchSize = 100;

    for (const countyId of ALL_COUNTIES) {
      for (const metric of ALL_METRICS) {
        results.county.total++;

        const result = await testTimeSeries(metric, 'county', countyId);

        if (result.success) {
          if (result.hasData) {
            results.county.passed++;
          } else {
            results.county.noData++;
          }
        } else {
          results.county.failed++;
          if (results.failures.length < 1000) { // Cap failure logging
            results.failures.push({
              metric,
              geoLevel: 'county',
              regionId: countyId,
              error: result.error || 'Unknown'
            });
          }
        }

        processed++;
        if (processed % 5000 === 0) {
          console.log(`    Progress: ${processed.toLocaleString()} / ${ALL_COUNTIES.length * ALL_METRICS.length}`);
        }
      }

      if (ALL_COUNTIES.indexOf(countyId) % batchSize === 0) {
        await new Promise(r => setTimeout(r, 50));
      }
    }

    console.log(`\\n  County Results: ${results.county.passed} passed, ${results.county.noData} no data, ${results.county.failed} failed`);

    const successRate = (results.county.passed + results.county.noData) / results.county.total;
    expect(successRate).toBeGreaterThan(0.9);
  }, 7200000); // 2 hour timeout
});

// ============================================================================
// ZIP TESTS - ALL ZIPS × ALL METRICS
// ============================================================================

describe('Full Matrix - ALL ZIP Time Series', () => {
  it('tests all metrics for all ZIPs', async () => {
    console.log(`\\n📮 Testing ${ALL_ZIPS.length} ZIPs × ${ALL_METRICS.length} metrics = ${ALL_ZIPS.length * ALL_METRICS.length} combinations`);

    let processed = 0;
    const batchSize = 200;

    for (const zipId of ALL_ZIPS) {
      for (const metric of ALL_METRICS) {
        results.zip.total++;

        const result = await testTimeSeries(metric, 'zip', zipId);

        if (result.success) {
          if (result.hasData) {
            results.zip.passed++;
          } else {
            results.zip.noData++;
          }
        } else {
          results.zip.failed++;
          if (results.failures.length < 1000) {
            results.failures.push({
              metric,
              geoLevel: 'zip',
              regionId: zipId,
              error: result.error || 'Unknown'
            });
          }
        }

        processed++;
        if (processed % 10000 === 0) {
          console.log(`    Progress: ${processed.toLocaleString()} / ${ALL_ZIPS.length * ALL_METRICS.length}`);
        }
      }

      if (ALL_ZIPS.indexOf(zipId) % batchSize === 0) {
        await new Promise(r => setTimeout(r, 25));
      }
    }

    console.log(`\\n  ZIP Results: ${results.zip.passed} passed, ${results.zip.noData} no data, ${results.zip.failed} failed`);

    const successRate = (results.zip.passed + results.zip.noData) / results.zip.total;
    expect(successRate).toBeGreaterThan(0.85); // ZIP coverage may be lower
  }, 14400000); // 4 hour timeout
});

// ============================================================================
// SCORES TESTS - ALL LOCATIONS
// ============================================================================

describe('Full Matrix - ALL Scores', () => {
  it('tests scores for all metros', async () => {
    console.log(`\\n📊 Testing scores for ${ALL_METROS.length} metros`);

    for (const metroId of ALL_METROS) {
      results.scores.total++;

      try {
        const response = await fetchWithTimeout(`${API_URL}/api/scores/metro/${metroId}`, 10000);

        if (response.ok) {
          const data = await response.json();
          if (data.scores) {
            results.scores.passed++;
          } else {
            results.scores.failed++;
          }
        } else {
          results.scores.failed++;
        }
      } catch {
        results.scores.failed++;
      }
    }

    console.log(`  Metro Scores: ${results.scores.passed}/${results.scores.total} passed`);
    expect(results.scores.passed / results.scores.total).toBeGreaterThan(0.9);
  }, 1800000);

  it('tests scores for all counties', async () => {
    console.log(`\\n📊 Testing scores for ${ALL_COUNTIES.length} counties`);

    let countyScoresPassed = 0;
    let countyScoresTotal = 0;

    for (const countyId of ALL_COUNTIES) {
      countyScoresTotal++;

      try {
        const response = await fetchWithTimeout(`${API_URL}/api/scores/county/${countyId}`, 10000);

        if (response.ok) {
          const data = await response.json();
          if (data.scores) {
            countyScoresPassed++;
          }
        }
      } catch {
        // Skip failures
      }

      if (countyScoresTotal % 500 === 0) {
        console.log(`    Progress: ${countyScoresTotal}/${ALL_COUNTIES.length}`);
      }
    }

    console.log(`  County Scores: ${countyScoresPassed}/${countyScoresTotal} passed`);
    expect(countyScoresPassed / countyScoresTotal).toBeGreaterThan(0.85);
  }, 3600000);
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================

describe('Full Matrix - Summary Report', () => {
  it('generates final summary', async () => {
    const totalTests = results.metro.total + results.county.total + results.zip.total + results.scores.total;
    const totalPassed = results.metro.passed + results.county.passed + results.zip.passed + results.scores.passed;
    const totalNoData = results.metro.noData + results.county.noData + results.zip.noData;
    const totalFailed = results.metro.failed + results.county.failed + results.zip.failed + results.scores.failed;

    console.log('\\n' + '='.repeat(60));
    console.log('FULL MATRIX TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`\\nTotal Tests: ${totalTests.toLocaleString()}`);
    console.log(`  ✅ Passed (with data): ${totalPassed.toLocaleString()}`);
    console.log(`  ⚪ No Data (graceful): ${totalNoData.toLocaleString()}`);
    console.log(`  ❌ Failed (errors): ${totalFailed.toLocaleString()}`);
    console.log(`\\nSuccess Rate: ${((totalPassed + totalNoData) / totalTests * 100).toFixed(2)}%`);

    console.log('\\nBy Geography Level:');
    console.log(`  Metro:  ${results.metro.passed}/${results.metro.total} (${(results.metro.passed/results.metro.total*100).toFixed(1)}% with data)`);
    console.log(`  County: ${results.county.passed}/${results.county.total} (${(results.county.passed/results.county.total*100).toFixed(1)}% with data)`);
    console.log(`  ZIP:    ${results.zip.passed}/${results.zip.total} (${(results.zip.passed/results.zip.total*100).toFixed(1)}% with data)`);
    console.log(`  Scores: ${results.scores.passed}/${results.scores.total} (${(results.scores.passed/results.scores.total*100).toFixed(1)}%)`);

    if (results.failures.length > 0) {
      console.log(`\\nSample Failures (first 20):`);
      results.failures.slice(0, 20).forEach(f => {
        console.log(`  ${f.geoLevel}/${f.regionId}/${f.metric}: ${f.error}`);
      });
    }

    console.log('\\n' + '='.repeat(60));

    // Overall pass criteria
    const overallSuccessRate = (totalPassed + totalNoData) / totalTests;
    expect(overallSuccessRate).toBeGreaterThan(0.85);
  }, 60000);
});
