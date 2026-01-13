/**
 * Find CBSA codes for the 17 metros in zillow_metro
 * by checking the crosswalk CSV
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseSync } from 'csv-parse/sync';

const METROS = [
  { region_id: 395149, name: 'Taos, NM' },
  { region_id: 395015, name: 'Reading, PA' },
  { region_id: 394502, name: 'Corpus Christi, TX' },
  { region_id: 394419, name: 'Brookings, SD' },
  { region_id: 394324, name: 'Americus, GA' },
  { region_id: 394491, name: 'Columbus, NE' },
  { region_id: 395150, name: 'Taylorville, IL' },
  { region_id: 394335, name: 'Arcadia, FL' },
  { region_id: 394786, name: 'Lewisburg, TN' },
  { region_id: 395084, name: 'Seneca Falls, NY' },
  { region_id: 394533, name: 'Dickinson, ND' },
  { region_id: 395207, name: 'Washington, IN' },
  { region_id: 786262, name: 'Pella, IA' },
  { region_id: 394421, name: 'Brownsville, TX' },
  { region_id: 394820, name: 'Manchester, NH' },
  { region_id: 753902, name: 'Malvern, AR' },
  { region_id: 395165, name: 'Troy, AL' },
];

async function findMappings() {
  console.log('Reading crosswalk CSV...\n');

  const csvPath = join(__dirname, '../unified_geography_crosswalk.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const records: any[] = parseSync(csvContent, { columns: true, skip_empty_lines: true });

  console.log(`Total crosswalk records: ${records.length}`);
  console.log('\nCrossswalk columns:', Object.keys(records[0]).join(', '));

  // Build lookups
  const byRegionId = new Map<number, any>();
  const byName = new Map<string, any>();

  for (const r of records) {
    const zillowMetroId = parseInt(r.zillow_metro_region_id, 10);
    if (!isNaN(zillowMetroId) && r.cbsa_code) {
      byRegionId.set(zillowMetroId, r);
    }
    // Also try by name
    const metroName = (r.zillow_metro_name || r.cbsa_name || '').toLowerCase().trim();
    if (metroName && r.cbsa_code) {
      byName.set(metroName, r);
    }
  }

  console.log(`\nUnique Zillow metro IDs in crosswalk: ${byRegionId.size}`);
  console.log(`Unique metro names in crosswalk: ${byName.size}`);

  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR CBSA CODES FOR EACH METRO:');
  console.log('='.repeat(80));

  for (const metro of METROS) {
    const byId = byRegionId.get(metro.region_id);
    const nameLower = metro.name.toLowerCase().trim();
    const byNameMatch = byName.get(nameLower);

    if (byId) {
      console.log(`\n✓ ${metro.region_id}: "${metro.name}"`);
      console.log(`  Found by ID -> CBSA: ${byId.cbsa_code} (${byId.cbsa_name || byId.zillow_metro_name})`);
    } else if (byNameMatch) {
      console.log(`\n✓ ${metro.region_id}: "${metro.name}"`);
      console.log(`  Found by name -> CBSA: ${byNameMatch.cbsa_code} (${byNameMatch.cbsa_name})`);
    } else {
      console.log(`\n✗ ${metro.region_id}: "${metro.name}"`);
      console.log(`  NOT FOUND in crosswalk`);

      // Try partial match
      const partialMatches: any[] = [];
      const primaryCity = metro.name.split(',')[0].toLowerCase();
      for (const [name, r] of byName) {
        if (name.includes(primaryCity) || primaryCity.includes(name.split(',')[0])) {
          partialMatches.push({ name, cbsa: r.cbsa_code, cbsa_name: r.cbsa_name });
        }
      }
      if (partialMatches.length > 0) {
        console.log(`  Partial matches:`);
        partialMatches.slice(0, 3).forEach(m =>
          console.log(`    - "${m.name}" -> ${m.cbsa} (${m.cbsa_name})`)
        );
      }
    }
  }
}

findMappings().catch(console.error);
