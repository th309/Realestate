const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL || (() => { throw new Error('SUPABASE_URL is required'); })(),
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })()
);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function importData() {
  const csv = fs.readFileSync('D:/Projects/rei-platform/unified_geography_crosswalk.csv', 'utf-8');
  const lines = csv.split('\n');
  const headers = parseCSVLine(lines[0]);
  
  console.log('Headers:', headers);
  console.log('Parsing', lines.length - 1, 'rows...');
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);
    
    const row = {
      zip_code: vals[0] || null,
      zip_default_city: vals[1] || null,
      zip_default_state: vals[2] || null,
      county_fips: vals[3] || null,
      county_fips_3: vals[4] || null,
      county_name: vals[5] || null,
      county_population: vals[6] ? parseInt(parseFloat(vals[6])) : null,
      state_fips: vals[7] || null,
      state_abbrev: vals[8] || null,
      state_name: vals[9] || null,
      cbsa_code: vals[10] || null,
      cbsa_name: vals[11] || null,
      cbsa_type: vals[12] || null,
      cbsa_population: vals[13] ? parseInt(parseFloat(vals[13])) : null,
      zillow_state_region_id: vals[14] ? parseInt(vals[14]) : null,
      zillow_county_region_id: vals[15] ? parseInt(parseFloat(vals[15])) : null,
      zillow_metro_region_id: vals[16] ? parseInt(parseFloat(vals[16])) : null,
      zillow_metro_name: vals[17] || null,
    };
    
    rows.push(row);
  }
  
  // Validate first few rows
  console.log('\nFirst 3 rows:');
  rows.slice(0,3).forEach(r => console.log(r.zip_code, r.state_abbrev, r.state_name, 'zillow_state:', r.zillow_state_region_id));
  
  console.log('\nInserting', rows.length, 'rows in batches...');
  
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from('geography_crosswalk').insert(batch);
    if (error) console.error('Batch', i, 'error:', error.message);
    else console.log('Inserted batch', i, '-', i + batch.length);
  }
  
  const { count } = await supabase.from('geography_crosswalk').select('*', { count: 'exact', head: true });
  console.log('\nTotal rows in table:', count);
}

importData();
