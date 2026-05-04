/**
 * Download IRS SOI County-to-County Migration Data
 *
 * Source: https://www.irs.gov/statistics/soi-tax-stats-migration-data
 *
 * Each release year provides:
 *   - countyinflow{YY1}{YY2}.csv  (one row per destination/origin pair, IN side)
 *   - countyoutflow{YY1}{YY2}.csv (one row per origin/destination pair, OUT side)
 *
 * (For the FY2022-2023 release the published format is CSV, not XLSX. The
 *  parser uses the `xlsx` library, which auto-detects CSV from buffer input.)
 *
 * Tables populated:
 *   - irs_county_migration_flows           (origin_fips, destination_fips, tax_year)
 *   - irs_migration_county_aggregates      (county_fips, tax_year)
 *
 * Logic is split across:
 *   - sources/irs-migration/parser.ts          (pure functions, unit-tested)
 *   - sources/irs-migration/release-finder.ts  (HTML scrape for latest release)
 *   - this file                                (orchestrator + CLI)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { join } from "path";
import {
  parseIrsXlsx,
  deriveCountyAggregates,
  dedupIrsFlows,
  IrsFlowRow,
  IrsCountyAggregate,
} from "./sources/irs-migration/parser";
import { findLatestIrsRelease } from "./sources/irs-migration/release-finder";

// Re-export pure functions/types for test consumers and downstream callers
export {
  normalizeIrsFips,
  parseIrsXlsx,
  deriveCountyAggregates,
  dedupIrsFlows,
} from "./sources/irs-migration/parser";
export type {
  IrsFlowRow,
  IrsCountyAggregate,
} from "./sources/irs-migration/parser";

const UPSERT_CHUNK = 500;

async function fetchBuffer(url: string): Promise<Buffer> {
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

async function upsertFlows(
  supabase: SupabaseClient,
  flows: IrsFlowRow[],
): Promise<void> {
  for (let i = 0; i < flows.length; i += UPSERT_CHUNK) {
    const chunk = flows.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase
      .from("irs_county_migration_flows")
      .upsert(chunk, {
        onConflict: "origin_fips,destination_fips,tax_year",
      });
    if (error) {
      console.error("IRS flows upsert error:", error.message);
      throw error;
    }
  }
}

async function upsertAggregates(
  supabase: SupabaseClient,
  aggregates: IrsCountyAggregate[],
): Promise<void> {
  for (let i = 0; i < aggregates.length; i += UPSERT_CHUNK) {
    const chunk = aggregates.slice(i, i + UPSERT_CHUNK);
    const { error } = await supabase
      .from("irs_migration_county_aggregates")
      .upsert(chunk, {
        onConflict: "county_fips,tax_year",
      });
    if (error) {
      console.error("IRS aggregates upsert error:", error.message);
      throw error;
    }
  }
}

/**
 * Discover the latest IRS county migration release and ingest it. Idempotent:
 * if the latest tax_year already exists in `irs_county_migration_flows`,
 * the importer is a no-op.
 */
export async function pollAndIngestIrsMigration(
  supabase: SupabaseClient,
): Promise<{ taxYear: number | null; flows: number; aggregates: number }> {
  const release = await findLatestIrsRelease();
  if (!release) return { taxYear: null, flows: 0, aggregates: 0 };
  const { taxYear, inflowUrl, outflowUrl } = release;

  // Idempotency check
  const { data: existing } = await supabase
    .from("irs_county_migration_flows")
    .select("tax_year")
    .order("tax_year", { ascending: false })
    .limit(1);
  if (existing && existing.length && existing[0].tax_year >= taxYear) {
    console.log(`IRS: tax year ${taxYear} already ingested; skipping`);
    return { taxYear: null, flows: 0, aggregates: 0 };
  }

  const [inflowBuf, outflowBuf] = await Promise.all([
    fetchBuffer(inflowUrl),
    fetchBuffer(outflowUrl),
  ]);

  const inflowRows = parseIrsXlsx(inflowBuf, "in", taxYear);
  const outflowRows = parseIrsXlsx(outflowBuf, "out", taxYear);
  // IRS publishes each county-to-county flow in BOTH inflow and outflow files.
  // Concatenating without dedup causes Postgres `ON CONFLICT DO UPDATE` rejects
  // (same row twice in one chunk) and ~2x double-counting in aggregates.
  const allFlows = dedupIrsFlows(inflowRows, outflowRows);

  await upsertFlows(supabase, allFlows);
  const aggregates = deriveCountyAggregates(allFlows);
  await upsertAggregates(supabase, aggregates);

  console.log(
    `IRS: tax_year=${taxYear}, flows=${allFlows.length}, aggregates=${aggregates.length}`,
  );
  return { taxYear, flows: allFlows.length, aggregates: aggregates.length };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------
if (require.main === module) {
  dotenv.config({ path: join(process.cwd(), "packages/backend/.env") });

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in packages/backend/.env",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key);

  pollAndIngestIrsMigration(supabase)
    .then((res) => {
      console.log("Done:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed:", err);
      process.exit(1);
    });
}
