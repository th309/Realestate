/**
 * Download metro unemployment data from BLS for ALL metros
 * Uses the LAUMT series format which provides monthly data
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { fetchBLSMetroUnemployment } from './census-economic-import/api-clients';

// Use process.cwd() for compatibility with both CommonJS and ES modules
const OUTPUT_DIR = join(process.cwd(), 'data/economic');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function download() {
  console.log('Downloading Metro Unemployment from BLS (all metros)...\n');

  // Get metro list from BEA GDP data (has CBSA codes and titles)
  const gdpPath = join(OUTPUT_DIR, 'bea_metro_gdp.csv');
  if (!existsSync(gdpPath)) {
    console.log('BEA metro GDP file not found. Run economic download first.');
    return;
  }

  const gdpContent = readFileSync(gdpPath, 'utf-8');
  const gdpRows = parse(gdpContent, { columns: true, skip_empty_lines: true }) as Array<{
    cbsa_code: string;
    cbsa_title: string;
  }>;

  // Get unique metros (exclude aggregate codes like 00998)
  const metroMap = new Map<string, { cbsa_code: string; cbsa_title: string }>();
  for (const row of gdpRows) {
    if (row.cbsa_code && row.cbsa_code.length === 5 && !row.cbsa_code.startsWith('00')) {
      metroMap.set(row.cbsa_code, { cbsa_code: row.cbsa_code, cbsa_title: row.cbsa_title });
    }
  }

  const metros = Array.from(metroMap.values());
  console.log(`Found ${metros.length} unique metros in BEA GDP data\n`);

  // Fetch from BLS - 2015-2025 to keep request count reasonable
  const currentYear = new Date().getFullYear();
  const result = await fetchBLSMetroUnemployment(metros, 2015, currentYear);

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

      const filepath = join(OUTPUT_DIR, 'bls_metro_unemployment.csv');
      writeFileSync(filepath, csv, 'utf-8');
      console.log(`\nSaved ${records.length} records to ${filepath}`);
    }
  } else {
    console.log('Failed:', result.error);
  }
}

download().catch(console.error);
