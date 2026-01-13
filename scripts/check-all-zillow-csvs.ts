/**
 * Check all Zillow CSV columns to understand available mapping codes
 */

import { parse } from 'csv-parse/sync';

async function checkAllCsvColumns() {
  const csvUrls = {
    State: 'https://files.zillowstatic.com/research/public_csvs/zhvi/State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    Metro: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    County: 'https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
    Zip: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  };

  for (const [level, url] of Object.entries(csvUrls)) {
    console.log(`\n=== ${level} CSV ===`);
    const response = await fetch(url);
    const text = await response.text();
    const records = parse(text, { columns: true, skip_empty_lines: true, to: 3 });

    const nonDateCols = Object.keys(records[0]).filter(k => !k.match(/^\d{4}-\d{2}-\d{2}$/));
    console.log('Columns:', nonDateCols.join(', '));

    console.log('\nSample rows:');
    records.forEach((row: any, i: number) => {
      console.log(`\nRow ${i + 1}:`);
      nonDateCols.forEach(col => {
        console.log(`  ${col}: ${row[col]}`);
      });
    });
  }
}

checkAllCsvColumns();
