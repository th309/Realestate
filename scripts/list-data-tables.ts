import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function listTables() {
  console.log('=== Data Tables in Database ===\n');

  // Check known tables
  const tables = [
    'zillow_zhvi',
    'geography_crosswalk',
    'markets',
    'census_data',
    'economic_indicators',
    'rental_data',
    'property_listings',
  ];

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`  ${table}: Does not exist`);
        } else {
          console.log(`  ${table}: Error - ${error.message}`);
        }
      } else {
        console.log(`  ${table}: ${count?.toLocaleString() || 0} rows`);
      }
    } catch (e) {
      console.log(`  ${table}: Error checking`);
    }
  }

  // Check zillow_zhvi breakdown by geography
  console.log('\n=== zillow_zhvi breakdown by geography ===');
  const geographies = ['State', 'Metro', 'County', 'Zip', 'City'];

  for (const geo of geographies) {
    const { count } = await supabase
      .from('zillow_zhvi')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geo);
    console.log(`  ${geo}: ${count?.toLocaleString() || 0} records`);
  }

  console.log('\n=== Recommended Architecture ===');
  console.log(`
Data tables (separate per source):
├── zillow_zhvi         - Zillow Home Value Index (time series)
├── zillow_zri          - Zillow Rent Index (future)
├── census_demographics - Census population/demographics (future)
├── bls_employment      - Bureau of Labor Statistics (future)
└── ...

Integration layer:
├── geography_crosswalk - Maps between all ID systems
└── markets             - Market definitions with geometry
`);
}

listTables().catch(console.error);
