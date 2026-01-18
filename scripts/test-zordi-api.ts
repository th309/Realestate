/**
 * Test ZORDI (Renter Demand Index) API endpoints with property type filtering
 */

const BASE_URL = 'http://localhost:3001/api/zillow';

async function testEndpoint(url: string, description: string) {
  console.log(`\n${description}`);
  console.log(`  URL: ${url}`);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.success) {
      console.log(`  Status: SUCCESS`);
      console.log(`  Count: ${data.count}`);
      console.log(`  Property Type: ${data.propertyType}`);

      // Show sample (first 3)
      if (data.data && data.data.length > 0) {
        console.log(`  Sample data:`);
        data.data.slice(0, 3).forEach((item: any) => {
          console.log(`    - ${item.region_name}: ${item.value?.toFixed(2)}`);
        });
      }
    } else {
      console.log(`  Status: FAILED - ${data.error}`);
    }
  } catch (error) {
    console.log(`  Status: ERROR - ${error}`);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('ZORDI (RENTER DEMAND INDEX) API ENDPOINT TESTS');
  console.log('='.repeat(70));

  // Test Metro endpoints
  console.log('\n--- METRO DEMAND ENDPOINTS ---');
  await testEndpoint(`${BASE_URL}/demand/metros?propertyType=all`, 'Metro Demand - All Homes');
  await testEndpoint(`${BASE_URL}/demand/metros?propertyType=sfr`, 'Metro Demand - Single Family');
  await testEndpoint(`${BASE_URL}/demand/metros?propertyType=mfr`, 'Metro Demand - Multi-Family');

  // Compare values for same metro across property types
  console.log('\n' + '-'.repeat(70));
  console.log('COMPARISON: New York, NY demand values across property types');
  console.log('-'.repeat(70));

  for (const propertyType of ['all', 'sfr', 'mfr']) {
    try {
      const response = await fetch(`${BASE_URL}/demand/metros?propertyType=${propertyType}`);
      const data = await response.json();

      if (data.success && data.data) {
        const ny = data.data.find((item: any) =>
          item.region_name?.includes('New York') || item.cbsa_code === '35620'
        );
        if (ny) {
          console.log(`  ${propertyType.toUpperCase().padEnd(5)}: ${ny.value?.toFixed(2)} (${ny.region_name})`);
        } else {
          console.log(`  ${propertyType.toUpperCase().padEnd(5)}: NOT FOUND`);
        }
      }
    } catch (error) {
      console.log(`  ${propertyType.toUpperCase().padEnd(5)}: ERROR - ${error}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('TESTS COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
