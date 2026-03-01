/**
 * Check data availability across all scoring tables for backfill readiness.
 * Usage: npx tsx scripts/check-data-availability.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "packages/backend/.env") });

const sb = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getDateRange(table: string) {
  const { data: first } = await sb
    .from(table)
    .select("period_date")
    .order("period_date", { ascending: true })
    .limit(1);
  const { data: last } = await sb
    .from(table)
    .select("period_date")
    .order("period_date", { ascending: false })
    .limit(1);
  return {
    earliest: first?.[0]?.period_date || "N/A",
    latest: last?.[0]?.period_date || "N/A",
  };
}

async function getYearRange(table: string) {
  const { data: first } = await sb
    .from(table)
    .select("year")
    .order("year", { ascending: true })
    .limit(1);
  const { data: last } = await sb
    .from(table)
    .select("year")
    .order("year", { ascending: false })
    .limit(1);
  return {
    earliest: first?.[0]?.year || "N/A",
    latest: last?.[0]?.year || "N/A",
  };
}

async function countAt(table: string, periodDate: string) {
  const { count } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("period_date", periodDate);
  return count ?? 0;
}

async function countAtYear(table: string, year: number) {
  const { count } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("year", year);
  return count ?? 0;
}

async function main() {
  const periodTables = [
    "realtor_metro",
    "realtor_county",
    "realtor_zip",
    "economic_metro",
    "economic_county",
  ];
  const censusTables = ["census_metro", "census_county"];

  console.log("=== DATE RANGES ===\n");
  for (const t of periodTables) {
    const r = await getDateRange(t);
    console.log(`  ${t.padEnd(20)} ${r.earliest}  ->  ${r.latest}`);
  }
  for (const t of censusTables) {
    const r = await getYearRange(t);
    console.log(`  ${t.padEnd(20)} ${r.earliest}       ->  ${r.latest}`);
  }

  console.log("\n=== JAN 2020 ROW COUNTS ===\n");
  for (const t of periodTables) {
    const c = await countAt(t, "2020-01-01");
    console.log(`  ${t.padEnd(20)} ${c.toLocaleString().padStart(8)} rows`);
  }
  for (const t of censusTables) {
    const c = await countAtYear(t, 2020);
    console.log(
      `  ${t.padEnd(20)} ${c.toLocaleString().padStart(8)} rows  (year=2020)`,
    );
  }

  // Also check a few other key dates to see data density over time
  const checkDates = [
    "2020-01-01",
    "2021-01-01",
    "2022-01-01",
    "2023-01-01",
    "2024-01-01",
    "2025-01-01",
    "2026-01-01",
  ];
  console.log("\n=== REALTOR_METRO DENSITY OVER TIME ===\n");
  for (const d of checkDates) {
    const c = await countAt("realtor_metro", d);
    console.log(`  ${d}  ${c.toLocaleString().padStart(6)} rows`);
  }

  // Count distinct periods in realtor_metro from 2020+
  const { data: periods } = await sb
    .from("realtor_metro")
    .select("period_date")
    .gte("period_date", "2020-01-01")
    .order("period_date", { ascending: true })
    .limit(1000);

  const uniquePeriods = [...new Set(periods?.map((r) => r.period_date) || [])];
  console.log(`\n=== DISTINCT PERIODS FROM 2020 (realtor_metro) ===\n`);
  console.log(`  Total: ${uniquePeriods.length} periods`);
  if (uniquePeriods.length > 0) {
    console.log(`  First: ${uniquePeriods[0]}`);
    console.log(`  Last:  ${uniquePeriods[uniquePeriods.length - 1]}`);
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
