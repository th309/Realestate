/**
 * Download full county unemployment data from BLS with API key
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { fetchBLSCountyUnemployment } from './census-economic-import/api-clients';

const OUTPUT_DIR = join(__dirname, '../data/economic');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function download() {
  console.log('Downloading County Unemployment from BLS (with API key)...\n');

  // Get county list from BEA GDP data
  const gdpPath = join(OUTPUT_DIR, 'bea_county_gdp.csv');
  if (!existsSync(gdpPath)) {
    console.log('BEA county GDP file not found. Run economic download first.');
    return;
  }

  const gdpContent = readFileSync(gdpPath, 'utf-8');
  const gdpRows = parse(gdpContent, { columns: true, skip_empty_lines: true }) as Array<{ fips_code: string }>;
  const uniqueCountyFips = [...new Set(gdpRows.map(r => r.fips_code))];
  console.log(`Found ${uniqueCountyFips.length} unique counties in BEA GDP data\n`);

  // Fetch from BLS - with API key we get 500 requests/day instead of 25
  const currentYear = new Date().getFullYear();
  const result = await fetchBLSCountyUnemployment(uniqueCountyFips, 2015, currentYear);

  if (result.success && result.data) {
    const records = result.data.map(obs => ({
      period_date: obs.date,
      fips_code: obs.fips_code,
      state_fips: obs.state_fips,
      unemployment_rate: obs.value
    }));

    // Convert to CSV
    if (records.length > 0) {
      const headers = Object.keys(records[0]);
      const csv = [
        headers.join(','),
        ...records.map(r => headers.map(h => (r as any)[h]).join(','))
      ].join('\n');

      const filepath = join(OUTPUT_DIR, 'fred_county_unemployment.csv');
      writeFileSync(filepath, csv, 'utf-8');
      console.log(`\nSaved ${records.length} records to ${filepath}`);
    }
  } else {
    console.log('Failed:', result.error);
  }
}

download().catch(console.error);
