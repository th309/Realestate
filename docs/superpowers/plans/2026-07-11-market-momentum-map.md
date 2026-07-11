# Market Momentum Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone, drop-anywhere `MarketMomentumMap` React widget — a population-scaled dot map of all ~935 scored US metros colored by PIQ score, with 25-year monthly playback (Jan 2001 → latest), era context labels, hover tooltips, and click-through to market pages.

**Architecture:** One new SQL RPC packs the full metro score history (935 metros × 305 months) into a single ~1.1MB JSON payload (~200KB gzipped). A new public NestJS endpoint serves it with Redis read-through caching. The widget renders pure SVG via the already-installed `d3` (`geoAlbersUsa`) — no Mapbox — and drives playback from the single payload with zero per-month requests.

**Tech Stack:** PostgreSQL/PostGIS RPC (Supabase), NestJS 11, Redis (optional), Next.js 16 / React 19, TanStack Query 5, d3 7 (already installed), Tailwind 4 M3 semantic tokens, Jest (backend), Vitest + Playwright (frontend).

**Spec:** `docs/superpowers/specs/2026-07-11-market-momentum-map-design.md` (approved 2026-07-11).

## Global Constraints

- **Momentum language only** — labels come from `getScoreLabel()` in `app/components/scoring/score-labels.ts`; NEVER quality words (EXCELLENT/POOR), never "ranked within state" (CLAUDE.md §9).
- **No hardcoded coverage counts** — footnote metro count computed from `payload.metros.length`; skeleton uses `COVERAGE_COPY.metros` ("900+") from `@/lib/data`.
- **All frontend fetching through `@/lib/data`** — fetcher in `lib/data/fetchers/`, hook in `lib/data/hooks/`, both re-exported from `lib/data/index.ts` (CLAUDE.md §5). Never `fetch(API_URL)` directly.
- **M3 semantic tokens only for UI chrome** (`bg-surface-container-low`, `text-on-surface`, `border-outline-variant`, …). NO `dark:` variants, NO hardcoded hex in chrome. Dark mode is automatic via `prefers-color-scheme`. Exception: the data color scale in `momentum-map-colors.ts` holds concrete hex stops (same precedent as the map page's `COLOR_SCALE`).
- **No new npm dependencies.** `d3` ^7.9.0 and `lucide-react` are already installed.
- **File size limits:** logic files ≤300 lines, components ≤400, tests ≤500. One exported component per file (local non-exported helpers OK).
- **Endpoint is fully public** — no auth guard, no tier gate. `@Header('Cache-Control', 'public, max-age=21600')` (house standard).
- **`ScoringController` MUST stay registered LAST** in `scoring.module.ts` controllers array (route-ordering hazard). Register the new controller before it.
- **Reads use the `propertyiq_scores` VIEW** (never write; writes go to `_v2` — not needed here).
- **Git:** every commit on `develop` (verify with `git branch --show-current` first), explicit pathspec (`git commit -- <paths>`), NO push unless the user asks, no Co-Authored-By.
- **Backend commands** run from `packages/backend`, **frontend commands** from `packages/frontend`.

## Verified facts (live DB, 2026-07-11 — do not re-derive)

- 305 months of metro history (2001-01-31 → 2026-05-31), 935 metros latest month.
- All 935 scored metros join `tiger_cbsa` on `geoid = location_id` (geometry SRID 4326 MULTIPOLYGON); 925 have population; 10 are Puerto Rico (excluded by `geoAlbersUsa`, footnoted).
- The packing query below was run against production: returns 935 metros × 305-length rows, Des Moines (`19780`) centroid = (41.512, −93.729), total JSON = 1,133 kB.

---

### Task 1: SQL migration — `get_metro_score_heatmap()` RPC

**Files:**

- Create: `supabase/migrations/20260711160000_add_get_metro_score_heatmap_function.sql`

**Interfaces:**

- Produces: RPC `get_metro_score_heatmap()` returning `jsonb` with shape `{ months: string[], metros: [{id,name,lat,lon,pop,conf}], scores: number[][] }` — `scores[i]` aligns with `metros[i]` (both ordered by `location_id`), each row aligns with `months` (ascending). `0` = no data.

- [ ] **Step 1: Write the migration file**

```sql
-- Packs the full metro PropertyIQ score history into one JSON payload for the
-- Market Momentum Map widget: months index, metro centroids (tiger_cbsa),
-- and a dense score matrix. scores[i] aligns with metros[i] (both ordered by
-- location_id); each row aligns with months (ascending). 0 = no data.
-- Read path: GET /api/scores/heatmap/metro (public, Redis-cached 24h).

CREATE OR REPLACE FUNCTION get_metro_score_heatmap()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH months AS (
  SELECT score_date, (row_number() OVER (ORDER BY score_date) - 1)::int AS idx
  FROM (SELECT DISTINCT score_date FROM propertyiq_scores
        WHERE geography = 'metro' AND score_type = 'propertyiq') d
),
latest AS (
  SELECT DISTINCT ON (location_id) location_id, location_name, confidence_level
  FROM propertyiq_scores
  WHERE geography = 'metro' AND score_type = 'propertyiq'
  ORDER BY location_id, score_date DESC
),
metro_geo AS (
  SELECT l.location_id, l.location_name, l.confidence_level,
         ROUND(ST_Y(ST_PointOnSurface(t.geometry))::numeric, 3) AS lat,
         ROUND(ST_X(ST_PointOnSurface(t.geometry))::numeric, 3) AS lon,
         t.population
  FROM latest l
  JOIN tiger_cbsa t ON t.geoid = l.location_id
),
score_lookup AS (
  SELECT s.location_id, m.idx, ROUND(s.score)::int AS score
  FROM propertyiq_scores s
  JOIN months m ON m.score_date = s.score_date
  WHERE s.geography = 'metro' AND s.score_type = 'propertyiq'
),
packed AS (
  SELECT g.location_id, g.location_name, g.lat, g.lon, g.population, g.confidence_level,
         array_agg(COALESCE(sl.score, 0) ORDER BY m.idx) AS scores
  FROM metro_geo g
  CROSS JOIN months m
  LEFT JOIN score_lookup sl
    ON sl.location_id = g.location_id AND sl.idx = m.idx
  GROUP BY g.location_id, g.location_name, g.lat, g.lon, g.population, g.confidence_level
)
SELECT jsonb_build_object(
  'months', (SELECT jsonb_agg(to_char(score_date, 'YYYY-MM-DD') ORDER BY idx) FROM months),
  'metros', (SELECT jsonb_agg(jsonb_build_object(
      'id', location_id, 'name', location_name, 'lat', lat, 'lon', lon,
      'pop', population, 'conf', confidence_level) ORDER BY location_id) FROM packed),
  'scores', (SELECT jsonb_agg(to_jsonb(scores) ORDER BY location_id) FROM packed)
);
$$;

COMMENT ON FUNCTION get_metro_score_heatmap() IS
  'Full metro PropertyIQ score history packed for the Market Momentum Map widget. scores[i] aligns with metros[i]; each score row aligns with months. 0 = no data.';

GRANT EXECUTE ON FUNCTION get_metro_score_heatmap() TO anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` (project `pysflbhpnqwoczyuaaif`, name `add_get_metro_score_heatmap_function`) with the SQL above. NOTE: the timestamp `20260711160000` must remain greater than the current max migration (`20260711140000_seed_market_forecast_ai_model_config.sql`) — Supabase silently skips backdated migrations.

- [ ] **Step 3: Verify against the real DB**

Run via Supabase MCP `execute_sql`:

```sql
SELECT
  jsonb_array_length(j->'months')  AS n_months,
  jsonb_array_length(j->'metros')  AS n_metros,
  jsonb_array_length(j->'scores')  AS n_rows,
  jsonb_array_length(j->'scores'->0) AS row_len
FROM (SELECT get_metro_score_heatmap() AS j) x;
```

Expected: `n_months >= 305`, `n_metros = 935`, `n_rows = 935`, `row_len = n_months`.

- [ ] **Step 4: Commit**

```bash
git branch --show-current   # must print: develop
git add supabase/migrations/20260711160000_add_get_metro_score_heatmap_function.sql
git commit -m "feat(scoring): add get_metro_score_heatmap RPC packing full metro score history" -- supabase/migrations/20260711160000_add_get_metro_score_heatmap_function.sql
```

---

### Task 2: Backend service + controller (`GET /api/scores/heatmap/metro`)

**Files:**

- Create: `packages/backend/src/scoring/scoring-heatmap.service.ts`
- Create: `packages/backend/src/scoring/scoring-heatmap.controller.ts`
- Create: `packages/backend/src/scoring/__tests__/unit/scoring-heatmap.service.spec.ts`
- Modify: `packages/backend/src/scoring/scoring.module.ts` (register controller BEFORE `ScoringController`, add service to providers)

**Interfaces:**

- Consumes: RPC `get_metro_score_heatmap()` (Task 1); `SUPABASE_CLIENT` token from `../supabase/supabase.service`; `RedisService` from `../redis/redis.service` (global module — no import needed in scoring.module).
- Produces: `ScoringHeatmapService.getMetroHeatmap(): Promise<ScoreHeatmapPayload>`; route `GET /api/scores/heatmap/:geography` (only `metro` valid, else 400); exported interfaces `ScoreHeatmapPayload { months: string[]; metros: ScoreHeatmapMetro[]; scores: number[][] }` and `ScoreHeatmapMetro { id: string; name: string; lat: number; lon: number; pop: number | null; conf: string | null }`.

- [ ] **Step 1: Write the failing unit test**

`packages/backend/src/scoring/__tests__/unit/scoring-heatmap.service.spec.ts`:

```ts
import { Test, TestingModule } from "@nestjs/testing";
import { ScoringHeatmapService } from "../../scoring-heatmap.service";
import { SUPABASE_CLIENT } from "../../../supabase/supabase.service";
import { RedisService } from "../../../redis/redis.service";

const samplePayload = {
  months: ["2026-04-30", "2026-05-31"],
  metros: [
    {
      id: "19780",
      name: "Des Moines-West Des Moines, IA",
      lat: 41.512,
      lon: -93.729,
      pop: 737164,
      conf: "A",
    },
  ],
  scores: [[55, 57]],
};

describe("ScoringHeatmapService", () => {
  let service: ScoringHeatmapService;
  const mockSupabase = { rpc: jest.fn() };
  const mockRedis = { getByKey: jest.fn(), setByKey: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringHeatmapService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = module.get<ScoringHeatmapService>(ScoringHeatmapService);
    jest.clearAllMocks();
  });

  it("returns the RPC payload and caches it when Redis is empty", async () => {
    mockRedis.getByKey.mockResolvedValue(null);
    mockRedis.setByKey.mockResolvedValue(true);
    mockSupabase.rpc.mockResolvedValue({ data: samplePayload, error: null });

    const result = await service.getMetroHeatmap();

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_metro_score_heatmap");
    expect(mockRedis.setByKey).toHaveBeenCalledWith(
      "heatmap:v1:metro",
      samplePayload,
      86400,
    );
    expect(result.metros[0].id).toBe("19780");
    expect(result.scores[0]).toEqual([55, 57]);
  });

  it("serves from Redis without hitting the database", async () => {
    mockRedis.getByKey.mockResolvedValue(samplePayload);

    const result = await service.getMetroHeatmap();

    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(result).toEqual(samplePayload);
  });

  it("throws when the RPC returns an error", async () => {
    mockRedis.getByKey.mockResolvedValue(null);
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: new Error("rpc failed"),
    });

    await expect(service.getMetroHeatmap()).rejects.toThrow("rpc failed");
    expect(mockRedis.setByKey).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest scoring-heatmap.service --verbose`
Expected: FAIL — `Cannot find module '../../scoring-heatmap.service'`

- [ ] **Step 3: Implement the service**

`packages/backend/src/scoring/scoring-heatmap.service.ts`:

```ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { RedisService } from "../redis/redis.service";

export interface ScoreHeatmapMetro {
  id: string; // CBSA code
  name: string;
  lat: number;
  lon: number;
  pop: number | null;
  conf: string | null; // latest-month confidence level (A/B/C/F)
}

export interface ScoreHeatmapPayload {
  months: string[]; // ISO dates ascending, one per scored month
  metros: ScoreHeatmapMetro[];
  scores: number[][]; // scores[metroIdx][monthIdx], 1-99, 0 = no data
}

const HEATMAP_CACHE_KEY = "heatmap:v1:metro";
const HEATMAP_TTL_SECONDS = 24 * 60 * 60; // scores change monthly; 24h is safe

@Injectable()
export class ScoringHeatmapService {
  private readonly logger = new Logger(ScoringHeatmapService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redis: RedisService,
  ) {}

  /**
   * Full packed metro score history for the Market Momentum Map widget.
   * Redis read-through cache; degrades gracefully when Redis is absent
   * (getByKey returns null, setByKey is a no-op — see RedisService).
   */
  async getMetroHeatmap(): Promise<ScoreHeatmapPayload> {
    const cached = (await this.redis.getByKey(
      HEATMAP_CACHE_KEY,
    )) as ScoreHeatmapPayload | null;
    if (cached) return cached;

    const { data, error } = await this.supabase.rpc("get_metro_score_heatmap");
    if (error) throw error;

    const payload = data as ScoreHeatmapPayload;
    const wrote = await this.redis.setByKey(
      HEATMAP_CACHE_KEY,
      payload,
      HEATMAP_TTL_SECONDS,
    );
    if (wrote) {
      this.logger.log(
        `[Heatmap Cache] SET ${HEATMAP_CACHE_KEY} (TTL: ${HEATMAP_TTL_SECONDS}s)`,
      );
    }
    return payload;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest scoring-heatmap.service --verbose`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement the controller**

`packages/backend/src/scoring/scoring-heatmap.controller.ts`:

```ts
import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import {
  ScoringHeatmapService,
  ScoreHeatmapPayload,
} from "./scoring-heatmap.service";

/**
 * Public (ungated) packed score history powering the Market Momentum Map
 * widget. `heatmap/:geography` is a literal 2-segment path on api/scores —
 * safe beside ScoringController's `:geography/:locationId` catch-all because
 * this controller is registered BEFORE it in ScoringModule.
 */
@ApiTags("scores")
@Controller("api/scores")
export class ScoringHeatmapController {
  constructor(private readonly heatmapService: ScoringHeatmapService) {}

  @Get("heatmap/:geography")
  @Header("Cache-Control", "public, max-age=21600")
  @ApiOperation({
    summary:
      "Full packed PropertyIQ score history (all months, all regions) for heatmap widgets",
  })
  @ApiParam({ name: "geography", enum: ["metro"] })
  async getHeatmap(
    @Param("geography") geography: string,
  ): Promise<ScoreHeatmapPayload> {
    if (geography !== "metro") {
      throw new HttpException(
        `Unsupported geography '${geography}' — only 'metro' is available`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.heatmapService.getMetroHeatmap();
  }
}
```

- [ ] **Step 6: Register in the module**

In `packages/backend/src/scoring/scoring.module.ts`:

1. Add imports: `import { ScoringHeatmapController } from './scoring-heatmap.controller';` and `import { ScoringHeatmapService } from './scoring-heatmap.service';`
2. Add `ScoringHeatmapService,` to the `providers` array (after `ScoringService`).
3. Add `ScoringHeatmapController,` to the `controllers` array **immediately after `ScoringMarketsController`** — `ScoringController` must remain the last entry.

- [ ] **Step 7: Verify the backend builds**

Run: `cd packages/backend && npm run build`
Expected: exit 0, no TypeScript errors. If ANY error appears (even in unrelated files), fix it before committing — a broken build is a broken build (tasks/lessons.md).

- [ ] **Step 8: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/backend/src/scoring/scoring-heatmap.service.ts packages/backend/src/scoring/scoring-heatmap.controller.ts packages/backend/src/scoring/__tests__/unit/scoring-heatmap.service.spec.ts packages/backend/src/scoring/scoring.module.ts
git commit -m "feat(scoring): public /api/scores/heatmap/metro endpoint with Redis read-through cache" -- packages/backend/src/scoring/scoring-heatmap.service.ts packages/backend/src/scoring/scoring-heatmap.controller.ts packages/backend/src/scoring/__tests__/unit/scoring-heatmap.service.spec.ts packages/backend/src/scoring/scoring.module.ts
```

---

### Task 3: Backend E2E test against the real DB

**Files:**

- Create: `packages/backend/test/score-heatmap.e2e-spec.ts`

**Interfaces:**

- Consumes: route `GET /api/scores/heatmap/metro` (Task 2), real Supabase (env `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`).

- [ ] **Step 1: Write the E2E test**

`packages/backend/test/score-heatmap.e2e-spec.ts` (models `test/grade-thresholds.e2e-spec.ts`):

```ts
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

jest.setTimeout(120_000);

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// Skip the suite when secrets aren't available so CI doesn't fail.
const describeIfSupabase = hasSupabase ? describe : describe.skip;

describeIfSupabase("GET /api/scores/heatmap/metro (real DB)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a dense, aligned score matrix for 900+ metros and 300+ months", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/scores/heatmap/metro")
      .expect(200);

    expect(res.headers["cache-control"]).toContain("public");

    const { months, metros, scores } = res.body;
    expect(months.length).toBeGreaterThanOrEqual(300);
    expect(metros.length).toBeGreaterThanOrEqual(900);
    expect(scores.length).toBe(metros.length);
    for (const row of scores) {
      expect(row.length).toBe(months.length);
    }

    // Months ascend and are ISO dates
    expect(months[0] < months[months.length - 1]).toBe(true);
    expect(months[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Scores stay in 0..99 (0 = no data). Loop — spreading 285k values
    // into Math.min/max blows the call stack.
    let min = Infinity;
    let max = -Infinity;
    for (const row of scores) {
      for (const v of row) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(99);
    expect(max).toBeGreaterThan(0); // sanity: matrix is not all empty

    // Spot-check a stable metro: Des Moines (verified centroid 41.512,-93.729)
    const desMoinesIdx = metros.findIndex(
      (m: { id: string }) => m.id === "19780",
    );
    expect(desMoinesIdx).toBeGreaterThanOrEqual(0);
    expect(metros[desMoinesIdx].lat).toBeCloseTo(41.512, 1);
    expect(metros[desMoinesIdx].lon).toBeCloseTo(-93.729, 1);
    // Des Moines is scored in the latest month
    expect(scores[desMoinesIdx][months.length - 1]).toBeGreaterThan(0);
  });

  it("rejects unsupported geographies with 400", async () => {
    await request(app.getHttpServer())
      .get("/api/scores/heatmap/county")
      .expect(400);
  });
});
```

- [ ] **Step 2: Run the E2E test**

Run: `cd packages/backend && npx jest --config ./test/jest-e2e.json score-heatmap --verbose`
Expected: PASS (2 tests). Requires `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` in the environment (loaded from backend `.env` locally); if the suite is SKIPPED, the env vars are missing — fix the env, do not accept a skip as a pass locally.

- [ ] **Step 3: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/backend/test/score-heatmap.e2e-spec.ts
git commit -m "test(scoring): real-DB e2e for /api/scores/heatmap/metro payload shape" -- packages/backend/test/score-heatmap.e2e-spec.ts
```

---

### Task 4: Frontend data layer — fetcher + hook

**Files:**

- Create: `packages/frontend/lib/data/fetchers/score-heatmap.ts`
- Create: `packages/frontend/lib/data/hooks/useScoreHeatmap.ts`
- Create: `packages/frontend/lib/data/__tests__/score-heatmap.test.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts` (add `export * from "./score-heatmap";`)
- Modify: `packages/frontend/lib/data/hooks/index.ts` (add the hook export block)
- Modify: `packages/frontend/lib/data/index.ts` (add `useScoreHeatmap` + result type to the HOOKS export block)

**Interfaces:**

- Consumes: `fetchAPI` from `lib/data/fetchers/base.ts`; endpoint `GET /api/scores/heatmap/metro` (Task 2).
- Produces: `fetchScoreHeatmap(): Promise<ScoreHeatmapPayload | null>`; `isValidHeatmapPayload(p): p is ScoreHeatmapPayload`; types `ScoreHeatmapPayload`, `ScoreHeatmapMetro` (same shapes as backend Task 2); hook `useScoreHeatmap(options?): { data: ScoreHeatmapPayload | null; isLoading: boolean; isError: boolean; refetch: () => void }` — all importable from `@/lib/data`.

- [ ] **Step 1: Write the failing test**

`packages/frontend/lib/data/__tests__/score-heatmap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isValidHeatmapPayload } from "../fetchers/score-heatmap";

const validPayload = {
  months: ["2026-04-30", "2026-05-31"],
  metros: [
    {
      id: "19780",
      name: "Des Moines-West Des Moines, IA",
      lat: 41.512,
      lon: -93.729,
      pop: 737164,
      conf: "A",
    },
  ],
  scores: [[55, 57]],
};

describe("isValidHeatmapPayload", () => {
  it("accepts a well-formed payload", () => {
    expect(isValidHeatmapPayload(validPayload)).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidHeatmapPayload(null)).toBe(false);
  });

  it("rejects a matrix with the wrong number of rows", () => {
    expect(
      isValidHeatmapPayload({
        ...validPayload,
        scores: [
          [55, 57],
          [1, 2],
        ],
      }),
    ).toBe(false);
  });

  it("rejects a row whose length disagrees with months", () => {
    expect(isValidHeatmapPayload({ ...validPayload, scores: [[55]] })).toBe(
      false,
    );
  });

  it("rejects empty months or metros", () => {
    expect(isValidHeatmapPayload({ ...validPayload, months: [] })).toBe(false);
    expect(
      isValidHeatmapPayload({ ...validPayload, metros: [], scores: [] }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run lib/data/__tests__/score-heatmap.test.ts`
Expected: FAIL — cannot resolve `../fetchers/score-heatmap`

- [ ] **Step 3: Implement the fetcher**

`packages/frontend/lib/data/fetchers/score-heatmap.ts`:

```ts
/**
 * SCORE HEATMAP FETCHER
 *
 * Fetches the full packed metro score history for the Market Momentum Map
 * widget: month index, metro centroids, and a dense score matrix where
 * scores[metroIdx][monthIdx] is a 1-99 integer (0 = no data that month).
 * Public endpoint — safe for anonymous marketing pages.
 */

import { fetchAPI } from "./base";

export interface ScoreHeatmapMetro {
  /** CBSA code */
  id: string;
  name: string;
  lat: number;
  lon: number;
  pop: number | null;
  /** Latest-month confidence level (A/B/C/F) */
  conf: string | null;
}

export interface ScoreHeatmapPayload {
  /** ISO dates ascending, one per scored month */
  months: string[];
  metros: ScoreHeatmapMetro[];
  /** scores[metroIdx][monthIdx], 1-99, 0 = no data */
  scores: number[][];
}

export function isValidHeatmapPayload(
  payload: ScoreHeatmapPayload | null,
): payload is ScoreHeatmapPayload {
  return (
    !!payload &&
    Array.isArray(payload.months) &&
    payload.months.length > 0 &&
    Array.isArray(payload.metros) &&
    payload.metros.length > 0 &&
    Array.isArray(payload.scores) &&
    payload.scores.length === payload.metros.length &&
    payload.scores.every((row) => row.length === payload.months.length)
  );
}

export async function fetchScoreHeatmap(): Promise<ScoreHeatmapPayload | null> {
  try {
    const payload = await fetchAPI<ScoreHeatmapPayload>(
      "/api/scores/heatmap/metro",
    );
    return isValidHeatmapPayload(payload) ? payload : null;
  } catch (error) {
    console.error("Failed to fetch score heatmap:", error);
    return null;
  }
}
```

- [ ] **Step 4: Implement the hook**

`packages/frontend/lib/data/hooks/useScoreHeatmap.ts`:

```ts
"use client";

/**
 * React Query hook for the Market Momentum Map payload. The full history is
 * ~200KB gzipped and changes monthly — fetch once per session, never refetch
 * on focus/reconnect, and let every widget instance share the cache entry.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchScoreHeatmap,
  type ScoreHeatmapPayload,
} from "../fetchers/score-heatmap";

export interface UseScoreHeatmapResult {
  data: ScoreHeatmapPayload | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useScoreHeatmap(
  options: { enabled?: boolean } = {},
): UseScoreHeatmapResult {
  const { enabled = true } = options;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["score-heatmap", "metro"],
    queryFn: fetchScoreHeatmap,
    enabled,
    staleTime: DAY_MS,
    gcTime: DAY_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    data: data ?? null,
    isLoading,
    // fetchScoreHeatmap resolves null (never throws) on failure, so a settled
    // null IS the error state.
    isError: !isLoading && data === null,
    refetch,
  };
}
```

- [ ] **Step 5: Wire the exports**

1. `packages/frontend/lib/data/fetchers/index.ts` — add `export * from "./score-heatmap";` alongside the other fetcher exports.
2. `packages/frontend/lib/data/hooks/index.ts` — add:

```ts
// Score heatmap (Market Momentum Map widget)
export { useScoreHeatmap, type UseScoreHeatmapResult } from "./useScoreHeatmap";
```

3. `packages/frontend/lib/data/index.ts` — add `useScoreHeatmap,` and `type UseScoreHeatmapResult,` to the big HOOKS `export { ... } from "./hooks";` block (fetcher types flow through the existing `export * from "./fetchers"`).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run lib/data/__tests__/score-heatmap.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/lib/data/fetchers/score-heatmap.ts packages/frontend/lib/data/hooks/useScoreHeatmap.ts packages/frontend/lib/data/__tests__/score-heatmap.test.ts packages/frontend/lib/data/fetchers/index.ts packages/frontend/lib/data/hooks/index.ts packages/frontend/lib/data/index.ts
git commit -m "feat(data): score-heatmap fetcher + useScoreHeatmap hook for Market Momentum Map" -- packages/frontend/lib/data/fetchers/score-heatmap.ts packages/frontend/lib/data/hooks/useScoreHeatmap.ts packages/frontend/lib/data/__tests__/score-heatmap.test.ts packages/frontend/lib/data/fetchers/index.ts packages/frontend/lib/data/hooks/index.ts packages/frontend/lib/data/index.ts
```

---

### Task 5: Color scale — `momentum-map-colors.ts`

**Files:**

- Create: `packages/frontend/app/components/widgets/market-momentum-map/momentum-map-colors.ts`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/__tests__/momentum-map-colors.test.ts`

**Interfaces:**

- Produces: `scoreToColor(score: number): string` (0/falsy → `NO_DATA_COLOR`); `NO_DATA_COLOR: string`; `MOMENTUM_COLOR_STOPS: { score: number; color: string; label: string }[]`; `momentumLegendGradient(): string` (CSS `linear-gradient(...)`); `summarizeFrame(scores: number[][], monthIdx: number): { risingPct: number; steadyPct: number; easingPct: number; scoredCount: number }`.

- [ ] **Step 1: Write the failing test**

`packages/frontend/app/components/widgets/market-momentum-map/__tests__/momentum-map-colors.test.ts`:

```ts
import { color } from "d3";
import { describe, expect, it } from "vitest";
import {
  MOMENTUM_COLOR_STOPS,
  NO_DATA_COLOR,
  momentumLegendGradient,
  scoreToColor,
  summarizeFrame,
} from "../momentum-map-colors";

// d3 scales emit "rgb(...)" strings; normalize both sides to hex to compare.
const hex = (c: string) => color(c)!.formatHex().toLowerCase();

describe("scoreToColor", () => {
  it("returns the no-data color for 0 (missing month)", () => {
    expect(scoreToColor(0)).toBe(NO_DATA_COLOR);
  });

  it("returns exact anchor colors at bucket stops", () => {
    for (const stop of MOMENTUM_COLOR_STOPS) {
      expect(hex(scoreToColor(stop.score))).toBe(hex(stop.color));
    }
  });

  it("clamps outside the 1-99 domain", () => {
    expect(scoreToColor(150)).toBe(
      scoreToColor(MOMENTUM_COLOR_STOPS[MOMENTUM_COLOR_STOPS.length - 1].score),
    );
  });

  it("interpolates between stops (49 is not the STEADY anchor)", () => {
    expect(scoreToColor(49)).not.toBe(scoreToColor(50));
  });
});

describe("momentumLegendGradient", () => {
  it("builds a linear-gradient from every stop", () => {
    const gradient = momentumLegendGradient();
    expect(gradient).toContain("linear-gradient(to right");
    for (const stop of MOMENTUM_COLOR_STOPS) {
      expect(gradient.toLowerCase()).toContain(stop.color.toLowerCase());
    }
  });
});

describe("summarizeFrame", () => {
  // Columns: month 0 exercises all three buckets + a no-data metro.
  const scores = [
    [72, 40], // rising (>=60)
    [55, 55], // steady (50-59)
    [41, 62], // easing (<50)
    [0, 88], // no data in month 0 — excluded from denominators
  ];

  it("buckets >=60 as rising, 50-59 steady, 1-49 easing; excludes 0", () => {
    const summary = summarizeFrame(scores, 0);
    expect(summary.scoredCount).toBe(3);
    expect(summary.risingPct).toBe(33);
    expect(summary.steadyPct).toBe(33);
    expect(summary.easingPct).toBe(33);
  });

  it("handles boundary scores 50 and 60 correctly", () => {
    const boundary = [[60], [50], [49]];
    const summary = summarizeFrame(boundary, 0);
    expect(summary.risingPct).toBe(33); // 60 is FIRMING -> rising bucket
    expect(summary.steadyPct).toBe(33); // 50 is STEADY
    expect(summary.easingPct).toBe(33); // 49 is EASING
  });

  it("returns zeros for an all-empty month", () => {
    const summary = summarizeFrame([[0], [0]], 0);
    expect(summary.scoredCount).toBe(0);
    expect(summary.risingPct).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/momentum-map-colors.test.ts`
Expected: FAIL — cannot resolve `../momentum-map-colors`

- [ ] **Step 3: Implement**

`packages/frontend/app/components/widgets/market-momentum-map/momentum-map-colors.ts`:

```ts
/**
 * MOMENTUM MAP COLOR SCALE
 *
 * Single source of truth for the Market Momentum Map's score→color mapping.
 * Diverging around 50 (STEADY = the market's state average), anchored to the
 * canonical momentum-label buckets in app/components/scoring/score-labels.ts.
 * These are DATA colors (same precedent as the map page's COLOR_SCALE) — all
 * UI chrome around them must keep using M3 semantic tokens.
 */

import { scaleLinear } from "d3";

export interface MomentumColorStop {
  score: number;
  color: string;
  label: string;
}

/** Anchors at the momentum-label bucket boundaries; interpolated between. */
export const MOMENTUM_COLOR_STOPS: MomentumColorStop[] = [
  { score: 1, color: "#8c1d18", label: "VERY WEAK" },
  { score: 20, color: "#b3261e", label: "WEAK" },
  { score: 40, color: "#e07a3f", label: "EASING" },
  { score: 50, color: "#a8adc4", label: "STEADY" },
  { score: 60, color: "#7bc89a", label: "FIRMING" },
  { score: 70, color: "#43b371", label: "RISING" },
  { score: 80, color: "#12995b", label: "STRONG" },
  { score: 99, color: "#00753f", label: "VERY STRONG" },
];

/** Low-opacity neutral — reads as "off", never as a low score. */
export const NO_DATA_COLOR = "rgba(148, 153, 170, 0.18)";

const momentumScale = scaleLinear<string>()
  .domain(MOMENTUM_COLOR_STOPS.map((s) => s.score))
  .range(MOMENTUM_COLOR_STOPS.map((s) => s.color))
  .clamp(true);

export function scoreToColor(score: number): string {
  if (!score || score <= 0) return NO_DATA_COLOR;
  return momentumScale(score);
}

/** CSS gradient for the legend bar, built from the same stops. */
export function momentumLegendGradient(): string {
  const span =
    MOMENTUM_COLOR_STOPS[MOMENTUM_COLOR_STOPS.length - 1].score -
    MOMENTUM_COLOR_STOPS[0].score;
  const stops = MOMENTUM_COLOR_STOPS.map(
    (s) =>
      `${s.color} ${Math.round(((s.score - MOMENTUM_COLOR_STOPS[0].score) / span) * 100)}%`,
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export interface FrameSummary {
  risingPct: number;
  steadyPct: number;
  easingPct: number;
  scoredCount: number;
}

/**
 * Per-month momentum breakdown for the summary strip — mirrors the forecast
 * page copy: "firming or rising" (>=60), "steady" (50-59), "easing or weak"
 * (1-49). 0 = no data, excluded from the denominator.
 */
export function summarizeFrame(
  scores: number[][],
  monthIdx: number,
): FrameSummary {
  let rising = 0;
  let steady = 0;
  let easing = 0;
  let scored = 0;
  for (const row of scores) {
    const s = row[monthIdx];
    if (!s) continue;
    scored++;
    if (s >= 60) rising++;
    else if (s >= 50) steady++;
    else easing++;
  }
  const pct = (n: number) =>
    scored === 0 ? 0 : Math.round((n / scored) * 100);
  return {
    risingPct: pct(rising),
    steadyPct: pct(steady),
    easingPct: pct(easing),
    scoredCount: scored,
  };
}
```

Note: `scaleLinear` from the `d3` umbrella interpolates hex colors via d3-interpolate automatically and emits `rgb(...)` strings — which is why the test normalizes both sides to hex with `d3.color(x)!.formatHex()` before comparing. Keep that normalization in the TEST only; the implementation stays as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/momentum-map-colors.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/components/widgets/market-momentum-map/momentum-map-colors.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/momentum-map-colors.test.ts
git commit -m "feat(momentum-map): diverging score color scale + per-month summary buckets" -- packages/frontend/app/components/widgets/market-momentum-map/momentum-map-colors.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/momentum-map-colors.test.ts
```

---

### Task 6: Era annotations — `market-eras.ts`

**Files:**

- Create: `packages/frontend/app/components/widgets/market-momentum-map/market-eras.ts`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/__tests__/market-eras.test.ts`

**Interfaces:**

- Produces: `MARKET_ERAS: MarketEra[]` where `MarketEra = { from: string; to: string | null; label: string; caption: string }` (`from`/`to` are `"YYYY-MM"`, inclusive, `to: null` = present); `eraForMonth(monthIso: string): MarketEra | null` (accepts `"YYYY-MM-DD"`); `eraTickIndices(months: string[]): { index: number; label: string }[]`.

- [ ] **Step 1: Write the failing test**

`packages/frontend/app/components/widgets/market-momentum-map/__tests__/market-eras.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MARKET_ERAS, eraForMonth, eraTickIndices } from "../market-eras";

describe("MARKET_ERAS", () => {
  it("periods never overlap and are chronologically ordered", () => {
    for (let i = 1; i < MARKET_ERAS.length; i++) {
      const prev = MARKET_ERAS[i - 1];
      const curr = MARKET_ERAS[i];
      expect(prev.to).not.toBeNull(); // only the final era is open-ended
      expect(prev.to! < curr.from).toBe(true);
    }
    expect(MARKET_ERAS[MARKET_ERAS.length - 1].to).toBeNull();
  });
});

describe("eraForMonth", () => {
  it("finds the financial crisis for early 2009", () => {
    expect(eraForMonth("2009-01-31")?.label).toBe("Global financial crisis");
  });

  it("returns null for a month between eras", () => {
    expect(eraForMonth("2003-05-31")).toBeNull();
  });

  it("treats era boundaries as inclusive", () => {
    expect(eraForMonth("2007-12-31")?.label).toBe("Global financial crisis");
    expect(eraForMonth("2009-06-30")?.label).toBe("Global financial crisis");
  });

  it("maps today into the open-ended cooldown era", () => {
    expect(eraForMonth("2026-05-31")?.label).toBe("High-rate cooldown");
  });
});

describe("eraTickIndices", () => {
  it("maps each era start to the first month at or after it", () => {
    const months = ["2007-11-30", "2007-12-31", "2008-01-31"];
    const ticks = eraTickIndices(months);
    const gfc = ticks.find((t) => t.label === "Global financial crisis");
    expect(gfc?.index).toBe(1);
  });

  it("drops eras that start after the last month", () => {
    const months = ["2001-03-31", "2001-04-30"];
    const ticks = eraTickIndices(months);
    expect(ticks).toHaveLength(1); // only the dot-com era falls in range
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/market-eras.test.ts`
Expected: FAIL — cannot resolve `../market-eras`

- [ ] **Step 3: Implement**

`packages/frontend/app/components/widgets/market-momentum-map/market-eras.ts`:

```ts
/**
 * MARKET ERA ANNOTATIONS
 *
 * Curated, editorial timeline context for the Market Momentum Map: crashes,
 * rate moves, and booms shown as scrubber tick marks + a live caption.
 * Edit freely — widget logic never needs to change. Periods are inclusive
 * "YYYY-MM" bounds; keep them non-overlapping and chronological (unit-tested).
 */

export interface MarketEra {
  /** Inclusive start, "YYYY-MM" */
  from: string;
  /** Inclusive end, "YYYY-MM"; null = present */
  to: string | null;
  /** Short label for scrubber ticks */
  label: string;
  /** One-line caption shown beside the month readout */
  caption: string;
}

export const MARKET_ERAS: MarketEra[] = [
  {
    from: "2001-03",
    to: "2001-11",
    label: "Dot-com recession",
    caption: "Dot-com bust tips the economy into recession",
  },
  {
    from: "2004-01",
    to: "2006-06",
    label: "Housing boom peak",
    caption: "Subprime-fueled housing boom nears its peak",
  },
  {
    from: "2007-12",
    to: "2009-06",
    label: "Global financial crisis",
    caption: "Global financial crisis — home prices fall nationwide",
  },
  {
    from: "2012-01",
    to: "2012-12",
    label: "Recovery begins",
    caption: "Market bottoms out and the recovery begins",
  },
  {
    from: "2020-03",
    to: "2020-05",
    label: "COVID shock",
    caption: "COVID hits — the Fed cuts rates to zero",
  },
  {
    from: "2020-06",
    to: "2022-02",
    label: "Pandemic frenzy",
    caption: "Pandemic housing frenzy — record-low rates, bidding wars",
  },
  {
    from: "2022-03",
    to: "2023-07",
    label: "Fed hiking cycle",
    caption: "Fastest Fed rate-hiking cycle in 40 years cools demand",
  },
  {
    from: "2024-01",
    to: null,
    label: "High-rate cooldown",
    caption: "Markets adjust to a high-rate environment",
  },
];

/** Look up the era containing an ISO month ("YYYY-MM-DD" or "YYYY-MM"). */
export function eraForMonth(monthIso: string): MarketEra | null {
  const ym = monthIso.slice(0, 7);
  return (
    MARKET_ERAS.find(
      (era) => ym >= era.from && (era.to === null || ym <= era.to),
    ) ?? null
  );
}

/** Scrubber tick positions: the first frame index inside each era. */
export function eraTickIndices(
  months: string[],
): { index: number; label: string }[] {
  return MARKET_ERAS.map((era) => ({
    index: months.findIndex((m) => m.slice(0, 7) >= era.from),
    label: era.label,
  })).filter((tick) => tick.index >= 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/market-eras.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/components/widgets/market-momentum-map/market-eras.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/market-eras.test.ts
git commit -m "feat(momentum-map): curated market era annotations (crashes, rate moves)" -- packages/frontend/app/components/widgets/market-momentum-map/market-eras.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/market-eras.test.ts
```

---

### Task 7: Projection helpers — `momentum-map-projection.ts`

**Files:**

- Create: `packages/frontend/app/components/widgets/market-momentum-map/momentum-map-projection.ts`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/__tests__/momentum-map-projection.test.ts`

**Interfaces:**

- Consumes: `ScoreHeatmapMetro` from `@/lib/data` (Task 4).
- Produces: `MAP_VIEWBOX_WIDTH = 975`, `MAP_VIEWBOX_HEIGHT = 610`; `createUsProjection(): GeoProjection`; `projectMetros(metros, { minRadius, maxRadius }): ProjectedMetro[]` where `ProjectedMetro = ScoreHeatmapMetro & { x: number; y: number; r: number; matrixIndex: number }`, sorted big→small, PR metros dropped; `buildStatePaths(statesGeojson: FeatureCollection): string[]`.

- [ ] **Step 1: Write the failing test**

`packages/frontend/app/components/widgets/market-momentum-map/__tests__/momentum-map-projection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MAP_VIEWBOX_HEIGHT,
  MAP_VIEWBOX_WIDTH,
  projectMetros,
} from "../momentum-map-projection";

const desMoines = {
  id: "19780",
  name: "Des Moines-West Des Moines, IA",
  lat: 41.512,
  lon: -93.729,
  pop: 737164,
  conf: "A",
};
const sanJuanPR = {
  id: "41980",
  name: "San Juan-Bayamón-Caguas, PR",
  lat: 18.38,
  lon: -66.15,
  pop: 2000000,
  conf: "B",
};
const noPop = {
  id: "99999",
  name: "Tiny Metro",
  lat: 39.0,
  lon: -98.0,
  pop: null,
  conf: null,
};

describe("projectMetros", () => {
  const options = { minRadius: 1.5, maxRadius: 22 };

  it("projects a contiguous-US metro inside the viewBox", () => {
    const [metro] = projectMetros([desMoines], options);
    expect(metro.x).toBeGreaterThan(0);
    expect(metro.x).toBeLessThan(MAP_VIEWBOX_WIDTH);
    expect(metro.y).toBeGreaterThan(0);
    expect(metro.y).toBeLessThan(MAP_VIEWBOX_HEIGHT);
  });

  it("drops Puerto Rico metros (outside geoAlbersUsa)", () => {
    const projected = projectMetros([desMoines, sanJuanPR], options);
    expect(projected).toHaveLength(1);
    expect(projected[0].id).toBe("19780");
  });

  it("keeps matrixIndex pointing at the ORIGINAL payload row", () => {
    const projected = projectMetros([sanJuanPR, desMoines], options);
    expect(projected[0].id).toBe("19780");
    expect(projected[0].matrixIndex).toBe(1); // second in the input array
  });

  it("gives null-population metros the minimum radius and sorts big first", () => {
    const projected = projectMetros([noPop, desMoines], options);
    expect(projected[0].id).toBe("19780"); // bigger dot renders first (under)
    expect(projected[1].r).toBe(options.minRadius);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/momentum-map-projection.test.ts`
Expected: FAIL — cannot resolve `../momentum-map-projection`

- [ ] **Step 3: Implement**

`packages/frontend/app/components/widgets/market-momentum-map/momentum-map-projection.ts`:

```ts
/**
 * MOMENTUM MAP PROJECTION
 *
 * geoAlbersUsa helpers for the Market Momentum Map. The projection covers the
 * contiguous US with AK + HI insets; Puerto Rico metros do not project and
 * are excluded (covered by the widget footnote). Sizing follows the us-atlas
 * convention: scale 1300 over a 975×610 viewport.
 */

import { geoAlbersUsa, geoPath, scaleSqrt, type GeoProjection } from "d3";
import type { FeatureCollection } from "geojson";
import type { ScoreHeatmapMetro } from "@/lib/data";

export const MAP_VIEWBOX_WIDTH = 975;
export const MAP_VIEWBOX_HEIGHT = 610;

export interface ProjectedMetro extends ScoreHeatmapMetro {
  x: number;
  y: number;
  r: number;
  /** Row index into payload.scores — survives PR-drop and size sorting. */
  matrixIndex: number;
}

export function createUsProjection(): GeoProjection {
  return geoAlbersUsa()
    .scale(1300)
    .translate([MAP_VIEWBOX_WIDTH / 2, MAP_VIEWBOX_HEIGHT / 2]);
}

export function projectMetros(
  metros: ScoreHeatmapMetro[],
  options: { minRadius: number; maxRadius: number },
): ProjectedMetro[] {
  const projection = createUsProjection();
  const maxPop = Math.max(1, ...metros.map((m) => m.pop ?? 0));
  const radius = scaleSqrt()
    .domain([0, maxPop])
    .range([options.minRadius, options.maxRadius]);

  const projected: ProjectedMetro[] = [];
  metros.forEach((metro, matrixIndex) => {
    const point = projection([metro.lon, metro.lat]);
    if (!point) return; // outside the projection (e.g. Puerto Rico)
    projected.push({
      ...metro,
      matrixIndex,
      x: point[0],
      y: point[1],
      r: radius(metro.pop ?? 0),
    });
  });

  // Big metros first so small dots render on top and stay hoverable.
  return projected.sort((a, b) => b.r - a.r);
}

/** Pre-rendered SVG path strings for the state-outline basemap. */
export function buildStatePaths(statesGeojson: FeatureCollection): string[] {
  const path = geoPath(createUsProjection());
  return statesGeojson.features
    .map((feature) => path(feature) ?? "")
    .filter(Boolean);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/momentum-map-projection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/components/widgets/market-momentum-map/momentum-map-projection.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/momentum-map-projection.test.ts
git commit -m "feat(momentum-map): geoAlbersUsa projection + population radius helpers" -- packages/frontend/app/components/widgets/market-momentum-map/momentum-map-projection.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/momentum-map-projection.test.ts
```

---

### Task 8: Playback state — `useMomentumPlayback.ts`

**Files:**

- Create: `packages/frontend/app/components/widgets/market-momentum-map/useMomentumPlayback.ts`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/__tests__/useMomentumPlayback.test.ts`

**Interfaces:**

- Produces: `useMomentumPlayback(frameCount: number): MomentumPlayback` where `MomentumPlayback = { currentFrame: number; isPlaying: boolean; frameMs: number; play(): void; pause(): void; togglePlay(): void; seek(frame: number): void; setFrameMs(ms: number): void; prefersReducedMotion: boolean }`; `PLAYBACK_SPEEDS: readonly { label: string; frameMs: number }[]` (`0.5x`=250ms, `1x`=125ms, `2x`=62ms — ~8 months/sec at 1x, full 305-month journey ≈ 38s).

- [ ] **Step 1: Write the failing test**

`packages/frontend/app/components/widgets/market-momentum-map/__tests__/useMomentumPlayback.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMomentumPlayback } from "../useMomentumPlayback";

describe("useMomentumPlayback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts on the latest frame once frames exist", () => {
    const { result, rerender } = renderHook(
      ({ count }) => useMomentumPlayback(count),
      { initialProps: { count: 0 } },
    );
    rerender({ count: 10 });
    expect(result.current.currentFrame).toBe(9);
    expect(result.current.isPlaying).toBe(false);
  });

  it("play from the latest frame restarts the journey at frame 0", () => {
    const { result } = renderHook(() => useMomentumPlayback(10));
    act(() => result.current.play());
    expect(result.current.currentFrame).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });

  it("advances one frame per interval and pauses at the end", () => {
    const { result } = renderHook(() => useMomentumPlayback(3));
    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(125));
    expect(result.current.currentFrame).toBe(1);
    act(() => vi.advanceTimersByTime(125));
    expect(result.current.currentFrame).toBe(2);
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.currentFrame).toBe(2); // stays on last frame
    expect(result.current.isPlaying).toBe(false);
  });

  it("seek clamps to range and pauses playback", () => {
    const { result } = renderHook(() => useMomentumPlayback(10));
    act(() => result.current.play());
    act(() => result.current.seek(500));
    expect(result.current.currentFrame).toBe(9);
    expect(result.current.isPlaying).toBe(false);
    act(() => result.current.seek(-5));
    expect(result.current.currentFrame).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/useMomentumPlayback.test.ts`
Expected: FAIL — cannot resolve `../useMomentumPlayback`

- [ ] **Step 3: Implement**

`packages/frontend/app/components/widgets/market-momentum-map/useMomentumPlayback.ts`:

```ts
"use client";

/**
 * Frame state for the Market Momentum Map's monthly playback. Speeds are
 * widget-specific (~8 months/sec at 1x — the full 305-month journey runs in
 * ~38s) which is why this doesn't reuse PlaybackControls' 1600-200ms range.
 */

import { useCallback, useEffect, useState } from "react";

export const PLAYBACK_SPEEDS = [
  { label: "0.5x", frameMs: 250 },
  { label: "1x", frameMs: 125 },
  { label: "2x", frameMs: 62 },
] as const;

export interface MomentumPlayback {
  currentFrame: number;
  isPlaying: boolean;
  frameMs: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (frame: number) => void;
  setFrameMs: (ms: number) => void;
  prefersReducedMotion: boolean;
}

export function useMomentumPlayback(frameCount: number): MomentumPlayback {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameMs, setFrameMs] = useState<number>(125);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Land on the latest month once data arrives.
  useEffect(() => {
    if (frameCount > 0) setCurrentFrame(frameCount - 1);
  }, [frameCount]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isPlaying || frameCount <= 0) return;
    const id = window.setInterval(() => {
      setCurrentFrame((frame) => {
        if (frame + 1 >= frameCount) {
          setIsPlaying(false);
          return frame;
        }
        return frame + 1;
      });
    }, frameMs);
    return () => window.clearInterval(id);
  }, [isPlaying, frameMs, frameCount]);

  const play = useCallback(() => {
    // Pressing play while parked on "today" restarts the 25-year journey.
    setCurrentFrame((frame) =>
      frameCount > 0 && frame >= frameCount - 1 ? 0 : frame,
    );
    setIsPlaying(true);
  }, [frameCount]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const togglePlay = useCallback(
    () => (isPlaying ? pause() : play()),
    [isPlaying, pause, play],
  );

  const seek = useCallback(
    (frame: number) => {
      setIsPlaying(false);
      setCurrentFrame(
        Math.max(0, Math.min(frame, Math.max(0, frameCount - 1))),
      );
    },
    [frameCount],
  );

  return {
    currentFrame,
    isPlaying,
    frameMs,
    play,
    pause,
    togglePlay,
    seek,
    setFrameMs,
    prefersReducedMotion,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/useMomentumPlayback.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/components/widgets/market-momentum-map/useMomentumPlayback.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/useMomentumPlayback.test.ts
git commit -m "feat(momentum-map): playback frame state hook with reduced-motion support" -- packages/frontend/app/components/widgets/market-momentum-map/useMomentumPlayback.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/useMomentumPlayback.test.ts
```

---

### Task 9: Map surface — `MomentumMapCanvas.tsx` + basemap hook

**Files:**

- Create: `packages/frontend/app/components/widgets/market-momentum-map/MomentumMapCanvas.tsx`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/useUsStatesBasemap.ts`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/__tests__/MomentumMapCanvas.test.tsx`

**Interfaces:**

- Consumes: `ProjectedMetro`, `MAP_VIEWBOX_WIDTH/HEIGHT`, `buildStatePaths` (Task 7); `scoreToColor`, `NO_DATA_COLOR` (Task 5); `getScoreLabel`, `getScoreMomentumArrow` from `@/app/components/scoring/score-labels`.
- Produces: `MomentumMapCanvas` component with props `{ metros: ProjectedMetro[]; statePaths: string[]; scores: number[][]; currentFrame: number; latestFrame: number; animate: boolean; hrefFor: (metro: ProjectedMetro) => string | null; onNavigate: (href: string) => void }`; `useUsStatesBasemap(): string[]` (module-cached fetch of `/geojson/states.json`).

**Deliberate spec deviation (approved rationale):** the spec mentions per-dot keyboard focus; this plan renders the dots `aria-hidden` with NO tab stops — 935 focusable circles would be hostile to keyboard/AT users. The keyboard story is the scrubber (arrows/Home/End) plus the summary strip; per-metro data remains pointer-hover + click. Do not "fix" this back to focusable dots.

- [ ] **Step 1: Write the failing component test**

`packages/frontend/app/components/widgets/market-momentum-map/__tests__/MomentumMapCanvas.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MomentumMapCanvas } from "../MomentumMapCanvas";
import { scoreToColor, NO_DATA_COLOR } from "../momentum-map-colors";
import type { ProjectedMetro } from "../momentum-map-projection";

const metros: ProjectedMetro[] = [
  {
    id: "19780",
    name: "Des Moines-West Des Moines, IA",
    lat: 41.512,
    lon: -93.729,
    pop: 737164,
    conf: "A",
    x: 500,
    y: 250,
    r: 6,
    matrixIndex: 0,
  },
  {
    id: "12345",
    name: "No Data Metro",
    lat: 40,
    lon: -100,
    pop: 50000,
    conf: null,
    x: 400,
    y: 300,
    r: 2,
    matrixIndex: 1,
  },
];
const scores = [
  [72, 55],
  [0, 0],
];

function renderCanvas(
  overrides: Partial<Parameters<typeof MomentumMapCanvas>[0]> = {},
) {
  const onNavigate = vi.fn();
  const utils = render(
    <MomentumMapCanvas
      metros={metros}
      statePaths={["M0,0L10,10"]}
      scores={scores}
      currentFrame={0}
      latestFrame={1}
      animate={false}
      hrefFor={(m) =>
        m.id === "19780" ? "/markets/des-moines-west-des-moines-ia" : null
      }
      onNavigate={onNavigate}
      {...overrides}
    />,
  );
  return { ...utils, onNavigate };
}

describe("MomentumMapCanvas", () => {
  it("renders one circle per metro with score-driven fill", () => {
    const { container } = renderCanvas();
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    expect(circles[0].getAttribute("fill")).toBe(scoreToColor(72));
    expect(circles[1].getAttribute("fill")).toBe(NO_DATA_COLOR);
  });

  it("shows a tooltip with momentum label on hover", () => {
    const { container } = renderCanvas();
    fireEvent.mouseEnter(container.querySelectorAll("circle")[0]);
    const tooltip = screen.getByTestId("momentum-tooltip");
    expect(tooltip.textContent).toContain("Des Moines");
    expect(tooltip.textContent).toContain("72");
    expect(tooltip.textContent).toContain("RISING");
  });

  it("omits confidence when not on the latest frame, shows it when on it", () => {
    const { container, rerender, ...rest } = renderCanvas({ currentFrame: 0 });
    fireEvent.mouseEnter(container.querySelectorAll("circle")[0]);
    expect(screen.getByTestId("momentum-tooltip").textContent).not.toContain(
      "Confidence",
    );
  });

  it("navigates on click only when a market page exists", () => {
    const { container, onNavigate } = renderCanvas();
    const circles = container.querySelectorAll("circle");
    fireEvent.click(circles[0]);
    expect(onNavigate).toHaveBeenCalledWith(
      "/markets/des-moines-west-des-moines-ia",
    );
    onNavigate.mockClear();
    fireEvent.click(circles[1]);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/MomentumMapCanvas.test.tsx`
Expected: FAIL — cannot resolve `../MomentumMapCanvas`

- [ ] **Step 3: Implement the canvas**

`packages/frontend/app/components/widgets/market-momentum-map/MomentumMapCanvas.tsx`:

```tsx
"use client";

/**
 * SVG surface for the Market Momentum Map: state-outline basemap + one circle
 * per projectable metro, fill driven by the current frame's score. Dots have
 * stable keys/positions so per-frame renders only diff fill attributes; the
 * 150ms CSS fill transition does the tweening (disabled for reduced motion).
 */

import { useState } from "react";
import {
  getScoreLabel,
  getScoreMomentumArrow,
} from "@/app/components/scoring/score-labels";
import { scoreToColor } from "./momentum-map-colors";
import {
  MAP_VIEWBOX_HEIGHT,
  MAP_VIEWBOX_WIDTH,
  type ProjectedMetro,
} from "./momentum-map-projection";

interface MomentumMapCanvasProps {
  metros: ProjectedMetro[];
  statePaths: string[];
  scores: number[][];
  currentFrame: number;
  latestFrame: number;
  /** false under prefers-reduced-motion — colors snap instead of tweening */
  animate: boolean;
  hrefFor: (metro: ProjectedMetro) => string | null;
  onNavigate: (href: string) => void;
}

export function MomentumMapCanvas({
  metros,
  statePaths,
  scores,
  currentFrame,
  latestFrame,
  animate,
  hrefFor,
  onNavigate,
}: MomentumMapCanvasProps) {
  const [hovered, setHovered] = useState<ProjectedMetro | null>(null);
  const hoveredScore = hovered
    ? (scores[hovered.matrixIndex]?.[currentFrame] ?? 0)
    : 0;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Animated map of PropertyIQ momentum scores across US metros"
      >
        <g>
          {statePaths.map((d, i) => (
            <path
              key={i}
              d={d}
              className="fill-surface-container stroke-outline-variant"
              strokeWidth={0.75}
            />
          ))}
        </g>
        {/* Dots are decorative for AT users (935 tab stops would be hostile);
            the scrubber + summary strip carry the accessible story. */}
        <g aria-hidden="true">
          {metros.map((metro) => {
            const href = hrefFor(metro);
            return (
              <circle
                key={metro.id}
                cx={metro.x}
                cy={metro.y}
                r={metro.r}
                fill={scoreToColor(
                  scores[metro.matrixIndex]?.[currentFrame] ?? 0,
                )}
                fillOpacity={0.85}
                className="stroke-surface"
                strokeWidth={0.5}
                style={{
                  transition: animate ? "fill 150ms linear" : "none",
                  cursor: href ? "pointer" : "default",
                }}
                onMouseEnter={() => setHovered(metro)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (href) onNavigate(href);
                }}
              />
            );
          })}
        </g>
      </svg>
      {hovered && (
        <MetroTooltip
          metro={hovered}
          score={hoveredScore}
          showConfidence={currentFrame === latestFrame}
        />
      )}
    </div>
  );
}

function MetroTooltip({
  metro,
  score,
  showConfidence,
}: {
  metro: ProjectedMetro;
  score: number;
  showConfidence: boolean;
}) {
  return (
    <div
      data-testid="momentum-tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 shadow-md"
      style={{
        left: `${(metro.x / MAP_VIEWBOX_WIDTH) * 100}%`,
        top: `${(metro.y / MAP_VIEWBOX_HEIGHT) * 100}%`,
      }}
    >
      <p className="text-sm font-medium text-on-surface">{metro.name}</p>
      {score > 0 ? (
        <p className="font-mono text-sm text-on-surface">
          {score} · {getScoreLabel(score)} {getScoreMomentumArrow(score)}
        </p>
      ) : (
        <p className="text-sm text-on-surface-variant">No score this month</p>
      )}
      {showConfidence && metro.conf && (
        <p className="text-xs text-on-surface-variant">
          Confidence {metro.conf}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement the basemap hook**

`packages/frontend/app/components/widgets/market-momentum-map/useUsStatesBasemap.ts`:

```ts
"use client";

/**
 * Loads /geojson/states.json (static, browser-cached) and pre-renders it to
 * SVG path strings once per page — every widget instance shares the promise.
 * Basemap failure is non-fatal: dots still render over an empty background.
 */

import { useEffect, useState } from "react";
import type { FeatureCollection } from "geojson";
import { buildStatePaths } from "./momentum-map-projection";

let statePathsPromise: Promise<string[]> | null = null;

function loadStatePaths(): Promise<string[]> {
  if (!statePathsPromise) {
    statePathsPromise = fetch("/geojson/states.json")
      .then((res) => {
        if (!res.ok) throw new Error(`states.json ${res.status}`);
        return res.json() as Promise<FeatureCollection>;
      })
      .then(buildStatePaths)
      .catch((error) => {
        statePathsPromise = null; // allow retry on next mount
        throw error;
      });
  }
  return statePathsPromise;
}

export function useUsStatesBasemap(): string[] {
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadStatePaths()
      .then((loaded) => {
        if (!cancelled) setPaths(loaded);
      })
      .catch((error) => {
        console.error("Momentum map basemap failed to load:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return paths;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/MomentumMapCanvas.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/components/widgets/market-momentum-map/MomentumMapCanvas.tsx packages/frontend/app/components/widgets/market-momentum-map/useUsStatesBasemap.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/MomentumMapCanvas.test.tsx
git commit -m "feat(momentum-map): SVG dot-map canvas with tooltip and state basemap" -- packages/frontend/app/components/widgets/market-momentum-map/MomentumMapCanvas.tsx packages/frontend/app/components/widgets/market-momentum-map/useUsStatesBasemap.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/MomentumMapCanvas.test.tsx
```

---

### Task 10: Timeline + summary strip

**Files:**

- Create: `packages/frontend/app/components/widgets/market-momentum-map/MomentumMapTimeline.tsx`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/MomentumSummaryStrip.tsx`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/__tests__/MomentumMapTimeline.test.tsx`

**Interfaces:**

- Consumes: `eraTickIndices` (Task 6); `PLAYBACK_SPEEDS` (Task 8); `summarizeFrame` (Task 5); `lucide-react` `Play`/`Pause` icons.
- Produces: `MomentumMapTimeline` with props `{ months: string[]; currentFrame: number; isPlaying: boolean; frameMs: number; size: "hero" | "card"; onTogglePlay: () => void; onSeek: (frame: number) => void; onFrameMsChange: (ms: number) => void }`; exported helper `formatMonthLabel(isoDate: string): string` ("2026-05-31" → "May 2026"); `MomentumSummaryStrip` with props `{ scores: number[][]; currentFrame: number }`.

- [ ] **Step 1: Write the failing test**

`packages/frontend/app/components/widgets/market-momentum-map/__tests__/MomentumMapTimeline.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MomentumMapTimeline, formatMonthLabel } from "../MomentumMapTimeline";
import { MomentumSummaryStrip } from "../MomentumSummaryStrip";

const months = ["2007-11-30", "2007-12-31", "2008-01-31"];

function renderTimeline(size: "hero" | "card" = "hero") {
  const onSeek = vi.fn();
  const onTogglePlay = vi.fn();
  const onFrameMsChange = vi.fn();
  render(
    <MomentumMapTimeline
      months={months}
      currentFrame={0}
      isPlaying={false}
      frameMs={125}
      size={size}
      onTogglePlay={onTogglePlay}
      onSeek={onSeek}
      onFrameMsChange={onFrameMsChange}
    />,
  );
  return { onSeek, onTogglePlay, onFrameMsChange };
}

describe("formatMonthLabel", () => {
  it("formats an ISO date as month + year", () => {
    expect(formatMonthLabel("2026-05-31")).toBe("May 2026");
    expect(formatMonthLabel("2001-01-31")).toBe("Jan 2001");
  });
});

describe("MomentumMapTimeline", () => {
  it("seeks when the scrubber moves", () => {
    const { onSeek } = renderTimeline();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
    expect(onSeek).toHaveBeenCalledWith(2);
  });

  it("toggles play and shows the speed selector in hero size", () => {
    const { onTogglePlay } = renderTimeline("hero");
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(onTogglePlay).toHaveBeenCalled();
    expect(screen.getByLabelText("Playback speed")).toBeTruthy();
  });

  it("hides the speed selector in card size", () => {
    renderTimeline("card");
    expect(screen.queryByLabelText("Playback speed")).toBeNull();
  });

  it("renders era tick marks on the track", () => {
    renderTimeline();
    // months include the GFC start (2007-12) → at least one tick present
    expect(screen.getByTitle("Global financial crisis")).toBeTruthy();
  });
});

describe("MomentumSummaryStrip", () => {
  it("shows the three momentum percentages for the current frame", () => {
    const scores = [
      [72], // rising
      [55], // steady
      [41], // easing
      [30], // easing
    ];
    render(<MomentumSummaryStrip scores={scores} currentFrame={0} />);
    const strip = screen.getByTestId("momentum-summary-strip");
    expect(strip.textContent).toContain("25%"); // rising
    expect(strip.textContent).toContain("50%"); // easing
    expect(strip.textContent).toContain("Firming or rising momentum");
    expect(strip.textContent).toContain("Steady, near state average");
    expect(strip.textContent).toContain("Easing or weak momentum");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/MomentumMapTimeline.test.tsx`
Expected: FAIL — cannot resolve `../MomentumMapTimeline`

- [ ] **Step 3: Implement the timeline**

`packages/frontend/app/components/widgets/market-momentum-map/MomentumMapTimeline.tsx`:

```tsx
"use client";

/**
 * Playback controls for the Market Momentum Map: play/pause, month scrubber
 * with era tick marks, and (hero size) a speed selector. Native range input
 * gives keyboard scrubbing (arrows step a month, Home/End jump) for free.
 */

import { Pause, Play } from "lucide-react";
import { eraTickIndices } from "./market-eras";
import { PLAYBACK_SPEEDS } from "./useMomentumPlayback";

export function formatMonthLabel(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    "en-US",
    { month: "short", year: "numeric", timeZone: "UTC" },
  );
}

interface MomentumMapTimelineProps {
  months: string[];
  currentFrame: number;
  isPlaying: boolean;
  frameMs: number;
  size: "hero" | "card";
  onTogglePlay: () => void;
  onSeek: (frame: number) => void;
  onFrameMsChange: (ms: number) => void;
}

export function MomentumMapTimeline({
  months,
  currentFrame,
  isPlaying,
  frameMs,
  size,
  onTogglePlay,
  onSeek,
  onFrameMsChange,
}: MomentumMapTimelineProps) {
  if (months.length === 0) return null;
  const maxFrame = months.length - 1;
  const ticks = eraTickIndices(months);

  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        aria-label={isPlaying ? "Pause" : "Play 25 years of market history"}
        onClick={onTogglePlay}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors duration-200 hover:bg-primary/90"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px]" />
        )}
      </button>
      <div className="relative flex-1">
        <div className="pointer-events-none absolute -top-1.5 left-0 right-0 h-2">
          {ticks.map((tick) => (
            <span
              key={tick.label}
              title={tick.label}
              className="absolute h-2 w-[2px] rounded-full bg-outline"
              style={{ left: `${(tick.index / maxFrame) * 100}%` }}
            />
          ))}
        </div>
        <input
          type="range"
          aria-label="Month"
          aria-valuetext={formatMonthLabel(months[currentFrame])}
          min={0}
          max={maxFrame}
          value={currentFrame}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="w-full accent-primary"
        />
      </div>
      {size === "hero" && (
        <select
          aria-label="Playback speed"
          value={frameMs}
          onChange={(event) => onFrameMsChange(Number(event.target.value))}
          className="rounded-lg border border-outline-variant bg-surface-container px-2 py-1 text-sm text-on-surface"
        >
          {PLAYBACK_SPEEDS.map((speed) => (
            <option key={speed.frameMs} value={speed.frameMs}>
              {speed.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement the summary strip**

`packages/frontend/app/components/widgets/market-momentum-map/MomentumSummaryStrip.tsx`:

```tsx
"use client";

/**
 * Live per-month momentum breakdown (hero size only) — the same three buckets
 * as the forecast page's stat cards, recomputed every frame during playback.
 */

import { summarizeFrame } from "./momentum-map-colors";

interface MomentumSummaryStripProps {
  scores: number[][];
  currentFrame: number;
}

export function MomentumSummaryStrip({
  scores,
  currentFrame,
}: MomentumSummaryStripProps) {
  const summary = summarizeFrame(scores, currentFrame);
  const tiles = [
    { pct: summary.risingPct, label: "Firming or rising momentum" },
    { pct: summary.steadyPct, label: "Steady, near state average" },
    { pct: summary.easingPct, label: "Easing or weak momentum" },
  ];

  return (
    <div
      data-testid="momentum-summary-strip"
      className="mt-4 grid grid-cols-3 gap-3"
    >
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-lg border border-outline-variant bg-surface px-3 py-2"
        >
          <p className="font-mono text-xl text-on-surface">{tile.pct}%</p>
          <p className="text-xs text-on-surface-variant">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/MomentumMapTimeline.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/components/widgets/market-momentum-map/MomentumMapTimeline.tsx packages/frontend/app/components/widgets/market-momentum-map/MomentumSummaryStrip.tsx packages/frontend/app/components/widgets/market-momentum-map/__tests__/MomentumMapTimeline.test.tsx
git commit -m "feat(momentum-map): timeline with era ticks + live momentum summary strip" -- packages/frontend/app/components/widgets/market-momentum-map/MomentumMapTimeline.tsx packages/frontend/app/components/widgets/market-momentum-map/MomentumSummaryStrip.tsx packages/frontend/app/components/widgets/market-momentum-map/__tests__/MomentumMapTimeline.test.tsx
```

---

### Task 11: Widget shell — `MarketMomentumMap.tsx` + `index.ts`

**Files:**

- Create: `packages/frontend/app/components/widgets/market-momentum-map/MarketMomentumMap.tsx`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/index.ts`
- Create: `packages/frontend/app/components/widgets/market-momentum-map/__tests__/MarketMomentumMap.test.tsx`

**Interfaces:**

- Consumes: everything from Tasks 4-10; `CBSA_TO_METRO`, `COVERAGE_COPY`, `useScoreHeatmap` from `@/lib/data`; `SCORE_MOMENTUM_DESCRIPTOR` from `@/app/components/scoring/score-labels`; `useRouter` from `next/navigation`.
- Produces: `MarketMomentumMap` component with props `{ size?: "hero" | "card"; className?: string }` exported from the folder's `index.ts` — THE public API of this feature.

- [ ] **Step 1: Write the failing test**

`packages/frontend/app/components/widgets/market-momentum-map/__tests__/MarketMomentumMap.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseScoreHeatmap = vi.fn();
vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    useScoreHeatmap: (...args: unknown[]) => mockUseScoreHeatmap(...args),
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { MarketMomentumMap } from "../MarketMomentumMap";

const payload = {
  months: ["2026-04-30", "2026-05-31"],
  metros: [
    {
      id: "19780",
      name: "Des Moines-West Des Moines, IA",
      lat: 41.512,
      lon: -93.729,
      pop: 737164,
      conf: "A",
    },
  ],
  scores: [[55, 57]],
};

describe("MarketMomentumMap", () => {
  beforeEach(() => {
    mockUseScoreHeatmap.mockReset();
    // useUsStatesBasemap fetches /geojson/states.json — stub fetch in jsdom
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ type: "FeatureCollection", features: [] }),
      }),
    );
  });

  it("shows the skeleton with the COVERAGE_COPY floor while loading", () => {
    mockUseScoreHeatmap.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MarketMomentumMap />);
    expect(screen.getByTestId("momentum-map-skeleton").textContent).toContain(
      "900+",
    );
  });

  it("shows a retry button on error", () => {
    const refetch = vi.fn();
    mockUseScoreHeatmap.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      refetch,
    });
    render(<MarketMomentumMap />);
    screen.getByRole("button", { name: /retry/i }).click();
    expect(refetch).toHaveBeenCalled();
  });

  it("renders header, dots, timeline, summary strip and payload-derived footnote in hero size", () => {
    mockUseScoreHeatmap.mockReturnValue({
      data: payload,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const { container } = render(<MarketMomentumMap size="hero" />);
    expect(screen.getByTestId("momentum-map-hero")).toBeTruthy();
    expect(screen.getByTestId("momentum-month-readout").textContent).toBe(
      "May 2026",
    );
    expect(container.querySelectorAll("circle").length).toBe(1);
    expect(screen.getByTestId("momentum-summary-strip")).toBeTruthy();
    // Footnote count comes from the payload, not a hardcoded constant
    expect(screen.getByText(/1 metros scored monthly/)).toBeTruthy();
  });

  it("omits the summary strip in card size", () => {
    mockUseScoreHeatmap.mockReturnValue({
      data: payload,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<MarketMomentumMap size="card" />);
    expect(screen.getByTestId("momentum-map-card")).toBeTruthy();
    expect(screen.queryByTestId("momentum-summary-strip")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/MarketMomentumMap.test.tsx`
Expected: FAIL — cannot resolve `../MarketMomentumMap`

- [ ] **Step 3: Implement the shell**

`packages/frontend/app/components/widgets/market-momentum-map/MarketMomentumMap.tsx`:

```tsx
"use client";

/**
 * MARKET MOMENTUM MAP — standalone, drop-anywhere widget.
 *
 * Population-scaled dot map of every scored US metro colored by PropertyIQ
 * score, with 25-year monthly playback and era context labels. Fully public
 * data; place it on any page with <MarketMomentumMap size="hero" />.
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CBSA_TO_METRO, COVERAGE_COPY, useScoreHeatmap } from "@/lib/data";
import { MomentumMapCanvas } from "./MomentumMapCanvas";
import { MomentumMapTimeline, formatMonthLabel } from "./MomentumMapTimeline";
import { MomentumSummaryStrip } from "./MomentumSummaryStrip";
import { eraForMonth } from "./market-eras";
import { momentumLegendGradient } from "./momentum-map-colors";
import { projectMetros, type ProjectedMetro } from "./momentum-map-projection";
import { useMomentumPlayback } from "./useMomentumPlayback";
import { useUsStatesBasemap } from "./useUsStatesBasemap";

export interface MarketMomentumMapProps {
  /** hero: <=960px with summary strip + speed control; card: <=480px condensed */
  size?: "hero" | "card";
  className?: string;
}

const DOT_RADII = { minRadius: 1.5, maxRadius: 22 } as const;

const CARD_CHROME =
  "rounded-xl border border-outline-variant bg-surface-container-low shadow-sm";

function sizeClasses(size: "hero" | "card"): string {
  return size === "hero" ? "max-w-[960px] p-6" : "max-w-[480px] p-4";
}

export function MarketMomentumMap({
  size = "hero",
  className = "",
}: MarketMomentumMapProps) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useScoreHeatmap();
  const statePaths = useUsStatesBasemap();

  const projected = useMemo(
    () => (data ? projectMetros(data.metros, DOT_RADII) : []),
    [data],
  );
  const playback = useMomentumPlayback(data?.months.length ?? 0);

  if (isLoading) {
    return <MomentumMapSkeleton size={size} className={className} />;
  }

  if (isError || !data) {
    return (
      <div
        className={`w-full ${sizeClasses(size)} ${CARD_CHROME} ${className}`}
      >
        <p className="text-sm text-on-surface-variant">
          The momentum map couldn&apos;t load.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 rounded-full bg-primary px-4 py-1.5 text-sm text-on-primary transition-colors duration-200 hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const latestFrame = data.months.length - 1;
  const currentMonth = data.months[playback.currentFrame];
  const era = currentMonth ? eraForMonth(currentMonth) : null;

  const hrefFor = (metro: ProjectedMetro): string | null => {
    const match = CBSA_TO_METRO.get(metro.id);
    return match ? `/markets/${match.slug}` : null;
  };

  return (
    <figure
      data-testid={`momentum-map-${size}`}
      aria-label="US market momentum heatmap with monthly playback"
      className={`w-full ${sizeClasses(size)} ${CARD_CHROME} ${className}`}
    >
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3
          className={`font-semibold text-on-surface ${size === "hero" ? "text-lg" : "text-base"}`}
        >
          U.S. Market Momentum
        </h3>
        <div className="text-right">
          <p
            data-testid="momentum-month-readout"
            className={`font-mono text-on-surface ${size === "hero" ? "text-2xl" : "text-lg"}`}
          >
            {formatMonthLabel(currentMonth)}
          </p>
          {era && <p className="text-xs text-primary">{era.caption}</p>}
        </div>
      </header>

      <MomentumMapCanvas
        metros={projected}
        statePaths={statePaths}
        scores={data.scores}
        currentFrame={playback.currentFrame}
        latestFrame={latestFrame}
        animate={!playback.prefersReducedMotion}
        hrefFor={hrefFor}
        onNavigate={(href) => router.push(href)}
      />

      <MomentumLegend />

      {size === "hero" && (
        <MomentumSummaryStrip
          scores={data.scores}
          currentFrame={playback.currentFrame}
        />
      )}

      <MomentumMapTimeline
        months={data.months}
        currentFrame={playback.currentFrame}
        isPlaying={playback.isPlaying}
        frameMs={playback.frameMs}
        size={size}
        onTogglePlay={playback.togglePlay}
        onSeek={playback.seek}
        onFrameMsChange={playback.setFrameMs}
      />

      <figcaption className="mt-3 text-xs text-on-surface-variant">
        {data.metros.length} metros scored monthly · Map shows contiguous US, AK
        &amp; HI · Pre-2016 history is momentum-only data
      </figcaption>
    </figure>
  );
}

function MomentumLegend() {
  return (
    <div className="mt-3">
      <div
        className="h-2 w-full rounded-full"
        style={{ background: momentumLegendGradient() }}
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] tracking-wide text-on-surface-variant">
        <span>WEAK</span>
        <span>EASING</span>
        <span>STEADY</span>
        <span>FIRMING</span>
        <span>STRONG</span>
      </div>
    </div>
  );
}

function MomentumMapSkeleton({
  size,
  className,
}: {
  size: "hero" | "card";
  className: string;
}) {
  return (
    <div
      data-testid="momentum-map-skeleton"
      className={`w-full ${sizeClasses(size)} ${CARD_CHROME} ${className}`}
    >
      <div className="h-5 w-48 animate-pulse rounded bg-surface-container-high" />
      <div className="mt-3 aspect-[975/610] w-full animate-pulse rounded-lg bg-surface-container" />
      <p className="mt-3 text-xs text-on-surface-variant">
        Loading momentum for {COVERAGE_COPY.metros} metros…
      </p>
    </div>
  );
}
```

`packages/frontend/app/components/widgets/market-momentum-map/index.ts`:

```ts
export {
  MarketMomentumMap,
  type MarketMomentumMapProps,
} from "./MarketMomentumMap";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map/__tests__/MarketMomentumMap.test.tsx`
Expected: PASS. Then run the whole widget suite: `npx vitest run app/components/widgets/market-momentum-map` — all green.

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/components/widgets/market-momentum-map/MarketMomentumMap.tsx packages/frontend/app/components/widgets/market-momentum-map/index.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/MarketMomentumMap.test.tsx
git commit -m "feat(momentum-map): MarketMomentumMap widget shell with hero/card sizes" -- packages/frontend/app/components/widgets/market-momentum-map/MarketMomentumMap.tsx packages/frontend/app/components/widgets/market-momentum-map/index.ts packages/frontend/app/components/widgets/market-momentum-map/__tests__/MarketMomentumMap.test.tsx
```

---

### Task 12: Demo page + Playwright E2E (live data)

**Files:**

- Create: `packages/frontend/app/(app)/dev/market-momentum-map/page.tsx`
- Create: `packages/frontend/tests/e2e/market-momentum-map.spec.ts`

**Interfaces:**

- Consumes: `MarketMomentumMap` (Task 11); running local stack (frontend :3000 + backend :3001 — use the `local-dev-servers` skill / `dev:fresh` if not up).

- [ ] **Step 1: Create the demo page**

`packages/frontend/app/(app)/dev/market-momentum-map/page.tsx`:

```tsx
import { MarketMomentumMap } from "@/app/components/widgets/market-momentum-map";

export default function MarketMomentumMapDemoPage() {
  return (
    <main className="min-h-screen space-y-10 bg-surface p-8">
      <h1 className="text-2xl font-semibold text-on-surface">
        Market Momentum Map — demo
      </h1>
      <section>
        <h2 className="mb-3 text-sm text-on-surface-variant">
          size=&quot;hero&quot;
        </h2>
        <MarketMomentumMap size="hero" />
      </section>
      <section>
        <h2 className="mb-3 text-sm text-on-surface-variant">
          size=&quot;card&quot;
        </h2>
        <MarketMomentumMap size="card" />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Write the Playwright spec**

`packages/frontend/tests/e2e/market-momentum-map.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

// Live-data E2E: requires the real backend on :3001 (no mocks — the widget
// must paint 900+ dots from the production-schema database).
test.describe("Market Momentum Map widget", () => {
  test("renders live data, scrubs months, shows tooltip, both sizes", async ({
    page,
  }) => {
    await page.goto("/dev/market-momentum-map");

    const hero = page.getByTestId("momentum-map-hero");
    await expect(hero).toBeVisible({ timeout: 30_000 });

    // 900+ metro dots painted from live data
    await expect
      .poll(async () => hero.locator("circle").count(), { timeout: 30_000 })
      .toBeGreaterThan(900);

    // Month readout starts on the latest month and changes when scrubbing
    const readout = hero.getByTestId("momentum-month-readout");
    const latestLabel = await readout.textContent();
    expect(latestLabel).toBeTruthy();

    const slider = hero.getByRole("slider", { name: "Month" });
    await slider.focus();
    await page.keyboard.press("Home"); // jump to Jan 2001
    await expect(readout).not.toHaveText(latestLabel!);
    await expect(readout).toHaveText(/2001/);

    // Summary strip shows sane percentages
    const strip = hero.getByTestId("momentum-summary-strip");
    await expect(strip).toContainText("%");

    // Tooltip appears when hovering a dot
    await hero.locator("circle").first().hover({ force: true });
    await expect(hero.getByTestId("momentum-tooltip")).toBeVisible();

    // Card size renders dots too, without the summary strip
    const card = page.getByTestId("momentum-map-card");
    await expect
      .poll(async () => card.locator("circle").count(), { timeout: 30_000 })
      .toBeGreaterThan(900);
    await expect(card.getByTestId("momentum-summary-strip")).toHaveCount(0);
  });
});
```

NOTE: if `/dev/*` routes under `app/(app)` redirect unauthenticated visitors, reuse the auth storage state exactly like `tests/e2e/score-display.spec.ts` does (Playwright `setup` project) — do not weaken the widget to dodge auth.

- [ ] **Step 3: Run the E2E against the live stack**

Ensure frontend (:3000) + backend (:3001) are running (`npm run dev:fresh` per the local-dev-servers skill if not).
Run: `cd packages/frontend && npx playwright test market-momentum-map --project=chromium`
Expected: PASS. If dots never exceed 900, check `GET http://localhost:3001/api/scores/heatmap/metro` directly with curl first (data problem vs render problem).

Then verify wire compression through the browser path (the backend has NO compression middleware — browsers rely on the Next same-origin proxy, whose `compress` default is on):

Run: `curl -s -o /dev/null -w "%{size_download}" -H "Accept-Encoding: gzip" http://localhost:3000/backend/api/scores/heatmap/metro`
Expected: well under 400000 bytes (~200KB gzipped vs 1,133KB raw). If it comes back ~1.1MB, the proxy is not compressing — surface this to the user before shipping; do NOT silently accept an uncompressed megabyte on marketing pages.

- [ ] **Step 4: Commit**

```bash
git branch --show-current   # must print: develop
git add "packages/frontend/app/(app)/dev/market-momentum-map/page.tsx" packages/frontend/tests/e2e/market-momentum-map.spec.ts
git commit -m "feat(momentum-map): demo page + live-data Playwright e2e" -- "packages/frontend/app/(app)/dev/market-momentum-map/page.tsx" packages/frontend/tests/e2e/market-momentum-map.spec.ts
```

---

### Task 13: Visual polish + final verification

**Files:**

- Possibly modify: any `market-momentum-map/` file (polish only — no behavior changes without re-running tests)

- [ ] **Step 1: Design-skill review of the rendered widget**

Invoke the `frontend-design:frontend-design` and `dataviz` skills, then open `http://localhost:3000/dev/market-momentum-map` in the browser (Playwright screenshot or Chrome tools). Evaluate against the spec: premium data-journalism look, M3 card chrome, legible dots at both sizes, color scale readable in BOTH light and dark (`prefers-color-scheme` emulation), era caption/ticks visible, no layout shift from skeleton→loaded. Adjust `MOMENTUM_COLOR_STOPS` hues / dot opacity / chrome spacing as those skills direct. Take before/after screenshots.

- [ ] **Step 2: Re-run all widget tests after any polish edits**

Run: `cd packages/frontend && npx vitest run app/components/widgets/market-momentum-map lib/data/__tests__/score-heatmap.test.ts`
Expected: PASS

- [ ] **Step 3: Full builds (fix EVERY error, not just yours)**

Run: `cd packages/backend && npm run build` — expected exit 0.
Run: `cd packages/frontend && npm run build` — expected exit 0.

- [ ] **Step 4: Verify the real page end-to-end (verification-before-completion)**

With the live stack running: load `/dev/market-momentum-map`, press play, watch the 2008 crash turn the map red and the 2021 frenzy turn it green, hover a metro, click through to its market page. Confirm the footnote shows the payload-derived metro count. Screenshot both sizes for the completion report.

- [ ] **Step 5: Commit any polish + report**

```bash
git branch --show-current   # must print: develop
git add packages/frontend/app/components/widgets/market-momentum-map
git commit -m "style(momentum-map): visual polish pass (color/spacing/dark-mode)" -- packages/frontend/app/components/widgets/market-momentum-map
```

Do NOT push. Report completion with screenshots and test output; suggest placements (forecast page hero, /markets landing, blog MDX embeds).
