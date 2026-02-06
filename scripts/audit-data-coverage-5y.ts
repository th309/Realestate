/**
 * Audit data coverage for key datasets (5-year minimum)
 *
 * Usage:
 *   npx tsx scripts/audit-data-coverage-5y.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: './packages/backend/.env' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type TableSpec = {
  name: string;
  dateColumn: 'period_date' | 'score_date' | 'year' | 'vintage_year';
  category: 'zillow' | 'realtor' | 'census' | 'economic' | 'demographic' | 'calculated';
};

const TABLES: TableSpec[] = [
  // Zillow
  { name: 'zillow_state', dateColumn: 'period_date', category: 'zillow' },
  { name: 'zillow_metro', dateColumn: 'period_date', category: 'zillow' },
  { name: 'zillow_county', dateColumn: 'period_date', category: 'zillow' },
  { name: 'zillow_city', dateColumn: 'period_date', category: 'zillow' },
  { name: 'zillow_zip', dateColumn: 'period_date', category: 'zillow' },

  // Realtor
  { name: 'realtor_national', dateColumn: 'period_date', category: 'realtor' },
  { name: 'realtor_state', dateColumn: 'period_date', category: 'realtor' },
  { name: 'realtor_metro', dateColumn: 'period_date', category: 'realtor' },
  { name: 'realtor_county', dateColumn: 'period_date', category: 'realtor' },
  { name: 'realtor_zip', dateColumn: 'period_date', category: 'realtor' },

  // Census (ACS/CBP tables)
  { name: 'census_national', dateColumn: 'year', category: 'census' },
  { name: 'census_state', dateColumn: 'year', category: 'census' },
  { name: 'census_metro', dateColumn: 'year', category: 'census' },
  { name: 'census_county', dateColumn: 'year', category: 'census' },
  { name: 'census_city', dateColumn: 'year', category: 'census' },
  { name: 'census_zip', dateColumn: 'year', category: 'census' },
  { name: 'census_data', dateColumn: 'year', category: 'census' },

  // Economic
  { name: 'economic_national', dateColumn: 'period_date', category: 'economic' },
  { name: 'economic_state', dateColumn: 'period_date', category: 'economic' },
  { name: 'economic_metro', dateColumn: 'period_date', category: 'economic' },
  { name: 'economic_county', dateColumn: 'period_date', category: 'economic' },

  // Demographic (detailed ACS)
  { name: 'census_demographics', dateColumn: 'vintage_year', category: 'demographic' },
  { name: 'census_economics', dateColumn: 'vintage_year', category: 'demographic' },
  { name: 'census_housing', dateColumn: 'vintage_year', category: 'demographic' },

  // Calculated metrics
  { name: 'calculated_metrics', dateColumn: 'period_date', category: 'calculated' },
];

function toMonthStart(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function subtractYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}

async function fetchMinMax(table: TableSpec): Promise<{ min: string | number | null; max: string | number | null; error?: string }> {
  try {
    const { data: minData, error: minError } = await supabase
      .from(table.name)
      .select(table.dateColumn)
      .order(table.dateColumn, { ascending: true })
      .limit(1);

    if (minError) return { min: null, max: null, error: minError.message };

    const { data: maxData, error: maxError } = await supabase
      .from(table.name)
      .select(table.dateColumn)
      .order(table.dateColumn, { ascending: false })
      .limit(1);

    if (maxError) return { min: null, max: null, error: maxError.message };

    const min = minData?.[0]?.[table.dateColumn] ?? null;
    const max = maxData?.[0]?.[table.dateColumn] ?? null;
    return { min, max };
  } catch (e: any) {
    return { min: null, max: null, error: e?.message || String(e) };
  }
}

function isCoverageOk(table: TableSpec, min: string | number | null, max: string | number | null): { ok: boolean; cutoff?: string | number } {
  if (min == null || max == null) return { ok: false };

  if (table.dateColumn === 'year' || table.dateColumn === 'vintage_year') {
    const minYear = Number(min);
    const maxYear = Number(max);
    if (!Number.isFinite(minYear) || !Number.isFinite(maxYear)) return { ok: false };
    const cutoff = maxYear - 4; // 5-year span inclusive
    return { ok: minYear <= cutoff, cutoff };
  }

  const maxDate = new Date(String(max));
  if (Number.isNaN(maxDate.getTime())) return { ok: false };
  const cutoffDate = subtractYears(maxDate, 5);
  const cutoff = toMonthStart(cutoffDate);
  const minDate = new Date(String(min));
  if (Number.isNaN(minDate.getTime())) return { ok: false, cutoff };
  return { ok: minDate <= cutoffDate, cutoff };
}

async function main() {
  const results: Array<{
    table: string;
    category: string;
    min: string | number | null;
    max: string | number | null;
    ok: boolean;
    cutoff?: string | number;
    error?: string;
  }> = [];

  for (const table of TABLES) {
    const { min, max, error } = await fetchMinMax(table);
    if (error) {
      results.push({ table: table.name, category: table.category, min, max, ok: false, error });
      continue;
    }
    const { ok, cutoff } = isCoverageOk(table, min, max);
    results.push({ table: table.name, category: table.category, min, max, ok, cutoff });
  }

  console.log('5-Year Coverage Audit');
  console.log('='.repeat(80));

  for (const row of results) {
    const status = row.ok ? 'OK ' : 'MISS';
    const cutoff = row.cutoff ? ` (cutoff <= ${row.cutoff})` : '';
    const range = row.min && row.max ? `${row.min} → ${row.max}` : 'no data';
    const error = row.error ? ` ERROR: ${row.error}` : '';
    console.log(`${status}  ${row.category.padEnd(12)} ${row.table.padEnd(22)} ${range}${cutoff}${error}`);
  }

  console.log('\nSummary (missing coverage):');
  const missing = results.filter(r => !r.ok);
  if (missing.length === 0) {
    console.log('✅ All tables have at least 5 years of data.');
  } else {
    for (const row of missing) {
      console.log(`- ${row.table} (${row.category})`);
    }
  }
}

main();
