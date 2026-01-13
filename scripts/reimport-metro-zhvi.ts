/**
 * Re-import Metro ZHVI data from local CSV file
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { parse as parseSync } from 'csv-parse/sync';

config({ path: join(__dirname, '../packages/backend/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function importMetroZhvi() {
  console.log('Re-importing Metro ZHVI data from local CSV...\n');

  const csvPath = join(__dirname, '../data/zillow/zhvi-metro-all-homes-sm-sa.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');

  const records: any[] = parseSync(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  console.log(`Parsed ${records.length} metros from CSV`);

  // Extract date columns
  const sampleRecord = records[0];
  const dateColumns = Object.keys(sampleRecord).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
  console.log(`Found ${dateColumns.length} date columns (${dateColumns[0]} to ${dateColumns[dateColumns.length - 1]})`);

  // Build all time series records
  const allData: any[] = [];

  for (const record of records) {
    const regionId = record.RegionID;
    if (!regionId) continue;

    for (const dateCol of dateColumns) {
      const value = parseFloat(record[dateCol]);
      if (!isNaN(value) && value > 0) {
        allData.push({
          region_id: regionId,
          date: dateCol,
          value: value,
          property_type: 'sfrcondo',
          tier: '0.33_0.67',
          geography: 'Metro'
        });
      }
    }
  }

  console.log(`Total records to insert: ${allData.length.toLocaleString()}`);

  // Batch upsert
  const batchSize = 5000;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < allData.length; i += batchSize) {
    const batch = allData.slice(i, i + batchSize);

    const { error } = await supabase
      .from('zillow_zhvi')
      .upsert(batch, { onConflict: 'region_id,date,property_type,tier' });

    if (error) {
      console.error(`Batch ${i / batchSize + 1} error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
    }

    const pct = Math.round((i + batch.length) / allData.length * 100);
    process.stdout.write(`Progress: ${inserted.toLocaleString()} records (${pct}%)\r`);
  }

  console.log(`\n\nDone! Inserted ${inserted.toLocaleString()} records, ${errors} batch errors`);

  // Verify
  const { count } = await supabase
    .from('zillow_zhvi')
    .select('*', { count: 'exact', head: true })
    .eq('geography', 'Metro');

  console.log(`Metro records now in database: ${count?.toLocaleString()}`);
}

importMetroZhvi().catch(console.error);
