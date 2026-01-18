/**
 * Download metro unemployment data from FRED
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fetchFREDUnemploymentMetros } from './census-economic-import/api-clients';

const OUTPUT_DIR = join(__dirname, '../data/economic');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function download() {
  console.log('Downloading Metro Unemployment from FRED...\n');

  const result = await fetchFREDUnemploymentMetros(2000);

  if (result.success && result.data) {
    const records = result.data.map(obs => ({
      period_date: obs.date,
      cbsa_code: obs.cbsa_code,
      unemployment_rate: obs.value
    }));

    // Convert to CSV
    if (records.length > 0) {
      const headers = Object.keys(records[0]);
      const csv = [
        headers.join(','),
        ...records.map(r => headers.map(h => (r as any)[h]).join(','))
      ].join('\n');

      const filepath = join(OUTPUT_DIR, 'fred_metro_unemployment.csv');
      writeFileSync(filepath, csv, 'utf-8');
      console.log(`Saved ${records.length} records to ${filepath}`);
    }
  } else {
    console.log('Failed:', result.error);
  }
}

download().catch(console.error);
