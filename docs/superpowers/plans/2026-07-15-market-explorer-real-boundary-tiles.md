# Market Explorer: Real-Boundary Tile Maps + Population-Ranked Caps + Combined-Metric Redis Caching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the state-only `StateTileMap` grid with a real-boundary tile map usable at every drill level (state/metro/county/zip), fix the metric-visibility bug this exposed, and rework the backend to fetch all 8 metrics in one combined, Redis-cached response instead of 8 separate uncached requests.

**Architecture:** Backend caps region rosters per-tier (uncapped for metro/county — small everywhere real; capped at top-70-by-population for ZIP — thousands of possible county scopes with real 130+ ZIP outliers) and combines all 8 tracked metrics into one response per scope, cached in Redis with a TTL anchored to the actual monthly data-pipeline boundary rather than a flat window. Frontend fetches real state/metro/county boundary GeoJSON already in the repo (plus the existing per-state ZIP endpoint the main `/map` page already uses) and renders it via a new generalized `GeoTileMap` component, replacing the old 50-state-only grid.

**Tech Stack:** NestJS 11 + Supabase JS (backend), Next.js 16 App Router + React 19 + TanStack Query 5 (frontend), Tailwind v4 M3 tokens, inline SVG for all charts (no charting lib), Jest (backend tests), Vitest + @testing-library/react (frontend tests), ioredis (caching).

## Global Constraints

- **All frontend data fetching MUST go through `@/lib/data`** (fetchers + hooks) — geojson boundary fetching is the established exception (already handled by `app/(app)/map/utils/geojson-fetch.ts`, not `lib/data/`), reused here rather than duplicated. (CLAUDE.md §5)
- **Never hardcode metric formatting.** Use `formatExplorerValue`/`formatMetricValue` from the existing utilities. (CLAUDE.md §6)
- **Every API endpoint validates input** with `class-validator` DTOs + `ValidationPipe({ transform: true, whitelist: true })`. (CLAUDE.md §1.2)
- **No secret fallbacks; RLS is supreme; no `service_role` on the client.** This feature reads only public market/geography data through the anon-keyed Supabase client already injected as `SUPABASE_CLIENT`, plus Redis via the existing `@Global()` `RedisModule`. (CLAUDE.md §1.2)
- **File-size limits (hard):** logic/hook/util files ≤300 lines, React components ≤400 lines. `MarketExplorer.tsx` is already at 392/400 lines — Task 12 deliberately creates a new `ZipCapNotice.tsx` component instead of growing it further. (CLAUDE.md §1.3)
- **Score display uses the standardized components only:** `getScoreColor(value, maxValue=100)` from `app/components/scoring/ScoreDisplay`, reused by `GeoTileMap` exactly as `BubbleChart` already does. (CLAUDE.md §9)
- **Branch:** all work lands on a feature branch off `develop`. Never push without the user's ask. Commit with explicit pathspecs (`git commit -- <paths>`), verifying `git branch --show-current` first.
- **Run commands from the package directory.** Backend: `cd packages/backend`. Frontend: `cd packages/frontend`.
- **Design spec:** `docs/superpowers/specs/2026-07-15-market-explorer-real-boundary-tiles-design.md` — every task below implements a specific section of it; read it first if a task's rationale is unclear.

---

### Task 1: Tier-specific region caps + total-available count in `resolve-child-regions.ts`

**Files:**

- Modify: `packages/backend/src/market-explorer/resolve-child-regions.ts`
- Test: `packages/backend/src/market-explorer/__tests__/resolve-child-regions.spec.ts`

**Interfaces:**

- Consumes: `ScopeRegion` (`./market-explorer.types`), `SupabaseClient`.
- Produces:
  - `export const ZIP_FETCH_CAP = 70`
  - `snapshotRoster(supabase, geoLevel, ids, cap?: number): Promise<ScopeRegion[]>` — cap is an optional 4th param; omitting it returns every row uncapped.
  - `resolveChildRegions(supabase, geoLevel, parentLevel, parentId, includeNearby): Promise<ScopeRegion[]>` — same signature as today, metro/county uncapped, zip capped at `ZIP_FETCH_CAP`. **`NATIONAL_METRO_CAP` and `CHILD_CAP` are removed entirely.**
  - `resolveChildRegionsWithCount(supabase, geoLevel, parentLevel, parentId, includeNearby): Promise<{regions: ScopeRegion[]; totalAvailable: number}>` — same roster as `resolveChildRegions`, plus the true pre-cap row count (only differs from `regions.length` at the ZIP tier). Consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `packages/backend/src/market-explorer/__tests__/resolve-child-regions.spec.ts`:

```ts
import {
  resolveChildRegions,
  resolveChildRegionsWithCount,
  snapshotRoster,
  ZIP_FETCH_CAP,
} from "../resolve-child-regions";

/** Minimal thenable + range()/count-aware Supabase query-builder mock. */
function makeSupabase(handlers: {
  crosswalk?: (col: string, val: string) => any[];
  snapshot?: (ids: string[]) => any[];
  topMetroPages?: any[][]; // one array of rows per page, consumed in order
  countResult?: number;
}) {
  let pageCalls = 0;
  return {
    from(table: string) {
      const state: any = {
        table,
        _eqCol: null,
        _eqVal: null,
        _inIds: null,
        _isCount: false,
      };
      const builder: any = {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count) state._isCount = true;
          return builder;
        },
        eq: (c: string, v: string) => {
          state._eqCol = c;
          state._eqVal = v;
          return builder;
        },
        in: (_c: string, ids: string[]) => {
          state._inIds = ids;
          return builder;
        },
        not: () => builder,
        order: () => builder,
        limit: () => builder,
        range: async () => {
          const page = handlers.topMetroPages?.[pageCalls] ?? [];
          pageCalls++;
          return { data: page, error: null };
        },
        then: (resolve: any) => {
          if (state._isCount) {
            return Promise.resolve({
              count: handlers.countResult ?? 0,
              error: null,
            }).then(resolve);
          }
          let data: any[] = [];
          if (table === "geography_crosswalk")
            data = handlers.crosswalk!(state._eqCol, state._eqVal);
          else if (state._inIds) data = handlers.snapshot!(state._inIds);
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  } as any;
}

describe("resolveChildRegions", () => {
  it("returns every national-scope metro, unpaginated when under one page", async () => {
    const supabase = makeSupabase({
      topMetroPages: [
        [
          {
            region_id: "35620",
            region_name: "New York",
            state_code: "NY",
            population: 20000000,
          },
          {
            region_id: "31080",
            region_name: "Los Angeles",
            state_code: "CA",
            population: 13000000,
          },
        ],
      ],
    });
    const rows = await resolveChildRegions(
      supabase,
      "metro",
      undefined,
      undefined,
      false,
    );
    expect(rows).toEqual([
      { id: "35620", name: "New York", state: "NY", population: 20000000 },
      { id: "31080", name: "Los Angeles", state: "CA", population: 13000000 },
    ]);
  });

  it("paginates past a 1000-row page and returns every metro across pages", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      region_id: String(10000 + i),
      region_name: `Metro ${i}`,
      state_code: "XX",
      population: 1000000 - i,
    }));
    const page2 = [
      {
        region_id: "99999",
        region_name: "Last Metro",
        state_code: "YY",
        population: 100,
      },
    ];
    const supabase = makeSupabase({ topMetroPages: [page1, page2] });
    const rows = await resolveChildRegions(
      supabase,
      "metro",
      undefined,
      undefined,
      false,
    );
    expect(rows.length).toBe(1001);
    expect(rows[rows.length - 1].id).toBe("99999");
  });

  it("resolves counties of a metro via the crosswalk then reads snapshot names, uncapped", async () => {
    const supabase = makeSupabase({
      crosswalk: (col, val) => {
        expect(col).toBe("cbsa_code");
        expect(val).toBe("19100");
        return [{ county_fips: "48113" }, { county_fips: "48439" }];
      },
      snapshot: (ids) =>
        ids.map((id) => ({
          region_id: id,
          region_name: id === "48113" ? "Dallas County" : "Tarrant County",
          state_code: "TX",
          population: id === "48113" ? 2600000 : 2100000,
        })),
    });
    const rows = await resolveChildRegions(
      supabase,
      "county",
      "metro",
      "19100",
      false,
    );
    expect(rows.map((r) => r.id).sort()).toEqual(["48113", "48439"]);
    expect(rows[0].population).toBe(2600000); // sorted desc
  });

  it("does not cap county rosters even with more than 60 ids (regression: CHILD_CAP removed)", async () => {
    const ids = Array.from({ length: 75 }, (_, i) => String(48000 + i));
    const supabase = makeSupabase({
      crosswalk: () => ids.map((county_fips) => ({ county_fips })),
      snapshot: (chunkIds) =>
        chunkIds.map((id) => ({
          region_id: id,
          region_name: `County ${id}`,
          state_code: "TX",
          population: 1000,
        })),
    });
    const rows = await resolveChildRegions(
      supabase,
      "county",
      "metro",
      "19100",
      false,
    );
    expect(rows.length).toBe(75);
  });

  it("caps zip rosters at ZIP_FETCH_CAP even with more than 70 ids", async () => {
    const ids = Array.from({ length: 100 }, (_, i) => String(70000 + i));
    const supabase = makeSupabase({
      crosswalk: () => ids.map((zip_code) => ({ zip_code })),
      snapshot: (chunkIds) =>
        chunkIds.map((id, i) => ({
          region_id: id,
          region_name: `Zip ${id}`,
          state_code: "TX",
          population: 100000 - i,
        })),
    });
    const rows = await resolveChildRegions(
      supabase,
      "zip",
      "county",
      "48113",
      false,
    );
    expect(rows.length).toBe(ZIP_FETCH_CAP);
  });

  it("returns empty for state geoLevel (states come from US_STATES constant)", async () => {
    const supabase = makeSupabase({});
    expect(
      await resolveChildRegions(supabase, "state", undefined, undefined, false),
    ).toEqual([]);
  });
});

describe("snapshotRoster", () => {
  it("returns every row uncapped when no cap is passed", async () => {
    const ids = Array.from({ length: 80 }, (_, i) => String(i));
    const supabase = makeSupabase({
      snapshot: (chunkIds) =>
        chunkIds.map((id) => ({
          region_id: id,
          region_name: `R${id}`,
          state_code: "TX",
          population: 1,
        })),
    });
    const rows = await snapshotRoster(supabase, "county", ids);
    expect(rows.length).toBe(80);
  });

  it("caps at the given number when a cap is passed", async () => {
    const ids = Array.from({ length: 80 }, (_, i) => String(i));
    const supabase = makeSupabase({
      snapshot: (chunkIds) =>
        chunkIds.map((id) => ({
          region_id: id,
          region_name: `R${id}`,
          state_code: "TX",
          population: 1,
        })),
    });
    const rows = await snapshotRoster(supabase, "zip", ids, 10);
    expect(rows.length).toBe(10);
  });
});

describe("resolveChildRegionsWithCount", () => {
  it("returns totalAvailable alongside a capped zip roster", async () => {
    const supabase = makeSupabase({
      crosswalk: () =>
        Array.from({ length: 140 }, (_, i) => ({ zip_code: `Z${i}` })),
      snapshot: (ids) =>
        ids.map((id, i) => ({
          region_id: id,
          region_name: id,
          state_code: "CA",
          population: 140 - i,
        })),
      countResult: 140,
    });
    const { regions, totalAvailable } = await resolveChildRegionsWithCount(
      supabase,
      "zip",
      "county",
      "06037",
      false,
    );
    expect(regions.length).toBe(70); // ZIP_FETCH_CAP
    expect(totalAvailable).toBe(140);
  });

  it("totalAvailable equals regions.length for uncapped tiers (metro/county)", async () => {
    const supabase = makeSupabase({
      crosswalk: () => [{ county_fips: "48113" }, { county_fips: "48439" }],
      snapshot: (ids) =>
        ids.map((id) => ({
          region_id: id,
          region_name: id,
          state_code: "TX",
          population: 1,
        })),
    });
    const { regions, totalAvailable } = await resolveChildRegionsWithCount(
      supabase,
      "county",
      "metro",
      "19100",
      false,
    );
    expect(totalAvailable).toBe(regions.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/resolve-child-regions.spec.ts`
Expected: FAIL — `ZIP_FETCH_CAP`/`resolveChildRegionsWithCount` not exported yet; current implementation is single-page/`CHILD_CAP`-limited.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `packages/backend/src/market-explorer/resolve-child-regions.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { ScopeRegion } from "./market-explorer.types";

export const ZIP_FETCH_CAP = 70;

const CHILD_COL: Record<string, string> = {
  metro: "cbsa_code",
  county: "county_fips",
  zip: "zip_code",
};
const PARENT_COL: Record<string, string> = {
  state: "state_fips",
  metro: "cbsa_code",
  county: "county_fips",
};

export async function distinctCrosswalkIds(
  supabase: SupabaseClient,
  childCol: string,
  parentCol: string,
  parentId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("geography_crosswalk")
    .select(childCol)
    .eq(parentCol, parentId)
    .not(childCol, "is", null)
    .limit(5000);
  if (error || !data) return [];
  return [
    ...new Set(
      (data as any[]).map((r) => r[childCol] as string).filter(Boolean),
    ),
  ];
}

/**
 * Ordered roster of screener_snapshot rows for the given region ids.
 * Uncapped unless `cap` is passed (only the ZIP tier caps today — see
 * resolveChildRegions and resolve-nearby-regions.ts).
 */
export async function snapshotRoster(
  supabase: SupabaseClient,
  geoLevel: string,
  ids: string[],
  cap?: number,
): Promise<ScopeRegion[]> {
  if (!ids.length) return [];
  const out: ScopeRegion[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase
      .from("screener_snapshot")
      .select("region_id, region_name, state_code, population")
      .eq("geo_level", geoLevel)
      .in("region_id", ids.slice(i, i + 300));
    for (const r of (data ?? []) as any[]) {
      out.push({
        id: r.region_id,
        name: r.region_name,
        state: r.state_code,
        population: r.population ?? null,
      });
    }
  }
  out.sort((a, b) => (b.population ?? -1) - (a.population ?? -1));
  return cap ? out.slice(0, cap) : out;
}

const SNAPSHOT_PAGE = 1000;

/**
 * Every screener_snapshot metro row, paginated past PostgREST's default
 * 1000-row cap. The real roster is ~935 today (includes micropolitan areas,
 * not just true CBSA metros — verified live) but this must not silently
 * truncate if it grows.
 */
async function allNationalMetros(
  supabase: SupabaseClient,
): Promise<ScopeRegion[]> {
  const rows: any[] = [];
  let offset = 0;
  let page: any[];
  do {
    const { data } = await supabase
      .from("screener_snapshot")
      .select("region_id, region_name, state_code, population")
      .eq("geo_level", "metro")
      .order("population", { ascending: false, nullsFirst: false })
      .range(offset, offset + SNAPSHOT_PAGE - 1);
    page = (data ?? []) as any[];
    rows.push(...page);
    offset += page.length;
  } while (page.length === SNAPSHOT_PAGE);
  return rows.map((r) => ({
    id: r.region_id,
    name: r.region_name,
    state: r.state_code,
    population: r.population ?? null,
  }));
}

/**
 * Ordered roster of a scope's child regions. Uncapped for metro and county
 * (small at every real scope — largest state has ~50-67 metros, largest metro
 * has a few dozen counties); ZIP tier is capped at ZIP_FETCH_CAP because it
 * has thousands of possible county parent-scopes and real outlier counties
 * run 130-140 ZIPs, which is what actually drives Redis memory pressure (see
 * docs/superpowers/specs/2026-07-15-market-explorer-real-boundary-tiles-design.md §2).
 */
export async function resolveChildRegions(
  supabase: SupabaseClient,
  geoLevel: string,
  parentLevel: string | undefined,
  parentId: string | undefined,
  _includeNearby: boolean,
): Promise<ScopeRegion[]> {
  if (geoLevel === "state") return [];
  if (geoLevel === "metro" && !parentId) return allNationalMetros(supabase);
  if (!parentLevel || !parentId) return [];
  const ids = await distinctCrosswalkIds(
    supabase,
    CHILD_COL[geoLevel],
    PARENT_COL[parentLevel],
    parentId,
  );
  return snapshotRoster(
    supabase,
    geoLevel,
    ids,
    geoLevel === "zip" ? ZIP_FETCH_CAP : undefined,
  );
}

/** Exact row count for a resolved id list at a geo level, without fetching the rows. */
async function countSnapshotRows(
  supabase: SupabaseClient,
  geoLevel: string,
  ids: string[],
): Promise<number> {
  if (!ids.length) return 0;
  let total = 0;
  for (let i = 0; i < ids.length; i += 300) {
    const { count } = await supabase
      .from("screener_snapshot")
      .select("region_id", { count: "exact", head: true })
      .eq("geo_level", geoLevel)
      .in("region_id", ids.slice(i, i + 300));
    total += count ?? 0;
  }
  return total;
}

/**
 * Same as resolveChildRegions, but also reports how many rows existed before
 * any cap was applied — only meaningfully differs from regions.length at the
 * ZIP tier, since metro/county/national-metro are never capped.
 */
export async function resolveChildRegionsWithCount(
  supabase: SupabaseClient,
  geoLevel: string,
  parentLevel: string | undefined,
  parentId: string | undefined,
  includeNearby: boolean,
): Promise<{ regions: ScopeRegion[]; totalAvailable: number }> {
  const regions = await resolveChildRegions(
    supabase,
    geoLevel,
    parentLevel,
    parentId,
    includeNearby,
  );
  if (geoLevel !== "zip" || !parentLevel || !parentId) {
    return { regions, totalAvailable: regions.length };
  }
  const ids = await distinctCrosswalkIds(
    supabase,
    CHILD_COL[geoLevel],
    PARENT_COL[parentLevel],
    parentId,
  );
  const totalAvailable = await countSnapshotRows(supabase, geoLevel, ids);
  return { regions, totalAvailable };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/resolve-child-regions.spec.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-explorer/resolve-child-regions.ts packages/backend/src/market-explorer/__tests__/resolve-child-regions.spec.ts
git commit -m "feat(market-explorer): tier-specific region caps + totalAvailable count for the capped ZIP tier"
```

---

### Task 2: Update `resolve-nearby-regions.ts`'s ZIP call site to respect `ZIP_FETCH_CAP`

**Files:**

- Modify: `packages/backend/src/market-explorer/resolve-nearby-regions.ts`
- Test: `packages/backend/src/market-explorer/__tests__/resolve-nearby-regions.spec.ts` (existing file — add one new test)

**Interfaces:**

- Consumes: `ZIP_FETCH_CAP`, `distinctCrosswalkIds`, `snapshotRoster` (all from `./resolve-child-regions`, per Task 1).
- Produces: `resolveNearbyRegions(supabase, geoLevel, parentLevel, parentId): Promise<ScopeRegion[]>` — signature unchanged; zip-branch behavior now capped.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('resolveNearbyRegions', ...)` block in `packages/backend/src/market-explorer/__tests__/resolve-nearby-regions.spec.ts`:

```ts
it("caps the zip-nearby branch at ZIP_FETCH_CAP even with more sibling zips than that", async () => {
  const manyZips = Array.from({ length: 90 }, (_, i) => `7600${i}`);
  const supabase = makeSupabase({
    crosswalk: (eqCol, eqVal, selectCol) => {
      if (
        eqCol === "county_fips" &&
        eqVal === "48113" &&
        selectCol === "cbsa_code"
      )
        return ["19100"];
      if (
        eqCol === "cbsa_code" &&
        eqVal === "19100" &&
        selectCol === "county_fips"
      )
        return ["48113", "48439"];
      if (
        eqCol === "county_fips" &&
        eqVal === "48439" &&
        selectCol === "zip_code"
      )
        return manyZips;
      return [];
    },
    roster: (ids) =>
      ids.map((id, i) => ({
        region_id: id,
        region_name: `ZIP ${id}`,
        state_code: "TX",
        population: 100000 - i,
      })),
  });
  const rows = await resolveNearbyRegions(supabase, "zip", "county", "48113");
  expect(rows.length).toBe(70); // ZIP_FETCH_CAP
  expect(rows.every((r) => r.nearby === true)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/resolve-nearby-regions.spec.ts`
Expected: FAIL — `rows.length` is 90, not 70.

- [ ] **Step 3: Write minimal implementation**

In `packages/backend/src/market-explorer/resolve-nearby-regions.ts`, change the import line:

```ts
import {
  distinctCrosswalkIds,
  snapshotRoster,
  ZIP_FETCH_CAP,
} from "./resolve-child-regions";
```

And change the ZIP branch's return statement from:

```ts
return mark(await snapshotRoster(supabase, "zip", uniq(zipLists.flat())));
```

to:

```ts
return mark(
  await snapshotRoster(supabase, "zip", uniq(zipLists.flat()), ZIP_FETCH_CAP),
);
```

The metro branch (`snapshotRoster(supabase, 'metro', uniq(cbsas))`) and county branch (`snapshotRoster(supabase, 'county', uniq(countyLists.flat())))`) are unchanged — Task 1 made the cap param optional, so these stay uncapped with no edit needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/resolve-nearby-regions.spec.ts`
Expected: PASS (all existing tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-explorer/resolve-nearby-regions.ts packages/backend/src/market-explorer/__tests__/resolve-nearby-regions.spec.ts
git commit -m "feat(market-explorer): cap zip-nearby sibling roster at ZIP_FETCH_CAP"
```

---

### Task 3: `alignAndMergeMetrics` — align all 8 metrics onto one shared date axis

**Files:**

- Create: `packages/backend/src/market-explorer/merge-metric-series.ts`
- Test: `packages/backend/src/market-explorer/__tests__/merge-metric-series.spec.ts`

**Interfaces:**

- Consumes: `MetricRow`, `alignSeriesToAxis(rows, months, anchorDate?)` (`./align-series`, unchanged).
- Produces:
  - `interface MetricSeriesInput { metric: string; rows: MetricRow[] }`
  - `interface MergedMetricSeries { dates: string[]; series: Record<string, Record<string, (number | null)[]>> }` (`series[metric][regionId]`)
  - `function alignAndMergeMetrics(perMetric: MetricSeriesInput[], months: number): MergedMetricSeries`

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/market-explorer/__tests__/merge-metric-series.spec.ts
import { alignAndMergeMetrics } from "../merge-metric-series";

describe("alignAndMergeMetrics", () => {
  it("anchors all metrics on the latest date present across ANY metric, padding laggards with trailing nulls", () => {
    const result = alignAndMergeMetrics(
      [
        {
          metric: "home_value",
          rows: [
            { regionId: "A", date: "2026-04-15", value: 100 },
            { regionId: "A", date: "2026-05-15", value: 110 },
          ],
        },
        {
          metric: "hotness_score",
          rows: [{ regionId: "A", date: "2026-04-01", value: 70 }],
        },
      ],
      2,
    );
    expect(result.dates).toEqual(["2026-04-01", "2026-05-01"]);
    expect(result.series.home_value.A).toEqual([100, 110]);
    expect(result.series.hotness_score.A).toEqual([70, null]);
  });

  it("gives a metric with zero rows an empty series object instead of crashing", () => {
    const result = alignAndMergeMetrics(
      [
        {
          metric: "home_value",
          rows: [{ regionId: "A", date: "2026-05-01", value: 100 }],
        },
        { metric: "hotness_score", rows: [] },
      ],
      1,
    );
    expect(result.dates).toEqual(["2026-05-01"]);
    expect(result.series.home_value.A).toEqual([100]);
    expect(result.series.hotness_score).toEqual({});
  });

  it("returns empty dates/series when every metric has zero rows", () => {
    expect(
      alignAndMergeMetrics(
        [
          { metric: "home_value", rows: [] },
          { metric: "hotness_score", rows: [] },
        ],
        6,
      ),
    ).toEqual({ dates: [], series: {} });
  });

  it("returns empty dates/series for an empty metric list", () => {
    expect(alignAndMergeMetrics([], 6)).toEqual({ dates: [], series: {} });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/merge-metric-series.spec.ts`
Expected: FAIL with "Cannot find module '../merge-metric-series'".

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/backend/src/market-explorer/merge-metric-series.ts
import { MetricRow, alignSeriesToAxis } from "./align-series";

export interface MetricSeriesInput {
  metric: string;
  rows: MetricRow[];
}

export interface MergedMetricSeries {
  dates: string[];
  series: Record<string, Record<string, (number | null)[]>>;
}

/**
 * Aligns each metric's raw rows to a monthly axis anchored on the latest date
 * present across ALL metrics (not each metric's own latest), so every metric
 * comes back on an identical `dates` array — no separate merge/realignment
 * step needed downstream. A metric that lags behind the others just shows
 * trailing nulls for the months it hasn't caught up on yet.
 */
export function alignAndMergeMetrics(
  perMetric: MetricSeriesInput[],
  months: number,
): MergedMetricSeries {
  let anchorDate: string | undefined;
  for (const { rows } of perMetric) {
    for (const r of rows) {
      if (!anchorDate || r.date > anchorDate) anchorDate = r.date;
    }
  }
  if (!anchorDate) return { dates: [], series: {} };

  const series: Record<string, Record<string, (number | null)[]>> = {};
  let dates: string[] = [];
  for (const { metric, rows } of perMetric) {
    const aligned = alignSeriesToAxis(rows, months, anchorDate);
    dates = aligned.dates;
    series[metric] = aligned.series;
  }
  return { dates, series };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/merge-metric-series.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-explorer/merge-metric-series.ts packages/backend/src/market-explorer/__tests__/merge-metric-series.spec.ts
git commit -m "feat(market-explorer): alignAndMergeMetrics - shared-axis merge for combined-metric responses"
```

---

### Task 4: Combined-metric response — service, types, DTO, controller (+ `totalAvailable`)

**Files:**

- Create: `packages/backend/src/market-explorer/market-explorer-metrics.ts`
- Modify: `packages/backend/src/market-explorer/market-explorer.service.ts`
- Modify: `packages/backend/src/market-explorer/market-explorer.types.ts`
- Modify: `packages/backend/src/market-explorer/market-explorer.dto.ts`
- Modify: `packages/backend/src/market-explorer/market-explorer.controller.ts`
- Test: `packages/backend/src/market-explorer/__tests__/market-explorer.service.spec.ts` (full rewrite)

**Interfaces:**

- Consumes: `alignAndMergeMetrics` (Task 3), `resolveChildRegionsWithCount`/`resolveNearbyRegions` (Task 1/2), `fetchMetricSeriesForRegions(supabase, metricId, geoLevel, regionIds, startDate): Promise<MetricRow[]>`, `fetchStateMetricSeries(supabase, metricId, startDate): Promise<MetricRow[]>` (both unchanged), `stateRegions()` (unchanged).
- Produces:
  - `FETCHED_METRICS: readonly string[]` (`./market-explorer-metrics`)
  - `ScopeSeriesResponse { success: true; geoLevel: string; months: number; dates: string[]; regions: ScopeRegion[]; series: Record<string, Record<string, (number | null)[]>>; totalAvailable?: number }` — **`metric` field removed**, `series` nested by metric then region, `totalAvailable` present only when a roster was actually capped (ZIP tier).
  - `ScopeQueryDto` — **`metric` field removed**.
  - `MarketExplorerService.getScopeSeries(geoLevel: string, dto: ScopeQueryDto): Promise<ScopeSeriesResponse>` — same name/signature, now returns all 8 metrics per call. No Redis yet (Task 5 adds it).

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/market-explorer/__tests__/market-explorer.service.spec.ts
import { MarketExplorerService } from "../market-explorer.service";

describe("MarketExplorerService.getScopeSeries", () => {
  it("state scope: uses stateRegions + RPC and returns a combined multi-metric response, no totalAvailable", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: [
          { state_fips: "48", score_date: "2026-04-01", avg_score: 54 },
          { state_fips: "48", score_date: "2026-05-01", avg_score: 55 },
          { state_fips: "06", score_date: "2026-05-01", avg_score: 60 },
        ],
        error: null,
      }),
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gte() {
          return this;
        },
        not() {
          return this;
        },
        order() {
          return this;
        },
        range: async () => ({ data: [], error: null }),
      }),
    } as any;
    const service = new MarketExplorerService(supabase);
    const res = await service.getScopeSeries("state", { months: 3 } as any);
    expect(res.regions.length).toBe(51);
    expect(res.dates).toEqual(["2026-03-01", "2026-04-01", "2026-05-01"]);
    expect(res.series.propertyiq_score["48"]).toEqual([null, 54, 55]);
    expect(res.series.propertyiq_score["06"]).toEqual([null, null, 60]);
    expect(Object.keys(res.series).sort()).toEqual(
      [
        "days_on_market",
        "for_sale_inventory",
        "home_sales",
        "home_value",
        "hotness_score",
        "new_listings",
        "propertyiq_score",
        "rent_index",
      ].sort(),
    );
    expect((res as any).metric).toBeUndefined();
    expect(res.totalAvailable).toBeUndefined();
  });

  it("national metro scope: roster from screener_snapshot, at least one metric series populated per region", async () => {
    let snapshotCalls = 0;
    const supabase = {
      rpc: jest.fn(),
      from: (table: string) => {
        if (table === "screener_snapshot") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            order() {
              return this;
            },
            range: async (from: number) => {
              snapshotCalls++;
              return {
                data:
                  from === 0
                    ? [
                        {
                          region_id: "35620",
                          region_name: "New York",
                          state_code: "NY",
                          population: 20000000,
                        },
                      ]
                    : [],
                error: null,
              };
            },
          };
        }
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          gte() {
            return this;
          },
          order() {
            return this;
          },
          range: async () => ({ data: [], error: null }),
        };
      },
    } as any;
    const service = new MarketExplorerService(supabase);
    const res = await service.getScopeSeries("metro", { months: 2 } as any);
    expect(res.regions[0].id).toBe("35620");
    expect(snapshotCalls).toBeGreaterThan(0);
    expect(Object.keys(res.series)).toContain("propertyiq_score");
    expect(res.totalAvailable).toBeUndefined(); // national metro is uncapped, so no cap was applied
  });

  it("zip scope: includes totalAvailable when the roster was actually capped", async () => {
    const supabase = {
      rpc: jest.fn(),
      from: (table: string) => {
        if (table === "geography_crosswalk") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  limit: async () => ({
                    data: Array.from({ length: 90 }, (_, i) => ({
                      zip_code: `Z${i}`,
                    })),
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "screener_snapshot") {
          return {
            select: (_cols: string, opts?: { count?: string }) => {
              if (opts?.count) {
                return {
                  eq: () => ({ in: async () => ({ count: 90, error: null }) }),
                };
              }
              return {
                eq: () => ({
                  in: async (_c: string, ids: string[]) => ({
                    data: ids
                      .slice(0, 70)
                      .map((id, i) => ({
                        region_id: id,
                        region_name: id,
                        state_code: "CA",
                        population: 90 - i,
                      })),
                    error: null,
                  }),
                }),
              };
            },
          };
        }
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          in() {
            return this;
          },
          gte() {
            return this;
          },
          order() {
            return this;
          },
          range: async () => ({ data: [], error: null }),
        };
      },
    } as any;
    const service = new MarketExplorerService(supabase);
    const res = await service.getScopeSeries("zip", {
      parentLevel: "county",
      parentId: "06037",
      months: 1,
    } as any);
    expect(res.regions.length).toBe(70);
    expect(res.totalAvailable).toBe(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/market-explorer.service.spec.ts`
Expected: FAIL — `res.series.propertyiq_score` undefined (current code returns flat `series[regionId]` keyed by a `dto.metric` the test no longer supplies), `totalAvailable` doesn't exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/backend/src/market-explorer/market-explorer-metrics.ts
/**
 * The 8 timeseries metrics fetched for every scope request. Mirrors the
 * frontend's FETCHED_METRICS
 * (packages/frontend/app/(app)/market/explorer/lib/explorer-config.ts) —
 * kept as a duplicated literal rather than a shared package, matching this
 * repo's existing pattern for small cross-stack config.
 */
export const FETCHED_METRICS = [
  "propertyiq_score",
  "home_value",
  "rent_index",
  "for_sale_inventory",
  "days_on_market",
  "hotness_score",
  "new_listings",
  "home_sales",
] as const;
export type FetchedMetric = (typeof FETCHED_METRICS)[number];
```

```ts
// packages/backend/src/market-explorer/market-explorer.types.ts
export interface ScopeRegion {
  id: string;
  name: string;
  state: string;
  population: number | null;
  nearby?: boolean;
}

export interface ScopeSeriesResponse {
  success: true;
  geoLevel: string;
  months: number;
  dates: string[];
  regions: ScopeRegion[];
  series: Record<string, Record<string, (number | null)[]>>;
  /** Present only when the roster was capped below the true count (ZIP tier). */
  totalAvailable?: number;
}
```

```ts
// packages/backend/src/market-explorer/market-explorer.dto.ts
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export const SCOPE_GEO_LEVELS = ["state", "metro", "county", "zip"] as const;
export type ScopeGeoLevel = (typeof SCOPE_GEO_LEVELS)[number];

export const PARENT_LEVELS = ["state", "metro", "county"] as const;

export class ScopeQueryDto {
  @IsOptional()
  @IsIn(PARENT_LEVELS)
  parentLevel?: "state" | "metro" | "county";

  @IsOptional()
  @IsString()
  parentId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  months!: number;

  @IsOptional()
  @Type(() => Boolean)
  includeNearby?: boolean;
}
```

```ts
// packages/backend/src/market-explorer/market-explorer.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { ScopeQueryDto } from "./market-explorer.dto";
import { ScopeSeriesResponse } from "./market-explorer.types";
import { resolveChildRegionsWithCount } from "./resolve-child-regions";
import { resolveNearbyRegions } from "./resolve-nearby-regions";
import { fetchMetricSeriesForRegions } from "./fetch-metric-series";
import { fetchStateMetricSeries } from "./fetch-state-series";
import { stateRegions } from "./us-states";
import { alignAndMergeMetrics } from "./merge-metric-series";
import { FETCHED_METRICS } from "./market-explorer-metrics";

/** First-of-month ISO string `months` months back from today (inclusive window start). */
function windowStart(months: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

@Injectable()
export class MarketExplorerService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getScopeSeries(
    geoLevel: string,
    dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    const startDate = windowStart(dto.months);

    let regions;
    let totalAvailable: number | undefined;
    if (geoLevel === "state") {
      regions = stateRegions();
    } else {
      const resolved = await resolveChildRegionsWithCount(
        this.supabase,
        geoLevel,
        dto.parentLevel,
        dto.parentId,
        !!dto.includeNearby,
      );
      regions = resolved.regions;
      if (resolved.totalAvailable > regions.length)
        totalAvailable = resolved.totalAvailable;
      if (dto.includeNearby) {
        const nearby = await resolveNearbyRegions(
          this.supabase,
          geoLevel,
          dto.parentLevel,
          dto.parentId,
        );
        const have = new Set(regions.map((r) => r.id));
        regions = [...regions, ...nearby.filter((n) => !have.has(n.id))];
      }
    }

    const regionIds = regions.map((r) => r.id);
    const perMetric = await Promise.all(
      FETCHED_METRICS.map(async (metric) => ({
        metric,
        rows:
          geoLevel === "state"
            ? await fetchStateMetricSeries(this.supabase, metric, startDate)
            : await fetchMetricSeriesForRegions(
                this.supabase,
                metric,
                geoLevel,
                regionIds,
                startDate,
              ),
      })),
    );

    const { dates, series } = alignAndMergeMetrics(perMetric, dto.months);
    return {
      success: true,
      geoLevel,
      months: dto.months,
      dates,
      regions,
      series,
      ...(totalAvailable != null ? { totalAvailable } : {}),
    };
  }
}
```

```ts
// packages/backend/src/market-explorer/market-explorer.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam } from "@nestjs/swagger";
import { MarketExplorerService } from "./market-explorer.service";
import { ScopeQueryDto, SCOPE_GEO_LEVELS } from "./market-explorer.dto";
import { ScopeSeriesResponse } from "./market-explorer.types";

@ApiTags("market-explorer")
@Controller("api/market-explorer")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MarketExplorerController {
  constructor(private readonly service: MarketExplorerService) {}

  @Get("scope/:geoLevel")
  @ApiOperation({
    summary:
      "All 8 tracked metrics across every child region of a scope, aligned to a shared monthly axis",
  })
  @ApiParam({ name: "geoLevel", enum: [...SCOPE_GEO_LEVELS] })
  async getScope(
    @Param("geoLevel") geoLevel: string,
    @Query() dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    const level = geoLevel.toLowerCase();
    if (!(SCOPE_GEO_LEVELS as readonly string[]).includes(level)) {
      throw new HttpException(
        `Invalid geoLevel: ${geoLevel}. Valid: ${SCOPE_GEO_LEVELS.join(", ")}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.service.getScopeSeries(level, dto);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/market-explorer.service.spec.ts`
Expected: PASS (3 tests). Then run the whole module: `cd packages/backend && npx jest src/market-explorer`.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-explorer/market-explorer-metrics.ts packages/backend/src/market-explorer/market-explorer.service.ts packages/backend/src/market-explorer/market-explorer.types.ts packages/backend/src/market-explorer/market-explorer.dto.ts packages/backend/src/market-explorer/market-explorer.controller.ts packages/backend/src/market-explorer/__tests__/market-explorer.service.spec.ts
git commit -m "feat(market-explorer): combine all 8 metrics into one scope response, surface totalAvailable when capped"
```

---

### Task 5: Redis read-through caching, pipeline-aligned TTL

**Files:**

- Modify: `packages/backend/src/market-explorer/market-explorer.service.ts`
- Test: `packages/backend/src/market-explorer/__tests__/market-explorer.service.spec.ts` (add cases)

**Interfaces:**

- Consumes: `RedisService.getByKey(key: string): Promise<any | null>`, `RedisService.setByKey(key: string, value: any, ttlSeconds: number): Promise<boolean>` (`../redis/redis.service`, unchanged, `@Global()`-provided — no module import needed), `ttlUntilNextRefresh(now?: Date): number` (`../market-snapshot/market-snapshot-ttl.helper`, unchanged).
- Produces: `MarketExplorerService` constructor now takes `(supabase: SupabaseClient, redis: RedisService)` — **breaking change**, Task 4's tests get a `fakeRedis()` 2nd arg. `getScopeSeries` keeps its public signature; Task 4's body moves to a new private `buildScopeSeries`.

- [ ] **Step 1: Write the failing test**

In `market-explorer.service.spec.ts`, add a `RedisService` import and a `fakeRedis` helper, update the 3 existing tests from Task 4 to pass `fakeRedis()` as the 2nd constructor arg, and add a new `describe` block:

```ts
import { MarketExplorerService } from "../market-explorer.service";
import { RedisService } from "../../redis/redis.service";

function fakeRedis(overrides: Partial<RedisService> = {}): RedisService {
  return {
    getByKey: jest.fn().mockResolvedValue(null),
    setByKey: jest.fn().mockResolvedValue(true),
    ...overrides,
  } as any;
}

// Update every `new MarketExplorerService(supabase)` call from Task 4 to
// `new MarketExplorerService(supabase, fakeRedis())`.

describe("MarketExplorerService caching", () => {
  it("returns the cached value on hit without touching Supabase", async () => {
    const cachedResponse = {
      success: true,
      geoLevel: "state",
      months: 3,
      dates: ["2026-05-01"],
      regions: [],
      series: {},
    };
    const supabase = {
      rpc: jest
        .fn()
        .mockRejectedValue(new Error("should not be called on cache hit")),
    } as any;
    const redis = fakeRedis({
      getByKey: jest.fn().mockResolvedValue(cachedResponse),
    });
    const service = new MarketExplorerService(supabase, redis);
    const res = await service.getScopeSeries("state", { months: 3 } as any);
    expect(res).toEqual(cachedResponse);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("on cache miss, builds the response and writes it back with the pipeline-aligned TTL", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gte() {
          return this;
        },
        not() {
          return this;
        },
        order() {
          return this;
        },
        range: async () => ({ data: [], error: null }),
      }),
    } as any;
    const redis = fakeRedis();
    const service = new MarketExplorerService(supabase, redis);
    await service.getScopeSeries("state", { months: 3 } as any);
    expect(redis.setByKey).toHaveBeenCalledTimes(1);
    const [key, , ttlSeconds] = (redis.setByKey as jest.Mock).mock.calls[0];
    expect(key).toBe("market-explorer:v2:state:::false");
    expect(ttlSeconds).toBeGreaterThan(0);
  });

  it("still returns a correct built result when Redis is unavailable (getByKey/setByKey no-op)", async () => {
    const supabase = {
      rpc: jest
        .fn()
        .mockResolvedValue({
          data: [{ state_fips: "48", score_date: "2026-05-01", avg_score: 61 }],
          error: null,
        }),
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        gte() {
          return this;
        },
        not() {
          return this;
        },
        order() {
          return this;
        },
        range: async () => ({ data: [], error: null }),
      }),
    } as any;
    const redis = fakeRedis({
      getByKey: jest.fn().mockResolvedValue(null),
      setByKey: jest.fn().mockResolvedValue(false),
    });
    const service = new MarketExplorerService(supabase, redis);
    const res = await service.getScopeSeries("state", { months: 1 } as any);
    expect(res.series.propertyiq_score["48"]).toEqual([61]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/market-explorer.service.spec.ts`
Expected: FAIL — extra constructor arg / `redis.setByKey`/`getByKey` never called.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/backend/src/market-explorer/market-explorer.service.ts
import { Injectable, Inject, Logger } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { ScopeQueryDto } from "./market-explorer.dto";
import { ScopeSeriesResponse } from "./market-explorer.types";
import { resolveChildRegionsWithCount } from "./resolve-child-regions";
import { resolveNearbyRegions } from "./resolve-nearby-regions";
import { fetchMetricSeriesForRegions } from "./fetch-metric-series";
import { fetchStateMetricSeries } from "./fetch-state-series";
import { stateRegions } from "./us-states";
import { alignAndMergeMetrics } from "./merge-metric-series";
import { FETCHED_METRICS } from "./market-explorer-metrics";
import { RedisService } from "../redis/redis.service";
import { ttlUntilNextRefresh } from "../market-snapshot/market-snapshot-ttl.helper";

function windowStart(months: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

@Injectable()
export class MarketExplorerService {
  private readonly logger = new Logger(MarketExplorerService.name);

  /** De-dupes concurrent cold-cache builds for the same key. Mirrors MarketSnapshotService's inflightSnapshots guard. */
  private readonly inflightScopes = new Map<
    string,
    Promise<ScopeSeriesResponse>
  >();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redis: RedisService,
  ) {}

  /**
   * Public entry point: a Redis read-through cache around the expensive
   * multi-metric scope build. Degrades gracefully when Redis is absent.
   */
  async getScopeSeries(
    geoLevel: string,
    dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    const cacheKey = `market-explorer:v2:${geoLevel}:${dto.parentLevel ?? ""}:${dto.parentId ?? ""}:${!!dto.includeNearby}`;

    const cached = (await this.redis.getByKey(
      cacheKey,
    )) as ScopeSeriesResponse | null;
    if (cached) return cached;

    const inflight = this.inflightScopes.get(cacheKey);
    if (inflight) return inflight;

    const build = (async () => {
      const result = await this.buildScopeSeries(geoLevel, dto);
      const ttlSeconds = ttlUntilNextRefresh();
      const wrote = await this.redis.setByKey(cacheKey, result, ttlSeconds);
      if (wrote) {
        this.logger.log(
          `[Scope Cache] SET ${cacheKey} (TTL: ${ttlSeconds}s, expires ${new Date(Date.now() + ttlSeconds * 1000).toISOString()})`,
        );
      }
      return result;
    })();

    this.inflightScopes.set(cacheKey, build);
    try {
      return await build;
    } finally {
      this.inflightScopes.delete(cacheKey);
    }
  }

  private async buildScopeSeries(
    geoLevel: string,
    dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    const startDate = windowStart(dto.months);

    let regions;
    let totalAvailable: number | undefined;
    if (geoLevel === "state") {
      regions = stateRegions();
    } else {
      const resolved = await resolveChildRegionsWithCount(
        this.supabase,
        geoLevel,
        dto.parentLevel,
        dto.parentId,
        !!dto.includeNearby,
      );
      regions = resolved.regions;
      if (resolved.totalAvailable > regions.length)
        totalAvailable = resolved.totalAvailable;
      if (dto.includeNearby) {
        const nearby = await resolveNearbyRegions(
          this.supabase,
          geoLevel,
          dto.parentLevel,
          dto.parentId,
        );
        const have = new Set(regions.map((r) => r.id));
        regions = [...regions, ...nearby.filter((n) => !have.has(n.id))];
      }
    }

    const regionIds = regions.map((r) => r.id);
    const perMetric = await Promise.all(
      FETCHED_METRICS.map(async (metric) => ({
        metric,
        rows:
          geoLevel === "state"
            ? await fetchStateMetricSeries(this.supabase, metric, startDate)
            : await fetchMetricSeriesForRegions(
                this.supabase,
                metric,
                geoLevel,
                regionIds,
                startDate,
              ),
      })),
    );

    const { dates, series } = alignAndMergeMetrics(perMetric, dto.months);
    return {
      success: true,
      geoLevel,
      months: dto.months,
      dates,
      regions,
      series,
      ...(totalAvailable != null ? { totalAvailable } : {}),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/market-explorer.service.spec.ts`
Expected: PASS (6 tests — 3 from Task 4 updated to pass `fakeRedis()`, plus 3 new caching tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-explorer/market-explorer.service.ts packages/backend/src/market-explorer/__tests__/market-explorer.service.spec.ts
git commit -m "feat(market-explorer): Redis read-through cache with pipeline-aligned TTL (reuses MarketSnapshotService's ttlUntilNextRefresh)"
```

Note: `MarketExplorerModule`'s `providers` array does not need `RedisModule` added to its `imports` — `RedisModule` is `@Global()` in `app.module.ts`, so `RedisService` is already injectable here with zero module-wiring changes.

---

### Task 6: Combined-metric response shape in `lib/data/fetchers/market-explorer.ts`

**Files:**

- Modify: `packages/frontend/lib/data/fetchers/market-explorer.ts`
- Test: `packages/frontend/lib/data/fetchers/__tests__/market-explorer.test.ts`

**Interfaces:**

- Consumes: `fetchAPIWithParams<T>(endpoint: string, params?: Record<string, string|number|undefined>): Promise<T>` (`./base`, unchanged).
- Produces: `ScopeSeriesResponse { success: true; geoLevel: string; months: number; dates: string[]; regions: ScopeRegion[]; series: Record<string, Record<string, (number|null)[]>>; totalAvailable?: number }`, `ScopeQuery { parentLevel?; parentId?; months: number; includeNearby?: boolean }` (no `metric` field), `fetchScopeSeries(geoLevel: ScopeGeoLevel, query: ScopeQuery): Promise<ScopeSeriesResponse>`.

- [ ] **Step 1: Write the failing test**

Replace `packages/frontend/lib/data/fetchers/__tests__/market-explorer.test.ts` in full:

```ts
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../base", () => ({ fetchAPIWithParams: vi.fn() }));
import { fetchAPIWithParams } from "../base";
import { fetchScopeSeries } from "../market-explorer";

describe("fetchScopeSeries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the scope URL and forwards query params without a metric param", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "county",
      months: 120,
      dates: [],
      regions: [],
      series: {},
    });
    await fetchScopeSeries("county", {
      parentLevel: "metro",
      parentId: "19100",
      months: 120,
    });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/county",
      {
        parentLevel: "metro",
        parentId: "19100",
        months: 120,
        includeNearby: undefined,
      },
    );
  });

  it("omits parent params at national scope", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "metro",
      months: 24,
      regions: [],
      series: {},
      dates: [],
    });
    await fetchScopeSeries("metro", { months: 24 });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/metro",
      {
        parentLevel: undefined,
        parentId: undefined,
        months: 24,
        includeNearby: undefined,
      },
    );
  });

  it("forwards includeNearby as the string 'true' when set", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "metro",
      months: 24,
      regions: [],
      series: {},
      dates: [],
    });
    await fetchScopeSeries("metro", {
      parentLevel: "state",
      parentId: "48",
      months: 24,
      includeNearby: true,
    });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/metro",
      {
        parentLevel: "state",
        parentId: "48",
        months: 24,
        includeNearby: "true",
      },
    );
  });

  it("resolves the combined-metric response shape (series nested by metric then region) and totalAvailable when present", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "metro",
      months: 2,
      dates: ["2026-04-01", "2026-05-01"],
      regions: [{ id: "35620", name: "New York", state: "NY", population: 1 }],
      series: {
        propertyiq_score: { "35620": [71, 73] },
        home_value: { "35620": [700000, 705000] },
      },
      totalAvailable: 90,
    });
    const res = await fetchScopeSeries("metro", { months: 2 });
    expect(res.series.propertyiq_score["35620"]).toEqual([71, 73]);
    expect(res.series.home_value["35620"]).toEqual([700000, 705000]);
    expect(res.totalAvailable).toBe(90);
    expect((res as any).metric).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run lib/data/fetchers/__tests__/market-explorer.test.ts`
Expected: FAIL — current implementation still sends a `metric` field in the params object.

- [ ] **Step 3: Update the implementation**

Replace `packages/frontend/lib/data/fetchers/market-explorer.ts` in full:

```ts
/**
 * MARKET EXPLORER FETCHER
 * All 8 core metrics across all child regions of a scope, aligned to one
 * shared monthly axis, in a single request.
 * GET /api/market-explorer/scope/:geoLevel
 */
import { fetchAPIWithParams } from "./base";

export type ScopeGeoLevel = "state" | "metro" | "county" | "zip";

export interface ScopeRegion {
  id: string;
  name: string;
  state: string;
  population: number | null;
  nearby?: boolean;
}

export interface ScopeSeriesResponse {
  success: true;
  geoLevel: string;
  months: number;
  dates: string[];
  regions: ScopeRegion[];
  /** series[metric][regionId] = aligned monthly values */
  series: Record<string, Record<string, (number | null)[]>>;
  /** Present only when the roster was capped below the true count (ZIP tier). */
  totalAvailable?: number;
}

export interface ScopeQuery {
  parentLevel?: "state" | "metro" | "county";
  parentId?: string;
  months: number;
  includeNearby?: boolean;
}

export async function fetchScopeSeries(
  geoLevel: ScopeGeoLevel,
  query: ScopeQuery,
): Promise<ScopeSeriesResponse> {
  return fetchAPIWithParams<ScopeSeriesResponse>(
    `/api/market-explorer/scope/${geoLevel}`,
    {
      parentLevel: query.parentLevel,
      parentId: query.parentId,
      months: query.months,
      includeNearby: query.includeNearby ? "true" : undefined,
    },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run lib/data/fetchers/__tests__/market-explorer.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/fetchers/market-explorer.ts packages/frontend/lib/data/fetchers/__tests__/market-explorer.test.ts
git commit -m "feat(market-explorer): combined-metric response shape + totalAvailable in scope fetcher"
```

---

### Task 7: Simplify `useExplorerScopeData` — one query instead of 8, drop client-side merge, surface `totalAvailable`

**Files:**

- Modify: `packages/frontend/app/(app)/market/explorer/lib/useExplorerScopeData.ts`
- Delete: `packages/frontend/app/(app)/market/explorer/lib/__tests__/mergeScopeResponses.test.ts` (verified: `mergeScopeResponses` has no importers besides this test and the hook file itself)
- Test: `packages/frontend/app/(app)/market/explorer/lib/__tests__/useExplorerScopeData.test.tsx` (new)

**Interfaces:**

- Consumes: `fetchScopeSeries(geoLevel, query): Promise<ScopeSeriesResponse>` (Task 6), `SeriesByMetric = Record<string, Record<string, (number|null)[]>>` (`./explorer-math`, unchanged).
- Produces: `useExplorerScopeData(geoLevel, parentLevel?, parentId?, includeNearby?): { dates: string[]; regions: ScopeRegion[]; series: SeriesByMetric; totalAvailable: number | undefined; isLoading: boolean; error: Error | null }`.

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/app/(app)/market/explorer/lib/__tests__/useExplorerScopeData.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const fetchScopeSeries = vi.fn();
vi.mock("@/lib/data/fetchers/market-explorer", () => ({ fetchScopeSeries }));

import { useExplorerScopeData } from "../useExplorerScopeData";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useExplorerScopeData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches once (not per-metric) and passes through dates/regions/series/totalAvailable unchanged", async () => {
    fetchScopeSeries.mockResolvedValue({
      success: true,
      geoLevel: "metro",
      months: 120,
      dates: ["2026-04-01", "2026-05-01"],
      regions: [{ id: "35620", name: "New York", state: "NY", population: 1 }],
      series: { propertyiq_score: { "35620": [71, 73] } },
      totalAvailable: 90,
    });

    const { result } = renderHook(
      () => useExplorerScopeData("metro", undefined, undefined, false),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchScopeSeries).toHaveBeenCalledTimes(1);
    expect(fetchScopeSeries).toHaveBeenCalledWith("metro", {
      parentLevel: undefined,
      parentId: undefined,
      months: 120,
      includeNearby: false,
    });
    expect(result.current.dates).toEqual(["2026-04-01", "2026-05-01"]);
    expect(result.current.regions[0].id).toBe("35620");
    expect(result.current.series.propertyiq_score["35620"]).toEqual([71, 73]);
    expect(result.current.totalAvailable).toBe(90);
    expect(result.current.error).toBeNull();
  });

  it("totalAvailable is undefined when the response doesn't include it (uncapped scopes)", async () => {
    fetchScopeSeries.mockResolvedValue({
      success: true,
      geoLevel: "state",
      months: 3,
      dates: [],
      regions: [],
      series: {},
    });
    const { result } = renderHook(
      () => useExplorerScopeData("state", undefined, undefined, undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalAvailable).toBeUndefined();
  });

  it("returns empty defaults before the query resolves", () => {
    fetchScopeSeries.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(
      () => useExplorerScopeData("state", undefined, undefined, undefined),
      { wrapper },
    );
    expect(result.current.dates).toEqual([]);
    expect(result.current.regions).toEqual([]);
    expect(result.current.series).toEqual({});
    expect(result.current.isLoading).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/market/explorer/lib/__tests__/useExplorerScopeData.test.tsx"`
Expected: FAIL — current hook calls `fetchScopeSeries` 8 times and requires a `metric` field per call.

- [ ] **Step 3: Rewrite the hook**

Replace `packages/frontend/app/(app)/market/explorer/lib/useExplorerScopeData.ts` in full:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchScopeSeries,
  type ScopeGeoLevel,
} from "@/lib/data/fetchers/market-explorer";
import type { SeriesByMetric } from "./explorer-math";

export const MAX_MONTHS = 120;

export function useExplorerScopeData(
  geoLevel: ScopeGeoLevel,
  parentLevel?: "state" | "metro" | "county",
  parentId?: string,
  includeNearby?: boolean,
) {
  const { data, isLoading, error } = useQuery({
    queryKey: [
      "me-scope",
      geoLevel,
      parentLevel ?? null,
      parentId ?? null,
      !!includeNearby,
    ],
    queryFn: () =>
      fetchScopeSeries(geoLevel, {
        parentLevel,
        parentId,
        months: MAX_MONTHS,
        includeNearby: !!includeNearby,
      }),
    staleTime: 2 * 60 * 60 * 1000, // 2h (CLAUDE.md §5)
    gcTime: 2 * 60 * 60 * 1000,
  });

  return {
    dates: data?.dates ?? [],
    regions: data?.regions ?? [],
    series: (data?.series ?? {}) as SeriesByMetric,
    totalAvailable: data?.totalAvailable,
    isLoading,
    error: (error as Error | undefined) ?? null,
  };
}
```

- [ ] **Step 4: Delete the now-obsolete merge test**

```bash
git rm packages/frontend/app/\(app\)/market/explorer/lib/__tests__/mergeScopeResponses.test.ts
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/frontend && npx vitest run "app/(app)/market/explorer/lib/__tests__/useExplorerScopeData.test.tsx"`
Expected: PASS (3 tests).

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/`
Expected: PASS (all remaining suites in this dir).

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/\(app\)/market/explorer/lib/useExplorerScopeData.ts packages/frontend/app/\(app\)/market/explorer/lib/__tests__/useExplorerScopeData.test.tsx
git commit -m "refactor(market-explorer): single combined-metric query, drop client-side merge, surface totalAvailable"
```

---

### Task 8: `geo-projection.ts` pure functions + `useGeoBoundaries` hook

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/lib/geo-projection.ts`
- Create: `packages/frontend/app/(app)/market/explorer/lib/useGeoBoundaries.ts`
- Test: `packages/frontend/app/(app)/market/explorer/lib/__tests__/geo-projection.test.ts`
- Test: `packages/frontend/app/(app)/market/explorer/lib/__tests__/useGeoBoundaries.test.tsx`

**Interfaces:**

- Consumes: `GEOJSON_SOURCES`, `getGeoJsonApiUrl` (`@/lib/data`); `fetchWithRetry` (`@/app/(app)/map/utils/geojson-fetch`); `@tanstack/react-query`'s `useQuery`.
- Produces:
  - `type LonLat = [number, number]`, `type Ring = LonLat[]`, `type PolygonCoords = Ring[]`
  - `type GeoJSONGeometry = { type: 'Polygon'; coordinates: PolygonCoords } | { type: 'MultiPolygon'; coordinates: PolygonCoords[] }`
  - `interface Bbox { minX: number; minY: number; maxX: number; maxY: number }`
  - `computeBbox(geometry: GeoJSONGeometry): Bbox`
  - `mergeBbox(boxes: Bbox[]): Bbox`
  - `makeProjection(bbox: Bbox, targetSize: number): { project: (lon: number, lat: number) => [number, number]; width: number; height: number }`
  - `toSvgPath(geometry: GeoJSONGeometry, project: (lon: number, lat: number) => [number, number]): string`
  - `interface BoundaryFeature { id: string; path: string }` — **no `name` field** (see Task 9 for why: `GeoTileMap`'s `onDrill` only needs the id, matching `BubbleChart`'s existing single-arg convention, so no placeholder name is ever fabricated).
  - `interface GeoBoundaries { parentOutline: string | null; viewBoxWidth: number; viewBoxHeight: number; features: BoundaryFeature[]; isLoading: boolean; error: Error | null }`
  - `useGeoBoundaries(geoLevel, parentLevel, parentId, parentState, regionIds?): GeoBoundaries`

- [ ] **Step 1: Write the failing tests for `geo-projection.ts`**

```ts
// packages/frontend/app/(app)/market/explorer/lib/__tests__/geo-projection.test.ts
import { describe, it, expect } from "vitest";
import {
  computeBbox,
  mergeBbox,
  toSvgPath,
  makeProjection,
} from "../geo-projection";

describe("computeBbox", () => {
  it("computes the bounding box of a simple Polygon", () => {
    const geom = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [1, 3],
          [0, 0],
        ] as any,
      ],
    };
    expect(computeBbox(geom)).toEqual({ minX: 0, minY: 0, maxX: 2, maxY: 3 });
  });

  it("computes the bounding box across all parts of a MultiPolygon", () => {
    const geom = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ] as any,
        ],
        [
          [
            [5, 5],
            [6, 5],
            [6, 6],
            [5, 5],
          ] as any,
        ],
      ],
    };
    expect(computeBbox(geom)).toEqual({ minX: 0, minY: 0, maxX: 6, maxY: 6 });
  });

  it("returns an infinite-collapsed box for an empty geometry — callers must guard before use", () => {
    const geom = { type: "Polygon" as const, coordinates: [] };
    const bbox = computeBbox(geom);
    expect(bbox.minX).toBe(Infinity);
    expect(bbox.maxX).toBe(-Infinity);
  });
});

describe("mergeBbox", () => {
  it("unions multiple boxes into their combined extent", () => {
    const a = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
    const b = { minX: -1, minY: 1, maxX: 5, maxY: 3 };
    expect(mergeBbox([a, b])).toEqual({ minX: -1, minY: 0, maxX: 5, maxY: 3 });
  });

  it("returns a zeroed box for an empty list", () => {
    expect(mergeBbox([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
});

describe("makeProjection", () => {
  it("scales to fit the target size along the longer axis and flips Y (latitude grows up, SVG grows down)", () => {
    const bbox = { minX: 0, minY: 0, maxX: 10, maxY: 5 };
    const { project, width, height } = makeProjection(bbox, 100);
    expect(width).toBeCloseTo(100);
    expect(height).toBeCloseTo(50);
    expect(project(0, 5)).toEqual([0, 0]);
    expect(project(10, 0)).toEqual([100, 50]);
  });

  it("does not divide by zero for a degenerate (zero-area) bbox", () => {
    const bbox = { minX: 5, minY: 5, maxX: 5, maxY: 5 };
    const { project } = makeProjection(bbox, 100);
    expect(Number.isFinite(project(5, 5)[0])).toBe(true);
  });
});

describe("toSvgPath", () => {
  const identity = (lon: number, lat: number): [number, number] => [lon, lat];

  it("builds one M...Z segment per ring for a Polygon", () => {
    const geom = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [1, 2],
          [0, 0],
        ] as any,
      ],
    };
    expect(toSvgPath(geom, identity)).toBe("M0,0L2,0L1,2L0,0Z");
  });

  it("builds multiple space-separated M...Z segments for a MultiPolygon", () => {
    const geom = {
      type: "MultiPolygon" as const,
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ] as any,
        ],
        [
          [
            [5, 5],
            [6, 5],
            [6, 6],
            [5, 5],
          ] as any,
        ],
      ],
    };
    expect(toSvgPath(geom, identity)).toBe(
      "M0,0L1,0L1,1L0,0Z M5,5L6,5L6,6L5,5Z",
    );
  });

  it("skips empty rings without crashing, returning an empty string for wholly-empty geometry", () => {
    const geom = { type: "Polygon" as const, coordinates: [[]] };
    expect(toSvgPath(geom, identity)).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/frontend && npx vitest run "app/(app)/market/explorer/lib/__tests__/geo-projection.test.ts"`
Expected: FAIL with "Failed to resolve import '../geo-projection'".

- [ ] **Step 3: Write `geo-projection.ts`**

```ts
// packages/frontend/app/(app)/market/explorer/lib/geo-projection.ts
export type LonLat = [number, number];
export type Ring = LonLat[];
export type PolygonCoords = Ring[];
export type GeoJSONGeometry =
  | { type: "Polygon"; coordinates: PolygonCoords }
  | { type: "MultiPolygon"; coordinates: PolygonCoords[] };

export interface Bbox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounding box of a geometry's raw [lon, lat] coordinates. */
export function computeBbox(geometry: GeoJSONGeometry): Bbox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lon, lat] of ring) {
        if (lon < minX) minX = lon;
        if (lon > maxX) maxX = lon;
        if (lat < minY) minY = lat;
        if (lat > maxY) maxY = lat;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Union of multiple bounding boxes into their combined extent. */
export function mergeBbox(boxes: Bbox[]): Bbox {
  if (!boxes.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return boxes.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }));
}

/**
 * Simple equirectangular projection scaled to fit `targetSize` along the
 * bbox's longer axis. Y is flipped: latitude increases northward, SVG y
 * increases downward.
 */
export function makeProjection(
  bbox: Bbox,
  targetSize: number,
): {
  project: (lon: number, lat: number) => [number, number];
  width: number;
  height: number;
} {
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const longerAxis = Math.max(w, h);
  const scale = longerAxis === 0 ? 1 : targetSize / longerAxis;
  const project = (lon: number, lat: number): [number, number] => [
    (lon - bbox.minX) * scale,
    (bbox.maxY - lat) * scale,
  ];
  return { project, width: w * scale, height: h * scale };
}

/**
 * Projects a geometry into an SVG path `d` string. Polygon -> one M...Z per
 * ring (outer + holes); MultiPolygon -> space-separated M...Z per ring across
 * every polygon part.
 */
export function toSvgPath(
  geometry: GeoJSONGeometry,
  project: (lon: number, lat: number) => [number, number],
): string {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const segments: string[] = [];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      if (!ring.length) continue;
      const points = ring.map(([lon, lat]) => project(lon, lat));
      segments.push("M" + points.map((p) => `${p[0]},${p[1]}`).join("L") + "Z");
    }
  }
  return segments.join(" ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/frontend && npx vitest run "app/(app)/market/explorer/lib/__tests__/geo-projection.test.ts"`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/lib/geo-projection.ts" "packages/frontend/app/(app)/market/explorer/lib/__tests__/geo-projection.test.ts"
git commit -m "feat(market-explorer): add lon/lat-to-SVG-path projection utilities"
```

- [ ] **Step 6: Write the failing test for `useGeoBoundaries`**

```tsx
// packages/frontend/app/(app)/market/explorer/lib/__tests__/useGeoBoundaries.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGeoBoundaries } from "../useGeoBoundaries";

const STATES_FC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { STATEFP: "48", STUSPS: "TX", name: "Texas" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-100, 30],
            [-99, 30],
            [-99.5, 31],
            [-100, 30],
          ],
        ],
      },
    },
    {
      type: "Feature",
      properties: { STATEFP: "02", STUSPS: "AK", name: "Alaska" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-150, 60],
            [-149, 60],
            [-149.5, 61],
            [-150, 60],
          ],
        ],
      },
    },
  ],
};
const METROS_FC = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        CBSAFP: "19100",
        NAME: "Dallas-Fort Worth-Arlington, TX",
        LSAD: "M1",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-99.9, 30.1],
            [-99.8, 30.1],
            [-99.85, 30.2],
            [-99.9, 30.1],
          ],
        ],
      },
    },
  ],
};

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useGeoBoundaries", () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes("states.json"))
        return { ok: true, json: async () => STATES_FC } as any;
      if (url.includes("metros.json"))
        return { ok: true, json: async () => METROS_FC } as any;
      throw new Error(`unexpected fetch: ${url}`);
    }) as any;
  });
  afterEach(() => vi.restoreAllMocks());

  it("national state view: excludes AK/HI/PR from the contiguous projection, parentOutline is null", async () => {
    const { result } = renderHook(
      () => useGeoBoundaries("state", undefined, undefined, undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.parentOutline).toBeNull();
    expect(result.current.features.map((f) => f.id)).toEqual(["48"]); // AK (02) excluded
  });

  it("national metro scope: parentOutline is the merged contiguous-states background, features are every metro (no regionIds filter)", async () => {
    const { result } = renderHook(
      () => useGeoBoundaries("metro", undefined, undefined, undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.parentOutline).toContain("M");
    expect(result.current.features.map((f) => f.id)).toEqual(["19100"]);
  });

  it("state -> metro drill: parentOutline is the matching state, features filtered by NAME ending in the state abbreviation", async () => {
    const { result } = renderHook(
      () => useGeoBoundaries("metro", "state", "48", undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.features.map((f) => f.id)).toEqual(["19100"]);
  });

  it("returns empty features (not a crash) when the parent id has no match", async () => {
    const { result } = renderHook(
      () => useGeoBoundaries("metro", "state", "99", undefined),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.features).toEqual([]);
    expect(result.current.parentOutline).toBeNull();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run "app/(app)/market/explorer/lib/__tests__/useGeoBoundaries.test.tsx"`
Expected: FAIL with "Failed to resolve import '../useGeoBoundaries'".

- [ ] **Step 8: Write `useGeoBoundaries.ts`**

```ts
// packages/frontend/app/(app)/market/explorer/lib/useGeoBoundaries.ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { GEOJSON_SOURCES, getGeoJsonApiUrl } from "@/lib/data";
import { fetchWithRetry } from "@/app/(app)/map/utils/geojson-fetch";
import {
  computeBbox,
  mergeBbox,
  toSvgPath,
  makeProjection,
  type GeoJSONGeometry,
} from "./geo-projection";

export interface BoundaryFeature {
  id: string;
  path: string;
}
export interface GeoBoundaries {
  parentOutline: string | null;
  viewBoxWidth: number;
  viewBoxHeight: number;
  features: BoundaryFeature[];
  isLoading: boolean;
  error: Error | null;
}

interface RawFeature {
  type: "Feature";
  properties: Record<string, any>;
  geometry: GeoJSONGeometry;
}
interface RawFeatureCollection {
  type: "FeatureCollection";
  features: RawFeature[];
}

/** AK, HI, PR — excluded from the equirectangular contiguous-US projection; not renderable in Map view at this scope (known MVP limit, still reachable via Bubbles view or search). */
const EXCLUDED_STATE_FIPS = new Set(["02", "15", "72"]);
const SIZE = 900;
const EMPTY: Omit<GeoBoundaries, "isLoading" | "error"> = {
  parentOutline: null,
  viewBoxWidth: 0,
  viewBoxHeight: 0,
  features: [],
};

async function fetchStaticGeojson(url: string): Promise<RawFeatureCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function isContiguous(f: RawFeature): boolean {
  return !EXCLUDED_STATE_FIPS.has(f.properties.STATEFP);
}

async function buildBoundaries(
  geoLevel: "state" | "metro" | "county" | "zip",
  parentLevel: "state" | "metro" | "county" | undefined,
  parentId: string | undefined,
  parentState: string | undefined,
  regionIds: string[] | undefined,
): Promise<Omit<GeoBoundaries, "isLoading" | "error">> {
  if (geoLevel === "state") {
    const states = await fetchStaticGeojson("/geojson/states.json");
    const contiguous = states.features.filter(isContiguous);
    const bbox = mergeBbox(contiguous.map((f) => computeBbox(f.geometry)));
    const { project, width, height } = makeProjection(bbox, SIZE);
    return {
      parentOutline: null,
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: contiguous.map((f) => ({
        id: f.properties.STATEFP,
        path: toSvgPath(f.geometry, project),
      })),
    };
  }

  if (geoLevel === "metro" && !parentId) {
    const [states, metros] = await Promise.all([
      fetchStaticGeojson("/geojson/states.json"),
      fetchStaticGeojson("/geojson/metros.json"),
    ]);
    const contiguousStates = states.features.filter(isContiguous);
    const bbox = mergeBbox(
      contiguousStates.map((f) => computeBbox(f.geometry)),
    );
    const { project, width, height } = makeProjection(bbox, SIZE);
    const parentOutline = contiguousStates
      .map((f) => toSvgPath(f.geometry, project))
      .join(" ");
    // National roster is the ~935-region uncapped set from the backend (Task 1) —
    // no regionIds filter needed here since the whole metros.json IS the roster.
    return {
      parentOutline,
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: metros.features.map((f) => ({
        id: f.properties.CBSAFP,
        path: toSvgPath(f.geometry, project),
      })),
    };
  }

  if (geoLevel === "metro" && parentLevel === "state") {
    const [states, metros] = await Promise.all([
      fetchStaticGeojson("/geojson/states.json"),
      fetchStaticGeojson("/geojson/metros.json"),
    ]);
    const stateFeature = states.features.find(
      (f) => f.properties.STATEFP === parentId,
    );
    if (!stateFeature) return EMPTY;
    const { project, width, height } = makeProjection(
      computeBbox(stateFeature.geometry),
      SIZE,
    );
    // metros.json has no direct state-FIPS field; NAME reliably ends in the
    // state abbreviation (e.g. "Dallas-Fort Worth-Arlington, TX"), including
    // cross-state CBSAs like "Texarkana, TX-AR" — validated against the live
    // backend during design (Texas: 50 real metro/micro regions returned).
    const abbr = stateFeature.properties.STUSPS;
    const stateMetroRegex = new RegExp(`,\\s*${abbr}(-|$)`);
    return {
      parentOutline: toSvgPath(stateFeature.geometry, project),
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: metros.features
        .filter((f) => stateMetroRegex.test(f.properties.NAME))
        .map((f) => ({
          id: f.properties.CBSAFP,
          path: toSvgPath(f.geometry, project),
        })),
    };
  }

  if (geoLevel === "county" && parentLevel === "metro") {
    const [metros, counties] = await Promise.all([
      fetchStaticGeojson("/geojson/metros.json"),
      fetchStaticGeojson("/geojson/counties.json"),
    ]);
    const metroFeature = metros.features.find(
      (f) => f.properties.CBSAFP === parentId,
    );
    if (!metroFeature) return EMPTY;
    const { project, width, height } = makeProjection(
      computeBbox(metroFeature.geometry),
      SIZE,
    );
    // counties.json is a NATIONAL file (~3,143 features) — pre-filter by
    // regionIds when given, unlike the metro tier above, to avoid mapping
    // thousands of irrelevant paths.
    const countyFeatures = regionIds
      ? counties.features.filter((f) => regionIds.includes(f.properties.id))
      : counties.features;
    return {
      parentOutline: toSvgPath(metroFeature.geometry, project),
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: countyFeatures.map((f) => ({
        id: f.properties.id,
        path: toSvgPath(f.geometry, project),
      })),
    };
  }

  if (geoLevel === "zip" && parentLevel === "county") {
    if (!parentId || !parentState) return EMPTY;
    const [counties, zipsRes] = await Promise.all([
      fetchStaticGeojson("/geojson/counties.json"),
      fetchWithRetry(
        getGeoJsonApiUrl(`${GEOJSON_SOURCES.zip}/${parentState.toUpperCase()}`),
      ),
    ]);
    const countyFeature = counties.features.find(
      (f) => f.properties.id === parentId,
    );
    if (!countyFeature) return EMPTY;
    const zips: RawFeatureCollection = await zipsRes.json();
    const { project, width, height } = makeProjection(
      computeBbox(countyFeature.geometry),
      SIZE,
    );
    // ZIP-tier regionIds is REQUIRED (not optional) — the backend endpoint
    // returns every ZIP in the state, easily hundreds; this is the
    // ZIP_FETCH_CAP=70-capped roster from Task 1, not the full state.
    // NOTE: verify the exact ZIP-code property name against the real
    // /api/geography/zips/:state response during implementation (Step 9
    // below) — id resolution is written defensively until confirmed live.
    const zipId = (f: RawFeature) =>
      f.properties.ZCTA5CE20 ?? f.properties.zip ?? f.properties.GEOID;
    const zipFeatures = regionIds
      ? zips.features.filter((f) => regionIds.includes(zipId(f)))
      : zips.features;
    return {
      parentOutline: toSvgPath(countyFeature.geometry, project),
      viewBoxWidth: width,
      viewBoxHeight: height,
      features: zipFeatures.map((f) => ({
        id: zipId(f),
        path: toSvgPath(f.geometry, project),
      })),
    };
  }

  return EMPTY;
}

export function useGeoBoundaries(
  geoLevel: "state" | "metro" | "county" | "zip",
  parentLevel: "state" | "metro" | "county" | undefined,
  parentId: string | undefined,
  parentState: string | undefined,
  regionIds?: string[],
): GeoBoundaries {
  const query = useQuery({
    queryKey: [
      "geo-boundaries",
      geoLevel,
      parentLevel ?? null,
      parentId ?? null,
      parentState ?? null,
      regionIds?.join(",") ?? null,
    ],
    queryFn: () =>
      buildBoundaries(geoLevel, parentLevel, parentId, parentState, regionIds),
    staleTime: 2 * 60 * 60 * 1000, // 2h, matches this app's data-layer convention (CLAUDE.md §5)
    gcTime: 2 * 60 * 60 * 1000,
  });

  return {
    parentOutline: query.data?.parentOutline ?? null,
    viewBoxWidth: query.data?.viewBoxWidth ?? 0,
    viewBoxHeight: query.data?.viewBoxHeight ?? 0,
    features: query.data?.features ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | undefined) ?? null,
  };
}
```

TanStack Query's own cache (keyed by `queryKey`, 2h `staleTime`/`gcTime`) handles caching here — no separate hand-rolled `Map` cache. Re-fetching `states.json`/`metros.json`/`counties.json` per distinct scope is an accepted minor inefficiency (fast static-asset network hit; the parse+project cost is small at 51-935 features) — revisit only if profiling shows it matters.

- [ ] **Step 9: Run test to verify it passes, then verify the real ZIP property name against the live backend**

Run: `cd packages/frontend && npx vitest run "app/(app)/market/explorer/lib/__tests__/useGeoBoundaries.test.tsx"`
Expected: PASS (4 tests).

Then, with the local backend running: `curl -s "http://localhost:3001/api/geography/zips/TX" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(Object.keys(JSON.parse(d).features[0].properties)))"` — confirm which property actually holds the ZIP code, then simplify the `zipId` helper in Step 8 from the defensive `??` chain to the one real key, and re-run this test.

- [ ] **Step 10: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/lib/useGeoBoundaries.ts" "packages/frontend/app/(app)/market/explorer/lib/__tests__/useGeoBoundaries.test.tsx"
git commit -m "feat(market-explorer): add useGeoBoundaries hook for real state/metro/county/zip geometry"
```

---

### Task 9: `GeoTileMap` component (replaces `StateTileMap`)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/GeoTileMap.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/GeoTileMap.test.tsx`

**Interfaces:**

- Consumes: `GeoBoundaries`, `BoundaryFeature` (Task 8); `ExplorerFormat` (`../lib/explorer-config`); `formatExplorerValue` (`../lib/explorer-math`); `getScoreColor` (`@/app/components/scoring/ScoreDisplay`).
- Produces:

```ts
export interface GeoTileMapProps {
  boundaries: GeoBoundaries;
  scoreByRegion: Record<string, number | null>;
  valueByRegion: Record<string, number | null>;
  format: ExplorerFormat;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Single-arg, matching BubbleChart's existing onDrill(id) convention — no
   * placeholder name is fabricated since BoundaryFeature has none; the
   * caller (Task 10) already resolves the real name from its own `regions`
   * list before dispatching a DRILL action. */
  onDrill: (id: string) => void;
}
```

Task 10 (`MarketExplorer.tsx`) consumes this component directly, replacing `<StateTileMap>`.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/GeoTileMap.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { GeoTileMap } from "../GeoTileMap";
import type { GeoBoundaries } from "../../lib/useGeoBoundaries";

const boundaries: GeoBoundaries = {
  parentOutline: "M0,0L900,0L900,600L0,600Z",
  viewBoxWidth: 900,
  viewBoxHeight: 600,
  features: [
    { id: "48", path: "M100,100L200,100L200,200L100,200Z" }, // 100x100 -> gets a label
    { id: "06", path: "M300,100L305,100L305,105L300,100Z" }, // 5x5 -> too small for a label
  ],
  isLoading: false,
  error: null,
};

const baseProps = {
  boundaries,
  format: "index" as const,
  selectedId: null,
  onSelect: vi.fn(),
  onDrill: vi.fn(),
};

describe("GeoTileMap", () => {
  it("renders a region's real value even when it has no PropertyIQ Score (the StateTileMap bug this replaces)", () => {
    render(
      <GeoTileMap
        {...baseProps}
        scoreByRegion={{ "48": null }}
        valueByRegion={{ "48": 71 }}
      />,
    );
    expect(screen.getByText("71")).toBeInTheDocument();
  });

  it("colors a region with no score using the neutral fallback, not a hidden/gray non-interactive tile", () => {
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        scoreByRegion={{ "48": null }}
        valueByRegion={{ "48": 71 }}
      />,
    );
    const path = container.querySelector('path[data-region-id="48"]');
    expect(path).not.toBeNull();
    expect(path).toHaveAttribute("fill");
  });

  it("clicking a region calls onSelect with its id", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        onSelect={onSelect}
        scoreByRegion={{ "48": 60 }}
        valueByRegion={{ "48": 60 }}
      />,
    );
    fireEvent.click(container.querySelector('path[data-region-id="48"]')!);
    expect(onSelect).toHaveBeenCalledWith("48");
  });

  it("double-clicking a region calls onDrill with just its id", () => {
    const onDrill = vi.fn();
    const { container } = render(
      <GeoTileMap
        {...baseProps}
        onDrill={onDrill}
        scoreByRegion={{ "48": 60 }}
        valueByRegion={{ "48": 60 }}
      />,
    );
    fireEvent.doubleClick(
      container.querySelector('path[data-region-id="48"]')!,
    );
    expect(onDrill).toHaveBeenCalledWith("48");
  });

  it("renders a loading state without crashing when boundaries are still loading", () => {
    render(
      <GeoTileMap
        {...baseProps}
        boundaries={{ ...boundaries, isLoading: true, features: [] }}
        scoreByRegion={{}}
        valueByRegion={{}}
      />,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders an error state without crashing", () => {
    render(
      <GeoTileMap
        {...baseProps}
        boundaries={{ ...boundaries, error: new Error("boom"), features: [] }}
        scoreByRegion={{}}
        valueByRegion={{}}
      />,
    );
    expect(screen.getByText(/couldn.t load|error/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/frontend && npx vitest run "app/(app)/market/explorer/components/__tests__/GeoTileMap.test.tsx"`
Expected: FAIL with "Failed to resolve import '../GeoTileMap'".

- [ ] **Step 3: Write `GeoTileMap.tsx`**

```tsx
// packages/frontend/app/(app)/market/explorer/components/GeoTileMap.tsx
"use client";
import React from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import { formatExplorerValue } from "../lib/explorer-math";
import type { ExplorerFormat } from "../lib/explorer-config";
import type { GeoBoundaries, BoundaryFeature } from "../lib/useGeoBoundaries";

export interface GeoTileMapProps {
  boundaries: GeoBoundaries;
  scoreByRegion: Record<string, number | null>;
  valueByRegion: Record<string, number | null>;
  format: ExplorerFormat;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDrill: (id: string) => void;
}

/**
 * A path's rendered pixel extent below this threshold can't legibly hold a
 * formatted number (validated against the brainstorm mockups of a
 * 254-county state, where sub-14px shapes clipped text badly; the smallest
 * legible labeled tiles there were ~32px).
 */
const MIN_LABEL_SIZE = 14;

function pathExtent(d: string): { w: number; h: number } {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i],
      y = nums[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { w: maxX - minX, h: maxY - minY };
}

function centroid(d: string): [number, number] {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  let sx = 0,
    sy = 0,
    n = 0;
  for (let i = 0; i < nums.length; i += 2) {
    sx += nums[i];
    sy += nums[i + 1];
    n++;
  }
  return n ? [sx / n, sy / n] : [0, 0];
}

export function GeoTileMap(props: GeoTileMapProps) {
  const {
    boundaries,
    scoreByRegion,
    valueByRegion,
    format,
    selectedId,
    onSelect,
    onDrill,
  } = props;

  if (boundaries.isLoading) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--md-on-surface-variant)",
        }}
      >
        Loading map…
      </div>
    );
  }
  if (boundaries.error) {
    return (
      <div
        style={{ padding: 40, textAlign: "center", color: "var(--md-error)" }}
      >
        Couldn't load the map for this scope.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${boundaries.viewBoxWidth} ${boundaries.viewBoxHeight}`}
      width="100%"
      style={{ display: "block" }}
    >
      {boundaries.parentOutline && (
        <path
          d={boundaries.parentOutline}
          fill="var(--md-surface-container-high)"
        />
      )}
      {boundaries.features.map((feature: BoundaryFeature) => {
        // Missing score is a COLOR fallback only, never a visibility gate —
        // this is the fix for the StateTileMap bug: a region's real value
        // for the selected metric must always render if present, regardless
        // of whether PropertyIQ Score (a metro-aggregated, often-null value)
        // happens to exist. Mirrors BubbleChart's `scoreByRegion[id] ?? 50`.
        const score = scoreByRegion[feature.id] ?? 50;
        const value = valueByRegion[feature.id];
        const color = getScoreColor(score, 100);
        const sel = feature.id === selectedId;
        const { w, h } = pathExtent(feature.path);
        const canLabel = w >= MIN_LABEL_SIZE && h >= MIN_LABEL_SIZE;
        const [cx, cy] = canLabel ? centroid(feature.path) : [0, 0];

        return (
          <g key={feature.id}>
            <path
              data-region-id={feature.id}
              d={feature.path}
              fill={color}
              fillOpacity={sel ? 0.95 : 0.78}
              stroke={sel ? "var(--md-on-surface)" : "rgba(255,255,255,0.5)"}
              strokeWidth={sel ? 2 : 0.6}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(feature.id)}
              onDoubleClick={() => onDrill(feature.id)}
            >
              <title>
                {value != null
                  ? `${feature.id} — ${formatExplorerValue(value, format)}`
                  : feature.id}
              </title>
            </path>
            {canLabel && value != null && (
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                fontSize={11}
                fontFamily="var(--font-roboto-mono)"
                fill="#fff"
                pointerEvents="none"
              >
                {formatExplorerValue(value, format)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/frontend && npx vitest run "app/(app)/market/explorer/components/__tests__/GeoTileMap.test.tsx"`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/GeoTileMap.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/GeoTileMap.test.tsx"
git commit -m "feat(market-explorer): add GeoTileMap component, fixes score-gated tile visibility bug"
```

---

### Task 10: Wire `GeoTileMap` into `MarketExplorer`, fix the Map-view path reset, retire `StateTileMap`

**Files:**

- Modify: `packages/frontend/app/(app)/market/explorer/lib/explorer-config.ts` (`PathCrumb` gains `state?: string`)
- Modify: `packages/frontend/app/(app)/market/explorer/lib/explorer-reducer.ts` (`SET_VIEW` no longer resets `path`)
- Modify: `packages/frontend/app/(app)/market/explorer/lib/explorer-navigation.ts` (`"state"` level tab composes `RESET_NATIONAL` + `SET_VIEW` to preserve today's "jump to national tile map" behavior)
- Modify: `packages/frontend/app/(app)/market/explorer/MarketExplorer.tsx` (swap `StateTileMap` → `GeoTileMap`, thread `state` through `DRILL`, surface `totalAvailable`)
- Modify: `packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-reducer.test.ts` (new — the core regression test for this task)
- Modify: `packages/frontend/app/(app)/market/explorer/__tests__/MarketExplorer.test.tsx` (mock `useGeoBoundaries`; add regression coverage)
- Delete: `packages/frontend/app/(app)/market/explorer/components/StateTileMap.tsx`
- Delete: `packages/frontend/app/(app)/market/explorer/components/__tests__/StateTileMap.test.tsx`

**Interfaces:**

- Consumes: `GeoTileMap` (Task 9) — `{boundaries, scoreByRegion, valueByRegion, format, selectedId, onSelect, onDrill(id)}`. `useGeoBoundaries` (Task 8) — `(geoLevel, parentLevel, parentId, parentState, regionIds) => GeoBoundaries`. `useExplorerScopeData` (Task 7) now also returns `totalAvailable`.
- Produces: `PathCrumb.state?: string` — new optional field, populated at `DRILL` time from the drilled `ScopeRegion.state`.

- [ ] **Step 1: Confirm `StateTileMap` has no other importers before touching anything**

Run: `grep -rl "StateTileMap" packages/frontend --include="*.tsx" --include="*.ts"`
Expected output: exactly 3 files — `components/StateTileMap.tsx`, `components/__tests__/StateTileMap.test.tsx`, `MarketExplorer.tsx`. If anything else appears, stop and investigate before proceeding.

- [ ] **Step 2: Add `state?: string` to `PathCrumb`**

In `packages/frontend/app/(app)/market/explorer/lib/explorer-config.ts`, change:

```ts
export interface PathCrumb {
  level: ExplorerGeoLevel;
  id: string;
  name: string;
}
```

to:

```ts
export interface PathCrumb {
  level: ExplorerGeoLevel;
  id: string;
  name: string;
  /** 2-letter state code of the drilled-into region. Populated at DRILL time
   * from the region's own `state` field — used by useGeoBoundaries to resolve
   * the per-state ZIP boundary endpoint when the user drills county -> zip. */
  state?: string;
}
```

- [ ] **Step 3: Write the failing test for the `SET_VIEW` path-reset bug**

This is the core regression this task fixes — the "Metro" scope tab not resetting Map view back to Bubbles was flagged during initial debugging but never conclusively reproduced live; tracing the reducer shows a real, adjacent bug: `SET_VIEW` unconditionally resets `path`/`selectedId` when switching TO map view, which is fine at national scope but wrong once Map view needs to work at every drilled level (this whole task's point). Create `packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-reducer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { explorerReducer, initialExplorerState } from "../explorer-reducer";

describe("explorerReducer SET_VIEW", () => {
  it("switches view without resetting an active drill path", () => {
    const drilled = {
      ...initialExplorerState,
      path: [{ level: "state" as const, id: "48", name: "Texas", state: "TX" }],
      selectedId: "19100",
    };
    const result = explorerReducer(drilled, { type: "SET_VIEW", view: "map" });
    expect(result.view).toBe("map");
    expect(result.path).toEqual(drilled.path); // must NOT reset to []
    expect(result.selectedId).toBe("19100"); // must NOT clear selection
  });

  it("stops autoplay when switching view", () => {
    const playing = { ...initialExplorerState, playing: true };
    const result = explorerReducer(playing, { type: "SET_VIEW", view: "map" });
    expect(result.playing).toBe(false);
  });

  it("switching back to bubbles also preserves the path", () => {
    const drilled = {
      ...initialExplorerState,
      view: "map" as const,
      path: [
        { level: "metro" as const, id: "19100", name: "Dallas-Fort Worth" },
      ],
    };
    const result = explorerReducer(drilled, {
      type: "SET_VIEW",
      view: "bubbles",
    });
    expect(result.view).toBe("bubbles");
    expect(result.path).toEqual(drilled.path);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-reducer.test.ts`
Expected: FAIL on the first test — `result.path` is `[]`, not the drilled path.

- [ ] **Step 5: Fix `SET_VIEW` in `explorer-reducer.ts`**

Change:

```ts
    case "SET_VIEW":
      return action.view === "map"
        ? { ...state, view: "map", path: [], selectedId: null, playing: false }
        : { ...state, view: "bubbles" };
```

to:

```ts
    case "SET_VIEW":
      return { ...state, view: action.view, playing: false };
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-reducer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Preserve the "State" level tab's existing "jump to national tile map" behavior**

Removing `SET_VIEW`'s path reset means `buildLevelTabs`'s `"state"` tab — which relied on that reset to always land on the national view — would otherwise just flip the current depth into map mode instead of jumping to national. That tab's job is level navigation ("go to the top"), not a same-depth view toggle (`HeroVisualization`'s own Bubbles/Map buttons already do that via the now-fixed `SET_VIEW`). Give it an explicit two-dispatch transition instead.

In `packages/frontend/app/(app)/market/explorer/lib/explorer-navigation.ts`, change:

```ts
if (level === "state")
  return {
    label,
    active: state.view === "map",
    enabled: true,
    onClick: () => dispatch({ type: "SET_VIEW", view: "map" }),
  };
```

to:

```ts
if (level === "state")
  return {
    label,
    active: state.view === "map",
    enabled: true,
    onClick: () => {
      dispatch({ type: "RESET_NATIONAL" });
      dispatch({ type: "SET_VIEW", view: "map" });
    },
  };
```

- [ ] **Step 8: Write the failing test for the "State" tab's national-jump behavior and the drilled-Map-view regression**

Add to `packages/frontend/app/(app)/market/explorer/__tests__/MarketExplorer.test.tsx` — first add a `useGeoBoundaries` mock (needed since JSDOM has no real `fetch` for the static geojson/ZIP API route; without mocking, any test reaching `view: "map"` would hang), alongside the existing `useExplorerScopeData` mock:

```ts
vi.mock("../lib/useGeoBoundaries", () => ({
  useGeoBoundaries: vi.fn(() => ({
    parentOutline: null,
    viewBoxWidth: 400,
    viewBoxHeight: 300,
    features: [
      { id: "35620", path: "M0,0L10,0L10,10L0,10Z" },
      { id: "31080", path: "M20,0L30,0L30,10L20,10Z" },
    ],
    isLoading: false,
    error: null,
  })),
}));
import { useGeoBoundaries } from "../lib/useGeoBoundaries";
const mockUseGeoBoundaries = vi.mocked(useGeoBoundaries);
```

Then add:

```ts
  it("drilling into a metro then toggling Map view shows that metro's own boundaries, not the national state grid", () => {
    render(<MarketExplorer />);
    const titleEl = Array.from(document.querySelectorAll("circle title")).find((el) => el.textContent?.includes("New York"));
    fireEvent.doubleClick(titleEl!.parentElement!); // drill metro -> county
    fireEvent.click(screen.getByText("Map"));
    // Before the SET_VIEW fix, this would reset path to [] and re-render the
    // national state grid via useGeoBoundaries("state", ...) instead of
    // staying scoped to New York's counties.
    expect(mockUseGeoBoundaries).toHaveBeenLastCalledWith("county", "metro", "35620", undefined, expect.any(Array));
  });

  it('the "State" level tab still jumps to the national tile map from any depth', () => {
    render(<MarketExplorer />);
    const titleEl = Array.from(document.querySelectorAll("circle title")).find((el) => el.textContent?.includes("New York"));
    fireEvent.doubleClick(titleEl!.parentElement!);
    fireEvent.click(screen.getByText("State")); // level tab, not the Map toggle
    expect(mockUseGeoBoundaries).toHaveBeenLastCalledWith("state", undefined, undefined, undefined, expect.any(Array));
  });
```

- [ ] **Step 9: Run the tests to verify they fail**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/__tests__/MarketExplorer.test.tsx`
Expected: FAIL — `useGeoBoundaries` isn't called yet (production code still uses `StateTileMap`/`entities={regions}`).

- [ ] **Step 10: Wire `GeoTileMap` + `useGeoBoundaries` into `MarketExplorer.tsx`**

Replace the `StateTileMap` import with `GeoTileMap` and `useGeoBoundaries`:

```ts
import { GeoTileMap } from "./components/GeoTileMap";
import { useGeoBoundaries } from "./lib/useGeoBoundaries";
```

(remove `import { StateTileMap } from "./components/StateTileMap";`)

Update the `useExplorerScopeData` destructure to include `totalAvailable`, and add the boundaries hook call near it:

```ts
const { dates, regions, series, totalAvailable, isLoading, error } =
  useExplorerScopeData(
    scope.geoLevel,
    scope.parentLevel,
    scope.parentId,
    state.includeNearby,
  );

const parentState =
  scope.geoLevel === "zip"
    ? state.path[state.path.length - 1]?.state
    : undefined;
const boundaries = useGeoBoundaries(
  scope.geoLevel,
  scope.parentLevel,
  scope.parentId,
  parentState,
  regions.map((r) => r.id),
);
```

Update `onDrillEntity` to thread `state` through `DRILL` (it already resolves `r`, including `r.state`):

```ts
const onDrillEntity = (id: string) => {
  if (scope.geoLevel === "zip") return;
  const r = regions.find((e) => e.id === id);
  if (!r) return;
  dispatch({
    type: "DRILL",
    crumb: { level: scope.geoLevel, id, name: r.name, state: r.state },
  });
};
```

Replace the `heroChart` ternary's map branch:

```ts
  const heroChart =
    state.view === "map" ? (
      <GeoTileMap
        boundaries={boundaries}
        scoreByRegion={scalars.scoreByRegion}
        valueByRegion={scalars.yByRegion}
        format={metricCfg.format}
        selectedId={state.selectedId}
        onSelect={onSelect}
        onDrill={onDrillEntity}
      />
    ) : (
      <BubbleChart
        entities={regions}
        xByRegion={scalars.xByRegion}
        yByRegion={scalars.yByRegion}
        scoreByRegion={scalars.scoreByRegion}
        radiusByRegion={scalars.radiusByRegion}
        axisLabel={metricCfg.axis}
        format={metricCfg.format}
        selectedId={state.selectedId}
        pinnedIds={state.pinnedIds}
        onSelect={onSelect}
        onDrill={onDrillEntity}
      />
    );
```

Update `heroTitle`'s map-view label (currently hardcodes "state tile map", no longer accurate at every level):

```ts
const heroTitle = `${scopeName ? `${scopeName} — ` : ""}${state.view === "map" ? `${metricCfg.label} across ${regions.length} ${unitPlural} (map)` : `${metricCfg.label} across ${regions.length} ${unitPlural}`}`;
```

(`totalAvailable` is threaded through this component's scope for Task 12's `ZipCapNotice` to consume — no further use of it in this task.)

- [ ] **Step 11: Run the tests to verify they pass**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/__tests__/MarketExplorer.test.tsx`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 12: Delete `StateTileMap` and its test**

```bash
rm "packages/frontend/app/(app)/market/explorer/components/StateTileMap.tsx"
rm "packages/frontend/app/(app)/market/explorer/components/__tests__/StateTileMap.test.tsx"
```

- [ ] **Step 13: Run the full explorer test suite to confirm nothing else broke**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer`
Expected: PASS, zero references to the deleted files.

- [ ] **Step 14: Commit**

```bash
git add packages/frontend/app/\(app\)/market/explorer/lib/explorer-config.ts \
        packages/frontend/app/\(app\)/market/explorer/lib/explorer-reducer.ts \
        packages/frontend/app/\(app\)/market/explorer/lib/explorer-navigation.ts \
        packages/frontend/app/\(app\)/market/explorer/lib/__tests__/explorer-reducer.test.ts \
        packages/frontend/app/\(app\)/market/explorer/MarketExplorer.tsx \
        packages/frontend/app/\(app\)/market/explorer/__tests__/MarketExplorer.test.tsx
git rm packages/frontend/app/\(app\)/market/explorer/components/StateTileMap.tsx \
       packages/frontend/app/\(app\)/market/explorer/components/__tests__/StateTileMap.test.tsx
git commit -m "fix(market-explorer): stop SET_VIEW from resetting drill path, wire GeoTileMap in at every scope level"
```

---

### Task 11: Metro bubble cap (client-side slice to 70) + "top 70 of N" notice

**Files:**

- Modify: `packages/frontend/app/(app)/market/explorer/lib/explorer-config.ts`
- Modify: `packages/frontend/app/(app)/market/explorer/components/HeroVisualization.tsx`
- Modify: `packages/frontend/app/(app)/market/explorer/MarketExplorer.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/HeroVisualization.test.tsx` (new)
- Test: `packages/frontend/app/(app)/market/explorer/__tests__/MarketExplorer.test.tsx` (extend)

**Interfaces:**

- Consumes: `regions: ScopeRegion[]` (already population-sorted descending by the backend), `scope.geoLevel`.
- Produces: `BUBBLE_METRO_CAP` constant; `HeroVisualizationProps.notice?: React.ReactNode`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/frontend/app/(app)/market/explorer/components/__tests__/HeroVisualization.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroVisualization } from "../HeroVisualization";

const baseProps = {
  title: "t", hint: "h", view: "bubbles" as const, onSetView: () => {},
  hasNearby: false, includeNearby: false, onToggleNearby: () => {}, nearbyLabel: "",
  chart: <div>chart</div>, scrubber: <div>scrubber</div>,
};

describe("HeroVisualization notice slot", () => {
  it("renders the notice node when provided", () => {
    render(<HeroVisualization {...baseProps} notice={<span>Showing top 70 of 935</span>} />);
    expect(screen.getByText("Showing top 70 of 935")).toBeInTheDocument();
  });

  it("renders nothing extra when notice is omitted", () => {
    render(<HeroVisualization {...baseProps} />);
    expect(screen.queryByText(/Showing top/)).not.toBeInTheDocument();
  });
});
```

Add to `packages/frontend/app/(app)/market/explorer/__tests__/MarketExplorer.test.tsx` (using whatever mock scaffolding the file already sets up for `useExplorerScopeData`):

```ts
it("caps metro bubbles at BUBBLE_METRO_CAP and shows the overflow notice", async () => {
  mockScopeData.regions = Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `Metro ${i}`, state: "TX", population: 100 - i }));
  mockScopeData.dates = ["2026-05-01"];
  mockScopeData.series = { propertyiq_score: {} };

  render(<MarketExplorer />);

  expect(await screen.findByText(/Showing top 70 of 100 metros/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/HeroVisualization.test.tsx app/\(app\)/market/explorer/__tests__/MarketExplorer.test.tsx`
Expected: FAIL — `HeroVisualization` doesn't accept a `notice` prop yet; nothing caps `regions` yet.

- [ ] **Step 3: Add `BUBBLE_METRO_CAP` to `explorer-config.ts`**

```ts
// packages/frontend/app/(app)/market/explorer/lib/explorer-config.ts
// Add near RANGE_PRESETS:

/**
 * Metro bubble scatter caps at this many entities (by population, the backend
 * already sorts descending) — real-boundary tiles at the same scope render the
 * full uncapped roster, but overlapping score-colored circles get illegible at
 * high density in a way shapes don't. See docs/superpowers/specs/2026-07-15-
 * market-explorer-real-boundary-tiles-design.md §2.
 */
export const BUBBLE_METRO_CAP = 70;
```

- [ ] **Step 4: Add the `notice` slot to `HeroVisualization.tsx`**

```tsx
// packages/frontend/app/(app)/market/explorer/components/HeroVisualization.tsx
export interface HeroVisualizationProps {
  title: string;
  hint: string;
  view: "bubbles" | "map";
  onSetView: (v: "bubbles" | "map") => void;
  hasNearby: boolean;
  includeNearby: boolean;
  onToggleNearby: () => void;
  nearbyLabel: string;
  chart: React.ReactNode;
  scrubber: React.ReactNode;
  notice?: React.ReactNode; // NEW
}

export function HeroVisualization(props: HeroVisualizationProps) {
  const {
    title,
    hint,
    view,
    onSetView,
    hasNearby,
    includeNearby,
    onToggleNearby,
    nearbyLabel,
    chart,
    scrubber,
    notice,
  } = props;
  // ...unchanged tab()/header JSX...
  return (
    <div
      style={
        {
          /* unchanged */
        }
      }
    >
      {/* ...unchanged header row... */}
      <div
        style={{
          padding: "2px 20px 0",
          fontSize: 11.5,
          color: "var(--md-on-surface-variant)",
        }}
      >
        {hint}
      </div>
      {notice && (
        <div
          style={{
            padding: "4px 20px 0",
            fontSize: 11.5,
            color: "var(--md-primary)",
          }}
        >
          {notice}
        </div>
      )}
      <div style={{ padding: "8px 12px 0" }}>{chart}</div>
      {scrubber}
    </div>
  );
}
```

- [ ] **Step 5: Wire the cap + notice into `MarketExplorer.tsx`**

```tsx
// Add to the explorer-config import:
import {
  EXPLORER_METRICS,
  RANGE_PRESETS,
  BUBBLE_METRO_CAP,
  type ExplorerMetricId,
} from "./lib/explorer-config";

// In the heroChart definition, cap the bubbles branch's entities:
const bubbleEntities =
  scope.geoLevel === "metro" ? regions.slice(0, BUBBLE_METRO_CAP) : regions;

// heroChart's bubbles branch: entities={bubbleEntities} instead of entities={regions}
// (the tile-map branch, from Task 10, is unaffected — it keeps the full `regions` via `boundaries`)

const bubbleCapNotice =
  state.view === "bubbles" &&
  scope.geoLevel === "metro" &&
  regions.length > BUBBLE_METRO_CAP
    ? `Showing top ${BUBBLE_METRO_CAP} of ${regions.length} metros by population — see all in Map view`
    : null;

// In the <HeroVisualization> JSX, add: notice={bubbleCapNotice}
```

Note: `scalars` (from `buildBubbleScalars(regions, series, state.metric, mi)`) stays computed from the FULL `regions` — only the `entities` prop passed to `<BubbleChart>` is sliced.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/HeroVisualization.test.tsx app/\(app\)/market/explorer/__tests__/MarketExplorer.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/\(app\)/market/explorer/lib/explorer-config.ts packages/frontend/app/\(app\)/market/explorer/components/HeroVisualization.tsx packages/frontend/app/\(app\)/market/explorer/MarketExplorer.tsx packages/frontend/app/\(app\)/market/explorer/components/__tests__/HeroVisualization.test.tsx packages/frontend/app/\(app\)/market/explorer/__tests__/MarketExplorer.test.tsx
git commit -m "feat(market-explorer): cap metro bubble chart at 70, disclose the cap with a Map-view pointer"
```

---

### Task 12: ZIP-tier "top N of M" notice + search-to-jump

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/ZipCapNotice.tsx` (new — keeps `MarketExplorer.tsx`, already near the CLAUDE.md 400-line hard limit, from crossing it)
- Modify: `packages/frontend/app/(app)/market/explorer/MarketExplorer.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/ZipCapNotice.test.tsx` (new)

**Interfaces:**

- Consumes: `totalAvailable` (already threaded through `useExplorerScopeData` by Task 7 and `MarketExplorer.tsx`'s scope by Task 10). `useUniversalSearch({filterByGeoLevel: 'zip'})` (`@/app/shared/hooks/useUniversalSearch`) → `{searchResults, searchLoading, handleSearch, clearSearch}`, `SearchResult = {id, name, type, subtitle?, center?, state}`. This is the same reusable, Mapbox-free search hook already used outside any map context by `PeerSearchBox.tsx`, `MarketSelector.tsx`, `StepGeography.tsx`, and `MarketPickerStep.tsx` — `useMapSearch.ts` (the main `/map` page's wrapper) is tightly coupled to a live `mapboxgl.Map` instance and not usable here, so this task calls `useUniversalSearch` directly rather than that wrapper.
- Produces: `ZipCapNoticeProps = {totalAvailable: number, shownCount: number, countyName: string, countyState: string, onOpenDashboard: (id: string, state: string) => void}`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/ZipCapNotice.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
vi.mock("@/app/shared/hooks/useUniversalSearch", () => ({
  useUniversalSearch: () => ({
    searchResults: [
      { id: "90210", name: "90210", type: "zip", state: "CA" },
      { id: "10001", name: "10001", type: "zip", state: "NY" }, // wrong state — must be filtered out
    ],
    searchLoading: false,
    handleSearch: vi.fn(),
    clearSearch: vi.fn(),
  }),
}));
import { ZipCapNotice } from "../ZipCapNotice";

describe("ZipCapNotice", () => {
  it("shows the cap disclosure and only same-state search results", () => {
    const onOpenDashboard = vi.fn();
    render(
      <ZipCapNotice
        totalAvailable={140}
        shownCount={70}
        countyName="Los Angeles County"
        countyState="CA"
        onOpenDashboard={onOpenDashboard}
      />,
    );
    expect(
      screen.getByText(/Showing top 70 of 140 ZIP codes in Los Angeles County/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/search.*zip/i), {
      target: { value: "902" },
    });
    expect(screen.getByText("90210")).toBeInTheDocument();
    expect(screen.queryByText("10001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("90210"));
    expect(onOpenDashboard).toHaveBeenCalledWith("90210", "CA");
  });

  it("renders nothing when not capped", () => {
    const { container } = render(
      <ZipCapNotice
        totalAvailable={12}
        shownCount={12}
        countyName="X"
        countyState="CA"
        onOpenDashboard={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/ZipCapNotice.test.tsx`
Expected: FAIL — `ZipCapNotice` doesn't exist.

- [ ] **Step 3: Create `ZipCapNotice.tsx`**

```tsx
// packages/frontend/app/(app)/market/explorer/components/ZipCapNotice.tsx
"use client";
import React from "react";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";

export interface ZipCapNoticeProps {
  totalAvailable: number;
  shownCount: number;
  countyName: string;
  countyState: string;
  onOpenDashboard: (id: string, state: string) => void;
}

/**
 * Discloses the ZIP-tier fetch cap (see docs/superpowers/specs/2026-07-15-
 * market-explorer-real-boundary-tiles-design.md §2) and lets the user reach a
 * ZIP outside the capped roster by routing straight to its full dashboard
 * (/market/[id]) rather than trying to splice a synthetic region into the
 * capped in-memory scrub view.
 */
export function ZipCapNotice(props: ZipCapNoticeProps) {
  const {
    totalAvailable,
    shownCount,
    countyName,
    countyState,
    onOpenDashboard,
  } = props;
  const { searchResults, searchLoading, handleSearch, clearSearch } =
    useUniversalSearch({ filterByGeoLevel: "zip" });

  if (totalAvailable <= shownCount) return null;

  const sameState = searchResults.filter((r) => r.state === countyState);

  return (
    <div
      style={{
        padding: "4px 20px 8px",
        fontSize: 11.5,
        color: "var(--md-primary)",
      }}
    >
      <span>
        Showing top {shownCount} of {totalAvailable} ZIP codes in {countyName}{" "}
        —{" "}
      </span>
      <input
        type="search"
        placeholder="search a specific ZIP"
        onChange={(e) => handleSearch(e.target.value)}
        style={{
          border: "1px solid var(--md-outline-variant)",
          borderRadius: 999,
          padding: "2px 10px",
          fontSize: 11.5,
        }}
      />
      {searchLoading && <span> searching…</span>}
      {sameState.length > 0 && (
        <ul style={{ listStyle: "none", margin: "4px 0 0", padding: 0 }}>
          {sameState.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onOpenDashboard(r.id, r.state);
                  clearSearch();
                }}
                style={{
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--md-primary)",
                  padding: "2px 0",
                }}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/ZipCapNotice.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into `MarketExplorer.tsx`**

```tsx
// Add import:
import { ZipCapNotice } from "./components/ZipCapNotice";

// Reuse the EXISTING openDashboard(r) function (already in MarketExplorer.tsx) — do not write a second navigation path.

// Render just below <HeroVisualization ... /> in the JSX, gated to zip scope:
{
  scope.geoLevel === "zip" && totalAvailable != null && (
    <ZipCapNotice
      totalAvailable={totalAvailable}
      shownCount={regions.length}
      countyName={scopeName ?? "this county"}
      countyState={selected?.state ?? regions[0]?.state ?? ""}
      onOpenDashboard={(id, state) => openDashboard({ id, state })}
    />
  );
}
```

- [ ] **Step 6: Manual E2E verification against real data**

Drill State → Metro → County → ZIP in a live browser session to a county known to exceed 70 ZIPs (e.g. Los Angeles County, CA — `curl "http://localhost:3001/api/market-explorer/scope/zip?parentLevel=county&parentId=06037&months=1"` to confirm `totalAvailable` is populated and greater than `regions.length` before checking the UI). Confirm the notice renders with correct counts, typing a ZIP not in the visible set returns same-state results only, and clicking one navigates to `/market/{zip}?type=zip&state=CA`.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/\(app\)/market/explorer/components/ZipCapNotice.tsx packages/frontend/app/\(app\)/market/explorer/components/__tests__/ZipCapNotice.test.tsx packages/frontend/app/\(app\)/market/explorer/MarketExplorer.tsx
git commit -m "feat(market-explorer): disclose the ZIP fetch cap and let users jump straight to any ZIP's dashboard"
```

---

## End-to-end verification (do this after Task 12, before calling the plan done)

Per project convention, no task above is "done" on tests-pass alone — drive the real feature in a browser against real data:

1. Start local dev (`npm run dev:fresh`), confirm both servers up.
2. Load `/market`, confirm Market Explorer renders with real data (repeat of the very first verification in this session, now against the new combined-metric endpoint).
3. Drill State → Metro → County → ZIP. At each level: toggle Map view, confirm real boundary shapes render (not the old 50-state grid at every level); confirm switching to a metric other than PropertyIQ Score still shows real values for regions with null score (the original bug this whole effort started from).
4. At national metro scope, confirm the tile map shows far more shapes than the bubble view (verifying the uncapped-tiles/capped-bubbles split), and the bubble view's "top 70 of ~935" notice appears and its "Map view" pointer works.
5. Drill into a large county (LA/Cook/Harris) and confirm the ZIP-tier cap notice appears with correct counts, search-to-jump works, and clicking a result opens that ZIP's dashboard.
6. Check backend logs for `[Scope Cache] SET market-explorer:v2:...` on first load of a scope, then confirm a second identical request doesn't re-trigger the Supabase queries (cache hit) — matching the verification pattern already established for `MarketSnapshotService`.
7. Re-run the full test suites one more time after all tasks land: `cd packages/backend && npx jest src/market-explorer` and `cd packages/frontend && npx vitest run app/\(app\)/market/explorer lib/data/fetchers/__tests__/market-explorer.test.ts`.
