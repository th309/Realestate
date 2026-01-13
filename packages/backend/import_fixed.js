const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

async function importData() {
  const csv = fs.readFileSync('D:/Projects/rei-platform/unified_geography_crosswalk.csv', 'utf-8');
  const lines = csv.split('\n');
  console.log('Parsing', lines.length - 1, 'rows...');
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const v = parseCSVLine(lines[i]);
    rows.push({
      zip_code: v[0] || null,
      zip_default_city: v[1] || null,
      zip_default_state: v[2] || null,
      county_fips: v[3] || null,
      county_fips_3: v[4] || null,
      county_name: v[5] || null,
      county_population: v[6] ? parseInt(parseFloat(v[6])) : null,
      state_fips: v[7] || null,
      state_abbrev: v[8] || null,
      state_name: v[9] || null,
      cbsa_code: v[10] || null,
      cbsa_name: v[11] || null,
      cbsa_type: v[12] || null,
      cbsa_population: v[13] ? parseInt(parseFloat(v[13])) : null,
      zillow_state_region_id: v[14] ? parseInt(parseFloat(v[14])) : null,
      zillow_county_region_id: v[15] ? parseInt(parseFloat(v[15])) : null,
      zillow_metro_region_id: v[16] ? parseInt(parseFloat(v[16])) : null,
      zillow_metro_name: v[17] || null,
    });
  }
  
  console.log('Sample:', rows[0].state_abbrev, '->', rows[0].zillow_state_region_id);
  console.log('Inserting', rows.length, 'rows...');
  
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('geography_crosswalk').insert(batch);
    if (error) console.error('Batch', i, error.message);
    else console.log('Batch', i, '-', i + batch.length);
  }
  console.log('Done!');
}
importData();
