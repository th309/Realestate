/**
 * Assign Peer Groups to Geographies
 *
 * Assigns peer groups to each geography based on 5 dimensions:
 * - Price Tier (1-5): Based on ZHVI
 * - Density Tier (R/S/U): Population density
 * - Region (NE/MW/SO/WE): Census region
 * - Metro Size (S/M/L/X): Metropolitan population
 * - Growth Trend (D/S/G): 5-year population change
 *
 * Peer Group ID format: "{price}-{density}-{region}-{metroSize}-{growth}"
 * Example: "3-U-MW-X-G" = $300-500K, Urban, Midwest, Major metro, Growing
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Region definitions by state FIPS code
const REGION_MAP: Record<string, string> = {
  // Northeast
  '09': 'NE', '23': 'NE', '25': 'NE', '33': 'NE', '44': 'NE', '50': 'NE', // CT, ME, MA, NH, RI, VT
  '34': 'NE', '36': 'NE', '42': 'NE', // NJ, NY, PA
  // Midwest
  '17': 'MW', '18': 'MW', '26': 'MW', '39': 'MW', '55': 'MW', // IL, IN, MI, OH, WI
  '19': 'MW', '20': 'MW', '27': 'MW', '29': 'MW', '31': 'MW', '38': 'MW', '46': 'MW', // IA, KS, MN, MO, NE, ND, SD
  // South
  '10': 'SO', '11': 'SO', '12': 'SO', '13': 'SO', '24': 'SO', '37': 'SO', '45': 'SO', '51': 'SO', '54': 'SO', // DE, DC, FL, GA, MD, NC, SC, VA, WV
  '01': 'SO', '21': 'SO', '28': 'SO', '47': 'SO', // AL, KY, MS, TN
  '05': 'SO', '22': 'SO', '40': 'SO', '48': 'SO', // AR, LA, OK, TX
  // West
  '04': 'WE', '08': 'WE', '16': 'WE', '30': 'WE', '32': 'WE', '35': 'WE', '49': 'WE', '56': 'WE', // AZ, CO, ID, MT, NV, NM, UT, WY
  '02': 'WE', '06': 'WE', '15': 'WE', '41': 'WE', '53': 'WE', // AK, CA, HI, OR, WA
};

// State code to FIPS mapping
const STATE_TO_FIPS: Record<string, string> = {
  'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09',
  'DE': '10', 'DC': '11', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17',
  'IN': '18', 'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24',
  'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31',
  'NV': '32', 'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38',
  'OH': '39', 'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46',
  'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54',
  'WI': '55', 'WY': '56', 'PR': '72',
};

// Price tier thresholds
function getPriceTier(zhvi: number | null): string {
  if (zhvi == null) return '3'; // Default to middle tier
  if (zhvi < 150000) return '1';
  if (zhvi < 300000) return '2';
  if (zhvi < 500000) return '3';
  if (zhvi < 1000000) return '4';
  return '5';
}

// Density tier based on population per square mile
function getDensityTier(density: number | null): string {
  if (density == null) return 'S'; // Default to suburban
  if (density < 500) return 'R'; // Rural
  if (density < 3000) return 'S'; // Suburban
  return 'U'; // Urban
}

// Metro size based on MSA population
function getMetroSize(population: number | null): string {
  if (population == null) return 'M'; // Default to medium
  if (population < 250000) return 'S'; // Small
  if (population < 1000000) return 'M'; // Medium
  if (population < 5000000) return 'L'; // Large
  return 'X'; // Major
}

// Growth trend based on 5-year population change
function getGrowthTrend(change: number | null): string {
  if (change == null) return 'S'; // Default to stable
  if (change < -0.02) return 'D'; // Declining (< -2%)
  if (change > 0.05) return 'G'; // Growing (> 5%)
  return 'S'; // Stable
}

// Get region from state code or FIPS
function getRegion(stateCode: string | null, stateFips: string | null): string {
  if (stateFips && REGION_MAP[stateFips]) {
    return REGION_MAP[stateFips];
  }
  if (stateCode) {
    const fips = STATE_TO_FIPS[stateCode.toUpperCase()];
    if (fips && REGION_MAP[fips]) {
      return REGION_MAP[fips];
    }
  }
  return 'SO'; // Default to South (largest region)
}

// Build peer group ID
function buildPeerGroupId(
  priceTier: string,
  densityTier: string,
  region: string,
  metroSize: string,
  growthTrend: string
): string {
  return `${priceTier}-${densityTier}-${region}-${metroSize}-${growthTrend}`;
}

// Get parent geography ID for regional benchmarks
function getParentGeographyId(geoType: string, geoId: string, metroCode: string | null, stateCode: string | null): string | null {
  switch (geoType) {
    case 'zip':
      return metroCode || stateCode; // ZIP -> Metro (preferred) or State
    case 'county':
      return stateCode; // County -> State
    case 'metro':
      return null; // Metro has no parent (uses national)
    case 'state':
      return null; // State has no parent (uses national)
    default:
      return null;
  }
}

// Fetch geography metadata from various sources
interface GeoMetadata {
  zhvi: number | null;
  population: number | null;
  density: number | null;
  metroPopulation: number | null;
  metroCbsa: string | null;
  stateCode: string | null;
  stateFips: string | null;
  popChange5yr: number | null;
}

async function getGeoMetadata(geoType: string, geoId: string): Promise<GeoMetadata> {
  const metadata: GeoMetadata = {
    zhvi: null,
    population: null,
    density: null,
    metroPopulation: null,
    metroCbsa: null,
    stateCode: null,
    stateFips: null,
    popChange5yr: null,
  };

  // Get ZHVI from Zillow tables (most recent)
  const zillowTable = {
    state: 'zillow_state',
    metro: 'zillow_metro',
    county: 'zillow_county',
    zip: 'zillow_zip',
  }[geoType];

  const idColumn = {
    state: 'state_code',
    metro: 'cbsa_code',
    county: 'fips_code',
    zip: 'region_name',
  }[geoType];

  if (zillowTable && idColumn) {
    const { data: zhviData } = await supabase
      .from(zillowTable)
      .select('value')
      .eq(idColumn, geoId)
      .eq('metric_name', 'zhvi')
      .order('period_date', { ascending: false })
      .limit(1);

    if (zhviData?.[0]?.value) {
      metadata.zhvi = zhviData[0].value;
    }
  }

  // Get population and density from census/markets tables
  if (geoType === 'zip') {
    // Try markets table first for ZIP
    const { data: marketData } = await supabase
      .from('markets')
      .select('population, state_code, cbsa_code')
      .eq('zip_code', geoId)
      .limit(1);

    if (marketData?.[0]) {
      metadata.population = marketData[0].population;
      metadata.stateCode = marketData[0].state_code;
      metadata.metroCbsa = marketData[0].cbsa_code;
    }

    // Try census_acs_zcta for more data
    const { data: censusData } = await supabase
      .from('census_acs_zcta')
      .select('total_population, state_code')
      .eq('zcta', geoId)
      .limit(1);

    if (censusData?.[0]) {
      metadata.population = metadata.population || censusData[0].total_population;
      metadata.stateCode = metadata.stateCode || censusData[0].state_code;
    }
  } else if (geoType === 'county') {
    // Get county data
    const { data: countyData } = await supabase
      .from('census_acs_county')
      .select('total_population, state_fips')
      .eq('fips_code', geoId)
      .limit(1);

    if (countyData?.[0]) {
      metadata.population = countyData[0].total_population;
      metadata.stateFips = countyData[0].state_fips;
    }
  } else if (geoType === 'metro') {
    // Get metro data
    const { data: metroData } = await supabase
      .from('census_acs_metro')
      .select('total_population')
      .eq('cbsa_code', geoId)
      .limit(1);

    if (metroData?.[0]) {
      metadata.population = metroData[0].total_population;
      metadata.metroPopulation = metroData[0].total_population;
    }
  } else if (geoType === 'state') {
    metadata.stateCode = geoId;
    metadata.stateFips = STATE_TO_FIPS[geoId.toUpperCase()];

    // Get state population
    const { data: stateData } = await supabase
      .from('census_acs_state')
      .select('total_population')
      .eq('state_code', geoId)
      .limit(1);

    if (stateData?.[0]) {
      metadata.population = stateData[0].total_population;
    }
  }

  // Estimate density (population / assumed area)
  // This is a rough estimate - ideally we'd have land area data
  if (metadata.population) {
    // Rough estimates by geography type
    const avgAreaSqMi: Record<string, number> = {
      zip: 50,      // Average ZIP is ~50 sq mi
      county: 1000, // Average county is ~1000 sq mi
      metro: 3000,  // Average metro is ~3000 sq mi
      state: 60000, // Average state is ~60000 sq mi
    };
    metadata.density = metadata.population / (avgAreaSqMi[geoType] || 100);
  }

  // Get metro population for ZIP/county (for metro size tier)
  if (metadata.metroCbsa && geoType !== 'metro') {
    const { data: metroPopData } = await supabase
      .from('census_acs_metro')
      .select('total_population')
      .eq('cbsa_code', metadata.metroCbsa)
      .limit(1);

    if (metroPopData?.[0]) {
      metadata.metroPopulation = metroPopData[0].total_population;
    }
  }

  return metadata;
}

// Process geographies in batches
async function processGeographies(geoType: string): Promise<{ processed: number; errors: number }> {
  console.log(`\nProcessing ${geoType.toUpperCase()} geographies...`);

  let processed = 0;
  let errors = 0;
  const pageSize = 500;
  let offset = 0;
  let hasMore = true;

  // Get distinct geography IDs from history table
  while (hasMore) {
    const { data: records, error } = await supabase
      .from('propertyiq_scores_history')
      .select('geography_id')
      .eq('geography_type', geoType)
      .is('peer_group_id', null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(`  Error fetching records: ${error.message}`);
      break;
    }

    if (!records || records.length === 0) {
      hasMore = false;
      continue;
    }

    // Get unique geography IDs
    const uniqueGeoIds = [...new Set(records.map(r => r.geography_id))];

    for (const geoId of uniqueGeoIds) {
      try {
        const metadata = await getGeoMetadata(geoType, geoId);

        // Calculate peer group components
        const priceTier = getPriceTier(metadata.zhvi);
        const densityTier = getDensityTier(metadata.density);
        const region = getRegion(metadata.stateCode, metadata.stateFips);
        const metroSize = getMetroSize(metadata.metroPopulation || metadata.population);
        const growthTrend = getGrowthTrend(metadata.popChange5yr);

        const peerGroupId = buildPeerGroupId(priceTier, densityTier, region, metroSize, growthTrend);
        const parentGeoId = getParentGeographyId(geoType, geoId, metadata.metroCbsa, metadata.stateCode);

        // Update all history records for this geography
        const { error: updateError } = await supabase
          .from('propertyiq_scores_history')
          .update({
            peer_group_id: peerGroupId,
            parent_geography_id: parentGeoId,
          })
          .eq('geography_id', geoId)
          .eq('geography_type', geoType);

        if (updateError) {
          errors++;
          if (errors <= 5) {
            console.error(`  Error updating ${geoId}: ${updateError.message}`);
          }
        } else {
          processed++;
        }
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`  Error processing ${geoId}: ${err}`);
        }
      }
    }

    offset += pageSize;
    hasMore = records.length === pageSize;

    // Progress indicator
    process.stdout.write(`  Processed ${processed} geographies, ${errors} errors\r`);
  }

  console.log(`  Completed: ${processed} processed, ${errors} errors`);
  return { processed, errors };
}

// Populate peer group lookup table
async function populatePeerGroupLookup(): Promise<void> {
  console.log('\nPopulating peer group lookup table...');

  const peerGroups: Array<{
    peer_group_id: string;
    price_tier: number;
    density_tier: string;
    region: string;
    metro_size: string;
    growth_trend: string;
    description: string;
  }> = [];

  const priceTierLabels = ['<$150K', '$150-300K', '$300-500K', '$500K-1M', '>$1M'];
  const densityLabels: Record<string, string> = { R: 'Rural', S: 'Suburban', U: 'Urban' };
  const regionLabels: Record<string, string> = { NE: 'Northeast', MW: 'Midwest', SO: 'South', WE: 'West' };
  const metroLabels: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large', X: 'Major' };
  const growthLabels: Record<string, string> = { D: 'Declining', S: 'Stable', G: 'Growing' };

  for (let price = 1; price <= 5; price++) {
    for (const density of ['R', 'S', 'U']) {
      for (const region of ['NE', 'MW', 'SO', 'WE']) {
        for (const metro of ['S', 'M', 'L', 'X']) {
          for (const growth of ['D', 'S', 'G']) {
            const id = `${price}-${density}-${region}-${metro}-${growth}`;
            peerGroups.push({
              peer_group_id: id,
              price_tier: price,
              density_tier: density,
              region: region,
              metro_size: metro,
              growth_trend: growth,
              description: `${priceTierLabels[price - 1]}, ${densityLabels[density]}, ${regionLabels[region]}, ${metroLabels[metro]} metro, ${growthLabels[growth]}`,
            });
          }
        }
      }
    }
  }

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < peerGroups.length; i += batchSize) {
    const batch = peerGroups.slice(i, i + batchSize);
    const { error } = await supabase
      .from('backtest_peer_groups')
      .upsert(batch, { onConflict: 'peer_group_id' });

    if (error) {
      console.error(`  Error inserting peer groups: ${error.message}`);
    }
  }

  console.log(`  Inserted ${peerGroups.length} peer group definitions`);
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  PEER GROUP ASSIGNMENT                                        ║');
  console.log('║  Assigning benchmarking peer groups to geographies            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // First, populate the peer group lookup table
  await populatePeerGroupLookup();

  // Process each geography type
  const geoTypes = ['state', 'metro', 'county', 'zip'];
  let totalProcessed = 0;
  let totalErrors = 0;

  for (const geoType of geoTypes) {
    const result = await processGeographies(geoType);
    totalProcessed += result.processed;
    totalErrors += result.errors;
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total geographies processed: ${totalProcessed.toLocaleString()}`);
  console.log(`  Total errors: ${totalErrors.toLocaleString()}`);

  // Show peer group distribution
  console.log('\n  Peer group distribution (top 10):');
  const { data: distribution } = await supabase
    .from('propertyiq_scores_history')
    .select('peer_group_id')
    .not('peer_group_id', 'is', null);

  if (distribution) {
    const counts: Record<string, number> = {};
    for (const row of distribution) {
      counts[row.peer_group_id] = (counts[row.peer_group_id] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [group, count] of sorted) {
      console.log(`    ${group}: ${count.toLocaleString()} records`);
    }
  }

  console.log('\n✓ Peer group assignment complete');
}

main().catch(console.error);
