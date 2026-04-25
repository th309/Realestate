# Score Mover Wizard — Top Movers Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual "type one market name" workflow for the Score Mover format with a data-driven leaderboard picker (gainers + losers, choose window 1mo/90d/6mo/12mo, choose geo Metro/County/ZIP) and propagate the chosen window into the script prompt and Remotion overlay.

**Architecture:** New top-level wizard mode `Top movers` alongside `Single | Batch`, score_mover-only. Backend gets one new `GET /movers/resolve` endpoint, a new `format_options` JSONB column on `content_runs`, a new `score-mover-context.queries.ts` helper, and a refactored `fetchTrendingMarkets` → `fetchTopMovers` (now takes `windowDays` + applies population floor + returns dual lists). Window propagates as `format_options.windowDays` on each run; resolved `priorDate` and `windowLabel` are snapshotted at fetch-data time (idempotently). Prompt template gains `{{window_label}}` token. Remotion `ScoreMoverLayout` reads `dataBundle.score.window_caption` and renders it above the delta.

**Tech Stack:** NestJS · class-validator DTOs · Supabase JS · Anthropic SDK · Next.js App Router · React Query · Remotion · Tailwind/M3.

**Spec:** `docs/superpowers/specs/2026-04-25-score-mover-wizard-top-movers-design.md`

---

## File map

### New files

| Path                                                                             | Purpose                                              |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- | --- | --- | ------ |
| `supabase/migrations/20260425000200_content_runs_format_options.sql`             | Add `format_options JSONB` to `content_runs`         |
| `packages/backend/src/content-pipeline/data/score-mover-config.ts`               | `SCORE_MOVER_WINDOWS` + `POPULATION_FLOOR` constants |
| `packages/backend/src/content-pipeline/data/score-mover-context.queries.ts`      | `fetchTopMovers`, `fetchScoreMoverContext`           |
| `packages/backend/src/content-pipeline/data/score-mover-context.queries.spec.ts` | Unit tests for the queries                           |
| `packages/backend/src/content-pipeline/dto/movers-resolve.dto.ts`                | Query DTO for `GET /movers/resolve`                  |
| `packages/backend/src/content-pipeline/dto/format-options.dto.ts`                | Nested DTO `{ windowDays?: 30                        | 90  | 180 | 365 }` |
| `packages/frontend/app/admin/content-pipeline/lib/movers-api.ts`                 | Client `useTopMovers` query hook                     |
| `packages/frontend/app/admin/content-pipeline/new/window-chip-picker.tsx`        | Reusable chip row for the four windows               |
| `packages/frontend/app/admin/content-pipeline/new/geo-level-radio.tsx`           | Reusable radio: Metro/County/ZIP                     |
| `packages/frontend/app/admin/content-pipeline/new/top-movers-list.tsx`           | Two-column ranked list                               |
| `packages/frontend/app/admin/content-pipeline/new/market-step-top-movers.tsx`    | Composes the panel                                   |

### Modified files

| Path                                                                                         | Change                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/backend/src/content-pipeline/data/content-data-queries.ts`                         | Delete `fetchTrendingMarkets` (moves to score-mover-context.queries.ts)                                                |
| `packages/backend/src/content-pipeline/data/content-data.service.ts`                         | Replace `getTrendingMarkets` with `getTopMovers`; add `getScoreMoverContext`                                           |
| `packages/backend/src/content-pipeline/data/content-data.service.spec.ts`                    | Update for new methods                                                                                                 |
| `packages/backend/src/content-pipeline/content-pipeline.controller.ts`                       | New `GET /movers/resolve` action with AdminGuard                                                                       |
| `packages/backend/src/content-pipeline/dto/create-run.dto.ts`                                | Add optional `formatOptions`                                                                                           |
| `packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts`                         | Add optional `formatOptions`                                                                                           |
| `packages/backend/src/content-pipeline/content-runs.service.ts`                              | Persist `format_options` on insert                                                                                     |
| `packages/backend/src/content-pipeline/batch-runs.service.ts`                                | Apply `formatOptions` to every batch row                                                                               |
| `packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.ts`      | When format=score_mover, augment snapshot with window context AND snapshot priorDate/windowLabel into `format_options` |
| `packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts`                | Substitute `{{window_label}}`                                                                                          |
| `packages/backend/src/content-pipeline/drivers/script-generator.interface.ts`                | Add optional `windowLabel` to request                                                                                  |
| `packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-script.handler.ts` | Read `format_options.windowLabel` from run, pass to script generator                                                   |
| `packages/backend/src/content-pipeline/prompts/score_mover.md`                               | Add `{{window_label}}` token (two surgical edits)                                                                      |
| `packages/video-template/src/layouts/ScoreMoverLayout.tsx`                                   | Render window caption above delta when present                                                                         |
| `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`                   | `createRun` + `createBatchRuns` accept `formatOptions`                                                                 |
| `packages/frontend/app/admin/content-pipeline/lib/batch-runs-api.ts`                         | `useCreateBatchRuns` mutation passes `formatOptions`                                                                   |
| `packages/frontend/app/admin/content-pipeline/new/page.tsx`                                  | `WizardMode` adds `top_movers`; format-aware reset + carry `formatOptions`                                             |
| `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`                           | Three-tab toggle when `format === 'score_mover'`; single-mode window chip row                                          |
| `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx`                          | Pass `formatOptions` through `createRun` / `createBatchRuns`                                                           |

---

## Phase A — Foundations

### Task A1: Migration adds `format_options` JSONB column

**Files:**

- Create: `supabase/migrations/20260425000200_content_runs_format_options.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260425000200_content_runs_format_options.sql
-- Adds format_options JSONB to content_runs so per-run render options
-- (e.g., score_mover windowDays/priorDate/windowLabel) can be persisted
-- alongside the run row. JSONB lets us extend without further migrations.
ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS format_options JSONB NOT NULL DEFAULT '{}'::jsonb;
```

- [ ] **Step 2: Apply locally**

Run: `node scripts/apply-content-pipeline-migrations.js` (or whatever the project's migration runner is — check `package.json`'s scripts; existing migrations like `20260423000200_platform_credentials.sql` were applied through that runner).

If the project uses Supabase CLI: `npx supabase migration up --local`.

Expected: migration succeeds; verify column exists:

```bash
psql "$DATABASE_URL" -c "\d content_runs" | grep format_options
```

Expected output: `format_options | jsonb | not null | '{}'::jsonb`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260425000200_content_runs_format_options.sql
git commit -m "feat(content-pipeline): add format_options column to content_runs"
```

---

### Task A2: Score-mover config constants

**Files:**

- Create: `packages/backend/src/content-pipeline/data/score-mover-config.ts`

- [ ] **Step 1: Write the constants**

```ts
// packages/backend/src/content-pipeline/data/score-mover-config.ts
/**
 * Single source of truth for the four Score Mover time windows.
 *
 * - `days`    — used to compute the prior score-date target
 * - `label`   — substituted into the script prompt as {{window_label}}
 *               (e.g. "PropertyIQ Score jumped 8 points {{window_label}}")
 * - `caption` — rendered as a small label above the delta in Remotion
 *
 * The label and caption phrasings are deliberately different: scripts speak
 * naturally ("year over year"); on-screen captions read like a chart axis
 * ("Year over year").
 */
export const SCORE_MOVER_WINDOWS = {
  30: { days: 30, label: "this month", caption: "Last 30 days" },
  90: { days: 90, label: "this quarter", caption: "Last 90 days" },
  180: { days: 180, label: "over six months", caption: "Last 6 months" },
  365: { days: 365, label: "year over year", caption: "Year over year" },
} as const;

export type ScoreMoverWindowDays = keyof typeof SCORE_MOVER_WINDOWS;

export const SCORE_MOVER_WINDOW_DAYS: ScoreMoverWindowDays[] = [
  30, 90, 180, 365,
];

/**
 * Population floor per geography level. Keeps the leaderboard from
 * surfacing tiny markets whose deltas are statistical noise rather than
 * meaningful score moves. Null population is dropped.
 */
export const POPULATION_FLOOR = {
  metro: 50_000,
  county: 10_000,
  zip: 1_000,
} as const;

export type ScoreMoverGeo = keyof typeof POPULATION_FLOOR;
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/content-pipeline/data/score-mover-config.ts
git commit -m "feat(content-pipeline): score-mover window + population-floor constants"
```

---

## Phase B — Backend data layer

### Task B1: Failing tests for `fetchTopMovers`

**Files:**

- Create: `packages/backend/src/content-pipeline/data/score-mover-context.queries.spec.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/backend/src/content-pipeline/data/score-mover-context.queries.spec.ts
import {
  fetchTopMovers,
  fetchScoreMoverContext,
} from "./score-mover-context.queries";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The Supabase client interface is wide; we only need a tiny subset.
 * This factory builds a stub that accepts a sequenced list of canned
 * responses and returns them in order — one per call to `.select(...)`
 * (or whichever terminal). It mirrors the in-memory pattern used by the
 * existing content-data.service.spec.ts.
 */
function stubClient(responses: unknown[]): SupabaseClient {
  const queue = [...responses];
  const builder: any = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    not: () => builder,
    lte: () => builder,
    gte: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => Promise.resolve(queue.shift() ?? { data: [], error: null }),
    // some calls await the builder directly
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(queue.shift() ?? { data: [], error: null }).then(
        resolve,
      );
    },
  };
  return builder as SupabaseClient;
}

describe("fetchTopMovers", () => {
  it("returns dual lists ranked by signed delta", async () => {
    const client = stubClient([
      // 1. latest score_date lookup
      { data: [{ score_date: "2026-04-25" }], error: null },
      // 2. prior score_date lookup
      { data: [{ score_date: "2026-01-25" }], error: null },
      // 3. fetchAllScoresForDate(latest)
      {
        data: [
          { location_id: "a", location_name: "Tampa, FL", score: 78 },
          { location_id: "b", location_name: "Boise, ID", score: 42 },
          { location_id: "c", location_name: "Charlotte, NC", score: 81 },
          { location_id: "d", location_name: "Tiny, XX", score: 95 },
        ],
        error: null,
      },
      { data: [], error: null }, // page-end sentinel
      // 4. fetchAllScoresForDate(prior)
      {
        data: [
          { location_id: "a", location_name: "Tampa, FL", score: 66 },
          { location_id: "b", location_name: "Boise, ID", score: 58 },
          { location_id: "c", location_name: "Charlotte, NC", score: 71 },
          { location_id: "d", location_name: "Tiny, XX", score: 50 },
        ],
        error: null,
      },
      { data: [], error: null }, // page-end sentinel
      // 5. populations
      {
        data: [
          { location_id: "a", population: 1_600_000 },
          { location_id: "b", population: 320_000 },
          { location_id: "c", population: 1_100_000 },
          { location_id: "d", population: 500 }, // below floor
        ],
        error: null,
      },
    ]);

    const out = await fetchTopMovers(client, "metro", 90, 25);

    expect(out.window).toEqual({
      latestDate: "2026-04-25",
      priorDate: "2026-01-25",
      windowDays: 90,
      requestedGeo: "metro",
    });
    // Tiny got dropped by the population floor
    expect(out.qualifiedCount).toBe(3);
    // Gainers ordered by delta desc
    expect(out.up.map((m) => m.id)).toEqual(["a", "c"]);
    expect(out.up[0].delta).toBe(12);
    expect(out.up[1].delta).toBe(10);
    // Losers ordered most-negative-first
    expect(out.down.map((m) => m.id)).toEqual(["b"]);
    expect(out.down[0].delta).toBe(-16);
  });

  it("returns null window when no prior score_date found", async () => {
    const client = stubClient([
      { data: [{ score_date: "2026-04-25" }], error: null }, // latest
      { data: [], error: null }, // prior — none on-or-before
    ]);
    const out = await fetchTopMovers(client, "zip", 30, 25);
    expect(out.window).toBeNull();
    expect(out.qualifiedCount).toBe(0);
    expect(out.up).toEqual([]);
    expect(out.down).toEqual([]);
  });

  it("breaks ties by population desc, then canonical_name asc", async () => {
    const client = stubClient([
      { data: [{ score_date: "2026-04-25" }], error: null },
      { data: [{ score_date: "2026-01-25" }], error: null },
      {
        data: [
          { location_id: "a", location_name: "Alpha, XX", score: 70 },
          { location_id: "b", location_name: "Bravo, XX", score: 70 },
          { location_id: "c", location_name: "Cervo, XX", score: 70 },
        ],
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          { location_id: "a", location_name: "Alpha, XX", score: 60 },
          { location_id: "b", location_name: "Bravo, XX", score: 60 },
          { location_id: "c", location_name: "Cervo, XX", score: 60 },
        ],
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          { location_id: "a", population: 100_000 },
          { location_id: "b", population: 1_000_000 }, // largest, tie-breaks first
          { location_id: "c", population: 100_000 }, // tied with a; name asc → a wins
        ],
        error: null,
      },
    ]);
    const out = await fetchTopMovers(client, "metro", 90, 25);
    expect(out.up.map((m) => m.id)).toEqual(["b", "a", "c"]);
  });
});

describe("fetchScoreMoverContext", () => {
  it("returns null when no prior score within window", async () => {
    const client = stubClient([
      // latest for the geo
      { data: [{ score_date: "2026-04-25", score: 78 }], error: null },
      // prior — empty
      { data: [], error: null },
    ]);
    const out = await fetchScoreMoverContext(client, "cbsa-tampa", "metro", 30);
    expect(out).toBeNull();
  });

  it("returns delta + windowLabel when prior exists", async () => {
    const client = stubClient([
      { data: [{ score_date: "2026-04-25", score: 78 }], error: null },
      { data: [{ score_date: "2026-01-25", score: 66 }], error: null },
    ]);
    const out = await fetchScoreMoverContext(client, "cbsa-tampa", "metro", 90);
    expect(out).toEqual({
      current: { score: 78, scoreDate: "2026-04-25" },
      prior: { score: 66, scoreDate: "2026-01-25" },
      delta: 12,
      windowDays: 90,
      windowLabel: "this quarter",
      windowCaption: "Last 90 days",
    });
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `npx jest packages/backend/src/content-pipeline/data/score-mover-context.queries.spec.ts`
Expected: FAIL with `Cannot find module './score-mover-context.queries'` or similar.

---

### Task B2: Implement `fetchTopMovers` and `fetchScoreMoverContext`

**Files:**

- Create: `packages/backend/src/content-pipeline/data/score-mover-context.queries.ts`

- [ ] **Step 1: Write the implementation**

```ts
// packages/backend/src/content-pipeline/data/score-mover-context.queries.ts
/**
 * Score-mover queries: leaderboard (dual top-N gainers/losers across all
 * markets at a geography level over a chosen window) and per-market
 * context (score delta over the chosen window for a specific geoId).
 *
 * Both rely on the same `propertyiq_scores` table the rest of the pipeline
 * uses. Window resolution follows the existing fetchTrendingMarkets pattern:
 *
 *   1. latestDate = max(score_date) for this geography
 *   2. priorTarget = latestDate - windowDays
 *   3. priorDate = max(score_date) where score_date <= priorTarget
 *
 * If priorDate doesn't exist, the result is null/empty — callers surface
 * the sparse-state UI rather than rendering an empty video.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  POPULATION_FLOOR,
  SCORE_MOVER_WINDOWS,
  type ScoreMoverGeo,
  type ScoreMoverWindowDays,
} from "./score-mover-config";

export interface ScoreMoverItem {
  id: string;
  canonical_name: string;
  geography: ScoreMoverGeo;
  current_score: number;
  previous_score: number;
  delta: number;
  population: number | null;
}

export interface TopMoversResult {
  window: {
    latestDate: string;
    priorDate: string;
    windowDays: ScoreMoverWindowDays;
    requestedGeo: ScoreMoverGeo;
  } | null;
  qualifiedCount: number;
  up: ScoreMoverItem[];
  down: ScoreMoverItem[];
}

interface ScoreRow {
  location_id: string;
  location_name: string;
  score: number;
}

async function fetchAllScoresForDate(
  client: SupabaseClient,
  scoringGeo: ScoreMoverGeo,
  scoreDate: string,
): Promise<ScoreRow[]> {
  const pageSize = 1000;
  let from = 0;
  const acc: ScoreRow[] = [];
  while (true) {
    const { data } = await client
      .from("propertyiq_scores")
      .select("location_id, location_name, score")
      .eq("geography", scoringGeo)
      .eq("score_type", "propertyiq")
      .eq("score_date", scoreDate)
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    acc.push(...(data as ScoreRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return acc;
}

async function resolvePriorDate(
  client: SupabaseClient,
  geo: ScoreMoverGeo,
  latestDate: string,
  windowDays: number,
): Promise<string | null> {
  const target = new Date(latestDate);
  target.setUTCDate(target.getUTCDate() - windowDays);
  const targetIso = target.toISOString().slice(0, 10);

  const { data } = await client
    .from("propertyiq_scores")
    .select("score_date")
    .eq("geography", geo)
    .eq("score_type", "propertyiq")
    .lte("score_date", targetIso)
    .order("score_date", { ascending: false })
    .limit(1);
  const prior = (data as { score_date: string }[] | null)?.[0]?.score_date;
  if (!prior || prior === latestDate) return null;
  return prior;
}

async function fetchPopulationsByLocation(
  client: SupabaseClient,
  geo: ScoreMoverGeo,
  locationIds: string[],
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (locationIds.length === 0) return out;
  // geographies table: geography_type matches geo, location_id matches.
  // population may be null on partial rows.
  const BATCH = 500;
  for (let i = 0; i < locationIds.length; i += BATCH) {
    const batch = locationIds.slice(i, i + BATCH);
    const { data } = await client
      .from("geographies")
      .select("location_id, population")
      .eq("geography_type", geo)
      .in("location_id", batch);
    for (const row of (data as
      | { location_id: string; population: number | null }[]
      | null) ?? []) {
      out.set(row.location_id, row.population);
    }
  }
  return out;
}

export async function fetchTopMovers(
  client: SupabaseClient,
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
  limit: number,
): Promise<TopMoversResult> {
  // 1. latest score_date
  const { data: latestRow } = await client
    .from("propertyiq_scores")
    .select("score_date")
    .eq("geography", geo)
    .eq("score_type", "propertyiq")
    .order("score_date", { ascending: false })
    .limit(1);
  const latestDate = (latestRow as { score_date: string }[] | null)?.[0]
    ?.score_date;
  if (!latestDate) {
    return { window: null, qualifiedCount: 0, up: [], down: [] };
  }

  // 2. prior score_date
  const priorDate = await resolvePriorDate(client, geo, latestDate, windowDays);
  if (!priorDate) {
    return { window: null, qualifiedCount: 0, up: [], down: [] };
  }

  // 3. both score sets
  const [latest, prior] = await Promise.all([
    fetchAllScoresForDate(client, geo, latestDate),
    fetchAllScoresForDate(client, geo, priorDate),
  ]);
  const priorById = new Map(prior.map((r) => [r.location_id, r]));

  // 4. populations for the union of latest IDs
  const popById = await fetchPopulationsByLocation(
    client,
    geo,
    latest.map((r) => r.location_id),
  );

  const floor = POPULATION_FLOOR[geo];

  const items: ScoreMoverItem[] = [];
  for (const row of latest) {
    const p = priorById.get(row.location_id);
    if (!p) continue;
    const pop = popById.get(row.location_id) ?? null;
    if (pop == null || pop < floor) continue;
    items.push({
      id: row.location_id,
      canonical_name: row.location_name,
      geography: geo,
      current_score: row.score,
      previous_score: p.score,
      delta: row.score - p.score,
      population: pop,
    });
  }

  const cmp = (a: ScoreMoverItem, b: ScoreMoverItem, dir: "up" | "down") => {
    const primary = dir === "up" ? b.delta - a.delta : a.delta - b.delta;
    if (primary !== 0) return primary;
    const popDelta = (b.population ?? 0) - (a.population ?? 0);
    if (popDelta !== 0) return popDelta;
    return a.canonical_name.localeCompare(b.canonical_name);
  };

  const up = items
    .filter((i) => i.delta > 0)
    .sort((a, b) => cmp(a, b, "up"))
    .slice(0, limit);
  const down = items
    .filter((i) => i.delta < 0)
    .sort((a, b) => cmp(a, b, "down"))
    .slice(0, limit);

  return {
    window: { latestDate, priorDate, windowDays, requestedGeo: geo },
    qualifiedCount: items.length,
    up,
    down,
  };
}

export interface ScoreMoverContext {
  current: { score: number; scoreDate: string };
  prior: { score: number; scoreDate: string };
  delta: number;
  windowDays: ScoreMoverWindowDays;
  windowLabel: string;
  windowCaption: string;
}

export async function fetchScoreMoverContext(
  client: SupabaseClient,
  geoId: string,
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
): Promise<ScoreMoverContext | null> {
  // Latest score for this market
  const { data: latestRow } = await client
    .from("propertyiq_scores")
    .select("score_date, score")
    .eq("geography", geo)
    .eq("score_type", "propertyiq")
    .eq("location_id", geoId)
    .order("score_date", { ascending: false })
    .limit(1);
  const latest = (
    latestRow as { score_date: string; score: number }[] | null
  )?.[0];
  if (!latest) return null;

  // Prior score within the window
  const target = new Date(latest.score_date);
  target.setUTCDate(target.getUTCDate() - windowDays);
  const targetIso = target.toISOString().slice(0, 10);

  const { data: priorRow } = await client
    .from("propertyiq_scores")
    .select("score_date, score")
    .eq("geography", geo)
    .eq("score_type", "propertyiq")
    .eq("location_id", geoId)
    .lte("score_date", targetIso)
    .order("score_date", { ascending: false })
    .limit(1);
  const prior = (
    priorRow as { score_date: string; score: number }[] | null
  )?.[0];
  if (!prior || prior.score_date === latest.score_date) return null;

  const cfg = SCORE_MOVER_WINDOWS[windowDays];
  return {
    current: { score: latest.score, scoreDate: latest.score_date },
    prior: { score: prior.score, scoreDate: prior.score_date },
    delta: latest.score - prior.score,
    windowDays,
    windowLabel: cfg.label,
    windowCaption: cfg.caption,
  };
}
```

- [ ] **Step 2: Run tests, expect pass**

Run: `npx jest packages/backend/src/content-pipeline/data/score-mover-context.queries.spec.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/content-pipeline/data/score-mover-context.queries.ts packages/backend/src/content-pipeline/data/score-mover-context.queries.spec.ts
git commit -m "feat(content-pipeline): fetchTopMovers + fetchScoreMoverContext queries"
```

---

### Task B3: Remove old `fetchTrendingMarkets`, wire facade methods

**Files:**

- Modify: `packages/backend/src/content-pipeline/data/content-data-queries.ts` (delete `fetchTrendingMarkets`)
- Modify: `packages/backend/src/content-pipeline/data/content-data.service.ts`

- [ ] **Step 1: Remove `fetchTrendingMarkets` from `content-data-queries.ts`**

Delete the `fetchAllScoresForDate` and `fetchTrendingMarkets` functions entirely (lines 14-130 of the existing file). The new score-mover-context.queries.ts owns those concerns now.

Resulting file should keep only `fetchLatestZillowMetroMetric` and `fetchTopCashflowMarkets` plus the `ScoringGeo` type re-export. Also drop the `TrendingMarketItem` import from `./content-data.types` since nothing else uses it.

- [ ] **Step 2: Replace `getTrendingMarkets` with `getTopMovers` + add `getScoreMoverContext` in the facade**

Open `packages/backend/src/content-pipeline/data/content-data.service.ts` and:

a) Update imports — remove `TrendingMarketItem` from the types import, remove `fetchTrendingMarkets` from queries, add new imports:

```ts
import { fetchTopCashflowMarkets, ScoringGeo } from "./content-data-queries";
import {
  fetchTopMovers,
  fetchScoreMoverContext,
  type TopMoversResult,
  type ScoreMoverContext,
} from "./score-mover-context.queries";
import type { ScoreMoverGeo, ScoreMoverWindowDays } from "./score-mover-config";
```

b) Replace the `getTrendingMarkets` method with `getTopMovers`:

```ts
/**
 * Return the top N PropertyIQ score gainers AND losers for a geography
 * level over the chosen window. Drops null/below-floor populations.
 * Returns `{ window: null, ... }` when no prior score date exists in the
 * window — callers should render the sparse-state UI rather than treating
 * empty arrays as "no movers".
 */
async getTopMovers(
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
  limit = 25,
): Promise<TopMoversResult> {
  return fetchTopMovers(this.supabase.getClient(), geo, windowDays, limit);
}

/**
 * Per-market window-aware delta + window labels. Used by the orchestrator
 * data-fetch step when format = score_mover so the rendered video and
 * script reflect the exact window the operator chose.
 */
async getScoreMoverContext(
  geoId: string,
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
): Promise<ScoreMoverContext | null> {
  return fetchScoreMoverContext(this.supabase.getClient(), geoId, geo, windowDays);
}
```

c) Search the codebase for any remaining callers of `getTrendingMarkets`:

```bash
grep -rn "getTrendingMarkets" packages/backend/src
```

If hits exist, replace each with `getTopMovers` and adapt the call shape (the new method returns `{ window, qualifiedCount, up, down }` not a flat list). If a caller only wanted gainers, use `result.up`; only losers, use `result.down`.

- [ ] **Step 3: Update `content-data.service.spec.ts`**

Open `packages/backend/src/content-pipeline/data/content-data.service.spec.ts` and delete every test referencing `getTrendingMarkets` (the function no longer exists). The underlying behavior is unit-tested in `score-mover-context.queries.spec.ts`; a passthrough delegation test at the facade layer would duplicate the mock surface without catching new bugs, so don't add one.

If the existing spec uses `jest.mock('./content-data-queries', ...)` and references `fetchTrendingMarkets` in the mock factory, drop that reference too — leaving a mock for a deleted function will fail TypeScript's strict mode.

- [ ] **Step 4: Run all backend tests**

Run: `npx jest packages/backend/src/content-pipeline`
Expected: PASS — old test removed/rewritten, new tests still pass, nothing else regresses.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/content-pipeline/data/content-data-queries.ts packages/backend/src/content-pipeline/data/content-data.service.ts packages/backend/src/content-pipeline/data/content-data.service.spec.ts
git commit -m "refactor(content-pipeline): replace getTrendingMarkets with getTopMovers facade"
```

---

## Phase C — Backend API surface

### Task C1: `format-options.dto.ts`

**Files:**

- Create: `packages/backend/src/content-pipeline/dto/format-options.dto.ts`

- [ ] **Step 1: Write the DTO**

```ts
// packages/backend/src/content-pipeline/dto/format-options.dto.ts
import { IsIn, IsOptional } from "class-validator";
import { SCORE_MOVER_WINDOW_DAYS } from "../data/score-mover-config";

/**
 * Per-run format-specific options. Today only score_mover uses
 * `windowDays`; other formats ignore this field.
 */
export class FormatOptionsDto {
  @IsOptional()
  @IsIn(SCORE_MOVER_WINDOW_DAYS)
  windowDays?: 30 | 90 | 180 | 365;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/content-pipeline/dto/format-options.dto.ts
git commit -m "feat(content-pipeline): FormatOptionsDto"
```

---

### Task C2: `movers-resolve.dto.ts`

**Files:**

- Create: `packages/backend/src/content-pipeline/dto/movers-resolve.dto.ts`

- [ ] **Step 1: Write the DTO**

```ts
// packages/backend/src/content-pipeline/dto/movers-resolve.dto.ts
import { IsIn, IsNotEmpty } from "class-validator";
import { Type } from "class-transformer";
import { SCORE_MOVER_WINDOW_DAYS } from "../data/score-mover-config";

/**
 * Query DTO for GET /api/admin/content-pipeline/movers/resolve.
 * Both fields required; class-validator narrows them to the allow-lists.
 */
export class MoversResolveQueryDto {
  @IsNotEmpty()
  @IsIn(["metro", "county", "zip"])
  geo!: "metro" | "county" | "zip";

  @Type(() => Number)
  @IsIn(SCORE_MOVER_WINDOW_DAYS)
  windowDays!: 30 | 90 | 180 | 365;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/content-pipeline/dto/movers-resolve.dto.ts
git commit -m "feat(content-pipeline): MoversResolveQueryDto"
```

---

### Task C3: `GET /api/admin/content-pipeline/movers/resolve`

**Files:**

- Modify: `packages/backend/src/content-pipeline/content-pipeline.controller.ts`

- [ ] **Step 1: Find the controller's existing structure**

```bash
grep -n "@Controller\|@Get\|@Post" packages/backend/src/content-pipeline/content-pipeline.controller.ts | head -30
```

Note the controller's base path and AdminGuard usage so the new action matches.

- [ ] **Step 2: Add the new action**

In `content-pipeline.controller.ts`, add this method to the controller class (place near other read endpoints, alphabetical or by feature):

```ts
@Get('movers/resolve')
@UseGuards(AdminGuard)
async resolveMovers(@Query() q: MoversResolveQueryDto) {
  const result = await this.contentData.getTopMovers(q.geo, q.windowDays, 25);
  return { data: result };
}
```

Add the imports at the top of the file:

```ts
import { MoversResolveQueryDto } from "./dto/movers-resolve.dto";
```

If `ContentDataService` isn't already injected on this controller, add it to the constructor:

```ts
constructor(
  // ...existing deps...
  private readonly contentData: ContentDataService,
) {}
```

If `ValidationPipe` for query params isn't globally configured (`enableImplicitConversion: true`), the `@Type(() => Number)` on `windowDays` won't kick in — verify by checking `main.ts`. If it isn't set, add it: `app.useGlobalPipes(new ValidationPipe({ transform: true }))`.

- [ ] **Step 3: Manual smoke**

Run the backend locally (`npm run dev:fresh` or whatever the project uses), then:

```bash
curl -H "Authorization: Bearer $ADMIN_JWT" \
  "http://localhost:3001/api/admin/content-pipeline/movers/resolve?geo=metro&windowDays=90"
```

Expected: HTTP 200, JSON body `{ data: { window: {...}, qualifiedCount: <N>, up: [...], down: [...] } }`. Both lists ≤ 25 items.

Try invalid params:

```bash
curl -H "Authorization: Bearer $ADMIN_JWT" \
  "http://localhost:3001/api/admin/content-pipeline/movers/resolve?geo=zipcode&windowDays=45"
```

Expected: HTTP 400 with class-validator messages.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/content-pipeline/content-pipeline.controller.ts
git commit -m "feat(content-pipeline): GET /movers/resolve endpoint"
```

---

### Task C4: Add `formatOptions` to create-run + create-batch-runs DTOs

**Files:**

- Modify: `packages/backend/src/content-pipeline/dto/create-run.dto.ts`
- Modify: `packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts`

- [ ] **Step 1: Read both files**

```bash
sed -n '1,80p' packages/backend/src/content-pipeline/dto/create-run.dto.ts
sed -n '1,80p' packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts
```

Note the existing import block + class shape so the addition matches style.

- [ ] **Step 2: Add `formatOptions` to `create-run.dto.ts`**

Add the import:

```ts
import { Type } from "class-transformer";
import { ValidateNested, IsOptional } from "class-validator";
import { FormatOptionsDto } from "./format-options.dto";
```

Add the field on the class:

```ts
@IsOptional()
@ValidateNested()
@Type(() => FormatOptionsDto)
formatOptions?: FormatOptionsDto;
```

- [ ] **Step 3: Same change to `create-batch-runs.dto.ts`**

The `CreateBatchRunsDto` carries a `markets` array, `format`, `approvalMode`, `platforms`. Add the same `formatOptions` field at the top-level (it applies to every run in the batch).

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/content-pipeline/dto/create-run.dto.ts packages/backend/src/content-pipeline/dto/create-batch-runs.dto.ts
git commit -m "feat(content-pipeline): formatOptions on create-run and create-batch-runs DTOs"
```

---

### Task C5: Persist `formatOptions` on insert in `content-runs.service.ts`

**Files:**

- Modify: `packages/backend/src/content-pipeline/content-runs.service.ts`

- [ ] **Step 1: Update `createRun` insert payload**

In the `.from('content_runs').insert({...})` call (around lines 51-66), add:

```ts
format_options: dto.formatOptions ?? {},
```

The full insert payload after the change:

```ts
.insert({
  format: dto.format,
  audience: template.audience,
  market_query: dto.marketQuery,
  approval_mode: dto.approvalMode ?? template.default_approval_mode,
  tts_provider: template.default_tts_provider,
  tts_voice_id: template.default_tts_voice_id,
  selected_platforms: dto.selectedPlatforms ?? template.default_platforms,
  idempotency_key: dto.idempotencyKey,
  batch_id: dto.batchId ?? null,
  status: 'queued',
  triggered_by: 'manual',
  format_options: dto.formatOptions ?? {},
})
```

- [ ] **Step 2: Same in batch-runs service**

```bash
grep -n "content_runs" packages/backend/src/content-pipeline/batch-runs.service.ts
```

Wherever `batch-runs.service.ts` inserts into `content_runs`, add `format_options: dto.formatOptions ?? {}` to each row's insert payload (typically a `.map(...)` over the markets array).

- [ ] **Step 3: Smoke via curl**

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"format":"score_mover","marketQuery":"Tampa, FL","idempotencyKey":"test-fmtopt-1","formatOptions":{"windowDays":30}}' \
  http://localhost:3001/api/admin/content-pipeline/runs

# Then verify the column was set:
psql "$DATABASE_URL" -c "select id, format, format_options from content_runs where idempotency_key='test-fmtopt-1';"
```

Expected: `format_options` column shows `{"windowDays": 30}`.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/content-pipeline/content-runs.service.ts packages/backend/src/content-pipeline/batch-runs.service.ts
git commit -m "feat(content-pipeline): persist formatOptions on run insert"
```

---

## Phase D — Window propagation through orchestration

### Task D1: Edit `score_mover.md` prompt

**Files:**

- Modify: `packages/backend/src/content-pipeline/prompts/score_mover.md`

- [ ] **Step 1: Apply the two surgical edits**

After the line `Write a {{video_duration_seconds}}-second Score Mover script for {{canonical_name}}.`, insert one new sentence:

```
The score change you are reporting is the move {{window_label}} (e.g. "this month", "year over year"). Reference that window naturally in the hook and body.
```

Modify Hook A's example to use the token. Find:

```
Hook A leads with the delta itself, using the actual number from the data bundle (e.g. "{{canonical_name}}'s PropertyIQ Score jumped [N] points this month.").
```

Replace `this month` with `{{window_label}}`:

```
Hook A leads with the delta itself, using the actual number from the data bundle (e.g. "{{canonical_name}}'s PropertyIQ Score jumped [N] points {{window_label}}.").
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/content-pipeline/prompts/score_mover.md
git commit -m "feat(content-pipeline): score_mover prompt accepts {{window_label}} token"
```

---

### Task D2: `windowLabel` flows into `ScriptGenerationRequest`

**Files:**

- Modify: `packages/backend/src/content-pipeline/drivers/script-generator.interface.ts`
- Modify: `packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts`

- [ ] **Step 1: Add `windowLabel` to the interface**

In `script-generator.interface.ts`, add to `ScriptGenerationRequest`:

```ts
// Optional window label for score_mover. When present, gets substituted
// into the prompt's {{window_label}} token. Other formats ignore it.
windowLabel?: string;
```

- [ ] **Step 2: Substitute in `AnthropicScriptGenerator`**

In `anthropic-script-generator.ts:81-93` (the `.replaceAll` chain), add a line:

```ts
.replaceAll('{{window_label}}', req.windowLabel ?? 'this quarter')
```

The default `'this quarter'` corresponds to the existing 90d default — keeps non-score_mover formats and legacy single-mode runs unchanged.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/content-pipeline/drivers/script-generator.interface.ts packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts
git commit -m "feat(content-pipeline): thread windowLabel into AnthropicScriptGenerator"
```

---

### Task D3: `generate-script.handler.ts` reads `format_options.windowLabel`

**Files:**

- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-script.handler.ts`

- [ ] **Step 1: Pull `format_options` from the run row**

In the handler, change the SELECT to include `format_options`:

```ts
const { data: run } = await client
  .from("content_runs")
  .select("format, audience, resolved_geo, format_options")
  .eq("id", runId)
  .single();
```

- [ ] **Step 2: Pass `windowLabel` to the script generator**

Just before the `this.scriptGen.generate({...})` call:

```ts
const formatOptions = (run.format_options ?? {}) as {
  windowDays?: number;
  windowLabel?: string;
  priorDate?: string;
};
```

In the `generate({...})` call, add:

```ts
windowLabel: formatOptions.windowLabel,
```

So the full call becomes:

```ts
const result = await this.scriptGen.generate({
  format: run.format,
  audience: run.audience,
  resolvedMarket: run.resolved_geo,
  dataBundle: payload.metadata,
  variantCount: 1,
  ctaText: binding?.cta_text ?? "Get your free Market Snapshot at ",
  videoDurationSeconds: fmt.duration_seconds,
  audioBudgetSeconds,
  wordBudget,
  naturalWpm: fmt.natural_wpm,
  windowLabel: formatOptions.windowLabel,
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/content-pipeline/orchestrator/job-handlers/generate-script.handler.ts
git commit -m "feat(content-pipeline): generate-script reads windowLabel from format_options"
```

---

### Task D4: `fetch-data.handler.ts` augments snapshot with score-mover context AND snapshots prior date

**Files:**

- Modify: `packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.ts`

The handler currently calls `getMarketSnapshot(resolvedGeo)` and persists the result as `mcp_payload`. For `score_mover`, we need to:

1. Read `format_options.windowDays` from the run row
2. Call `getScoreMoverContext(geoId, geo, windowDays)` — returns `null` when no prior exists
3. Merge the result into `snapshot.score` so the data bundle has `window_label`, `window_caption`, `score_delta` aligned with the chosen window
4. Snapshot `priorDate`, `windowLabel` back into `content_runs.format_options` (idempotently — only if not already present)
5. If `score_mover` and context is null, fail the run cleanly with a status reason — don't render an empty video

- [ ] **Step 1: Update the SELECT to include `format` and `format_options`**

```ts
const { data: run } = await client
  .from("content_runs")
  .select("market_query, format, format_options")
  .eq("id", runId)
  .single();
if (!run) throw new Error("run not found");
```

- [ ] **Step 2: Add score-mover augmentation block, before the `mcp_payload` insert**

After `const snapshot = await this.data.getMarketSnapshot(resolvedGeo);` and before the `content_assets` insert:

```ts
const formatOptions = (run.format_options ?? {}) as {
  windowDays?: 30 | 90 | 180 | 365;
  priorDate?: string;
  windowLabel?: string;
};

// Default windowDays for score_mover when operator didn't pick one
// (e.g., legacy single-mode submission). Stays at 90 to match prior
// behavior of the prompt and rendering.
let augmentedSnapshot: Record<string, unknown> = snapshot as unknown as Record<
  string,
  unknown
>;
let formatOptionsToPersist: typeof formatOptions | null = null;

if (run.format === "score_mover") {
  const windowDays = formatOptions.windowDays ?? 90;
  const geo = resolvedGeo.geography as "metro" | "county" | "zip";
  if (!["metro", "county", "zip"].includes(geo)) {
    throw new Error(
      `score_mover does not support geography=${geo}; resolved market is ${resolvedGeo.canonical_name}`,
    );
  }

  const ctx = await this.data.getScoreMoverContext(
    resolvedGeo.id,
    geo,
    windowDays,
  );
  if (!ctx) {
    throw new Error(
      `no_prior_score_for_window: no propertyiq score within ~${windowDays}d at ${geo} level for ${resolvedGeo.canonical_name}`,
    );
  }

  // Merge into the existing snapshot's `score` block so downstream
  // (script prompt, ScoreMoverLayout) reads from one place.
  const existingScore = (augmentedSnapshot.score ?? {}) as Record<
    string,
    unknown
  >;
  augmentedSnapshot = {
    ...augmentedSnapshot,
    score: {
      ...existingScore,
      score_delta: ctx.delta,
      previous_score: ctx.prior.score,
      previous_score_date: ctx.prior.scoreDate,
      window_days: ctx.windowDays,
      window_label: ctx.windowLabel,
      window_caption: ctx.windowCaption,
    },
  };

  // Idempotent snapshot: only write priorDate/windowLabel if not already
  // present, so re-renders against a refreshed score table don't shift
  // the delta the operator approved.
  if (!formatOptions.priorDate || !formatOptions.windowLabel) {
    formatOptionsToPersist = {
      windowDays,
      priorDate: ctx.prior.scoreDate,
      windowLabel: ctx.windowLabel,
    };
  }
}
```

- [ ] **Step 3: Persist the augmented `format_options` (when needed)**

In the existing `update({ resolved_geo: resolvedGeo })` block, change to also include `format_options` when we computed one:

```ts
const updatePayload: Record<string, unknown> = { resolved_geo: resolvedGeo };
if (formatOptionsToPersist) {
  updatePayload.format_options = formatOptionsToPersist;
}
await client.from("content_runs").update(updatePayload).eq("id", runId);
```

- [ ] **Step 4: Insert augmented snapshot, not raw snapshot**

Change:

```ts
metadata: snapshot,
```

To:

```ts
metadata: augmentedSnapshot,
```

- [ ] **Step 5: Smoke**

Insert a test run with a known geo and window:

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \
  -d '{"format":"score_mover","marketQuery":"Tampa, FL","idempotencyKey":"test-window-30","formatOptions":{"windowDays":30}}' \
  http://localhost:3001/api/admin/content-pipeline/runs

# Wait for fetch-data to run, then:
psql "$DATABASE_URL" -c "select format_options from content_runs where idempotency_key='test-window-30';"
psql "$DATABASE_URL" -c "select kind, jsonb_pretty(metadata->'score') from content_assets where run_id=(select id from content_runs where idempotency_key='test-window-30') and kind='mcp_payload';"
```

Expected:

- `format_options` shows `{"windowDays": 30, "priorDate": "...", "windowLabel": "this month"}`
- The score block contains `score_delta`, `window_label`, `window_caption`

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/content-pipeline/orchestrator/job-handlers/fetch-data.handler.ts
git commit -m "feat(content-pipeline): score-mover window context + idempotent priorDate snapshot"
```

---

## Phase E — Remotion template

### Task E1: `ScoreMoverLayout` renders window caption

**Files:**

- Modify: `packages/video-template/src/layouts/ScoreMoverLayout.tsx`
- Modify: `packages/video-template/tests/score-mover.test.tsx` (regenerate snapshots after change)

- [ ] **Step 1: Read window_caption from the data bundle**

In `ScoreMoverLayout.tsx`, after the existing `scoreObj` and `delta` extraction:

```ts
const windowCaption =
  (scoreObj as { window_caption?: string }).window_caption ?? "";
```

- [ ] **Step 2: Render the caption above the delta**

Inside the `<Sequence from={150} durationInFrames={300}>` block, immediately above `<DeltaDisplay delta={delta} />`, add:

```tsx
{
  windowCaption ? (
    <div
      style={{
        color: "#C5CAE9",
        fontFamily: "Roboto Mono",
        fontSize: 22,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        opacity: 0.85,
      }}
    >
      {windowCaption}
    </div>
  ) : null;
}
```

The conditional ensures legacy/test fixtures without `window_caption` render unchanged.

- [ ] **Step 3: Update score_delta typing in ScoreMoverLayout**

Update the local type narrow at the top of the component:

```ts
const scoreObj = (bundle.score ?? {}) as {
  propertyiq_score?: number;
  score_delta?: number;
  window_caption?: string;
};
```

- [ ] **Step 4: Run existing snapshot tests**

```bash
npx jest packages/video-template/tests/score-mover.test.tsx
```

Expected: existing snapshots fail because the rendered output now includes the caption when test fixtures provide one. Either:

- The fixture didn't provide `window_caption` → render unchanged → tests pass
- Or the fixture did → snapshots need regenerating

- [ ] **Step 5: Update fixture + regenerate**

Open `packages/video-template/tests/score-mover.test.tsx`. Find the test fixture and add `window_caption` to the score block:

```ts
score: {
  propertyiq_score: 78,
  score_delta: 12,
  window_caption: 'Last 90 days',
  // ...existing fields
},
```

Then regenerate the snapshots:

```bash
npx jest packages/video-template/tests/score-mover.test.tsx -u
```

Verify the new PNG snapshots actually show the caption (open the generated PNGs in `tests/__snapshots__/`).

- [ ] **Step 6: Commit**

```bash
git add packages/video-template/src/layouts/ScoreMoverLayout.tsx packages/video-template/tests/score-mover.test.tsx packages/video-template/tests/__snapshots__/score-mover-*.png
git commit -m "feat(video-template): score-mover window caption above delta"
```

---

## Phase F — Frontend client

### Task F1: `movers-api.ts` with `useTopMovers` hook

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/lib/movers-api.ts`

- [ ] **Step 1: Write the client + hook**

```ts
// packages/frontend/app/admin/content-pipeline/lib/movers-api.ts
import { useQuery } from "@tanstack/react-query";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export type ScoreMoverGeo = "metro" | "county" | "zip";
export type ScoreMoverWindowDays = 30 | 90 | 180 | 365;

export interface ScoreMoverItem {
  id: string;
  canonical_name: string;
  geography: ScoreMoverGeo;
  current_score: number;
  previous_score: number;
  delta: number;
  population: number | null;
}

export interface TopMoversResponse {
  window: {
    latestDate: string;
    priorDate: string;
    windowDays: ScoreMoverWindowDays;
    requestedGeo: ScoreMoverGeo;
  } | null;
  qualifiedCount: number;
  up: ScoreMoverItem[];
  down: ScoreMoverItem[];
}

export async function fetchTopMovers(
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
): Promise<TopMoversResponse> {
  const url = `/api/admin/content-pipeline/movers/resolve?geo=${geo}&windowDays=${windowDays}`;
  const res = await fetchAPIRaw(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchTopMovers failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: TopMoversResponse };
  return json.data;
}

export function useTopMovers(
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
) {
  return useQuery({
    queryKey: ["top-movers", geo, windowDays],
    queryFn: () => fetchTopMovers(geo, windowDays),
    staleTime: 5 * 60 * 1000, // 5 min — score data refreshes infrequently
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/lib/movers-api.ts
git commit -m "feat(content-pipeline): useTopMovers React Query hook"
```

---

## Phase G — Frontend UI primitives

### Task G1: `window-chip-picker.tsx`

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/window-chip-picker.tsx`

- [ ] **Step 1: Write the component**

```tsx
// packages/frontend/app/admin/content-pipeline/new/window-chip-picker.tsx
"use client";
import type { ScoreMoverWindowDays } from "../lib/movers-api";

const WINDOWS: { days: ScoreMoverWindowDays; label: string }[] = [
  { days: 30, label: "1mo" },
  { days: 90, label: "90d" },
  { days: 180, label: "6mo" },
  { days: 365, label: "12mo" },
];

export function WindowChipPicker({
  value,
  onChange,
}: {
  value: ScoreMoverWindowDays;
  onChange: (v: ScoreMoverWindowDays) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full bg-surface-container-low p-1"
      role="radiogroup"
      aria-label="Time window"
    >
      {WINDOWS.map((w) => {
        const active = value === w.days;
        return (
          <button
            key={w.days}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(w.days)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {w.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/window-chip-picker.tsx
git commit -m "feat(content-pipeline): WindowChipPicker primitive"
```

---

### Task G2: `geo-level-radio.tsx`

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/geo-level-radio.tsx`

- [ ] **Step 1: Write the component**

```tsx
// packages/frontend/app/admin/content-pipeline/new/geo-level-radio.tsx
"use client";
import type { ScoreMoverGeo } from "../lib/movers-api";

const LEVELS: { value: ScoreMoverGeo; label: string }[] = [
  { value: "metro", label: "Metro" },
  { value: "county", label: "County" },
  { value: "zip", label: "ZIP" },
];

export function GeoLevelRadio({
  value,
  onChange,
}: {
  value: ScoreMoverGeo;
  onChange: (v: ScoreMoverGeo) => void;
}) {
  return (
    <div
      className="inline-flex gap-2"
      role="radiogroup"
      aria-label="Geography level"
    >
      {LEVELS.map((l) => {
        const active = value === l.value;
        return (
          <label
            key={l.value}
            className={`px-4 py-1.5 rounded-full border text-sm font-semibold cursor-pointer transition-colors duration-200 ${
              active
                ? "bg-secondary-container text-on-secondary-container border-transparent"
                : "bg-surface text-on-surface border-outline hover:bg-surface-container-low"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              checked={active}
              onChange={() => onChange(l.value)}
            />
            {l.label}
          </label>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/geo-level-radio.tsx
git commit -m "feat(content-pipeline): GeoLevelRadio primitive"
```

---

### Task G3: `top-movers-list.tsx`

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/top-movers-list.tsx`

- [ ] **Step 1: Write the component**

```tsx
// packages/frontend/app/admin/content-pipeline/new/top-movers-list.tsx
"use client";
import type { ScoreMoverItem } from "../lib/movers-api";

function formatPop(pop: number | null): string {
  if (pop == null) return "—";
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${Math.round(pop / 1_000)}K`;
  return String(pop);
}

interface ColumnProps {
  title: string;
  arrow: "▲" | "▼";
  items: ScoreMoverItem[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
}

function MoversColumn({
  title,
  arrow,
  items,
  checkedIds,
  onToggle,
}: ColumnProps) {
  return (
    <div className="flex-1 rounded-xl bg-surface-container-low p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-outline mb-3">
        {arrow} {title} (top {items.length})
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-outline italic">
          No qualifying markets.
        </div>
      ) : (
        <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
          {items.map((m) => {
            const checked = checkedIds.has(m.id);
            const sign = m.delta > 0 ? "+" : "";
            return (
              <li
                key={m.id}
                className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                  checked
                    ? "bg-secondary-container/40"
                    : "hover:bg-surface-container"
                }`}
                onClick={() => onToggle(m.id)}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(m.id)}
                  className="mt-1"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {m.canonical_name}
                  </div>
                  <div className="text-xs text-on-surface-variant font-mono">
                    {m.current_score} ← {m.previous_score} · {sign}
                    {m.delta} · pop {formatPop(m.population)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TopMoversList({
  up,
  down,
  checkedIds,
  onToggle,
}: {
  up: ScoreMoverItem[];
  down: ScoreMoverItem[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex gap-4">
      <MoversColumn
        title="Gainers"
        arrow="▲"
        items={up}
        checkedIds={checkedIds}
        onToggle={onToggle}
      />
      <MoversColumn
        title="Losers"
        arrow="▼"
        items={down}
        checkedIds={checkedIds}
        onToggle={onToggle}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/top-movers-list.tsx
git commit -m "feat(content-pipeline): TopMoversList two-column ranked list"
```

---

### Task G4: `market-step-top-movers.tsx`

**Files:**

- Create: `packages/frontend/app/admin/content-pipeline/new/market-step-top-movers.tsx`

- [ ] **Step 1: Write the panel**

```tsx
// packages/frontend/app/admin/content-pipeline/new/market-step-top-movers.tsx
"use client";
import { useEffect, useState } from "react";
import type { BatchMarket } from "../lib/batch-runs-api";
import {
  useTopMovers,
  type ScoreMoverGeo,
  type ScoreMoverWindowDays,
} from "../lib/movers-api";
import { WindowChipPicker } from "./window-chip-picker";
import { GeoLevelRadio } from "./geo-level-radio";
import { TopMoversList } from "./top-movers-list";

const PRECHECK_PER_SIDE = 10;

function formatHumanDate(iso: string): string {
  // 2026-04-25 → Apr 25 2026
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function MarketStepTopMovers({
  windowDays,
  geo,
  onWindowChange,
  onGeoChange,
  onPick,
}: {
  windowDays: ScoreMoverWindowDays;
  geo: ScoreMoverGeo;
  onWindowChange: (w: ScoreMoverWindowDays) => void;
  onGeoChange: (g: ScoreMoverGeo) => void;
  onPick: (markets: BatchMarket[], windowDays: ScoreMoverWindowDays) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useTopMovers(
    geo,
    windowDays,
  );
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Pre-check top N each side on every (geo, windowDays) change
  useEffect(() => {
    if (!data) {
      setCheckedIds(new Set());
      return;
    }
    const next = new Set<string>();
    for (const m of data.up.slice(0, PRECHECK_PER_SIDE)) next.add(m.id);
    for (const m of data.down.slice(0, PRECHECK_PER_SIDE)) next.add(m.id);
    setCheckedIds(next);
  }, [data]);

  function toggleId(id: string) {
    setCheckedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleNext() {
    if (!data) return;
    const all = [...data.up, ...data.down];
    const picked: BatchMarket[] = all
      .filter((m) => checkedIds.has(m.id))
      .map((m) => ({ id: m.id, geography: m.geography }));
    onPick(picked, windowDays);
  }

  const upCount = data ? data.up.filter((m) => checkedIds.has(m.id)).length : 0;
  const downCount = data
    ? data.down.filter((m) => checkedIds.has(m.id)).length
    : 0;
  const checkedCount = upCount + downCount;
  const noWindow = data?.window === null;
  const sparseBoth =
    !!data && data.window && data.up.length < 5 && data.down.length < 5;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-on-surface-variant mb-1">
            Window
          </div>
          <WindowChipPicker value={windowDays} onChange={onWindowChange} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-on-surface-variant mb-1">
            Geography level
          </div>
          <GeoLevelRadio value={geo} onChange={onGeoChange} />
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">
          Resolving leaderboard…
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-error-container/40 p-4 text-sm flex items-center gap-3">
          <span>
            Couldn&apos;t fetch top movers:{" "}
            <span className="font-mono text-xs">
              {(error as Error)?.message}
            </span>
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-auto text-xs px-3 py-1 rounded-full bg-primary text-on-primary"
          >
            Retry
          </button>
        </div>
      )}

      {data && noWindow && (
        <div className="rounded-xl bg-surface-container-low p-6 text-sm">
          No score history within ~{windowDays} days at {geo} level. Try a
          longer window.
        </div>
      )}

      {data && data.window && (
        <>
          <div className="text-xs text-on-surface-variant">
            Comparing {formatHumanDate(data.window.latestDate)} vs{" "}
            {formatHumanDate(data.window.priorDate)} · {data.qualifiedCount}{" "}
            {geo}s qualify
          </div>

          {sparseBoth && (
            <div className="text-xs text-warning">
              Sparse coverage at this window/geo. Consider widening.
            </div>
          )}

          <TopMoversList
            up={data.up}
            down={data.down}
            checkedIds={checkedIds}
            onToggle={toggleId}
          />

          <div className="flex justify-between items-center">
            <div className="text-sm text-on-surface-variant">
              {checkedCount} selected ({upCount} ▲ · {downCount} ▼)
            </div>
            <button
              type="button"
              onClick={handleNext}
              disabled={checkedCount === 0}
              className="bg-primary text-on-primary rounded-full px-8 py-3 font-semibold disabled:opacity-50"
            >
              Next ({checkedCount} run{checkedCount === 1 ? "" : "s"})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/market-step-top-movers.tsx
git commit -m "feat(content-pipeline): MarketStepTopMovers panel composition"
```

---

## Phase H — Frontend wizard wiring

### Task H1: Extend `WizardMode` and thread `formatOptions` through `page.tsx`

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/page.tsx`

- [ ] **Step 1: Update the page component**

Replace the existing file:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormatStep } from "./format-step";
import { MarketStep } from "./market-step";
import { ConfirmStep } from "./confirm-step";
import type { BatchMarket } from "../lib/batch-runs-api";
import type { ScoreMoverGeo, ScoreMoverWindowDays } from "../lib/movers-api";

export type WizardMode = "single" | "batch" | "top_movers";

export interface WizardFormatOptions {
  windowDays?: ScoreMoverWindowDays;
}

export default function NewRunPage() {
  const [step, setStep] = useState<"format" | "market" | "confirm">("format");
  const [format, setFormat] = useState<string>("");
  const [mode, setMode] = useState<WizardMode>("single");
  const [market, setMarket] = useState<string>("");
  const [batchMarkets, setBatchMarkets] = useState<BatchMarket[]>([]);
  const [formatOptions, setFormatOptions] = useState<WizardFormatOptions>({});
  const [topMoversGeo, setTopMoversGeo] = useState<ScoreMoverGeo>("metro");
  const router = useRouter();

  function handleFormatPick(f: string) {
    setFormat(f);
    // Reset top_movers to single when picking a non-score_mover format
    if (f !== "score_mover" && mode === "top_movers") setMode("single");
    if (f !== "score_mover") {
      setBatchMarkets([]);
      setFormatOptions({});
    }
    setStep("market");
  }

  return (
    <div>
      {step === "format" && <FormatStep onPick={handleFormatPick} />}
      {step === "market" && (
        <MarketStep
          format={format}
          mode={mode}
          onModeChange={setMode}
          onBack={() => setStep("format")}
          formatOptions={formatOptions}
          onFormatOptionsChange={setFormatOptions}
          topMoversGeo={topMoversGeo}
          onTopMoversGeoChange={setTopMoversGeo}
          onPickSingle={(m) => {
            setMarket(m);
            setStep("confirm");
          }}
          onPickBatch={(markets) => {
            setBatchMarkets(markets);
            setStep("confirm");
          }}
          onPickTopMovers={(markets, windowDays) => {
            setBatchMarkets(markets);
            setFormatOptions({ windowDays });
            setStep("confirm");
          }}
        />
      )}
      {step === "confirm" && (
        <ConfirmStep
          format={format}
          mode={mode}
          market={market}
          batchMarkets={batchMarkets}
          formatOptions={formatOptions}
          onBack={() => setStep("market")}
          onCreatedSingle={(id) =>
            router.push(`/admin/content-pipeline/runs/${id}`)
          }
          onCreatedBatch={(batchId) =>
            router.push(`/admin/content-pipeline?batch=${batchId}`)
          }
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/page.tsx
git commit -m "feat(content-pipeline): WizardMode top_movers + formatOptions threading"
```

---

### Task H2: `market-step.tsx` adds Top movers tab + single-mode window chip

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/market-step.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";
import { useState } from "react";
import { resolveMarket } from "../lib/content-pipeline-api";
import type { BatchMarket } from "../lib/batch-runs-api";
import type { ScoreMoverGeo, ScoreMoverWindowDays } from "../lib/movers-api";
import type { WizardFormatOptions, WizardMode } from "./page";
import { MarketStepBatch } from "./market-step-batch";
import { MarketStepTopMovers } from "./market-step-top-movers";
import { WindowChipPicker } from "./window-chip-picker";

interface MarketMatch {
  id: string;
  canonical_name: string;
  geography: string;
  state?: string;
}

export function MarketStep({
  format,
  mode,
  onModeChange,
  formatOptions,
  onFormatOptionsChange,
  topMoversGeo,
  onTopMoversGeoChange,
  onPickSingle,
  onPickBatch,
  onPickTopMovers,
  onBack,
}: {
  format: string;
  mode: WizardMode;
  onModeChange: (mode: WizardMode) => void;
  formatOptions: WizardFormatOptions;
  onFormatOptionsChange: (opts: WizardFormatOptions) => void;
  topMoversGeo: ScoreMoverGeo;
  onTopMoversGeoChange: (g: ScoreMoverGeo) => void;
  onPickSingle: (market: string) => void;
  onPickBatch: (markets: BatchMarket[]) => void;
  onPickTopMovers: (
    markets: BatchMarket[],
    windowDays: ScoreMoverWindowDays,
  ) => void;
  onBack: () => void;
}) {
  const isScoreMover = format === "score_mover";
  const windowDays = formatOptions.windowDays ?? 90;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={onBack} className="text-sm text-primary mb-4">
        Back
      </button>
      <h1 className="text-2xl font-semibold mb-6">Pick a market</h1>

      <ModeToggle
        mode={mode}
        onChange={onModeChange}
        showTopMovers={isScoreMover}
      />

      {isScoreMover && mode === "single" && (
        <div className="mb-6 flex items-center gap-3">
          <span className="text-xs uppercase tracking-wide text-on-surface-variant">
            Window
          </span>
          <WindowChipPicker
            value={windowDays}
            onChange={(w) =>
              onFormatOptionsChange({ ...formatOptions, windowDays: w })
            }
          />
        </div>
      )}

      {mode === "single" && <SingleMarketBody onPick={onPickSingle} />}
      {mode === "batch" && <MarketStepBatch onPick={onPickBatch} />}
      {mode === "top_movers" && (
        <MarketStepTopMovers
          windowDays={windowDays}
          geo={topMoversGeo}
          onWindowChange={(w) =>
            onFormatOptionsChange({ ...formatOptions, windowDays: w })
          }
          onGeoChange={onTopMoversGeoChange}
          onPick={onPickTopMovers}
        />
      )}
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
  showTopMovers,
}: {
  mode: WizardMode;
  onChange: (m: WizardMode) => void;
  showTopMovers: boolean;
}) {
  const modes: WizardMode[] = showTopMovers
    ? ["single", "batch", "top_movers"]
    : ["single", "batch"];
  const labels: Record<WizardMode, string> = {
    single: "Single market",
    batch: "Batch",
    top_movers: "Top movers",
  };
  return (
    <div
      className="inline-flex rounded-full bg-surface-container-low p-1 mb-6"
      role="radiogroup"
    >
      {modes.map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors duration-200 ${
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {labels[m]}
          </button>
        );
      })}
    </div>
  );
}

function SingleMarketBody({ onPick }: { onPick: (market: string) => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<MarketMatch[]>([]);

  async function handleChange(v: string) {
    setQuery(v);
    if (v.length < 2) {
      setMatches([]);
      return;
    }
    const m = await resolveMarket(v);
    setMatches(m as MarketMatch[]);
  }

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Cleveland, Miami, 78704..."
        className="w-full rounded-full border border-outline-variant px-6 py-4 text-lg"
        autoFocus
      />
      <div className="mt-4 space-y-2">
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.canonical_name)}
            className="block w-full text-left p-4 rounded-lg hover:bg-surface-container-low"
          >
            <div className="font-medium">{m.canonical_name}</div>
            <div className="text-xs text-outline">
              {m.geography} {m.state ? `, ${m.state}` : ""}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/market-step.tsx
git commit -m "feat(content-pipeline): three-tab market step + single-mode window chip"
```

---

### Task H3: `confirm-step.tsx` passes `formatOptions` through

**Files:**

- Modify: `packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx`
- Modify: `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`
- Modify: `packages/frontend/app/admin/content-pipeline/lib/batch-runs-api.ts`

- [ ] **Step 1: Extend `createRun` API client to accept `formatOptions`**

Open `packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts`. Find the `createRun` function. Add `formatOptions?: { windowDays?: 30 | 90 | 180 | 365 }` to its argument type, and pass it through to the body:

```ts
export async function createRun(args: {
  format: string;
  marketQuery: string;
  idempotencyKey: string;
  approvalMode?: 'auto' | 'review' | 'draft';
  selectedPlatforms?: string[];
  formatOptions?: { windowDays?: 30 | 90 | 180 | 365 };
}): Promise<{ id: string }> {
  // ...existing fetch...
  body: JSON.stringify({
    format: args.format,
    marketQuery: args.marketQuery,
    idempotencyKey: args.idempotencyKey,
    approvalMode: args.approvalMode,
    selectedPlatforms: args.selectedPlatforms,
    formatOptions: args.formatOptions,
  }),
}
```

- [ ] **Step 2: Same for batch-runs-api.ts**

The `useCreateBatchRuns` mutation's `mutateAsync` shape — add `formatOptions` to the request body.

- [ ] **Step 3: Update `confirm-step.tsx`**

Add `formatOptions` to props:

```ts
formatOptions: { windowDays?: 30 | 90 | 180 | 365 };
```

In `submitSingle`, pass it through:

```ts
const result = await createRun({
  format,
  marketQuery: market,
  idempotencyKey,
  approvalMode,
  selectedPlatforms,
  formatOptions,
});
```

In `submitBatch`, same:

```ts
const result = await batchMutation.mutateAsync({
  format,
  markets: batchMarkets,
  approvalMode,
  platforms: selectedPlatforms,
  formatOptions,
});
```

If `formatOptions.windowDays` is set, also surface it in the summary text. In the `outcomeLine`/`publishLine` area, add:

```ts
const windowLine = formatOptions.windowDays
  ? `Window: ${windowLabelFor(formatOptions.windowDays)}`
  : null;
```

Helper at the top of the file:

```ts
function windowLabelFor(days: 30 | 90 | 180 | 365): string {
  return (
    { 30: "1 month", 90: "90 days", 180: "6 months", 365: "12 months" } as const
  )[days];
}
```

Render `windowLine` near `publishLine` in the existing summary block:

```tsx
{
  windowLine && <p className="text-xs text-outline mt-1">{windowLine}</p>;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/admin/content-pipeline/new/confirm-step.tsx packages/frontend/app/admin/content-pipeline/lib/content-pipeline-api.ts packages/frontend/app/admin/content-pipeline/lib/batch-runs-api.ts
git commit -m "feat(content-pipeline): formatOptions threaded through confirm-step + API clients"
```

---

## Phase I — End-to-end verification

### Task I1: Local end-to-end smoke (top movers happy path)

**Files:** none (verification only)

- [ ] **Step 1: Start the stack**

```bash
npm run dev:fresh
```

Wait for both backend (`API running on :3001`) and frontend (`localhost:3000`) to be ready.

- [ ] **Step 2: Walk the wizard**

1. Open `http://localhost:3000/admin/content-pipeline/new`
2. Pick `Score Mover` from the format step
3. On the market step, click `Top movers` tab
4. Confirm the layout: `Window` chip row (90d default), `Geography level` radio (Metro default), then "Comparing X vs Y" header, two columns (Gainers / Losers), top 10 each pre-checked, footer counter `20 selected (10 ▲ · 10 ▼)`, Next button shows `Next (20 runs)`
5. Click Next → confirm step shows window line ("Window: 90 days"), 20 runs in the batch banner
6. Submit → land on `/admin/content-pipeline?batch=...`

Expected: 20 rows in `content_runs` with `format = 'score_mover'`, all share a `batch_id`, each has `format_options.windowDays = 90`.

Verify:

```bash
psql "$DATABASE_URL" -c "select count(*), format, format_options->>'windowDays' from content_runs where batch_id=(select id from content_batches order by created_at desc limit 1) group by format, format_options->>'windowDays';"
```

- [ ] **Step 3: Verify fetch-data snapshots window correctly**

Pick one run id from the batch, then:

```bash
psql "$DATABASE_URL" -c "select format_options from content_runs where id='<run-id>';"
```

Expected: `{"windowDays": 90, "priorDate": "<date>", "windowLabel": "this quarter"}` after fetch-data has run on that row.

```bash
psql "$DATABASE_URL" -c "select jsonb_pretty(metadata->'score') from content_assets where run_id='<run-id>' and kind='mcp_payload';"
```

Expected: contains `score_delta`, `window_label`, `window_caption`, `previous_score`, `previous_score_date`.

- [ ] **Step 4: Commit (if ad-hoc fixes were needed)**

If the smoke surfaced bugs and you fixed them, commit each fix as a small, focused commit referencing the symptom.

---

### Task I2: Render verification (caption appears in video)

**Files:** none (verification only)

- [ ] **Step 1: Wait for one run to render**

Pick a run id from the batch above. Watch the run progress in the orchestrator logs or in `/admin/content-pipeline/runs/<id>`. Wait for status `pending_review` or `published`.

- [ ] **Step 2: Open the rendered MP4**

From `/admin/content-pipeline/runs/<id>`, open the artifacts panel and play the rendered video. Scrub to the score-delta beat (around 5-15s in).

Expected: above the big delta number, a small uppercase label reads `LAST 90 DAYS` (the caption from `SCORE_MOVER_WINDOWS[90].caption`).

- [ ] **Step 3: Verify the script narrates the window**

Open the script asset (line `kind = 'script'` for that run). Read the hook field.

Expected: text along the lines of `"<Market>'s PropertyIQ Score jumped N points this quarter."` (uses `windowLabel = 'this quarter'` for the 90d window).

---

### Task I3: Sparse-state verification

**Files:** none (verification only)

- [ ] **Step 1: Trigger a sparse window**

From the wizard's Top movers tab, switch geo to `ZIP` and window to `1mo`. Depending on score-data cadence at ZIP level, this often returns no prior date.

Expected: blocking message renders: _"No score history within ~30 days at zip level. Try a longer window."_ No leaderboard, no Next button enabled.

- [ ] **Step 2: Switch back to a working combination**

Pick `90d` or `12mo` at ZIP. Leaderboard should re-populate (assuming data exists).

---

### Task I4: Single-mode score_mover with explicit window

**Files:** none (verification only)

- [ ] **Step 1: Walk single-mode flow**

1. `New` → `Score Mover` → `Single market` tab
2. Confirm a "Window" chip row is visible above the search input, default 90d
3. Pick `1mo`
4. Type "Tampa, FL" → pick the metro
5. Confirm step: window line reads `"Window: 1 month"`
6. Submit → run created with `format_options.windowDays = 30`

- [ ] **Step 2: Verify the row in DB**

```bash
psql "$DATABASE_URL" -c "select format_options from content_runs order by created_at desc limit 1;"
```

Expected: `{"windowDays": 30, ...}` — and after fetch-data, the priorDate/windowLabel snapshot is added.

- [ ] **Step 3: Format switch clears state**

Walk: `Score Mover` → `Top movers` tab → select 5 markets → go back to format step → pick `Grade Reveal`.

Expected: `Top movers` tab is gone (only `Single | Batch` show); previously-checked markets are cleared.

- [ ] **Step 4: No-prior-window failure surfaces clearly**

Spec edge case #8 says single-mode with no prior score for the chosen window should "fail gracefully with toast at submit". This plan deliberately deviates: the run is **created**, then **fetch-data fails** with `status_reason = 'no_prior_score_for_window: ...'`. The operator sees the failure on `/admin/content-pipeline/runs/<id>` rather than at submit.

Rationale for the deviation: a synchronous pre-flight check would require a new endpoint (`/api/admin/content-pipeline/score-mover/preflight?geoId=&windowDays=`) that resolves the market and calls `getScoreMoverContext` before insert — net new surface for an edge case that's loud-failing already. Reassess after a few weeks of operator usage; if the false-start rate is meaningfully painful, add the pre-flight in a follow-up.

To verify: pick `1mo` window in single mode and search for a ZIP that often has no recent score. Submit. Open the resulting run page within ~30s and confirm:

- Status is `failed`
- `status_reason` field reads `no_prior_score_for_window: ...`
- No assets were rendered (no audio, no video)

---

### Task I5: All tests green

- [ ] **Step 1: Run backend unit tests**

```bash
npx jest packages/backend/src/content-pipeline
```

Expected: PASS — including `score-mover-context.queries.spec.ts`.

- [ ] **Step 2: Run video-template tests**

```bash
npx jest packages/video-template
```

Expected: PASS — score-mover snapshot tests pass (regenerated in Task E1).

- [ ] **Step 3: Run frontend type-check**

```bash
cd packages/frontend && npx tsc --noEmit
```

Expected: no errors. New WizardMode literal types must align across page → market-step → confirm-step.

- [ ] **Step 4: Final acceptance checklist (against spec section "Acceptance criteria")**

Walk through each of the 9 acceptance criteria from the spec and tick them off:

- [ ] 1. Operator picks score_mover → Top movers → window=6mo → geo=Metro → sees two ranked lists with up to 25 rows each (or sparse-state), top 10 each side pre-checked.
- [ ] 2. Submit with 20 markets creates 20 batch runs in content_runs, each with format_options carrying windowDays + priorDate + windowLabel.
- [ ] 3. One rendered video viewed end-to-end shows the window caption above the delta and the script narrates the window.
- [ ] 4. Switching format away from score_mover collapses the Top movers tab and clears selection.
- [ ] 5. Single-mode score_mover with the new window chip end-to-end renders with the chosen window.
- [ ] 6. Sparse window shows the blocking message; no empty render produced.
- [ ] 7. Endpoint returns deterministic results across two calls.
- [ ] 8. All new + extended tests pass; existing score_mover snapshots regenerated.
- [ ] 9. Migration applied and verified on local Supabase.

- [ ] **Step 5: Commit any final adjustments + push branch**

```bash
git push origin feat/content-pipeline-p3-ranking
```
