import axios from 'axios';
import { parse } from 'csv-parse/sync';

const url = 'https://files.zillowstatic.com/research/public_csvs/zhvf_growth/Metro_zhvf_growth_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';

async function inspect() {
  console.log('Downloading ZHVF Metro CSV...\n');

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  console.log(`Downloaded ${(response.data.length / 1024).toFixed(1)} KB\n`);

  const records = parse(response.data, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Total records: ${records.length}\n`);

  const columns = Object.keys(records[0]);
  console.log('All columns:');
  columns.forEach((col, i) => console.log(`  ${i + 1}. ${col}`));

  console.log('\n--- First 3 records (all fields) ---');
  records.slice(0, 3).forEach((rec: any, i: number) => {
    console.log(`\nRecord ${i + 1}:`);
    Object.entries(rec).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  });
}

inspect().catch(console.error);
