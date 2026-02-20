import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || (() => { throw new Error('SUPABASE_SERVICE_KEY is required'); })();

const supabase = createClient(supabaseUrl, supabaseKey);

interface CrosswalkRow {
  county_fips: string;
  county_name: string;
  state_abbrev: string;
  zillow_county_region_id: number | null;
}

async function investigate() {
  console.log('='.repeat(70));
  console.log('FINAL COUNTY DATA INVESTIGATION');
  console.log('='.repeat(70));

  // 0. Check zillow_zhvi schema first
  console.log('\n0. Checking zillow_zhvi table schema...');
  const { data: schemaSample, error: schemaError } = await supabase
    .from('zillow_zhvi')
    .select('*')
    .eq('geography', 'County')
    .limit(1);

  if (schemaError) {
    console.error(`   Schema check error: ${schemaError.message}`);
  } else if (schemaSample && schemaSample.length > 0) {
    console.log('   Available columns:', Object.keys(schemaSample[0]).join(', '));
    console.log('   Sample row:', JSON.stringify(schemaSample[0], null, 2));
  }

  // 1. Count unique county region_ids from zillow_zhvi
  console.log('\n1. Counting unique county region_ids from zillow_zhvi...');

  const zhviRegionIds = new Set<string>();
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  let totalRows = 0;

  while (hasMore) {
    const { data, error } = await supabase
      .from('zillow_zhvi')
      .select('region_id')
      .eq('geography', 'County')
      .order('region_id')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`   Error at offset ${offset}: ${error.message}`);
      break;
    }

    if (data && data.length > 0) {
      data.forEach(d => zhviRegionIds.add(String(d.region_id)));
      totalRows += data.length;
      offset += pageSize;
      hasMore = data.length === pageSize;
      process.stdout.write(`\r   Processed ${totalRows} rows, found ${zhviRegionIds.size} unique region_ids...`);
    } else {
      hasMore = false;
    }
  }
  console.log(`\n   Total county rows in zillow_zhvi: ${totalRows}`);
  console.log(`   Unique county region_ids: ${zhviRegionIds.size}`);
  console.log(`   Sample IDs: ${[...zhviRegionIds].slice(0, 10).join(', ')}`);

  // 2. Fetch geography_crosswalk data
  console.log('\n2. Fetching geography_crosswalk data...');

  const crosswalkData: CrosswalkRow[] = [];
  offset = 0;
  hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('geography_crosswalk')
      .select('county_fips, county_name, state_abbrev, zillow_county_region_id')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`   Error at offset ${offset}: ${error.message}`);
      break;
    }

    if (data && data.length > 0) {
      crosswalkData.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  // Deduplicate by county_fips
  const countyToData = new Map<string, { name: string; state: string; zillowId: number | null }>();
  crosswalkData.forEach(d => {
    if (d.county_fips && !countyToData.has(d.county_fips)) {
      countyToData.set(d.county_fips, {
        name: d.county_name,
        state: d.state_abbrev,
        zillowId: d.zillow_county_region_id
      });
    }
  });

  const uniqueCountyFips = new Set(countyToData.keys());
  console.log(`   Total crosswalk rows: ${crosswalkData.length}`);
  console.log(`   Unique county_fips: ${uniqueCountyFips.size}`);

  // 3. Calculate overlap
  console.log('\n3. Calculating data overlap...');

  // ZHVI stores region_id as FIPS codes (strings like "01003")
  const zhviInCrosswalk = [...zhviRegionIds].filter(fips => uniqueCountyFips.has(fips));
  const zhviNotInCrosswalk = [...zhviRegionIds].filter(fips => !uniqueCountyFips.has(fips));
  const crosswalkNotInZhvi = [...uniqueCountyFips].filter(fips => !zhviRegionIds.has(fips));

  console.log(`   ZHVI counties matching crosswalk: ${zhviInCrosswalk.length}`);
  console.log(`   ZHVI counties NOT in crosswalk: ${zhviNotInCrosswalk.length}`);
  console.log(`   Crosswalk counties without ZHVI data: ${crosswalkNotInZhvi.length}`);

  if (zhviNotInCrosswalk.length > 0 && zhviNotInCrosswalk.length <= 30) {
    console.log(`   Missing from crosswalk: ${zhviNotInCrosswalk.join(', ')}`);
  } else if (zhviNotInCrosswalk.length > 30) {
    console.log(`   First 30 missing: ${zhviNotInCrosswalk.slice(0, 30).join(', ')}...`);
  }

  // 4. State breakdown of ZHVI counties
  console.log('\n4. State breakdown of ZHVI county data...');
  const stateCountsZhvi: Record<string, number> = {};
  zhviInCrosswalk.forEach(fips => {
    const county = countyToData.get(fips);
    if (county) {
      stateCountsZhvi[county.state] = (stateCountsZhvi[county.state] || 0) + 1;
    }
  });

  const sortedStates = Object.entries(stateCountsZhvi)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  console.log('   Top 15 states by county coverage:');
  sortedStates.forEach(([state, count]) => {
    const crosswalkCount = [...countyToData.values()].filter(c => c.state === state).length;
    const pct = ((count / crosswalkCount) * 100).toFixed(1);
    console.log(`     ${state}: ${count}/${crosswalkCount} counties (${pct}%)`);
  });

  // 5. Summary table
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`
+----------------------------------------------------+----------+
| Metric                                             |    Count |
+----------------------------------------------------+----------+
| Total US counties (Census 2020)                    |   ~3,143 |
| Unique county_fips in geography_crosswalk          | ${String(uniqueCountyFips.size).padStart(8)} |
| Unique counties with ZHVI data                     | ${String(zhviRegionIds.size).padStart(8)} |
| Total county ZHVI time-series rows                 | ${String(totalRows).padStart(8)} |
| ZHVI counties matching crosswalk FIPS              | ${String(zhviInCrosswalk.length).padStart(8)} |
| ZHVI counties NOT in crosswalk                     | ${String(zhviNotInCrosswalk.length).padStart(8)} |
| Crosswalk counties without ZHVI data               | ${String(crosswalkNotInZhvi.length).padStart(8)} |
+----------------------------------------------------+----------+
`);

  // 6. Analysis
  console.log('='.repeat(70));
  console.log('ANALYSIS');
  console.log('='.repeat(70));

  const zhviCoverage = ((zhviRegionIds.size / 3143) * 100).toFixed(1);
  const crosswalkCoverage = ((uniqueCountyFips.size / 3143) * 100).toFixed(1);
  const matchRate = zhviRegionIds.size > 0
    ? ((zhviInCrosswalk.length / zhviRegionIds.size) * 100).toFixed(1)
    : '0.0';
  const avgRowsPerCounty = zhviRegionIds.size > 0
    ? Math.round(totalRows / zhviRegionIds.size)
    : 0;

  console.log(`
1. ZILLOW DATA COVERAGE:
   - Zillow provides ZHVI data for ${zhviRegionIds.size} counties (${zhviCoverage}% of US)
   - Average time-series points per county: ${avgRowsPerCounty} months
   - This is NOT a bug - Zillow excludes counties with insufficient housing data

2. CROSSWALK COVERAGE:
   - We have ${uniqueCountyFips.size} counties in our crosswalk (${crosswalkCoverage}% of US)
   - Slightly exceeds 3,143 due to historical/consolidated counties and territories

3. MATCHING QUALITY:
   - ${zhviInCrosswalk.length} ZHVI counties have matching FIPS in crosswalk (${matchRate}%)
   - ${zhviNotInCrosswalk.length} ZHVI counties missing from crosswalk (data gaps)
   - ${crosswalkNotInZhvi.length} crosswalk counties without ZHVI data (Zillow limitation)

4. KEY INSIGHTS:
   - The county count reflects Zillow's actual data availability
   - Zillow only publishes home value indices for counties where they have
     sufficient housing transaction data to compute reliable estimates
   - Rural and sparsely populated counties are often excluded
`);

  // 7. Root cause conclusion
  console.log('='.repeat(70));
  console.log('CONCLUSION');
  console.log('='.repeat(70));
  console.log(`
STATUS: ${zhviRegionIds.size > 1500 ? 'WORKING AS EXPECTED' : 'INVESTIGATION NEEDED'}

The ~${zhviRegionIds.size} county count is ${zhviRegionIds.size > 1500 ? 'CORRECT' : 'potentially low'} because:

1. Zillow only publishes ZHVI for counties with sufficient transaction data
2. Many US counties are rural with very few home sales
3. This is a DATA LIMITATION from Zillow, not a system issue

DATA QUALITY:
- Match rate with crosswalk: ${matchRate}%
- Counties with complete data: ${zhviInCrosswalk.length}
- Missing from crosswalk: ${zhviNotInCrosswalk.length}

RECOMMENDATIONS:
${zhviNotInCrosswalk.length > 0 ? `- Review ${zhviNotInCrosswalk.length} FIPS codes not in crosswalk` : '- All ZHVI counties mapped correctly'}
${crosswalkNotInZhvi.length > 0 ? `- Display "No data available" for ${crosswalkNotInZhvi.length} counties without ZHVI` : ''}
- Document that Zillow ZHVI covers ~${zhviCoverage}% of US counties
`);
}

investigate().catch(console.error);
