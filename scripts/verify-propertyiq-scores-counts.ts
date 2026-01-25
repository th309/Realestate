/**
 * Verify PropertyIQ Scores Counts
 * 
 * Checks that all 3 PropertyIQ scores populate:
 * - ~400 metros
 * - ~2800 counties  
 * - ~28000 zips
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'packages/frontend/.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== PropertyIQ Scores Count Verification ===\n');

  const expectedCounts = {
    metro: 400,
    county: 2800,
    zip: 28000,
  };

  // Check counts for each geography type
  for (const geoType of ['metro', 'county', 'zip'] as const) {
    console.log(`\n${geoType.toUpperCase()}:`);
    console.log(`  Expected: ~${expectedCounts[geoType].toLocaleString()}`);

    // Get latest score_date for this geography type
    const { data: latestDateData } = await supabase
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', geoType)
      .order('score_date', { ascending: false })
      .limit(1);

    const latestDate = latestDateData?.[0]?.score_date;
    if (!latestDate) {
      console.log(`  ❌ No scores found for ${geoType}`);
      continue;
    }

    console.log(`  Latest score date: ${latestDate}`);

    // Count total records first
    const { count: totalRecords, error: countError } = await supabase
      .from('propertyiq_scores')
      .select('*', { count: 'exact', head: true })
      .eq('geography', geoType)
      .eq('score_date', latestDate);

    if (countError) {
      console.error(`  Error: ${countError.message}`);
      continue;
    }

    // Fetch all location_ids and score_types with pagination
    let allScores: Array<{ location_id: string; score_type: string }> = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData, error: fetchError } = await supabase
        .from('propertyiq_scores')
        .select('location_id, score_type')
        .eq('geography', geoType)
        .eq('score_date', latestDate)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        console.error(`  Error fetching page ${page}: ${fetchError.message}`);
        break;
      }

      if (pageData && pageData.length > 0) {
        allScores = allScores.concat(pageData);
        hasMore = pageData.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    if (allScores.length === 0) {
      console.log(`  ❌ No scores found for ${geoType} on ${latestDate}`);
      continue;
    }

    // Get distinct geography IDs
    const distinctGeos = new Set(allScores.map(s => s.location_id));

    // Count geographies with each score type
    const withMarketHealth = new Set<string>();
    const withHomeReady = new Set<string>();
    const withInvestorEdge = new Set<string>();

    allScores.forEach(score => {
      if (score.score_type === 'markethealth') {
        withMarketHealth.add(score.location_id);
      } else if (score.score_type === 'homeready') {
        withHomeReady.add(score.location_id);
      } else if (score.score_type === 'investoredge') {
        withInvestorEdge.add(score.location_id);
      }
    });

    console.log(`  Total records: ${totalRecords.toLocaleString()} (${distinctGeos.size.toLocaleString()} geographies × 3 score types)`);
    console.log(`  Total geographies: ${distinctGeos.size.toLocaleString()}`);
    console.log(`  Market Health: ${withMarketHealth.size.toLocaleString()} geographies`);
    console.log(`  HomeReady: ${withHomeReady.size.toLocaleString()} geographies`);
    console.log(`  InvestorEdge: ${withInvestorEdge.size.toLocaleString()} geographies`);

    // Check if counts meet expectations (within 20% tolerance)
    const tolerance = 0.2;
    const minExpected = expectedCounts[geoType] * (1 - tolerance);
    const maxExpected = expectedCounts[geoType] * (1 + tolerance);

    const meetsExpectation = distinctGeos.size >= minExpected && distinctGeos.size <= maxExpected;
    const status = meetsExpectation ? '✅' : '⚠️';
    
    console.log(`  ${status} Count ${meetsExpectation ? 'meets' : 'does not meet'} expectation (${minExpected.toFixed(0)} - ${maxExpected.toFixed(0)})`);

    // Check if all three scores are present for all geographies
    const allThreeScores = Array.from(distinctGeos).filter(geoId => 
      withMarketHealth.has(geoId) && 
      withHomeReady.has(geoId) && 
      withInvestorEdge.has(geoId)
    );

    console.log(`  All 3 scores present: ${allThreeScores.length.toLocaleString()} geographies`);
    
    if (allThreeScores.length < distinctGeos.size) {
      console.log(`  ⚠️  Warning: ${distinctGeos.size - allThreeScores.length} geographies missing one or more scores`);
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  const { count: totalCount } = await supabase
    .from('propertyiq_scores')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total score records: ${totalCount?.toLocaleString()}`);

  // Check latest period date
  const { data: latestDate } = await supabase
    .from('propertyiq_scores')
    .select('score_date')
    .order('score_date', { ascending: false })
    .limit(1);
  
  console.log(`Latest score date: ${latestDate?.[0]?.score_date || 'N/A'}`);

  console.log('\n✓ Verification complete');
}

main().catch(console.error);
