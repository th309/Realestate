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
