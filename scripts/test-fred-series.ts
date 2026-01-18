import * as dotenv from 'dotenv';
dotenv.config({ path: './packages/backend/.env' });

const FRED_API_KEY = process.env.FRED_API_KEY || '28446a6f75de86ba74668b13912d268c';

async function searchSeries(searchText: string): Promise<void> {
  const encoded = encodeURIComponent(searchText);
  const url = `https://api.stlouisfed.org/fred/series/search?search_text=${encoded}&api_key=${FRED_API_KEY}&file_type=json&limit=5`;
  try {
    const response = await fetch(url);
    const data = await response.json() as any;
    if (data.seriess && data.seriess.length > 0) {
      console.log(`\nSearch: "${searchText}"`);
      for (const series of data.seriess.slice(0, 5)) {
        console.log(`  ${series.id}: ${series.title}`);
      }
    }
  } catch (e) {
    console.log(`Error searching: ${e}`);
  }
}

async function testSeries(seriesId: string): Promise<boolean> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=1`;
  try {
    const response = await fetch(url);
    const data = await response.json() as any;
    if (data.observations && data.observations.length > 0) {
      console.log(`✓ ${seriesId}: Found data (${data.observations[0].date}: ${data.observations[0].value})`);
      return true;
    } else {
      console.log(`✗ ${seriesId}: No data`);
      return false;
    }
  } catch (e) {
    console.log(`✗ ${seriesId}: Error`);
    return false;
  }
}

async function main() {
  console.log('Testing FRED annual county unemployment series...\n');

  // Test annual county format (with 'A' suffix)
  const testCounties = [
    { fips: '06037', name: 'Los Angeles, CA' },
    { fips: '17031', name: 'Cook, IL' },
    { fips: '48201', name: 'Harris, TX' },
    { fips: '04013', name: 'Maricopa, AZ' },
    { fips: '36047', name: 'Kings, NY' },
    { fips: '01001', name: 'Autauga, AL' },  // Small county test
    { fips: '56045', name: 'Weston, WY' },   // Small state test
  ];

  console.log('--- Annual County Series (with A suffix) ---');
  for (const county of testCounties) {
    await testSeries(`LAUCN${county.fips}0000000003A`);
  }

  console.log('\n--- Metro Series (short form) ---');
  await testSeries('HOUS448URN');  // Houston
  await testSeries('NEWY636URN');  // NYC
  await testSeries('LOSA106URN');  // LA
}

main().catch(console.error);
