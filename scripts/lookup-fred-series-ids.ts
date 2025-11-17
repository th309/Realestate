/**
 * Lookup FRED Series IDs
 * 
 * Helper tool to search FRED API for series IDs by geography and metric type.
 * Useful for finding the correct series ID when patterns don't work.
 * 
 * Usage:
 *   npx tsx scripts/lookup-fred-series-ids.ts --search="California unemployment"
 *   npx tsx scripts/lookup-fred-series-ids.ts --search="CAUR" --exact
 *   npx tsx scripts/lookup-fred-series-ids.ts --state=CA --metric=unemployment
 */

import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../web/.env.local') });

const FRED_API_KEY = process.env.FRED_API_KEY || '';
const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

if (!FRED_API_KEY) {
  console.error('❌ Error: Missing FRED_API_KEY');
  process.exit(1);
}

interface FREDSeries {
  id: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  units: string;
}

async function searchFREDSeries(searchText: string, exact: boolean = false): Promise<FREDSeries[]> {
  try {
    const searchType = exact ? 'series_id' : 'full_text';
    const url = `${FRED_BASE_URL}/series/search?search_text=${encodeURIComponent(searchText)}&search_type=${searchType}&api_key=${FRED_API_KEY}&file_type=json&limit=20`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error_code) {
      throw new Error(data.error_message || 'Search failed');
    }

    return data.seriess || [];
  } catch (error: any) {
    console.error(`Error searching FRED: ${error.message}`);
    return [];
  }
}

async function getSeriesInfo(seriesId: string): Promise<any> {
  try {
    const url = `${FRED_BASE_URL}/series?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error_code) {
      throw new Error(data.error_message || 'Series not found');
    }

    return data.seriess?.[0] || null;
  } catch (error: any) {
    console.error(`Error fetching series info: ${error.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const search = args.find(arg => arg.startsWith('--search='))?.split('=')[1];
  const exact = args.includes('--exact');
  const state = args.find(arg => arg.startsWith('--state='))?.split('=')[1];
  const metric = args.find(arg => arg.startsWith('--metric='))?.split('=')[1];

  if (!search && !state) {
    console.error('❌ Error: Must provide --search or --state');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/lookup-fred-series-ids.ts --search="California unemployment"');
    console.log('  npx tsx scripts/lookup-fred-series-ids.ts --search="CAUR" --exact');
    console.log('  npx tsx scripts/lookup-fred-series-ids.ts --state=CA --metric=unemployment');
    process.exit(1);
  }

  let searchText = search || '';

  if (state && metric) {
    // Build search query from state and metric
    const stateName = state;
    const metricMap: Record<string, string> = {
      'unemployment': 'unemployment rate',
      'employment': 'employment payrolls',
      'income': 'median household income',
      'gdp': 'gross domestic product',
      'permits': 'building permits'
    };
    
    searchText = `${stateName} ${metricMap[metric] || metric}`;
  }

  console.log(`🔍 Searching FRED for: "${searchText}"\n`);

  const results = await searchFREDSeries(searchText, exact);

  if (results.length === 0) {
    console.log('❌ No series found');
    return;
  }

  console.log(`📊 Found ${results.length} series:\n`);
  console.log('='.repeat(80));

  for (const series of results) {
    console.log(`\n📈 ${series.id}`);
    console.log(`   Title: ${series.title}`);
    console.log(`   Frequency: ${series.frequency}`);
    console.log(`   Units: ${series.units}`);
    console.log(`   Date Range: ${series.observation_start} to ${series.observation_end}`);
    
    // Get more details
    const details = await getSeriesInfo(series.id);
    if (details) {
      if (details.notes) {
        console.log(`   Notes: ${details.notes.substring(0, 100)}...`);
      }
    }
    
    console.log();
  }

  console.log('='.repeat(80));
  console.log(`\n💡 Tip: Use --exact flag to search by exact series ID`);
  console.log(`💡 Tip: Test a series ID with: npx tsx scripts/verify-fred-series-ids.ts --field=unemployment_rate`);
}

main().catch(console.error);

