/**
 * Test script to verify map integration
 * Tests that GeoJSON from API can be joined with Zillow metric data
 */
import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch, Agent } from 'undici';

// Create a custom agent with connection handling
const agent = new Agent({
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 30_000,
  connect: {
    timeout: 30_000,
  },
});

// Custom fetch wrapper using undici
const customFetch = (url: string | URL | Request, init?: RequestInit) => {
  return undiciFetch(url as any, {
    ...init,
    dispatcher: agent,
  } as any);
};

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: customFetch as unknown as typeof fetch,
    },
  }
);

const API_URL = 'http://localhost:3001';

interface GeoJSONFeature {
  type: string;
  id?: string;
  geometry: any;
  properties: Record<string, any>;
}

interface GeoJSONFeatureCollection {
  type: string;
  features: GeoJSONFeature[];
}

async function testMapIntegration() {
  console.log('=== Map Integration Test ===\n');

  // Test 1: States
  console.log('1. Testing States Layer');
  console.log('-'.repeat(40));
  await testStatesLayer();

  // Test 2: Metros
  console.log('\n2. Testing Metros Layer');
  console.log('-'.repeat(40));
  await testMetrosLayer();

  // Test 3: Counties (state-specific)
  console.log('\n3. Testing Counties Layer (CA)');
  console.log('-'.repeat(40));
  await testCountiesLayer('CA');

  // Test 4: Cities (state-specific)
  console.log('\n4. Testing Cities Layer (CA)');
  console.log('-'.repeat(40));
  await testCitiesLayer('CA');

  // Test 5: ZIPs (smaller state)
  console.log('\n5. Testing ZIPs Layer (WY)');
  console.log('-'.repeat(40));
  await testZipsLayer('WY');

  console.log('\n' + '='.repeat(50));
  console.log('Integration Test Complete');
  console.log('='.repeat(50));
}

async function testStatesLayer() {
  // Fetch GeoJSON
  const response = await fetch(`${API_URL}/api/geography/states`);
  const geojson: GeoJSONFeatureCollection = await response.json();
  console.log(`  GeoJSON features: ${geojson.features.length}`);

  // Fetch Zillow state data
  const { data: zillowData, error } = await supabase
    .from('zillow_zhvi_state')
    .select('state_name, latest_value')
    .not('latest_value', 'is', null)
    .limit(100);

  if (error) {
    console.log(`  Error fetching Zillow data: ${error.message}`);
    return;
  }

  console.log(`  Zillow state records: ${zillowData?.length || 0}`);

  // Create lookup by state name
  const zillowLookup: Record<string, number> = {};
  zillowData?.forEach((row: any) => {
    zillowLookup[row.state_name] = row.latest_value;
  });

  // Check matches
  let matched = 0;
  let unmatched: string[] = [];
  geojson.features.forEach((feature) => {
    const name = feature.properties.name;
    if (zillowLookup[name] !== undefined) {
      matched++;
    } else {
      unmatched.push(name);
    }
  });

  console.log(`  Matched: ${matched}/${geojson.features.length}`);
  if (unmatched.length > 0 && unmatched.length <= 10) {
    console.log(`  Unmatched: ${unmatched.join(', ')}`);
  }
  console.log(`  Sample GeoJSON properties: ${JSON.stringify(geojson.features[0]?.properties)}`);
}

async function testMetrosLayer() {
  // Fetch GeoJSON
  const response = await fetch(`${API_URL}/api/geography/metros`);
  const geojson: GeoJSONFeatureCollection = await response.json();
  console.log(`  GeoJSON features: ${geojson.features.length}`);

  // Fetch Zillow metro data
  const { data: zillowData, error } = await supabase
    .from('zillow_zhvi_metro')
    .select('cbsa_code, latest_value')
    .not('latest_value', 'is', null)
    .limit(1000);

  if (error) {
    console.log(`  Error fetching Zillow data: ${error.message}`);
    return;
  }

  console.log(`  Zillow metro records: ${zillowData?.length || 0}`);

  // Create lookup by CBSA code
  const zillowLookup: Record<string, number> = {};
  zillowData?.forEach((row: any) => {
    zillowLookup[row.cbsa_code] = row.latest_value;
  });

  // Check matches using CBSAFP property
  let matched = 0;
  let sampleMatch: any = null;
  let sampleNoMatch: any = null;

  geojson.features.forEach((feature) => {
    const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
    if (zillowLookup[cbsaCode] !== undefined) {
      matched++;
      if (!sampleMatch) sampleMatch = { cbsaCode, value: zillowLookup[cbsaCode], name: feature.properties.NAME };
    } else if (!sampleNoMatch) {
      sampleNoMatch = { cbsaCode, name: feature.properties.NAME };
    }
  });

  console.log(`  Matched: ${matched}/${geojson.features.length}`);
  console.log(`  Sample GeoJSON properties: ${JSON.stringify(geojson.features[0]?.properties)}`);
  if (sampleMatch) console.log(`  Sample match: CBSA ${sampleMatch.cbsaCode} = $${sampleMatch.value?.toLocaleString()}`);
  if (sampleNoMatch) console.log(`  Sample no-match: CBSA ${sampleNoMatch.cbsaCode} (${sampleNoMatch.name})`);
}

async function testCountiesLayer(state: string) {
  // Fetch GeoJSON
  const response = await fetch(`${API_URL}/api/geography/counties/${state}`);
  const geojson: GeoJSONFeatureCollection = await response.json();
  console.log(`  GeoJSON features: ${geojson.features.length}`);

  // Fetch Zillow county data for this state
  const stateFips = { CA: '06', TX: '48', NY: '36', FL: '12' }[state] || '06';
  const { data: zillowData, error } = await supabase
    .from('zillow_zhvi_county')
    .select('county_fips, latest_value')
    .like('county_fips', `${stateFips}%`)
    .not('latest_value', 'is', null)
    .limit(500);

  if (error) {
    console.log(`  Error fetching Zillow data: ${error.message}`);
    return;
  }

  console.log(`  Zillow county records: ${zillowData?.length || 0}`);

  // Create lookup by county FIPS
  const zillowLookup: Record<string, number> = {};
  zillowData?.forEach((row: any) => {
    zillowLookup[row.county_fips] = row.latest_value;
  });

  // Check matches
  let matched = 0;
  geojson.features.forEach((feature) => {
    const fips = feature.id || feature.properties.id;
    if (zillowLookup[fips] !== undefined) {
      matched++;
    }
  });

  console.log(`  Matched: ${matched}/${geojson.features.length}`);
  console.log(`  Sample GeoJSON id: ${geojson.features[0]?.id}`);
  console.log(`  Sample GeoJSON properties: ${JSON.stringify(geojson.features[0]?.properties)}`);
}

async function testCitiesLayer(state: string) {
  // Fetch GeoJSON
  const response = await fetch(`${API_URL}/api/geography/cities/${state}`);
  const geojson: GeoJSONFeatureCollection = await response.json();
  console.log(`  GeoJSON features: ${geojson.features.length}`);

  // Fetch Zillow city data for this state
  const { data: zillowData, error } = await supabase
    .from('zillow_zhvi_city')
    .select('region_id, state_name, city_name, latest_value')
    .eq('state_name', state === 'CA' ? 'California' : state)
    .not('latest_value', 'is', null)
    .limit(500);

  if (error) {
    console.log(`  Error fetching Zillow data: ${error.message}`);
    console.log(`  Note: City data matching may require additional work`);
    return;
  }

  console.log(`  Zillow city records: ${zillowData?.length || 0}`);
  console.log(`  Sample GeoJSON properties: ${JSON.stringify(geojson.features[0]?.properties)}`);
  if (zillowData && zillowData.length > 0) {
    console.log(`  Sample Zillow city: ${JSON.stringify(zillowData[0])}`);
  }
}

async function testZipsLayer(state: string) {
  // Fetch GeoJSON
  const response = await fetch(`${API_URL}/api/geography/zips/${state}`);
  const geojson: GeoJSONFeatureCollection = await response.json();
  console.log(`  GeoJSON features: ${geojson.features.length}`);

  // Fetch Zillow ZIP data
  const { data: zillowData, error } = await supabase
    .from('zillow_zhvi_zip')
    .select('region_name, latest_value')
    .not('latest_value', 'is', null)
    .limit(500);

  if (error) {
    console.log(`  Error fetching Zillow ZIP data: ${error.message}`);
    return;
  }

  console.log(`  Zillow ZIP records (sample): ${zillowData?.length || 0}`);

  // Create lookup by ZIP
  const zillowLookup: Record<string, number> = {};
  zillowData?.forEach((row: any) => {
    zillowLookup[row.region_name] = row.latest_value;
  });

  // Check matches
  let matched = 0;
  geojson.features.forEach((feature) => {
    const zipCode = feature.properties.ZCTA5CE20 || feature.properties.GEOID20;
    if (zillowLookup[zipCode] !== undefined) {
      matched++;
    }
  });

  console.log(`  Matched (from sample): ${matched}/${geojson.features.length}`);
  console.log(`  Sample GeoJSON properties: ${JSON.stringify(geojson.features[0]?.properties)}`);
}

testMapIntegration().catch(console.error);
