#!/usr/bin/env npx tsx
/**
 * CLI wrapper: download + ingest the Redfin Migration metro dataset.
 *
 * Usage:
 *   npx tsx scripts/sources/redfin/run-redfin-migration-import.ts
 *
 * Env:
 *   SUPABASE_URL                — required (via getSupabaseClient)
 *   SUPABASE_SERVICE_ROLE_KEY   — required (via getSupabaseClient)
 *   REDFIN_MIGRATION_S3_URL     — optional override of the default S3 path
 */

import { getSupabaseClient } from "../../lib/db-client";
import { importRedfinMigration } from "./redfin-migration-download";

async function main(): Promise<void> {
  // Redfin does not publish the migration TSV at a documented public S3 path
  // (both candidates 403). Skip gracefully unless an operator has discovered
  // a working URL and set it explicitly. Exits 0 so the orchestrator doesn't
  // flag this as a recurring failure.
  if (!process.env.REDFIN_MIGRATION_S3_URL) {
    console.log(
      "[redfin-migration] SKIP: REDFIN_MIGRATION_S3_URL not set. " +
        "Redfin has not published this dataset publicly; set the env var to " +
        "a confirmed working URL (e.g. obtained from econdata@redfin.com) to enable.",
    );
    return;
  }

  const supabase = getSupabaseClient();
  const start = Date.now();
  const { metro, flows } = await importRedfinMigration(supabase);
  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `[redfin-migration] done in ${seconds}s — metro: ${metro} rows, flows: ${flows} rows`,
  );
}

main().catch((err) => {
  console.error("[redfin-migration] FAILED:", err);
  process.exit(1);
});
