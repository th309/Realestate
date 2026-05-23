/**
 * Backfill 10 years of PropertyIQ v4 demand-signal scores.
 *
 * Reads Redfin data (sold_above_list, median_dom, months_of_supply) for each
 * historical period and geography level, runs the v4 scoring engine, and
 * upserts results into propertyiq_scores_v2.
 *
 * Prerequisites:
 *   - Run migration 131-enable-v4-propertyiq-score-type.sql first
 *   - Redfin data must be imported for the target date range
 *
 * Usage:
 *   npx tsx scripts/backfill-v4-scores.ts                      # All geos, 10 years
 *   npx tsx scripts/backfill-v4-scores.ts --geo metro           # Metro only
 *   npx tsx scripts/backfill-v4-scores.ts --geo county          # County only
 *   npx tsx scripts/backfill-v4-scores.ts --from 2020-01-01     # Custom start
 *   npx tsx scripts/backfill-v4-scores.ts --to 2024-12-31       # Custom end
 *   npx tsx scripts/backfill-v4-scores.ts --dry-run             # Preview only
 *   npx tsx scripts/backfill-v4-scores.ts --concurrency 3       # Parallel date batches
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import type { GeographyLevel } from "../packages/backend/src/scoring/formula-weights";
import {
  generateMonthlyDates,
  processOnePeriod,
  fmtNum,
  fmtDuration,
} from "./backfill-v4-helpers";
import { bustFreshnessCache } from "./utils/refresh-freshness-cache";

// ---------------------------------------------------------------------------
// Supabase init
// ---------------------------------------------------------------------------

dotenv.config({ path: path.resolve(process.cwd(), "packages/backend/.env") });

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in packages/backend/.env",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_START = "2016-04-01"; // 10 years back from ~2026

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  };
  const has = (flag: string) => args.includes(flag);

  const geoArg = get("--geo");
  const geos: GeographyLevel[] = geoArg
    ? [geoArg as GeographyLevel]
    : ["metro", "county", "zip"];

  return {
    geos,
    from: get("--from") || DEFAULT_START,
    to: get("--to") || null,
    dryRun: has("--dry-run"),
    concurrency: parseInt(get("--concurrency") || "1", 10),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const config = parseArgs();

  console.log("PROPERTYIQ v4 SCORE BACKFILL");
  console.log("============================\n");
  console.log(`Config:`);
  console.log(`  Start date : ${config.from}`);
  console.log(`  End date   : ${config.to || "(latest available)"}`);
  console.log(`  Geos       : ${config.geos.join(", ")}`);
  console.log(
    `  Mode       : ${config.dryRun ? "DRY RUN (no writes)" : "LIVE"}`,
  );
  console.log(`  Concurrency: ${config.concurrency}\n`);

  // Phase 1: Generate monthly dates
  const dates = generateMonthlyDates(config.from, config.to);
  const totalBatches = dates.length * config.geos.length;

  console.log(
    `Phase 1: ${dates.length} months (${dates[0]} to ${dates[dates.length - 1]})`,
  );
  console.log(`  ${totalBatches} period x geography combinations\n`);

  // Phase 2: Calculate and store scores
  console.log("Phase 2: Calculating scores...");
  const overallStart = Date.now();
  let grandScores = 0;
  let grandErrors = 0;
  let batchNum = 0;

  for (const geo of config.geos) {
    for (let i = 0; i < dates.length; i += config.concurrency) {
      const chunk = dates.slice(i, i + config.concurrency);
      const promises = chunk.map(async (date) => {
        const start = Date.now();
        const { scores, errors } = await processOnePeriod(
          supabase,
          geo,
          date,
          config.dryRun,
        );
        return { date, scores, errors, elapsed: Date.now() - start };
      });

      const results = await Promise.all(promises);

      for (const r of results) {
        batchNum++;
        grandScores += r.scores;
        grandErrors += r.errors;

        const errStr = r.errors > 0 ? ` (${r.errors} errors)` : "";
        const eta =
          ((Date.now() - overallStart) / batchNum) * (totalBatches - batchNum);
        const etaStr =
          batchNum < totalBatches ? ` ETA: ${fmtDuration(eta)}` : "";

        process.stdout.write(
          `  [${batchNum}/${totalBatches}] ${geo} ${r.date}: ${fmtNum(r.scores)} scores (${(r.elapsed / 1000).toFixed(1)}s)${errStr}${etaStr}\n`,
        );
      }

      if (i + config.concurrency < dates.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }

  // Summary
  const totalElapsed = Date.now() - overallStart;
  console.log("\n============================");
  console.log("Summary:");
  console.log(`  Total scores : ${fmtNum(grandScores)}`);
  console.log(`  Errors       : ${fmtNum(grandErrors)}`);
  console.log(`  Time         : ${fmtDuration(totalElapsed)}`);
  console.log(
    `  Mode         : ${config.dryRun ? "DRY RUN (nothing written)" : "LIVE"}`,
  );

  if (!config.dryRun) {
    const { count } = await supabase
      .from("propertyiq_scores_v2")
      .select("*", { count: "exact", head: true })
      .eq("score_type", "propertyiq");
    console.log(`  PropertyIQ rows in DB: ${fmtNum(count || 0)}`);

    // Refresh the backend "as of" date cache so new scores surface immediately.
    await bustFreshnessCache();
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err.message || err);
  process.exit(1);
});
