/**
 * Check Zillow County CSV columns to find FIPS code
 */

import { parse } from 'csv-parse/sync';

async function checkCsv() {
  console.log('Downloading Zillow County CSV...');
  const response = await fetch('https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv');
  const text = await response.text();

  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    to: 5  // Just first 5 rows
  });

  console.log('\nCSV Columns:');
  console.log(Object.keys(records[0]).filter(k => !k.match(/^\d{4}-\d{2}-\d{2}$/)).join('\n'));

  console.log('\n\nSample rows (non-date columns):');
  records.forEach((row: any, i: number) => {
    console.log(`\nRow ${i + 1}:`);
    Object.keys(row).filter(k => !k.match(/^\d{4}-\d{2}-\d{2}$/)).forEach(k => {
      console.log(`  ${k}: ${row[k]}`);
    });
  });
}

checkCsv();
