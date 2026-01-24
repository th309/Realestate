/**
 * Test all 3 PropertyIQ scores at all geography levels
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Min-max normalization
function normalize(value: number | null, min: number, max: number, invert = false): number | null {
  if (value == null) return null;
  const clamped = Math.max(min, Math.min(max, value));
  let norm = ((clamped - min) / (max - min)) * 100;
  if (invert) norm = 100 - norm;
  return Math.round(norm * 100) / 100;
}

// Market Health Score calculation
function calculateMarketHealth(metrics: any) {
  // Demand Strength (35%) - DOM inverted, Pending ratio normal
  const domScore = normalize(metrics.median_days_on_market, 10, 120, true);
  const pendingScore = normalize(metrics.pending_ratio, 0.1, 0.8, false);
  const demandStrength = domScore != null && pendingScore != null
    ? (domScore * 0.6 + pendingScore * 0.4)
    : (domScore ?? pendingScore ?? 50);

  // Supply Balance (25%) - Inventory YoY inverted (less inventory = better)
  const inventoryScore = normalize(metrics.active_listing_count_yy, -0.5, 0.5, true);
  const supplyBalance = inventoryScore ?? 50;

  // Price Stability (25%) - Price reduced share inverted
  const priceVolScore = normalize(metrics.price_reduced_share, 0, 0.4, true);
  const priceStability = priceVolScore ?? 50;

  // Economic Foundation (15%) - placeholder
  const econScore = 50;

  const overall = demandStrength * 0.35 + supplyBalance * 0.25 + priceStability * 0.25 + econScore * 0.15;

  return {
    score: Math.round(overall * 100) / 100,
    demandStrength: Math.round((demandStrength as number) * 100) / 100,
    supplyBalance: Math.round((supplyBalance as number) * 100) / 100,
    priceStability: Math.round((priceStability as number) * 100) / 100,
    economicFoundation: econScore
  };
}

// HomeReady Score calculation (simplified)
function calculateHomeReady(metrics: any) {
  // Affordability (30%) - Price YoY inverted (slower growth = more affordable)
  const priceYoyScore = normalize(metrics.median_listing_price_yy, -0.2, 0.3, true);
  const affordability = priceYoyScore ?? 50;

  // Stability (20%) - DOM stability
  const domScore = normalize(metrics.median_days_on_market, 10, 120, true);
  const stability = domScore ?? 50;

  // Value (20%) - Price reduced share (more reductions = better value opportunity)
  const valueScore = normalize(metrics.price_reduced_share, 0, 0.4, false);
  const value = valueScore ?? 50;

  // Livability (15%) - placeholder
  const livability = 50;

  // Momentum (15%) - Pending ratio
  const pendingScore = normalize(metrics.pending_ratio, 0.1, 0.8, false);
  const momentum = pendingScore ?? 50;

  const overall = affordability * 0.30 + stability * 0.20 + value * 0.20 + livability * 0.15 + momentum * 0.15;

  return {
    score: Math.round(overall * 100) / 100,
    affordability: Math.round((affordability as number) * 100) / 100,
    stability: Math.round((stability as number) * 100) / 100,
    value: Math.round((value as number) * 100) / 100,
    livability,
    momentum: Math.round((momentum as number) * 100) / 100
  };
}

// InvestorEdge Score calculation (simplified)
function calculateInvestorEdge(metrics: any) {
  // Cash Flow (35%) - Lower prices = better entry, use inverse of price level
  const priceScore = normalize(metrics.median_listing_price, 100000, 1000000, true);
  const cashflow = priceScore ?? 50;

  // Growth (20%) - Price appreciation potential
  const priceYoyScore = normalize(metrics.median_listing_price_yy, -0.1, 0.2, false);
  const growth = priceYoyScore ?? 50;

  // Demand (20%) - Pending ratio and DOM
  const domScore = normalize(metrics.median_days_on_market, 10, 120, true);
  const pendingScore = normalize(metrics.pending_ratio, 0.1, 0.8, false);
  const demand = domScore != null && pendingScore != null ? (domScore * 0.5 + pendingScore * 0.5) : (domScore ?? pendingScore ?? 50);

  // Entry Point (15%) - Price reductions indicate negotiation opportunity
  const entryScore = normalize(metrics.price_reduced_share, 0, 0.4, false);
  const entryPoint = entryScore ?? 50;

  // Risk (10%) - Inventory stability
  const inventoryScore = normalize(metrics.active_listing_count_yy, -0.5, 0.5, true);
  const risk = inventoryScore ?? 50;

  const overall = cashflow * 0.35 + growth * 0.20 + demand * 0.20 + entryPoint * 0.15 + risk * 0.10;

  return {
    score: Math.round(overall * 100) / 100,
    cashflow: Math.round((cashflow as number) * 100) / 100,
    growth: Math.round((growth as number) * 100) / 100,
    demand: Math.round((demand as number) * 100) / 100,
    entryPoint: Math.round((entryPoint as number) * 100) / 100,
    risk: Math.round((risk as number) * 100) / 100
  };
}

async function testGeographyLevel(
  geoType: string,
  tableName: string,
  idColumn: string,
  nameColumn: string | null
) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${geoType.toUpperCase()} - ALL 3 SCORES`);
  console.log(`${'='.repeat(50)}`);

  // Get latest date
  const { data: dateData } = await supabase
    .from(tableName)
    .select('period_date')
    .order('period_date', { ascending: false })
    .limit(1);

  const latestDate = dateData?.[0]?.period_date;
  if (!latestDate) {
    console.log(`  No data found in ${tableName}`);
    return null;
  }
  console.log(`Date: ${latestDate}`);

  // Build select columns
  const cols = [
    idColumn,
    nameColumn,
    'median_days_on_market',
    'pending_ratio',
    'active_listing_count_yy',
    'price_reduced_share',
    'median_listing_price',
    'median_listing_price_yy'
  ].filter(Boolean).join(', ');

  const { data, error } = await supabase
    .from(tableName)
    .select(cols)
    .eq('period_date', latestDate)
    .limit(1000);

  if (error) {
    console.log(`  Error: ${error.message}`);
    return null;
  }

  const validData = data.filter(d =>
    d.median_days_on_market != null || d.pending_ratio != null
  );
  console.log(`Records with data: ${validData.length}`);

  // Calculate all 3 scores for each record
  const scores = validData.map(d => {
    const mh = calculateMarketHealth(d);
    const hr = calculateHomeReady(d);
    const ie = calculateInvestorEdge(d);
    return {
      id: d[idColumn],
      name: nameColumn ? d[nameColumn] : d[idColumn],
      marketHealth: mh.score,
      homeReady: hr.score,
      investorEdge: ie.score,
      mhComponents: mh,
      hrComponents: hr,
      ieComponents: ie
    };
  });

  // Stats for each score type
  const scoreTypes = ['marketHealth', 'homeReady', 'investorEdge'];
  const stats: any = {};

  for (const type of scoreTypes) {
    const values = scores.map(s => s[type as keyof typeof s] as number);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.map(v => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) / values.length);
    stats[type] = {
      min: Math.min(...values),
      max: Math.max(...values),
      avg,
      stdDev
    };
  }

  // Show results
  console.log('\n--- MARKET HEALTH ---');
  scores.sort((a, b) => b.marketHealth - a.marketHealth);
  console.log('Top 3:', scores.slice(0, 3).map(s => `${s.marketHealth.toFixed(1)} ${String(s.name).substring(0, 20)}`).join(' | '));
  console.log('Bottom 3:', scores.slice(-3).map(s => `${s.marketHealth.toFixed(1)} ${String(s.name).substring(0, 20)}`).join(' | '));
  console.log(`Range: ${stats.marketHealth.min.toFixed(1)}-${stats.marketHealth.max.toFixed(1)} | Avg: ${stats.marketHealth.avg.toFixed(1)} | StdDev: ${stats.marketHealth.stdDev.toFixed(1)}`);

  console.log('\n--- HOMEREADY ---');
  scores.sort((a, b) => b.homeReady - a.homeReady);
  console.log('Top 3:', scores.slice(0, 3).map(s => `${s.homeReady.toFixed(1)} ${String(s.name).substring(0, 20)}`).join(' | '));
  console.log('Bottom 3:', scores.slice(-3).map(s => `${s.homeReady.toFixed(1)} ${String(s.name).substring(0, 20)}`).join(' | '));
  console.log(`Range: ${stats.homeReady.min.toFixed(1)}-${stats.homeReady.max.toFixed(1)} | Avg: ${stats.homeReady.avg.toFixed(1)} | StdDev: ${stats.homeReady.stdDev.toFixed(1)}`);

  console.log('\n--- INVESTOREDGE ---');
  scores.sort((a, b) => b.investorEdge - a.investorEdge);
  console.log('Top 3:', scores.slice(0, 3).map(s => `${s.investorEdge.toFixed(1)} ${String(s.name).substring(0, 20)}`).join(' | '));
  console.log('Bottom 3:', scores.slice(-3).map(s => `${s.investorEdge.toFixed(1)} ${String(s.name).substring(0, 20)}`).join(' | '));
  console.log(`Range: ${stats.investorEdge.min.toFixed(1)}-${stats.investorEdge.max.toFixed(1)} | Avg: ${stats.investorEdge.avg.toFixed(1)} | StdDev: ${stats.investorEdge.stdDev.toFixed(1)}`);

  return { geoType, count: scores.length, stats };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  PROPERTYIQ SCORES TEST - ALL 3 SCORES x ALL GEO LEVELS  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const results: any[] = [];

  // State level
  const stateResult = await testGeographyLevel('state', 'realtor_state', 'state_id', null);
  if (stateResult) results.push(stateResult);

  // Metro level
  const metroResult = await testGeographyLevel('metro', 'realtor_metro', 'cbsa_code', 'cbsa_title');
  if (metroResult) results.push(metroResult);

  // County level
  const countyResult = await testGeographyLevel('county', 'realtor_county', 'county_fips', 'county_name');
  if (countyResult) results.push(countyResult);

  // Summary table
  console.log('\n' + '='.repeat(80));
  console.log('  SUMMARY - ALL SCORES');
  console.log('='.repeat(80));
  console.log('Level   | Count |   Market Health   |     HomeReady     |    InvestorEdge   ');
  console.log('        |       | Range   Avg  Std  | Range   Avg  Std  | Range   Avg  Std  ');
  console.log('--------|-------|-------------------|-------------------|-------------------');

  for (const r of results) {
    const mh = r.stats.marketHealth;
    const hr = r.stats.homeReady;
    const ie = r.stats.investorEdge;
    console.log(
      `${r.geoType.padEnd(7)} |${String(r.count).padStart(6)} | ` +
      `${mh.min.toFixed(0)}-${mh.max.toFixed(0).padStart(3)} ${mh.avg.toFixed(1).padStart(5)} ${mh.stdDev.toFixed(1).padStart(4)} | ` +
      `${hr.min.toFixed(0)}-${hr.max.toFixed(0).padStart(3)} ${hr.avg.toFixed(1).padStart(5)} ${hr.stdDev.toFixed(1).padStart(4)} | ` +
      `${ie.min.toFixed(0)}-${ie.max.toFixed(0).padStart(3)} ${ie.avg.toFixed(1).padStart(5)} ${ie.stdDev.toFixed(1).padStart(4)}`
    );
  }

  console.log('\n✓ All 3 PropertyIQ scores tested at all geography levels');
}

main().catch(console.error);
