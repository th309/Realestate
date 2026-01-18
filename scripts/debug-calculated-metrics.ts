/**
 * Debug calculated_metrics table schema
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkSchema() {
  console.log('Checking calculated_metrics table...\n');

  // Try to get one row to see the columns
  const { data, error } = await supabase
    .from('calculated_metrics')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error querying table:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log('Existing columns in calculated_metrics:');
    console.log(Object.keys(data[0]));
    console.log('\nSample row:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('Table is empty.');
  }

  // Try inserting a test record to see errors
  console.log('\n--- Testing insert with inventory_surplus_pct column ---');
  const testRecord = {
    geography_id: 'TEST123',
    geography_type: 'test',
    geography_name: 'Test Region',
    period_date: '2025-12-01',
    inventory_surplus_pct: 100,
    calculated_at: new Date().toISOString(),
  };

  console.log('Attempting to insert:', testRecord);

  const { error: insertError, data: insertData } = await supabase
    .from('calculated_metrics')
    .insert(testRecord)
    .select();

  if (insertError) {
    console.log('\nInsert error:', insertError.message);
    console.log('Error code:', insertError.code);
    console.log('Error details:', insertError.details);
    console.log('Error hint:', insertError.hint);
  } else {
    console.log('\nInsert succeeded!');
    console.log('Inserted row:', insertData);

    // Delete the test record
    const { error: deleteError } = await supabase
      .from('calculated_metrics')
      .delete()
      .eq('geography_id', 'TEST123')
      .eq('geography_type', 'test');

    if (deleteError) {
      console.log('Warning: Could not delete test record:', deleteError.message);
    } else {
      console.log('Test record deleted.');
    }
  }
}

checkSchema().catch(console.error);
