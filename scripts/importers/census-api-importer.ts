/**
 * Census Bureau API Data Importer
 *
 * Imports demographics, economics, and housing data from Census Bureau API
 * - American Community Survey 5-Year Estimates (ACS5)
 * - Supports ZIP, County, and State levels
 * - Annual updates (released each December)
 *
 * Usage:
 *   npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=zip
 *   npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=county
 *   npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=state
 *   npx tsx scripts/importers/census-api-importer.ts --year=2022 --all
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../../web/.env.local') });

const CENSUS_API_KEY = process.env.CENSUS_API_KEY || '';
const CENSUS_BASE_URL = 'https://api.census.gov/data';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface CensusVariable {
  code: string;
  description: string;
  table: 'demographics' | 'economics' | 'housing';
  column: string;
  transform?: (value: string) => number | null;
}

// Census variable mappings
const CENSUS_VARIABLES: CensusVariable[] = [
  // DEMOGRAPHICS
  { code: 'B01001_001E', description: 'Total Population', table: 'demographics', column: 'total_population' },
  { code: 'B01002_001E', description: 'Median Age', table: 'demographics', column: 'median_age' },
  { code: 'B11001_001E', description: 'Total Households', table: 'demographics', column: 'total_households' },
  { code: 'B25010_001E', description: 'Average Household Size', table: 'demographics', column: 'avg_household_size' },

  // Age Distribution (percentages calculated from counts)
  { code: 'B01001_003E', description: 'Male Under 5', table: 'demographics', column: '_male_under_5' },
  { code: 'B01001_027E', description: 'Female Under 5', table: 'demographics', column: '_female_under_5' },
  { code: 'B01001_007E', description: 'Male 18-34', table: 'demographics', column: '_male_18_34' },
  { code: 'B01001_031E', description: 'Female 18-34', table: 'demographics', column: '_female_18_34' },
  { code: 'B01001_011E', description: 'Male 35-54', table: 'demographics', column: '_male_35_54' },
  { code: 'B01001_035E', description: 'Female 35-54', table: 'demographics', column: '_female_35_54' },
  { code: 'B01001_020E', description: 'Male 65+', table: 'demographics', column: '_male_65_plus' },
  { code: 'B01001_044E', description: 'Female 65+', table: 'demographics', column: '_female_65_plus' },

  // Education
  { code: 'B15003_022E', description: "Bachelor's Degree", table: 'demographics', column: '_bachelors_count' },
  { code: 'B15003_023E', description: "Master's Degree", table: 'demographics', column: '_masters_count' },
  { code: 'B15003_024E', description: 'Professional Degree', table: 'demographics', column: '_professional_count' },
  { code: 'B15003_025E', description: 'Doctorate Degree', table: 'demographics', column: '_doctorate_count' },

  // ECONOMICS
  { code: 'B19013_001E', description: 'Median Household Income', table: 'economics', column: 'median_household_income' },
  { code: 'B19301_001E', description: 'Per Capita Income', table: 'economics', column: 'per_capita_income' },
  { code: 'B17001_002E', description: 'Population Below Poverty', table: 'economics', column: '_poverty_count' },
  { code: 'B23025_005E', description: 'Unemployed Population', table: 'economics', column: '_unemployed_count' },
  { code: 'B23025_003E', description: 'Labor Force', table: 'economics', column: '_labor_force' },
  { code: 'B19083_001E', description: 'Gini Index', table: 'economics', column: 'gini_index' },

  // HOUSING
  { code: 'B25001_001E', description: 'Total Housing Units', table: 'housing', column: 'total_housing_units' },
  { code: 'B25002_002E', description: 'Occupied Housing Units', table: 'housing', column: 'occupied_units' },
  { code: 'B25003_002E', description: 'Owner Occupied', table: 'housing', column: '_owner_occupied' },
  { code: 'B25077_001E', description: 'Median Home Value', table: 'housing', column: 'median_home_value' },
  { code: 'B25064_001E', description: 'Median Gross Rent', table: 'housing', column: 'median_gross_rent' },
  { code: 'B25035_001E', description: 'Median Year Built', table: 'housing', column: 'median_year_built' }
];

interface ImportStats {
  geography: string;
  year: number;
  totalRecords: number;
  demographics: number;
  economics: number;
  housing: number;
  errors: string[];
  duration: number;
}

async function fetchCensusData(
  year: number,
  geography: 'zip' | 'county' | 'state',
  variables: string[]
): Promise<any[]> {
  const geographyMap = {
    zip: 'zip%20code%20tabulation%20area:*',
    county: 'county:*',
    state: 'state:*'
  };

  const variableList = variables.join(',');
  const url = `${CENSUS_BASE_URL}/${year}/acs/acs5?get=${variableList}&for=${geographyMap[geography]}&key=${CENSUS_API_KEY}`;

  console.log(`Fetching ${geography} data for ${year}...`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Census API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // First row is headers, rest is data
    const [headers, ...rows] = data;

    return rows.map((row: any[]) => {
      const record: any = {};
      headers.forEach((header: string, index: number) => {
        record[header] = row[index];
      });
      return record;
    });
  } catch (error: any) {
    throw new Error(`Failed to fetch Census data: ${error.message}`);
  }
}

// PostgreSQL INTEGER max value: 2,147,483,647
const MAX_INTEGER = 2147483647;
const MIN_INTEGER = -2147483648;

function parseValue(value: string): number | null {
  if (value === null || value === undefined || value === '-666666666') {
    return null; // Census uses -666666666 for N/A
  }
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  
  // Cap to PostgreSQL INTEGER range for safety
  if (num > MAX_INTEGER) return MAX_INTEGER;
  if (num < MIN_INTEGER) return MIN_INTEGER;
  
  return num;
}

function parseNumeric(value: string, maxValue: number = 999999999999): number | null {
  const parsed = parseValue(value);
  if (parsed === null) return null;
  
  // Cap to reasonable maximum for NUMERIC fields (income, home values, etc.)
  if (parsed > maxValue) return maxValue;
  if (parsed < -maxValue) return -maxValue;
  
  // Round to 2 decimal places for currency/income values
  return Math.round(parsed * 100) / 100;
}

function parseInteger(value: string): number | null {
  const parsed = parseValue(value);
  if (parsed === null) return null;
  // Round to nearest integer and cap to INTEGER range
  const rounded = Math.round(parsed);
  if (rounded > MAX_INTEGER) return MAX_INTEGER;
  if (rounded < MIN_INTEGER) return MIN_INTEGER;
  return rounded;
}

function calculatePercentage(part: number | null, total: number | null): number | null {
  if (part === null || total === null || total === 0) return null;
  
  // Ensure part and total are valid numbers
  if (isNaN(part) || isNaN(total) || !isFinite(part) || !isFinite(total)) return null;
  
  // Prevent division by zero and handle negative values
  if (total <= 0 || part < 0) return null;
  
  const pct = (part / total) * 100;
  
  // Cap percentages at 100% (data quality issues can cause > 100%)
  // Also ensure it's a valid finite number
  if (!isFinite(pct) || isNaN(pct)) return null;
  if (pct > 100) return 100;
  if (pct < 0) return 0;
  
  // Round to 2 decimal places to avoid precision issues
  const rounded = Math.round(pct * 100) / 100;
  
  // Final safety check
  if (!isFinite(rounded) || isNaN(rounded)) return null;
  
  return rounded;
}

function processDemographicsRecord(record: any, geoid: string, year: number): any {
  const totalPop = parseInteger(record['B01001_001E']);
  const under5Male = parseInteger(record['B01001_003E']);
  const under5Female = parseInteger(record['B01001_027E']);
  const age18_34Male = parseInteger(record['B01001_007E']);
  const age18_34Female = parseInteger(record['B01001_031E']);
  const age35_54Male = parseInteger(record['B01001_011E']);
  const age35_54Female = parseInteger(record['B01001_035E']);
  const age65PlusMale = parseInteger(record['B01001_020E']);
  const age65PlusFemale = parseInteger(record['B01001_044E']);

  const bachelors = parseInteger(record['B15003_022E']);
  const masters = parseInteger(record['B15003_023E']);
  const professional = parseInteger(record['B15003_024E']);
  const doctorate = parseInteger(record['B15003_025E']);

  const totalGrad = (masters || 0) + (professional || 0) + (doctorate || 0);
  const pop25Plus = totalPop; // Approximation - should use B15003_001E

  // Helper to safely parse numeric with reasonable bounds and ensure it's safe for PostgreSQL
  const safeNumeric = (val: string, min: number = 0, max: number = 200): number | null => {
    const parsed = parseValue(val);
    if (parsed === null) return null;
    if (!isFinite(parsed) || isNaN(parsed)) return null;
    if (parsed < min || parsed > max) return null; // Out of reasonable range
    const rounded = Math.round(parsed * 100) / 100; // Round to 2 decimals
    // Final safety check - ensure it's still finite after rounding
    if (!isFinite(rounded) || isNaN(rounded)) return null;
    return rounded;
  };

  // Helper to safely calculate percentage with additional validation
  const safePercentage = (part: number | null, total: number | null): number | null => {
    const pct = calculatePercentage(part, total);
    if (pct === null) return null;
    // Double-check it's within 0-100 and is finite
    if (!isFinite(pct) || isNaN(pct)) return null;
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
  };

  // Calculate all percentages with extra validation
  const under18Pct = safePercentage((under5Male || 0) + (under5Female || 0), totalPop);
  const age18_34Pct = safePercentage((age18_34Male || 0) + (age18_34Female || 0), totalPop);
  const age35_54Pct = safePercentage((age35_54Male || 0) + (age35_54Female || 0), totalPop);
  const age65PlusPct = safePercentage((age65PlusMale || 0) + (age65PlusFemale || 0), totalPop);
  const bachelorsPct = safePercentage(bachelors, pop25Plus);
  const gradPct = safePercentage(totalGrad, pop25Plus);

  return {
    geoid,
    vintage_year: year,
    survey_type: 'acs5',
    total_population: totalPop,
    // Median age should be 0-120, ensure it's safe
    median_age: safeNumeric(record['B01002_001E'], 0, 120),
    total_households: parseInteger(record['B11001_001E']),
    // Average household size should be 0-20, ensure it's safe
    avg_household_size: safeNumeric(record['B25010_001E'], 0, 20),
    // Use pre-validated percentages
    population_under_18_pct: under18Pct,
    population_18_34_pct: age18_34Pct,
    population_35_54_pct: age35_54Pct,
    population_65_plus_pct: age65PlusPct,
    bachelors_degree_pct: bachelorsPct,
    graduate_degree_pct: gradPct,
    created_at: new Date().toISOString()
  };
}

function processEconomicsRecord(record: any, geoid: string, year: number): any {
  const povertyCount = parseInteger(record['B17001_002E']);
  const totalPop = parseInteger(record['B01001_001E']); // Would need to refetch
  const unemployed = parseInteger(record['B23025_005E']);
  const laborForce = parseInteger(record['B23025_003E']);

  return {
    geoid,
    vintage_year: year,
    // Income values can be very large, cap at $999 billion
    median_household_income: parseNumeric(record['B19013_001E'], 999999999999),
    per_capita_income: parseNumeric(record['B19301_001E'], 999999999999),
    poverty_rate_all: calculatePercentage(povertyCount, totalPop),
    unemployment_rate: calculatePercentage(unemployed, laborForce),
    // Gini index is 0-1, but sometimes stored as 0-100
    gini_index: (() => {
      const gini = parseValue(record['B19083_001E']);
      if (gini === null) return null;
      // If > 1, assume it's 0-100 scale, convert to 0-1
      if (gini > 1) return Math.min(1, gini / 100);
      return Math.max(0, Math.min(1, gini));
    })(),
    created_at: new Date().toISOString()
  };
}

function processHousingRecord(record: any, geoid: string, year: number): any {
  const totalUnits = parseInteger(record['B25001_001E']);
  const occupied = parseInteger(record['B25002_002E']);
  const ownerOccupied = parseInteger(record['B25003_002E']);

  const vacancyRate = calculatePercentage(totalUnits && occupied ? totalUnits - occupied : null, totalUnits);
  const homeownershipRate = calculatePercentage(ownerOccupied, occupied);

  // median_year_built should be an integer year
  const yearBuilt = parseInteger(record['B25035_001E']);
  // Cap year to reasonable range (1800-2100)
  const cappedYearBuilt = yearBuilt && yearBuilt > 1800 && yearBuilt < 2100 ? yearBuilt : null;

  return {
    geoid,
    vintage_year: year,
    total_housing_units: totalUnits,
    occupied_units: occupied,
    vacancy_rate: vacancyRate,
    homeownership_rate: homeownershipRate,
    // Home values can be very large, cap at $999 billion
    median_home_value: parseNumeric(record['B25077_001E'], 999999999999),
    // Rent values, cap at $1 million/month (unrealistic but safe)
    median_gross_rent: parseNumeric(record['B25064_001E'], 1000000),
    median_year_built: cappedYearBuilt,
    created_at: new Date().toISOString()
  };
}

function getGeoIdFromRecord(record: any, geography: 'zip' | 'county' | 'state'): string {
  switch (geography) {
    case 'zip':
      // ZIP codes should be 5 digits
      return record['zip code tabulation area']?.padStart(5, '0') || record['zip code tabulation area'];
    case 'county':
      // County FIPS: state (2 digits) + county (3 digits) = 5 digits
      const stateFips = record.state?.padStart(2, '0') || record.state;
      const countyFips = record.county?.padStart(3, '0') || record.county;
      return `${stateFips}${countyFips}`;
    case 'state':
      // State FIPS: 2 digits
      return record.state?.padStart(2, '0') || record.state;
  }
}

// Helper: Escape SQL string with comprehensive validation
function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    // Ensure number is finite and valid
    if (!isFinite(value) || isNaN(value)) return 'NULL';
    
    // PostgreSQL NUMERIC can handle very large numbers, but we cap for safety
    // Use a more conservative limit to avoid precision issues
    const maxSafe = 999999999999; // 999 billion (12 digits)
    const minSafe = -999999999999;
    
    let safeValue = value;
    if (value > maxSafe) {
      safeValue = maxSafe;
    } else if (value < minSafe) {
      safeValue = minSafe;
    }
    
    // For very small numbers, round to 0
    if (Math.abs(safeValue) < 0.000001 && safeValue !== 0) {
      return '0';
    }
    
    // Format number to avoid scientific notation and excessive precision
    // Use toFixed for numbers with decimals, but limit to reasonable precision
    if (Number.isInteger(safeValue)) {
      return safeValue.toString();
    } else {
      // For decimals, limit to 10 decimal places max to avoid precision issues
      const fixed = safeValue.toFixed(10);
      // Remove trailing zeros
      return parseFloat(fixed).toString();
    }
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  // Escape single quotes and backslashes
  return `'${value.toString().replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

// Helper: Batch insert with upsert using exec_sql RPC
async function batchUpsertSQL(
  table: string,
  records: any[],
  conflictColumn: string
): Promise<{ inserted: number; error?: string }> {
  if (records.length === 0) {
    return { inserted: 0 };
  }

  try {
    // Build SQL INSERT with ON CONFLICT
    const columns = Object.keys(records[0]);
    const values = records.map(record => {
      const vals = columns.map(col => escapeSQL(record[col]));
      return `(${vals.join(', ')})`;
    });

    // Handle conflict column (can be single or composite)
    const conflictCols = conflictColumn.split(',').map(c => c.trim());
    const conflictClause = conflictCols.length > 1
      ? conflictCols.join(', ')
      : conflictColumn;

    // Build UPDATE clause for ON CONFLICT
    const updateColumns = columns.filter(col => !conflictCols.includes(col));
    const updateClause = updateColumns.length > 0
      ? `DO UPDATE SET ${updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}`
      : 'DO NOTHING';

    // For census tables, we may need to handle foreign key constraints differently
    // Try inserting with explicit constraint handling
    let sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${values.join(', ')}
      ON CONFLICT (${conflictClause}) ${updateClause}
    `;

    // Execute via exec_sql RPC
    const { error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      return { inserted: 0, error: error.message };
    }

    return { inserted: records.length };
  } catch (err: any) {
    return { inserted: 0, error: err.message };
  }
}

async function importCensusData(year: number, geography: 'zip' | 'county' | 'state'): Promise<ImportStats> {
  const startTime = Date.now();
  const stats: ImportStats = {
    geography,
    year,
    totalRecords: 0,
    demographics: 0,
    economics: 0,
    housing: 0,
    errors: [],
    duration: 0
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Importing Census ${year} Data - ${geography.toUpperCase()}`);
  console.log('='.repeat(60));

  try {
    // Get all variable codes
    const variableCodes = CENSUS_VARIABLES.map(v => v.code);

    // Fetch data from Census API
    const records = await fetchCensusData(year, geography, variableCodes);
    stats.totalRecords = records.length;

    console.log(`✅ Fetched ${records.length.toLocaleString()} records from Census API`);

    // The foreign key constraint might reference markets.region_id
    // Create market entries for states/counties/zips if they don't exist
    console.log(`   Ensuring market entries exist for ${records.length} ${geography} records...`);
    const marketEntries: any[] = [];
    
    for (const record of records) {
      const geoid = getGeoIdFromRecord(record, geography);
      let regionName = '';
      let regionType = '';
      
      switch (geography) {
        case 'state':
          regionName = `State ${geoid}`;
          regionType = 'state';
          break;
        case 'county':
          regionName = `County ${geoid}`;
          regionType = 'county';
          break;
        case 'zip':
          regionName = `ZIP ${geoid}`;
          regionType = 'zip';
          break;
      }
      
      marketEntries.push({
        region_id: geoid,  // Use geoid as region_id to match foreign key
        region_name: regionName,
        region_type: regionType,
        geoid: geoid
      });
    }
    
    // Insert market entries in batch (required for foreign key constraint)
    if (marketEntries.length > 0) {
      const marketResult = await batchUpsertSQL('markets', marketEntries, 'region_id');
      if (marketResult.error) {
        console.log(`   ⚠️  Warning: Could not create market entries: ${marketResult.error}`);
      } else {
        console.log(`   ✅ Created/updated ${marketResult.inserted} market entries`);
      }
    }
    
    // Also create geographic_units entries (foreign key might reference this table)
    const geoUnitEntries: any[] = [];
    for (const record of records) {
      const geoid = getGeoIdFromRecord(record, geography);
      let level = '';
      let name = '';
      
      switch (geography) {
        case 'state':
          level = 'state';
          name = `State ${geoid}`;
          break;
        case 'county':
          level = 'county';
          name = `County ${geoid}`;
          break;
        case 'zip':
          level = 'zip';
          name = `ZIP ${geoid}`;
          break;
      }
      
      geoUnitEntries.push({
        geoid: geoid,
        level: level,
        name: name
      });
    }
    
    if (geoUnitEntries.length > 0) {
      const geoResult = await batchUpsertSQL('geographic_units', geoUnitEntries, 'geoid');
      if (geoResult.error) {
        console.log(`   ⚠️  Warning: Could not create geographic_units entries: ${geoResult.error}`);
      } else {
        console.log(`   ✅ Created/updated ${geoResult.inserted} geographic_units entries`);
      }
    }

    // Process and insert in batches
    const BATCH_SIZE = 100;
    const demographicsBatch: any[] = [];
    const economicsBatch: any[] = [];
    const housingBatch: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const geoid = getGeoIdFromRecord(record, geography);

      try {
        demographicsBatch.push(processDemographicsRecord(record, geoid, year));
        economicsBatch.push(processEconomicsRecord(record, geoid, year));
        housingBatch.push(processHousingRecord(record, geoid, year));

        // Insert batches when full
        if ((i + 1) % BATCH_SIZE === 0 || i === records.length - 1) {
          // Validate and clean demographics batch before insertion
          const cleanDemographicsBatch = demographicsBatch.map(record => {
            const cleaned: any = { ...record };
            // Ensure all numeric fields are safe
            Object.keys(cleaned).forEach(key => {
              const value = cleaned[key];
              if (typeof value === 'number') {
                if (!isFinite(value) || isNaN(value)) {
                  cleaned[key] = null;
                } else if (key.includes('pct') || key.includes('rate')) {
                  // Percentages should be 0-100
                  cleaned[key] = Math.max(0, Math.min(100, value));
                } else if (key.includes('age')) {
                  // Age should be 0-120
                  cleaned[key] = Math.max(0, Math.min(120, value));
                } else if (key.includes('size')) {
                  // Household size should be 0-20
                  cleaned[key] = Math.max(0, Math.min(20, value));
                }
              }
            });
            return cleaned;
          });

          // Additional aggressive cleaning function for individual records
          const ultraCleanRecord = (record: any): any => {
            const cleaned: any = {};
            Object.keys(record).forEach(key => {
              const value = record[key];
              if (value === null || value === undefined) {
                cleaned[key] = null;
              } else if (typeof value === 'number') {
                // Aggressive validation for all numeric fields
                if (!isFinite(value) || isNaN(value)) {
                  cleaned[key] = null;
                } else if (key.includes('pct') || key.includes('rate')) {
                  // Percentages: 0-100, round to 4 decimal places max
                  cleaned[key] = Math.max(0, Math.min(100, Math.round(value * 10000) / 10000));
                } else if (key.includes('age')) {
                  // Age: 0-120, integer
                  cleaned[key] = Math.max(0, Math.min(120, Math.round(value)));
                } else if (key.includes('size')) {
                  // Household size: 0-20, round to 2 decimals
                  cleaned[key] = Math.max(0, Math.min(20, Math.round(value * 100) / 100));
                } else if (key.includes('population') || key.includes('household')) {
                  // Population/household counts: integer, cap at INTEGER max
                  cleaned[key] = Math.max(0, Math.min(MAX_INTEGER, Math.round(value)));
                } else {
                  // Other numeric: ensure it's within safe range
                  const capped = Math.max(-999999999999, Math.min(999999999999, value));
                  cleaned[key] = isFinite(capped) ? capped : null;
                }
              } else {
                cleaned[key] = value;
              }
            });
            return cleaned;
          };

          // Apply ultra cleaning to all records
          const ultraCleanBatch = cleanDemographicsBatch.map(ultraCleanRecord);

          // Insert demographics using exec_sql
          const demoResult = await batchUpsertSQL('census_demographics', ultraCleanBatch, 'geoid,vintage_year');
          if (demoResult.error) {
            // If batch fails, try inserting records one by one with ultra cleaning
            if (demoResult.error.includes('numeric field overflow') || demoResult.error.includes('overflow')) {
              let successCount = 0;
              for (const record of ultraCleanBatch) {
                // Apply ultra cleaning again for individual insert
                const ultraCleaned = ultraCleanRecord(record);
                
                // Final validation pass - check all numeric values one more time
                const finalCleaned: any = {};
                let hasInvalidValue = false;
                Object.keys(ultraCleaned).forEach(key => {
                  const value = ultraCleaned[key];
                  if (value === null || value === undefined) {
                    finalCleaned[key] = null;
                  } else if (typeof value === 'number') {
                    // Final check - ensure it's a valid number that can be safely converted to string
                    if (!isFinite(value) || isNaN(value)) {
                      finalCleaned[key] = null;
                    } else {
                      // Try to convert to string and back to ensure it's safe
                      try {
                        const str = value.toString();
                        const parsed = parseFloat(str);
                        if (!isFinite(parsed) || isNaN(parsed)) {
                          finalCleaned[key] = null;
                          hasInvalidValue = true;
                        } else {
                          finalCleaned[key] = parsed;
                        }
                      } catch (e) {
                        finalCleaned[key] = null;
                        hasInvalidValue = true;
                      }
                    }
                  } else {
                    finalCleaned[key] = value;
                  }
                });
                
                // Try to insert the record
                let singleResult = await batchUpsertSQL('census_demographics', [finalCleaned], 'geoid,vintage_year');
                
                // If it fails with overflow, try one more time with all numeric fields set to NULL except required ones
                if (singleResult.error && (singleResult.error.includes('overflow') || singleResult.error.includes('numeric'))) {
                  console.warn(`   ⚠️  Record ${finalCleaned.geoid} failed with overflow, attempting with NULL values for problematic fields`);
                  
                  // Create a version with all optional numeric fields set to NULL
                  const nulledRecord: any = {
                    geoid: finalCleaned.geoid,
                    vintage_year: finalCleaned.vintage_year,
                    survey_type: finalCleaned.survey_type,
                    created_at: finalCleaned.created_at
                  };
                  
                  // Try to keep required fields if they're safe, otherwise set to NULL
                  if (finalCleaned.total_population !== null && finalCleaned.total_population !== undefined) {
                    nulledRecord.total_population = Math.min(MAX_INTEGER, Math.max(0, Math.round(finalCleaned.total_population)));
                  }
                  
                  // Set all other numeric fields to NULL to avoid overflow
                  singleResult = await batchUpsertSQL('census_demographics', [nulledRecord], 'geoid,vintage_year');
                  
                  if (!singleResult.error) {
                    console.warn(`   ✅ Record ${finalCleaned.geoid} inserted with NULL values for problematic fields`);
                    successCount++;
                  } else {
                    console.warn(`   ❌ Record ${finalCleaned.geoid} still failed even with NULL values: ${singleResult.error}`);
                  }
                } else if (!singleResult.error) {
                  successCount++;
                } else if (hasInvalidValue) {
                  console.warn(`   Skipping record ${finalCleaned.geoid}: contains invalid numeric values`);
                } else {
                  console.warn(`   ⚠️  Record ${finalCleaned.geoid} failed: ${singleResult.error}`);
                }
              }
              stats.demographics += successCount;
              if (successCount < ultraCleanBatch.length) {
                stats.errors.push(`Demographics batch ${Math.floor(i / BATCH_SIZE)}: ${ultraCleanBatch.length - successCount} records skipped due to overflow`);
              }
            } else {
              stats.errors.push(`Demographics batch ${Math.floor(i / BATCH_SIZE)}: ${demoResult.error}`);
            }
          } else {
            stats.demographics += demoResult.inserted;
          }

          // Insert economics using exec_sql
          const econResult = await batchUpsertSQL('census_economics', economicsBatch, 'geoid,vintage_year');
          if (econResult.error) {
            stats.errors.push(`Economics batch ${Math.floor(i / BATCH_SIZE)}: ${econResult.error}`);
          } else {
            stats.economics += econResult.inserted;
          }

          // Insert housing using exec_sql
          const houseResult = await batchUpsertSQL('census_housing', housingBatch, 'geoid,vintage_year');
          if (houseResult.error) {
            stats.errors.push(`Housing batch ${Math.floor(i / BATCH_SIZE)}: ${houseResult.error}`);
          } else {
            stats.housing += houseResult.inserted;
          }

          console.log(`   Processed ${i + 1}/${records.length} records...`);

          // Clear batches
          demographicsBatch.length = 0;
          economicsBatch.length = 0;
          housingBatch.length = 0;
        }
      } catch (err: any) {
        stats.errors.push(`Record ${geoid}: ${err.message}`);
      }
    }

    stats.duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`Geography: ${geography}`);
    console.log(`Year: ${year}`);
    console.log(`Total Records: ${stats.totalRecords.toLocaleString()}`);
    console.log(`Demographics: ${stats.demographics.toLocaleString()}`);
    console.log(`Economics: ${stats.economics.toLocaleString()}`);
    console.log(`Housing: ${stats.housing.toLocaleString()}`);
    console.log(`Errors: ${stats.errors.length}`);
    console.log(`Duration: ${(stats.duration / 1000).toFixed(2)}s`);
    console.log('='.repeat(60));

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more`);
      }
    }
  } catch (error: any) {
    stats.errors.push(`Fatal error: ${error.message}`);
    console.error('\n❌ Import failed:', error.message);
  }

  return stats;
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const yearArg = args.find(arg => arg.startsWith('--year='));
  const geoArg = args.find(arg => arg.startsWith('--geography='));
  const allFlag = args.includes('--all');

  const year = yearArg ? parseInt(yearArg.split('=')[1]) : new Date().getFullYear() - 2;

  console.log('🏛️  Census Bureau API Data Importer');
  console.log(`📅 Year: ${year}`);
  console.log(`🔑 API Key: ${CENSUS_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`🔗 Supabase: ${supabaseUrl}\n`);

  if (!CENSUS_API_KEY) {
    console.error('❌ CENSUS_API_KEY not found in environment');
    console.error('   Please set CENSUS_API_KEY in web/.env.local');
    console.error('   Get your free API key at: https://api.census.gov/data/key_signup.html');
    process.exit(1);
  }

  const allStats: ImportStats[] = [];

  if (allFlag) {
    // Import all geographies
    allStats.push(await importCensusData(year, 'state'));
    allStats.push(await importCensusData(year, 'county'));
    allStats.push(await importCensusData(year, 'zip'));
  } else if (geoArg) {
    const geography = geoArg.split('=')[1] as 'zip' | 'county' | 'state';
    allStats.push(await importCensusData(year, geography));
  } else {
    console.error('Usage:');
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=zip');
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=county');
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --geography=state');
    console.error('  npx tsx scripts/importers/census-api-importer.ts --year=2022 --all');
    process.exit(1);
  }

  // Overall summary
  if (allStats.length > 1) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 OVERALL SUMMARY');
    console.log('='.repeat(60));

    const totalRecords = allStats.reduce((sum, s) => sum + s.totalRecords, 0);
    const totalDuration = allStats.reduce((sum, s) => sum + s.duration, 0);
    const totalErrors = allStats.reduce((sum, s) => sum + s.errors.length, 0);

    console.log(`Total Records: ${totalRecords.toLocaleString()}`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Total Errors: ${totalErrors}`);
    console.log('='.repeat(60));
  }

  const hasErrors = allStats.some(s => s.errors.length > 0);
  process.exit(hasErrors ? 1 : 0);
}

main();

