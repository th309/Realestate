/**
 * ZIP Matrix Results Reporter
 *
 * Aggregates results from all 50 state test files into a summary report.
 * Run with: npx tsx __tests__/zip-matrix/reporter.ts
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { StateResults, AggregateReport } from './types';
import { ZIP_METRICS, US_STATES } from './metrics';

const RESULTS_DIR = join(__dirname, 'results');

function loadAllResults(): Map<string, StateResults> {
  const results = new Map<string, StateResults>();

  if (!existsSync(RESULTS_DIR)) {
    console.error('Results directory not found. Run tests first.');
    return results;
  }

  const files = readdirSync(RESULTS_DIR).filter(f => f.endsWith('-results.json'));

  for (const file of files) {
    try {
      const content = readFileSync(join(RESULTS_DIR, file), 'utf-8');
      const stateResults: StateResults = JSON.parse(content);
      results.set(stateResults.state, stateResults);
    } catch (error) {
      console.error(`Error loading ${file}:`, error);
    }
  }

  return results;
}

function generateReport(allResults: Map<string, StateResults>): AggregateReport {
  const metrics: AggregateReport['metrics'] = {};
  const statesSummary: AggregateReport['statesSummary'] = {};

  let totalZips = 0;
  let totalChecks = 0;
  let totalDuration = 0;

  // Initialize metrics
  for (const metric of ZIP_METRICS) {
    metrics[metric.id] = { pass: 0, empty: 0, fail: 0, 'n/a': 0, passRate: 0 };
  }

  // Aggregate from all states
  for (const [state, results] of allResults) {
    totalZips += results.totalZips;
    totalDuration += results.duration;

    let statePass = 0;
    let stateTotal = 0;

    for (const [metricId, summary] of Object.entries(results.summary)) {
      if (metrics[metricId]) {
        metrics[metricId].pass += summary.pass;
        metrics[metricId].empty += summary.empty;
        metrics[metricId].fail += summary.fail;
        metrics[metricId]['n/a'] += summary['n/a'];

        statePass += summary.pass;
        stateTotal += summary.pass + summary.empty + summary.fail;
        totalChecks += summary.pass + summary.empty + summary.fail + summary['n/a'];
      }
    }

    statesSummary[state] = {
      zips: results.totalZips,
      passRate: stateTotal > 0 ? (statePass / stateTotal) * 100 : 0,
    };
  }

  // Calculate pass rates
  for (const metricId of Object.keys(metrics)) {
    const m = metrics[metricId];
    const testable = m.pass + m.empty + m.fail; // Exclude n/a
    m.passRate = testable > 0 ? (m.pass / testable) * 100 : 0;
  }

  return {
    runDate: new Date().toISOString(),
    totalStates: allResults.size,
    totalZips,
    totalChecks,
    duration: totalDuration,
    metrics,
    statesSummary,
  };
}

function printReport(report: AggregateReport): void {
  console.log('\n' + '='.repeat(70));
  console.log('ZIP MATRIX TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`Run Date: ${report.runDate}`);
  console.log(`States Tested: ${report.totalStates}/50`);
  console.log(`Total ZIPs: ${report.totalZips.toLocaleString()}`);
  console.log(`Total Checks: ${report.totalChecks.toLocaleString()}`);
  console.log(`Duration: ${(report.duration / 1000 / 60).toFixed(1)} minutes`);

  console.log('\n' + '-'.repeat(70));
  console.log('METRIC COVERAGE');
  console.log('-'.repeat(70));
  console.log(
    'Metric'.padEnd(30) +
    'Pass'.padStart(8) +
    'Empty'.padStart(8) +
    'Fail'.padStart(8) +
    'N/A'.padStart(8) +
    'Rate'.padStart(8)
  );
  console.log('-'.repeat(70));

  // Sort by pass rate descending
  const sortedMetrics = Object.entries(report.metrics)
    .sort((a, b) => b[1].passRate - a[1].passRate);

  for (const [metricId, data] of sortedMetrics) {
    const metric = ZIP_METRICS.find(m => m.id === metricId);
    const name = (metric?.name || metricId).substring(0, 28);

    console.log(
      name.padEnd(30) +
      data.pass.toString().padStart(8) +
      data.empty.toString().padStart(8) +
      data.fail.toString().padStart(8) +
      data['n/a'].toString().padStart(8) +
      `${data.passRate.toFixed(1)}%`.padStart(8)
    );
  }

  // States with issues
  console.log('\n' + '-'.repeat(70));
  console.log('STATES BY COVERAGE');
  console.log('-'.repeat(70));

  const sortedStates = Object.entries(report.statesSummary)
    .sort((a, b) => b[1].passRate - a[1].passRate);

  // Top 10 and Bottom 10
  console.log('\nTop 10:');
  for (const [state, data] of sortedStates.slice(0, 10)) {
    console.log(`  ${state}: ${data.passRate.toFixed(1)}% (${data.zips} ZIPs)`);
  }

  console.log('\nBottom 10:');
  for (const [state, data] of sortedStates.slice(-10)) {
    console.log(`  ${state}: ${data.passRate.toFixed(1)}% (${data.zips} ZIPs)`);
  }

  // Missing states
  const testedStates = new Set(Object.keys(report.statesSummary));
  const missingStates = US_STATES.filter(s => !testedStates.has(s));
  if (missingStates.length > 0) {
    console.log(`\nMissing States (${missingStates.length}): ${missingStates.join(', ')}`);
  }

  console.log('\n' + '='.repeat(70));
}

// Main
const allResults = loadAllResults();

if (allResults.size === 0) {
  console.log('No results found. Run tests first with: npm run test:zip-matrix');
  process.exit(1);
}

const report = generateReport(allResults);

// Print to console
printReport(report);

// Write JSON report
const reportPath = join(RESULTS_DIR, 'aggregate-report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nFull report written to: ${reportPath}`);
