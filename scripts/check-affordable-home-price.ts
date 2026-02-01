/**
 * Check affordable_home_price data and verify calculations
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Same constants as calculation
const DOWN_PAYMENT_PCT = 0.20;
const MORTGAGE_RATE = 0.07; // 7% default
const MORTGAGE_TERM_MONTHS = 360;
const PROPERTY_TAX_RATE = 0.011;
const INSURANCE_RATE = 0.0035;
const FRONT_END_DTI = 0.28;

function calculateAffordableHomePrice(annualIncome: number, mortgageRate: number): number {
  const monthlyRate = mortgageRate / 12;
  const factor = Math.pow(1 + monthlyRate, MORTGAGE_TERM_MONTHS);
  const pmtFactor = (monthlyRate * factor) / (factor - 1);
  const maxMonthlyPITI = (annualIncome * FRONT_END_DTI) / 12;
  const taxInsuranceMonthlyRate = (PROPERTY_TAX_RATE + INSURANCE_RATE) / 12;
  const denominator = (1 - DOWN_PAYMENT_PCT) * pmtFactor + taxInsuranceMonthlyRate;
  return Math.round(maxMonthlyPITI / denominator);
}

async function check() {
  console.log('Checking affordable_home_price data...\n');

  // Check coverage by geography type
  console.log('=== Coverage by Geography ===');
  for (const geoType of ['national', 'state', 'metro', 'county', 'zip']) {
    const { count } = await supabase
      .from('calculated_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', geoType)
      .not('affordable_home_price', 'is', null);
    console.log(`${geoType.padEnd(10)}: ${count || 0} records`);
  }

  // Check state data format
  console.log('\n=== Sample State Data ===');
  const { data: stateData } = await supabase
    .from('calculated_metrics')
    .select('geography_id, geography_name, affordable_home_price')
    .eq('geography_type', 'state')
    .not('affordable_home_price', 'is', null)
    .order('affordable_home_price', { ascending: false })
    .limit(5);

  for (const row of stateData || []) {
    console.log(`  ${row.geography_name} (${row.geography_id}): $${Number(row.affordable_home_price).toLocaleString()}`);
  }

  // Verify calculation with Census income
  console.log('\n=== Verify Calculation ===');
  const { data: censusState } = await supabase
    .from('census_state')
    .select('state_fips, state_name, median_household_income, year')
    .not('median_household_income', 'is', null)
    .order('year', { ascending: false })
    .limit(5);

  for (const row of censusState || []) {
    const income = row.median_household_income;
    const calculated = calculateAffordableHomePrice(income, MORTGAGE_RATE);

    // Get stored value
    const { data: stored } = await supabase
      .from('calculated_metrics')
      .select('affordable_home_price')
      .eq('geography_type', 'state')
      .eq('geography_id', row.state_fips)
      .not('affordable_home_price', 'is', null)
      .single();

    const storedValue = stored?.affordable_home_price || 'N/A';
    const match = stored?.affordable_home_price === calculated ? '✓' : '✗';

    console.log(`  ${row.state_name}: Income=$${income.toLocaleString()} → Calculated=$${calculated.toLocaleString()}, Stored=$${Number(storedValue).toLocaleString()} ${match}`);
  }

  // Sample calculation breakdown
  console.log('\n=== Calculation Breakdown (Maryland $101,652 income) ===');
  const income = 101652;
  const monthlyRate = MORTGAGE_RATE / 12;
  const factor = Math.pow(1 + monthlyRate, MORTGAGE_TERM_MONTHS);
  const pmtFactor = (monthlyRate * factor) / (factor - 1);
  const maxMonthlyPITI = (income * FRONT_END_DTI) / 12;
  const taxInsuranceMonthlyRate = (PROPERTY_TAX_RATE + INSURANCE_RATE) / 12;
  const denominator = (1 - DOWN_PAYMENT_PCT) * pmtFactor + taxInsuranceMonthlyRate;
  const homePrice = maxMonthlyPITI / denominator;

  console.log(`  Monthly rate: ${(monthlyRate * 100).toFixed(4)}%`);
  console.log(`  PMT factor: ${pmtFactor.toFixed(6)}`);
  console.log(`  Max monthly PITI (28% DTI): $${maxMonthlyPITI.toFixed(2)}`);
  console.log(`  Tax+Insurance monthly rate: ${(taxInsuranceMonthlyRate * 100).toFixed(4)}%`);
  console.log(`  Denominator: ${denominator.toFixed(6)}`);
  console.log(`  Affordable Home Price: $${Math.round(homePrice).toLocaleString()}`);


  // Check date distribution for County and Zip
  console.log('\n=== Date Distribution ===');
  for (const geoType of ['county', 'zip']) {
    console.log(`\n${geoType.toUpperCase()} Date Distribution:`);
    const { data: dateCounts } = await supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geoType)
      .not('affordable_home_price', 'is', null);

    // Group and count
    const counts: Record<string, number> = {};
    for (const row of dateCounts || []) {
      const date = row.period_date;
      counts[date] = (counts[date] || 0) + 1;
    }

    // Sort and display
    Object.entries(counts)
      .sort((a, b) => b[0].localeCompare(a[0])) // Descending date
      .forEach(([date, count]) => {
        console.log(`  ${date}: ${count} records`);
      });
  }
}

check().catch(console.error);
