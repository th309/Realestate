/**
 * Test FRED metro unemployment series
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: './packages/backend/.env' });

const FRED_API_KEY = process.env.FRED_API_KEY || '28446a6f75de86ba74668b13912d268c';

async function testSeries(seriesId: string, name: string): Promise<void> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=1`;
  try {
    const response = await fetch(url);
    const data = await response.json() as any;
    if (data.observations && data.observations.length > 0) {
      console.log(`✓ ${seriesId}: ${name} - ${data.observations[0].date}: ${data.observations[0].value}%`);
    } else {
      console.log(`✗ ${seriesId}: ${name} - No data`);
    }
  } catch (e) {
    console.log(`✗ ${seriesId}: ${name} - Error: ${e}`);
  }
}

async function main() {
  console.log('Testing FRED metro unemployment series...\n');

  // Test the series IDs we're using
  await testSeries('NEWY636URN', 'New York');
  await testSeries('HOUS448URN', 'Houston');
  await testSeries('LOSA106URN', 'Los Angeles');
  await testSeries('CHIC917URN', 'Chicago');
  await testSeries('PHOE004URN', 'Phoenix');
}

main().catch(console.error);
