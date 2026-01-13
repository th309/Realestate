import { fetch as undiciFetch, Agent } from 'undici';

const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connect: { timeout: 60_000 },
});

const API_URL = 'http://localhost:3001';

async function testApi(endpoint: string): Promise<void> {
  console.log(`\nTesting: ${endpoint}`);
  try {
    const response = await undiciFetch(`${API_URL}${endpoint}`, {
      dispatcher: agent,
    } as any);

    if (!response.ok) {
      console.log(`  Status: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.log(`  Error: ${text.substring(0, 200)}`);
      return;
    }

    const data = await response.json();

    if (data.type === 'FeatureCollection') {
      console.log(`  GeoJSON Features: ${data.features?.length || 0}`);
    } else if (data.success !== undefined) {
      console.log(`  Success: ${data.success}, Count: ${data.count || 0}`);
      if (data.data?.[0]) {
        console.log(`  Sample: ${JSON.stringify(data.data[0]).substring(0, 150)}`);
      }
    } else {
      console.log(`  Response: ${JSON.stringify(data).substring(0, 200)}`);
    }
  } catch (err: any) {
    console.log(`  Error: ${err.message}`);
  }
}

async function main() {
  console.log('=== Testing Local Backend API ===');

  // Geography endpoints
  console.log('\n--- Geography Endpoints ---');
  await testApi('/api/geography/states');
  await testApi('/api/geography/metros');
  await testApi('/api/geography/counties/WY');
  await testApi('/api/geography/zips/WY');
  await testApi('/api/geography/cities/WY');

  // Zillow endpoints
  console.log('\n--- Zillow Endpoints ---');
  await testApi('/api/zillow/states');
  await testApi('/api/zillow/metros');
  await testApi('/api/zillow/counties?state=WY');
  await testApi('/api/zillow/zips?state=WY');
  await testApi('/api/zillow/cities?state=WY');

  console.log('\n=== Done ===');
}

main().catch(console.error);
