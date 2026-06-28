#!/usr/bin/env npx tsx
/**
 * Flushes the market-snapshot read-through cache (`snapshot:v1:*` keys) from Redis.
 *
 * WHY: market snapshots embed PropertyIQ scores + calculated metrics and are
 * cached with a refresh-aligned TTL (see MarketSnapshotService.ttlUntilNextRefresh)
 * that only expires on the monthly-pipeline boundary. When the monthly
 * post-import refresh rewrites scores/metrics — or after any manual mid-cycle
 * data correction — the cached snapshots are stale until that boundary. This
 * script force-expires them so the next request rebuilds against fresh data.
 *
 *   A (automated): run at the end of post-import-refresh.yml, after scoring.
 *   B (manual):    run by hand whenever a mid-cycle data fix lands.
 *
 * USAGE:
 *   # Manual prod flush — point REDIS_URL at the public TCP proxy:
 *   REDIS_URL='redis://default:<pw>@<proxy-host>:<port>' npx tsx scripts/cache/flush-snapshot-cache.ts
 *
 *   # Dry run — count matching keys without deleting any:
 *   REDIS_URL='...' npx tsx scripts/cache/flush-snapshot-cache.ts --dry-run
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

const PREFIX = "snapshot:v1:";
const SCAN_BATCH = 500;
const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url || url.trim() === "") {
    console.log(
      "[flush-snapshots] REDIS_URL not set — nothing to flush (no-op).",
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
        `[flush-snapshots] DRY RUN — ${matched} keys match "${PREFIX}*" (none deleted).`,
      );
    } else {
      console.log(
        `[flush-snapshots] Flushed ${deleted} keys with prefix "${PREFIX}".`,
      );
    }
  } finally {
    redis.disconnect();
  }
}

main().catch((err) => {
  console.error(
    `[flush-snapshots] FATAL: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
