/**
 * Check PropertyIQ Scores Table/View Permissions
 *
 * Diagnoses the permission issue preventing ZIP score calculation.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const trimmedLine = line.trim();
  if (trimmedLine && !trimmedLine.startsWith('#')) {
    const eqIndex = trimmedLine.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmedLine.substring(0, eqIndex).trim();
      const value = trimmedLine.substring(eqIndex + 1).trim();
      process.env[key] = value;
    }
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPermissions() {
  console.log('=== PropertyIQ Scores Permission Check ===\n');

  // Check if table exists and what type it is
  console.log('1. Checking propertyiq_scores type...');

  // Try to read from the view
  const { data: scores, error: readError } = await supabase
    .from('propertyiq_scores')
    .select('id, geography, location_id, score_type')
    .limit(1);

  if (readError) {
    console.log('   Read error:', readError.message);
  } else {
    console.log('   Read works - sample:', scores);
  }

  // Check if propertyiq_scores_v2 exists
  console.log('\n2. Checking propertyiq_scores_v2 table...');
  const { data: scoresV2, error: readV2Error } = await supabase
    .from('propertyiq_scores_v2')
    .select('id, geography, location_id, score_type')
    .limit(1);

  if (readV2Error) {
    console.log('   Read error:', readV2Error.message);
    console.log('   (propertyiq_scores_v2 table may not exist)');
  } else {
    console.log('   Read works - sample:', scoresV2);
  }

  // Try to insert into propertyiq_scores (the view)
  console.log('\n3. Testing INSERT into propertyiq_scores (view)...');
  const testRecord = {
    geography: 'zip',
    location_id: 'TEST99999',
    location_name: 'Test ZIP',
    score_type: 'markethealth',
    score: 50.0,
    grade: 'C',
    confidence: 50.0,
    confidence_level: 'MEDIUM',
    score_date: '2025-01-01'
  };

  const { error: insertError } = await supabase
    .from('propertyiq_scores')
    .insert([testRecord]);

  if (insertError) {
    console.log('   INSERT FAILED:', insertError.message);
    if (insertError.message.includes('permission denied')) {
      console.log('\n   DIAGNOSIS: The view propertyiq_scores lacks INSERT permission.');
      console.log('   The INSTEAD OF INSERT trigger cannot fire without INSERT privilege.');
      console.log('\n   FIX: Run this SQL in Supabase Dashboard SQL Editor:');
      console.log('   ═══════════════════════════════════════════════════════');
      console.log('   GRANT INSERT ON propertyiq_scores TO service_role;');
      console.log('   GRANT INSERT ON propertyiq_scores TO authenticated;');
      console.log('   ALTER FUNCTION propertyiq_scores_insert_trigger() SECURITY DEFINER;');
      console.log('   ═══════════════════════════════════════════════════════');
    }
  } else {
    console.log('   INSERT SUCCEEDED!');

    // Clean up test record
    const { error: deleteError } = await supabase
      .from('propertyiq_scores_v2')
      .delete()
      .eq('location_id', 'TEST99999');

    if (!deleteError) {
      console.log('   Cleaned up test record.');
    }

    console.log('\n   ✅ Permissions are correctly configured!');
    console.log('   ZIP score calculation should work now.');
  }

  // Try to insert directly into propertyiq_scores_v2
  console.log('\n4. Testing INSERT into propertyiq_scores_v2 (table)...');
  const { error: insertV2Error } = await supabase
    .from('propertyiq_scores_v2')
    .insert([testRecord]);

  if (insertV2Error) {
    console.log('   INSERT FAILED:', insertV2Error.message);
    if (insertV2Error.message.includes('relation') && insertV2Error.message.includes('does not exist')) {
      console.log('   (Table does not exist - migration 061 may not have been run)');
    }
  } else {
    console.log('   INSERT SUCCEEDED into propertyiq_scores_v2');

    // Clean up
    await supabase
      .from('propertyiq_scores_v2')
      .delete()
      .eq('location_id', 'TEST99999');

    console.log('   Cleaned up test record.');
  }

  console.log('\n=== Check Complete ===');
}

checkPermissions().catch(console.error);
