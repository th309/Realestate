/**
 * Test the metro unemployment fetch function directly
 */
import { fetchFREDUnemploymentMetros, fetchFREDSeries } from './census-economic-import/api-clients';

async function test() {
  console.log('Testing individual FRED series fetch...\n');

  // Test a single series first
  const result1 = await fetchFREDSeries('NEWY636URN', '2023-01-01');
  console.log('NEWY636URN result:', {
    success: result1.success,
    recordCount: result1.data?.length || 0,
    error: result1.error || 'none'
  });

  if (result1.data && result1.data.length > 0) {
    console.log('Sample:', result1.data.slice(0, 3));
  }

  console.log('\n--- Testing full metro fetch ---\n');

  const result = await fetchFREDUnemploymentMetros(2023);
  console.log('Result:', {
    success: result.success,
    recordCount: result.data?.length || 0
  });

  if (result.data && result.data.length > 0) {
    console.log('Sample data:', result.data.slice(0, 5));
  }
}

test().catch(console.error);
