/**
 * Test BLS API for metro unemployment
 * BLS uses LAUMT series for metro areas
 * Format: LAUMT + state_fips(2) + area_code(5) + measure_type(2) + measure(1)
 * Or: LAUMT + msa_code + 0000000003
 */
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: './.env.local' });

const BLS_BASE = 'https://api.bls.gov/publicAPI/v2';

async function testBLSMetro() {
  console.log('Testing BLS API for metro unemployment...\n');

  // Pattern discovered: LAUMT + state_fips(2) + cbsa_code(5) + 0000000003
  // But state_fips needs to match the metro's principal state
  // Test with multiple metros to verify pattern
  const testMetros = [
    { cbsa: '12420', state: '48', name: 'Austin, TX' },          // CBSA 12420
    { cbsa: '33100', state: '12', name: 'Miami, FL' },           // CBSA 33100
    { cbsa: '31080', state: '06', name: 'Los Angeles, CA' },     // CBSA 31080
    { cbsa: '35620', state: '36', name: 'New York, NY' },        // CBSA 35620
    { cbsa: '16980', state: '17', name: 'Chicago, IL' },         // CBSA 16980
    { cbsa: '26420', state: '48', name: 'Houston, TX' },         // CBSA 26420
    { cbsa: '47900', state: '11', name: 'Washington, DC' },      // CBSA 47900
    { cbsa: '38060', state: '04', name: 'Phoenix, AZ' },         // CBSA 38060
    { cbsa: '19100', state: '48', name: 'Dallas, TX' },          // CBSA 19100
    { cbsa: '37980', state: '42', name: 'Philadelphia, PA' },    // CBSA 37980
  ];

  const allSeries = testMetros.map(m => `LAUMT${m.state}${m.cbsa}00000003`);

  const blsKey = process.env.BLS_API_KEY;
  console.log('BLS API Key:', blsKey ? `${blsKey.substring(0, 8)}...` : 'NOT SET');

  const requestBody: any = {
    seriesid: allSeries,
    startyear: '2024',
    endyear: '2025',
  };

  if (blsKey && !blsKey.includes('your_')) {
    requestBody.registrationkey = blsKey;
  }

  try {
    const response = await axios.post(`${BLS_BASE}/timeseries/data/`, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    console.log('Response status:', response.data.status);
    if (response.data.message) {
      console.log('Messages:', response.data.message);
    }

    if (response.data.Results?.series) {
      console.log(`\nReceived ${response.data.Results.series.length} series:\n`);

      for (const series of response.data.Results.series) {
        const dataCount = series.data?.length || 0;
        const latestObs = series.data?.[0];
        console.log(`  ${series.seriesID}: ${dataCount} observations`);
        if (latestObs) {
          console.log(`    Latest: ${latestObs.year}-${latestObs.period} = ${latestObs.value}%`);
        }
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testBLSMetro().catch(console.error);
