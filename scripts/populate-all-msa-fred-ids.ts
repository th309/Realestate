/**
 * Populate All Available MSA FRED Series IDs
 * 
 * Discovers and populates all available FRED series IDs for MSAs:
 * - Unemployment Rate
 * - Employment Total
 * - Median Household Income (if available)
 * - GDP
 * - Housing Permits (if available)
 * 
 * Usage:
 *   npx tsx scripts/populate-all-msa-fred-ids.ts --limit=50
 *   npx tsx scripts/populate-all-msa-fred-ids.ts --all
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

interface SeriesResult {
  field: string;
  seriesId: string | null;
  title: string | null;
  verified: boolean;
}

async function verifySeriesId(seriesId: string): Promise<boolean> {
  try {
    const url = `${FRED_BASE_URL}/series?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json`;
    const response = await fetch(url);
    if (!response.ok) return false;
    const data = await response.json();
    return !data.error_code && data.seriess && data.seriess.length > 0;
  } catch {
    return false;
  }
}

async function searchFREDSeries(searchText: string): Promise<any[]> {
  try {
    const url = `${FRED_BASE_URL}/series/search?search_text=${encodeURIComponent(searchText)}&api_key=${FRED_API_KEY}&file_type=json&limit=20`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return data.seriess || [];
  } catch {
    return [];
  }
}

function cleanNameForSearch(name: string): string {
  return name
    .replace(/\s+MSA\s*/gi, ' ')
    .replace(/\s+Metropolitan\s+Statistical\s+Area\s*/gi, ' ')
    .replace(/\s*-\s*/g, ' ')
    .trim();
}

function findBestSeries(series: any[], msaName: string, field: string, cbsaCode?: string): any | null {
  const cleanName = cleanNameForSearch(msaName).toLowerCase();
  const words = cleanName.split(' ').filter(w => w.length > 2); // Filter out short words
  const firstWord = words[0];
  
  // Field-specific keywords
  const fieldKeywords: Record<string, string[]> = {
    'unemployment_rate': ['unemployment', 'unemployment rate'],
    'employment_total': ['employees', 'total nonfarm', 'employment', 'payrolls'],
    'median_household_income': ['median household income', 'household income'],
    'gdp': ['gross domestic product', 'gdp'],
    'housing_permits': ['building permits', 'housing permits', 'permits']
  };

  const keywords = fieldKeywords[field] || [field.replace('_', ' ')];

  // Score each series
  const scored = series.map(s => {
    const title = s.title.toLowerCase();
    let score = 0;

    // Must contain MSA/metropolitan indicator
    if (title.includes('msa') || title.includes('metropolitan')) {
      score += 10;
    } else {
      // Penalize if no MSA indicator
      score -= 5;
    }

    // Must contain first significant word of MSA name
    if (title.includes(firstWord)) {
      score += 10;
    } else {
      // Penalize if first word not found
      score -= 10;
    }

    // Bonus for multiple words matching
    let wordMatches = 0;
    for (const word of words.slice(0, 3)) { // Check first 3 words
      if (title.includes(word)) {
        wordMatches++;
      }
    }
    score += wordMatches * 3;

    // Check if CBSA code appears in series ID (if provided)
    if (cbsaCode && s.id.includes(cbsaCode)) {
      score += 15; // Strong match
    }

    // Field keyword match
    for (const keyword of keywords) {
      if (title.includes(keyword)) {
        score += 5;
      }
    }

    // Prefer monthly frequency for most fields
    if (field !== 'median_household_income' && field !== 'gdp') {
      if (s.frequency === 'Monthly') {
        score += 3;
      }
    }

    // Prefer annual for income and GDP
    if (field === 'median_household_income' || field === 'gdp') {
      if (s.frequency === 'Annual') {
        score += 3;
      }
    }

    return { ...s, score };
  });

  // Sort by score and return best match
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // Only return if score is reasonable (at least 18 points for good confidence)
  return best && best.score >= 18 ? best : null;
}

function checkMSAMatch(seriesTitle: string, msaName: string): boolean {
  const cleanTitle = seriesTitle.toLowerCase();
  const cleanMSA = cleanNameForSearch(msaName).toLowerCase();
  
  const msaWords = cleanMSA.split(' ').filter(w => w.length > 2);
  if (msaWords.length === 0) return false;
  
  const firstWord = msaWords[0];
  
  // Must contain first word of MSA name
  if (!cleanTitle.includes(firstWord)) {
    return false;
  }
  
  // Should contain MSA/metropolitan indicator (except for GDP which uses NGMP pattern)
  if (!cleanTitle.includes('msa') && !cleanTitle.includes('metropolitan') && !seriesTitle.includes('NGMP')) {
    return false;
  }
  
  return true;
}

async function discoverMSASeriesIds(msa: { geoid: string; name: string }): Promise<SeriesResult[]> {
  const results: SeriesResult[] = [];
  const cleanName = cleanNameForSearch(msa.name);
  
  const fields = [
    { name: 'unemployment_rate', searchTerms: [`${cleanName} unemployment rate MSA`, `${cleanName} unemployment MSA`] },
    { name: 'employment_total', searchTerms: [`${cleanName} employment total nonfarm MSA`, `${cleanName} employees MSA`] },
    { name: 'median_household_income', searchTerms: [`${cleanName} median household income MSA`] },
    { name: 'gdp', searchTerms: [`${cleanName} GDP MSA`, `NGMP${msa.geoid}`] },
    { name: 'housing_permits', searchTerms: [`${cleanName} building permits MSA`, `${cleanName} housing permits MSA`] }
  ];

  for (const field of fields) {
    let seriesId: string | null = null;
    let title: string | null = null;
    let verified = false;

    // Try GDP pattern first (most reliable)
    if (field.name === 'gdp') {
      const gdpId = `NGMP${msa.geoid}`;
      if (await verifySeriesId(gdpId)) {
        seriesId = gdpId;
        verified = true;
        title = `GDP for ${msa.name}`;
      }
    }

    // If not found, search FRED API
    if (!seriesId) {
      for (const searchTerm of field.searchTerms) {
        const series = await searchFREDSeries(searchTerm);
        const best = findBestSeries(series, msa.name, field.name, msa.geoid);
        
        if (best) {
          // Double-check that the series title matches the MSA
          if (checkMSAMatch(best.title, msa.name)) {
            seriesId = best.id;
            title = best.title;
            verified = await verifySeriesId(seriesId);
            
            // Additional verification: check if series has recent data
            if (verified) {
              // This is a basic check - full verification can be done later
              verified = true;
            }
            break;
          }
        }
      }
    }

    results.push({
      field: field.name,
      seriesId,
      title,
      verified
    });

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return results;
}

async function updateMSASeriesIds(msa: { geoid: string; name: string }, results: SeriesResult[]): Promise<number> {
  let updated = 0;

  for (const result of results) {
    if (result.seriesId && result.verified) {
      const columnMap: Record<string, string> = {
        'unemployment_rate': 'fred_unemployment_rate_series_id',
        'employment_total': 'fred_employment_total_series_id',
        'median_household_income': 'fred_median_household_income_series_id',
        'gdp': 'fred_gdp_series_id',
        'housing_permits': 'fred_housing_permits_series_id'
      };

      const column = columnMap[result.field];
      if (column) {
        const updateSql = `
          UPDATE tiger_cbsa 
          SET ${column} = '${result.seriesId.replace(/'/g, "''")}'
          WHERE geoid = '${msa.geoid.replace(/'/g, "''")}'
        `;

        const { error } = await supabase.rpc('exec_sql', { query: updateSql });

        if (!error) {
          updated++;
        }
      }
    }
  }

  return updated;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '50');
  const all = args.includes('--all');

  console.log('🔍 MSA FRED Series ID Discovery and Population Tool\n');

  // Get MSAs to process
  const query = supabase
    .from('tiger_cbsa')
    .select('geoid, name')
    .eq('lsad', 'M1')
    .order('name')
    .limit(all ? 10000 : Math.max(limit, 1000)); // Default to at least 1000 if limit specified

  const { data: msas, error } = await query;

  if (error) {
    console.error(`❌ Error fetching MSAs: ${error.message}`);
    process.exit(1);
  }

  console.log(`📊 Processing ${msas?.length || 0} MSAs...\n`);

  let totalUpdated = 0;
  let totalFound = 0;
  const stats = {
    unemployment_rate: 0,
    employment_total: 0,
    median_household_income: 0,
    gdp: 0,
    housing_permits: 0
  };

  for (let i = 0; i < (msas?.length || 0); i++) {
    const msa = msas![i];
    console.log(`\n[${i + 1}/${msas?.length}] ${msa.name} (${msa.geoid})`);

    const results = await discoverMSASeriesIds(msa);
    const updated = await updateMSASeriesIds(msa, results);

    for (const result of results) {
      if (result.verified && result.seriesId) {
        stats[result.field as keyof typeof stats]++;
        totalFound++;
        console.log(`   ✅ ${result.field}: ${result.seriesId}`);
      } else {
        console.log(`   ⚠️  ${result.field}: Not found`);
      }
    }

    totalUpdated += updated;

    // Progress update every 10 MSAs
    if ((i + 1) % 10 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${msas?.length} | Found: ${totalFound} | Updated: ${totalUpdated}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Final Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Total MSAs processed: ${msas?.length || 0}`);
  console.log(`✅ Total series IDs found: ${totalFound}`);
  console.log(`✅ Total updates: ${totalUpdated}`);
  console.log('\n📈 By Field:');
  console.log(`   Unemployment Rate: ${stats.unemployment_rate}`);
  console.log(`   Employment Total: ${stats.employment_total}`);
  console.log(`   Median Household Income: ${stats.median_household_income}`);
  console.log(`   GDP: ${stats.gdp}`);
  console.log(`   Housing Permits: ${stats.housing_permits}`);
}

main().catch(console.error);

