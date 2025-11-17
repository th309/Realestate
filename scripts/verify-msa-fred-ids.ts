/**
 * Verify MSA FRED Series IDs
 * 
 * Double-checks that populated FRED series IDs are correct by:
 * 1. Verifying each series ID exists in FRED
 * 2. Checking that the series title matches the MSA name
 * 3. Validating the series has recent data
 * 4. Flagging any mismatches or invalid series IDs
 * 
 * Usage:
 *   npx tsx scripts/verify-msa-fred-ids.ts --field=unemployment_rate
 *   npx tsx scripts/verify-msa-fred-ids.ts --all
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { writeFileSync } from 'fs';

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
  field: string;
  seriesId: string;
  valid: boolean;
  hasData: boolean;
  title: string | null;
  matchesMSA: boolean;
  error?: string;
}

async function getSeriesInfo(seriesId: string, retries: number = 3): Promise<{ exists: boolean; title?: string; hasData?: boolean; error?: string }> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = `${FRED_BASE_URL}/series?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json`;
      const response = await fetch(url);
      
      if (response.status === 429) {
        // Rate limited - wait with exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        if (attempt < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        return { exists: false, error: `HTTP 429 (Rate Limited)` };
      }
      
      if (!response.ok) {
        return { exists: false, error: `HTTP ${response.status}` };
      }

    const data = await response.json();
    
    if (data.error_code) {
      return { exists: false, error: data.error_message || 'Series not found' };
    }

    if (!data.seriess || data.seriess.length === 0) {
      return { exists: false, error: 'Series not found' };
    }

    const series = data.seriess[0];
    
    // Check if series has recent data (within last 2 years)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);
    
    const dataUrl = `${FRED_BASE_URL}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc&observation_start=${startDate.toISOString().split('T')[0]}&observation_end=${endDate.toISOString().split('T')[0]}`;
    const dataResponse = await fetch(dataUrl);
    
    let hasData = false;
    if (dataResponse.ok) {
      const dataData = await dataResponse.json();
      if (dataData.observations && dataData.observations.length > 0) {
        const latest = dataData.observations[0];
        hasData = latest.value !== '.' && latest.value !== null;
      }
    }

    return {
      exists: true,
      title: series.title,
      hasData
    };
  } catch (error: any) {
    return { exists: false, error: error.message };
  }
}

function cleanNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+msa\s*/gi, ' ')
    .replace(/\s+metropolitan\s+statistical\s+area\s*/gi, ' ')
    .replace(/\s*-\s*/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function checkMSAMatch(seriesTitle: string, msaName: string): boolean {
  const cleanTitle = cleanNameForMatch(seriesTitle);
  const cleanMSA = cleanNameForMatch(msaName);
  
  // Get first significant word from MSA name
  const msaWords = cleanMSA.split(' ').filter(w => w.length > 2);
  if (msaWords.length === 0) return false;
  
  const firstWord = msaWords[0];
  
  // Must contain first word of MSA name
  if (!cleanTitle.includes(firstWord)) {
    return false;
  }
  
  // Should contain MSA/metropolitan indicator
  if (!cleanTitle.includes('msa') && !cleanTitle.includes('metropolitan')) {
    // Allow if it's a known pattern (like NGMP for GDP)
    if (!seriesTitle.includes('NGMP')) {
      return false;
    }
  }
  
  return true;
}

async function verifyMSASeriesIds(field: string): Promise<VerificationResult[]> {
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

  console.log(`\n🔍 Verifying ${field} series IDs for MSAs...\n`);

  const { data: msas, error } = await supabase
    .from('tiger_cbsa')
    .select(`geoid, name, ${column}`)
    .eq('lsad', 'M1')
    .not(column, 'is', null);

  if (error) {
    console.error(`❌ Error fetching MSAs: ${error.message}`);
    process.exit(1);
  }

  const results: VerificationResult[] = [];
  const total = msas?.length || 0;

  for (let i = 0; i < total; i++) {
    const msa = msas![i];
    const seriesId = msa[column];
    
    console.log(`[${i + 1}/${total}] ${msa.name} (${msa.geoid}): ${seriesId}...`);

    const info = await getSeriesInfo(seriesId);
    const matchesMSA = info.title ? checkMSAMatch(info.title, msa.name) : false;

    const result: VerificationResult = {
      geoid: msa.geoid,
      name: msa.name,
      field,
      seriesId,
      valid: info.exists,
      hasData: info.hasData || false,
      title: info.title || null,
      matchesMSA,
      error: info.error
    };

    results.push(result);

    if (info.exists && matchesMSA && info.hasData) {
      console.log(`   ✅ Valid and matches MSA`);
    } else if (info.exists && !matchesMSA) {
      console.log(`   ⚠️  Valid but may not match MSA: ${info.title?.substring(0, 60)}...`);
    } else if (info.exists && !info.hasData) {
      console.log(`   ⚠️  Valid but no recent data`);
    } else {
      console.log(`   ❌ Invalid: ${info.error || 'Not found'}`);
    }

    // Rate limiting - increased delay to avoid 429 errors
    await new Promise(resolve => setTimeout(resolve, 300));

    // Progress update every 20
    if ((i + 1) % 20 === 0) {
      const valid = results.filter(r => r.valid && r.matchesMSA && r.hasData).length;
      console.log(`\n   Progress: ${i + 1}/${total} | Valid: ${valid}\n`);
    }
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const field = args.find(arg => arg.startsWith('--field='))?.split('=')[1];
  const all = args.includes('--all');

  console.log('🔍 MSA FRED Series ID Verification Tool\n');

  const fields = all
    ? ['unemployment_rate', 'employment_total', 'median_household_income', 'gdp', 'housing_permits']
    : field
      ? [field]
      : ['unemployment_rate'];

  const allResults: VerificationResult[] = [];

  for (const f of fields) {
    const results = await verifyMSASeriesIds(f);
    allResults.push(...results);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Verification Summary:');
  console.log('='.repeat(60));

  const valid = allResults.filter(r => r.valid && r.matchesMSA && r.hasData).length;
  const invalid = allResults.filter(r => !r.valid).length;
  const noData = allResults.filter(r => r.valid && !r.hasData).length;
  const mismatch = allResults.filter(r => r.valid && !r.matchesMSA).length;

  console.log(`✅ Valid (exists, matches MSA, has data): ${valid}`);
  console.log(`⚠️  Valid but no recent data: ${noData}`);
  console.log(`⚠️  Valid but may not match MSA: ${mismatch}`);
  console.log(`❌ Invalid (not found): ${invalid}`);
  console.log(`📊 Total verified: ${allResults.length}`);

  // Export invalid/mismatched results
  const issues = allResults.filter(r => !r.valid || !r.matchesMSA || !r.hasData);
  if (issues.length > 0) {
    const csv = [
      'geoid,name,field,series_id,valid,has_data,matches_msa,title,error',
      ...issues.map(r =>
        `"${r.geoid}","${r.name}","${r.field}","${r.seriesId}","${r.valid}","${r.hasData}","${r.matchesMSA}","${r.title || ''}","${r.error || ''}"`
      )
    ].join('\n');

    const filename = `msa-fred-ids-issues-${Date.now()}.csv`;
    writeFileSync(filename, csv, 'utf-8');
    console.log(`\n📄 Exported ${issues.length} issues to ${filename}`);
  }

  // Export all results
  const allCsv = [
    'geoid,name,field,series_id,valid,has_data,matches_msa,title,error',
    ...allResults.map(r =>
      `"${r.geoid}","${r.name}","${r.field}","${r.seriesId}","${r.valid}","${r.hasData}","${r.matchesMSA}","${r.title || ''}","${r.error || ''}"`
    )
  ].join('\n');

  const allFilename = `msa-fred-ids-verification-${Date.now()}.csv`;
  writeFileSync(allFilename, allCsv, 'utf-8');
  console.log(`📄 Exported all results to ${allFilename}`);
}

main().catch(console.error);

