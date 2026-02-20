const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL || (() => { throw new Error('SUPABASE_URL is required'); })(),
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })()
);

async function importData() {
  const csv = fs.readFileSync('D:/Projects/rei-platform/unified_geography_crosswalk.csv', 'utf-8');
  const lines = csv.split('\n');
  const headers = lines[0].split(',');
  
  console.log('Parsing', lines.length - 1, 'rows...');
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
    const clean = vals.map(v => v.replace(/^"|"$/g, '').trim());
    
    rows.push({
      zip_code: clean[0] || null,
      zip_default_city: clean[1] || null,
      zip_default_state: clean[2] || null,
      county_fips: clean[3] || null,
      county_fips_3: clean[4] || null,
      county_name: clean[5] || null,
      county_population: clean[6] ? parseInt(clean[6]) : null,
      state_fips: clean[7] || null,
      state_abbrev: clean[8] || null,
      state_name: clean[9] || null,
      cbsa_code: clean[10] || null,
      cbsa_name: clean[11] || null,
      cbsa_type: clean[12] || null,
      cbsa_population: clean[13] ? parseInt(clean[13]) : null,
      zillow_state_region_id: clean[14] ? parseInt(clean[14]) : null,
      zillow_county_region_id: clean[15] ? parseInt(clean[15]) : null,
      zillow_metro_region_id: clean[16] ? parseInt(clean[16]) : null,
      zillow_metro_name: clean[17] || null,
    });
  }
  
  console.log('Inserting', rows.length, 'rows in batches...');
  
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('geography_crosswalk').upsert(batch, { onConflict: 'zip_code' });
    if (error) console.error('Batch', i, 'error:', error.message);
    else console.log('Inserted batch', i, '-', i + batch.length);
  }
  
  const { count } = await supabase.from('geography_crosswalk').select('*', { count: 'exact', head: true });
  console.log('Total rows in table:', count);
}

importData();
