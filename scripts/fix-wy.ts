import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

async function fix() {
  // PR was incorrectly set to 58 (which is Wyoming's ID)
  // Set PR to null to remove the conflict
  console.log('Fixing PR: removing incorrect zillow_state_region_id');

  const { error } = await supabase
    .from('geography_crosswalk')
    .update({ zillow_state_region_id: null })
    .eq('state_abbrev', 'PR');

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Done! PR zillow_state_region_id set to null');
  }

  // Verify
  const { data: wy } = await supabase
    .from('geography_crosswalk')
    .select('state_abbrev, zillow_state_region_id')
    .eq('state_abbrev', 'WY')
    .limit(1);

  const { data: pr } = await supabase
    .from('geography_crosswalk')
    .select('state_abbrev, zillow_state_region_id')
    .eq('state_abbrev', 'PR')
    .limit(1);

  console.log('WY:', wy?.[0]);
  console.log('PR:', pr?.[0]);
}

fix();
