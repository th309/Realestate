/**
 * Check database schema for realtor tables
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envPaths = [
  path.join(__dirname, '..', 'packages', 'backend', '.env'),
  path.join(__dirname, '..', '.env.local'),
];

for (const envPath of envPaths) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const eqIndex = trimmedLine.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmedLine.substring(0, eqIndex).trim();
          const value = trimmedLine.substring(eqIndex + 1).trim();
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  } catch (e) {}
}

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSchema() {
  // Test the exact query the service uses for counties
  console.log('=== Testing County Query (what service uses) ===');
  const { data: countyTest, error: countyTestError } = await supabase
    .from('realtor_county')
    .select('county_fips, county_name, state_id')
    .limit(1);

  if (countyTestError) {
    console.log('County Query Error:', countyTestError.message);
    console.log('Full error:', JSON.stringify(countyTestError, null, 2));
  } else {
    console.log('County Query Success:', countyTest);
  }

  // Check what columns we actually have for state info
  console.log('\n=== Checking county sample data ===');
  const { data: countySample, error: sampleError } = await supabase
    .from('realtor_county')
    .select('county_fips, county_name, cbsa_code, cbsa_title')
    .limit(3);

  if (sampleError) {
    console.log('Sample Error:', sampleError.message);
  } else {
    console.log('Sample data:', JSON.stringify(countySample, null, 2));
  }

  // Test ZIP query
  console.log('\n=== Testing ZIP Query (what service uses) ===');
  const { data: zipTest, error: zipTestError } = await supabase
    .from('realtor_zip')
    .select('postal_code, zip_name')
    .limit(3);

  if (zipTestError) {
    console.log('ZIP Query Error:', zipTestError.message);
    console.log('Full error:', JSON.stringify(zipTestError, null, 2));
  } else {
    console.log('ZIP Query Success:', JSON.stringify(zipTest, null, 2));
  }

  // Count zips differently
  console.log('\n=== ZIP Count (using different method) ===');
  const { data: zipCountData, error: zipCountError } = await supabase
    .from('realtor_zip')
    .select('postal_code')
    .limit(1);

  if (zipCountError) {
    console.log('ZIP count query error:', zipCountError.message);
  } else {
    console.log('ZIP sample exists:', !!zipCountData);
  }

  // Get distinct postal codes count
  console.log('\n=== Distinct ZIP codes ===');
  const { data: distinctZips, error: distinctError } = await supabase
    .from('realtor_zip')
    .select('postal_code')
    .order('postal_code')
    .range(0, 9);

  if (distinctError) {
    console.log('Distinct error:', distinctError.message);
  } else {
    console.log('First 10 ZIPs:', distinctZips?.map(z => z.postal_code));
  }
}

checkSchema().catch(console.error);
