/**
 * Test BLS API for county unemployment
 */
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: './packages/backend/.env' });

const BLS_BASE = 'https://api.bls.gov/publicAPI/v2';

async function testBLS() {
  console.log('Testing BLS API for county unemployment...\n');

  // Test with 5 counties
  const testCounties = [
    '06037', // Los Angeles, CA
    '17031', // Cook, IL (Chicago)
    '48201', // Harris, TX (Houston)
    '04013', // Maricopa, AZ (Phoenix)
    '36047', // Kings, NY (Brooklyn)
  ];

  const seriesIds = testCounties.map(fips => `LAUCN${fips}0000000003`);
  console.log('Series IDs:', seriesIds);

  try {
    const response = await axios.post(`${BLS_BASE}/timeseries/data/`, {
      seriesid: seriesIds,
      startyear: '2023',
      endyear: '2025',
      registrationkey: process.env.BLS_API_KEY || undefined
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log('\nResponse status:', response.data.status);
    console.log('Message:', response.data.message?.join(', ') || 'OK');

    if (response.data.Results?.series) {
      console.log(`\nReceived ${response.data.Results.series.length} series:\n`);

      for (const series of response.data.Results.series) {
        const fips = series.seriesID.substring(5, 10);
        const dataCount = series.data?.length || 0;
        const latestObs = series.data?.[0];
        console.log(`  ${fips}: ${dataCount} observations`);
        if (latestObs) {
          console.log(`    Latest: ${latestObs.year}-${latestObs.period} = ${latestObs.value}%`);
        }
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

testBLS().catch(console.error);
