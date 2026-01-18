import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

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
