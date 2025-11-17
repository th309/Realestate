/**
 * FRED (Federal Reserve Economic Data) API Importer
 *
 * Imports economic time series data from FRED API
 * - Supports state, county, and metro (MSA) levels
 * - Handles multiple economic indicators
 * - Time series data with historical values
 *
 * Usage:
 *   npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=state
 *   npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=county
 *   npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=msa
 *   npx tsx scripts/importers/fred-api-importer.ts --year=2024 --all
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../../web/.env.local') });

const FRED_API_KEY = process.env.FRED_API_KEY || '';
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// FRED Series ID mappings to database fields
interface FREDSeries {
  seriesId: string | ((geoid: string) => string); // Can be static or a function to generate from GEOID
  field: string;
  description: string;
  geography: 'state' | 'county' | 'msa' | 'national';
  transform?: (value: number) => number;
}

// Common FRED series IDs for different geographies
// Note: FRED uses specific series IDs. For state/county/MSA, you may need to search for the correct IDs
const FRED_SERIES: FREDSeries[] = [
  // National level series
  { 
    seriesId: 'UNRATE', 
    field: 'unemployment_rate', 
    description: 'Unemployment Rate (National)', 
    geography: 'national' 
  },
  { 
    seriesId: 'PAYEMS', 
    field: 'employment_total', 
    description: 'Total Nonfarm Payrolls (National)', 
    geography: 'national' 
  },
  { 
    seriesId: 'MEHOINUSA646N', 
    field: 'median_household_income', 
    description: 'Median Household Income (National)', 
    geography: 'national' 
  },
  { 
    seriesId: 'GDP', 
    field: 'gdp_millions', 
    description: 'Gross Domestic Product (National)', 
    geography: 'national',
    transform: (v) => v / 1000 // Convert billions to millions
  },
  { 
    seriesId: 'MORTGAGE30US', 
    field: 'mortgage_rate_30yr', 
    description: '30-Year Fixed Rate Mortgage (National)', 
    geography: 'national' 
  },
  
  // State-level series examples
  // Format: State abbreviation + series suffix
  // CAUR = California Unemployment Rate
  // Note: You'll need to map state FIPS codes to state abbreviations
  { 
    seriesId: (geoid: string) => {
      // Map state FIPS to state abbreviation, then add 'UR' for unemployment rate
      // This is a placeholder - you'll need actual state FIPS to abbreviation mapping
      const stateAbbrev = getStateAbbreviation(geoid);
      return stateAbbrev ? `${stateAbbrev}UR` : null;
    },
    field: 'unemployment_rate', 
    description: 'State Unemployment Rate', 
    geography: 'state' 
  },
];

// PostgreSQL INTEGER max value
const MAX_INTEGER = 2147483647;
const MIN_INTEGER = -2147483648;

// State FIPS to abbreviation mapping (2-digit FIPS codes)
const STATE_FIPS_TO_ABBREV: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY'
};

function getStateAbbreviation(fips: string): string | null {
  return STATE_FIPS_TO_ABBREV[fips] || null;
}

async function ensureGeographicUnitExists(geoid: string, level: string, name: string): Promise<void> {
  // Check if it exists
  const { data: existing, error: checkError } = await supabase
    .from('geographic_units')
    .select('geoid')
    .eq('geoid', geoid)
    .maybeSingle();

  if (checkError && checkError.code !== 'PGRST116') {
    console.warn(`   ⚠️  Error checking geographic_units: ${checkError.message}`);
  }

  if (!existing) {
    // Create in geographic_units
    const geoResult = await batchUpsertSQL('geographic_units', [{
      geoid,
      level,
      name
    }], 'geoid');

    if (geoResult.error) {
      console.warn(`   ⚠️  Error creating geographic_units entry: ${geoResult.error}`);
    }

    // Also create in markets
    const marketResult = await batchUpsertSQL('markets', [{
      region_id: geoid,
      region_name: name,
      region_type: level,
      geoid
    }], 'region_id');

    if (marketResult.error) {
      console.warn(`   ⚠️  Error creating markets entry: ${marketResult.error}`);
    }
  }
}

interface ImportStats {
  geography: string;
  year: number;
  totalRecords: number;
  seriesProcessed: number;
  errors: string[];
  duration: number;
}

async function fetchFREDSeries(
  seriesId: string,
  observationStart?: string,
  observationEnd?: string
): Promise<any[]> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: FRED_API_KEY,
    file_type: 'json',
    observation_start: observationStart || '2000-01-01',
    observation_end: observationEnd || new Date().toISOString().split('T')[0],
  });

  const url = `${FRED_BASE_URL}/series/observations?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FRED API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.error_code) {
      throw new Error(`FRED API error: ${data.error_message || 'Unknown error'}`);
    }

    return data.observations || [];
  } catch (error: any) {
    throw new Error(`Failed to fetch FRED series ${seriesId}: ${error.message}`);
  }
}

async function getFREDSeriesInfo(seriesId: string): Promise<any> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: FRED_API_KEY,
    file_type: 'json',
  });

  const url = `${FRED_BASE_URL}/series?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`FRED API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error_code) {
      throw new Error(`FRED API error: ${data.error_message || 'Unknown error'}`);
    }

    return data.seriess?.[0] || null;
  } catch (error: any) {
    throw new Error(`Failed to fetch FRED series info ${seriesId}: ${error.message}`);
  }
}

function parseValue(value: string): number | null {
  if (value === null || value === undefined || value === '.') {
    return null; // FRED uses '.' for missing values
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseInteger(value: string): number | null {
  const parsed = parseValue(value);
  if (parsed === null) return null;
  const rounded = Math.round(parsed);
  if (rounded > MAX_INTEGER) return MAX_INTEGER;
  if (rounded < MIN_INTEGER) return MIN_INTEGER;
  return rounded;
}

function parseNumeric(value: string, maxValue: number = 999999999999): number | null {
  const parsed = parseValue(value);
  if (parsed === null) return null;
  if (parsed > maxValue) return maxValue;
  if (parsed < -maxValue) return -maxValue;
  return Math.round(parsed * 100) / 100;
}

// Helper: Escape SQL string
function escapeSQL(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!isFinite(value) || isNaN(value)) return 'NULL';
    const maxSafe = 999999999999;
    const minSafe = -999999999999;
    let safeValue = value;
    if (value > maxSafe) safeValue = maxSafe;
    else if (value < minSafe) safeValue = minSafe;
    if (Math.abs(safeValue) < 0.000001 && safeValue !== 0) return '0';
    if (Number.isInteger(safeValue)) {
      return safeValue.toString();
    } else {
      const fixed = safeValue.toFixed(10);
      return parseFloat(fixed).toString();
    }
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) {
    return `'${value.toISOString().split('T')[0]}'`;
  }
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
    const columns = Object.keys(records[0]);
    const values = records.map(record => {
      const vals = columns.map(col => escapeSQL(record[col]));
      return `(${vals.join(', ')})`;
    });

    const conflictCols = conflictColumn.split(',').map(c => c.trim());
    const conflictClause = conflictCols.length > 1
      ? conflictCols.join(', ')
      : conflictColumn;

    const updateColumns = columns.filter(col => !conflictCols.includes(col));
    const updateClause = updateColumns.length > 0
      ? `DO UPDATE SET ${updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}`
      : 'DO NOTHING';

    const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${values.join(', ')}
      ON CONFLICT (${conflictClause}) ${updateClause}
    `;

    const { error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
      return { inserted: 0, error: error.message };
    }

    return { inserted: records.length };
  } catch (err: any) {
    return { inserted: 0, error: err.message };
  }
}

async function getGeographicUnits(geography: 'state' | 'county' | 'msa'): Promise<Array<{geoid: string, [key: string]: any}>> {
  // Get GEOIDs and any additional data from geographic_units table
  let level = '';
  switch (geography) {
    case 'state':
      level = 'state';
      break;
    case 'county':
      level = 'county';
      break;
    case 'msa':
      level = 'cbsa';
      break;
  }

  const { data, error } = await supabase
    .from('geographic_units')
    .select('*')
    .eq('level', level);

  if (error) {
    console.warn(`   ⚠️  Could not fetch ${geography} GEOIDs: ${error.message}`);
    return [];
  }

  return (data || []).map(row => ({ geoid: row.geoid, ...row }));
}


async function importFREDData(
  year: number,
  geography: 'state' | 'county' | 'msa' | 'national'
): Promise<ImportStats> {
  const startTime = Date.now();
  const stats: ImportStats = {
    geography,
    year,
    totalRecords: 0,
    seriesProcessed: 0,
    errors: [],
    duration: 0
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Importing FRED ${year} Data - ${geography.toUpperCase()}`);
  console.log('='.repeat(60));

  try {
    // Get relevant series for this geography
    const relevantSeries = FRED_SERIES.filter(s => s.geography === geography || s.geography === 'national');

    if (relevantSeries.length === 0) {
      console.log(`   ⚠️  No FRED series configured for ${geography}`);
      return stats;
    }

    // Get geographic units (with full data to check for FRED series IDs)
    let geoUnits: Array<{geoid: string, [key: string]: any}> = [];
    let geoids: string[] = [];
    if (geography !== 'national') {
      geoUnits = await getGeographicUnits(geography);
      geoids = geoUnits.map(u => u.geoid);
      console.log(`   Found ${geoids.length} ${geography} units`);
    } else {
      geoids = ['US']; // National level
      geoUnits = [{ geoid: 'US' }];
      // Ensure 'US' exists in geographic_units
      await ensureGeographicUnitExists('US', 'state', 'United States');
      console.log(`   Ensured 'US' geographic unit exists`);
    }

    const observationStart = `${year}-01-01`;
    const observationEnd = `${year}-12-31`;

    // Process each series
    for (const series of relevantSeries) {
      try {
        const seriesIdStr = typeof series.seriesId === 'string' ? series.seriesId : 'dynamic';
        console.log(`   Processing ${seriesIdStr} (${series.description})...`);

        // For state/county/MSA, we need to construct series IDs
        let seriesIds: string[] = [];
        
        if (geography === 'national') {
          // National series - use the series ID directly
          if (typeof series.seriesId === 'string') {
            seriesIds = [series.seriesId];
          } else {
            // If it's a function, call it with 'US' as the GEOID
            const id = series.seriesId('US');
            if (id) seriesIds = [id];
          }
        } else if (geography === 'state' || geography === 'county' || geography === 'msa') {
          // For state/county/MSA, get FRED series IDs from normalization tables
          // Check geoUnits for FRED series ID columns or use state_abbreviation to construct
          const seriesIdMap = new Map<string, string>();
          
          // Check each geoUnit for FRED series ID information
          for (const unit of geoUnits) {
            const geoid = unit.geoid;
            let seriesId: string | null = null;
            
            // Check for FRED series ID in various possible locations
            // 1. Direct column (e.g., fred_unemployment_rate_series_id)
            const possibleColumnNames = [
              `fred_${series.field}_series_id`,
              `fred_${series.field}`,
              'fred_series_id',
              'series_id'
            ];
            
            for (const colName of possibleColumnNames) {
              if (unit[colName]) {
                seriesId = unit[colName];
                break;
              }
            }
            
            // 2. For states, construct from state_abbreviation if available
            if (!seriesId && geography === 'state' && unit.state_abbreviation) {
              const fieldToSuffix: Record<string, string> = {
                'unemployment_rate': 'UR',
                'employment_total': 'PAYEMS',
                'median_household_income': 'MEHOIN',
              };
              const suffix = fieldToSuffix[series.field];
              if (suffix) {
                seriesId = `${unit.state_abbreviation}${suffix}`;
              }
            }
            
            // 3. For counties/MSA, check if geoid can be used directly or needs mapping
            if (!seriesId && (geography === 'county' || geography === 'msa')) {
              // FRED series IDs for counties/MSA may be in the geoid itself or need construction
              // This would depend on FRED's series ID format for these geographies
            }
            
            if (seriesId) {
              seriesIdMap.set(geoid, seriesId);
            }
          }
          
          if (seriesIdMap.size === 0) {
            console.warn(`     ⚠️  No FRED series IDs found in normalization tables for ${series.field}`);
            
            // Fallback: try function-based generation for states
            if (geography === 'state' && typeof series.seriesId === 'function') {
              seriesIds = geoids
                .map(geoid => series.seriesId(geoid))
                .filter((id): id is string => id !== null);
              console.log(`     Using function-based series ID generation for ${seriesIds.length} states`);
            } else {
              continue;
            }
          } else {
            // Use series IDs from normalization tables
            const geoidToSeriesId = new Map<string, string>();
            for (const geoid of geoids) {
              const sid = seriesIdMap.get(geoid);
              if (sid) {
                geoidToSeriesId.set(geoid, sid);
              }
            }
            
            seriesIds = Array.from(geoidToSeriesId.values());
            console.log(`     Found ${seriesIds.length} FRED series IDs from normalization tables`);
            
            // Store the mapping for later use when processing observations
            (series as any).geoidToSeriesId = geoidToSeriesId;
          }
        }

        // Fetch data for each series ID
        for (const seriesId of seriesIds) {
          try {
            const observations = await fetchFREDSeries(seriesId, observationStart, observationEnd);
            
            if (observations.length === 0) {
              console.log(`     No data for ${seriesId}`);
              continue;
            }

            // Process observations into database records
            const records: any[] = [];
            
            // Get the geoid-to-seriesId mapping if it exists (for state/county/MSA)
            const geoidToSeriesId = (series as any).geoidToSeriesId as Map<string, string> | undefined;
            
            for (const obs of observations) {
              const value = series.transform 
                ? series.transform(parseValue(obs.value) || 0)
                : parseValue(obs.value);

              if (value === null) continue; // Skip missing values

              // Determine GEOID based on geography
              let geoid = 'US';
              if (geography === 'national') {
                geoid = 'US';
              } else if (geoidToSeriesId) {
                // Reverse lookup: find which geoid this seriesId belongs to
                for (const [gid, sid] of geoidToSeriesId.entries()) {
                  if (sid === seriesId) {
                    geoid = gid;
                    break;
                  }
                }
              } else if (geography === 'state') {
                // Fallback: try to extract from series ID (e.g., "CAUR" -> "06" for California)
                // This is a heuristic and may not always work
                const stateAbbrev = seriesId.substring(0, 2);
                // Reverse lookup state abbreviation to FIPS
                for (const [fips, abbrev] of Object.entries(STATE_FIPS_TO_ABBREV)) {
                  if (abbrev === stateAbbrev) {
                    geoid = fips;
                    break;
                  }
                }
              } else if (geography === 'county' || geography === 'msa') {
                // For county/MSA, we'd need the series ID to contain the GEOID
                // This is a placeholder - actual implementation depends on FRED series ID format
                console.warn(`     ⚠️  Cannot determine GEOID for ${seriesId} - skipping`);
                continue;
              }

              const record: any = {
                geoid,
                series_id: seriesId,
                metric_date: obs.date,
                [series.field]: value,
                data_vintage: obs.date,
                created_at: new Date().toISOString()
              };

              records.push(record);
            }

            // Insert records in batches
            if (records.length > 0) {
              const BATCH_SIZE = 100;
              // Use the main table for now (year-specific tables may not exist)
              const tableName = 'fred_economic_data';
              
              for (let i = 0; i < records.length; i += BATCH_SIZE) {
                const batch = records.slice(i, i + BATCH_SIZE);
                const result = await batchUpsertSQL(tableName, batch, 'geoid,series_id,metric_date');
                
                if (result.error) {
                  stats.errors.push(`${seriesId} batch ${Math.floor(i / BATCH_SIZE)}: ${result.error}`);
                } else {
                  stats.totalRecords += result.inserted;
                }
              }

              console.log(`     ✅ Imported ${records.length} observations for ${seriesId}`);
            }
          } catch (err: any) {
            stats.errors.push(`${seriesId}: ${err.message}`);
            console.warn(`     ⚠️  Error processing ${seriesId}: ${err.message}`);
          }
        }

        stats.seriesProcessed++;
      } catch (err: any) {
        stats.errors.push(`${series.seriesId}: ${err.message}`);
        console.warn(`   ⚠️  Error processing series ${series.seriesId}: ${err.message}`);
      }
    }

    stats.duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(60));
    console.log(`Geography: ${geography}`);
    console.log(`Year: ${year}`);
    console.log(`Series Processed: ${stats.seriesProcessed}`);
    console.log(`Total Records: ${stats.totalRecords.toLocaleString()}`);
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

  const year = yearArg ? parseInt(yearArg.split('=')[1]) : new Date().getFullYear();

  console.log('🏛️  FRED API Data Importer');
  console.log(`📅 Year: ${year}`);
  console.log(`🔑 API Key: ${FRED_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`🔗 Supabase: ${supabaseUrl}\n`);

  if (!FRED_API_KEY) {
    console.error('❌ FRED_API_KEY not found in environment');
    console.error('   Please set FRED_API_KEY in web/.env.local');
    console.error('   Get your free API key at: https://fred.stlouisfed.org/docs/api/api_key.html');
    process.exit(1);
  }

  const allStats: ImportStats[] = [];

  if (allFlag) {
    allStats.push(await importFREDData(year, 'national'));
    allStats.push(await importFREDData(year, 'state'));
    allStats.push(await importFREDData(year, 'msa'));
  } else if (geoArg) {
    const geography = geoArg.split('=')[1] as 'state' | 'county' | 'msa' | 'national';
    allStats.push(await importFREDData(year, geography));
  } else {
    console.error('Usage:');
    console.error('  npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=national');
    console.error('  npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=state');
    console.error('  npx tsx scripts/importers/fred-api-importer.ts --year=2024 --geography=msa');
    console.error('  npx tsx scripts/importers/fred-api-importer.ts --year=2024 --all');
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

