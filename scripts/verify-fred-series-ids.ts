/**
 * Verify FRED Series IDs
 * 
 * Tests FRED series IDs by querying the FRED API to verify they exist and return data.
 * 
 * Usage:
 *   npx tsx scripts/verify-fred-series-ids.ts --geography=state --field=unemployment_rate
 *   npx tsx scripts/verify-fred-series-ids.ts --geography=state --field=employment_total
 *   npx tsx scripts/verify-fred-series-ids.ts --geography=state --all
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../web/.env.local') });

const FRED_API_KEY = process.env.FRED_API_KEY || '';
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

if (!FRED_API_KEY) {
  console.error('❌ Error: Missing FRED_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface VerificationResult {
  geoid: string;
  name: string;
  seriesId: string;
  field: string;
  exists: boolean;
  hasData: boolean;
  error?: string;
  sampleDate?: string;
  sampleValue?: number;
}

async function verifyFREDSeries(seriesId: string): Promise<{
  exists: boolean;
  hasData: boolean;
  error?: string;
  sampleDate?: string;
  sampleValue?: number;
}> {
  try {
    // First, check if series exists by getting series info
    const infoUrl = `${FRED_BASE_URL}/series?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json`;
    const infoResponse = await fetch(infoUrl);
    
    if (!infoResponse.ok) {
      return {
        exists: false,
        hasData: false,
        error: `HTTP ${infoResponse.status}`
      };
    }

    const infoData = await infoResponse.json();
    
    if (infoData.error_code) {
      return {
        exists: false,
        hasData: false,
        error: infoData.error_message || 'Series not found'
      };
    }

    if (!infoData.seriess || infoData.seriess.length === 0) {
      return {
        exists: false,
        hasData: false,
        error: 'Series not found'
      };
    }

    // Series exists, now check if it has recent data
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    const startDateStr = startDate.toISOString().split('T')[0];

    const dataUrl = `${FRED_BASE_URL}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc&observation_start=${startDateStr}&observation_end=${endDate}`;
    const dataResponse = await fetch(dataUrl);
    
    if (!dataResponse.ok) {
      return {
        exists: true,
        hasData: false,
        error: `HTTP ${dataResponse.status}`
      };
    }

    const dataData = await dataResponse.json();
    
    if (dataData.error_code) {
      return {
        exists: true,
        hasData: false,
        error: dataData.error_message || 'No data available'
      };
    }

    if (dataData.observations && dataData.observations.length > 0) {
      const latest = dataData.observations[0];
      return {
        exists: true,
        hasData: latest.value !== '.' && latest.value !== null,
        sampleDate: latest.date,
        sampleValue: latest.value !== '.' ? parseFloat(latest.value) : undefined
      };
    }

    return {
      exists: true,
      hasData: false,
      error: 'No observations found'
    };
  } catch (error: any) {
    return {
      exists: false,
      hasData: false,
      error: error.message
    };
  }
}

async function verifyStateSeriesIds(field: string): Promise<VerificationResult[]> {
  const columnMap: Record<string, string> = {
    'unemployment_rate': 'fred_unemployment_rate_series_id',
    'employment_total': 'fred_employment_total_series_id',
    'median_household_income': 'fred_median_household_income_series_id',
    'gdp': 'fred_gdp_series_id',
    'housing_permits': 'fred_housing_permits_series_id'
  };

  const column = columnMap[field];
  if (!column) {
    console.error(`❌ Unknown field: ${field}`);
    process.exit(1);
  }

  // Get states with series IDs for this field
  const { data, error } = await supabase
    .from('tiger_states')
    .select(`geoid, name, state_abbreviation, ${column}`)
    .not(column, 'is', null)
    .limit(10); // Test with first 10 states

  if (error) {
    console.error(`❌ Error fetching states: ${error.message}`);
    process.exit(1);
  }

  console.log(`\n🔍 Verifying ${field} series IDs for ${data?.length || 0} states...\n`);

  const results: VerificationResult[] = [];

  for (const state of data || []) {
    const seriesId = state[column];
    console.log(`   Testing ${state.name} (${state.state_abbreviation}): ${seriesId}...`);
    
    const verification = await verifyFREDSeries(seriesId);
    
    results.push({
      geoid: state.geoid,
      name: state.name,
      seriesId: seriesId,
      field: field,
      ...verification
    });

    if (verification.exists && verification.hasData) {
      console.log(`      ✅ Valid (${verification.sampleDate}: ${verification.sampleValue})`);
    } else if (verification.exists) {
      console.log(`      ⚠️  Exists but no recent data: ${verification.error || 'No data'}`);
    } else {
      console.log(`      ❌ Invalid: ${verification.error || 'Not found'}`);
    }

    // Rate limiting - wait 200ms between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const geography = args.find(arg => arg.startsWith('--geography='))?.split('=')[1] || 'state';
  const field = args.find(arg => arg.startsWith('--field='))?.split('=')[1];
  const allFields = args.includes('--all');

  if (geography !== 'state') {
    console.error('❌ Only state-level verification is currently supported');
    process.exit(1);
  }

  const fields = allFields 
    ? ['unemployment_rate', 'employment_total', 'median_household_income', 'gdp', 'housing_permits']
    : field 
      ? [field]
      : ['unemployment_rate'];

  console.log('🔍 FRED Series ID Verification Tool\n');
  console.log(`Geography: ${geography}`);
  console.log(`Fields: ${fields.join(', ')}\n`);

  const allResults: VerificationResult[] = [];

  for (const f of fields) {
    const results = await verifyStateSeriesIds(f);
    allResults.push(...results);
    console.log();
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log('='.repeat(60));
  
  const valid = allResults.filter(r => r.exists && r.hasData).length;
  const existsNoData = allResults.filter(r => r.exists && !r.hasData).length;
  const invalid = allResults.filter(r => !r.exists).length;

  console.log(`✅ Valid (exists with data): ${valid}`);
  console.log(`⚠️  Exists but no data: ${existsNoData}`);
  console.log(`❌ Invalid (not found): ${invalid}`);
  console.log(`📊 Total tested: ${allResults.length}`);

  // Show invalid series IDs
  const invalidSeries = allResults.filter(r => !r.exists);
  if (invalidSeries.length > 0) {
    console.log('\n❌ Invalid Series IDs:');
    invalidSeries.forEach(r => {
      console.log(`   ${r.name} (${r.seriesId}): ${r.error}`);
    });
  }
}

main().catch(console.error);

