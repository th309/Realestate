/**
 * Run migration to remove foreign key constraint from zillow_zhvi
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function runMigration() {
  console.log('=== Testing FK constraint on zillow_zhvi ===\n');

  // Test if the constraint exists by trying to insert a record with non-existent region_id
  const testRecord = {
    region_id: 'TEST-CONSTRAINT-CHECK',
    date: '2025-01-15',
    value: 123456,
    geography: 'County',
    property_type: 'sfrcondo',
    tier: '0.33_0.67',
  };

  const { error: insertError } = await supabase
    .from('zillow_zhvi')
    .insert([testRecord]);

  if (insertError) {
    if (insertError.message.includes('foreign key') || insertError.message.includes('violates')) {
      console.log('❌ FK constraint EXISTS - needs to be removed\n');
      console.log('Please run this SQL in Supabase SQL Editor:\n');
      console.log('────────────────────────────────────────────');
      console.log('ALTER TABLE zillow_zhvi DROP CONSTRAINT IF EXISTS zillow_zhvi_region_id_fkey;');
      console.log('────────────────────────────────────────────\n');
      console.log('Then run the county import again.');
    } else {
      console.log('Different error:', insertError.message);
    }
  } else {
    console.log('✓ FK constraint is NOT present (or already removed)');
    console.log('  Test insert succeeded - ready for import!\n');

    // Clean up test record
    await supabase
      .from('zillow_zhvi')
      .delete()
      .eq('region_id', 'TEST-CONSTRAINT-CHECK');
    console.log('  (Test record cleaned up)');
  }
}

runMigration();
