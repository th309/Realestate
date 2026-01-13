/**
 * Debug Zillow Insert
 * Tests a single insert to see what error we're getting
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../packages/backend/.env') });
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function main() {
  console.log('Testing insert into zillow_new_listings...\n');

  // Test data
  const testRecord = {
    region_id: '102001',
    date: '2024-01-31',
    value: 1234,
    property_type: 'sfrcondo',
    geography: 'Metro'
  };

  console.log('Test record:', JSON.stringify(testRecord, null, 2));
  console.log();

  // First, check table structure
  console.log('Checking table structure...');
  const { data: tableInfo, error: tableError } = await supabase
    .from('zillow_new_listings')
    .select('*')
    .limit(1);

  if (tableError) {
    console.log('Table query error:', tableError);
  } else {
    console.log('Table exists, structure check passed');
  }

  // Try simple insert (not upsert)
  console.log('\nTrying simple INSERT...');
  const { data: insertData, error: insertError } = await supabase
    .from('zillow_new_listings')
    .insert(testRecord)
    .select();

  if (insertError) {
    console.log('INSERT error:', insertError);
  } else {
    console.log('INSERT success:', insertData);
  }

  // Try upsert with correct conflict columns
  console.log('\nTrying UPSERT with region_id,date,property_type,geography...');
  const { data: upsertData, error: upsertError } = await supabase
    .from('zillow_new_listings')
    .upsert(testRecord, { onConflict: 'region_id,date,property_type,geography' })
    .select();

  if (upsertError) {
    console.log('UPSERT error:', upsertError);
  } else {
    console.log('UPSERT success:', upsertData);
  }

  // Check if data was inserted
  console.log('\nChecking if data exists...');
  const { data: checkData, error: checkError } = await supabase
    .from('zillow_new_listings')
    .select('*')
    .eq('region_id', '102001')
    .limit(1);

  if (checkError) {
    console.log('Check error:', checkError);
  } else {
    console.log('Data in table:', checkData);
  }

  // Clean up test data
  console.log('\nCleaning up test data...');
  const { error: deleteError } = await supabase
    .from('zillow_new_listings')
    .delete()
    .eq('region_id', '102001');

  if (deleteError) {
    console.log('Delete error:', deleteError);
  } else {
    console.log('Test data cleaned up');
  }
}

main().catch(console.error);
