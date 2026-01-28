/**
 * Graph Page Test Runner
 *
 * Runs a minimal suite of API checks for the PropertyIQ graphs page.
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
    const passed = body.success === true && count >= minRequired;
    return { passed, durationMs, count, error: passed ? undefined : (count === 0 ? 'No data' : `Only ${count} points`) };
  } catch (e) {
    const durationMs = Date.now() - start;
    return { passed: false, durationMs, count: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

const SUITE: TestCase[] = [
  { name: 'Florida listing_price 5Y', metric: 'listing_price', geoLevel: 'state', regionId: 'Florida', timeFrame: '5Y', minDataPoints: 1 },
  { name: 'Texas listing_price 3Y', metric: 'listing_price', geoLevel: 'state', regionId: 'TX', timeFrame: '3Y', minDataPoints: 1 },
  { name: 'Florida home_value Max', metric: 'home_value', geoLevel: 'state', regionId: 'Florida', timeFrame: 'Max', minDataPoints: 1 },
  { name: 'Florida days_on_market 1Y', metric: 'days_on_market', geoLevel: 'state', regionId: 'FL', timeFrame: '1Y', minDataPoints: 1 },
];

async function main() {
  console.log(`Graph page API tests — base: ${API_BASE}\n`);
  let passed = 0;
  let failed = 0;
  for (const tc of SUITE) {
    const result = await runTestCase(tc);
    if (result.passed) {
      passed++;
      console.log(`✓ ${tc.name} (${result.durationMs}ms, ${result.count} points)`);
    } else {
      failed++;
      console.log(`✗ ${tc.name} — ${result.error ?? 'fail'} (${result.durationMs}ms, ${result.count} points)`);
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
