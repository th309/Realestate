/**
 * Download QCEW (Quarterly Census of Employment and Wages) Data
 *
 * BLS QCEW provides employment data for ALL counties and metros quarterly.
 * This fills the gap where FRED only has data for 3 metros.
 *
 * Data source: https://www.bls.gov/cew/downloadable-data-files.htm
 * API docs: https://www.bls.gov/cew/additional-resources/open-data/
 *
 * EFFICIENT APPROACH: Use industry slices to get all areas in one file
 * URL format: https://data.bls.gov/cew/data/api/{year}/{qtr}/industry/{industry_code}.csv
 *
 * Industry code 10 = Total, all industries
 * We filter for own_code 5 = Private sector
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

// Use process.cwd() for compatibility with both CommonJS and ES modules
const OUTPUT_DIR = join(process.cwd(), 'data/economic');
const QCEW_BASE_URL = 'https://data.bls.gov/cew/data/api';

// Rate limiting - BLS asks for reasonable request rates
const DELAY_MS = 500; // 500ms between requests (only ~40 requests total now)

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
 * Fetch QCEW industry slice data (all areas for a given industry)
 * This is MUCH more efficient than fetching per-area
 */
async function fetchQCEWIndustrySlice(year: number, qtr: number, industryCode: string): Promise<QCEWRecord[] | null> {
  const url = `${QCEW_BASE_URL}/${year}/${qtr}/industry/${industryCode}.csv`;

  console.log(`  Fetching ${year}Q${qtr}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`  No data for ${year}Q${qtr}`);
        return null;
      }
      console.warn(`  HTTP ${response.status} for ${year}Q${qtr}`);
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

    console.log(`  Got ${records.length} records for ${year}Q${qtr}`);
    return records;
  } catch (error) {
    console.warn(`  Error fetching ${year}Q${qtr}: ${error}`);
    return null;
  }
}

/**
 * Extract total private employment from QCEW records
 * own_code 5 = Private sector
 * Area FIPS codes: 5-digit for counties, CXXXXX format for MSAs
 */
function extractPrivateEmployment(records: QCEWRecord[]): EmploymentRecord[] {
  const results: EmploymentRecord[] = [];

  // Filter for Private ownership (own_code=5)
  const privateRecords = records.filter(r => r.own_code === '5');

  for (const record of privateRecords) {
    const fips = record.area_fips;

    // Determine area type
    let areaType: 'county' | 'metro' | null = null;
    let areaCode: string = fips;

    if (fips.startsWith('C') && fips.length === 5) {
      // CXXXX format = MSA code, needs trailing '0' to make 5-digit CBSA code
      // E.g., C1018 -> CBSA 10180
      areaType = 'metro';
      areaCode = fips.slice(1) + '0'; // Remove 'C' prefix and add trailing 0
    } else if (fips.length === 5 && !fips.startsWith('C')) {
      // 5-digit code = county FIPS (but skip state-level codes ending in 000)
      if (fips.endsWith('000')) continue;
      areaType = 'county';
    } else {
      // Skip other area types (statewide, national, etc.)
      continue;
    }

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
function saveResults(
  countyData: ReturnType<typeof calculateEmploymentYoY>,
  metroData: ReturnType<typeof calculateEmploymentYoY>
): void {
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
  console.log('BLS QCEW Employment Data Download (Efficient Bulk Method)');
  console.log('='.repeat(60));

  const currentYear = new Date().getFullYear();
  const currentQtr = Math.ceil((new Date().getMonth() + 1) / 3);

  // Download last 10 years for historical data
  const startYear = currentYear - 10;
  const endYear = currentYear;

  console.log(`\nDownloading data from ${startYear} to ${endYear}`);
  console.log('Note: QCEW data is released ~6 months after quarter end');
  console.log('Using industry slice method (all areas per file)\n');

  // Build list of quarters to fetch
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

  console.log(`Fetching ${quarters.length} quarters of data\n`);

  const allCountyRecords: EmploymentRecord[] = [];
  const allMetroRecords: EmploymentRecord[] = [];

  try {
    // Fetch industry 10 (Total, all industries) for each quarter
    for (const { year, qtr } of quarters) {
      const records = await fetchQCEWIndustrySlice(year, qtr, '10');
      if (records) {
        const employment = extractPrivateEmployment(records);

        // Separate county and metro records
        for (const record of employment) {
          if (record.area_type === 'county') {
            allCountyRecords.push(record);
          } else if (record.area_type === 'metro') {
            allMetroRecords.push(record);
          }
        }
      }
      await sleep(DELAY_MS);
    }

    console.log(`\nTotal county records: ${allCountyRecords.length}`);
    console.log(`Total metro records: ${allMetroRecords.length}`);

    // Calculate YoY growth
    const countyWithYoY = calculateEmploymentYoY(allCountyRecords);
    const metroWithYoY = calculateEmploymentYoY(allMetroRecords);

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
