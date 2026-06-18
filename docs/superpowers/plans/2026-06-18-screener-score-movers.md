# Screener PropertyIQ Score Movers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users screen markets by **PropertyIQ Score change** over six windows (1M/3M/6M/1Y/3Y/5Y) on `/screener`, via an integrated Δ column + Gainers/Losers presets and a dedicated Movers tab, with the lookup table refreshed monthly **after** rescoring.

**Architecture:** Add six precomputed `score_chg_*` columns to the existing `screener_snapshot` table, populated inside the monthly `refresh_screener_snapshot()` RPC by index-served self-joins to `propertyiq_scores_v2`. Move that refresh to run **after** the scoring job in `post-import-refresh.yml` (fixing a latent ~1-month staleness bug). Backend exposes the columns for sort/filter plus a `/movers` endpoint; the frontend renders a window selector, a Δ column, two presets, and a Movers leaderboard — all reading the one table.

**Tech Stack:** Postgres (Supabase) plpgsql, NestJS 11 + class-validator, Next.js 16 App Router, React 19, TanStack Query 5, Tailwind 4 (M3 semantic tokens), GitHub Actions.

## Global Constraints

- **Data layer:** ALL frontend fetching goes through `@/lib/data` (fetcher in `lib/data/fetchers/`, hook in `lib/data/hooks/`, exported via the barrels). Never `fetch(${API_URL}…)` in components.
- **Score history is read-only:** never re-score or backfill historical months. This feature only _reads_ `propertyiq_scores_v2`.
- **Write/read split:** scores write to `propertyiq_scores_v2`; reads may use the `propertyiq_scores` view or the base table. The snapshot RPC already reads the view for current scores; baselines read the base table.
- **Migrations:** live in `supabase/migrations/`, named `YYYYMMDDhhmmss_<desc>.sql`. Use a timestamp **greater than the current max** in `schema_migrations` (verify via Supabase MCP). Make DDL idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`) so applying now via MCP and again on deploy is harmless. Supabase silently skips out-of-order versions — never backdate.
- **Colors:** Δ uses M3 semantic tokens only — positive `text-tertiary` (brand green #00C853, the same token `ScreenerTable`'s Overvalued cell uses for "good"), negative `text-error`, zero/null `text-on-surface-variant`. No hardcoded hex. Flat threshold — no magnitude grading.
- **File-size limits:** components ≤400 lines, logic files ≤300. One exported component per file.
- **Prod DB:** query/apply via the authed Supabase MCP (`mcp__plugin_supabase_supabase__execute_sql` / `apply_migration`), project `pysflbhpnqwoczyuaaif`. Never echo secrets.
- **Branch:** work on `develop`. Do not push without explicit user ask.
- **Window → column map (the single source of truth, used verbatim everywhere):**
  `1m→score_chg_1m`, `3m→score_chg_3m`, `6m→score_chg_6m`, `1y→score_chg_1y`, `3y→score_chg_3y`, `5y→score_chg_5y`.
- **Default window:** `3m` (90 days). **Leaderboard length:** top 25 each side.

---

## File Structure

| File                                                                 | Responsibility                            | Action |
| -------------------------------------------------------------------- | ----------------------------------------- | ------ |
| `supabase/migrations/<ts>_screener_snapshot_score_movers.sql`        | Add 6 Δ columns + extend refresh RPC      | Create |
| `packages/backend/src/scripts/refresh-calculated-metrics.ts`         | Remove premature snapshot refresh         | Modify |
| `packages/backend/src/scripts/refresh-screener-snapshot-only.ts`     | Post-scoring snapshot refresh CLI         | Create |
| `.github/workflows/post-import-refresh.yml`                          | New `refresh-screener-after-scoring` job  | Modify |
| `packages/backend/src/screener/screener.dto.ts`                      | Sortable cols + change filter params      | Modify |
| `packages/backend/src/screener/screener.service.ts`                  | Δ columns in row + filter + `queryMovers` | Modify |
| `packages/backend/src/screener/screener.controller.ts`               | `/movers` route + Swagger                 | Modify |
| `packages/frontend/lib/data/fetchers/screener.ts`                    | Δ fields, change params, movers fetcher   | Modify |
| `packages/frontend/lib/data/hooks/useScreenerMovers.ts`              | Movers hook                               | Create |
| `packages/frontend/lib/data/fetchers/index.ts`                       | Export movers fetcher/types               | Modify |
| `packages/frontend/lib/data/hooks/index.ts`                          | Export movers hook                        | Modify |
| `packages/frontend/app/(app)/screener/lib/score-change.ts`           | Window config + color/format helpers      | Create |
| `packages/frontend/app/(app)/screener/components/WindowSelector.tsx` | Window segmented control                  | Create |
| `packages/frontend/app/(app)/screener/components/MoversTab.tsx`      | Gainers/Losers leaderboards               | Create |
| `packages/frontend/app/(app)/screener/components/ScreenerTabs.tsx`   | Screener ↔ Movers tab switch              | Create |
| `packages/frontend/app/(app)/screener/components/PresetChips.tsx`    | Add Gainers/Losers presets                | Modify |
| `packages/frontend/app/(app)/screener/components/FilterRail.tsx`     | Add Δ range filter                        | Modify |
| `packages/frontend/app/(app)/screener/components/ScreenerTable.tsx`  | Δ Score column                            | Modify |
| `packages/frontend/app/(app)/screener/lib/screener-url-state.ts`     | tab + window + change-filter URL state    | Modify |
| `packages/frontend/app/(app)/screener/ScreenerPageInner.tsx`         | Wire tabs/window/presets                  | Modify |

---

## Task 1: DB migration — add Δ columns + extend refresh RPC

**Files:**

- Create: `supabase/migrations/<ts>_screener_snapshot_score_movers.sql`

**Interfaces:**

- Produces: 6 nullable `numeric` columns on `screener_snapshot` (`score_chg_1m|3m|6m|1y|3y|5y`), populated by `refresh_screener_snapshot()` as integer point deltas (`score(latest) − score(latest−N months)`), `NULL` when no baseline exists.

- [ ] **Step 1: Determine the migration timestamp**

Run (Supabase MCP `execute_sql`, project `pysflbhpnqwoczyuaaif`):

```sql
SELECT MAX(version) FROM supabase_migrations.schema_migrations;
```

Expected: a value ≤ `20260615162207`. Pick a filename timestamp strictly greater AND ≥ today, e.g. `20260618120000`. Use it for `<ts>` below.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260618120000_screener_snapshot_score_movers.sql`:

```sql
-- Score "movers": precompute PropertyIQ Score change over 1m/3m/6m/1y/3y/5y into
-- screener_snapshot so the /screener page can screen + leaderboard biggest gainers
-- and losers without touching the 10M-row history table at request time.
--
-- Each delta = round(score(latest) - score(latest - N months)) for the region,
-- matched on exact month-end (scores are dense monthly, month-end dated, back to
-- 2001). NULL when the region has no score at that baseline month-end. Baselines
-- join propertyiq_scores_v2 on (geography, location_id, score_type, score_date),
-- which is exactly the unique_normalized_score index — pure index seeks.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE so applying via MCP now
-- and again on deploy is harmless.

ALTER TABLE screener_snapshot
  ADD COLUMN IF NOT EXISTS score_chg_1m  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_3m  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_6m  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_1y  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_3y  numeric,
  ADD COLUMN IF NOT EXISTS score_chg_5y  numeric;

CREATE OR REPLACE FUNCTION refresh_screener_snapshot()
RETURNS integer
LANGUAGE plpgsql
SET statement_timeout = '600s'
AS $$
DECLARE
  n integer;
BEGIN
  TRUNCATE screener_snapshot;

  INSERT INTO screener_snapshot (
    geo_level, region_id, region_name, state_code,
    score, grade, confidence, median_price, home_value, rent,
    cap_rate, gross_yield, rent_to_price_ratio, grm, months_of_supply, overvalued_pct,
    score_chg_1m, score_chg_3m, score_chg_6m, score_chg_1y, score_chg_3y, score_chg_5y,
    as_of, refreshed_at
  )
  WITH latest_scores AS (
    SELECT DISTINCT ON (geography, location_id)
      geography, location_id, location_name, score, grade, confidence, median_price, score_date
    FROM propertyiq_scores
    WHERE score_type = 'propertyiq'
      AND geography IN ('metro','county','zip')
      AND score_date >= (CURRENT_DATE - INTERVAL '3 months')
    ORDER BY geography, location_id, score_date DESC
  ),
  latest_cm AS (
    SELECT DISTINCT ON (geography_type, geography_id)
      geography_type, geography_id,
      cap_rate, gross_yield, rent_to_price_ratio, grm, months_of_supply, overvalued_pct
    FROM calculated_metrics
    WHERE geography_type IN ('metro','county','zip')
      AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
    ORDER BY geography_type, geography_id, period_date DESC
  ),
  zip_state AS (
    SELECT DISTINCT ON (region_name) region_name, state_code
    FROM zillow_zip
    WHERE metric_name = 'zhvi' AND state_code IS NOT NULL
      AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
    ORDER BY region_name, period_date DESC
  ),
  latest_home_value AS (
    ( SELECT DISTINCT ON (cbsa_code) 'metro'::text AS geo_level, cbsa_code::text AS join_id, value AS home_value
        FROM zillow_metro
        WHERE metric_name = 'zhvi' AND cbsa_code IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY cbsa_code, period_date DESC )
    UNION ALL
    ( SELECT DISTINCT ON (fips_code) 'county'::text, fips_code::text, value
        FROM zillow_county
        WHERE metric_name = 'zhvi' AND fips_code IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY fips_code, period_date DESC )
    UNION ALL
    ( SELECT DISTINCT ON (region_name) 'zip'::text, region_name::text, value
        FROM zillow_zip
        WHERE metric_name = 'zhvi' AND region_name IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY region_name, period_date DESC )
  ),
  latest_rent AS (
    ( SELECT DISTINCT ON (cbsa_code) 'metro'::text AS geo_level, cbsa_code::text AS join_id, value AS rent
        FROM zillow_metro
        WHERE metric_name = 'zori' AND cbsa_code IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY cbsa_code, period_date DESC )
    UNION ALL
    ( SELECT DISTINCT ON (fips_code) 'county'::text, fips_code::text, value
        FROM zillow_county
        WHERE metric_name = 'zori' AND fips_code IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY fips_code, period_date DESC )
    UNION ALL
    ( SELECT DISTINCT ON (region_name) 'zip'::text, region_name::text, value
        FROM zillow_zip
        WHERE metric_name = 'zori' AND region_name IS NOT NULL
          AND period_date >= (CURRENT_DATE - INTERVAL '6 months')
        ORDER BY region_name, period_date DESC )
  )
  SELECT
    s.geography,
    s.location_id,
    s.location_name,
    COALESCE((regexp_match(s.location_name, ',\s*([A-Z]{2})'))[1], zs.state_code) AS state_code,
    s.score, s.grade, s.confidence, s.median_price,
    hv.home_value,
    rt.rent,
    cm.cap_rate, cm.gross_yield, cm.rent_to_price_ratio, cm.grm,
    cm.months_of_supply, cm.overvalued_pct,
    ROUND(s.score - b1.score)::numeric,
    ROUND(s.score - b3.score)::numeric,
    ROUND(s.score - b6.score)::numeric,
    ROUND(s.score - b12.score)::numeric,
    ROUND(s.score - b36.score)::numeric,
    ROUND(s.score - b60.score)::numeric,
    s.score_date,
    now()
  FROM latest_scores s
  LEFT JOIN latest_cm cm
    ON cm.geography_type = s.geography AND cm.geography_id = s.location_id
  LEFT JOIN zip_state zs
    ON s.geography = 'zip' AND zs.region_name = s.location_id
  LEFT JOIN latest_home_value hv
    ON hv.geo_level = s.geography AND hv.join_id = s.location_id
  LEFT JOIN latest_rent rt
    ON rt.geo_level = s.geography AND rt.join_id = s.location_id
  -- Baseline scores at exact month-end N months before this region's latest score.
  -- month_end(N) = (date_trunc('month', d0) - make_interval(months => N-1) - 1 day).
  LEFT JOIN propertyiq_scores_v2 b1
    ON b1.geography = s.geography AND b1.location_id = s.location_id
   AND b1.score_type = 'propertyiq'
   AND b1.score_date = (date_trunc('month', s.score_date) - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b3
    ON b3.geography = s.geography AND b3.location_id = s.location_id
   AND b3.score_type = 'propertyiq'
   AND b3.score_date = (date_trunc('month', s.score_date) - INTERVAL '2 months' - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b6
    ON b6.geography = s.geography AND b6.location_id = s.location_id
   AND b6.score_type = 'propertyiq'
   AND b6.score_date = (date_trunc('month', s.score_date) - INTERVAL '5 months' - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b12
    ON b12.geography = s.geography AND b12.location_id = s.location_id
   AND b12.score_type = 'propertyiq'
   AND b12.score_date = (date_trunc('month', s.score_date) - INTERVAL '11 months' - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b36
    ON b36.geography = s.geography AND b36.location_id = s.location_id
   AND b36.score_type = 'propertyiq'
   AND b36.score_date = (date_trunc('month', s.score_date) - INTERVAL '35 months' - INTERVAL '1 day')::date
  LEFT JOIN propertyiq_scores_v2 b60
    ON b60.geography = s.geography AND b60.location_id = s.location_id
   AND b60.score_type = 'propertyiq'
   AND b60.score_date = (date_trunc('month', s.score_date) - INTERVAL '59 months' - INTERVAL '1 day')::date;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_screener_snapshot() TO service_role;
```

- [ ] **Step 3: Apply the migration to prod**

Apply via Supabase MCP `apply_migration` (project `pysflbhpnqwoczyuaaif`, name `screener_snapshot_score_movers`, the SQL above). This records the version AND runs the DDL.

- [ ] **Step 4: Run the refresh and verify columns populate (this IS the test)**

Run (Supabase MCP `execute_sql`):

```sql
SELECT refresh_screener_snapshot();
```

Expected: returns a row count > 30000.

Then verify a known metro's 1Y delta matches a manual two-row computation:

```sql
WITH snap AS (
  SELECT region_id, region_name, score, score_chg_1y, as_of
  FROM screener_snapshot
  WHERE geo_level = 'metro' AND region_name ILIKE 'Austin%' LIMIT 1
),
manual AS (
  SELECT
    (SELECT score FROM propertyiq_scores_v2
       WHERE geography='metro' AND location_id=snap.region_id
         AND score_type='propertyiq' AND score_date = snap.as_of) AS cur,
    (SELECT score FROM propertyiq_scores_v2
       WHERE geography='metro' AND location_id=snap.region_id
         AND score_type='propertyiq'
         AND score_date = (date_trunc('month', snap.as_of) - INTERVAL '11 months' - INTERVAL '1 day')::date) AS base
  FROM snap
)
SELECT snap.region_name, snap.score, snap.score_chg_1y,
       manual.cur, manual.base, ROUND(manual.cur - manual.base) AS manual_delta
FROM snap, manual;
```

Expected: `score_chg_1y` equals `manual_delta`.

- [ ] **Step 5: Verify NULL handling for short history**

Run:

```sql
SELECT count(*) FILTER (WHERE score_chg_5y IS NULL) AS null_5y,
       count(*) FILTER (WHERE score_chg_1m IS NULL) AS null_1m,
       count(*) AS total
FROM screener_snapshot WHERE geo_level = 'zip';
```

Expected: `null_5y` ≥ `null_1m` (longer windows have more missing baselines), `total` > 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260618120000_screener_snapshot_score_movers.sql
git commit -m "feat(screener): add score-movers delta columns to screener_snapshot refresh"
```

---

## Task 2: Orchestration — refresh after rescoring

**Files:**

- Modify: `packages/backend/src/scripts/refresh-calculated-metrics.ts:113-131`
- Create: `packages/backend/src/scripts/refresh-screener-snapshot-only.ts`
- Modify: `.github/workflows/post-import-refresh.yml`

**Interfaces:**

- Consumes: `ScreenerService.refreshScreenerSnapshot()` (Task baseline, unchanged signature `(): Promise<number>`).
- Produces: a CI job `refresh-screener-after-scoring` that runs only on scoring success.

- [ ] **Step 1: Remove the premature refresh from calculated-metrics**

In `packages/backend/src/scripts/refresh-calculated-metrics.ts`, delete the screener block (lines 113-127) and simplify the TOTAL log. Replace:

```typescript
// Rebuild screener_snapshot after calculated metrics are fresh. This is a
// SUPPLEMENTARY step: a screener timeout/failure must not fail the primary
// calculated_metrics refresh (which already succeeded above), or it would
// block the whole monthly pipeline — including scoring — on a secondary
// snapshot. (screener_snapshot refresh currently exceeds statement_timeout;
// tracked separately for query optimization.)
let screenerRows = -1;
try {
  screenerRows = await app.get(ScreenerService).refreshScreenerSnapshot();
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.warn(`[WARN] screener_snapshot refresh failed (non-fatal): ${msg}`);
}

console.log(
  `TOTAL: ${stored} calculated_metrics rows stored, screener:${screenerRows} in ${((Date.now() - start) / 1000).toFixed(1)}s`,
);
```

with:

```typescript
// NOTE: screener_snapshot is NOT refreshed here. It now refreshes AFTER the
// scoring job (refresh-screener-snapshot-only.ts) so the movers deltas and the
// displayed score reflect the freshest rescore, not last month's.
console.log(
  `TOTAL: ${stored} calculated_metrics rows stored in ${((Date.now() - start) / 1000).toFixed(1)}s`,
);
```

- [ ] **Step 2: Remove the now-unused ScreenerService import**

In the same file, find the `ScreenerService` import near the top (grep `ScreenerService`) and delete that import line. If `app.get(ScreenerService)` was the only use, the import is now dead.

Run: `grep -n "ScreenerService" packages/backend/src/scripts/refresh-calculated-metrics.ts`
Expected: no matches after removal.

- [ ] **Step 3: Create the post-scoring refresh CLI**

Create `packages/backend/src/scripts/refresh-screener-snapshot-only.ts`:

```typescript
/**
 * Headless CLI: rebuild screener_snapshot AFTER the monthly PropertyIQ rescore.
 *
 * Runs as its own CI job (refresh-screener-after-scoring) that `needs:` the
 * scoring job, so the snapshot — including the score-movers deltas — is built
 * once per month from the freshest scores, not last month's. Fatal on failure:
 * a stale movers table should go red, not warn.
 *
 * Boots a SLIM module (Supabase only) like refresh-piq-scores.ts, avoiding
 * AppModule's email/Stripe/AI DI that the snapshot path never uses.
 *
 * Success gate for CI: output line starting with "TOTAL:". [FATAL] marks failure.
 */
import { loadEnvFile } from "./backfill-helpers";
loadEnvFile();
import * as fs from "fs";
import * as path from "path";
const envLocalPath = path.resolve(__dirname, "../../.env.local");
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { SupabaseModule } from "../supabase/supabase.module";
import { ScreenerService } from "../screener/screener.service";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SupabaseModule],
  providers: [ScreenerService],
})
class ScreenerRefreshCliModule {}

async function main() {
  const start = Date.now();
  const app = await NestFactory.createApplicationContext(
    ScreenerRefreshCliModule,
    { logger: ["error", "warn", "log"] },
  );
  try {
    const rows = await app.get(ScreenerService).refreshScreenerSnapshot();
    if (rows === 0) {
      console.error(
        "[FATAL] screener_snapshot refresh stored 0 rows — treating as failure",
      );
      await app.close();
      process.exit(1);
    }
    console.log(
      `TOTAL: ${rows} screener_snapshot rows in ${((Date.now() - start) / 1000).toFixed(1)}s`,
    );
    await app.close();
    process.exit(0);
  } catch (err) {
    console.error("[FATAL] screener_snapshot refresh failed:", err);
    await app.close();
    process.exit(1);
  }
}

void main();
```

- [ ] **Step 4: Verify the CLI builds and runs locally**

Run: `npx ts-node -P packages/backend/tsconfig.json packages/backend/src/scripts/refresh-screener-snapshot-only.ts`
Expected: prints `TOTAL: <n>` with n > 30000, exits 0. (Requires local `.env`/`.env.local` with `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`.)

- [ ] **Step 5: Add the CI job after scoring**

In `.github/workflows/post-import-refresh.yml`, insert this job after the `run-scoring-pipeline` job block (after its `outputs:` at line ~187, before `validate-scores`):

```yaml
refresh-screener-after-scoring:
  needs: run-scoring-pipeline
  runs-on: ubuntu-latest
  timeout-minutes: 30
  if: ${{ needs.run-scoring-pipeline.outputs.scoring_status == 'success' }}

  steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "npm"

    - name: Install dependencies
      run: npm ci

    - name: Build workspace libs for NestJS bootstrap
      run: npm run build:libs

    - name: Refresh screener_snapshot (post-scoring)
      id: screener
      env:
        SUPABASE_URL: "${{ secrets.SUPABASE_URL }}"
        SUPABASE_SERVICE_KEY: "${{ secrets.SUPABASE_SERVICE_KEY }}"
        NEXT_PUBLIC_SUPABASE_URL: "${{ secrets.SUPABASE_URL }}"
        SUPABASE_SERVICE_ROLE_KEY: "${{ secrets.SUPABASE_SERVICE_KEY }}"
      run: |
        echo "=============================================="
        echo "Refreshing screener_snapshot (post-scoring) - $(date)"
        echo "=============================================="
        npx ts-node -P packages/backend/tsconfig.json \
          packages/backend/src/scripts/refresh-screener-snapshot-only.ts \
          2>&1 | tee screener-output.txt
        code=${PIPESTATUS[0]}
        if [ "$code" -eq 0 ] && grep -q "TOTAL:" screener-output.txt && ! grep -q "\[FATAL\]" screener-output.txt; then
          echo "screener_status=success" >> "$GITHUB_OUTPUT"
        else
          echo "screener_status=error" >> "$GITHUB_OUTPUT"
          exit 1
        fi

    - name: Upload Screener Log
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: screener-refresh-log-${{ github.run_id }}
        path: screener-output.txt
        retention-days: 30

  outputs:
    screener_status: ${{ steps.screener.outputs.screener_status }}
```

- [ ] **Step 6: Add the new job to the notify gates**

In the same file, add `refresh-screener-after-scoring` to BOTH `needs:` arrays — `notify-on-failure` (line ~321) and `notify-on-success` (line ~388):

```yaml
needs:
  [
    refresh-calculated-metrics,
    run-scoring-pipeline,
    refresh-screener-after-scoring,
    validate-scores,
    recalibrate-scores,
  ]
```

- [ ] **Step 7: Validate the workflow YAML parses**

Run: `npx --yes js-yaml .github/workflows/post-import-refresh.yml > /dev/null && echo OK`
Expected: `OK` (no YAML parse error).

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/scripts/refresh-calculated-metrics.ts packages/backend/src/scripts/refresh-screener-snapshot-only.ts .github/workflows/post-import-refresh.yml
git commit -m "feat(pipeline): refresh screener_snapshot after rescoring, not before"
```

---

## Task 3: Backend read path — DTO + service Δ columns & filter

**Files:**

- Modify: `packages/backend/src/screener/screener.dto.ts`
- Modify: `packages/backend/src/screener/screener.service.ts`

**Interfaces:**

- Produces: `SortableColumn` now includes the 6 `score_chg_*` names; `ScreenerQueryDto` gains `changeWindow?: MoverWindow`, `changeMin?: number`, `changeMax?: number`; `ScreenerRow` gains the 6 `score_chg_*` fields; `WINDOW_TO_COLUMN` map exported from the DTO file.

- [ ] **Step 1: Extend the DTO**

In `packages/backend/src/screener/screener.dto.ts`, replace the `SORTABLE_COLUMNS` array (lines 14-24) with one that includes the deltas, and add the change params + window map. After the existing `export type SortableColumn = …` line add the window type/map; inside `ScreenerQueryDto` (before `sortBy`) add the three change fields.

Replace lines 14-26:

```typescript
export const SORTABLE_COLUMNS = [
  "score",
  "median_price",
  "cap_rate",
  "gross_yield",
  "rent_to_price_ratio",
  "grm",
  "months_of_supply",
  "overvalued_pct",
  "region_name",
  "score_chg_1m",
  "score_chg_3m",
  "score_chg_6m",
  "score_chg_1y",
  "score_chg_3y",
  "score_chg_5y",
] as const;

export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const MOVER_WINDOWS = ["1m", "3m", "6m", "1y", "3y", "5y"] as const;
export type MoverWindow = (typeof MOVER_WINDOWS)[number];

export const WINDOW_TO_COLUMN: Record<MoverWindow, SortableColumn> = {
  "1m": "score_chg_1m",
  "3m": "score_chg_3m",
  "6m": "score_chg_6m",
  "1y": "score_chg_1y",
  "3y": "score_chg_3y",
  "5y": "score_chg_5y",
};
```

Then add to `ScreenerQueryDto`, immediately before the `sortBy` field (line ~87):

```typescript
  @IsOptional()
  @IsIn(MOVER_WINDOWS)
  changeWindow?: MoverWindow;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  changeMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  changeMax?: number;
```

- [ ] **Step 2: Add Δ fields to ScreenerRow + apply the change filter**

In `packages/backend/src/screener/screener.service.ts`:

(a) Add the 6 fields to `ScreenerRow` (after `overvalued_pct` at line 26):

```typescript
overvalued_pct: number | null;
score_chg_1m: number | null;
score_chg_3m: number | null;
score_chg_6m: number | null;
score_chg_1y: number | null;
score_chg_3y: number | null;
score_chg_5y: number | null;
```

(b) Update the imports from the DTO (line 4-8) to include the window map:

```typescript
import {
  ScreenerQueryDto,
  SORTABLE_COLUMNS,
  SortableColumn,
  WINDOW_TO_COLUMN,
} from "./screener.dto";
```

(c) In `queryScreener`, after the median-price filter block (line 120), add the change filter:

```typescript
if (opts.medianPriceMin != null)
  query = query.gte("median_price", opts.medianPriceMin);
if (opts.medianPriceMax != null)
  query = query.lte("median_price", opts.medianPriceMax);

// Score-movers Δ filter — applies to the active window's precomputed column.
if (opts.changeWindow && (opts.changeMin != null || opts.changeMax != null)) {
  const col = WINDOW_TO_COLUMN[opts.changeWindow];
  if (opts.changeMin != null) query = query.gte(col, opts.changeMin);
  if (opts.changeMax != null) query = query.lte(col, opts.changeMax);
}
```

- [ ] **Step 3: Verify backend compiles**

Run: `npx tsc -p packages/backend/tsconfig.json --noEmit`
Expected: no errors in `screener.dto.ts` / `screener.service.ts`. (Fix any pre-existing unrelated errors per lessons.md only if they block; otherwise note them.)

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/screener/screener.dto.ts packages/backend/src/screener/screener.service.ts
git commit -m "feat(screener): expose score-movers columns for sort + Δ filter"
```

---

## Task 4: Backend movers endpoint

**Files:**

- Modify: `packages/backend/src/screener/screener.dto.ts`
- Modify: `packages/backend/src/screener/screener.service.ts`
- Modify: `packages/backend/src/screener/screener.controller.ts`

**Interfaces:**

- Produces: `GET /api/screener/:geo/movers?window=&limit=&state=` → `{ window: MoverWindow, gainers: ScreenerRow[], losers: ScreenerRow[] }`. Service method `queryMovers(geoLevel, dto): Promise<ScreenerMoversResult>`.

- [ ] **Step 1: Add the movers DTO**

Append to `packages/backend/src/screener/screener.dto.ts`:

```typescript
export class ScreenerMoversQueryDto {
  @IsIn(MOVER_WINDOWS)
  window!: MoverWindow;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/i, {
    message: "state must be a 2-letter code (e.g. TX)",
  })
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

- [ ] **Step 2: Add `queryMovers` to the service**

In `packages/backend/src/screener/screener.service.ts`, add the result type after `ScreenerResult` (line 37):

```typescript
export interface ScreenerMoversResult {
  window: string;
  gainers: ScreenerRow[];
  losers: ScreenerRow[];
}
```

Add the import for the movers DTO + window type to the existing DTO import block:

```typescript
import {
  ScreenerQueryDto,
  ScreenerMoversQueryDto,
  SORTABLE_COLUMNS,
  SortableColumn,
  WINDOW_TO_COLUMN,
  MoverWindow,
} from "./screener.dto";
```

Add the method after `queryScreener` (after line 144, before the closing brace):

```typescript
  /**
   * Top gainers + losers for a score window. Two ordered reads of the same
   * snapshot on the precomputed Δ column, NULL deltas excluded from both lists.
   */
  async queryMovers(
    geoLevel: 'metro' | 'county' | 'zip',
    dto: ScreenerMoversQueryDto,
  ): Promise<ScreenerMoversResult> {
    const window: MoverWindow = dto.window;
    const col = WINDOW_TO_COLUMN[window];
    const limit = Math.min(dto.limit ?? 25, 100);

    const baseQuery = () => {
      let q = this.supabase
        .from('screener_snapshot')
        .select('*')
        .eq('geo_level', geoLevel)
        .not(col, 'is', null);
      if (dto.state) q = q.eq('state_code', dto.state.toUpperCase());
      return q;
    };

    const [gainersRes, losersRes] = await Promise.all([
      baseQuery()
        .order(col, { ascending: false, nullsFirst: false })
        .limit(limit),
      baseQuery()
        .order(col, { ascending: true, nullsFirst: false })
        .limit(limit),
    ]);

    if (gainersRes.error) {
      throw new Error(`screener movers (gainers) failed: ${gainersRes.error.message}`);
    }
    if (losersRes.error) {
      throw new Error(`screener movers (losers) failed: ${losersRes.error.message}`);
    }

    return {
      window,
      gainers: (gainersRes.data ?? []) as ScreenerRow[],
      losers: (losersRes.data ?? []) as ScreenerRow[],
    };
  }
```

- [ ] **Step 3: Add the controller route**

In `packages/backend/src/screener/screener.controller.ts`:

(a) Extend the imports:

```typescript
import {
  ScreenerService,
  ScreenerResult,
  ScreenerMoversResult,
} from "./screener.service";
import { ScreenerQueryDto, ScreenerMoversQueryDto } from "./screener.dto";
```

(b) Add this route **before** the existing `@Get(':geo')` method (so the more specific path is registered first):

```typescript
  /**
   * GET /api/screener/:geo/movers
   *
   * Top gainers + losers by PropertyIQ Score change over `window`.
   */
  @Get(':geo/movers')
  @ApiOperation({ summary: 'Top score gainers and losers for a geography level' })
  @ApiParam({ name: 'geo', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'window', enum: ['1m', '3m', '6m', '1y', '3y', '5y'] })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async queryMovers(
    @Param('geo') geo: string,
    @Query() dto: ScreenerMoversQueryDto,
  ): Promise<ScreenerMoversResult> {
    const lower = geo.toLowerCase();
    if (!(VALID_GEO_LEVELS as readonly string[]).includes(lower)) {
      throw new HttpException(
        `Invalid geo: ${geo}. Valid values: ${VALID_GEO_LEVELS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.screenerService.queryMovers(lower as GeoLevel, dto);
  }
```

(c) Extend the existing `@Get(':geo')` `sortBy` Swagger enum (lines 50-60) and add the change params so the integrated Δ sort/filter is documented:

```typescript
    enum: [
      'score',
      'median_price',
      'cap_rate',
      'gross_yield',
      'rent_to_price_ratio',
      'grm',
      'months_of_supply',
      'overvalued_pct',
      'region_name',
      'score_chg_1m',
      'score_chg_3m',
      'score_chg_6m',
      'score_chg_1y',
      'score_chg_3y',
      'score_chg_5y',
    ],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'changeWindow', required: false, enum: ['1m', '3m', '6m', '1y', '3y', '5y'] })
  @ApiQuery({ name: 'changeMin', required: false, type: Number })
  @ApiQuery({ name: 'changeMax', required: false, type: Number })
```

- [ ] **Step 4: Live integration test (real DB, running backend)**

Start the backend (`npm run dev:fresh` or existing local backend on :3001), then run:

```bash
curl -s "http://localhost:3001/api/screener/metro/movers?window=1y&limit=5" | npx --yes json -ka
curl -s "http://localhost:3001/api/screener/metro?sortBy=score_chg_1y&sortOrder=desc&pageSize=5" | npx --yes json data
```

Expected: movers returns `{window, gainers[5], losers[5]}` where `gainers[0].score_chg_1y` ≥ `gainers[1].score_chg_1y` and `losers[0].score_chg_1y` ≤ `losers[1].score_chg_1y`; the sorted screener call returns rows ordered by `score_chg_1y` desc with no null deltas at the top.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/screener/
git commit -m "feat(screener): add /movers gainers+losers endpoint"
```

---

## Task 5: Frontend data layer — fetcher + hook + barrels

**Files:**

- Modify: `packages/frontend/lib/data/fetchers/screener.ts`
- Create: `packages/frontend/lib/data/hooks/useScreenerMovers.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts:33-40`
- Modify: `packages/frontend/lib/data/hooks/index.ts:149-154`

**Interfaces:**

- Produces: `MoverWindow`, `ScreenerMoversResult`, `fetchScreenerMovers(geoLevel, query)`, `useScreenerMovers(geoLevel, window, options)`; `ScreenerRow` gains 6 `score_chg_*`; `ScreenerQuery` gains `changeWindow|changeMin|changeMax` and 6 `score_chg_*` sortBy values.

- [ ] **Step 1: Extend the fetcher types + add the movers fetcher**

In `packages/frontend/lib/data/fetchers/screener.ts`:

(a) Add `MoverWindow` after `ScreenerGeoLevel` (line 11):

```typescript
export type ScreenerGeoLevel = "metro" | "county" | "zip";
export type MoverWindow = "1m" | "3m" | "6m" | "1y" | "3y" | "5y";
```

(b) Extend the `sortBy` union and add change params in `ScreenerQuery` (lines 25-37):

```typescript
  sortBy?:
    | "score"
    | "median_price"
    | "cap_rate"
    | "gross_yield"
    | "rent_to_price_ratio"
    | "grm"
    | "months_of_supply"
    | "overvalued_pct"
    | "region_name"
    | "score_chg_1m"
    | "score_chg_3m"
    | "score_chg_6m"
    | "score_chg_1y"
    | "score_chg_3y"
    | "score_chg_5y";
  sortOrder?: "asc" | "desc";
  changeWindow?: MoverWindow;
  changeMin?: number;
  changeMax?: number;
  page?: number;
  pageSize?: number;
```

(c) Add the 6 Δ fields to `ScreenerRow` (after `overvalued_pct` line 56):

```typescript
overvalued_pct: number | null;
score_chg_1m: number | null;
score_chg_3m: number | null;
score_chg_6m: number | null;
score_chg_1y: number | null;
score_chg_3y: number | null;
score_chg_5y: number | null;
```

(d) Pass the change params in `fetchScreener`'s `params` object (after `sortOrder` line 87):

```typescript
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    changeWindow: query.changeWindow,
    changeMin: query.changeMin,
    changeMax: query.changeMax,
    page: query.page,
    pageSize: query.pageSize,
```

(e) Append the movers result type + fetcher at the end of the file:

```typescript
export interface ScreenerMoversResult {
  window: MoverWindow;
  gainers: ScreenerRow[];
  losers: ScreenerRow[];
}

export interface ScreenerMoversQuery {
  window: MoverWindow;
  state?: string;
  limit?: number;
}

export async function fetchScreenerMovers(
  geoLevel: ScreenerGeoLevel,
  query: ScreenerMoversQuery,
): Promise<ScreenerMoversResult> {
  const params: Record<string, string | number | undefined> = {
    window: query.window,
    state: query.state,
    limit: query.limit,
  };
  return fetchAPIWithParams<ScreenerMoversResult>(
    `/api/screener/${geoLevel}/movers`,
    params,
  );
}
```

- [ ] **Step 2: Create the movers hook**

Create `packages/frontend/lib/data/hooks/useScreenerMovers.ts`:

```typescript
/**
 * USE SCREENER MOVERS HOOK
 *
 * React Query hook for GET /api/screener/:geo/movers — top score gainers and
 * losers for a window. Same caching posture as useScreener.
 */
"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchScreenerMovers,
  type ScreenerGeoLevel,
  type MoverWindow,
  type ScreenerMoversResult,
} from "../fetchers/screener";

export interface UseScreenerMoversOptions {
  state?: string;
  limit?: number;
  enabled?: boolean;
}

export interface UseScreenerMoversResult {
  data: ScreenerMoversResult | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

export function useScreenerMovers(
  geoLevel: ScreenerGeoLevel,
  window: MoverWindow,
  options: UseScreenerMoversOptions = {},
): UseScreenerMoversResult {
  const { state, limit = 25, enabled = true } = options;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["screener-movers", geoLevel, window, state ?? null, limit],
    queryFn: () => fetchScreenerMovers(geoLevel, { window, state, limit }),
    enabled,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    placeholderData: keepPreviousData,
  });

  return { data, isLoading, isFetching, error: error as Error | null };
}
```

- [ ] **Step 3: Export from the barrels**

In `packages/frontend/lib/data/fetchers/index.ts`, extend the screener export block (lines 34-40):

```typescript
export {
  fetchScreener,
  fetchScreenerMovers,
  type ScreenerGeoLevel,
  type MoverWindow,
  type ScreenerQuery,
  type ScreenerRow,
  type ScreenerResult,
  type ScreenerMoversQuery,
  type ScreenerMoversResult,
} from "./screener";
```

In `packages/frontend/lib/data/hooks/index.ts`, extend the screener export block (lines 150-154):

```typescript
export {
  useScreener,
  type UseScreenerOptions,
  type UseScreenerResult,
} from "./useScreener";
export {
  useScreenerMovers,
  type UseScreenerMoversOptions,
  type UseScreenerMoversResult,
} from "./useScreenerMovers";
```

- [ ] **Step 4: Verify the frontend types compile**

Run: `npx tsc -p packages/frontend/tsconfig.json --noEmit 2>&1 | grep -E "screener|Movers" || echo "no screener type errors"`
Expected: `no screener type errors`.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/fetchers/screener.ts packages/frontend/lib/data/hooks/useScreenerMovers.ts packages/frontend/lib/data/fetchers/index.ts packages/frontend/lib/data/hooks/index.ts
git commit -m "feat(data): screener movers fetcher + hook + Δ fields"
```

---

## Task 6: Frontend shared helper — window config + color/format

**Files:**

- Create: `packages/frontend/app/(app)/screener/lib/score-change.ts`
- Test: `packages/frontend/app/(app)/screener/lib/score-change.test.ts`

**Interfaces:**

- Produces: `MOVER_WINDOWS`, `WINDOW_META` (value/label/tooltip), `WINDOW_TO_COLUMN`, `DEFAULT_WINDOW='3m'`, `getScoreChangeColor(delta): string`, `formatScoreChange(delta): string`.

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/app/(app)/screener/lib/score-change.test.ts`:

```typescript
import {
  getScoreChangeColor,
  formatScoreChange,
  WINDOW_TO_COLUMN,
  DEFAULT_WINDOW,
} from "./score-change";

describe("score-change helpers", () => {
  it("colors gains green, losses red, zero/null neutral (flat threshold)", () => {
    expect(getScoreChangeColor(5)).toContain("tertiary");
    expect(getScoreChangeColor(40)).toBe(getScoreChangeColor(5)); // flat — no grading
    expect(getScoreChangeColor(-3)).toContain("error");
    expect(getScoreChangeColor(0)).toContain("on-surface-variant");
    expect(getScoreChangeColor(null)).toContain("on-surface-variant");
  });

  it("formats signed integers and em-dash for null", () => {
    expect(formatScoreChange(14)).toBe("+14");
    expect(formatScoreChange(-7)).toBe("−7"); // U+2212 minus
    expect(formatScoreChange(0)).toBe("0");
    expect(formatScoreChange(null)).toBe("—");
  });

  it("maps windows to snapshot columns and defaults to 90d", () => {
    expect(WINDOW_TO_COLUMN["1y"]).toBe("score_chg_1y");
    expect(DEFAULT_WINDOW).toBe("3m");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest packages/frontend/app/\(app\)/screener/lib/score-change.test.ts`
Expected: FAIL — `Cannot find module './score-change'`.

- [ ] **Step 3: Implement the helper**

Create `packages/frontend/app/(app)/screener/lib/score-change.ts`:

```typescript
// Score-movers shared config + presentation helpers. Flat green/red threshold:
// gains green, losses red, zero/missing neutral — NO magnitude grading.
import type { MoverWindow, ScreenerQuery } from "@/lib/data";

type SortBy = NonNullable<ScreenerQuery["sortBy"]>;

export const MOVER_WINDOWS: MoverWindow[] = [
  "1m",
  "3m",
  "6m",
  "1y",
  "3y",
  "5y",
];

export const DEFAULT_WINDOW: MoverWindow = "3m";

export const WINDOW_META: Record<
  MoverWindow,
  { label: string; tooltip: string }
> = {
  "1m": { label: "1M", tooltip: "Score change over the last month" },
  "3m": { label: "3M", tooltip: "Score change over ~90 days" },
  "6m": { label: "6M", tooltip: "Score change over ~180 days" },
  "1y": { label: "1Y", tooltip: "Score change over 1 year" },
  "3y": { label: "3Y", tooltip: "Score change over 3 years" },
  "5y": { label: "5Y", tooltip: "Score change over 5 years" },
};

export const WINDOW_TO_COLUMN: Record<MoverWindow, SortBy> = {
  "1m": "score_chg_1m",
  "3m": "score_chg_3m",
  "6m": "score_chg_6m",
  "1y": "score_chg_1y",
  "3y": "score_chg_3y",
  "5y": "score_chg_5y",
};

/** Flat threshold color class for a Δ value. */
export function getScoreChangeColor(delta: number | null): string {
  if (delta === null || delta === 0) return "text-on-surface-variant";
  return delta > 0 ? "text-tertiary" : "text-error";
}

/** Signed integer with a real minus sign (U+2212); em-dash for missing. */
export function formatScoreChange(delta: number | null): string {
  if (delta === null) return "—";
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}
```

> Confirmed: `globals.css` maps brand green (#00C853) to `--color-tertiary`, i.e. the Tailwind class `text-tertiary`. There is NO `text-accent` token. `ScreenerTable`'s Overvalued cell already uses `text-tertiary` for "good", so positive Δ → `text-tertiary` is consistent. Do not introduce a new token.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest packages/frontend/app/\(app\)/screener/lib/score-change.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/screener/lib/score-change.ts" "packages/frontend/app/(app)/screener/lib/score-change.test.ts"
git commit -m "feat(screener): score-change window config + flat color helper"
```

---

## Task 7: Frontend WindowSelector component

**Files:**

- Create: `packages/frontend/app/(app)/screener/components/WindowSelector.tsx`

**Interfaces:**

- Consumes: `MOVER_WINDOWS`, `WINDOW_META` from `../lib/score-change`; `MoverWindow` from `@/lib/data`.
- Produces: `<WindowSelector value={MoverWindow} onChange={(w: MoverWindow) => void} />`.

- [ ] **Step 1: Implement the component**

Create `packages/frontend/app/(app)/screener/components/WindowSelector.tsx`:

```typescript
"use client";

import React from "react";
import type { MoverWindow } from "@/lib/data";
import { MOVER_WINDOWS, WINDOW_META } from "../lib/score-change";

interface WindowSelectorProps {
  value: MoverWindow;
  onChange: (window: MoverWindow) => void;
}

export function WindowSelector({ value, onChange }: WindowSelectorProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-outline bg-surface p-1"
      role="radiogroup"
      aria-label="Score change window"
    >
      <span className="px-2 text-xs font-medium text-on-surface-variant select-none">
        Δ
      </span>
      {MOVER_WINDOWS.map((w) => {
        const isActive = value === w;
        return (
          <button
            key={w}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={WINDOW_META[w].tooltip}
            onClick={() => onChange(w)}
            className={`
              px-3 py-1 rounded-full text-sm font-medium transition-all duration-200
              ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary hover:bg-primary-container/30"
              }
            `}
          >
            {WINDOW_META[w].label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p packages/frontend/tsconfig.json --noEmit 2>&1 | grep -i "WindowSelector" || echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(app)/screener/components/WindowSelector.tsx"
git commit -m "feat(screener): window selector control"
```

---

## Task 8: Frontend integrated tab — Δ column + presets + filter + URL state

**Files:**

- Modify: `packages/frontend/app/(app)/screener/components/ScreenerTable.tsx`
- Modify: `packages/frontend/app/(app)/screener/components/PresetChips.tsx`
- Modify: `packages/frontend/app/(app)/screener/components/FilterRail.tsx`
- Modify: `packages/frontend/app/(app)/screener/lib/screener-url-state.ts`

**Interfaces:**

- Consumes: `getScoreChangeColor`, `formatScoreChange`, `WINDOW_TO_COLUMN`, `WINDOW_META` from `../lib/score-change`.
- Produces: `ScreenerTable` accepts `changeWindow: MoverWindow`; `PresetChips` adds `gainers`/`losers` ids; `FilterRail` accepts `changeWindow` + a Δ range field; URL state reads/writes `tab`, `window`, `changeMin`, `changeMax`.

- [ ] **Step 1: Add the Δ column to ScreenerTable**

In `packages/frontend/app/(app)/screener/components/ScreenerTable.tsx`:

(a) Add imports (after line 11):

```typescript
import type { ScreenerRow, ScreenerQuery, MoverWindow } from "@/lib/data";
import { formatMetricValue } from "@/lib/data";
import {
  getScoreColor,
  getLetterGrade,
  getGradeColor,
} from "@/app/components/scoring/ScoreDisplay";
import {
  WINDOW_TO_COLUMN,
  WINDOW_META,
  getScoreChangeColor,
  formatScoreChange,
} from "../lib/score-change";
```

(b) Add `changeWindow` to props (after `onSort` in `ScreenerTableProps`, line 39):

```typescript
  onSort: (col: SortableCol) => void;
  /** Active score-change window; drives the Δ column's value + sort key. */
  changeWindow: MoverWindow;
```

and destructure it in the function signature (line 101-111): add `changeWindow,` to the params list.

(c) Build the columns dynamically so the Δ column's key tracks the window. Replace the static `COLUMNS` const (lines 21-30) usage: inside the component body, before `return`, compute:

```typescript
const changeCol = WINDOW_TO_COLUMN[changeWindow];
const columns: ColumnDef[] = [
  { key: null, label: "#", align: "right" },
  { key: "region_name", label: "Market", align: "left" },
  { key: "score", label: "Score", align: "right" },
  {
    key: changeCol,
    label: `Δ ${WINDOW_META[changeWindow].label}`,
    align: "right",
  },
  { key: "median_price", label: "Median Price", align: "right" },
  { key: null, label: "Rent", align: "right" },
  { key: "cap_rate", label: "Cap Rate", align: "right" },
  { key: "months_of_supply", label: "MoS", align: "right" },
  { key: "overvalued_pct", label: "Overvalued %", align: "right" },
];
```

Delete the module-level `COLUMNS` constant and replace every `COLUMNS` reference in the JSX (`COLUMNS.map`, `colSpan={COLUMNS.length}`) with `columns`.

(d) Render the Δ cell. In the row body, after the Score `<td>` (line 244) and before Median Price, insert:

```typescript
                  {/* Δ Score (active window) */}
                  <td
                    className={`px-4 py-3 text-right font-[family-name:var(--font-roboto-mono)] ${getScoreChangeColor(
                      row[changeCol] as number | null,
                    )}`}
                  >
                    {(() => {
                      const d = row[changeCol] as number | null;
                      if (d === null) return "—";
                      const arrow = d > 0 ? "▲ " : d < 0 ? "▼ " : "";
                      return `${arrow}${formatScoreChange(d)}`;
                    })()}
                  </td>
```

> `row[changeCol]` indexes a `score_chg_*` field on `ScreenerRow`; all six exist (Task 5), so the cast is safe.

- [ ] **Step 2: Add Gainers/Losers presets**

In `packages/frontend/app/(app)/screener/components/PresetChips.tsx`:

(a) Extend `PresetId` (line 6) and add a `dynamic` marker so the page resolves the window-dependent sort:

```typescript
export type PresetId =
  | "hottest"
  | "undervalued"
  | "cashflow"
  | "gainers"
  | "losers";

export interface Preset {
  id: PresetId;
  label: string;
  query: Partial<ScreenerQuery>;
  /** Sort key depends on the active window — resolved by the page, not here. */
  windowSorted?: "desc" | "asc";
}
```

(b) Append two presets to `PRESETS` (after `cashflow`, line 41):

```typescript
  {
    id: "gainers",
    label: "Biggest Gainers",
    query: {},
    windowSorted: "desc",
  },
  {
    id: "losers",
    label: "Biggest Losers",
    query: {},
    windowSorted: "asc",
  },
```

- [ ] **Step 3: Add the Δ filter to FilterRail**

In `packages/frontend/app/(app)/screener/components/FilterRail.tsx`:

(a) Extend `FilterKey` (lines 7-17) with the change range keys:

```typescript
type FilterKey =
  | "scoreMin"
  | "scoreMax"
  | "medianPriceMin"
  | "medianPriceMax"
  | "capRateMin"
  | "capRateMax"
  | "monthsOfSupplyMin"
  | "monthsOfSupplyMax"
  | "overvaluedMin"
  | "overvaluedMax"
  | "changeMin"
  | "changeMax";
```

(b) Add a `changeWindow` prop and a window-aware Δ field. Update `FilterRailProps` (lines 77-81):

```typescript
interface FilterRailProps {
  filters: Partial<ScreenerQuery>;
  changeWindow: MoverWindow;
  onChange: (patch: Partial<ScreenerQuery>) => void;
  onReset: () => void;
}
```

Add the import (line 5): `import type { ScreenerQuery, MoverWindow } from "@/lib/data";` and `import { WINDOW_META } from "../lib/score-change";`.

(c) Because the Δ field label depends on the window, build the fields inside the component instead of the module-level `FILTER_FIELDS`. Move `FILTER_FIELDS` into the component body as `fields`, appending the Δ entry:

```typescript
const fields: FilterField[] = [
  ...FILTER_FIELDS,
  {
    label: `Score Δ (${WINDOW_META[changeWindow].label})`,
    minKey: "changeMin",
    maxKey: "changeMax",
    minPlaceholder: "-20",
    maxPlaceholder: "20",
    step: 1,
    hint: "pts",
  },
];
```

Keep the module-level `FILTER_FIELDS` as the base (the original 5). Replace `FILTER_FIELDS.map` / `FILTER_FIELDS.reduce` in the body with `fields`. Update the grid to `xl:grid-cols-6` (line 126) so 6 fields lay out evenly.

- [ ] **Step 4: Extend URL state for tab + window + change filter**

In `packages/frontend/app/(app)/screener/lib/screener-url-state.ts`:

(a) Extend `VALID_SORT` (lines 10-20) with the 6 change columns and `FILTER_KEYS` (lines 22-33) with `changeMin`/`changeMax`:

```typescript
const VALID_SORT: SortBy[] = [
  "score",
  "median_price",
  "cap_rate",
  "gross_yield",
  "rent_to_price_ratio",
  "grm",
  "months_of_supply",
  "overvalued_pct",
  "region_name",
  "score_chg_1m",
  "score_chg_3m",
  "score_chg_6m",
  "score_chg_1y",
  "score_chg_3y",
  "score_chg_5y",
];

const FILTER_KEYS: (keyof ScreenerQuery)[] = [
  "scoreMin",
  "scoreMax",
  "medianPriceMin",
  "medianPriceMax",
  "capRateMin",
  "capRateMax",
  "monthsOfSupplyMin",
  "monthsOfSupplyMax",
  "overvaluedMin",
  "overvaluedMax",
  "changeMin",
  "changeMax",
];
```

(b) Add tab + window readers and extend the preset reader. Add imports at top:

```typescript
import type { ScreenerQuery, ScreenerGeoLevel, MoverWindow } from "@/lib/data";
import type { PresetId } from "../components/PresetChips";
import { MOVER_WINDOWS, DEFAULT_WINDOW } from "./score-change";

export type ScreenerTab = "screener" | "movers";
```

Update `readPreset` to accept the new ids:

```typescript
export function readPreset(params: URLSearchParams): PresetId | null {
  const v = params.get("preset");
  if (
    v === "hottest" ||
    v === "undervalued" ||
    v === "cashflow" ||
    v === "gainers" ||
    v === "losers"
  )
    return v;
  return null;
}
```

Add:

```typescript
export function readTab(params: URLSearchParams): ScreenerTab {
  return params.get("tab") === "movers" ? "movers" : "screener";
}

export function readWindow(params: URLSearchParams): MoverWindow {
  const v = params.get("window") as MoverWindow | null;
  return v && MOVER_WINDOWS.includes(v) ? v : DEFAULT_WINDOW;
}
```

(c) Extend `buildScreenerUrl` to persist tab + window. Change its signature and body:

```typescript
export function buildScreenerUrl(
  geo: ScreenerGeoLevel,
  stateFilter: string,
  preset: PresetId | null,
  filters: Partial<ScreenerQuery>,
  sortBy: SortBy,
  sortOrder: "asc" | "desc",
  page: number,
  tab: ScreenerTab,
  window: MoverWindow,
): string {
  const p = new URLSearchParams();
  p.set("geo", geo);
  if (tab !== "screener") p.set("tab", tab);
  if (window !== DEFAULT_WINDOW) p.set("window", window);
  if (stateFilter) p.set("state", stateFilter);
  if (preset) p.set("preset", preset);
  if (sortBy !== "score") p.set("sortBy", sortBy);
  if (sortOrder !== "desc") p.set("sortOrder", sortOrder);
  if (page > 0) p.set("page", String(page));
  for (const k of FILTER_KEYS) {
    const v = filters[k];
    if (v !== undefined) p.set(k, String(v));
  }
  return p.toString();
}
```

- [ ] **Step 5: Verify compile + existing helper test still passes**

Run: `npx tsc -p packages/frontend/tsconfig.json --noEmit 2>&1 | grep -E "screener|Movers|PresetChips|FilterRail" || echo OK`
Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/screener/components/ScreenerTable.tsx" "packages/frontend/app/(app)/screener/components/PresetChips.tsx" "packages/frontend/app/(app)/screener/components/FilterRail.tsx" "packages/frontend/app/(app)/screener/lib/screener-url-state.ts"
git commit -m "feat(screener): Δ column, gainers/losers presets, Δ filter, window URL state"
```

---

## Task 9: Frontend Movers tab + ScreenerTabs + page wiring

**Files:**

- Create: `packages/frontend/app/(app)/screener/components/MoversTab.tsx`
- Create: `packages/frontend/app/(app)/screener/components/ScreenerTabs.tsx`
- Modify: `packages/frontend/app/(app)/screener/ScreenerPageInner.tsx`

**Interfaces:**

- Consumes: `useScreenerMovers` (Task 5), `WindowSelector` (Task 7), score-change helpers (Task 6), URL-state readers (Task 8).
- Produces: a working two-tab `/screener` with window selector, Δ column, gainers/losers presets, and a leaderboard tab.

- [ ] **Step 1: Create the tab switch**

Create `packages/frontend/app/(app)/screener/components/ScreenerTabs.tsx`:

```typescript
"use client";

import React from "react";
import type { ScreenerTab } from "../lib/screener-url-state";

interface ScreenerTabsProps {
  tab: ScreenerTab;
  onChange: (tab: ScreenerTab) => void;
}

const TABS: { id: ScreenerTab; label: string }[] = [
  { id: "screener", label: "Screener" },
  { id: "movers", label: "Movers" },
];

export function ScreenerTabs({ tab, onChange }: ScreenerTabsProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full bg-surface-container p-1"
      role="tablist"
      aria-label="Screener view"
    >
      {TABS.map((t) => {
        const isActive = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={`
              px-5 py-2 rounded-full text-sm font-medium transition-all duration-200
              ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:text-primary"
              }
            `}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create the Movers tab**

Create `packages/frontend/app/(app)/screener/components/MoversTab.tsx`:

```typescript
"use client";

import React from "react";
import { useScreenerMovers } from "@/lib/data";
import type { ScreenerGeoLevel, MoverWindow, ScreenerRow } from "@/lib/data";
import { WINDOW_META, getScoreChangeColor, formatScoreChange } from "../lib/score-change";

interface MoversTabProps {
  geo: ScreenerGeoLevel;
  window: MoverWindow;
  stateFilter: string;
  enabled: boolean;
}

function moverDelta(row: ScreenerRow, window: MoverWindow): number | null {
  const key = `score_chg_${window}` as keyof ScreenerRow;
  return row[key] as number | null;
}

function Leaderboard({
  title,
  rows,
  window,
}: {
  title: string;
  rows: ScreenerRow[];
  window: MoverWindow;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
      <div className="px-4 py-3 bg-surface-container border-b border-outline-variant text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {title}
      </div>
      <ul>
        {rows.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-on-surface-variant">
            No movers for this window.
          </li>
        ) : (
          rows.map((row, i) => {
            const d = moverDelta(row, window);
            return (
              <li
                key={`${row.geo_level}-${row.region_id}`}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/40 last:border-0 hover:bg-primary-container/10"
              >
                <span className="w-6 text-right font-[family-name:var(--font-roboto-mono)] text-xs text-on-surface-variant">
                  {i + 1}
                </span>
                <span className="flex-1 min-w-0 truncate font-medium text-on-surface">
                  {row.region_name}
                  {row.state_code && (
                    <span className="ml-1.5 text-xs text-on-surface-variant">
                      {row.state_code}
                    </span>
                  )}
                </span>
                <span
                  className={`font-[family-name:var(--font-roboto-mono)] text-sm font-semibold ${getScoreChangeColor(d)}`}
                >
                  {d !== null && d > 0 ? "▲ " : d !== null && d < 0 ? "▼ " : ""}
                  {formatScoreChange(d)}
                </span>
                <span className="w-8 text-right font-[family-name:var(--font-roboto-mono)] text-sm text-on-surface-variant">
                  {row.score ?? "—"}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

export function MoversTab({ geo, window, stateFilter, enabled }: MoversTabProps) {
  const { data, isFetching } = useScreenerMovers(geo, window, {
    state: stateFilter || undefined,
    limit: 25,
    enabled,
  });

  const gainers = data?.gainers ?? [];
  const losers = data?.losers ?? [];

  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-2 gap-4 transition-opacity duration-200 ${
        isFetching ? "opacity-60" : "opacity-100"
      }`}
    >
      <Leaderboard
        title={`Top Gainers — ${WINDOW_META[window].label}`}
        rows={gainers}
        window={window}
      />
      <Leaderboard
        title={`Top Losers — ${WINDOW_META[window].label}`}
        rows={losers}
        window={window}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire tab + window + presets into ScreenerPageInner**

In `packages/frontend/app/(app)/screener/ScreenerPageInner.tsx`:

(a) Add imports (after line 18):

```typescript
import { ScreenerTabs } from "./components/ScreenerTabs";
import { MoversTab } from "./components/MoversTab";
import { WindowSelector } from "./components/WindowSelector";
import type { MoverWindow } from "@/lib/data";
import { WINDOW_TO_COLUMN } from "./lib/score-change";
```

and extend the url-state import block (lines 19-30) with `readTab`, `readWindow`, and `type ScreenerTab`.

(b) Add tab + window state (after the `page` state, line 81):

```typescript
const [tab, setTabState] = useState<ScreenerTab>(() => readTab(params));
const [changeWindow, setChangeWindowState] = useState<MoverWindow>(() =>
  readWindow(params),
);
```

(c) Update the `pushUrl` call sites + `buildScreenerUrl` call to pass `tab` and `changeWindow`. In `pushUrl` (lines 112-134) add the two params to the signature and the `buildScreenerUrl(...)` call (append `nextTab, nextWindow`). In the sync effect (lines 137-140) call:

```typescript
useEffect(() => {
  pushUrl(
    geo,
    stateFilter,
    activePreset,
    filters,
    sortBy,
    sortOrder,
    page,
    tab,
    changeWindow,
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [
  geo,
  stateFilter,
  activePreset,
  filters,
  sortBy,
  sortOrder,
  page,
  tab,
  changeWindow,
]);
```

(Add `nextTab: ScreenerTab, nextWindow: MoverWindow` to `pushUrl`'s parameter list and pass them into `buildScreenerUrl`.)

(d) Resolve window-dependent gainers/losers presets. Replace `handlePresetSelect` (lines 154-165):

```typescript
const handlePresetSelect = useCallback(
  (preset: Preset) => {
    setActivePreset(preset.id);
    if (preset.windowSorted) {
      // Gainers/Losers: sort by the ACTIVE window's Δ column.
      setSortByState(WINDOW_TO_COLUMN[changeWindow]);
      setSortOrderState(preset.windowSorted);
      setFiltersState({});
    } else {
      const {
        sortBy: pSortBy,
        sortOrder: pSortOrder,
        ...pFilters
      } = preset.query;
      if (pSortBy) setSortByState(pSortBy);
      if (pSortOrder) setSortOrderState(pSortOrder);
      setFiltersState(pFilters);
    }
    setPageState(0);
  },
  [changeWindow],
);
```

(e) When the window changes while a gainers/losers preset is active, re-point the sort. Add a handler:

```typescript
const handleWindowChange = useCallback(
  (next: MoverWindow) => {
    setChangeWindowState(next);
    setPageState(0);
    if (activePreset === "gainers" || activePreset === "losers") {
      setSortByState(WINDOW_TO_COLUMN[next]);
    }
  },
  [activePreset],
);
```

(f) Pass `changeWindow` into the query so the Δ filter binds to the right column (extend the `query` object, line 90-97):

```typescript
const query: ScreenerQuery = {
  ...filters,
  state: stateFilter || undefined,
  sortBy,
  sortOrder,
  changeWindow,
  page,
  pageSize: PAGE_SIZE,
};
```

(g) Render the tabs + window selector + conditional body. Replace the geo/preset row + table region (lines 273-321) with:

```typescript
      {/* ── Tabs + window selector ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <ScreenerTabs tab={tab} onChange={setTabState} />
        <WindowSelector value={changeWindow} onChange={handleWindowChange} />
      </div>

      {/* ── Geo selector + (screener-only) preset chips ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <GeoSegmentedControl value={geo} onChange={handleGeoChange} />
        <StateSelect value={stateFilter} onChange={handleStateChange} />
        {tab === "screener" && (
          <PresetChips activePreset={activePreset} onSelect={handlePresetSelect} />
        )}
      </div>

      {/* ── ZIP lock gate ── */}
      {isZipLocked ? (
        <GeoLockCard
          geoName="ZIP Code Markets"
          geoLevel="zip"
          className="max-w-md mx-auto mt-8"
        />
      ) : tab === "movers" ? (
        <MoversTab
          geo={geo}
          window={changeWindow}
          stateFilter={stateFilter}
          enabled={!isZipLocked}
        />
      ) : (
        <>
          <FilterRail
            filters={filters}
            changeWindow={changeWindow}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
          />
          <ScreenerTable
            rows={rows}
            sortBy={sortBy}
            sortOrder={sortOrder}
            page={page}
            pageSize={PAGE_SIZE}
            isFetching={isFetching}
            onSort={handleSort}
            changeWindow={changeWindow}
            activeFilters={activeFilters}
            onClearFilters={handleFilterReset}
          />
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            hasMore={hasMore}
            onPageChange={setPageState}
          />
        </>
      )}
```

> The `FilterRail` was previously rendered above the gate; it now lives inside the screener-tab branch (movers has no filter rail). Remove the old standalone `<FilterRail … />` block (lines 283-288) and the old geo/preset row to avoid duplication.

(h) Disable the main screener query on the movers tab so only one fetch is active. Update the `useScreener` call (line 99-101):

```typescript
const { data, isFetching } = useScreener(geo, query, {
  enabled: !isZipLocked && tab === "screener",
});
```

- [ ] **Step 4: File-size check**

Run: `wc -l "packages/frontend/app/(app)/screener/ScreenerPageInner.tsx"`
Expected: ≤ 400. If over, extract all state + handlers into a new hook `packages/frontend/app/(app)/screener/lib/useScreenerController.ts` returning `{ geo, tab, changeWindow, … , handlers }`, leaving the component as mostly JSX. (Only do this if over the limit.)

- [ ] **Step 5: Live E2E verification (real data, browser)**

Start frontend + backend (`npm run dev:fresh`). Then with Playwright MCP:

1. Navigate to `http://localhost:3000/screener`.
2. Snapshot: confirm the Δ column header reads `Δ 3M` (default window) and shows signed colored values (green ▲ / red ▼ / `—`).
3. Click the `1Y` window button; confirm the Δ column header becomes `Δ 1Y` and values change.
4. Click `Biggest Gainers`; confirm the table sorts so the top Δ is the largest positive for 1Y.
5. Click the `Movers` tab; confirm two leaderboards render (Top Gainers / Top Losers — 1Y), gainers positive, losers negative.
6. Confirm the URL carries `tab=movers` and `window=1y`; reload and confirm state restores.

Expected: all six checks pass against live data. Capture a screenshot of the Movers tab.

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/screener/components/MoversTab.tsx" "packages/frontend/app/(app)/screener/components/ScreenerTabs.tsx" "packages/frontend/app/(app)/screener/ScreenerPageInner.tsx"
git commit -m "feat(screener): movers tab + window selector wired into screener page"
```

---

## Task 10: CSV export Δ column + final verification

**Files:**

- Modify: `packages/frontend/app/(app)/screener/ScreenerPageInner.tsx` (CSV columns)

**Interfaces:**

- Consumes: `WINDOW_TO_COLUMN`, `WINDOW_META`.

- [ ] **Step 1: Add the active-window Δ to the CSV**

In `ScreenerPageInner.tsx`, the `CSV_COLUMNS` const is module-level (lines 44-56) but the Δ column label/key depend on `changeWindow`, so build it in `handleExport`. Replace `handleExport` (lines 199-206):

```typescript
const handleExport = useCallback(() => {
  if (!canExport || rows.length === 0) return;
  const changeCol = WINDOW_TO_COLUMN[changeWindow];
  const columns = [
    { key: "region_name", label: "Market" },
    { key: "state_code", label: "State" },
    { key: "score", label: "PIQ Score" },
    { key: "grade", label: "Grade" },
    { key: changeCol, label: `Score Δ (${WINDOW_META[changeWindow].label})` },
    { key: "median_price", label: "Median Price" },
    { key: "rent", label: "Rent (ZORI)" },
    { key: "cap_rate", label: "Cap Rate %" },
    { key: "gross_yield", label: "Gross Yield %" },
    { key: "months_of_supply", label: "Months of Supply" },
    { key: "overvalued_pct", label: "Overvalued %" },
    { key: "as_of", label: "As Of" },
  ];
  downloadCsv(
    rows as unknown as Record<string, unknown>[],
    columns,
    `screener-${geo}`,
  );
}, [canExport, rows, geo, changeWindow]);
```

Delete the now-unused module-level `CSV_COLUMNS` const (lines 44-56).

- [ ] **Step 2: Full build + lint**

Run: `npm run build --workspace=packages/frontend 2>&1 | tail -20`
Expected: build succeeds (no type/lint errors). Fix any errors before proceeding.

- [ ] **Step 3: Dispatch background validation agents (CLAUDE.md §1.6)**

Dispatch in the background: `code-reviewer` (full feature), `data-layer-reviewer` (frontend fetching), `dto-validation-auditor` (new controller route). Surface only CRITICAL/WARNING.

- [ ] **Step 4: Verify CSV export (live)**

In the running app, click Export CSV with a window selected; open the file; confirm a `Score Δ (3M)` column with signed integers (and blanks where the delta is null).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/screener/ScreenerPageInner.tsx"
git commit -m "feat(screener): include active-window Δ in CSV export"
```

---

## Self-Review

**Spec coverage:**

- Backfill not needed → confirmed in spec §2.1; plan reads existing history only (Global Constraints). ✓
- 6 Δ columns on the single table → Task 1. ✓
- Refresh after rescoring (+ staleness fix) → Task 2. ✓
- Backend sort/filter on Δ → Task 3; movers endpoint → Task 4. ✓
- Data layer fetcher/hook → Task 5. ✓
- Flat green/red helper → Task 6; window selector → Task 7. ✓
- Integrated Δ column + gainers/losers presets + Δ filter + URL window/tab → Task 8. ✓
- Movers leaderboard tab + page wiring → Task 9. ✓
- CSV Δ column + gating preserved (ZIP gate untouched, movers respects `enabled`) → Tasks 9-10. ✓
- Edge cases: NULL baseline → `—`/excluded (Task 1 Step 5, MoversTab, ScreenerTable). ✓
- File-size compliance → Task 9 Step 4. ✓
- Testing real DB / live UI → Tasks 1, 4, 9, 10. ✓

**Placeholder scan:** No TBD/"handle edge cases"/"similar to" — every step has concrete code or an exact command. ✓

**Type consistency:** `MoverWindow` ('1m'…'5y') and `WINDOW_TO_COLUMN` are defined identically in backend DTO (Task 3) and frontend helper (Task 6) and fetcher (Task 5); `score_chg_*` column names match across migration, service, fetcher, table; `ScreenerMoversResult.window` typed `MoverWindow` on the frontend, `string` on the backend return (acceptable — fetcher casts to the literal type). `getScoreChangeColor`/`formatScoreChange` signatures match their consumers. ✓
