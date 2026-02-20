import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkZori() {
  // Get a sample row to see all columns
  console.log('Checking zillow_metrics table structure...\n');

  const { data, error } = await supabase
    .from('zillow_metrics')
    .select('*')
    .limit(1);

  if (error) {
    console.log('Error:', error.message);
  } else if (data && data.length > 0) {
    console.log('zillow_metrics columns:');
    Object.keys(data[0]).forEach(key => {
      const val = data[0][key];
      if (key.includes('zori') || key.includes('rent')) {
        console.log(`  ${key}: ${val}`);
      }
    });
    
    console.log('\nFull sample row:');
    console.log(JSON.stringify(data[0], null, 2));
  }
}

checkZori().catch(console.error);
