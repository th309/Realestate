/**
 * Backfill state_fips in census_zip table using geography_crosswalk
 *
 * The census_zip table has state_fips and state_name columns but they're NULL.
 * This script uses the geography_crosswalk table to populate them.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// State abbreviation to FIPS mapping
const STATE_ABBR_TO_FIPS: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
  'CO': '08', 'CT': '09', 'DE': '10', 'DC': '11', 'FL': '12',
  'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
  'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23',
  'MD': '24', 'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28',
  'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33',
  'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
  'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44',
  'SC': '45', 'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49',
  'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55',
  'WY': '56', 'PR': '72', 'VI': '78', 'GU': '66', 'AS': '60', 'MP': '69',
};

// FIPS to state name mapping
const FIPS_TO_STATE_NAME: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
  '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia', '12': 'Florida',
  '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois', '18': 'Indiana',
  '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota', '28': 'Mississippi',
  '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada', '33': 'New Hampshire',
  '34': 'New Jersey', '35': 'New Mexico', '36': 'New York', '37': 'North Carolina', '38': 'North Dakota',
  '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas', '49': 'Utah',
  '50': 'Vermont', '51': 'Virginia', '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin',
  '56': 'Wyoming', '72': 'Puerto Rico', '78': 'Virgin Islands', '66': 'Guam', '60': 'American Samoa', '69': 'Northern Mariana Islands',
};

async function backfillZipState() {
  console.log('='.repeat(60));
  console.log('Backfilling state_fips in census_zip');
  console.log('='.repeat(60));

  // Step 1: Build ZIP to State mapping from crosswalk
  console.log('\nStep 1: Loading ZIP to State mapping from geography_crosswalk...');
  const zipToState = new Map<string, string>();
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('geography_crosswalk')
      .select('zip_code, state_abbrev')
      .not('zip_code', 'is', null)
      .not('state_abbrev', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error loading crosswalk:', error);
      break;
    }

    if (!data || data.length === 0) break;

    data.forEach(row => {
      if (row.zip_code && row.state_abbrev) {
        zipToState.set(row.zip_code, row.state_abbrev);
      }
    });

    page++;
    if (page % 10 === 0) {
      console.log(`  Loaded ${zipToState.size} mappings...`);
    }
    if (data.length < pageSize) break;
  }

  console.log(`Loaded ${zipToState.size} ZIP to State mappings`);

  // Step 2: Count how many ZCTAs need updating
  console.log('\nStep 2: Counting ZCTAs that need state info...');
  const { count: totalCount, error: countErr } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .is('state_fips', null);

  if (countErr) {
    console.error('Error counting ZCTAs:', countErr);
    return;
  }

  console.log(`Found ${totalCount} ZCTAs without state_fips`);

  // Step 3: Update in batches with pagination
  console.log('\nStep 3: Updating census_zip records...');
  const fetchSize = 1000;
  let updated = 0;
  let notFoundIds = new Set<string>(); // Track ZCTAs we can't update
  let processed = 0;
  let batchUpdated = 0;

  while (true) {
    // Fetch a batch of records that still need updating
    const { data: batch, error: fetchErr } = await supabase
      .from('census_zip')
      .select('id, zcta')
      .is('state_fips', null)
      .limit(fetchSize);

    if (fetchErr) {
      console.error('Error fetching batch:', fetchErr);
      break;
    }

    if (!batch || batch.length === 0) {
      console.log('  No more records to update');
      break;
    }

    batchUpdated = 0;

    // Update each record in this batch
    for (const row of batch) {
      // Skip if we already know this ZCTA can't be updated
      if (notFoundIds.has(row.zcta)) {
        continue;
      }

      const stateAbbr = zipToState.get(row.zcta);
      if (stateAbbr) {
        const stateFips = STATE_ABBR_TO_FIPS[stateAbbr];
        const stateName = FIPS_TO_STATE_NAME[stateFips];

        if (stateFips) {
          const { error: updateErr } = await supabase
            .from('census_zip')
            .update({ state_fips: stateFips, state_name: stateName })
            .eq('id', row.id);

          if (!updateErr) {
            updated++;
            batchUpdated++;
          }
        } else {
          notFoundIds.add(row.zcta);
        }
      } else {
        notFoundIds.add(row.zcta);
      }
    }

    processed += batch.length;
    console.log(`  Progress: ${processed}/${totalCount} (${updated} updated, ${notFoundIds.size} ZCTAs not in crosswalk)`);

    // If we didn't update any in this batch, we're stuck - break
    if (batchUpdated === 0) {
      console.log(`  Stopping: No updates in last batch (${notFoundIds.size} ZCTAs cannot be mapped)`);
      break;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done! Updated ${updated} records, ${notFoundIds.size} ZCTAs not found in crosswalk`);
  console.log('='.repeat(60));

  // Verify
  const { count: stillNull } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .is('state_fips', null);

  const { count: withState } = await supabase
    .from('census_zip')
    .select('*', { count: 'exact', head: true })
    .not('state_fips', 'is', null);

  console.log(`\nVerification:`);
  console.log(`  Records with state_fips: ${withState}`);
  console.log(`  Records still NULL: ${stillNull}`);
}

backfillZipState().catch(console.error);
