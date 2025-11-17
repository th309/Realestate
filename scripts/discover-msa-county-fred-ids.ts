/**
 * Discover MSA and County FRED Series IDs
 * 
 * This script helps discover FRED series IDs for MSA and County levels by:
 * 1. Searching FRED API for series based on geography names
 * 2. Testing common patterns
 * 3. Exporting results for manual review
 * 
 * Usage:
 *   npx tsx scripts/discover-msa-county-fred-ids.ts --geography=msa --limit=10
 *   npx tsx scripts/discover-msa-county-fred-ids.ts --geography=county --limit=10
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

interface DiscoveryResult {
  geoid: string;
  name: string;
  field: string;
  seriesId: string | null;
  verified: boolean;
  error?: string;
}

async function searchFREDSeries(searchText: string): Promise<any[]> {
  try {
    const url = `${FRED_BASE_URL}/series/search?search_text=${encodeURIComponent(searchText)}&api_key=${FRED_API_KEY}&file_type=json&limit=10`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.seriess || [];
  } catch (error) {
    return [];
  }
}

function extractStateAbbrev(name: string): string | null {
  // Try to extract state abbreviation from name like "Los Angeles County, CA"
  const match = name.match(/, ([A-Z]{2})$/);
  return match ? match[1] : null;
}

function cleanNameForSearch(name: string): string {
  // Remove common suffixes and clean up for search
  return name
    .replace(/\s+County\s*,?\s*/gi, ' ')
    .replace(/\s+MSA\s*/gi, ' ')
    .replace(/\s+Metropolitan\s+Statistical\s+Area\s*/gi, ' ')
    .replace(/\s*-\s*/g, ' ')
    .trim();
}

async function discoverMSASeriesIds(limit: number = 10): Promise<DiscoveryResult[]> {
  console.log(`\n🔍 Discovering FRED Series IDs for ${limit} MSAs...\n`);

  const { data: msas, error } = await supabase
    .from('tiger_cbsa')
    .select('geoid, name')
    .eq('lsad', 'M1') // Metropolitan Statistical Areas only
    .order('name')
    .limit(limit);

  if (error) {
    console.error(`❌ Error fetching MSAs: ${error.message}`);
    return [];
  }

  const results: DiscoveryResult[] = [];
  const fields = ['unemployment_rate', 'employment_total', 'median_household_income', 'gdp', 'housing_permits'];

  for (const msa of msas || []) {
    console.log(`\n📍 ${msa.name} (CBSA: ${msa.geoid})`);
    
    const cleanName = cleanNameForSearch(msa.name);
    
    for (const field of fields) {
      let seriesId: string | null = null;
      let verified = false;
      let error: string | undefined;

      // Build search query
      const searchQueries = [
        `${cleanName} ${field.replace('_', ' ')}`,
        `${cleanName} MSA ${field.replace('_', ' ')}`,
        `CBSA ${msa.geoid} ${field.replace('_', ' ')}`
      ];

      for (const query of searchQueries) {
        const series = await searchFREDSeries(query);
        
        // Look for the most relevant series
        const relevant = series.find(s => 
          s.title.toLowerCase().includes(cleanName.toLowerCase().split(' ')[0]) &&
          (s.title.toLowerCase().includes('msa') || s.title.toLowerCase().includes('metropolitan'))
        );

        if (relevant) {
          seriesId = relevant.id;
          verified = true;
          console.log(`   ✅ ${field}: ${seriesId} - ${relevant.title.substring(0, 60)}...`);
          break;
        }
      }

      if (!seriesId) {
        console.log(`   ⚠️  ${field}: Not found`);
        error = 'Not found in FRED';
      }

      results.push({
        geoid: msa.geoid,
        name: msa.name,
        field,
        seriesId,
        verified,
        error
      });

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
}

async function discoverCountySeriesIds(limit: number = 10): Promise<DiscoveryResult[]> {
  console.log(`\n🔍 Discovering FRED Series IDs for ${limit} Counties...\n`);

  const { data: counties, error } = await supabase
    .from('tiger_counties')
    .select('geoid, name, state_fips')
    .order('name')
    .limit(limit);

  if (error) {
    console.error(`❌ Error fetching counties: ${error.message}`);
    return [];
  }

  const results: DiscoveryResult[] = [];
  const fields = ['unemployment_rate', 'employment_total', 'median_household_income'];

  // Get state abbreviations for counties
  const { data: states } = await supabase
    .from('tiger_states')
    .select('geoid, state_abbreviation');

  const stateAbbrevMap = new Map<string, string>();
  states?.forEach(s => {
    if (s.state_abbreviation) {
      stateAbbrevMap.set(s.geoid, s.state_abbreviation);
    }
  });

  for (const county of counties || []) {
    const stateAbbrev = stateAbbrevMap.get(county.state_fips || '');
    console.log(`\n📍 ${county.name}, ${stateAbbrev || county.state_fips} (FIPS: ${county.geoid})`);
    
    const cleanName = cleanNameForSearch(county.name);
    const searchName = stateAbbrev ? `${cleanName} ${stateAbbrev}` : cleanName;
    
    for (const field of fields) {
      let seriesId: string | null = null;
      let verified = false;
      let error: string | undefined;

      // Build search queries
      const searchQueries = [
        `${searchName} ${field.replace('_', ' ')}`,
        `${searchName} County ${field.replace('_', ' ')}`,
        `FIPS ${county.geoid} ${field.replace('_', ' ')}`
      ];

      for (const query of searchQueries) {
        const series = await searchFREDSeries(query);
        
        // Look for the most relevant series
        const relevant = series.find(s => 
          s.title.toLowerCase().includes(cleanName.toLowerCase().split(' ')[0]) &&
          (s.title.toLowerCase().includes('county') || s.title.toLowerCase().includes(county.geoid))
        );

        if (relevant) {
          seriesId = relevant.id;
          verified = true;
          console.log(`   ✅ ${field}: ${seriesId} - ${relevant.title.substring(0, 60)}...`);
          break;
        }
      }

      if (!seriesId) {
        console.log(`   ⚠️  ${field}: Not found`);
        error = 'Not found in FRED';
      }

      results.push({
        geoid: county.geoid,
        name: county.name,
        field,
        seriesId,
        verified,
        error
      });

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return results;
}

async function exportResults(results: DiscoveryResult[], filename: string) {
  const csv = [
    'geoid,name,field,series_id,verified,error',
    ...results.map(r => 
      `"${r.geoid}","${r.name}","${r.field}","${r.seriesId || ''}","${r.verified}","${r.error || ''}"`
    )
  ].join('\n');

  writeFileSync(filename, csv, 'utf-8');
  console.log(`\n✅ Exported ${results.length} results to ${filename}`);
}

async function main() {
  const args = process.argv.slice(2);
  const geography = args.find(arg => arg.startsWith('--geography='))?.split('=')[1] || 'msa';
  const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '10');

  console.log('🔍 FRED Series ID Discovery Tool\n');
  console.log(`Geography: ${geography}`);
  console.log(`Limit: ${limit}\n`);

  let results: DiscoveryResult[] = [];

  if (geography === 'msa') {
    results = await discoverMSASeriesIds(limit);
    await exportResults(results, `msa-fred-ids-discovery-${Date.now()}.csv`);
  } else if (geography === 'county') {
    results = await discoverCountySeriesIds(limit);
    await exportResults(results, `county-fred-ids-discovery-${Date.now()}.csv`);
  } else {
    console.error(`❌ Unknown geography: ${geography}`);
    process.exit(1);
  }

  // Summary
  const verified = results.filter(r => r.verified).length;
  const notFound = results.filter(r => !r.verified).length;

  console.log('\n📊 Summary:');
  console.log(`✅ Found: ${verified}`);
  console.log(`❌ Not Found: ${notFound}`);
  console.log(`📊 Total: ${results.length}`);
}

main().catch(console.error);

