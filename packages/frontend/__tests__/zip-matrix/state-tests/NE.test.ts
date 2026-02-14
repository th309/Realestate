/**
 * ZIP Matrix State Test Template
 *
 * This template is used to generate individual state test files.
 * Replace NE with the actual state abbreviation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  fetchZipsForState,
  prefetchStateData,
  testAllMetricsForZip,
  aggregateStateResults,
  writeStateResults,
  checkCriticalMetrics,
} from '../test-utils';
import { CRITICAL_METRICS } from '../metrics';
import type { ZipResults } from '../types';

const STATE = 'NE'; // Replace with actual state
const BATCH_SIZE = 50; // Process ZIPs in batches to avoid overwhelming the API

describe(`ZIP Matrix: ${STATE}`, () => {
  let zips: string[] = [];
  let stateData: Map<string, any[]>;
  let allResults: Map<string, ZipResults>;
  let startTime: number;

  beforeAll(async () => {
    startTime = Date.now();
    console.log(`\n========== Testing ${STATE} ==========`);

    // Fetch all ZIPs for this state
    zips = await fetchZipsForState(STATE);
    console.log(`Found ${zips.length} ZIPs for ${STATE}`);

    if (zips.length === 0) {
      console.warn(`No ZIPs found for ${STATE}, skipping tests`);
      return;
    }

    // Pre-fetch all state-level data (one API call per endpoint type)
    console.log('Pre-fetching state data...');
    stateData = await prefetchStateData(STATE);
    console.log(`Pre-fetched ${stateData.size} endpoint datasets`);

    allResults = new Map();
  }, 120000); // 2 minute timeout for setup

  it('should have ZIPs to test', () => {
    expect(zips.length).toBeGreaterThan(0);
  });

  it('should test all ZIPs and write results', async () => {
    if (zips.length === 0) {
      console.log('Skipping - no ZIPs');
      return;
    }

    let passCount = 0;
    let failCount = 0;

    // Process in batches
    for (let i = 0; i < zips.length; i += BATCH_SIZE) {
      const batch = zips.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (zip) => {
        const results = await testAllMetricsForZip(zip, STATE, stateData);
        allResults.set(zip, results);

        const criticalPass = checkCriticalMetrics(results, CRITICAL_METRICS);
        if (criticalPass) {
          passCount++;
        } else {
          failCount++;
        }

        return { zip, criticalPass };
      });

      await Promise.all(batchPromises);

      // Progress update
      const processed = Math.min(i + BATCH_SIZE, zips.length);
      console.log(`Progress: ${processed}/${zips.length} ZIPs (${passCount} pass, ${failCount} fail)`);
    }

    // Aggregate and write results
    const stateResults = aggregateStateResults(STATE, startTime, allResults);
    writeStateResults(stateResults);

    // Log summary
    console.log(`\n${STATE} Summary:`);
    console.log(`  Total ZIPs: ${stateResults.totalZips}`);
    console.log(`  Duration: ${(stateResults.duration / 1000).toFixed(1)}s`);
    console.log(`  Critical Pass Rate: ${((passCount / zips.length) * 100).toFixed(1)}%`);

    // Test passes if 95%+ of ZIPs have critical metrics
    const passRate = passCount / zips.length;
    expect(passRate).toBeGreaterThanOrEqual(0.95);
  }, 600000); // 10 minute timeout for main test
});
