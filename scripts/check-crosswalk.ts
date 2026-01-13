/**
 * Check Zillow's official crosswalk file for ID mappings
 */

import { parse } from 'csv-parse/sync';

async function checkCrosswalk() {
  console.log('Downloading Zillow CrossWalk file...');
  const response = await fetch('http://files.zillowstatic.com/research/public/CountyCrossWalk_Zillow.csv');
  const text = await response.text();

  console.log('File size:', (text.length / 1024).toFixed(1), 'KB');

  const records = parse(text, { columns: true, skip_empty_lines: true });

  console.log('\nColumns:', Object.keys(records[0]).join(', '));
  console.log('Total rows:', records.length);

  console.log('\nSample rows:');
  records.slice(0, 5).forEach((row: any, i: number) => {
    console.log(`\nRow ${i + 1}:`);
    Object.entries(row).forEach(([k, v]) => {
      console.log(`  ${k}: ${v}`);
    });
  });

  // Check unique metros
  const metros = new Map<string, string>();
  records.forEach((row: any) => {
    if (row.MetroRegionID_Zillow && row.CBSACode) {
      metros.set(row.MetroRegionID_Zillow, row.CBSACode);
    }
  });
  console.log('\n\nUnique Metro mappings:', metros.size);
  console.log('Sample metro mappings:');
  let count = 0;
  for (const [zillowId, cbsa] of metros) {
    if (count++ < 10) {
      console.log(`  Zillow ${zillowId} -> CBSA ${cbsa}`);
    }
  }

  // Check state mappings
  const states = new Map<string, string>();
  records.forEach((row: any) => {
    if (row.StateRegionID_Zillow && row.StateFIPS) {
      states.set(row.StateRegionID_Zillow, row.StateFIPS);
    }
  });
  console.log('\n\nUnique State mappings:', states.size);
  console.log('Sample state mappings:');
  count = 0;
  for (const [zillowId, fips] of states) {
    if (count++ < 10) {
      console.log(`  Zillow ${zillowId} -> FIPS ${fips}`);
    }
  }
}

checkCrosswalk();
