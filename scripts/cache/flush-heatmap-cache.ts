#!/usr/bin/env npx tsx
/**
 * Flushes the Market Momentum Map read-through cache (`heatmap:v1:*` keys).
 *
 * WHY: the momentum-map widget's packed score history (935 metros × 305+
 * months) is cached in Redis for 24h by ScoringHeatmapService. After the
 * monthly rescore writes a new month into propertyiq_scores_v2, the cached
 * payload is stale until that TTL expires — flushing here makes the new month
 * appear on /forecast (and every other widget placement) immediately. The
 * prefix match also covers future county/zip heatmap variants.
 *
 *   A (automated): run in post-import-refresh.yml after run-scoring-pipeline.
 *   B (manual):    run by hand after any mid-cycle score correction.
 *
 * USAGE:
 *   # Manual prod flush — point REDIS_URL at the public TCP proxy:
 *   REDIS_URL='redis://default:<pw>@<proxy-host>:<port>' npx tsx scripts/cache/flush-heatmap-cache.ts
 *
 *   # Dry run — count matching keys without deleting any:
 *   REDIS_URL='...' npx tsx scripts/cache/flush-heatmap-cache.ts --dry-run
 *
 * Falls back to REDIS_URL from the repo .env files (local dev); an explicit
 * REDIS_URL in the environment wins. No-ops (exit 0) when no REDIS_URL is
 * configured, so it never breaks a pipeline/env where Redis is absent. Uses
 * non-blocking SCAN + UNLINK so it is safe to run against production.
 */
import Redis from "ioredis";
import { config } from "dotenv";
import { join } from "path";

// Match the data-script env convention (scripts/lib/db-client.ts): load .env
// from all locations, first match wins, explicit process.env always overrides.
const projectRoot = join(__dirname, "../..");
config({ path: join(projectRoot, ".env.local") });
config({ path: join(projectRoot, ".env") });
config({ path: join(projectRoot, "packages/frontend/.env.local") });
config({ path: join(projectRoot, "packages/backend/.env") });

const PREFIX = "heatmap:v1:";
const SCAN_BATCH = 500;
const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url || url.trim() === "") {
    console.log(
      "[flush-heatmap] REDIS_URL not set — nothing to flush (no-op).",
    );
    return;
  }

  const redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    family: 0, // Railway dual-stack (IPv6/IPv4)
    lazyConnect: true,
  });

  await redis.connect();
  let cursor = "0";
  let matched = 0;
  let deleted = 0;
  try {
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${PREFIX}*`,
        "COUNT",
        SCAN_BATCH,
      );
      cursor = next;
      matched += keys.length;
      if (keys.length > 0 && !DRY_RUN) {
        await redis.unlink(...keys);
        deleted += keys.length;
      }
    } while (cursor !== "0");

    if (DRY_RUN) {
      console.log(
        `[flush-heatmap] DRY RUN — ${matched} keys match "${PREFIX}*" (none deleted).`,
      );
    } else {
      console.log(
        `[flush-heatmap] Flushed ${deleted} keys with prefix "${PREFIX}".`,
      );
    }
  } finally {
    redis.disconnect();
  }
}

main().catch((err) => {
  console.error(
    `[flush-heatmap] FATAL: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
