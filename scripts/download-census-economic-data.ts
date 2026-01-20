/**
 * Download Census and Economic Data - Historical
 *
 * Downloads ALL available historical data from Census Bureau, BEA, and FRED APIs.
 *
 * Usage:
 *   npx tsx scripts/download-census-economic-data.ts
 *   npx tsx scripts/download-census-economic-data.ts --census  # Census only
 *   npx tsx scripts/download-census-economic-data.ts --economic  # Economic only
 *   npx tsx scripts/download-census-economic-data.ts --quick  # Latest year only (faster)
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import {
  fetchCensusACS,
  fetchBEAGDP,
  fetchBEARealGDP,
  fetchBEARPP,
  fetchFREDUnemploymentNational,
  fetchFREDUnemploymentStates,
  fetchFREDUnemploymentMetros,
  fetchBLSCountyUnemployment,
  fetchFREDEmploymentNational,
  fetchFREDEmploymentStates,
  fetchFREDEmploymentMetros,
} from './census-economic-import/api-clients';
import { STATE_FIPS_TO_ABBREV, STATE_FIPS_TO_NAME } from './census-economic-import/types';

// Use process.cwd() for compatibility with both CommonJS and ES modules
const OUTPUT_DIR = join(process.cwd(), 'data/economic');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Census ACS 5-Year data available years (2009-2023)
// Using 2010-2023 for cleaner decade range
const CENSUS_YEARS_FULL = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010];
const CENSUS_YEARS_QUICK = [2023, 2022]; // For YoY calculation

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

// ============================================================================
// CENSUS DATA DOWNLOAD - ALL YEARS
// ============================================================================

async function downloadAllCensusData(years: number[]): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(`Downloading Census ACS Data for ${years.length} years: ${years[0]}-${years[years.length-1]}`);
  console.log('='.repeat(60));

  // Accumulators for multi-year data
  const allNationalRecords: any[] = [];
  const allStateRecords: any[] = [];
  const allMetroRecords: any[] = [];
  const allCountyRecords: any[] = [];
  const allCityRecords: any[] = [];
  const allZipRecords: any[] = [];

  for (const year of years) {
    console.log(`\n--- Year ${year} ---`);

    // National
    console.log('  National...');
    const nationalResult = await fetchCensusACS(year, 'us');
    if (nationalResult.success && nationalResult.data) {
      for (const row of nationalResult.data) {
        allNationalRecords.push({
          year,
          total_population: row.B01003_001E,
          median_age: row.B01002_001E,
          median_household_income: row.B19013_001E,
          per_capita_income: row.B19301_001E,
          total_housing_units: row.B25001_001E,
          owner_occupied_units: row.B25003_002E,
          renter_occupied_units: row.B25003_003E,
          homeownership_rate: row.B25003_002E && row.B25003_001E
            ? (parseFloat(row.B25003_002E) / parseFloat(row.B25003_001E) * 100).toFixed(2)
            : null,
          median_home_value: row.B25077_001E,
          median_gross_rent: row.B25064_001E,
          rent_as_pct_of_income: row.B25071_001E
        });
      }
    }

    // States
    console.log('  States...');
    const stateResult = await fetchCensusACS(year, 'state');
    if (stateResult.success && stateResult.data) {
      for (const row of stateResult.data) {
        allStateRecords.push({
          year,
          state_fips: row.state,
          state_name: STATE_FIPS_TO_NAME[row.state] || row.NAME,
          state_abbrev: STATE_FIPS_TO_ABBREV[row.state] || '',
          total_population: row.B01003_001E,
          median_age: row.B01002_001E,
          median_household_income: row.B19013_001E,
          per_capita_income: row.B19301_001E,
          total_housing_units: row.B25001_001E,
          owner_occupied_units: row.B25003_002E,
          renter_occupied_units: row.B25003_003E,
          homeownership_rate: row.B25003_002E && row.B25003_001E
            ? (parseFloat(row.B25003_002E) / parseFloat(row.B25003_001E) * 100).toFixed(2)
            : null,
          median_home_value: row.B25077_001E,
          median_gross_rent: row.B25064_001E,
          rent_as_pct_of_income: row.B25071_001E
        });
      }
    }

    // Metro (MSA/CBSA)
    console.log('  Metros...');
    const metroResult = await fetchCensusACS(year, 'metropolitan statistical area/micropolitan statistical area');
    if (metroResult.success && metroResult.data) {
      for (const row of metroResult.data) {
        allMetroRecords.push({
          year,
          cbsa_code: row['metropolitan statistical area/micropolitan statistical area'],
          cbsa_title: row.NAME,
          total_population: row.B01003_001E,
          median_age: row.B01002_001E,
          median_household_income: row.B19013_001E,
          per_capita_income: row.B19301_001E,
          total_housing_units: row.B25001_001E,
          owner_occupied_units: row.B25003_002E,
          renter_occupied_units: row.B25003_003E,
          homeownership_rate: row.B25003_002E && row.B25003_001E
            ? (parseFloat(row.B25003_002E) / parseFloat(row.B25003_001E) * 100).toFixed(2)
            : null,
          median_home_value: row.B25077_001E,
          median_gross_rent: row.B25064_001E,
          rent_as_pct_of_income: row.B25071_001E
        });
      }
    }

    // Counties (loop through states)
    console.log('  Counties...');
    const states = Object.keys(STATE_FIPS_TO_ABBREV).filter(f => f !== '72'); // Skip Puerto Rico
    for (const stateFips of states) {
      const countyResult = await fetchCensusACS(year, 'county', stateFips);
      if (countyResult.success && countyResult.data) {
        for (const row of countyResult.data) {
          allCountyRecords.push({
            year,
            fips_code: row.state + row.county,
            county_name: row.NAME?.replace(/, .*/, '') || '',
            state_fips: row.state,
            state_name: STATE_FIPS_TO_NAME[row.state] || '',
            total_population: row.B01003_001E,
            median_age: row.B01002_001E,
            median_household_income: row.B19013_001E,
            per_capita_income: row.B19301_001E,
            total_housing_units: row.B25001_001E,
            owner_occupied_units: row.B25003_002E,
            renter_occupied_units: row.B25003_003E,
            homeownership_rate: row.B25003_002E && row.B25003_001E
              ? (parseFloat(row.B25003_002E) / parseFloat(row.B25003_001E) * 100).toFixed(2)
              : null,
            median_home_value: row.B25077_001E,
            median_gross_rent: row.B25064_001E,
            rent_as_pct_of_income: row.B25071_001E
          });
        }
      }
    }

    // Cities/Places - only for latest year (too much data otherwise)
    if (year === years[0]) {
      console.log('  Cities (top 10 states)...');
      const largeStates = ['06', '48', '12', '36', '42', '17', '39', '13', '37', '26'];
      for (const stateFips of largeStates) {
        const cityResult = await fetchCensusACS(year, 'place', stateFips);
        if (cityResult.success && cityResult.data) {
          for (const row of cityResult.data) {
            allCityRecords.push({
              year,
              place_fips: row.state + row.place,
              place_name: row.NAME?.replace(/, .*/, '') || '',
              state_fips: row.state,
              state_name: STATE_FIPS_TO_NAME[row.state] || '',
              total_population: row.B01003_001E,
              median_age: row.B01002_001E,
              median_household_income: row.B19013_001E,
              per_capita_income: row.B19301_001E,
              total_housing_units: row.B25001_001E,
              owner_occupied_units: row.B25003_002E,
              renter_occupied_units: row.B25003_003E,
              homeownership_rate: row.B25003_002E && row.B25003_001E
                ? (parseFloat(row.B25003_002E) / parseFloat(row.B25003_001E) * 100).toFixed(2)
                : null,
              median_home_value: row.B25077_001E,
              median_gross_rent: row.B25064_001E,
              rent_as_pct_of_income: row.B25071_001E
            });
          }
        }
      }
    }

    // ZCTAs - fetch for multiple years to enable YoY calculations
    // Limit to most recent 3 years to balance data coverage vs API load
    const zipYearsToFetch = years.slice(0, 3); // e.g., [2023, 2022, 2021]
    if (zipYearsToFetch.includes(year)) {
      console.log('  ZIP Codes...');
      const zipResult = await fetchCensusACS(year, 'zip code tabulation area');
      if (zipResult.success && zipResult.data) {
        for (const row of zipResult.data) {
          allZipRecords.push({
            year,
            zcta: row['zip code tabulation area'],
            total_population: row.B01003_001E,
            median_age: row.B01002_001E,
            median_household_income: row.B19013_001E,
            per_capita_income: row.B19301_001E,
            total_housing_units: row.B25001_001E,
            owner_occupied_units: row.B25003_002E,
            renter_occupied_units: row.B25003_003E,
            homeownership_rate: row.B25003_002E && row.B25003_001E
              ? (parseFloat(row.B25003_002E) / parseFloat(row.B25003_001E) * 100).toFixed(2)
              : null,
            median_home_value: row.B25077_001E,
            median_gross_rent: row.B25064_001E,
            rent_as_pct_of_income: row.B25071_001E
          });
        }
      }
    }
  }

  // Save all accumulated data
  console.log('\nSaving Census data...');
  saveCSV('census_national.csv', allNationalRecords);
  saveCSV('census_state.csv', allStateRecords);
  saveCSV('census_metro.csv', allMetroRecords);
  saveCSV('census_county.csv', allCountyRecords);
  saveCSV('census_city.csv', allCityRecords);
  saveCSV('census_zip.csv', allZipRecords);
}

// ============================================================================
// ECONOMIC DATA DOWNLOAD - ALL AVAILABLE HISTORY
// ============================================================================

async function downloadAllEconomicData(startYear: number = 2000): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(`Downloading Economic Data (BEA + FRED) from ${startYear}`);
  console.log('='.repeat(60));

  // National unemployment from FRED - all available history
  console.log('\nNational Unemployment (FRED)...');
  const nationalUnempResult = await fetchFREDUnemploymentNational(startYear);
  if (nationalUnempResult.success && nationalUnempResult.data) {
    const records = nationalUnempResult.data.map(obs => ({
      period_date: obs.date,
      unemployment_rate: obs.value
    }));
    saveCSV('economic_national.csv', records);
  }

  // State unemployment from FRED - all available history
  console.log('\nState Unemployment (FRED)...');
  const stateUnempResult = await fetchFREDUnemploymentStates(startYear);
  if (stateUnempResult.success && stateUnempResult.data) {
    const records = stateUnempResult.data.map(obs => ({
      period_date: obs.date,
      state_fips: obs.state_fips,
      state_name: STATE_FIPS_TO_NAME[obs.state_fips] || '',
      state_abbrev: STATE_FIPS_TO_ABBREV[obs.state_fips] || '',
      unemployment_rate: obs.value
    }));
    saveCSV('fred_state_unemployment.csv', records);
  }

  // Metro unemployment from FRED - major metros
  console.log('\nMetro Unemployment (FRED - major metros)...');
  const metroUnempResult = await fetchFREDUnemploymentMetros(startYear);
  if (metroUnempResult.success && metroUnempResult.data) {
    const records = metroUnempResult.data.map(obs => ({
      period_date: obs.date,
      cbsa_code: obs.cbsa_code,
      unemployment_rate: obs.value
    }));
    saveCSV('fred_metro_unemployment.csv', records);
  }

  // State GDP from BEA - ALL available years
  console.log('\nState GDP (BEA) - ALL years...');
  const stateGdpResult = await fetchBEAGDP('STATE', 'ALL');
  if (stateGdpResult.success && stateGdpResult.data) {
    const records = stateGdpResult.data
      .filter(row => row.GeoFips && row.GeoFips !== '00000')
      .map(row => ({
        period_date: `${row.TimePeriod}-01-01`,
        state_fips: row.GeoFips?.substring(0, 2) || '',
        state_name: row.GeoName || '',
        gdp_millions: row.DataValue
      }));
    saveCSV('bea_state_gdp.csv', records);
  }

  // State Real GDP from BEA - ALL available years
  console.log('\nState Real GDP (BEA) - ALL years...');
  const stateRealGdpResult = await fetchBEARealGDP('STATE', 'ALL');
  if (stateRealGdpResult.success && stateRealGdpResult.data) {
    const records = stateRealGdpResult.data
      .filter(row => row.GeoFips && row.GeoFips !== '00000')
      .map(row => ({
        period_date: `${row.TimePeriod}-01-01`,
        state_fips: row.GeoFips?.substring(0, 2) || '',
        state_name: row.GeoName || '',
        real_gdp_millions: row.DataValue
      }));
    saveCSV('bea_state_real_gdp.csv', records);
  }

  // State RPP from BEA - ALL available years (2008+)
  console.log('\nState Cost of Living (BEA RPP) - ALL years...');
  const stateRppResult = await fetchBEARPP('STATE', 'ALL');
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
  }

  // Metro GDP from BEA - ALL available years
  console.log('\nMetro GDP (BEA) - ALL years...');
  const metroGdpResult = await fetchBEAGDP('MSA', 'ALL');
  if (metroGdpResult.success && metroGdpResult.data) {
    const records = metroGdpResult.data
      .filter(row => row.GeoFips && row.GeoFips.length >= 5)
      .map(row => ({
        period_date: `${row.TimePeriod}-01-01`,
        cbsa_code: row.GeoFips?.substring(0, 5) || '',
        cbsa_title: row.GeoName || '',
        gdp_millions: row.DataValue
      }));
    saveCSV('bea_metro_gdp.csv', records);
  }

  // Metro RPP from BEA - ALL available years
  console.log('\nMetro Cost of Living (BEA RPP) - ALL years...');
  const metroRppResult = await fetchBEARPP('MSA', 'ALL');
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
  }

  // County GDP from BEA - ALL available years
  console.log('\nCounty GDP (BEA) - ALL years...');
  const countyGdpResult = await fetchBEAGDP('COUNTY', 'ALL');
  if (countyGdpResult.success && countyGdpResult.data) {
    const records = countyGdpResult.data
      .filter(row => row.GeoFips && row.GeoFips.length === 5)
      .map(row => ({
        period_date: `${row.TimePeriod}-01-01`,
        fips_code: row.GeoFips || '',
        county_name: row.GeoName || '',
        state_fips: row.GeoFips?.substring(0, 2) || '',
        gdp_millions: row.DataValue
      }));
    saveCSV('bea_county_gdp.csv', records);

    // County unemployment from BLS - MONTHLY data for all counties
    // Uses the county list from BEA GDP data we just downloaded
    console.log('\nCounty Unemployment (BLS - monthly data)...');
    const uniqueCountyFips = [...new Set(records.map((r: any) => r.fips_code))];
    console.log(`  Processing ${uniqueCountyFips.length} counties from BEA GDP data`);

    const currentYear = new Date().getFullYear();
    const countyUnempResult = await fetchBLSCountyUnemployment(uniqueCountyFips, startYear, currentYear);
    if (countyUnempResult.success && countyUnempResult.data) {
      const unempRecords = countyUnempResult.data.map(obs => ({
        period_date: obs.date,
        fips_code: obs.fips_code,
        state_fips: obs.state_fips,
        unemployment_rate: obs.value
      }));
      saveCSV('fred_county_unemployment.csv', unempRecords);
    }
  }

  // ============================================================================
  // EMPLOYMENT DATA (for Job Growth)
  // ============================================================================

  // National employment from FRED
  console.log('\nNational Employment (FRED PAYEMS)...');
  const nationalEmpResult = await fetchFREDEmploymentNational(startYear);
  if (nationalEmpResult.success && nationalEmpResult.data) {
    const records = nationalEmpResult.data
      .filter(obs => obs.value !== '.')
      .map(obs => ({
        period_date: obs.date,
        total_nonfarm_employment: parseFloat(obs.value) * 1000  // PAYEMS is in thousands
      }));
    saveCSV('fred_national_employment.csv', records);
  }

  // State employment from FRED
  console.log('\nState Employment (FRED)...');
  const stateEmpResult = await fetchFREDEmploymentStates(startYear);
  if (stateEmpResult.success && stateEmpResult.data) {
    const records = stateEmpResult.data.map(obs => ({
      period_date: obs.date,
      state_fips: obs.state_fips,
      state_name: STATE_FIPS_TO_NAME[obs.state_fips] || '',
      state_abbrev: STATE_FIPS_TO_ABBREV[obs.state_fips] || '',
      total_nonfarm_employment: parseFloat(obs.value) * 1000  // In thousands
    }));
    saveCSV('fred_state_employment.csv', records);
  }

  // Metro employment from FRED (major metros only)
  console.log('\nMetro Employment (FRED - major metros)...');
  const metroEmpResult = await fetchFREDEmploymentMetros(startYear);
  if (metroEmpResult.success && metroEmpResult.data) {
    const records = metroEmpResult.data.map(obs => ({
      period_date: obs.date,
      cbsa_code: obs.cbsa_code,
      total_nonfarm_employment: parseFloat(obs.value) * 1000  // In thousands
    }));
    saveCSV('fred_metro_employment.csv', records);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);

  const downloadCensus = args.length === 0 || args.includes('--census');
  const downloadEconomic = args.length === 0 || args.includes('--economic');
  const quickMode = args.includes('--quick');

  const censusYears = quickMode ? CENSUS_YEARS_QUICK : CENSUS_YEARS_FULL;
  const fredStartYear = quickMode ? 2020 : 2000;

  console.log('Census & Economic Data Downloader - HISTORICAL');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Mode: ${quickMode ? 'QUICK (2 years)' : 'FULL HISTORICAL'}`);
  console.log('');

  if (downloadCensus) {
    await downloadAllCensusData(censusYears);
  }

  if (downloadEconomic) {
    await downloadAllEconomicData(fredStartYear);
  }

  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log(`Download complete in ${duration} minutes`);
  console.log(`Files saved to: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
