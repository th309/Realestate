/**
 * Graph Page Test Runner
 *
 * Runs the API-testable subset of the graph page test suite (see .cursor/skills/graph-page-tester.md).
 * Usage: npx tsx scripts/graph-test/run-tests.ts
 *
 * Set GRAPH_TEST_API_URL (or NEXT_PUBLIC_API_URL) for backend base URL.
 * Default: http://localhost:3001
 */

const API_BASE =
  process.env.GRAPH_TEST_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';

interface TestCase {
  name: string;
  metric: string;
  geoLevel: string;
  regionId: string;
  timeFrame: '1Y' | '3Y' | '5Y' | '10Y' | 'Max';
  minDataPoints?: number;
  /** If true, pass when we get 200 and empty data (e.g. edge case: no data for geo) */
  allowEmpty?: boolean;
}

function getDateRange(timeFrame: string): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  switch (timeFrame) {
    case '1Y':
      start.setFullYear(end.getFullYear() - 1);
      break;
    case '3Y':
      start.setFullYear(end.getFullYear() - 3);
      break;
    case '5Y':
      start.setFullYear(end.getFullYear() - 5);
      break;
    case '10Y':
      start.setFullYear(end.getFullYear() - 10);
      break;
    default:
      start.setFullYear(2000);
  }
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

async function runTestCase(tc: TestCase): Promise<{ passed: boolean; durationMs: number; count: number; error?: string }> {
  const { startDate, endDate } = getDateRange(tc.timeFrame);
  const url = `${API_BASE}/api/timeseries/${tc.metric}/${tc.geoLevel}/${encodeURIComponent(tc.regionId)}?startDate=${startDate}&endDate=${endDate}`;
  const start = Date.now();
  try {
    const res = await fetch(url);
    const durationMs = Date.now() - start;
    if (!res.ok) {
      return { passed: false, durationMs, count: 0, error: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { success?: boolean; data?: unknown[]; count?: number };
    const data = body.data ?? [];
    const count = Array.isArray(data) ? data.length : 0;
    const minRequired = tc.minDataPoints ?? 1;
    const allowEmpty = tc.allowEmpty === true;
    const passed =
      body.success === true &&
      (count >= minRequired || (allowEmpty && count >= 0));
    return {
      passed,
      durationMs,
      count,
      error: passed ? undefined : count === 0 ? 'No data' : `Only ${count} points`,
    };
  } catch (e) {
    const durationMs = Date.now() - start;
    return { passed: false, durationMs, count: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

// Aligned with Comprehensive Test Suite in .cursor/skills/graph-page-tester.md (API-testable cases only).
const SUITE: TestCase[] = [
  // --- Geography (8) ---
  { name: 'State FL listing_price Max', metric: 'listing_price', geoLevel: 'state', regionId: 'Florida', timeFrame: 'Max', minDataPoints: 1 },
  { name: 'State TX listing_price 5Y', metric: 'listing_price', geoLevel: 'state', regionId: 'TX', timeFrame: '5Y', minDataPoints: 1 },
  { name: 'State CA home_value 3Y', metric: 'home_value', geoLevel: 'state', regionId: 'California', timeFrame: '3Y', minDataPoints: 1 },
  { name: 'State NY days_on_market 1Y', metric: 'days_on_market', geoLevel: 'state', regionId: 'NY', timeFrame: '1Y', minDataPoints: 1 },
  { name: 'Metro Austin listing_price 5Y', metric: 'listing_price', geoLevel: 'metro', regionId: '12420', timeFrame: '5Y', minDataPoints: 1 },
  { name: 'Metro Phoenix home_value 3Y', metric: 'home_value', geoLevel: 'metro', regionId: '38060', timeFrame: '3Y', minDataPoints: 1 },
  { name: 'County Travis TX listing_price 5Y', metric: 'listing_price', geoLevel: 'county', regionId: '48453', timeFrame: '5Y', minDataPoints: 1 },
  { name: 'ZIP 78701 listing_price 1Y', metric: 'listing_price', geoLevel: 'zip', regionId: '78701', timeFrame: '1Y', minDataPoints: 1 },
  // --- Time (4) ---
  { name: 'FL listing_price 1Y', metric: 'listing_price', geoLevel: 'state', regionId: 'FL', timeFrame: '1Y', minDataPoints: 1 },
  { name: 'FL listing_price 3Y', metric: 'listing_price', geoLevel: 'state', regionId: 'Florida', timeFrame: '3Y', minDataPoints: 1 },
  { name: 'FL listing_price 5Y', metric: 'listing_price', geoLevel: 'state', regionId: 'Florida', timeFrame: '5Y', minDataPoints: 1 },
  { name: 'FL listing_price 10Y', metric: 'listing_price', geoLevel: 'state', regionId: 'Florida', timeFrame: '10Y', minDataPoints: 1 },
  // --- Metric / data type (4) ---
  { name: 'FL home_value Max', metric: 'home_value', geoLevel: 'state', regionId: 'Florida', timeFrame: 'Max', minDataPoints: 1 },
  { name: 'FL days_on_market Max', metric: 'days_on_market', geoLevel: 'state', regionId: 'FL', timeFrame: 'Max', minDataPoints: 1 },
  { name: 'FL for_sale_inventory Max', metric: 'for_sale_inventory', geoLevel: 'state', regionId: 'Florida', timeFrame: 'Max', minDataPoints: 1 },
  { name: 'FL cap_rate Max', metric: 'cap_rate', geoLevel: 'state', regionId: 'Florida', timeFrame: 'Max', minDataPoints: 1, allowEmpty: true }, // cap_rate may have no state-level data
  // --- National (baseline-style) ---
  { name: 'National US listing_price Max', metric: 'listing_price', geoLevel: 'national', regionId: 'United States', timeFrame: 'Max', minDataPoints: 1 },
  // --- Comparison: second series (Texas) ---
  { name: 'State TX home_value 3Y', metric: 'home_value', geoLevel: 'state', regionId: 'Texas', timeFrame: '3Y', minDataPoints: 1 },
  // --- Edge: invalid/unknown region (no crash; empty or error is ok) ---
  { name: 'Edge invalid regionId', metric: 'listing_price', geoLevel: 'state', regionId: 'InvalidState99', timeFrame: '1Y', allowEmpty: true },
];

const MAX_ROUNDS = 10; // Stop after this many rounds to avoid infinite loops from flaky tests

async function main() {
  console.log(`Graph page API tests — base: ${API_BASE} (${SUITE.length} tests)\n`);
  console.log('Running iteratively: only re-running failed tests until all pass or max rounds.\n');

  let toRun = SUITE.map((_, i) => i);
  let round = 0;

  while (toRun.length > 0 && round < MAX_ROUNDS) {
    round++;
    const label = round === 1 ? 'Initial run' : `Retry round ${round} (${toRun.length} failed)`;
    console.log(`--- ${label} ---`);

    const failedIndices: number[] = [];
    for (const i of toRun) {
      const tc = SUITE[i];
      const result = await runTestCase(tc);
      if (result.passed) {
        console.log(`✓ ${tc.name} (${result.durationMs}ms, ${result.count} points)`);
      } else {
        console.log(`✗ ${tc.name} — ${result.error ?? 'fail'} (${result.durationMs}ms, ${result.count} points)`);
        failedIndices.push(i);
      }
    }
    toRun = failedIndices;
    if (toRun.length > 0) {
      console.log(`\n${toRun.length} failed; re-running only those.\n`);
    }
  }

  const passed = SUITE.length - toRun.length;
  const failed = toRun.length;
  console.log(`\n--- Summary ---`);
  console.log(`${passed} passed, ${failed} failed (after ${round} round(s))`);
  if (failed > 0 && round >= MAX_ROUNDS) {
    console.log(`Stopped after ${MAX_ROUNDS} rounds; some tests still failing.`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
