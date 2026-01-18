/**
 * Quick test of the BLS fetch function
 */
import { fetchBLSCountyUnemployment } from './census-economic-import/api-clients';

async function test() {
  console.log('Testing BLS county unemployment function...\n');

  // Test with 5 counties
  const testCounties = [
    '06037', // Los Angeles, CA
    '17031', // Cook, IL (Chicago)
    '48201', // Harris, TX (Houston)
    '04013', // Maricopa, AZ (Phoenix)
    '36047', // Kings, NY (Brooklyn)
  ];

  const result = await fetchBLSCountyUnemployment(testCounties, 2023, 2025);

  console.log('\nResult:', result.success ? 'SUCCESS' : 'FAILED');
  console.log('Records:', result.data?.length || 0);

  if (result.data && result.data.length > 0) {
    console.log('\nSample data (first 10):');
    for (const row of result.data.slice(0, 10)) {
      console.log(`  ${row.fips_code}: ${row.date} = ${row.value}%`);
    }
  }
}

test().catch(console.error);
