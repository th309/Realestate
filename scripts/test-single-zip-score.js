/**
 * Test Single ZIP Score Calculation and Save
 *
 * Tests the full flow for a single ZIP code to see detailed errors.
 */

const fs = require('fs');
const path = require('path');

// Load env from multiple sources
const envPaths = [
  path.join(__dirname, '..', 'packages', 'backend', '.env'),
  path.join(__dirname, '..', '.env.local'),
  path.join(__dirname, '..', 'packages', 'frontend', '.env.local'),
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
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
    console.log('Loaded env from:', envPath);
  } catch (e) {
    // File doesn't exist
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-production-ee4d.up.railway.app';

async function testSingleZip() {
  console.log('=== Test Single ZIP Score Calculation ===\n');
  console.log('API URL:', API_URL);
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
  console.log('Using service key:', !!process.env.SUPABASE_SERVICE_KEY);
  console.log('Key prefix:', (process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').substring(0, 20) + '...');

  // Test with a well-known ZIP (Beverly Hills)
  const testZip = '90210';

  // First, try to get current score for this ZIP
  console.log('\n1. Checking if score exists for ZIP', testZip + '...');
  try {
    const getResponse = await fetch(`${API_URL}/api/scores/zip/${testZip}`, {
      headers: { 'x-user-tier': 'enterprise' },
    });

    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log('   Current score exists:', data);
    } else {
      const errorText = await getResponse.text();
      console.log('   Status:', getResponse.status);
      console.log('   Response:', errorText);
    }
  } catch (err) {
    console.log('   Error:', err.message);
  }

  // Try to calculate/recalculate score for just this ZIP
  console.log('\n2. Attempting to calculate score for single ZIP...');
  console.log('   (The API might not support single-ZIP calculation)');

  // Try the calculate endpoint with a single ZIP filter
  // Most APIs don't support this, so let's try triggering with a smaller batch
  try {
    // First, let's just trigger a small batch and look at logs
    const calcResponse = await fetch(`${API_URL}/api/scores/calculate/zip?date=2025-12-01`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('   Status:', calcResponse.status);
    const result = await calcResponse.json();
    console.log('   Result:', JSON.stringify(result, null, 2));

    if (result.errors > 0) {
      console.log('\n   ERRORS DETECTED: Check backend logs for detailed error messages.');
      console.log('   The issue might be:');
      console.log('   - Database permissions (INSERT on view)');
      console.log('   - Missing data for ZIP codes');
      console.log('   - Calculation errors (null/NaN handling)');
    }
  } catch (err) {
    console.log('   Error:', err.message);
  }

  // Test direct Supabase insert
  console.log('\n3. Testing direct Supabase insert...');
  const { createClient } = require('@supabase/supabase-js');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('   Creating Supabase client with URL:', supabaseUrl);
  console.log('   Using key type:', supabaseKey?.startsWith('sb_secret_') ? 'service (new format)' : supabaseKey?.startsWith('sb_publishable_') ? 'anon (new format)' : 'legacy JWT');

  const supabase = createClient(supabaseUrl, supabaseKey);

  const testRecord = {
    geography: 'zip',
    location_id: testZip,
    location_name: 'Beverly Hills, CA',
    score_type: 'markethealth',
    score: 75.0,
    grade: 'B',
    confidence: 85.0,
    confidence_level: 'HIGH',
    median_price: 5500000,
    score_date: '2025-12-01',
    created_at: new Date().toISOString(),
  };

  console.log('   Inserting test record:', testRecord);

  // Try inserting directly into the table instead of the view
  const { error: insertError } = await supabase.from('propertyiq_scores_v2').upsert(
    testRecord,
    { onConflict: 'geography,location_id,score_type,score_date' }
  );

  if (insertError) {
    console.log('   INSERT FAILED:', insertError);
    console.log('\n   This confirms the database permission issue.');
    console.log('   The backend is getting the same error.');
  } else {
    console.log('   INSERT SUCCEEDED!');

    // Verify and clean up
    const { data: checkData } = await supabase
      .from('propertyiq_scores')
      .select('*')
      .eq('location_id', testZip)
      .eq('score_type', 'markethealth')
      .eq('score_date', '2025-12-01');

    console.log('   Verified record:', checkData);

    // Clean up test record
    const { error: deleteError } = await supabase
      .from('propertyiq_scores_v2')
      .delete()
      .eq('location_id', testZip)
      .eq('score_type', 'markethealth')
      .eq('score_date', '2025-12-01');

    if (!deleteError) {
      console.log('   Cleaned up test record.');
    }

    console.log('\n   Database permissions are working!');
    console.log('   The backend might need to be redeployed to pick up the new permissions.');
  }

  console.log('\n=== Test Complete ===');
}

testSingleZip().catch(console.error);
