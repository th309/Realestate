/**
 * Re-download BEA RPP data with corrected API parameters
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fetchBEARPP } from './census-economic-import/api-clients';
import { STATE_FIPS_TO_NAME } from './census-economic-import/types';

const OUTPUT_DIR = join(__dirname, '../data/economic');

function saveCSV(filename: string, data: any[], headers?: string[]): void {
  if (data.length === 0) {
    console.log(`  Skipping ${filename} - no data`);
    return;
  }

  const csvHeaders = headers || Object.keys(data[0]);
  const rows = data.map(row =>
    csvHeaders.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(',')
  );

  const csv = [csvHeaders.join(','), ...rows].join('\n');
  const filePath = join(OUTPUT_DIR, filename);
  writeFileSync(filePath, csv);
  console.log(`  Saved ${filePath} (${data.length} records)`);
}

async function main() {
  console.log('Re-downloading BEA RPP data with corrected API parameters...\n');

  // State RPP
  console.log('State Cost of Living (BEA RPP)...');
  const stateRppResult = await fetchBEARPP('STATE', 'LAST10');
  if (stateRppResult.success && stateRppResult.data) {
    const records = stateRppResult.data
      .filter(row => row.GeoFips && row.GeoFips !== '00000')
      .map(row => ({
        period_date: `${row.TimePeriod}-01-01`,
        state_fips: row.GeoFips?.substring(0, 2) || '',
        state_name: row.GeoName || '',
        rpp_all_items: row.DataValue
      }));
    saveCSV('bea_state_rpp.csv', records);

    // Show sample to verify
    console.log('\n  Sample values (should be ~80-120):');
    records.slice(0, 5).forEach(r => {
      console.log(`    ${r.state_name}: ${r.rpp_all_items}`);
    });
  }

  // Metro RPP
  console.log('\nMetro Cost of Living (BEA RPP)...');
  const metroRppResult = await fetchBEARPP('MSA', 'LAST10');
  if (metroRppResult.success && metroRppResult.data) {
    const records = metroRppResult.data
      .filter(row => row.GeoFips && row.GeoFips.length >= 5)
      .map(row => ({
        period_date: `${row.TimePeriod}-01-01`,
        cbsa_code: row.GeoFips?.substring(0, 5) || '',
        cbsa_title: row.GeoName || '',
        rpp_all_items: row.DataValue
      }));
    saveCSV('bea_metro_rpp.csv', records);

    // Show sample to verify
    console.log('\n  Sample values (should be ~50-130):');
    records.slice(0, 5).forEach(r => {
      console.log(`    ${r.cbsa_title}: ${r.rpp_all_items}`);
    });
  }

  console.log('\nDone!');
}

main().catch(console.error);
