import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pysflbhpnqwoczyuaaif.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I'
);

// Missing metros from ZORI SFR/MFR with their CBSA codes
// Source: Census Bureau CBSA definitions
const missingEntries = [
  // Major metros
  { zillow_region_id: '845158', zillow_region_name: 'Dayton, OH', cbsa_code: '19380', cbsa_title: 'Dayton-Kettering, OH' },
  { zillow_region_id: '845159', zillow_region_name: 'Poughkeepsie, NY', cbsa_code: '39100', cbsa_title: 'Poughkeepsie-Newburgh-Middletown, NY' },
  { zillow_region_id: '845160', zillow_region_name: 'Prescott Valley, AZ', cbsa_code: '39150', cbsa_title: 'Prescott Valley-Prescott, AZ' },
  { zillow_region_id: '845164', zillow_region_name: 'Lebanon, NH', cbsa_code: '30100', cbsa_title: 'Lebanon, NH-VT' },
  { zillow_region_id: '395237', zillow_region_name: 'Wooster, OH', cbsa_code: '49070', cbsa_title: 'Wooster, OH' },
  { zillow_region_id: '845163', zillow_region_name: 'Jasper, AL', cbsa_code: '27530', cbsa_title: 'Jasper, AL' },
  { zillow_region_id: '845162', zillow_region_name: 'Granbury, TX', cbsa_code: '24180', cbsa_title: 'Granbury, TX' },
  { zillow_region_id: '753877', zillow_region_name: 'Cullowhee, NC', cbsa_code: '18740', cbsa_title: 'Cullowhee, NC' },
  { zillow_region_id: '394608', zillow_region_name: 'Fort Polk South, LA', cbsa_code: '22660', cbsa_title: 'Fort Polk South, LA' },
  { zillow_region_id: '394603', zillow_region_name: 'Fort Dodge, IA', cbsa_code: '22700', cbsa_title: 'Fort Dodge, IA' },
  { zillow_region_id: '786252', zillow_region_name: 'Bonham, TX', cbsa_code: '14300', cbsa_title: 'Bonham, TX' },
  { zillow_region_id: '394481', zillow_region_name: 'Coffeyville, KS', cbsa_code: '18100', cbsa_title: 'Coffeyville, KS' },
  { zillow_region_id: '845169', zillow_region_name: 'Rockport, TX', cbsa_code: '10860', cbsa_title: 'Aransas Pass-Rockport, TX' },
  { zillow_region_id: '786253', zillow_region_name: 'Brownsville, TN', cbsa_code: '15620', cbsa_title: 'Brownsville, TN' },
  { zillow_region_id: '845167', zillow_region_name: 'Ottawa, IL', cbsa_code: '36860', cbsa_title: 'Ottawa, IL' },
  { zillow_region_id: '786262', zillow_region_name: 'Pella, IA', cbsa_code: '37800', cbsa_title: 'Pella, IA' },
];

async function addMissing() {
  console.log('Adding missing crosswalk entries...\n');

  for (const entry of missingEntries) {
    const { error } = await supabase
      .from('zillow_metro_crosswalk')
      .upsert(entry, { onConflict: 'zillow_region_id' });

    if (error) {
      console.log(`Error adding ${entry.zillow_region_name}: ${error.message}`);
    } else {
      console.log(`Added: ${entry.zillow_region_name} -> ${entry.cbsa_code}`);
    }
  }

  console.log('\nDone! Now re-run the import script.');
}

addMissing().catch(e => console.error('Error:', e));
