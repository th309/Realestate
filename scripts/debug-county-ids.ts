/**
 * Debug county ID formats between Zillow and GeoJSON
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debug() {
  console.log('=== Debugging County ID Formats ===\n');

  // Get sample of Zillow county data
  const { data: zhviData } = await supabase
    .from('zillow_zhvi')
    .select('region_id, value, date')
    .eq('geography', 'County')
    .order('date', { ascending: false })
    .limit(20);

  console.log('Zillow County region_ids (sample):');
  zhviData?.forEach(d => console.log(`  ${d.region_id}`));

  // Fetch GeoJSON to see what format it uses
  console.log('\n\nFetching GeoJSON to check FIPS format...');
  const response = await fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json');
  const geojson = await response.json();

  console.log('\nGeoJSON county IDs (sample):');
  geojson.features.slice(0, 10).forEach((f: any) => {
    console.log(`  ID: ${f.id}, Name: ${f.properties?.NAME}`);
  });

  // Check if any Zillow IDs match GeoJSON IDs
  const geojsonIds = new Set(geojson.features.map((f: any) => f.id));
  const zhviIds = zhviData?.map(d => d.region_id) || [];

  console.log('\n\nMatching analysis:');
  console.log(`GeoJSON has ${geojsonIds.size} county IDs`);
  console.log(`Zillow sample has ${zhviIds.length} county IDs`);

  const matches = zhviIds.filter(id => geojsonIds.has(id));
  console.log(`Direct matches: ${matches.length}`);

  // Try with leading zeros
  const matchesWithZeros = zhviIds.filter(id => geojsonIds.has(id.padStart(5, '0')));
  console.log(`Matches with padding: ${matchesWithZeros.length}`);

  // Show what the padded versions would be
  console.log('\nZillow IDs padded to 5 digits:');
  zhviIds.slice(0, 10).forEach(id => {
    const padded = id.padStart(5, '0');
    const exists = geojsonIds.has(padded);
    console.log(`  ${id} -> ${padded} (in GeoJSON: ${exists})`);
  });
}

debug();
