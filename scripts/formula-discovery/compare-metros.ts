import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Dallas-Fort Worth: CBSA 19100
// Houston-The Woodlands: CBSA 26420

async function compareMetros() {
  const metros = [
    { name: 'Dallas-Fort Worth', cbsa: '19100' },
    { name: 'Houston-The Woodlands', cbsa: '26420' }
  ];

  console.log('\n╔══════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    DALLAS vs HOUSTON: Investment Comparison                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════╝\n');

  const results: Record<string, any> = {};

  for (const metro of metros) {
    console.log(`\nFetching data for ${metro.name} (${metro.cbsa})...`);
    results[metro.name] = { cbsa: metro.cbsa };

    // Get latest Zillow data
    const { data: zillow } = await supabase
      .from('zillow_metro')
      .select('metric_name, value, period_date')
      .eq('cbsa_code', metro.cbsa)
      .in('metric_name', ['zhvi', 'zhvi_yoy', 'zori', 'zori_yoy', 'inventory'])
      .order('period_date', { ascending: false })
      .limit(10);

    // Get unique latest values
    const zillowMetrics: Record<string, { value: number, date: string }> = {};
    for (const row of zillow || []) {
      if (!zillowMetrics[row.metric_name]) {
        zillowMetrics[row.metric_name] = { value: row.value, date: row.period_date };
      }
    }
    results[metro.name].zillow = zillowMetrics;

    // Get latest Realtor data
    const { data: realtor } = await supabase
      .from('realtor_metro')
      .select('*')
      .eq('cbsa_code', metro.cbsa)
      .order('period_date', { ascending: false })
      .limit(1);

    results[metro.name].realtor = realtor?.[0] || {};

    // Get latest Census data
    const { data: census } = await supabase
      .from('census_metro')
      .select('*')
      .eq('cbsa_code', metro.cbsa)
      .order('year', { ascending: false })
      .limit(1);

    results[metro.name].census = census?.[0] || {};

    // Get latest Economic data
    const { data: economic } = await supabase
      .from('economic_metro')
      .select('*')
      .eq('cbsa_code', metro.cbsa)
      .order('period_date', { ascending: false })
      .limit(1);

    results[metro.name].economic = economic?.[0] || {};
  }

  // Display comparison table
  console.log('\n══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('  HEAD-TO-HEAD COMPARISON');
  console.log('══════════════════════════════════════════════════════════════════════════════════════════\n');

  const dallas = results['Dallas-Fort Worth'];
  const houston = results['Houston-The Woodlands'];

  // Format numbers
  const fmt = (n: number | undefined, decimals = 1) => n !== undefined ? n.toFixed(decimals) : 'N/A';
  const fmtPct = (n: number | undefined) => n !== undefined ? (n * 100).toFixed(1) + '%' : 'N/A';
  const fmtDollar = (n: number | undefined) => n !== undefined ? '$' + Math.round(n).toLocaleString() : 'N/A';

  console.log('  ┌─────────────────────────────────┬──────────────────┬──────────────────┬─────────┐');
  console.log('  │ Metric                          │ Dallas           │ Houston          │ Winner  │');
  console.log('  ├─────────────────────────────────┼──────────────────┼──────────────────┼─────────┤');

  // Price metrics
  const dZhvi = dallas.zillow?.zhvi?.value;
  const hZhvi = houston.zillow?.zhvi?.value;
  const zhviWinner = dZhvi && hZhvi ? (dZhvi < hZhvi ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Home Value (ZHVI)               │ ${fmtDollar(dZhvi).padEnd(16)} │ ${fmtDollar(hZhvi).padEnd(16)} │ ${zhviWinner.padEnd(7)} │`);

  const dZhviYoy = dallas.zillow?.zhvi_yoy?.value;
  const hZhviYoy = houston.zillow?.zhvi_yoy?.value;
  const zhviYoyWinner = dZhviYoy !== undefined && hZhviYoy !== undefined ? (dZhviYoy > hZhviYoy ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Price Growth (YoY)              │ ${fmtPct(dZhviYoy).padEnd(16)} │ ${fmtPct(hZhviYoy).padEnd(16)} │ ${zhviYoyWinner.padEnd(7)} │`);

  // Rent metrics
  const dZori = dallas.zillow?.zori?.value;
  const hZori = houston.zillow?.zori?.value;
  console.log(`  │ Rent (ZORI)                     │ ${fmtDollar(dZori).padEnd(16)} │ ${fmtDollar(hZori).padEnd(16)} │         │`);

  // Realtor metrics - KEY PREDICTORS
  console.log('  ├─────────────────────────────────┼──────────────────┼──────────────────┼─────────┤');
  console.log('  │ KEY PREDICTORS (from analysis)  │                  │                  │         │');
  console.log('  ├─────────────────────────────────┼──────────────────┼──────────────────┼─────────┤');

  const dDom = dallas.realtor?.median_days_on_market;
  const hDom = houston.realtor?.median_days_on_market;
  const domWinner = dDom && hDom ? (dDom < hDom ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Days on Market (lower=better)   │ ${fmt(dDom, 0).padEnd(16)} │ ${fmt(hDom, 0).padEnd(16)} │ ${domWinner.padEnd(7)} │`);

  const dPending = dallas.realtor?.pending_ratio;
  const hPending = houston.realtor?.pending_ratio;
  const pendingWinner = dPending && hPending ? (dPending > hPending ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Pending Ratio (higher=better)   │ ${fmtPct(dPending).padEnd(16)} │ ${fmtPct(hPending).padEnd(16)} │ ${pendingWinner.padEnd(7)} │`);

  const dHotness = dallas.realtor?.hotness_score;
  const hHotness = houston.realtor?.hotness_score;
  const hotnessWinner = dHotness && hHotness ? (dHotness > hHotness ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Hotness Score                   │ ${fmt(dHotness, 1).padEnd(16)} │ ${fmt(hHotness, 1).padEnd(16)} │ ${hotnessWinner.padEnd(7)} │`);

  const dSupply = dallas.realtor?.supply_score;
  const hSupply = houston.realtor?.supply_score;
  const supplyWinner = dSupply && hSupply ? (dSupply < hSupply ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Supply Score (lower=tighter)    │ ${fmt(dSupply, 1).padEnd(16)} │ ${fmt(hSupply, 1).padEnd(16)} │ ${supplyWinner.padEnd(7)} │`);

  const dPriceReduced = dallas.realtor?.price_reduced_share;
  const hPriceReduced = houston.realtor?.price_reduced_share;
  const priceReducedWinner = dPriceReduced && hPriceReduced ? (dPriceReduced < hPriceReduced ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Price Reduced % (lower=better)  │ ${fmtPct(dPriceReduced).padEnd(16)} │ ${fmtPct(hPriceReduced).padEnd(16)} │ ${priceReducedWinner.padEnd(7)} │`);

  // Economic metrics - KEY FOR LONG-TERM
  console.log('  ├─────────────────────────────────┼──────────────────┼──────────────────┼─────────┤');
  console.log('  │ LONG-TERM FUNDAMENTALS          │                  │                  │         │');
  console.log('  ├─────────────────────────────────┼──────────────────┼──────────────────┼─────────┤');

  const dPop = dallas.census?.total_population;
  const hPop = houston.census?.total_population;
  console.log(`  │ Population                      │ ${(dPop ? (dPop/1000000).toFixed(1) + 'M' : 'N/A').padEnd(16)} │ ${(hPop ? (hPop/1000000).toFixed(1) + 'M' : 'N/A').padEnd(16)} │         │`);

  const dPopYoy = dallas.census?.population_yoy;
  const hPopYoy = houston.census?.population_yoy;
  const popYoyWinner = dPopYoy && hPopYoy ? (dPopYoy > hPopYoy ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Population Growth (YoY)         │ ${fmtPct(dPopYoy).padEnd(16)} │ ${fmtPct(hPopYoy).padEnd(16)} │ ${popYoyWinner.padEnd(7)} │`);

  const dIncome = dallas.census?.median_household_income;
  const hIncome = houston.census?.median_household_income;
  const incomeWinner = dIncome && hIncome ? (dIncome > hIncome ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Median Income                   │ ${fmtDollar(dIncome).padEnd(16)} │ ${fmtDollar(hIncome).padEnd(16)} │ ${incomeWinner.padEnd(7)} │`);

  const dIncomeYoy = dallas.census?.income_yoy;
  const hIncomeYoy = houston.census?.income_yoy;
  const incomeYoyWinner = dIncomeYoy && hIncomeYoy ? (dIncomeYoy > hIncomeYoy ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Income Growth (YoY)             │ ${fmtPct(dIncomeYoy).padEnd(16)} │ ${fmtPct(hIncomeYoy).padEnd(16)} │ ${incomeYoyWinner.padEnd(7)} │`);

  const dUnemp = dallas.economic?.unemployment_rate;
  const hUnemp = houston.economic?.unemployment_rate;
  const unempWinner = dUnemp && hUnemp ? (dUnemp < hUnemp ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Unemployment Rate               │ ${fmtPct(dUnemp/100).padEnd(16)} │ ${fmtPct(hUnemp/100).padEnd(16)} │ ${unempWinner.padEnd(7)} │`);

  const dEmpYoy = dallas.economic?.employment_yoy;
  const hEmpYoy = houston.economic?.employment_yoy;
  const empYoyWinner = dEmpYoy && hEmpYoy ? (dEmpYoy > hEmpYoy ? 'Dallas' : 'Houston') : '-';
  console.log(`  │ Employment Growth (YoY)         │ ${fmtPct(dEmpYoy).padEnd(16)} │ ${fmtPct(hEmpYoy).padEnd(16)} │ ${empYoyWinner.padEnd(7)} │`);

  console.log('  └─────────────────────────────────┴──────────────────┴──────────────────┴─────────┘');

  // Count wins
  const winners = [zhviWinner, zhviYoyWinner, domWinner, pendingWinner, hotnessWinner, supplyWinner, 
                   priceReducedWinner, popYoyWinner, incomeWinner, incomeYoyWinner, unempWinner, empYoyWinner];
  const dallasWins = winners.filter(w => w === 'Dallas').length;
  const houstonWins = winners.filter(w => w === 'Houston').length;

  console.log('\n══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('  VERDICT');
  console.log('══════════════════════════════════════════════════════════════════════════════════════════\n');

  console.log(`  Dallas wins: ${dallasWins} metrics`);
  console.log(`  Houston wins: ${houstonWins} metrics\n`);

  if (dallasWins > houstonWins) {
    console.log('  ★ RECOMMENDATION: DALLAS');
    console.log('  Based on the key predictive metrics from our formula discovery analysis.');
  } else if (houstonWins > dallasWins) {
    console.log('  ★ RECOMMENDATION: HOUSTON');
    console.log('  Based on the key predictive metrics from our formula discovery analysis.');
  } else {
    console.log('  ★ RECOMMENDATION: TOO CLOSE TO CALL');
    console.log('  Both metros have similar fundamentals - consider specific submarkets.');
  }

  // Data dates
  console.log('\n  Data as of:');
  console.log(`    Zillow: ${dallas.zillow?.zhvi?.date || 'N/A'}`);
  console.log(`    Realtor: ${dallas.realtor?.period_date || 'N/A'}`);
  console.log(`    Census: ${dallas.census?.year || 'N/A'}`);
  console.log(`    Economic: ${dallas.economic?.period_date || 'N/A'}`);
}

compareMetros();
