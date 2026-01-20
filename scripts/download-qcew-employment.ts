/**
 * Download QCEW (Quarterly Census of Employment and Wages) Data
 *
 * BLS QCEW provides employment data for ALL counties and metros quarterly.
 * This fills the gap where FRED only has data for 3 metros.
 *
 * Data source: https://www.bls.gov/cew/downloadable-data-files.htm
 * API docs: https://www.bls.gov/cew/additional-resources/open-data/
 *
 * URL format: https://data.bls.gov/cew/data/api/{year}/{qtr}/area/{area_fips}.csv
 *
 * We extract "Total, all industries" (industry_code 10) with "Private" ownership (own_code 5)
 * to get total private sector employment for each area.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

const OUTPUT_DIR = join(__dirname, '../data/economic');
const QCEW_BASE_URL = 'https://data.bls.gov/cew/data/api';

// Rate limiting - BLS asks for reasonable request rates
const DELAY_MS = 100; // 100ms between requests
const BATCH_SIZE = 50; // Process in batches

interface QCEWRecord {
  area_fips: string;
  own_code: string;
  industry_code: string;
  year: string;
  qtr: string;
  month1_emplvl: string;
  month2_emplvl: string;
  month3_emplvl: string;
  qtrly_estabs: string;
  total_qtrly_wages: string;
}

interface EmploymentRecord {
  period_date: string;
  area_code: string;
  area_type: 'county' | 'metro';
  total_employment: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch QCEW data for a single area and quarter
 */
async function fetchQCEWData(year: number, qtr: number, areaFips: string): Promise<QCEWRecord[] | null> {
  const url = `${QCEW_BASE_URL}/${year}/${qtr}/area/${areaFips}.csv`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        // No data for this area/period - common for newer areas
        return null;
      }
      console.warn(`  HTTP ${response.status} for ${areaFips} ${year}Q${qtr}`);
      return null;
    }

    const csvText = await response.text();
    if (!csvText.trim() || csvText.includes('No Data')) {
      return null;
    }

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true
    }) as QCEWRecord[];

    return records;
  } catch (error) {
    console.warn(`  Error fetching ${areaFips}: ${error}`);
    return null;
  }
}

/**
 * Extract total private employment from QCEW records
 * own_code 5 = Private, industry_code 10 = Total, all industries
 */
function extractPrivateEmployment(records: QCEWRecord[], areaCode: string, areaType: 'county' | 'metro'): EmploymentRecord[] {
  const results: EmploymentRecord[] = [];

  // Filter for Total Private (own_code=5, industry_code=10)
  const privateTotal = records.filter(r =>
    r.own_code === '5' && r.industry_code === '10'
  );

  for (const record of privateTotal) {
    // QCEW provides monthly employment levels for each quarter
    // We'll use month3 (end of quarter) as the quarterly value
    const employment = parseInt(record.month3_emplvl);
    if (isNaN(employment) || employment === 0) continue;

    // Convert quarter to date (last month of quarter)
    const qtr = parseInt(record.qtr);
    const month = qtr * 3; // Q1=3, Q2=6, Q3=9, Q4=12
    const periodDate = `${record.year}-${String(month).padStart(2, '0')}-01`;

    results.push({
      period_date: periodDate,
      area_code: areaCode,
      area_type: areaType,
      total_employment: employment
    });
  }

  return results;
}

/**
 * Get list of all US county FIPS codes from existing data
 */
function getCountyFipsList(): string[] {
  const countyPath = join(OUTPUT_DIR, 'fred_county_unemployment.csv');
  if (!existsSync(countyPath)) {
    console.log('County unemployment file not found. Using BEA county GDP file.');
    const gdpPath = join(OUTPUT_DIR, 'bea_county_gdp.csv');
    if (!existsSync(gdpPath)) {
      throw new Error('No county reference file found. Run economic download first.');
    }
    const content = readFileSync(gdpPath, 'utf-8');
    const rows = parse(content, { columns: true }) as Array<{ fips_code: string }>;
    const fipsSet = new Set<string>();
    for (const row of rows) {
      if (row.fips_code && row.fips_code.length === 5) {
        fipsSet.add(row.fips_code);
      }
    }
    return Array.from(fipsSet).sort();
  }

  const content = readFileSync(countyPath, 'utf-8');
  const rows = parse(content, { columns: true }) as Array<{ fips_code: string }>;
  const fipsSet = new Set<string>();
  for (const row of rows) {
    if (row.fips_code && row.fips_code.length === 5) {
      fipsSet.add(row.fips_code);
    }
  }
  return Array.from(fipsSet).sort();
}

/**
 * Get list of all MSA CBSA codes from existing data
 */
function getMetroCbsaList(): string[] {
  const gdpPath = join(OUTPUT_DIR, 'bea_metro_gdp.csv');
  if (!existsSync(gdpPath)) {
    throw new Error('Metro GDP file not found. Run economic download first.');
  }

  const content = readFileSync(gdpPath, 'utf-8');
  const rows = parse(content, { columns: true }) as Array<{ cbsa_code: string }>;
  const cbsaSet = new Set<string>();
  for (const row of rows) {
    // Valid CBSA codes are 5 digits, not starting with 00
    if (row.cbsa_code && row.cbsa_code.length === 5 && !row.cbsa_code.startsWith('00')) {
      cbsaSet.add(row.cbsa_code);
    }
  }
  return Array.from(cbsaSet).sort();
}

/**
 * Convert CBSA code to QCEW MSA area code format
 * QCEW uses format "CXXXX0" for MSAs where XXXX is the first 4 digits of CBSA
 */
function cbsaToQcewMsa(cbsa: string): string {
  // QCEW MSA codes are "CXXXXX" format - C followed by 5-digit CBSA code
  return `C${cbsa}`;
}

/**
 * Download employment data for all counties
 */
async function downloadCountyEmployment(startYear: number, endYear: number): Promise<EmploymentRecord[]> {
  const counties = getCountyFipsList();
  console.log(`\nDownloading county employment for ${counties.length} counties...`);

  const allRecords: EmploymentRecord[] = [];
  const currentYear = new Date().getFullYear();
  const currentQtr = Math.ceil((new Date().getMonth() + 1) / 3);

  // QCEW data is released ~6 months after quarter end
  // Only fetch quarters that should have data available
  const quarters: Array<{ year: number; qtr: number }> = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let qtr = 1; qtr <= 4; qtr++) {
      // Skip future quarters
      if (year === currentYear && qtr >= currentQtr) continue;
      // Skip quarters less than 6 months old (data not yet available)
      const monthsAgo = (currentYear - year) * 12 + (currentQtr * 3 - qtr * 3);
      if (monthsAgo < 6) continue;
      quarters.push({ year, qtr });
    }
  }

  console.log(`  Fetching ${quarters.length} quarters of data`);

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < counties.length; i += BATCH_SIZE) {
    const batch = counties.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(counties.length / BATCH_SIZE);

    console.log(`  Processing county batch ${batchNum}/${totalBatches} (${batch[0]} - ${batch[batch.length - 1]})`);

    for (const fips of batch) {
      // For efficiency, we'll fetch the most recent year's data
      // The bulk files are better for historical data
      const recentYear = endYear;
      for (const { year, qtr } of quarters.filter(q => q.year >= recentYear - 1)) {
        const records = await fetchQCEWData(year, qtr, fips);
        if (records) {
          const employment = extractPrivateEmployment(records, fips, 'county');
          allRecords.push(...employment);
        }
        await sleep(DELAY_MS);
      }
    }
  }

  console.log(`  Downloaded ${allRecords.length} county employment records`);
  return allRecords;
}

/**
 * Download employment data for all metros
 */
async function downloadMetroEmployment(startYear: number, endYear: number): Promise<EmploymentRecord[]> {
  const metros = getMetroCbsaList();
  console.log(`\nDownloading metro employment for ${metros.length} metros...`);

  const allRecords: EmploymentRecord[] = [];
  const currentYear = new Date().getFullYear();
  const currentQtr = Math.ceil((new Date().getMonth() + 1) / 3);

  // Build list of quarters to fetch
  const quarters: Array<{ year: number; qtr: number }> = [];
  for (let year = startYear; year <= endYear; year++) {
    for (let qtr = 1; qtr <= 4; qtr++) {
      if (year === currentYear && qtr >= currentQtr) continue;
      const monthsAgo = (currentYear - year) * 12 + (currentQtr * 3 - qtr * 3);
      if (monthsAgo < 6) continue;
      quarters.push({ year, qtr });
    }
  }

  console.log(`  Fetching ${quarters.length} quarters of data`);

  for (let i = 0; i < metros.length; i += BATCH_SIZE) {
    const batch = metros.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(metros.length / BATCH_SIZE);

    console.log(`  Processing metro batch ${batchNum}/${totalBatches}`);

    for (const cbsa of batch) {
      const qcewCode = cbsaToQcewMsa(cbsa);

      for (const { year, qtr } of quarters) {
        const records = await fetchQCEWData(year, qtr, qcewCode);
        if (records) {
          const employment = extractPrivateEmployment(records, cbsa, 'metro');
          allRecords.push(...employment);
        }
        await sleep(DELAY_MS);
      }
    }
  }

  console.log(`  Downloaded ${allRecords.length} metro employment records`);
  return allRecords;
}

/**
 * Calculate YoY employment growth
 */
function calculateEmploymentYoY(records: EmploymentRecord[]): Array<{
  period_date: string;
  area_code: string;
  area_type: 'county' | 'metro';
  total_employment: number;
  employment_yoy: number | null;
}> {
  // Sort by area and date
  const sorted = [...records].sort((a, b) => {
    const areaCompare = a.area_code.localeCompare(b.area_code);
    if (areaCompare !== 0) return areaCompare;
    return a.period_date.localeCompare(b.period_date);
  });

  // Create lookup for previous year values
  const lookup = new Map<string, EmploymentRecord>();
  for (const record of sorted) {
    const key = `${record.area_code}|${record.period_date}`;
    lookup.set(key, record);
  }

  // Calculate YoY
  return sorted.map(record => {
    const currentDate = new Date(record.period_date);
    const prevDate = new Date(currentDate);
    prevDate.setFullYear(prevDate.getFullYear() - 1);
    const prevKey = `${record.area_code}|${prevDate.toISOString().slice(0, 10)}`;
    const prevRecord = lookup.get(prevKey);

    let employment_yoy: number | null = null;
    if (prevRecord && prevRecord.total_employment > 0) {
      employment_yoy = ((record.total_employment - prevRecord.total_employment) / prevRecord.total_employment) * 100;
      employment_yoy = Math.round(employment_yoy * 100) / 100; // Round to 2 decimal places
    }

    return {
      ...record,
      employment_yoy
    };
  });
}

/**
 * Save to CSV files
 */
function saveResults(countyData: ReturnType<typeof calculateEmploymentYoY>, metroData: ReturnType<typeof calculateEmploymentYoY>): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Save county employment
  if (countyData.length > 0) {
    const countyRecords = countyData.map(r => ({
      period_date: r.period_date,
      fips_code: r.area_code,
      total_nonfarm_employment: r.total_employment,
      employment_yoy: r.employment_yoy ?? ''
    }));

    const headers = Object.keys(countyRecords[0]);
    const csv = [
      headers.join(','),
      ...countyRecords.map(r => headers.map(h => (r as any)[h]).join(','))
    ].join('\n');

    const path = join(OUTPUT_DIR, 'qcew_county_employment.csv');
    writeFileSync(path, csv);
    console.log(`\nSaved ${countyRecords.length} county records to qcew_county_employment.csv`);
  }

  // Save metro employment
  if (metroData.length > 0) {
    const metroRecords = metroData.map(r => ({
      period_date: r.period_date,
      cbsa_code: r.area_code,
      total_nonfarm_employment: r.total_employment,
      employment_yoy: r.employment_yoy ?? ''
    }));

    const headers = Object.keys(metroRecords[0]);
    const csv = [
      headers.join(','),
      ...metroRecords.map(r => headers.map(h => (r as any)[h]).join(','))
    ].join('\n');

    const path = join(OUTPUT_DIR, 'qcew_metro_employment.csv');
    writeFileSync(path, csv);
    console.log(`Saved ${metroRecords.length} metro records to qcew_metro_employment.csv`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('BLS QCEW Employment Data Download');
  console.log('='.repeat(60));

  const currentYear = new Date().getFullYear();
  // Download last 10 years for historical data, or can be configured
  const startYear = currentYear - 10;
  const endYear = currentYear;

  console.log(`\nDownloading data from ${startYear} to ${endYear}`);
  console.log('Note: QCEW data is released ~6 months after quarter end\n');

  try {
    // Download metro data (smaller, faster)
    const metroRecords = await downloadMetroEmployment(startYear, endYear);
    const metroWithYoY = calculateEmploymentYoY(metroRecords);

    // Download county data (larger, takes longer)
    const countyRecords = await downloadCountyEmployment(startYear, endYear);
    const countyWithYoY = calculateEmploymentYoY(countyRecords);

    // Save results
    saveResults(countyWithYoY, metroWithYoY);

    console.log('\n' + '='.repeat(60));
    console.log('Download complete!');
    console.log('Run combine-economic-data.ts to merge into economic tables');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
