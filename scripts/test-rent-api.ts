/**
 * Test Rent Index API endpoints with property type filtering
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
          console.log(`    - ${item.region_name}: $${item.value?.toFixed(2)}`);
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
  console.log('RENT INDEX API ENDPOINT TESTS');
  console.log('='.repeat(70));

  // Test Metro endpoints
  console.log('\n--- METRO RENT ENDPOINTS ---');
  await testEndpoint(`${BASE_URL}/rent/metros?propertyType=all`, 'Metro Rent - All Homes');
  await testEndpoint(`${BASE_URL}/rent/metros?propertyType=sfr`, 'Metro Rent - Single Family');
  await testEndpoint(`${BASE_URL}/rent/metros?propertyType=mfr`, 'Metro Rent - Multi-Family');

  // Test County endpoints
  console.log('\n--- COUNTY RENT ENDPOINTS ---');
  await testEndpoint(`${BASE_URL}/rent/counties?propertyType=all&state=TX`, 'County Rent (TX) - All Homes');
  await testEndpoint(`${BASE_URL}/rent/counties?propertyType=sfr&state=TX`, 'County Rent (TX) - Single Family');
  await testEndpoint(`${BASE_URL}/rent/counties?propertyType=mfr&state=TX`, 'County Rent (TX) - Multi-Family');

  // Test ZIP endpoints
  console.log('\n--- ZIP RENT ENDPOINTS ---');
  await testEndpoint(`${BASE_URL}/rent/zips?state=TX&propertyType=all`, 'ZIP Rent (TX) - All Homes');
  await testEndpoint(`${BASE_URL}/rent/zips?state=TX&propertyType=sfr`, 'ZIP Rent (TX) - Single Family');
  await testEndpoint(`${BASE_URL}/rent/zips?state=TX&propertyType=mfr`, 'ZIP Rent (TX) - Multi-Family');

  console.log('\n' + '='.repeat(70));
  console.log('TESTS COMPLETE');
  console.log('='.repeat(70));
}

main().catch(console.error);
