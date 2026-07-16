# Market Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/market` as a "Market Explorer" — a geo drill-down (State→Metro→County→ZIP) data-visualization workspace that renders the `Market Explorer.dc.html` prototype's full feature set (log-scale bubble chart + US state tile map, 6-metric switcher, 10-year scrub-and-play timeline, 5-KPI strip, listings bar + momentum donut + top-movers, pin-to-compare, ranked leaderboard, and a sticky score detail rail) against real PropertyIQ backend data.

**Architecture:** One new NestJS endpoint (`GET /api/market-explorer/scope/:geoLevel`) resolves the child regions of any scope (via `geography_crosswalk` + `screener_snapshot`) and batches ONE metric across ALL those regions over a date range in a single query, returning value-arrays aligned to a shared monthly `dates` axis (so the timeline scrubber indexes pre-fetched arrays with zero refetch per tick). The frontend fetches a fixed set of 8 core metrics once per scope through `@/lib/data`, derives Home-Value-YoY / Rent-Yield / Months-of-Supply client-side, and composes ~14 presentational React components under a single `MarketExplorer` orchestrator that owns `{path, selectedId, pinnedIds, metric, monthIndex, view, range, playing, includeNearby}` via a reducer.

**Tech Stack:** NestJS 11 + Supabase JS (backend), Next.js 16 App Router + React 19 + TanStack Query 5 (frontend), Tailwind v4 M3 tokens, inline SVG for all charts (no charting lib), Jest (backend tests), Vitest + @testing-library/react (frontend tests).

## Global Constraints

- **All frontend data fetching MUST go through `@/lib/data`** (fetchers + hooks). Never call `fetch()`/`API_URL` directly from components. New fetchers live in `lib/data/fetchers/` and are re-exported from `lib/data/fetchers/index.ts` and `lib/data/index.ts`. (CLAUDE.md §5)
- **Never hardcode metric formatting.** Use `formatMetricValue(value, format, opts?)`, `getMetricFormat(id)`, `getMetricTitle(id)` from `@/lib/data`. Location names use `titleCaseLocationName(name)` from `@/lib/data`. (CLAUDE.md §6)
- **Never write ad-hoc metric→table fallback logic.** Reuse `getMetricMapping()` (`timeseries/timeseries-metric-mapping.ts`) and `getTableName()`/`addRegionFilter()` (`timeseries/timeseries-region-filter.ts`) for every DB read. (CLAUDE.md §1.1, §5.1)
- **Every API endpoint validates input** with `class-validator` DTOs + `ValidationPipe({ transform: true, whitelist: true })`. (CLAUDE.md §1.2)
- **No secret fallbacks; RLS is supreme; no `service_role` on the client.** This feature reads only public market data through the anon-keyed Supabase client already injected as `SUPABASE_CLIENT`. (CLAUDE.md §1.2)
- **File-size limits (hard):** logic/hook/util files ≤300 lines, React components ≤400 lines. One exported component per file. Split aggressively — this feature is intentionally decomposed into ~14 components + ~5 logic files for this reason. (CLAUDE.md §1.3)
- **Score display uses the standardized components only:** `ScoreGaugeRing`, `ConfidenceDisplay`, `InheritedBadge` from `app/components/scoring/`, and the canonical `getScoreColor(value, maxValue=100)` / `getScoreLabel(value)` re-exported from `app/components/scoring/ScoreDisplay`. Do NOT invent a new score color ramp or momentum vocabulary. (CLAUDE.md §9)
- **Score momentum labels are NOT quality grades.** `50 = STEADY = state average`. Never reintroduce EXCELLENT/GOOD/POOR wording. (CLAUDE.md §9)
- **Branch:** all work lands on a feature branch `feat/market-explorer` off `develop`. Never push without the user's ask. Commit with explicit pathspecs (`git commit -- <paths>`), verifying `git branch --show-current` first.
- **Run commands from the package directory.** Backend: `cd packages/backend`. Frontend: `cd packages/frontend`.
- **KNOWN DATA LIMITATION — Months of Supply (explicit, do not silently design around):** No `months_of_supply` time-series exists in the metric-mapping; only `screener_snapshot.months_of_supply` (a current snapshot) does. This plan KEEPS Months of Supply as a fully-scrubbable 6th metric by **deriving** it from two Realtor series that DO have full history: `for_sale_inventory` (active listings) ÷ `home_sales` (monthly pending sales) = approximate months-of-supply. Task 6 validates that the derived latest-month value is within tolerance of `screener_snapshot.months_of_supply`; Task 9/Task 25 render a one-line provenance note ("Months of Supply — derived: active listings ÷ pending sales"). **Fallback if validation fails** (documented for the reviewer to choose): render MoS as its current `screener_snapshot` value held flat across all months with the annotation "(current value — history unavailable)", every other metric scrubbing normally. The switcher's 6-metric set is unchanged either way.
- **STATE level via aggregation (mirrors the prototype's `stateEnts`):** PropertyIQ Score has no state-level rows, so state score = simple mean of the state's scored metros' scores, computed server-side by the `me_state_score_series` RPC (Task 5). Every other metric at state level reads its native state table (`zillow_state` / `realtor_state`) through the same `getTableName`/`addRegionFilter` path. State-level YoY/Yield/Supply are derived from those native state series. No metric or level is dropped.

---

### Task 1: Backend module scaffold + scope DTO + response types

**Files:**

- Create: `packages/backend/src/market-explorer/market-explorer.types.ts`
- Create: `packages/backend/src/market-explorer/market-explorer.dto.ts`
- Create: `packages/backend/src/market-explorer/market-explorer.service.ts` (stub — real logic in Task 6)
- Create: `packages/backend/src/market-explorer/market-explorer.controller.ts`
- Create: `packages/backend/src/market-explorer/market-explorer.module.ts`
- Modify: `packages/backend/src/app.module.ts` (add `MarketExplorerModule` to `imports`)
- Test: `packages/backend/src/market-explorer/__tests__/market-explorer.dto.spec.ts`

**Interfaces:**

- Consumes: nothing (first task).
- Produces:
  - `ScopeRegion { id: string; name: string; state: string; population: number | null; nearby?: boolean }`
  - `ScopeSeriesResponse { success: true; geoLevel: string; metric: string; months: number; dates: string[]; regions: ScopeRegion[]; series: Record<string, (number | null)[]> }`
  - `class ScopeQueryDto { parentLevel?: 'state'|'metro'|'county'; parentId?: string; metric: string; months: number; includeNearby?: boolean }`
  - `MarketExplorerService.getScopeSeries(geoLevel: string, dto: ScopeQueryDto): Promise<ScopeSeriesResponse>` (stub returns empty in this task)
  - Route `GET /api/market-explorer/scope/:geoLevel`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/market-explorer/__tests__/market-explorer.dto.spec.ts
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { ScopeQueryDto } from "../market-explorer.dto";

describe("ScopeQueryDto", () => {
  it("accepts a valid metro-in-state query", async () => {
    const dto = plainToInstance(ScopeQueryDto, {
      parentLevel: "state",
      parentId: "48",
      metric: "propertyiq_score",
      months: "120",
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.months).toBe(120); // transformed to number
  });

  it("rejects months above the 120 cap", async () => {
    const dto = plainToInstance(ScopeQueryDto, {
      metric: "home_value",
      months: "999",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "months")).toBe(true);
  });

  it("rejects a missing metric", async () => {
    const dto = plainToInstance(ScopeQueryDto, { months: "12" });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "metric")).toBe(true);
  });

  it("rejects an unknown parentLevel", async () => {
    const dto = plainToInstance(ScopeQueryDto, {
      parentLevel: "planet",
      metric: "home_value",
      months: "12",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "parentLevel")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/market-explorer.dto.spec.ts`
Expected: FAIL with "Cannot find module '../market-explorer.dto'".

- [ ] **Step 3: Write minimal implementation**

```typescript
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
  metric: string;
  months: number;
  dates: string[];
  regions: ScopeRegion[];
  series: Record<string, (number | null)[]>;
}
```

```typescript
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

  @IsString()
  metric!: string;

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

```typescript
// packages/backend/src/market-explorer/market-explorer.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { ScopeQueryDto } from "./market-explorer.dto";
import { ScopeSeriesResponse } from "./market-explorer.types";

@Injectable()
export class MarketExplorerService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // Real implementation lands in Task 6; stub keeps the controller wireable.
  async getScopeSeries(
    geoLevel: string,
    dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    return {
      success: true,
      geoLevel,
      metric: dto.metric,
      months: dto.months,
      dates: [],
      regions: [],
      series: {},
    };
  }
}
```

```typescript
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
      "One metric across all child regions of a scope, aligned to a shared monthly axis",
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

```typescript
// packages/backend/src/market-explorer/market-explorer.module.ts
import { Module } from "@nestjs/common";
import { MarketExplorerController } from "./market-explorer.controller";
import { MarketExplorerService } from "./market-explorer.service";

@Module({
  controllers: [MarketExplorerController],
  providers: [MarketExplorerService],
  exports: [MarketExplorerService],
})
export class MarketExplorerModule {}
```

Then add to `packages/backend/src/app.module.ts`: import `MarketExplorerModule` and add it to the `imports` array (mirror how `TimeSeriesModule` is registered).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/market-explorer.dto.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-explorer packages/backend/src/app.module.ts
git commit -m "feat(market-explorer): scaffold scope endpoint module, DTO, and response types"
```

---

### Task 2: `alignSeriesToAxis` — pivot raw rows into axis-aligned value arrays

**Files:**

- Create: `packages/backend/src/market-explorer/align-series.ts`
- Test: `packages/backend/src/market-explorer/__tests__/align-series.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `interface MetricRow { regionId: string; date: string; value: number | null }`
  - `function alignSeriesToAxis(rows: MetricRow[], months: number, anchorDate?: string): { dates: string[]; series: Record<string, (number | null)[]> }`
  - `dates` are `YYYY-MM-01` strings, ascending, length ≤ `months`, ending at the latest month present (or `anchorDate`'s month). Each region's array is aligned to `dates` with `null` for gaps.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/market-explorer/__tests__/align-series.spec.ts
import { alignSeriesToAxis } from "../align-series";

describe("alignSeriesToAxis", () => {
  it("builds a shared ascending monthly axis and aligns each region to it", () => {
    const rows = [
      { regionId: "A", date: "2026-05-31", value: 10 },
      { regionId: "A", date: "2026-04-30", value: 9 },
      { regionId: "B", date: "2026-05-15", value: 20 },
    ];
    const { dates, series } = alignSeriesToAxis(rows, 3);
    expect(dates).toEqual(["2026-03-01", "2026-04-01", "2026-05-01"]);
    expect(series.A).toEqual([null, 9, 10]);
    expect(series.B).toEqual([null, null, 20]);
  });

  it("clamps the axis to the requested month count (most recent kept)", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      regionId: "A",
      date: `2026-0${i + 1}-01`,
      value: i,
    }));
    const { dates } = alignSeriesToAxis(rows, 3);
    expect(dates).toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);
  });

  it("returns empty axis and series for no rows", () => {
    expect(alignSeriesToAxis([], 12)).toEqual({ dates: [], series: {} });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/align-series.spec.ts`
Expected: FAIL with "Cannot find module '../align-series'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/backend/src/market-explorer/align-series.ts
export interface MetricRow {
  regionId: string;
  date: string;
  value: number | null;
}

/** Normalize any ISO date to the first-of-month key 'YYYY-MM-01'. */
function monthKey(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * Pivot long-format rows into arrays aligned to one shared monthly axis.
 * The axis is the last `months` distinct months present (ascending), so the
 * frontend timeline scrubber can index every region's array by integer month.
 */
export function alignSeriesToAxis(
  rows: MetricRow[],
  months: number,
): { dates: string[]; series: Record<string, (number | null)[]> } {
  if (!rows.length) return { dates: [], series: {} };

  const allMonths = [...new Set(rows.map((r) => monthKey(r.date)))].sort();
  const dates = allMonths.slice(-months);
  const idx = new Map(dates.map((d, i) => [d, i]));

  const series: Record<string, (number | null)[]> = {};
  for (const row of rows) {
    const i = idx.get(monthKey(row.date));
    if (i === undefined) continue; // older than the window
    if (!series[row.regionId])
      series[row.regionId] = new Array(dates.length).fill(null);
    series[row.regionId][i] = row.value;
  }
  return { dates, series };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/align-series.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-explorer/align-series.ts packages/backend/src/market-explorer/__tests__/align-series.spec.ts
git commit -m "feat(market-explorer): add alignSeriesToAxis pivot helper"
```

---

### Task 3: `resolveChildRegions` — crosswalk membership + screener roster + population cap

**Files:**

- Create: `packages/backend/src/market-explorer/resolve-child-regions.ts`
- Test: `packages/backend/src/market-explorer/__tests__/resolve-child-regions.spec.ts`

**Interfaces:**

- Consumes: `ScopeRegion` (Task 1), `SupabaseClient` (mocked in test).
- Produces:
  - `const NATIONAL_METRO_CAP = 40` and `const CHILD_CAP = 60`
  - `async function resolveChildRegions(supabase, geoLevel, parentLevel, parentId, includeNearby): Promise<ScopeRegion[]>` — ordered (population desc, NULLs last), capped roster. `geoLevel==='state'` returns `[]` (states come from the `US_STATES` constant in Task 5).

**Data facts (verified):** `geography_crosswalk` columns = `zip_code, county_fips, cbsa_code, state_fips`. `screener_snapshot` has `geo_level, region_id, region_name, state_code, population`; `region_id` = CBSA (metro) / county FIPS (county) / ZIP (zip). National metro roster = top `NATIONAL_METRO_CAP` scored metros by `population`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/market-explorer/__tests__/resolve-child-regions.spec.ts
import {
  resolveChildRegions,
  NATIONAL_METRO_CAP,
} from "../resolve-child-regions";

/** Minimal thenable Supabase query-builder mock. */
function makeSupabase(handlers: {
  crosswalk?: (col: string, val: string) => any[];
  snapshot?: (ids: string[]) => any[];
  topMetros?: () => any[];
}) {
  return {
    from(table: string) {
      const state: any = { table, _eqCol: null, _eqVal: null, _inIds: null };
      const builder: any = {
        select: () => builder,
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
        then: (resolve: any) => {
          let data: any[] = [];
          if (table === "geography_crosswalk")
            data = handlers.crosswalk!(state._eqCol, state._eqVal);
          else if (state._inIds) data = handlers.snapshot!(state._inIds);
          else data = handlers.topMetros!();
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  } as any;
}

describe("resolveChildRegions", () => {
  it("returns top-N metros by population at national scope", async () => {
    const supabase = makeSupabase({
      topMetros: () => [
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
    });
    const rows = await resolveChildRegions(
      supabase,
      "metro",
      undefined,
      undefined,
      false,
    );
    expect(rows[0]).toEqual({
      id: "35620",
      name: "New York",
      state: "NY",
      population: 20000000,
    });
    expect(rows.length).toBeLessThanOrEqual(NATIONAL_METRO_CAP);
  });

  it("resolves counties of a metro via the crosswalk then reads snapshot names", async () => {
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

  it("returns empty for state geoLevel (states come from US_STATES constant)", async () => {
    const supabase = makeSupabase({});
    expect(
      await resolveChildRegions(supabase, "state", undefined, undefined, false),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/resolve-child-regions.spec.ts`
Expected: FAIL with "Cannot find module '../resolve-child-regions'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/backend/src/market-explorer/resolve-child-regions.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { ScopeRegion } from "./market-explorer.types";

export const NATIONAL_METRO_CAP = 40;
export const CHILD_CAP = 60;

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

async function distinctCrosswalkIds(
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

async function snapshotRoster(
  supabase: SupabaseClient,
  geoLevel: string,
  ids: string[],
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
  return out.slice(0, CHILD_CAP);
}

/**
 * Ordered, capped roster of a scope's child regions.
 * National metro scope (no parent) = top NATIONAL_METRO_CAP scored metros by population.
 * Deeper scopes resolve child IDs from geography_crosswalk, then names/population from screener_snapshot.
 */
export async function resolveChildRegions(
  supabase: SupabaseClient,
  geoLevel: string,
  parentLevel: string | undefined,
  parentId: string | undefined,
  _includeNearby: boolean,
): Promise<ScopeRegion[]> {
  if (geoLevel === "state") return [];

  if (geoLevel === "metro" && !parentId) {
    const { data } = await supabase
      .from("screener_snapshot")
      .select("region_id, region_name, state_code, population")
      .eq("geo_level", "metro")
      .not("population", "is", null)
      .order("population", { ascending: false, nullsFirst: false })
      .limit(NATIONAL_METRO_CAP);
    return (data ?? []).map((r: any) => ({
      id: r.region_id,
      name: r.region_name,
      state: r.state_code,
      population: r.population ?? null,
    }));
  }

  if (!parentLevel || !parentId) return [];
  const ids = await distinctCrosswalkIds(
    supabase,
    CHILD_COL[geoLevel],
    PARENT_COL[parentLevel],
    parentId,
  );
  return snapshotRoster(supabase, geoLevel, ids);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/resolve-child-regions.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-explorer/resolve-child-regions.ts packages/backend/src/market-explorer/__tests__/resolve-child-regions.spec.ts
git commit -m "feat(market-explorer): resolve capped child-region roster from crosswalk + screener_snapshot"
```

---

### Task 4: `fetchMetricSeriesForRegions` — batched one-metric-many-regions query (metro/county/zip)

**Files:**

- Create: `packages/backend/src/market-explorer/fetch-metric-series.ts`
- Test: `packages/backend/src/market-explorer/__tests__/fetch-metric-series.spec.ts`

**Interfaces:**

- Consumes: `MetricRow` (Task 2), `getMetricMapping` (`../timeseries/timeseries-metric-mapping`), `getTableName` (`../timeseries/timeseries-region-filter`), `SupabaseClient`.
- Produces:
  - `function batchIdColumn(source: string, geoLevel: string): string`
  - `async function fetchMetricSeriesForRegions(supabase, metricId, geoLevel, regionIds, startDate): Promise<MetricRow[]>` — ONE query (paginated `.range`) selecting `[idCol, dateField, valueCol]` filtered `.in(idCol, regionIds)` + metric_name/score_type/geography filters + `.gte(dateField, startDate)`, returning rows keyed by region id.

**Data facts (verified from `timeseries-metric-mapping.ts` + `timeseries-region-filter.ts`):** All 8 fetched metrics map to `zillow` (metric*name filter), `realtor` (direct column), or `propertyiq` (score column, `score_type`+`geography` filter) — none are `computed*\*`. Date field: `propertyiq`→`score_date`, else `period_date`. Batch id column: `propertyiq`→`location_id`; `zillow`→ metro `cbsa_code`/ county`fips_code`/ zip`region_name`; `realtor`→ metro `cbsa_code`/ county`county_fips`/ zip`postal_code`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/market-explorer/__tests__/fetch-metric-series.spec.ts
import {
  batchIdColumn,
  fetchMetricSeriesForRegions,
} from "../fetch-metric-series";

describe("batchIdColumn", () => {
  it("maps (source, geoLevel) to the correct .in() column", () => {
    expect(batchIdColumn("propertyiq", "county")).toBe("location_id");
    expect(batchIdColumn("zillow", "metro")).toBe("cbsa_code");
    expect(batchIdColumn("zillow", "county")).toBe("fips_code");
    expect(batchIdColumn("zillow", "zip")).toBe("region_name");
    expect(batchIdColumn("realtor", "county")).toBe("county_fips");
    expect(batchIdColumn("realtor", "zip")).toBe("postal_code");
  });
});

describe("fetchMetricSeriesForRegions", () => {
  function makeSupabase(rows: any[], capture: any) {
    const builder: any = {
      select: (cols: string) => {
        capture.cols = cols;
        return builder;
      },
      eq: (c: string, v: string) => {
        (capture.eq ??= {})[c] = v;
        return builder;
      },
      in: (c: string, ids: string[]) => {
        capture.inCol = c;
        capture.inIds = ids;
        return builder;
      },
      gte: (c: string, v: string) => {
        capture.gte = [c, v];
        return builder;
      },
      not: () => builder,
      order: () => builder,
      range: async (from: number) => ({
        data: from === 0 ? rows : [],
        error: null,
      }),
    };
    return {
      from: (t: string) => {
        capture.table = t;
        return builder;
      },
    } as any;
  }

  it("batches a zillow metric with metric_name + cbsa_code filter", async () => {
    const capture: any = {};
    const supabase = makeSupabase(
      [{ cbsa_code: "35620", period_date: "2026-05-01", value: 700000 }],
      capture,
    );
    const out = await fetchMetricSeriesForRegions(
      supabase,
      "home_value",
      "metro",
      ["35620"],
      "2016-06-01",
    );
    expect(capture.table).toBe("zillow_metro");
    expect(capture.eq.metric_name).toBe("zhvi");
    expect(capture.inCol).toBe("cbsa_code");
    expect(capture.gte).toEqual(["period_date", "2016-06-01"]);
    expect(out).toEqual([
      { regionId: "35620", date: "2026-05-01", value: 700000 },
    ]);
  });

  it("batches propertyiq score with score_type + geography filter and score_date field", async () => {
    const capture: any = {};
    const supabase = makeSupabase(
      [{ location_id: "48113", score_date: "2026-05-01", score: 61 }],
      capture,
    );
    const out = await fetchMetricSeriesForRegions(
      supabase,
      "propertyiq_score",
      "county",
      ["48113"],
      "2016-06-01",
    );
    expect(capture.table).toBe("propertyiq_scores");
    expect(capture.eq.score_type).toBe("propertyiq");
    expect(capture.eq.geography).toBe("county");
    expect(out[0]).toEqual({
      regionId: "48113",
      date: "2026-05-01",
      value: 61,
    });
  });

  it("returns [] for an unknown metric", async () => {
    const out = await fetchMetricSeriesForRegions(
      makeSupabase([], {}),
      "nope",
      "metro",
      ["x"],
      "2016-06-01",
    );
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/fetch-metric-series.spec.ts`
Expected: FAIL with "Cannot find module '../fetch-metric-series'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/backend/src/market-explorer/fetch-metric-series.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { getMetricMapping } from "../timeseries/timeseries-metric-mapping";
import { getTableName } from "../timeseries/timeseries-region-filter";
import { MetricRow } from "./align-series";

const PAGE = 1000;

/** Column to use with `.in(col, ids)` for a (source, geoLevel) batch read. */
export function batchIdColumn(source: string, geoLevel: string): string {
  if (source === "propertyiq") return "location_id";
  if (source === "realtor") {
    return geoLevel === "metro"
      ? "cbsa_code"
      : geoLevel === "county"
        ? "county_fips"
        : "postal_code";
  }
  // zillow (and any period_date source keyed like zillow)
  return geoLevel === "metro"
    ? "cbsa_code"
    : geoLevel === "county"
      ? "fips_code"
      : "region_name";
}

function dateField(source: string): string {
  return source === "propertyiq" ? "score_date" : "period_date";
}

/**
 * ONE metric across MANY regions in a single paginated query.
 * Only supports the direct sources this feature reads (zillow/realtor/propertyiq).
 */
export async function fetchMetricSeriesForRegions(
  supabase: SupabaseClient,
  metricId: string,
  geoLevel: string,
  regionIds: string[],
  startDate: string,
): Promise<MetricRow[]> {
  const mapping = getMetricMapping(metricId);
  if (!mapping || !regionIds.length) return [];
  const table = getTableName(mapping.source, geoLevel);
  if (!table) return [];

  const df = dateField(mapping.source);
  const idCol = batchIdColumn(mapping.source, geoLevel);
  const valCol = mapping.columnName;

  const rows: MetricRow[] = [];
  // Chunk the id list, paginate each chunk.
  for (let c = 0; c < regionIds.length; c += 300) {
    const chunk = regionIds.slice(c, c + 300);
    let offset = 0;
    let page: any[];
    do {
      let q = supabase
        .from(table)
        .select(`${idCol}, ${df}, ${valCol}`)
        .in(idCol, chunk)
        .gte(df, startDate)
        .order(df, { ascending: true });
      if (mapping.source === "propertyiq") {
        q = q
          .eq("score_type", mapping.metricNameValue!)
          .eq("geography", geoLevel);
      } else if (mapping.usesMetricName && mapping.source === "zillow") {
        q = q.eq("metric_name", mapping.metricNameValue!);
      }
      const { data, error } = await q.range(offset, offset + PAGE - 1);
      if (error) break;
      page = (data ?? []) as any[];
      for (const r of page) {
        rows.push({
          regionId: String(r[idCol]),
          date: String(r[df]),
          value: r[valCol] == null ? null : Number(r[valCol]),
        });
      }
      offset += page.length;
    } while (page.length === PAGE);
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/fetch-metric-series.spec.ts`
Expected: PASS (5 assertions across 4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/market-explorer/fetch-metric-series.ts packages/backend/src/market-explorer/__tests__/fetch-metric-series.spec.ts
git commit -m "feat(market-explorer): batched one-metric-many-regions metric query"
```

---

### Task 5: State-level series — `me_state_score_series` RPC + native state tables + `US_STATES`

**Files:**

- Create: `supabase/migrations/20260714120000_market_explorer_state_score_series.sql`
- Create: `packages/backend/src/market-explorer/us-states.ts`
- Create: `packages/backend/src/market-explorer/fetch-state-series.ts`
- Test: `packages/backend/src/market-explorer/__tests__/fetch-state-series.spec.ts`

**Interfaces:**

- Consumes: `MetricRow` (Task 2), `getMetricMapping`, `getTableName`, `SupabaseClient`.
- Produces:
  - `US_STATES: { fips: string; abbr: string; name: string }[]` (50 states + DC) plus `stateFipsByName`, `stateFipsByAbbr`, `stateRegions(): ScopeRegion[]`.
  - `async function fetchStateMetricSeries(supabase, metricId, startDate): Promise<MetricRow[]>` keyed by `state_fips`. `propertyiq_score`→ RPC `me_state_score_series`; every other metric → its native state table (`zillow_state`/`realtor_state`) with keys mapped to FIPS.

**Rationale (Global Constraints "STATE level via aggregation"):** PropertyIQ Score has no state rows → aggregate metros via the RPC (simple mean, matching the prototype's `stateEnts`). All other metrics use real native state-table series.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/market-explorer/__tests__/fetch-state-series.spec.ts
import { US_STATES, stateFipsByAbbr, stateRegions } from "../us-states";
import { fetchStateMetricSeries } from "../fetch-state-series";

describe("US_STATES", () => {
  it("covers all 50 states plus DC with unique FIPS", () => {
    expect(US_STATES).toHaveLength(51);
    expect(new Set(US_STATES.map((s) => s.fips)).size).toBe(51);
    expect(stateFipsByAbbr["TX"]).toBe("48");
    expect(stateRegions()[0]).toHaveProperty("id");
  });
});

describe("fetchStateMetricSeries", () => {
  it("calls the aggregation RPC for propertyiq_score", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ state_fips: "48", score_date: "2026-05-01", avg_score: 55.5 }],
      error: null,
    });
    const supabase = { rpc } as any;
    const rows = await fetchStateMetricSeries(
      supabase,
      "propertyiq_score",
      "2016-06-01",
    );
    expect(rpc).toHaveBeenCalledWith("me_state_score_series", {
      p_start: "2016-06-01",
    });
    expect(rows[0]).toEqual({
      regionId: "48",
      date: "2026-05-01",
      value: 55.5,
    });
  });

  it("reads native zillow_state rows and maps region_name to FIPS", async () => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      not: () => builder,
      order: () => builder,
      range: async (from: number) => ({
        data:
          from === 0
            ? [
                {
                  region_name: "Texas",
                  period_date: "2026-05-01",
                  value: 350000,
                },
              ]
            : [],
        error: null,
      }),
    };
    const supabase = { from: () => builder, rpc: jest.fn() } as any;
    const rows = await fetchStateMetricSeries(
      supabase,
      "home_value",
      "2016-06-01",
    );
    expect(rows[0]).toEqual({
      regionId: "48",
      date: "2026-05-01",
      value: 350000,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/fetch-state-series.spec.ts`
Expected: FAIL with "Cannot find module '../us-states'".

- [ ] **Step 3a: Write the migration**

```sql
-- supabase/migrations/20260714120000_market_explorer_state_score_series.sql
-- State-level PropertyIQ Score = mean of the state's scored metros (no native state rows exist).
-- distinct-on collapses the crosswalk (one row per ZIP) to one state per CBSA so a metro is
-- counted once per state, matching the prototype's stateEnts aggregation.
create or replace function me_state_score_series(p_start date)
returns table(state_fips text, score_date date, avg_score numeric)
language sql
stable
as $$
  with metro_state as (
    select distinct on (cbsa_code) cbsa_code, state_fips
    from geography_crosswalk
    where cbsa_code is not null and state_fips is not null
    order by cbsa_code, state_fips
  )
  select ms.state_fips, s.score_date, avg(s.score)::numeric as avg_score
  from propertyiq_scores s
  join metro_state ms on ms.cbsa_code = s.location_id
  where s.geography = 'metro'
    and s.score_type = 'propertyiq'
    and s.score is not null
    and s.score_date >= p_start
  group by ms.state_fips, s.score_date;
$$;

grant execute on function me_state_score_series(date) to anon, authenticated, service_role;
```

Apply it with the project's migration flow (e.g. `supabase db push` or the repo's migration runner). Verify: `select count(*) from me_state_score_series('2026-01-01');` returns > 0 rows.

- [ ] **Step 3b: Write `us-states.ts`**

```typescript
// packages/backend/src/market-explorer/us-states.ts
import { ScopeRegion } from "./market-explorer.types";

export const US_STATES: { fips: string; abbr: string; name: string }[] = [
  { fips: "01", abbr: "AL", name: "Alabama" },
  { fips: "02", abbr: "AK", name: "Alaska" },
  { fips: "04", abbr: "AZ", name: "Arizona" },
  { fips: "05", abbr: "AR", name: "Arkansas" },
  { fips: "06", abbr: "CA", name: "California" },
  { fips: "08", abbr: "CO", name: "Colorado" },
  { fips: "09", abbr: "CT", name: "Connecticut" },
  { fips: "10", abbr: "DE", name: "Delaware" },
  { fips: "11", abbr: "DC", name: "District of Columbia" },
  { fips: "12", abbr: "FL", name: "Florida" },
  { fips: "13", abbr: "GA", name: "Georgia" },
  { fips: "15", abbr: "HI", name: "Hawaii" },
  { fips: "16", abbr: "ID", name: "Idaho" },
  { fips: "17", abbr: "IL", name: "Illinois" },
  { fips: "18", abbr: "IN", name: "Indiana" },
  { fips: "19", abbr: "IA", name: "Iowa" },
  { fips: "20", abbr: "KS", name: "Kansas" },
  { fips: "21", abbr: "KY", name: "Kentucky" },
  { fips: "22", abbr: "LA", name: "Louisiana" },
  { fips: "23", abbr: "ME", name: "Maine" },
  { fips: "24", abbr: "MD", name: "Maryland" },
  { fips: "25", abbr: "MA", name: "Massachusetts" },
  { fips: "26", abbr: "MI", name: "Michigan" },
  { fips: "27", abbr: "MN", name: "Minnesota" },
  { fips: "28", abbr: "MS", name: "Mississippi" },
  { fips: "29", abbr: "MO", name: "Missouri" },
  { fips: "30", abbr: "MT", name: "Montana" },
  { fips: "31", abbr: "NE", name: "Nebraska" },
  { fips: "32", abbr: "NV", name: "Nevada" },
  { fips: "33", abbr: "NH", name: "New Hampshire" },
  { fips: "34", abbr: "NJ", name: "New Jersey" },
  { fips: "35", abbr: "NM", name: "New Mexico" },
  { fips: "36", abbr: "NY", name: "New York" },
  { fips: "37", abbr: "NC", name: "North Carolina" },
  { fips: "38", abbr: "ND", name: "North Dakota" },
  { fips: "39", abbr: "OH", name: "Ohio" },
  { fips: "40", abbr: "OK", name: "Oklahoma" },
  { fips: "41", abbr: "OR", name: "Oregon" },
  { fips: "42", abbr: "PA", name: "Pennsylvania" },
  { fips: "44", abbr: "RI", name: "Rhode Island" },
  { fips: "45", abbr: "SC", name: "South Carolina" },
  { fips: "46", abbr: "SD", name: "South Dakota" },
  { fips: "47", abbr: "TN", name: "Tennessee" },
  { fips: "48", abbr: "TX", name: "Texas" },
  { fips: "49", abbr: "UT", name: "Utah" },
  { fips: "50", abbr: "VT", name: "Vermont" },
  { fips: "51", abbr: "VA", name: "Virginia" },
  { fips: "53", abbr: "WA", name: "Washington" },
  { fips: "54", abbr: "WV", name: "West Virginia" },
  { fips: "55", abbr: "WI", name: "Wisconsin" },
  { fips: "56", abbr: "WY", name: "Wyoming" },
];

export const stateFipsByName: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.name.toLowerCase(), s.fips]),
);
export const stateFipsByAbbr: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.abbr, s.fips]),
);
export const stateAbbrByFips: Record<string, string> = Object.fromEntries(
  US_STATES.map((s) => [s.fips, s.abbr]),
);

/** All states as ScopeRegion roster entries (id = FIPS, state = abbr). */
export function stateRegions(): ScopeRegion[] {
  return US_STATES.map((s) => ({
    id: s.fips,
    name: s.name,
    state: s.abbr,
    population: null,
  }));
}
```

- [ ] **Step 3c: Write `fetch-state-series.ts`**

```typescript
// packages/backend/src/market-explorer/fetch-state-series.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { getMetricMapping } from "../timeseries/timeseries-metric-mapping";
import { getTableName } from "../timeseries/timeseries-region-filter";
import { MetricRow } from "./align-series";
import { stateFipsByName, stateFipsByAbbr } from "./us-states";

const PAGE = 1000;

/** Native state table key column per source (maps to state_fips via US_STATES). */
function stateKeyColumn(source: string): {
  col: string;
  toFips: (v: string) => string | undefined;
} {
  if (source === "realtor")
    return {
      col: "state_id",
      toFips: (v) => stateFipsByAbbr[String(v).toUpperCase()],
    };
  // zillow_state keys on the full state name in region_name
  return {
    col: "region_name",
    toFips: (v) => stateFipsByName[String(v).toLowerCase()],
  };
}

/**
 * State-level series keyed by state_fips.
 * PropertyIQ Score → mean-of-metros via RPC. All other metrics → native state table.
 */
export async function fetchStateMetricSeries(
  supabase: SupabaseClient,
  metricId: string,
  startDate: string,
): Promise<MetricRow[]> {
  if (metricId === "propertyiq_score") {
    const { data, error } = await supabase.rpc("me_state_score_series", {
      p_start: startDate,
    });
    if (error || !data) return [];
    return (data as any[]).map((r) => ({
      regionId: String(r.state_fips),
      date: String(r.score_date),
      value: r.avg_score == null ? null : Number(r.avg_score),
    }));
  }

  const mapping = getMetricMapping(metricId);
  if (!mapping) return [];
  const table = getTableName(mapping.source, "state");
  if (!table) return [];
  const { col, toFips } = stateKeyColumn(mapping.source);

  const rows: MetricRow[] = [];
  let offset = 0;
  let page: any[];
  do {
    let q = supabase
      .from(table)
      .select(`${col}, period_date, ${mapping.columnName}`)
      .gte("period_date", startDate)
      .order("period_date", { ascending: true });
    if (mapping.usesMetricName && mapping.source === "zillow") {
      q = q.eq("metric_name", mapping.metricNameValue!);
    }
    const { data, error } = await q.range(offset, offset + PAGE - 1);
    if (error) break;
    page = (data ?? []) as any[];
    for (const r of page) {
      const fips = toFips(r[col]);
      if (!fips) continue;
      rows.push({
        regionId: fips,
        date: String(r.period_date),
        value:
          r[mapping.columnName] == null ? null : Number(r[mapping.columnName]),
      });
    }
    offset += page.length;
  } while (page.length === PAGE);
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/fetch-state-series.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260714120000_market_explorer_state_score_series.sql packages/backend/src/market-explorer/us-states.ts packages/backend/src/market-explorer/fetch-state-series.ts packages/backend/src/market-explorer/__tests__/fetch-state-series.spec.ts
git commit -m "feat(market-explorer): state-level series via score-aggregation RPC + native state tables"
```

---

### Task 6: `getScopeSeries` service — compose resolver + metric fetch + alignment

**Files:**

- Modify: `packages/backend/src/market-explorer/market-explorer.service.ts` (replace the Task 1 stub body)
- Test: `packages/backend/src/market-explorer/__tests__/market-explorer.service.spec.ts`

**Interfaces:**

- Consumes: `resolveChildRegions` (Task 3), `fetchMetricSeriesForRegions` (Task 4), `fetchStateMetricSeries` + `stateRegions` (Task 5), `alignSeriesToAxis` (Task 2).
- Produces: real `MarketExplorerService.getScopeSeries(geoLevel, dto): Promise<ScopeSeriesResponse>` (shape unchanged from Task 1).

**Note on `includeNearby`:** this base composition ignores `includeNearby`. **Task 29** adds server-side nearby resolution: when `dto.includeNearby` is set, the service appends `resolveNearbyRegions(...)` (marked `nearby: true`) to `regions` before the batched metric fetch, so the same single query covers the overlay. This task leaves the field unused; Task 29 wires it.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/market-explorer/__tests__/market-explorer.service.spec.ts
import { MarketExplorerService } from "../market-explorer.service";

describe("MarketExplorerService.getScopeSeries", () => {
  it("state scope: uses stateRegions + RPC and aligns to a shared axis", async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({
        data: [
          { state_fips: "48", score_date: "2026-04-01", avg_score: 54 },
          { state_fips: "48", score_date: "2026-05-01", avg_score: 55 },
          { state_fips: "06", score_date: "2026-05-01", avg_score: 60 },
        ],
        error: null,
      }),
    } as any;
    const service = new MarketExplorerService(supabase);
    const res = await service.getScopeSeries("state", {
      metric: "propertyiq_score",
      months: 3,
    } as any);
    expect(res.regions.length).toBe(51);
    expect(res.dates).toEqual(["2026-03-01", "2026-04-01", "2026-05-01"]);
    expect(res.series["48"]).toEqual([null, 54, 55]);
    expect(res.series["06"]).toEqual([null, null, 60]);
  });

  it("national metro scope: roster from screener_snapshot, series from the metric table", async () => {
    const builder = (rows: any[]) => {
      const b: any = {
        select: () => b,
        eq: () => b,
        in: () => b,
        gte: () => b,
        not: () => b,
        order: () => b,
        limit: () => b,
        range: async (from: number) => ({
          data: from === 0 ? rows : [],
          error: null,
        }),
        then: (r: any) => Promise.resolve({ data: rows, error: null }).then(r),
      };
      return b;
    };
    const supabase = {
      from: (table: string) =>
        table === "screener_snapshot"
          ? builder([
              {
                region_id: "35620",
                region_name: "New York",
                state_code: "NY",
                population: 20000000,
              },
            ])
          : builder([
              { cbsa_code: "35620", period_date: "2026-05-01", value: 700000 },
            ]),
      rpc: jest.fn(),
    } as any;
    const service = new MarketExplorerService(supabase);
    const res = await service.getScopeSeries("metro", {
      metric: "home_value",
      months: 2,
    } as any);
    expect(res.regions[0].id).toBe("35620");
    expect(res.series["35620"][res.dates.length - 1]).toBe(700000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/market-explorer.service.spec.ts`
Expected: FAIL — the stub returns empty `dates`/`regions`/`series`, so the assertions fail.

- [ ] **Step 3: Write minimal implementation**

Replace the `getScopeSeries` body (and add imports) in `market-explorer.service.ts`:

```typescript
import { Injectable, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { ScopeQueryDto } from "./market-explorer.dto";
import { ScopeSeriesResponse } from "./market-explorer.types";
import { resolveChildRegions } from "./resolve-child-regions";
import { fetchMetricSeriesForRegions } from "./fetch-metric-series";
import { fetchStateMetricSeries } from "./fetch-state-series";
import { stateRegions } from "./us-states";
import { alignSeriesToAxis } from "./align-series";

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
    let rows;
    if (geoLevel === "state") {
      regions = stateRegions();
      rows = await fetchStateMetricSeries(this.supabase, dto.metric, startDate);
    } else {
      regions = await resolveChildRegions(
        this.supabase,
        geoLevel,
        dto.parentLevel,
        dto.parentId,
        !!dto.includeNearby,
      );
      rows = await fetchMetricSeriesForRegions(
        this.supabase,
        dto.metric,
        geoLevel,
        regions.map((r) => r.id),
        startDate,
      );
    }

    const { dates, series } = alignSeriesToAxis(rows, dto.months);
    return {
      success: true,
      geoLevel,
      metric: dto.metric,
      months: dto.months,
      dates,
      regions,
      series,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/market-explorer.service.spec.ts`
Expected: PASS (2 tests). Then run the whole module: `cd packages/backend && npx jest src/market-explorer` — Expected: PASS (all suites).

- [ ] **Step 5: Manual E2E against the real DB + MoS reconciliation check**

Start the backend (`cd packages/backend && npm run start:dev`), then verify real data flows and the MoS derivation reconciles:

```bash
# National metros, PropertyIQ score, 24 months — expect regions.length ~40, dates ~24, series populated
curl -s "http://localhost:3001/api/market-explorer/scope/metro?metric=propertyiq_score&months=24" | jq '{regions: (.regions|length), dates: (.dates|length), sample: (.series|to_entries[0])}'
# State tile map data (score) — expect regions.length 51, populated series for most states
curl -s "http://localhost:3001/api/market-explorer/scope/state?metric=propertyiq_score&months=24" | jq '{regions:(.regions|length), sampleTX: .series["48"][-1]}'
# Counties of Dallas–Fort Worth metro
curl -s "http://localhost:3001/api/market-explorer/scope/county?parentLevel=metro&parentId=19100&metric=home_value&months=12" | jq '{regions:(.regions|length)}'
# MoS reconciliation: derived (active ÷ pending) latest vs screener_snapshot.months_of_supply for one metro
curl -s "http://localhost:3001/api/market-explorer/scope/metro?metric=for_sale_inventory&months=1" | jq '.series["35620"][-1]'  # active
curl -s "http://localhost:3001/api/market-explorer/scope/metro?metric=home_sales&months=1"        | jq '.series["35620"][-1]'  # pending
curl -s "http://localhost:3001/api/screener/metro?sortBy=score&pageSize=1&state=NY" | jq '.data[0].months_of_supply'          # published MoS
```

Confirm `active ÷ pending` is within roughly ±30% of the published `months_of_supply`. Record the result in the PR description. **If it diverges wildly**, switch Task 9's `deriveMonthsOfSupply` to the documented flat-line fallback (Global Constraints) instead — do NOT drop the metric.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/market-explorer/market-explorer.service.ts packages/backend/src/market-explorer/__tests__/market-explorer.service.spec.ts
git commit -m "feat(market-explorer): compose scope endpoint (resolve + batch fetch + align)"
```

---

### Task 7: Frontend data layer — `fetchScopeSeries` fetcher + exports

**Files:**

- Create: `packages/frontend/lib/data/fetchers/market-explorer.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts` (add `export * from "./market-explorer";`)
- Modify: `packages/frontend/lib/data/index.ts` (ensure it re-exports the fetchers barrel — verify `export * from "./fetchers"` is present; if the scope symbols aren't reachable from `@/lib/data`, add `export { fetchScopeSeries } from "./fetchers/market-explorer";` and the types)
- Test: `packages/frontend/lib/data/fetchers/__tests__/market-explorer.test.ts`

**Interfaces:**

- Consumes: `fetchAPIWithParams` (`./base`).
- Produces:
  - `type ScopeGeoLevel = 'state' | 'metro' | 'county' | 'zip'`
  - `interface ScopeRegion { id: string; name: string; state: string; population: number | null; nearby?: boolean }`
  - `interface ScopeSeriesResponse { success: true; geoLevel: string; metric: string; months: number; dates: string[]; regions: ScopeRegion[]; series: Record<string, (number | null)[]> }`
  - `interface ScopeQuery { parentLevel?: 'state' | 'metro' | 'county'; parentId?: string; metric: string; months: number }`
  - `async function fetchScopeSeries(geoLevel: ScopeGeoLevel, query: ScopeQuery): Promise<ScopeSeriesResponse>`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/lib/data/fetchers/__tests__/market-explorer.test.ts
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../base", () => ({ fetchAPIWithParams: vi.fn() }));
import { fetchAPIWithParams } from "../base";
import { fetchScopeSeries } from "../market-explorer";

describe("fetchScopeSeries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the scope URL and forwards query params", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      geoLevel: "county",
      metric: "home_value",
      months: 120,
      dates: [],
      regions: [],
      series: {},
    });
    await fetchScopeSeries("county", {
      parentLevel: "metro",
      parentId: "19100",
      metric: "home_value",
      months: 120,
    });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/county",
      {
        parentLevel: "metro",
        parentId: "19100",
        metric: "home_value",
        months: 120,
      },
    );
  });

  it("omits parent params at national scope", async () => {
    (fetchAPIWithParams as any).mockResolvedValue({
      success: true,
      regions: [],
      series: {},
      dates: [],
    });
    await fetchScopeSeries("metro", { metric: "propertyiq_score", months: 24 });
    expect(fetchAPIWithParams).toHaveBeenCalledWith(
      "/api/market-explorer/scope/metro",
      {
        parentLevel: undefined,
        parentId: undefined,
        metric: "propertyiq_score",
        months: 24,
      },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run lib/data/fetchers/__tests__/market-explorer.test.ts`
Expected: FAIL with "Failed to resolve import '../market-explorer'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/frontend/lib/data/fetchers/market-explorer.ts
/**
 * MARKET EXPLORER FETCHER
 * One metric across all child regions of a scope, aligned to a shared monthly axis.
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
  metric: string;
  months: number;
  dates: string[];
  regions: ScopeRegion[];
  series: Record<string, (number | null)[]>;
}

export interface ScopeQuery {
  parentLevel?: "state" | "metro" | "county";
  parentId?: string;
  metric: string;
  months: number;
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
      metric: query.metric,
      months: query.months,
    },
  );
}
```

Then add `export * from "./market-explorer";` to `lib/data/fetchers/index.ts`, and confirm `@/lib/data` re-exports it (add an explicit re-export in `lib/data/index.ts` if the barrel doesn't already surface it).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run lib/data/fetchers/__tests__/market-explorer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/fetchers/market-explorer.ts packages/frontend/lib/data/fetchers/index.ts packages/frontend/lib/data/index.ts packages/frontend/lib/data/fetchers/__tests__/market-explorer.test.ts
git commit -m "feat(market-explorer): @/lib/data scope-series fetcher"
```

---

### Task 8: Explorer config — types, metric registry, range presets, US tile grid

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/lib/explorer-config.ts`
- Test: `packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-config.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces (the frontend SSOT for the feature):
  - Types: `ExplorerGeoLevel`, `ExplorerMetricId` (`'score'|'hotness'|'home_value_yoy'|'rent_yield'|'dom'|'supply'`), `ViewMode` (`'bubbles'|'map'`), `RangePreset` (`6|12|24|60|120`), `PathCrumb`, `ExplorerState`.
  - `FETCHED_METRICS` (the 8 timeseries ids fetched once per scope), `FetchedMetric`.
  - `EXPLORER_METRICS: ExplorerMetricConfig[]` (6 switcher metrics; each is `{kind:'fetched', series}` or `{kind:'derived', deriver}`).
  - `RANGE_PRESETS`, `US_STATE_TILES` (`Record<abbr, [col,row]>`, 51 entries), `childGeoLevel(scopeLevel)`.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-config.test.ts
import { describe, it, expect } from "vitest";
import {
  EXPLORER_METRICS,
  FETCHED_METRICS,
  RANGE_PRESETS,
  US_STATE_TILES,
  childGeoLevel,
} from "../explorer-config";

describe("explorer-config", () => {
  it("has exactly the 6 switcher metrics with unique ids", () => {
    expect(EXPLORER_METRICS.map((m) => m.id)).toEqual([
      "score",
      "hotness",
      "home_value_yoy",
      "rent_yield",
      "dom",
      "supply",
    ]);
  });
  it("fetches 8 core timeseries metrics", () => {
    expect(FETCHED_METRICS).toHaveLength(8);
    expect(FETCHED_METRICS).toContain("propertyiq_score");
    expect(FETCHED_METRICS).toContain("home_sales");
  });
  it("derived metrics reference valid derivers", () => {
    const derived = EXPLORER_METRICS.filter((m) => m.source.kind === "derived");
    expect(derived.map((m) => m.id).sort()).toEqual([
      "home_value_yoy",
      "rent_yield",
      "supply",
    ]);
  });
  it("exposes the 5 range presets", () => {
    expect(RANGE_PRESETS.map((r) => r.months)).toEqual([6, 12, 24, 60, 120]);
  });
  it("positions all 50 states + DC on the tile grid", () => {
    expect(Object.keys(US_STATE_TILES)).toHaveLength(51);
    expect(US_STATE_TILES.TX).toEqual([3, 7]);
    expect(US_STATE_TILES.DC).toEqual([9, 5]);
  });
  it("maps scope level to its child level", () => {
    expect(childGeoLevel(null)).toBe("metro");
    expect(childGeoLevel("state")).toBe("metro");
    expect(childGeoLevel("metro")).toBe("county");
    expect(childGeoLevel("county")).toBe("zip");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-config.test.ts`
Expected: FAIL with "Failed to resolve import '../explorer-config'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/explorer-config.ts
export type ExplorerGeoLevel = "state" | "metro" | "county" | "zip";
export type ExplorerMetricId =
  | "score"
  | "hotness"
  | "home_value_yoy"
  | "rent_yield"
  | "dom"
  | "supply";
export type ViewMode = "bubbles" | "map";
export type RangePreset = 6 | 12 | 24 | 60 | 120;

export interface PathCrumb {
  level: ExplorerGeoLevel;
  id: string;
  name: string;
}

export interface ExplorerState {
  path: PathCrumb[]; // [] = national
  selectedId: string | null;
  pinnedIds: string[]; // up to 3
  metric: ExplorerMetricId;
  monthIndex: number; // index into the fetched `dates` axis
  view: ViewMode; // 'map' only valid at national scope
  range: RangePreset;
  playing: boolean;
  includeNearby: boolean;
}

/** The 8 timeseries metrics fetched once per scope; everything else is derived. */
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

export type MetricSource =
  | { kind: "fetched"; series: FetchedMetric }
  | { kind: "derived"; deriver: "yoy" | "yield" | "supply" };

export type ExplorerFormat =
  | "index"
  | "percent"
  | "percent_abs"
  | "days"
  | "months";

export interface ExplorerMetricConfig {
  id: ExplorerMetricId;
  label: string;
  axis: string;
  format: ExplorerFormat;
  betterHigh: boolean;
  source: MetricSource;
}

export const EXPLORER_METRICS: ExplorerMetricConfig[] = [
  {
    id: "score",
    label: "PropertyIQ Score",
    axis: "Momentum score (1–99)",
    format: "index",
    betterHigh: true,
    source: { kind: "fetched", series: "propertyiq_score" },
  },
  {
    id: "hotness",
    label: "Hotness",
    axis: "Hotness (0–100)",
    format: "index",
    betterHigh: true,
    source: { kind: "fetched", series: "hotness_score" },
  },
  {
    id: "home_value_yoy",
    label: "Home Value YoY",
    axis: "ZHVI year-over-year %",
    format: "percent",
    betterHigh: true,
    source: { kind: "derived", deriver: "yoy" },
  },
  {
    id: "rent_yield",
    label: "Rent Yield",
    axis: "Gross rent yield %",
    format: "percent_abs",
    betterHigh: true,
    source: { kind: "derived", deriver: "yield" },
  },
  {
    id: "dom",
    label: "Days on Market",
    axis: "Median days on market",
    format: "days",
    betterHigh: false,
    source: { kind: "fetched", series: "days_on_market" },
  },
  {
    id: "supply",
    label: "Months of Supply",
    axis: "Months of supply (derived: active ÷ pending)",
    format: "months",
    betterHigh: false,
    source: { kind: "derived", deriver: "supply" },
  },
];

export const RANGE_PRESETS: { months: RangePreset; label: string }[] = [
  { months: 6, label: "6M" },
  { months: 12, label: "1Y" },
  { months: 24, label: "2Y" },
  { months: 60, label: "5Y" },
  { months: 120, label: "10Y" },
];

/** US state tile grid [col,row] — ported verbatim from the prototype `this.tiles`. */
export const US_STATE_TILES: Record<string, [number, number]> = {
  AK: [0, 0],
  ME: [11, 0],
  VT: [10, 1],
  NH: [11, 1],
  WA: [1, 2],
  ID: [2, 2],
  MT: [3, 2],
  ND: [4, 2],
  MN: [5, 2],
  WI: [6, 2],
  MI: [8, 2],
  NY: [9, 2],
  MA: [10, 2],
  RI: [11, 2],
  OR: [1, 3],
  NV: [2, 3],
  WY: [3, 3],
  SD: [4, 3],
  IA: [5, 3],
  IL: [6, 3],
  IN: [7, 3],
  OH: [8, 3],
  PA: [9, 3],
  NJ: [10, 3],
  CT: [11, 3],
  CA: [1, 4],
  UT: [2, 4],
  CO: [3, 4],
  NE: [4, 4],
  MO: [5, 4],
  KY: [6, 4],
  WV: [7, 4],
  VA: [8, 4],
  MD: [9, 4],
  DE: [10, 4],
  AZ: [2, 5],
  NM: [3, 5],
  KS: [4, 5],
  AR: [5, 5],
  TN: [6, 5],
  NC: [7, 5],
  SC: [8, 5],
  DC: [9, 5],
  OK: [3, 6],
  LA: [4, 6],
  MS: [5, 6],
  AL: [6, 6],
  GA: [7, 6],
  HI: [0, 7],
  TX: [3, 7],
  FL: [8, 7],
};

/** The child level shown when scoped at `scopeLevel` (null = national). */
export function childGeoLevel(
  scopeLevel: ExplorerGeoLevel | null,
): ExplorerGeoLevel {
  if (scopeLevel === "county") return "zip";
  if (scopeLevel === "metro") return "county";
  return "metro"; // national or state → metros
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-config.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/lib/explorer-config.ts" "packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-config.test.ts"
git commit -m "feat(market-explorer): explorer config — types, metric registry, tile grid"
```

---

### Task 9: Explorer math — derivations, scope aggregation, movers, scales, formatting

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/lib/explorer-math.ts`
- Test: `packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-math.test.ts`

**Interfaces:**

- Consumes: `EXPLORER_METRICS`, `ExplorerMetricId`, `ExplorerFormat`, `ScopeRegion`, `formatMetricValue` (`@/lib/data`).
- Produces:
  - `deriveYoY(home: (number|null)[]): (number|null)[]`
  - `deriveYield(rent, home): (number|null)[]`
  - `deriveMonthsOfSupply(active, pending): (number|null)[]`
  - `type SeriesByMetric = Record<string, Record<string, (number|null)[]>>`
  - `metricSeriesFor(metricId, series, regionId): (number|null)[]`
  - `aggregateScopeKpis(regionIds, series, length): { price; rent; inventory; dom; score }` (each `(number|null)[]`)
  - `computeMovers(regions, scoreByRegion, monthIndex): { region: ScopeRegion; delta: number; score: number }[]`
  - `makeLogScale(min, number): (v) => number` in `[0,1]`; `niceBubbleBounds(prices): [number, number]`
  - `scoreChip(score): { bg: string; color: string }`
  - `formatExplorerValue(value, format): string`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-math.test.ts
import { describe, it, expect } from "vitest";
import {
  deriveYoY,
  deriveYield,
  deriveMonthsOfSupply,
  aggregateScopeKpis,
  computeMovers,
  makeLogScale,
  formatExplorerValue,
  metricSeriesFor,
} from "../explorer-math";

describe("explorer-math derivations", () => {
  it("deriveYoY compares against 12 months back", () => {
    const s = Array.from({ length: 13 }, (_, i) => 100 + i);
    const yoy = deriveYoY(s);
    expect(yoy.slice(0, 12).every((v) => v === null)).toBe(true);
    expect(yoy[12]).toBeCloseTo((112 / 100 - 1) * 100, 6); // +12%
  });
  it("deriveYield = rent*12/home*100", () => {
    expect(deriveYield([2000], [480000])[0]).toBeCloseTo(5, 6);
  });
  it("deriveMonthsOfSupply = active/pending, null when pending is 0/null", () => {
    expect(deriveMonthsOfSupply([300, 300], [100, 0])).toEqual([3, null]);
  });
});

describe("aggregateScopeKpis", () => {
  it("means levels and sums inventory across regions per month", () => {
    const series = {
      home_value: { A: [100, 200], B: [300, 400] },
      rent_index: { A: [1, 2], B: [3, 4] },
      for_sale_inventory: { A: [10, 20], B: [30, 40] },
      days_on_market: { A: [5, 6], B: [7, 8] },
      propertyiq_score: { A: [50, 60], B: [70, 80] },
    };
    const agg = aggregateScopeKpis(["A", "B"], series, 2);
    expect(agg.price).toEqual([200, 300]);
    expect(agg.inventory).toEqual([40, 60]);
    expect(agg.score).toEqual([60, 70]);
  });
});

describe("computeMovers", () => {
  it("returns top and bottom by 3-month score delta", () => {
    const regions = [
      { id: "A", name: "A", state: "X", population: null },
      { id: "B", name: "B", state: "X", population: null },
    ];
    const scoreByRegion = { A: [50, 50, 50, 60], B: [50, 50, 50, 40] };
    const movers = computeMovers(regions as any, scoreByRegion, 3);
    expect(movers[0].region.id).toBe("A");
    expect(movers[0].delta).toBe(10);
    expect(movers[movers.length - 1].delta).toBe(-10);
  });
});

describe("scales + formatting", () => {
  it("makeLogScale maps min→0 and max→1", () => {
    const x = makeLogScale(100, 1000);
    expect(x(100)).toBeCloseTo(0, 6);
    expect(x(1000)).toBeCloseTo(1, 6);
  });
  it("formatExplorerValue renders each metric format and handles null", () => {
    expect(formatExplorerValue(null, "index")).toBe("—");
    expect(formatExplorerValue(72.4, "index")).toBe("72");
    expect(formatExplorerValue(5.2, "percent_abs")).toBe("5.2%");
    expect(formatExplorerValue(45, "days")).toBe("45 d");
    expect(formatExplorerValue(3.14, "months")).toBe("3.1 mo");
  });
  it("metricSeriesFor resolves a derived metric", () => {
    const series = {
      home_value: { A: Array.from({ length: 13 }, (_, i) => 100 + i) },
    };
    const yoy = metricSeriesFor("home_value_yoy", series as any, "A");
    expect(yoy[12]).toBeCloseTo(12, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-math.test.ts`
Expected: FAIL with "Failed to resolve import '../explorer-math'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/explorer-math.ts
import { formatMetricValue } from "@/lib/data";
import type { ScopeRegion } from "@/lib/data/fetchers/market-explorer";
import {
  EXPLORER_METRICS,
  type ExplorerMetricId,
  type ExplorerFormat,
} from "./explorer-config";

export type Series = (number | null)[];
export type SeriesByMetric = Record<string, Record<string, Series>>;

export function deriveYoY(home: Series): Series {
  return home.map((_, t) => {
    const cur = home[t],
      prev = home[t - 12];
    return cur != null && prev != null && prev !== 0
      ? (cur / prev - 1) * 100
      : null;
  });
}

export function deriveYield(rent: Series, home: Series): Series {
  return rent.map((_, t) => {
    const r = rent[t],
      h = home[t];
    return r != null && h != null && h !== 0 ? ((r * 12) / h) * 100 : null;
  });
}

/**
 * Months of supply — DERIVED: active listings ÷ monthly pending sales.
 * (No native MoS time-series exists; see Global Constraints. Fallback: hold the
 * current screener value flat if Task 6's reconciliation check fails.)
 */
export function deriveMonthsOfSupply(active: Series, pending: Series): Series {
  return active.map((_, t) => {
    const a = active[t],
      p = pending[t];
    return a != null && p != null && p !== 0 ? a / p : null;
  });
}

const EMPTY: Series = [];

export function metricSeriesFor(
  metricId: ExplorerMetricId,
  series: SeriesByMetric,
  regionId: string,
): Series {
  const cfg = EXPLORER_METRICS.find((m) => m.id === metricId)!;
  if (cfg.source.kind === "fetched")
    return series[cfg.source.series]?.[regionId] ?? EMPTY;
  const home = series.home_value?.[regionId] ?? EMPTY;
  if (cfg.source.deriver === "yoy") return deriveYoY(home);
  if (cfg.source.deriver === "yield")
    return deriveYield(series.rent_index?.[regionId] ?? EMPTY, home);
  return deriveMonthsOfSupply(
    series.for_sale_inventory?.[regionId] ?? EMPTY,
    series.home_sales?.[regionId] ?? EMPTY,
  );
}

function reduceMonth(
  ids: string[],
  byRegion: Record<string, Series> | undefined,
  t: number,
  sum: boolean,
): number | null {
  if (!byRegion) return null;
  let acc = 0,
    n = 0;
  for (const id of ids) {
    const v = byRegion[id]?.[t];
    if (v != null) {
      acc += v;
      n++;
    }
  }
  if (!n) return null;
  return sum ? acc : acc / n;
}

export function aggregateScopeKpis(
  ids: string[],
  series: SeriesByMetric,
  length: number,
) {
  const build = (metric: string, sum: boolean): Series =>
    Array.from({ length }, (_, t) => reduceMonth(ids, series[metric], t, sum));
  return {
    price: build("home_value", false),
    rent: build("rent_index", false),
    inventory: build("for_sale_inventory", true),
    dom: build("days_on_market", false),
    score: build("propertyiq_score", false),
  };
}

export function computeMovers(
  regions: ScopeRegion[],
  scoreByRegion: Record<string, Series>,
  monthIndex: number,
): { region: ScopeRegion; delta: number; score: number }[] {
  const prior = Math.max(0, monthIndex - 3);
  const deltas = regions
    .map((region) => {
      const s = scoreByRegion[region.id];
      const cur = s?.[monthIndex],
        was = s?.[prior];
      if (cur == null || was == null) return null;
      return { region, delta: cur - was, score: Math.round(cur) };
    })
    .filter(
      (x): x is { region: ScopeRegion; delta: number; score: number } =>
        x !== null,
    )
    .sort((a, b) => b.delta - a.delta);
  const top = [...deltas.slice(0, 3), ...deltas.slice(-3)];
  return top.filter(
    (x, i, arr) => arr.findIndex((y) => y.region.id === x.region.id) === i,
  );
}

export function makeLogScale(min: number, max: number): (v: number) => number {
  const lo = Math.log(Math.max(1, min)),
    hi = Math.log(Math.max(min + 1, max));
  return (v: number) =>
    (Math.log(Math.min(max, Math.max(min, v))) - lo) / (hi - lo);
}

export function niceBubbleBounds(prices: number[]): [number, number] {
  const valid = prices.filter((p) => p > 0);
  if (!valid.length) return [1, 10];
  return [Math.max(1, Math.min(...valid) * 0.8), Math.max(...valid) * 1.15];
}

export function scoreChip(score: number): { bg: string; color: string } {
  if (score >= 80)
    return {
      bg: "color-mix(in srgb, var(--md-tertiary) 14%, transparent)",
      color: "var(--md-tertiary)",
    };
  if (score >= 60)
    return {
      bg: "color-mix(in srgb, var(--md-primary) 13%, transparent)",
      color: "var(--md-primary)",
    };
  if (score >= 40)
    return {
      bg: "color-mix(in srgb, var(--md-warning) 15%, transparent)",
      color: "var(--md-warning)",
    };
  return {
    bg: "color-mix(in srgb, var(--md-error) 13%, transparent)",
    color: "var(--md-error)",
  };
}

/** Delegates to the registry formatter; adds the day/month unit suffixes the prototype uses. */
export function formatExplorerValue(
  value: number | null | undefined,
  format: ExplorerFormat,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  switch (format) {
    case "index":
      return formatMetricValue(value, "index");
    case "percent":
      return formatMetricValue(value, "percent");
    case "percent_abs":
      return formatMetricValue(value, "percent_abs");
    case "days":
      return `${formatMetricValue(value, "number")} d`;
    case "months":
      return `${value.toFixed(1)} mo`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-math.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/lib/explorer-math.ts" "packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-math.test.ts"
git commit -m "feat(market-explorer): explorer math — derivations, aggregation, movers, scales"
```

---

### Task 10: Explorer reducer — the pure state machine

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/lib/explorer-reducer.ts`
- Test: `packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-reducer.test.ts`

**Interfaces:**

- Consumes: `ExplorerState`, `PathCrumb`, `ExplorerMetricId`, `ViewMode`, `RangePreset` (config).
- Produces:
  - `initialExplorerState: ExplorerState`
  - `type ExplorerAction` (discriminated union — see impl)
  - `explorerReducer(state, action): ExplorerState`
  - `resolveScope(state): { geoLevel: ExplorerGeoLevel; parentLevel?: 'state'|'metro'|'county'; parentId?: string }`

**Scope model (no `rootLevel` flag needed):** `view==='map'` ⟺ national state-level scope (the tile map IS the state view). Otherwise `path.length ? childGeoLevel(last.level) : 'metro'`. Clicking a state tile drills into that state (path=`[{state}]`, view→bubbles → metros).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-reducer.test.ts
import { describe, it, expect } from "vitest";
import {
  explorerReducer,
  initialExplorerState,
  resolveScope,
} from "../explorer-reducer";

const S = initialExplorerState;

describe("explorerReducer", () => {
  it("SET_VIEW map clears the path (map is national state view)", () => {
    const s = explorerReducer(
      { ...S, path: [{ level: "state", id: "48", name: "Texas" }] },
      { type: "SET_VIEW", view: "map" },
    );
    expect(s.view).toBe("map");
    expect(s.path).toEqual([]);
  });
  it("DRILL pushes a crumb, resets selection, forces bubbles", () => {
    const s = explorerReducer(
      { ...S, view: "map" },
      { type: "DRILL", crumb: { level: "state", id: "48", name: "Texas" } },
    );
    expect(s.path).toEqual([{ level: "state", id: "48", name: "Texas" }]);
    expect(s.selectedId).toBeNull();
    expect(s.view).toBe("bubbles");
  });
  it("NAVIGATE_CRUMB trims the path to the chosen index", () => {
    const path = [
      { level: "state", id: "48", name: "Texas" },
      { level: "metro", id: "19100", name: "Dallas" },
    ] as const;
    const s = explorerReducer(
      { ...S, path: [...path] },
      { type: "NAVIGATE_CRUMB", index: 0 },
    );
    expect(s.path).toHaveLength(1);
    expect(s.path[0].id).toBe("48");
  });
  it("PIN caps at 3 and dedupes; UNPIN removes", () => {
    let s = { ...S, pinnedIds: ["a", "b", "c"] };
    s = explorerReducer(s, { type: "PIN", id: "d" });
    expect(s.pinnedIds).toEqual(["a", "b", "c"]); // capped
    s = explorerReducer({ ...S, pinnedIds: ["a"] }, { type: "PIN", id: "a" });
    expect(s.pinnedIds).toEqual(["a"]); // dedupe
    s = explorerReducer(
      { ...S, pinnedIds: ["a", "b"] },
      { type: "UNPIN", id: "a" },
    );
    expect(s.pinnedIds).toEqual(["b"]);
  });
  it("TOGGLE_PLAY flips playing", () => {
    expect(explorerReducer(S, { type: "TOGGLE_PLAY" }).playing).toBe(true);
  });
});

describe("resolveScope", () => {
  it("national bubbles → metro; map → state; drilled metro → county", () => {
    expect(resolveScope(S).geoLevel).toBe("metro");
    expect(resolveScope({ ...S, view: "map" }).geoLevel).toBe("state");
    const drilled = {
      ...S,
      path: [{ level: "metro", id: "19100", name: "Dallas" }],
    };
    expect(resolveScope(drilled)).toEqual({
      geoLevel: "county",
      parentLevel: "metro",
      parentId: "19100",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-reducer.test.ts`
Expected: FAIL with "Failed to resolve import '../explorer-reducer'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/explorer-reducer.ts
import {
  childGeoLevel,
  type ExplorerGeoLevel,
  type ExplorerMetricId,
  type ExplorerState,
  type PathCrumb,
  type RangePreset,
  type ViewMode,
} from "./explorer-config";

export const initialExplorerState: ExplorerState = {
  path: [],
  selectedId: null,
  pinnedIds: [],
  metric: "score",
  monthIndex: 0,
  view: "bubbles",
  range: 24,
  playing: false,
  includeNearby: false,
};

export type ExplorerAction =
  | { type: "SET_METRIC"; metric: ExplorerMetricId }
  | { type: "SET_MONTH"; monthIndex: number }
  | { type: "SET_RANGE"; range: RangePreset }
  | { type: "SET_VIEW"; view: ViewMode }
  | { type: "SELECT"; id: string }
  | { type: "PIN"; id: string }
  | { type: "UNPIN"; id: string }
  | { type: "CLEAR_PINS" }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "TOGGLE_NEARBY" }
  | { type: "DRILL"; crumb: PathCrumb }
  | { type: "NAVIGATE_CRUMB"; index: number }
  | { type: "RESET_NATIONAL" };

export function explorerReducer(
  state: ExplorerState,
  action: ExplorerAction,
): ExplorerState {
  switch (action.type) {
    case "SET_METRIC":
      return { ...state, metric: action.metric };
    // SET_MONTH does NOT pause — autoplay advances via SET_MONTH each tick.
    // A manual drag additionally dispatches SET_PLAYING:false (see Task 26 wiring).
    case "SET_MONTH":
      return { ...state, monthIndex: action.monthIndex };
    case "SET_RANGE":
      return { ...state, range: action.range };
    case "SET_VIEW":
      return action.view === "map"
        ? { ...state, view: "map", path: [], selectedId: null, playing: false }
        : { ...state, view: "bubbles" };
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "PIN":
      if (state.pinnedIds.includes(action.id) || state.pinnedIds.length >= 3)
        return state;
      return { ...state, pinnedIds: [...state.pinnedIds, action.id] };
    case "UNPIN":
      return {
        ...state,
        pinnedIds: state.pinnedIds.filter((p) => p !== action.id),
      };
    case "CLEAR_PINS":
      return { ...state, pinnedIds: [] };
    case "TOGGLE_PLAY":
      return { ...state, playing: !state.playing };
    case "SET_PLAYING":
      return { ...state, playing: action.playing };
    case "TOGGLE_NEARBY":
      return { ...state, includeNearby: !state.includeNearby };
    case "DRILL":
      return {
        ...state,
        path: [...state.path, action.crumb],
        selectedId: null,
        view: "bubbles",
        playing: false,
      };
    case "NAVIGATE_CRUMB":
      return {
        ...state,
        path: state.path.slice(0, action.index + 1),
        selectedId: null,
        view: "bubbles",
      };
    case "RESET_NATIONAL":
      return {
        ...state,
        path: [],
        selectedId: null,
        view: "bubbles",
        includeNearby: false,
      };
    default:
      return state;
  }
}

/** Effective backend scope for the current UI state. */
export function resolveScope(state: ExplorerState): {
  geoLevel: ExplorerGeoLevel;
  parentLevel?: "state" | "metro" | "county";
  parentId?: string;
} {
  if (state.view === "map" && state.path.length === 0)
    return { geoLevel: "state" };
  const last = state.path[state.path.length - 1];
  if (!last) return { geoLevel: "metro" };
  return {
    geoLevel: childGeoLevel(last.level),
    parentLevel: last.level as "state" | "metro" | "county",
    parentId: last.id,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-reducer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/lib/explorer-reducer.ts" "packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-reducer.test.ts"
git commit -m "feat(market-explorer): explorer reducer + scope resolution"
```

---

### Task 11: `useExplorerScopeData` hook + `mergeScopeResponses`

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/lib/useExplorerScopeData.ts`
- Test: `packages/frontend/app/(app)/market/explorer/lib/__tests__/mergeScopeResponses.test.ts`

**Interfaces:**

- Consumes: `useQueries` (`@tanstack/react-query`), `fetchScopeSeries`, `ScopeSeriesResponse`, `ScopeRegion` (`@/lib/data`), `FETCHED_METRICS` (config), `SeriesByMetric` (math).
- Produces:
  - `const MAX_MONTHS = 120`
  - `function mergeScopeResponses(entries: { metric: string; resp?: ScopeSeriesResponse }[]): { dates: string[]; regions: ScopeRegion[]; series: SeriesByMetric }` — realigns all metrics onto one canonical (union) monthly axis so `monthIndex` is consistent across metrics.
  - `function useExplorerScopeData(geoLevel, parentLevel?, parentId?): { dates; regions; series; isLoading; error }` — fetches all 8 `FETCHED_METRICS` for the scope in parallel (2-hour cache), always `months=120` (range presets slice client-side → no refetch on range/metric/month change).

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/__tests__/mergeScopeResponses.test.ts
import { describe, it, expect } from "vitest";
import { mergeScopeResponses } from "../useExplorerScopeData";

const mk = (
  dates: string[],
  series: Record<string, (number | null)[]>,
  regions: any[] = [],
) =>
  ({
    success: true,
    geoLevel: "metro",
    metric: "x",
    months: dates.length,
    dates,
    regions,
    series,
  }) as any;

describe("mergeScopeResponses", () => {
  it("realigns metrics with different date ranges onto one union axis", () => {
    const entries = [
      {
        metric: "home_value",
        resp: mk(["2026-04-01", "2026-05-01"], { A: [100, 110] }, [
          { id: "A", name: "A", state: "X", population: 1 },
        ]),
      },
      { metric: "hotness_score", resp: mk(["2026-05-01"], { A: [70] }) },
    ];
    const { dates, series, regions } = mergeScopeResponses(entries);
    expect(dates).toEqual(["2026-04-01", "2026-05-01"]);
    expect(series.home_value.A).toEqual([100, 110]);
    expect(series.hotness_score.A).toEqual([null, 70]); // shorter series padded at the front
    expect(regions[0].id).toBe("A");
  });

  it("returns empty structures when nothing has loaded", () => {
    expect(
      mergeScopeResponses([{ metric: "home_value", resp: undefined }]),
    ).toEqual({
      dates: [],
      regions: [],
      series: {},
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/mergeScopeResponses.test.ts`
Expected: FAIL with "Failed to resolve import '../useExplorerScopeData'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/useExplorerScopeData.ts
"use client";

import { useQueries } from "@tanstack/react-query";
import {
  fetchScopeSeries,
  type ScopeSeriesResponse,
  type ScopeRegion,
  type ScopeGeoLevel,
} from "@/lib/data/fetchers/market-explorer";
import { FETCHED_METRICS } from "./explorer-config";
import type { SeriesByMetric } from "./explorer-math";

export const MAX_MONTHS = 120;

/** Merge per-metric responses onto one canonical (union) monthly axis. */
export function mergeScopeResponses(
  entries: { metric: string; resp?: ScopeSeriesResponse }[],
): { dates: string[]; regions: ScopeRegion[]; series: SeriesByMetric } {
  const dateSet = new Set<string>();
  let regions: ScopeRegion[] = [];
  for (const { resp } of entries) {
    if (!resp) continue;
    resp.dates.forEach((d) => dateSet.add(d));
    if (resp.regions.length && !regions.length) regions = resp.regions;
  }
  const dates = [...dateSet].sort();
  const pos = new Map(dates.map((d, i) => [d, i]));

  const series: SeriesByMetric = {};
  for (const { metric, resp } of entries) {
    if (!resp) continue;
    const realigned: Record<string, (number | null)[]> = {};
    for (const [regionId, arr] of Object.entries(resp.series)) {
      const out: (number | null)[] = new Array(dates.length).fill(null);
      resp.dates.forEach((d, j) => {
        const i = pos.get(d);
        if (i !== undefined) out[i] = arr[j];
      });
      realigned[regionId] = out;
    }
    series[metric] = realigned;
  }
  return { dates, regions, series };
}

export function useExplorerScopeData(
  geoLevel: ScopeGeoLevel,
  parentLevel?: "state" | "metro" | "county",
  parentId?: string,
) {
  const results = useQueries({
    queries: FETCHED_METRICS.map((metric) => ({
      queryKey: [
        "me-scope",
        geoLevel,
        parentLevel ?? null,
        parentId ?? null,
        metric,
      ],
      queryFn: () =>
        fetchScopeSeries(geoLevel, {
          parentLevel,
          parentId,
          metric,
          months: MAX_MONTHS,
        }),
      staleTime: 2 * 60 * 60 * 1000, // 2h (CLAUDE.md §5)
      gcTime: 2 * 60 * 60 * 1000,
    })),
  });

  const merged = mergeScopeResponses(
    FETCHED_METRICS.map((metric, i) => ({ metric, resp: results[i].data })),
  );

  return {
    ...merged,
    isLoading: results.some((r) => r.isLoading),
    error: (results.find((r) => r.error)?.error as Error | undefined) ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/mergeScopeResponses.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/lib/useExplorerScopeData.ts" "packages/frontend/app/(app)/market/explorer/lib/__tests__/mergeScopeResponses.test.ts"
git commit -m "feat(market-explorer): scope data hook + multi-metric axis merge"
```

---

### Task 12: `Sparkline` component

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/Sparkline.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/Sparkline.test.tsx`

**Interfaces:**

- Produces: `Sparkline({ series, width?, height?, color?, markerIndex? })` — a compact SVG line + optional marker dot. Null-safe (skips null points).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/Sparkline.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "../Sparkline";

describe("Sparkline", () => {
  it("renders an svg path for a numeric series", () => {
    const { container } = render(
      <Sparkline series={[1, 3, 2, 5]} markerIndex={3} />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("path")?.getAttribute("d")).toContain("M");
    expect(container.querySelector("circle")).toBeTruthy();
  });
  it("renders an empty svg when there is not enough data", () => {
    const { container } = render(<Sparkline series={[null, null]} />);
    expect(container.querySelector("path")).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/Sparkline.test.tsx`
Expected: FAIL with "Failed to resolve import '../Sparkline'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/Sparkline.tsx
"use client";
import React from "react";

export interface SparklineProps {
  series: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  markerIndex?: number | null;
}

export function Sparkline({
  series,
  width = 92,
  height = 26,
  color = "var(--md-primary)",
  markerIndex = null,
}: SparklineProps) {
  const vals = series.filter((v): v is number => v != null);
  if (vals.length < 2) return <svg width={width} height={height} />;
  const mn = Math.min(...vals),
    mx = Math.max(...vals),
    sp = mx - mn || 1;
  const n = series.length - 1;
  const xy = (v: number, i: number): [number, number] => [
    (i / n) * width,
    height - 3 - ((v - mn) / sp) * (height - 6),
  ];
  const d = series
    .map((v, i) => (v == null ? null : xy(v, i)))
    .filter((p): p is [number, number] => p != null)
    .map((p, idx) => `${idx ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join("");
  const m =
    markerIndex != null && series[markerIndex] != null
      ? xy(series[markerIndex] as number, markerIndex)
      : null;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {m && <circle cx={m[0]} cy={m[1]} r={2.6} fill={color} />}
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/Sparkline.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/Sparkline.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/Sparkline.test.tsx"
git commit -m "feat(market-explorer): Sparkline component"
```

---

### Task 13: `BubbleChart` component (log-scale price × metric, radius=inventory, color=score)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/BubbleChart.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/BubbleChart.test.tsx`

**Interfaces:**

- Consumes: `makeLogScale`, `niceBubbleBounds`, `formatExplorerValue` (math), `getScoreColor` (`@/app/components/scoring/ScoreDisplay`), `formatMetricValue` (`@/lib/data`), `ExplorerFormat` (config).
- Produces: `BubbleChart(props)` where props are month-sliced scalar maps (the orchestrator slices series at `monthIndex`):

  ```ts
  interface BubbleEntity {
    id: string;
    name: string;
    state: string;
  }
  interface BubbleChartProps {
    entities: BubbleEntity[];
    xByRegion: Record<string, number | null>; // price (log x)
    yByRegion: Record<string, number | null>; // selected metric (linear y)
    scoreByRegion: Record<string, number | null>; // color
    radiusByRegion: Record<string, number | null>; // current inventory
    axisLabel: string;
    format: ExplorerFormat;
    selectedId: string | null;
    pinnedIds: string[];
    onSelect: (id: string) => void;
    onDrill: (id: string) => void;
  }
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/BubbleChart.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { BubbleChart } from "../BubbleChart";

const base = {
  entities: [
    { id: "A", name: "Metro A", state: "TX" },
    { id: "B", name: "Metro B", state: "CA" },
  ],
  xByRegion: { A: 300000, B: 900000 },
  yByRegion: { A: 55, B: 42 },
  scoreByRegion: { A: 60, B: 40 },
  radiusByRegion: { A: 1000, B: 3000 },
  axisLabel: "Momentum score (1–99)",
  format: "index" as const,
  selectedId: "A",
  pinnedIds: [] as string[],
};

describe("BubbleChart", () => {
  it("renders one bubble per entity", () => {
    const { container } = render(
      <BubbleChart {...base} onSelect={() => {}} onDrill={() => {}} />,
    );
    expect(container.querySelectorAll("circle").length).toBe(2);
  });
  it("selects on click and drills on double-click", () => {
    const onSelect = vi.fn(),
      onDrill = vi.fn();
    const { container } = render(
      <BubbleChart {...base} onSelect={onSelect} onDrill={onDrill} />,
    );
    const circles = container.querySelectorAll("circle");
    fireEvent.click(circles[0]);
    fireEvent.doubleClick(circles[1]);
    expect(onSelect).toHaveBeenCalled();
    expect(onDrill).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/BubbleChart.test.tsx`
Expected: FAIL with "Failed to resolve import '../BubbleChart'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/BubbleChart.tsx
"use client";
import React from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import { formatMetricValue } from "@/lib/data";
import {
  makeLogScale,
  niceBubbleBounds,
  formatExplorerValue,
} from "../lib/explorer-math";
import type { ExplorerFormat } from "../lib/explorer-config";

interface BubbleEntity {
  id: string;
  name: string;
  state: string;
}
export interface BubbleChartProps {
  entities: BubbleEntity[];
  xByRegion: Record<string, number | null>;
  yByRegion: Record<string, number | null>;
  scoreByRegion: Record<string, number | null>;
  radiusByRegion: Record<string, number | null>;
  axisLabel: string;
  format: ExplorerFormat;
  selectedId: string | null;
  pinnedIds: string[];
  onSelect: (id: string) => void;
  onDrill: (id: string) => void;
}

const W = 1000,
  H = 540,
  mL = 58,
  mR = 24,
  mT = 26,
  mB = 46;

export function BubbleChart(props: BubbleChartProps) {
  const {
    entities,
    xByRegion,
    yByRegion,
    scoreByRegion,
    radiusByRegion,
    axisLabel,
    format,
    selectedId,
    pinnedIds,
    onSelect,
    onDrill,
  } = props;

  const prices = entities
    .map((e) => xByRegion[e.id])
    .filter((v): v is number => v != null);
  const yVals = entities
    .map((e) => yByRegion[e.id])
    .filter((v): v is number => v != null);
  if (!prices.length || !yVals.length) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "var(--md-on-surface-variant)",
        }}
      >
        No data for this scope.
      </div>
    );
  }
  const [pMin, pMax] = niceBubbleBounds(prices);
  const logX = makeLogScale(pMin, pMax);
  const x = (p: number) => mL + logX(p) * (W - mL - mR);

  let d0 = Math.min(...yVals),
    d1 = Math.max(...yVals);
  const pad = (d1 - d0) * 0.1 || 1;
  d0 -= pad;
  d1 += pad;
  const y = (v: number) =>
    mT + (1 - (Math.max(d0, Math.min(d1, v)) - d0) / (d1 - d0)) * (H - mT - mB);

  const maxInv = Math.max(1, ...entities.map((e) => radiusByRegion[e.id] ?? 0));
  const grid: React.ReactNode[] = [];
  for (let i = 0; i <= 4; i++) {
    const v = d0 + ((d1 - d0) * i) / 4,
      yy = y(v);
    grid.push(
      <line
        key={`g${i}`}
        x1={mL}
        x2={W - mR}
        y1={yy}
        y2={yy}
        stroke="var(--md-outline-variant)"
        strokeOpacity={0.45}
        strokeDasharray="3 5"
      />,
    );
    grid.push(
      <text
        key={`gl${i}`}
        x={mL - 10}
        y={yy + 4}
        textAnchor="end"
        fontSize={11}
        fontFamily="var(--font-roboto-mono)"
        fill="var(--md-on-surface-variant)"
      >
        {formatExplorerValue(v, format)}
      </text>,
    );
  }
  if (d0 < 0 && d1 > 0)
    grid.push(
      <line
        key="zero"
        x1={mL}
        x2={W - mR}
        y1={y(0)}
        y2={y(0)}
        stroke="var(--md-outline)"
        strokeOpacity={0.6}
      />,
    );
  for (let i = 0; i <= 4; i++) {
    const p = Math.exp(
      Math.log(pMin) + (Math.log(pMax) - Math.log(pMin)) * (i / 4),
    );
    grid.push(
      <text
        key={`x${i}`}
        x={x(p)}
        y={H - 16}
        textAnchor="middle"
        fontSize={11}
        fontFamily="var(--font-roboto-mono)"
        fill="var(--md-on-surface-variant)"
      >
        {formatMetricValue(p, "currency")}
      </text>,
    );
  }

  // Draw selected last so it sits on top.
  const ordered = [...entities].sort(
    (a, b) => (a.id === selectedId ? 1 : 0) - (b.id === selectedId ? 1 : 0),
  );
  const bubbles = ordered.map((e) => {
    const px = xByRegion[e.id],
      v = yByRegion[e.id];
    if (px == null || v == null) return null;
    const s = scoreByRegion[e.id] ?? 50;
    const color = getScoreColor(s, 100);
    const r = Math.min(
      26,
      7 + Math.sqrt((radiusByRegion[e.id] ?? 0) / maxInv) * 19,
    );
    const sel = e.id === selectedId,
      pinned = pinnedIds.includes(e.id);
    return (
      <g key={e.id}>
        <circle
          cx={x(px)}
          cy={y(v)}
          r={r}
          fill={color}
          fillOpacity={sel ? 0.92 : 0.68}
          stroke={
            sel
              ? "var(--md-on-surface)"
              : pinned
                ? "var(--md-on-surface-variant)"
                : color
          }
          strokeWidth={sel ? 2.5 : pinned ? 1.8 : 1}
          strokeDasharray={pinned && !sel ? "4 3" : "none"}
          style={{
            cursor: "pointer",
            transition:
              "cx .7s cubic-bezier(.4,0,.2,1), cy .7s cubic-bezier(.4,0,.2,1)",
          }}
          onClick={() => onSelect(e.id)}
          onDoubleClick={() => onDrill(e.id)}
        >
          <title>{`${e.name} — ${formatExplorerValue(v, format)} · double-click to drill in`}</title>
        </circle>
        {sel && (
          <text
            x={x(px)}
            y={y(v) - r - 8}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill="var(--md-on-surface)"
            pointerEvents="none"
          >
            {e.name}
          </text>
        )}
      </g>
    );
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {grid}
      <text
        x={(mL + W - mR) / 2}
        y={H - 1}
        textAnchor="middle"
        fontSize={10.5}
        fill="var(--md-on-surface-variant)"
      >
        Median home value (log scale) →
      </text>
      <text
        x={14}
        y={(mT + H - mB) / 2}
        textAnchor="middle"
        fontSize={10.5}
        fill="var(--md-on-surface-variant)"
        transform={`rotate(-90 14 ${(mT + H - mB) / 2})`}
      >
        {axisLabel}
      </text>
      {bubbles}
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/BubbleChart.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/BubbleChart.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/BubbleChart.test.tsx"
git commit -m "feat(market-explorer): log-scale bubble chart"
```

---

### Task 14: `StateTileMap` component (US tile grid, color = state avg score)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/StateTileMap.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/StateTileMap.test.tsx`

**Interfaces:**

- Consumes: `US_STATE_TILES` (config), `getScoreColor` (`ScoreDisplay`), `formatExplorerValue` (math), `ExplorerFormat`.
- Produces: `StateTileMap({ entities, scoreByRegion, valueByRegion, format, onDrill })` where `entities: {id,name,state}[]` (state = 2-letter abbr, id = FIPS), `onDrill: (fips, name, abbr) => void`. Tiles with no scored data render gray and non-clickable.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/StateTileMap.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { StateTileMap } from "../StateTileMap";

describe("StateTileMap", () => {
  const props = {
    entities: [{ id: "48", name: "Texas", state: "TX" }],
    scoreByRegion: { "48": 62 } as Record<string, number | null>,
    valueByRegion: { "48": 5.1 } as Record<string, number | null>,
    format: "percent" as const,
  };
  it("renders a tile per grid position and drills the clicked state", () => {
    const onDrill = vi.fn();
    render(<StateTileMap {...props} onDrill={onDrill} />);
    fireEvent.click(screen.getByText("TX"));
    expect(onDrill).toHaveBeenCalledWith("48", "Texas", "TX");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/StateTileMap.test.tsx`
Expected: FAIL with "Failed to resolve import '../StateTileMap'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/StateTileMap.tsx
"use client";
import React from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import { formatExplorerValue } from "../lib/explorer-math";
import { US_STATE_TILES, type ExplorerFormat } from "../lib/explorer-config";

interface TileEntity {
  id: string;
  name: string;
  state: string;
}
export interface StateTileMapProps {
  entities: TileEntity[];
  scoreByRegion: Record<string, number | null>;
  valueByRegion: Record<string, number | null>;
  format: ExplorerFormat;
  onDrill: (fips: string, name: string, abbr: string) => void;
}

export function StateTileMap({
  entities,
  scoreByRegion,
  valueByRegion,
  format,
  onDrill,
}: StateTileMapProps) {
  const byAbbr = new Map(entities.map((e) => [e.state, e]));
  return (
    <div style={{ padding: "8px 8px 4px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12,1fr)",
          gap: 6,
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        {Object.entries(US_STATE_TILES).map(([abbr, [c, r]]) => {
          const region = byAbbr.get(abbr);
          const score = region ? scoreByRegion[region.id] : null;
          const val = region ? valueByRegion[region.id] : null;
          const hasData = region != null && score != null;
          const color = hasData
            ? getScoreColor(score as number, 100)
            : "var(--md-on-surface-variant)";
          return (
            <div
              key={abbr}
              onClick={
                hasData
                  ? () => onDrill(region!.id, region!.name, abbr)
                  : undefined
              }
              style={{
                gridColumn: c + 1,
                gridRow: r + 1,
                aspectRatio: "1",
                borderRadius: 8,
                background: hasData
                  ? `color-mix(in srgb, ${color} 26%, var(--md-surface-container-low))`
                  : "var(--md-surface-container-high)",
                color: hasData
                  ? "var(--md-on-surface)"
                  : "var(--md-on-surface-variant)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                cursor: hasData ? "pointer" : "default",
                transition: "background .5s",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--font-roboto-mono)",
                  opacity: hasData ? 1 : 0.45,
                }}
              >
                {abbr}
              </div>
              {hasData && (
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-roboto-mono)",
                    color,
                    fontWeight: 700,
                  }}
                >
                  {formatExplorerValue(val, format)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "var(--md-on-surface-variant)",
          padding: "10px 0 4px",
        }}
      >
        State average of tracked metros · click a state to drill into its metros
        · gray = no tracked metro
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/StateTileMap.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/StateTileMap.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/StateTileMap.test.tsx"
git commit -m "feat(market-explorer): US state tile map"
```

---

### Task 15: `KpiStrip` component (5 scope aggregates with sparklines)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/KpiStrip.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/KpiStrip.test.tsx`

**Interfaces:**

- Consumes: `Sparkline` (Task 12), `formatMetricValue` (`@/lib/data`).
- Produces: `KpiStrip({ agg, monthIndex, windowStart })` where `agg: { price; rent; inventory; dom; score }` (each `(number|null)[]`, from `aggregateScopeKpis`). Renders 5 cards: Median value, Median rent, Active listings, Avg DOM, Avg PIQ score — value at `monthIndex`, delta vs prior month, sparkline over `series.slice(windowStart)`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/KpiStrip.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiStrip } from "../KpiStrip";

describe("KpiStrip", () => {
  it("renders the five KPI labels", () => {
    const agg = {
      price: [400000, 420000],
      rent: [1800, 1850],
      inventory: [10000, 11000],
      dom: [40, 38],
      score: [55, 57],
    };
    render(<KpiStrip agg={agg} monthIndex={1} windowStart={0} />);
    [
      "Median value",
      "Median rent",
      "Active listings",
      "Avg days on mkt",
      "Avg PIQ score",
    ].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/KpiStrip.test.tsx`
Expected: FAIL with "Failed to resolve import '../KpiStrip'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/KpiStrip.tsx
"use client";
import React from "react";
import { formatMetricValue } from "@/lib/data";
import { Sparkline } from "./Sparkline";

type Series = (number | null)[];
export interface KpiStripProps {
  agg: {
    price: Series;
    rent: Series;
    inventory: Series;
    dom: Series;
    score: Series;
  };
  monthIndex: number;
  windowStart: number;
}

const fmtBig = (v: number) =>
  v >= 1e6
    ? `${(v / 1e6).toFixed(2)}M`
    : v >= 1e3
      ? `${Math.round(v / 1e3)}K`
      : String(Math.round(v));

export function KpiStrip({ agg, monthIndex, windowStart }: KpiStripProps) {
  const card = (
    label: string,
    dot: string,
    series: Series,
    fmt: (v: number) => string,
    invertGood: boolean,
    isPts: boolean,
  ) => {
    const cur = series[monthIndex],
      prev = series[Math.max(0, monthIndex - 1)];
    const d =
      cur != null && prev != null
        ? isPts
          ? cur - prev
          : prev
            ? ((cur - prev) / prev) * 100
            : 0
        : 0;
    const up = d >= 0,
      good = invertGood ? !up : up;
    const col =
      Math.abs(d) < 0.05
        ? "var(--md-on-surface-variant)"
        : good
          ? "var(--md-tertiary)"
          : "var(--md-error)";
    return (
      <div
        key={label}
        style={{
          background: "var(--md-surface-container)",
          border: "1px solid var(--md-outline-variant)",
          borderRadius: 12,
          padding: "14px 16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            color: "var(--md-on-surface-variant)",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 3,
              background: dot,
              flex: "none",
            }}
          />
          {label}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-roboto-mono)",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--md-on-surface)",
              lineHeight: 1,
            }}
          >
            {cur == null ? "—" : fmt(cur)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-roboto-mono)",
              fontSize: 11.5,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 999,
              background: `color-mix(in srgb, ${col} 12%, transparent)`,
              color: col,
            }}
          >
            {(up ? "▲ " : "▼ ") +
              Math.abs(d).toFixed(1) +
              (isPts ? " pt" : "%")}
          </span>
        </div>
        <div style={{ marginTop: 2 }}>
          <Sparkline
            series={series.slice(windowStart)}
            width={120}
            height={22}
            markerIndex={Math.max(0, monthIndex - windowStart)}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
        gap: 12,
      }}
    >
      {card(
        "Median value",
        "var(--md-primary)",
        agg.price,
        (v) => formatMetricValue(v, "currency"),
        false,
        false,
      )}
      {card(
        "Median rent",
        "var(--md-secondary)",
        agg.rent,
        (v) => `$${fmtBig(v)}`,
        false,
        false,
      )}
      {card(
        "Active listings",
        "var(--md-warning)",
        agg.inventory,
        (v) => fmtBig(v),
        true,
        false,
      )}
      {card(
        "Avg days on mkt",
        "var(--md-error)",
        agg.dom,
        (v) => `${Math.round(v)} d`,
        true,
        false,
      )}
      {card(
        "Avg PIQ score",
        "var(--md-tertiary)",
        agg.score,
        (v) => String(Math.round(v)),
        false,
        true,
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/KpiStrip.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/KpiStrip.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/KpiStrip.test.tsx"
git commit -m "feat(market-explorer): KPI strip with sparklines"
```

---

### Task 16: `MomentumDonut` component

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/MomentumDonut.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/MomentumDonut.test.tsx`

**Interfaces:**

- Produces: `MomentumDonut({ scores, unitPlural })` — `scores: number[]` (current-month scores of in-scope entities). Buckets rising (≥60) / steady (40–59) / cooling (<40); renders the donut ring, a center count, and a 3-row legend.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/MomentumDonut.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MomentumDonut } from "../MomentumDonut";

describe("MomentumDonut", () => {
  it("buckets scores and shows legend counts", () => {
    render(<MomentumDonut scores={[80, 70, 50, 30]} unitPlural="metros" />);
    expect(screen.getByText(/Rising/)).toBeTruthy();
    expect(screen.getByText(/Steady/)).toBeTruthy();
    expect(screen.getByText(/Cooling/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/MomentumDonut.test.tsx`
Expected: FAIL with "Failed to resolve import '../MomentumDonut'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/MomentumDonut.tsx
"use client";
import React from "react";

export interface MomentumDonutProps {
  scores: number[];
  unitPlural: string;
}

export function MomentumDonut({ scores, unitPlural }: MomentumDonutProps) {
  const rising = scores.filter((s) => s >= 60).length;
  const cooling = scores.filter((s) => s < 40).length;
  const steady = scores.length - rising - cooling;
  const total = scores.length || 1;
  const R = 52,
    C = 2 * Math.PI * R;
  const segs: [number, string][] = [
    [rising, "var(--md-tertiary)"],
    [steady, "var(--md-warning)"],
    [cooling, "var(--md-error)"],
  ];
  let off = 0;
  const legend = [
    { label: "Rising (60+)", color: "var(--md-tertiary)", count: rising },
    { label: "Steady (40–59)", color: "var(--md-warning)", count: steady },
    { label: "Cooling (<40)", color: "var(--md-error)", count: cooling },
  ];
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--md-on-surface)",
          marginBottom: 6,
        }}
      >
        Momentum mix · {scores.length} {unitPlural}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg viewBox="0 0 140 140" width={132} height={132}>
          {segs.map(([n, c], i) => {
            const frac = n / total;
            const dash = Math.max(0, frac * C - 2);
            const el = (
              <circle
                key={i}
                cx={70}
                cy={70}
                r={R}
                fill="none"
                stroke={c}
                strokeWidth={16}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-off * C + C / 4}
                style={{
                  transition: "stroke-dasharray .6s, stroke-dashoffset .6s",
                }}
              />
            );
            off += frac;
            return el;
          })}
          <text
            x={70}
            y={66}
            textAnchor="middle"
            fontSize={26}
            fontWeight={700}
            fontFamily="var(--font-roboto-mono)"
            fill="var(--md-on-surface)"
          >
            {rising}
          </text>
          <text
            x={70}
            y={84}
            textAnchor="middle"
            fontSize={10}
            fill="var(--md-on-surface-variant)"
          >
            rising
          </text>
        </svg>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          marginTop: 8,
        }}
      >
        {legend.map((d) => (
          <div
            key={d.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 12,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                color: "var(--md-on-surface-variant)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: d.color,
                }}
              />
              {d.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-roboto-mono)",
                fontWeight: 600,
                color: "var(--md-on-surface)",
              }}
            >
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/MomentumDonut.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/MomentumDonut.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/MomentumDonut.test.tsx"
git commit -m "feat(market-explorer): momentum-mix donut"
```

---

### Task 17: `TopMoversList` component

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/TopMoversList.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/TopMoversList.test.tsx`

**Interfaces:**

- Consumes: `scoreChip` (math), `ScopeRegion` (`@/lib/data`).
- Produces: `TopMoversList({ movers, onSelect })` where `movers: { region: ScopeRegion; delta: number; score: number }[]` (from `computeMovers`). Row = arrow, name/state, delta, score chip; row click → `onSelect(id)`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/TopMoversList.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopMoversList } from "../TopMoversList";

describe("TopMoversList", () => {
  const movers = [
    {
      region: { id: "A", name: "Austin", state: "TX", population: null },
      delta: 4.2,
      score: 61,
    },
    {
      region: { id: "B", name: "Miami", state: "FL", population: null },
      delta: -3.1,
      score: 44,
    },
  ];
  it("renders movers and selects on click", () => {
    const onSelect = vi.fn();
    render(<TopMoversList movers={movers as any} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Austin"));
    expect(onSelect).toHaveBeenCalledWith("A");
    expect(screen.getByText("Miami")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/TopMoversList.test.tsx`
Expected: FAIL with "Failed to resolve import '../TopMoversList'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/TopMoversList.tsx
"use client";
import React from "react";
import type { ScopeRegion } from "@/lib/data/fetchers/market-explorer";
import { scoreChip } from "../lib/explorer-math";

export interface Mover {
  region: ScopeRegion;
  delta: number;
  score: number;
}
export interface TopMoversListProps {
  movers: Mover[];
  onSelect: (id: string) => void;
}

export function TopMoversList({ movers, onSelect }: TopMoversListProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--md-on-surface)",
          marginBottom: 10,
        }}
      >
        Top movers · 3-mo Δ score
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {movers.map(({ region, delta, score }) => {
          const chip = scoreChip(score);
          const col = delta >= 0 ? "var(--md-tertiary)" : "var(--md-error)";
          return (
            <div
              key={region.id}
              onClick={() => onSelect(region.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 4px",
                cursor: "pointer",
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: col,
                  width: 14,
                  textAlign: "center",
                }}
              >
                {delta >= 0 ? "▲" : "▼"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "var(--md-on-surface)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {region.name}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--md-on-surface-variant)",
                  }}
                >
                  {region.state}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-roboto-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: col,
                }}
              >
                {(delta >= 0 ? "+" : "") + delta.toFixed(1)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-roboto-mono)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: chip.bg,
                  color: chip.color,
                }}
              >
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/TopMoversList.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/TopMoversList.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/TopMoversList.test.tsx"
git commit -m "feat(market-explorer): top-movers list"
```

---

### Task 18: `ListingsActivityChart` component (new vs pending bars)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/ListingsActivityChart.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/ListingsActivityChart.test.tsx`

**Interfaces:**

- Produces: `ListingsActivityChart({ title, newListings, pending, months, monthIndex })` — grouped bars over the trailing 12 months; the `monthIndex` bar is highlighted. `newListings`/`pending` are `(number|null)[]` for the selected region; `months` is the shared `dates` axis.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/ListingsActivityChart.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingsActivityChart } from "../ListingsActivityChart";

describe("ListingsActivityChart", () => {
  it("renders a titled svg with bars", () => {
    const n = Array.from({ length: 14 }, (_, i) => 100 + i);
    const p = Array.from({ length: 14 }, (_, i) => 50 + i);
    const months = Array.from(
      { length: 14 },
      (_, i) => `2025-${String(i + 1).padStart(2, "0")}-01`,
    );
    const { container } = render(
      <ListingsActivityChart
        title="Listings activity — Austin"
        newListings={n}
        pending={p}
        months={months}
        monthIndex={13}
      />,
    );
    expect(screen.getByText(/Listings activity/)).toBeTruthy();
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/ListingsActivityChart.test.tsx`
Expected: FAIL with "Failed to resolve import '../ListingsActivityChart'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/ListingsActivityChart.tsx
"use client";
import React from "react";

export interface ListingsActivityChartProps {
  title: string;
  newListings: (number | null)[];
  pending: (number | null)[];
  months: string[];
  monthIndex: number;
}

const Wv = 440,
  Hv = 190,
  mB = 22,
  mT = 8;

export function ListingsActivityChart({
  title,
  newListings,
  pending,
  months,
  monthIndex,
}: ListingsActivityChartProps) {
  const end = Math.min(monthIndex, newListings.length - 1);
  const start = Math.max(0, end - 11);
  const idx: number[] = [];
  for (let t = start; t <= end; t++) idx.push(t);
  const max = Math.max(1, ...idx.map((t) => newListings[t] ?? 0)) * 1.1;
  const bw = (Wv - 16) / (idx.length || 1);
  const monthShort = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleString("en-US", {
      month: "short",
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--md-on-surface)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 11,
            color: "var(--md-on-surface-variant)",
            flex: "none",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: "var(--md-primary)",
              }}
            />
            New listings
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 3,
                background: "var(--md-tertiary)",
              }}
            />
            Pending
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${Wv} ${Hv}`}
        preserveAspectRatio="none"
        width="100%"
        style={{ display: "block", height: Hv }}
      >
        <line
          x1={6}
          x2={Wv - 6}
          y1={Hv - mB}
          y2={Hv - mB}
          stroke="var(--md-outline-variant)"
        />
        {idx.map((t, i) => {
          const x0 = 8 + i * bw,
            cur = t === monthIndex;
          const h1 = ((newListings[t] ?? 0) / max) * (Hv - mB - mT);
          const h2 = ((pending[t] ?? 0) / max) * (Hv - mB - mT);
          return (
            <g key={t}>
              <rect
                x={x0 + bw * 0.14}
                width={bw * 0.32}
                y={Hv - mB - h1}
                height={h1}
                rx={3}
                fill="var(--md-primary)"
                fillOpacity={cur ? 1 : 0.55}
              />
              <rect
                x={x0 + bw * 0.52}
                width={bw * 0.32}
                y={Hv - mB - h2}
                height={h2}
                rx={3}
                fill="var(--md-tertiary)"
                fillOpacity={cur ? 1 : 0.55}
              />
              {(i % 2 === 0 || idx.length <= 8) && (
                <text
                  x={x0 + bw / 2}
                  y={Hv - 7}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontFamily="var(--font-roboto-mono)"
                  fill={
                    cur ? "var(--md-primary)" : "var(--md-on-surface-variant)"
                  }
                  fontWeight={cur ? 700 : 400}
                >
                  {monthShort(months[t] ?? "")}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/ListingsActivityChart.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/ListingsActivityChart.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/ListingsActivityChart.test.tsx"
git commit -m "feat(market-explorer): listings-activity bar chart"
```

---

### Task 19: `Leaderboard` component (ranked table with per-row sparklines)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/Leaderboard.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/Leaderboard.test.tsx`

**Interfaces:**

- Consumes: `Sparkline` (Task 12).
- Produces:
  - `interface LeaderboardRow { id: string; rank: string; name: string; sub: string; valueLabel: string; valueColor: string; score: number; scoreBg: string; scoreColor: string; spark: (number|null)[]; markerIndex: number }`
  - `Leaderboard({ title, monthLabel, rows, selectedId, onSelect })` — rows are prebuilt by the orchestrator (Task 26).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/Leaderboard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Leaderboard } from "../Leaderboard";

const rows = [
  {
    id: "A",
    rank: "01",
    name: "Austin",
    sub: "TX · $455K",
    valueLabel: "RISING",
    valueColor: "var(--md-primary)",
    score: 61,
    scoreBg: "x",
    scoreColor: "y",
    spark: [1, 2, 3],
    markerIndex: 2,
  },
];

describe("Leaderboard", () => {
  it("renders rows and selects on click", () => {
    const onSelect = vi.fn();
    render(
      <Leaderboard
        title="Rankings — metros in U.S."
        monthLabel="May ’26"
        rows={rows}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Austin"));
    expect(onSelect).toHaveBeenCalledWith("A");
    expect(screen.getByText(/Rankings/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/Leaderboard.test.tsx`
Expected: FAIL with "Failed to resolve import '../Leaderboard'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/Leaderboard.tsx
"use client";
import React from "react";
import { Sparkline } from "./Sparkline";

export interface LeaderboardRow {
  id: string;
  rank: string;
  name: string;
  sub: string;
  valueLabel: string;
  valueColor: string;
  score: number;
  scoreBg: string;
  scoreColor: string;
  spark: (number | null)[];
  markerIndex: number;
}
export interface LeaderboardProps {
  title: string;
  monthLabel: string;
  rows: LeaderboardRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Leaderboard({
  title,
  monthLabel,
  rows,
  selectedId,
  onSelect,
}: LeaderboardProps) {
  return (
    <div
      style={{
        background: "var(--md-surface-container)",
        border: "1px solid var(--md-outline-variant)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--md-outline-variant)",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--md-on-surface)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11.5,
            fontFamily: "var(--font-roboto-mono)",
            color: "var(--md-on-surface-variant)",
          }}
        >
          {monthLabel}
        </div>
      </div>
      <div>
        {rows.map((r) => (
          <div
            key={r.id}
            onClick={() => onSelect(r.id)}
            style={{
              display: "grid",
              gridTemplateColumns: "40px minmax(0,1fr) 96px 92px 76px",
              gap: 14,
              alignItems: "center",
              padding: "11px 20px",
              cursor: "pointer",
              borderBottom:
                "1px solid color-mix(in srgb, var(--md-outline-variant) 55%, transparent)",
              background:
                selectedId === r.id
                  ? "color-mix(in srgb, var(--md-primary) 8%, transparent)"
                  : "transparent",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-roboto-mono)",
                fontSize: 13,
                color: "var(--md-on-surface-variant)",
              }}
            >
              {r.rank}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--md-on-surface)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.name}
              </div>
              <div
                style={{ fontSize: 11, color: "var(--md-on-surface-variant)" }}
              >
                {r.sub}
              </div>
            </div>
            <span>
              <Sparkline
                series={r.spark}
                width={92}
                height={26}
                color={r.valueColor}
                markerIndex={r.markerIndex}
              />
            </span>
            <span
              style={{
                fontFamily: "var(--font-roboto-mono)",
                fontSize: 13,
                fontWeight: 600,
                color: r.valueColor,
                textAlign: "right",
              }}
            >
              {r.valueLabel}
            </span>
            <span
              style={{
                justifySelf: "end",
                fontFamily: "var(--font-roboto-mono)",
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 999,
                background: r.scoreBg,
                color: r.scoreColor,
              }}
            >
              {r.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/Leaderboard.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/Leaderboard.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/Leaderboard.test.tsx"
git commit -m "feat(market-explorer): ranked leaderboard"
```

---

### Task 20: `CompareStrip` component (pinned markets, up to 3)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/CompareStrip.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/CompareStrip.test.tsx`

**Interfaces:**

- Produces:
  - `interface PinCard { id: string; name: string; sub: string; score: number; scoreColor: string; stats: { label: string; value: string; color: string }[] }`
  - `CompareStrip({ pins, onUnpin, onClear })` — renders nothing when `pins` is empty.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/CompareStrip.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompareStrip } from "../CompareStrip";

const pins = [
  {
    id: "A",
    name: "Austin",
    sub: "Metro · TX",
    score: 61,
    scoreColor: "green",
    stats: [{ label: "Median value", value: "$455K", color: "x" }],
  },
];

describe("CompareStrip", () => {
  it("renders nothing when there are no pins", () => {
    const { container } = render(
      <CompareStrip pins={[]} onUnpin={() => {}} onClear={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });
  it("renders pin cards and unpins on ✕", () => {
    const onUnpin = vi.fn();
    render(<CompareStrip pins={pins} onUnpin={onUnpin} onClear={() => {}} />);
    expect(screen.getByText("Austin")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove"));
    expect(onUnpin).toHaveBeenCalledWith("A");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/CompareStrip.test.tsx`
Expected: FAIL with "Failed to resolve import '../CompareStrip'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/CompareStrip.tsx
"use client";
import React from "react";

export interface PinCard {
  id: string;
  name: string;
  sub: string;
  score: number;
  scoreColor: string;
  stats: { label: string; value: string; color: string }[];
}
export interface CompareStripProps {
  pins: PinCard[];
  onUnpin: (id: string) => void;
  onClear: () => void;
}

export function CompareStrip({ pins, onUnpin, onClear }: CompareStripProps) {
  if (!pins.length) return null;
  return (
    <div
      style={{
        background: "var(--md-surface-container)",
        border: "1px solid var(--md-outline-variant)",
        borderRadius: 16,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--md-on-surface)",
          }}
        >
          Compare pinned markets
        </div>
        <button
          onClick={onClear}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "var(--md-on-surface-variant)",
          }}
        >
          Clear all
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {pins.map((p) => (
          <div
            key={p.id}
            style={{
              flex: 1,
              minWidth: 200,
              background: "var(--md-surface-container-low)",
              border: "1px solid var(--md-outline-variant)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--md-on-surface)",
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--md-on-surface-variant)",
                  }}
                >
                  {p.sub}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--font-roboto-mono)",
                    fontSize: 22,
                    fontWeight: 700,
                    color: p.scoreColor,
                  }}
                >
                  {p.score}
                </span>
                <button
                  onClick={() => onUnpin(p.id)}
                  aria-label="Remove"
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "var(--md-on-surface-variant)",
                    fontSize: 14,
                    padding: 2,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {p.stats.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--md-on-surface-variant)" }}>
                    {s.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-roboto-mono)",
                      fontWeight: 500,
                      color: s.color,
                    }}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/CompareStrip.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/CompareStrip.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/CompareStrip.test.tsx"
git commit -m "feat(market-explorer): pin-to-compare strip"
```

---

### Task 21: `DetailRail` component (score gauge + confidence + inherited + stats + drill + CTA)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/DetailRail.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/DetailRail.test.tsx`

**Interfaces:**

- Consumes (verified signatures): `ScoreGaugeRing` (`@/app/components/scoring/ScoreGaugeRing`, prop `value:number, size?`), `ConfidenceDisplay` (`@/app/components/scoring/ConfidenceDisplay`, props `level:'a'|'b'|'c'|'f', percentage, metricsAvailable, metricsTotal, freshnessInDays, showDetails?`), `InheritedBadge` (`@/app/components/scoring/InheritedBadge`, props `sourceType:'county'|'metro'|'state'|'national', sourceName?`), `Sparkline` (Task 12).
- Produces: `DetailRail(props)` — presentational; all data/handlers via props (see impl). Confidence is a **data-coverage proxy** computed by the orchestrator (documented in Task 26), not the score engine's stored confidence.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/DetailRail.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DetailRail } from "../DetailRail";

const base = {
  name: "Austin",
  sub: "Metro · CBSA 12420",
  score: 61,
  confidence: {
    level: "b" as const,
    percentage: 75,
    metricsAvailable: 6,
    metricsTotal: 8,
    freshnessInDays: 20,
  },
  inherited: null,
  stats: [
    { label: "Median value", value: "$455K", color: "var(--md-on-surface)" },
  ],
  metricLabel: "PropertyIQ Score",
  metricValueNow: "61",
  railSpark: [50, 55, 61],
  railMarker: 2,
  isPinned: false,
  hasDrill: true,
  drillLabel: "Explore 4 counties in Austin ↓",
};

describe("DetailRail", () => {
  it("renders the selected market, score gauge, and pins on click", () => {
    const onTogglePin = vi.fn();
    render(
      <DetailRail
        {...base}
        onTogglePin={onTogglePin}
        onDrill={() => {}}
        onOpenDashboard={() => {}}
      />,
    );
    expect(screen.getByText("Austin")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: /PropertyIQ Score 61/i }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Compare/i }));
    expect(onTogglePin).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/DetailRail.test.tsx`
Expected: FAIL with "Failed to resolve import '../DetailRail'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/DetailRail.tsx
"use client";
import React from "react";
import { ScoreGaugeRing } from "@/app/components/scoring/ScoreGaugeRing";
import { ConfidenceDisplay } from "@/app/components/scoring/ConfidenceDisplay";
import { InheritedBadge } from "@/app/components/scoring/InheritedBadge";
import { Sparkline } from "./Sparkline";

export interface DetailRailProps {
  name: string;
  sub: string;
  score: number | null;
  confidence: {
    level: "a" | "b" | "c" | "f";
    percentage: number;
    metricsAvailable: number;
    metricsTotal: number;
    freshnessInDays: number;
  };
  inherited: {
    sourceType: "county" | "metro" | "state" | "national";
    sourceName?: string;
  } | null;
  stats: { label: string; value: string; color: string }[];
  metricLabel: string;
  metricValueNow: string;
  railSpark: (number | null)[];
  railMarker: number;
  isPinned: boolean;
  onTogglePin: () => void;
  hasDrill: boolean;
  drillLabel: string;
  onDrill: () => void;
  onOpenDashboard: () => void;
}

export function DetailRail(props: DetailRailProps) {
  const {
    name,
    sub,
    score,
    confidence,
    inherited,
    stats,
    metricLabel,
    metricValueNow,
    railSpark,
    railMarker,
    isPinned,
    onTogglePin,
    hasDrill,
    drillLabel,
    onDrill,
    onOpenDashboard,
  } = props;
  return (
    <aside
      style={{
        position: "sticky",
        top: 84,
        background: "var(--md-surface-container)",
        border: "1px solid var(--md-outline-variant)",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--md-on-surface)",
              lineHeight: 1.2,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--md-on-surface-variant)",
              marginTop: 3,
            }}
          >
            {sub}
          </div>
        </div>
        <button
          onClick={onTogglePin}
          style={{
            border: `1px solid ${isPinned ? "var(--md-tertiary)" : "var(--md-outline)"}`,
            background: isPinned
              ? "color-mix(in srgb, var(--md-tertiary) 12%, transparent)"
              : "transparent",
            color: isPinned
              ? "var(--md-tertiary)"
              : "var(--md-on-surface-variant)",
            cursor: "pointer",
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {isPinned ? "✓ Pinned" : "+ Compare"}
        </button>
      </div>
      <div
        style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}
      >
        <ScoreGaugeRing value={score ?? 50} size={150} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <ConfidenceDisplay
          level={confidence.level}
          percentage={confidence.percentage}
          metricsAvailable={confidence.metricsAvailable}
          metricsTotal={confidence.metricsTotal}
          freshnessInDays={confidence.freshnessInDays}
          showDetails
        />
        {inherited && (
          <InheritedBadge
            sourceType={inherited.sourceType}
            sourceName={inherited.sourceName}
          />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: "var(--md-surface-container-low)",
              border:
                "1px solid color-mix(in srgb, var(--md-outline-variant) 70%, transparent)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                textTransform: "uppercase",
                color: "var(--md-on-surface-variant)",
                marginBottom: 4,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-roboto-mono)",
                fontSize: 15,
                fontWeight: 600,
                color: s.color,
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "var(--md-on-surface-variant)",
            }}
          >
            {metricLabel} · trend
          </span>
          <span
            style={{
              fontFamily: "var(--font-roboto-mono)",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--md-primary)",
            }}
          >
            {metricValueNow}
          </span>
        </div>
        <Sparkline
          series={railSpark}
          width={316}
          height={80}
          markerIndex={railMarker}
        />
      </div>
      {hasDrill && (
        <button
          onClick={onDrill}
          style={{
            border: "1px solid var(--md-outline)",
            cursor: "pointer",
            background: "color-mix(in srgb, var(--md-primary) 8%, transparent)",
            color: "var(--md-primary)",
            padding: "10px 16px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {drillLabel}
        </button>
      )}
      <button
        onClick={onOpenDashboard}
        style={{
          border: "none",
          cursor: "pointer",
          background: "var(--md-primary)",
          color: "var(--md-on-primary)",
          padding: "11px 16px",
          borderRadius: 999,
          fontSize: 13.5,
          fontWeight: 500,
          boxShadow:
            "0 2px 8px color-mix(in srgb, var(--md-primary) 35%, transparent)",
        }}
      >
        Open full market dashboard →
      </button>
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/DetailRail.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/DetailRail.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/DetailRail.test.tsx"
git commit -m "feat(market-explorer): sticky detail rail"
```

---

### Task 22: `GeoDrillBar` component (breadcrumb path + level tabs)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/GeoDrillBar.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/GeoDrillBar.test.tsx`

**Interfaces:**

- Produces:
  - `interface Crumb { label: string; active: boolean; onClick: () => void }`
  - `interface LevelTab { label: string; enabled: boolean; active: boolean; onClick: () => void }`
  - `GeoDrillBar({ crumbs, levelTabs })` — crumbs/tabs are built by the orchestrator (Task 26). Level tabs move UP the hierarchy or switch the national view (State→map); a disabled tab is non-clickable (down-jumps to an unchosen parent aren't possible).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/GeoDrillBar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GeoDrillBar } from "../GeoDrillBar";

describe("GeoDrillBar", () => {
  it("renders crumbs + tabs and fires the right handler", () => {
    const onCrumb = vi.fn();
    render(
      <GeoDrillBar
        crumbs={[
          { label: "United States", active: false, onClick: onCrumb },
          { label: "Texas", active: true, onClick: () => {} },
        ]}
        levelTabs={[
          { label: "State", enabled: true, active: false, onClick: () => {} },
          { label: "Metro", enabled: false, active: true, onClick: () => {} },
        ]}
      />,
    );
    fireEvent.click(screen.getByText("United States"));
    expect(onCrumb).toHaveBeenCalled();
    expect(screen.getByText("Texas")).toBeTruthy();
    expect(screen.getByText("Metro")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/GeoDrillBar.test.tsx`
Expected: FAIL with "Failed to resolve import '../GeoDrillBar'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/GeoDrillBar.tsx
"use client";
import React from "react";

export interface Crumb {
  label: string;
  active: boolean;
  onClick: () => void;
}
export interface LevelTab {
  label: string;
  enabled: boolean;
  active: boolean;
  onClick: () => void;
}
export interface GeoDrillBarProps {
  crumbs: Crumb[];
  levelTabs: LevelTab[];
}

export function GeoDrillBar({ crumbs, levelTabs }: GeoDrillBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--md-on-surface-variant)",
            marginRight: 4,
          }}
        >
          Scope
        </span>
        {crumbs.map((c, i) => (
          <span
            key={i}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {i > 0 && (
              <span style={{ color: "var(--md-outline)", fontSize: 12 }}>
                ›
              </span>
            )}
            <button
              onClick={c.onClick}
              style={{
                border: `1px solid ${c.active ? "var(--md-primary)" : "var(--md-outline-variant)"}`,
                cursor: "pointer",
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                background: c.active ? "var(--md-primary)" : "transparent",
                color: c.active
                  ? "var(--md-on-primary)"
                  : "var(--md-on-surface-variant)",
              }}
            >
              {c.label}
            </button>
          </span>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          background: "var(--md-surface-container-high)",
          borderRadius: 999,
          padding: 2,
          gap: 2,
        }}
      >
        {levelTabs.map((t) => (
          <button
            key={t.label}
            onClick={t.enabled ? t.onClick : undefined}
            style={{
              border: "none",
              cursor: t.enabled ? "pointer" : "default",
              padding: "5px 14px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              opacity: t.enabled || t.active ? 1 : 0.45,
              background: t.active
                ? "var(--md-surface-container-lowest)"
                : "transparent",
              color: t.active
                ? "var(--md-primary)"
                : "var(--md-on-surface-variant)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/GeoDrillBar.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/GeoDrillBar.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/GeoDrillBar.test.tsx"
git commit -m "feat(market-explorer): geo drill bar (breadcrumb + level tabs)"
```

---

### Task 23: `MetricSwitcher` component (6-metric chip row)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/MetricSwitcher.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/MetricSwitcher.test.tsx`

**Interfaces:**

- Consumes: `EXPLORER_METRICS`, `ExplorerMetricId` (config).
- Produces: `MetricSwitcher({ active, disabledIds, onPick })` — renders one chip per `EXPLORER_METRICS`; a chip in `disabledIds` (metric with no data at the current geo level) is greyed and non-clickable.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/MetricSwitcher.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetricSwitcher } from "../MetricSwitcher";

describe("MetricSwitcher", () => {
  it("renders the 6 metric chips and picks one", () => {
    const onPick = vi.fn();
    render(<MetricSwitcher active="score" disabledIds={[]} onPick={onPick} />);
    expect(screen.getByText("Home Value YoY")).toBeTruthy();
    fireEvent.click(screen.getByText("Rent Yield"));
    expect(onPick).toHaveBeenCalledWith("rent_yield");
  });
  it("does not fire for a disabled metric", () => {
    const onPick = vi.fn();
    render(
      <MetricSwitcher
        active="score"
        disabledIds={["hotness"]}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByText("Hotness"));
    expect(onPick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/MetricSwitcher.test.tsx`
Expected: FAIL with "Failed to resolve import '../MetricSwitcher'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/MetricSwitcher.tsx
"use client";
import React from "react";
import {
  EXPLORER_METRICS,
  type ExplorerMetricId,
} from "../lib/explorer-config";

export interface MetricSwitcherProps {
  active: ExplorerMetricId;
  disabledIds: ExplorerMetricId[];
  onPick: (id: ExplorerMetricId) => void;
}

export function MetricSwitcher({
  active,
  disabledIds,
  onPick,
}: MetricSwitcherProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--md-on-surface-variant)",
          marginRight: 4,
        }}
      >
        Metric
      </span>
      {EXPLORER_METRICS.map((m) => {
        const isActive = m.id === active;
        const disabled = disabledIds.includes(m.id);
        return (
          <button
            key={m.id}
            disabled={disabled}
            onClick={disabled ? undefined : () => onPick(m.id)}
            title={disabled ? "No data at this geography level" : undefined}
            style={{
              border: `1px solid ${isActive ? "var(--md-primary)" : "var(--md-outline-variant)"}`,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.4 : 1,
              padding: "7px 14px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 500,
              background: isActive
                ? "var(--md-primary)"
                : "var(--md-surface-container-high)",
              color: isActive
                ? "var(--md-on-primary)"
                : "var(--md-on-surface-variant)",
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/MetricSwitcher.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/MetricSwitcher.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/MetricSwitcher.test.tsx"
git commit -m "feat(market-explorer): metric switcher chips"
```

---

### Task 24: `TimelineScrubber` component (play/pause + range input + presets)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/TimelineScrubber.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/TimelineScrubber.test.tsx`

**Interfaces:**

- Produces: `TimelineScrubber(props)` — owns the 380ms autoplay interval (ports the prototype's `togglePlay`). Autoplay advances via `onAdvance(next)`; reaching `max` calls `onStop`. Manual drag calls `onScrub(value)` (the orchestrator pauses on manual scrub). Range presets call `onRange(months)`.

  ```ts
  interface TimelineScrubberProps {
    min: number;
    max: number;
    value: number;
    playing: boolean;
    onTogglePlay: () => void;
    onScrub: (v: number) => void;
    onAdvance: (v: number) => void;
    onStop: () => void;
    rangeOptions: {
      months: number;
      label: string;
      active: boolean;
      onClick: () => void;
    }[];
    startLabel: string;
    midLabel: string;
    endLabel: string;
    monthLabel: string;
  }
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/TimelineScrubber.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimelineScrubber } from "../TimelineScrubber";

const base = {
  min: 0,
  max: 10,
  value: 3,
  onTogglePlay: () => {},
  onScrub: () => {},
  onAdvance: () => {},
  onStop: () => {},
  rangeOptions: [{ months: 24, label: "2Y", active: true, onClick: () => {} }],
  startLabel: "Jul ’24",
  midLabel: "Jan ’25",
  endLabel: "Jul ’26",
  monthLabel: "Apr ’25",
};

describe("TimelineScrubber", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the month label and the range preset", () => {
    render(<TimelineScrubber {...base} playing={false} />);
    expect(screen.getByText("Apr ’25")).toBeTruthy();
    expect(screen.getByText("2Y")).toBeTruthy();
  });

  it("advances via onAdvance while playing", () => {
    const onAdvance = vi.fn();
    render(<TimelineScrubber {...base} playing onAdvance={onAdvance} />);
    vi.advanceTimersByTime(400);
    expect(onAdvance).toHaveBeenCalledWith(4);
  });

  it("calls onStop when playing at the max frame", () => {
    const onStop = vi.fn();
    render(<TimelineScrubber {...base} value={10} playing onStop={onStop} />);
    vi.advanceTimersByTime(400);
    expect(onStop).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/TimelineScrubber.test.tsx`
Expected: FAIL with "Failed to resolve import '../TimelineScrubber'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/TimelineScrubber.tsx
"use client";
import React, { useEffect } from "react";

export interface TimelineScrubberProps {
  min: number;
  max: number;
  value: number;
  playing: boolean;
  onTogglePlay: () => void;
  onScrub: (v: number) => void;
  onAdvance: (v: number) => void;
  onStop: () => void;
  rangeOptions: {
    months: number;
    label: string;
    active: boolean;
    onClick: () => void;
  }[];
  startLabel: string;
  midLabel: string;
  endLabel: string;
  monthLabel: string;
}

export function TimelineScrubber(props: TimelineScrubberProps) {
  const {
    min,
    max,
    value,
    playing,
    onTogglePlay,
    onScrub,
    onAdvance,
    onStop,
    rangeOptions,
    startLabel,
    midLabel,
    endLabel,
    monthLabel,
  } = props;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (value >= max) onStop();
      else onAdvance(value + 1);
    }, 380);
    return () => clearInterval(id);
  }, [playing, value, max, onAdvance, onStop]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "0 20px",
        }}
      >
        <div
          style={{
            display: "flex",
            background: "var(--md-surface-container-high)",
            borderRadius: 999,
            padding: 2,
            gap: 2,
          }}
        >
          {rangeOptions.map((r) => (
            <button
              key={r.months}
              onClick={r.onClick}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 600,
                fontFamily: "var(--font-roboto-mono)",
                background: r.active
                  ? "var(--md-surface-container-lowest)"
                  : "transparent",
                color: r.active
                  ? "var(--md-primary)"
                  : "var(--md-on-surface-variant)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 20px 16px",
          borderTop: "1px solid var(--md-outline-variant)",
          marginTop: 8,
        }}
      >
        <button
          onClick={onTogglePlay}
          aria-label={playing ? "Pause timeline" : "Play timeline"}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: "var(--md-primary)",
            color: "var(--md-on-primary)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}
        >
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(e) => onScrub(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10.5,
              fontFamily: "var(--font-roboto-mono)",
              color: "var(--md-on-surface-variant)",
            }}
          >
            <span>{startLabel}</span>
            <span>{midLabel}</span>
            <span>{endLabel}</span>
          </div>
        </div>
        <div
          style={{
            fontFamily: "var(--font-roboto-mono)",
            fontSize: 15,
            fontWeight: 700,
            color: "var(--md-primary)",
            minWidth: 76,
            textAlign: "right",
          }}
        >
          {monthLabel}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/TimelineScrubber.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/TimelineScrubber.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/TimelineScrubber.test.tsx"
git commit -m "feat(market-explorer): timeline scrubber with autoplay"
```

---

### Task 25: `HeroVisualization` component (chart frame + view/nearby toggles + legend)

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/components/HeroVisualization.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/HeroVisualization.test.tsx`

**Interfaces:**

- Produces: `HeroVisualization(props)` — layout frame that hosts the hero chart (`chart` node = `<BubbleChart>` or `<StateTileMap>`) and the `scrubber` node, plus the header controls (title, Bubbles/Map view toggle, optional Nearby toggle, cooling→rising color legend).

  ```ts
  interface HeroVisualizationProps {
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
  }
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/components/__tests__/HeroVisualization.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeroVisualization } from "../HeroVisualization";

describe("HeroVisualization", () => {
  it("renders title, chart, and toggles the view", () => {
    const onSetView = vi.fn();
    render(
      <HeroVisualization
        title="PropertyIQ Score across 40 metros"
        hint="Click a bubble…"
        view="bubbles"
        onSetView={onSetView}
        hasNearby={false}
        includeNearby={false}
        onToggleNearby={() => {}}
        nearbyLabel="+ Nearby"
        chart={<div data-testid="chart" />}
        scrubber={<div data-testid="scrubber" />}
      />,
    );
    expect(screen.getByText(/across 40 metros/)).toBeTruthy();
    expect(screen.getByTestId("chart")).toBeTruthy();
    fireEvent.click(screen.getByText("Map"));
    expect(onSetView).toHaveBeenCalledWith("map");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/HeroVisualization.test.tsx`
Expected: FAIL with "Failed to resolve import '../HeroVisualization'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/components/HeroVisualization.tsx
"use client";
import React from "react";

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
  } = props;
  const tab = (v: "bubbles" | "map", label: string, icon: string) => (
    <button
      onClick={() => onSetView(v)}
      style={{
        border: "none",
        cursor: "pointer",
        padding: "5px 13px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background:
          view === v ? "var(--md-surface-container-lowest)" : "transparent",
        color:
          view === v ? "var(--md-primary)" : "var(--md-on-surface-variant)",
        boxShadow: view === v ? "0 1px 4px rgba(0,0,0,.18)" : "none",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {icon} {label}
    </button>
  );
  return (
    <div
      style={{
        background: "var(--md-surface-container)",
        border: "1px solid var(--md-outline-variant)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px 0",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--md-on-surface)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "var(--md-surface-container-high)",
              borderRadius: 999,
              padding: 2,
              gap: 2,
            }}
          >
            {tab("bubbles", "Bubbles", "◉")}
            {tab("map", "Map", "▦")}
          </div>
          {hasNearby && (
            <button
              onClick={onToggleNearby}
              style={{
                border: `1px dashed ${includeNearby ? "var(--md-primary)" : "var(--md-outline)"}`,
                cursor: "pointer",
                padding: "5px 13px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: includeNearby
                  ? "color-mix(in srgb, var(--md-primary) 12%, transparent)"
                  : "transparent",
                color: includeNearby
                  ? "var(--md-primary)"
                  : "var(--md-on-surface-variant)",
                whiteSpace: "nowrap",
              }}
            >
              {nearbyLabel}
            </button>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              color: "var(--md-on-surface-variant)",
            }}
          >
            <span>Cooling</span>
            <span
              style={{
                width: 90,
                height: 8,
                borderRadius: 999,
                background: "linear-gradient(90deg,#e53935,#ffb300,#00c853)",
                display: "inline-block",
              }}
            />
            <span>Rising</span>
          </div>
        </div>
      </div>
      <div
        style={{
          padding: "2px 20px 0",
          fontSize: 11.5,
          color: "var(--md-on-surface-variant)",
        }}
      >
        {hint}
      </div>
      <div style={{ padding: "8px 12px 0" }}>{chart}</div>
      {scrubber}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/components/__tests__/HeroVisualization.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/components/HeroVisualization.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/HeroVisualization.test.tsx"
git commit -m "feat(market-explorer): hero visualization frame"
```

---

### Task 26: Explorer view-model — pure per-frame prop builders

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/lib/explorer-view-model.ts`
- Test: `packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-view-model.test.ts`

**Interfaces:**

- Consumes: `metricSeriesFor`, `scoreChip`, `formatExplorerValue`, `SeriesByMetric` (math); `EXPLORER_METRICS`, `ExplorerMetricId` (config); `getScoreColor`, `getScoreLabel` (`ScoreDisplay`); `formatMetricValue`, `titleCaseLocationName` (`@/lib/data`); `ScopeRegion` (`@/lib/data`); `LeaderboardRow` (Task 19).
- Produces (all pure, month-sliced):
  - `buildBubbleScalars(entities, series, metricId, monthIndex): { xByRegion; yByRegion; scoreByRegion; radiusByRegion }`
  - `buildLeaderboardRows(entities, series, metricId, monthIndex, windowStart, listCount): LeaderboardRow[]`
  - `coverageConfidence(series, regionId, monthIndex, latestDate): { level; percentage; metricsAvailable; metricsTotal; freshnessInDays }` (the documented **data-coverage confidence proxy**)
  - `buildDetailStats(series, regionId, monthIndex): { label; value; color }[]` (6 stats)

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-view-model.test.ts
import { describe, it, expect } from "vitest";
import {
  buildBubbleScalars,
  buildLeaderboardRows,
  coverageConfidence,
} from "../explorer-view-model";

const region = (id: string) => ({ id, name: id, state: "TX", population: 1 });
const series = {
  home_value: { A: [300000, 320000], B: [900000, 950000] },
  rent_index: { A: [2000, 2100], B: [3000, 3100] },
  for_sale_inventory: { A: [1000, 1100], B: [3000, 2900] },
  days_on_market: { A: [40, 38], B: [30, 28] },
  hotness_score: { A: [60, 62], B: [40, 41] },
  new_listings: { A: [100, 110], B: [200, 190] },
  home_sales: { A: [80, 85], B: [150, 140] },
  propertyiq_score: { A: [55, 58], B: [42, 44] },
} as any;

describe("buildBubbleScalars", () => {
  it("slices x=price, y=metric, color=score, radius=current inventory at the month", () => {
    const s = buildBubbleScalars(
      [region("A"), region("B")],
      series,
      "score",
      1,
    );
    expect(s.xByRegion.A).toBe(320000);
    expect(s.yByRegion.A).toBe(58); // score at month 1
    expect(s.scoreByRegion.B).toBe(44);
    expect(s.radiusByRegion.A).toBe(1100); // latest inventory
  });
});

describe("buildLeaderboardRows", () => {
  it("ranks by the metric (score desc) and labels momentum", () => {
    const rows = buildLeaderboardRows(
      [region("A"), region("B")],
      series,
      "score",
      1,
      0,
      15,
    );
    expect(rows[0].id).toBe("A"); // 58 > 44
    expect(rows[0].rank).toBe("01");
    expect(rows[0].valueLabel).toMatch(/STEADY|FIRMING|RISING/);
  });
});

describe("coverageConfidence", () => {
  it("maps metric coverage to an A/B/C/F level", () => {
    const c = coverageConfidence(series, "A", 1, "2026-05-01");
    expect(c.metricsTotal).toBe(8);
    expect(c.metricsAvailable).toBe(8);
    expect(c.level).toBe("a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-view-model.test.ts`
Expected: FAIL with "Failed to resolve import '../explorer-view-model'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/frontend/app/(app)/market/explorer/lib/explorer-view-model.ts
import {
  getScoreColor,
  getScoreLabel,
} from "@/app/components/scoring/ScoreDisplay";
import { formatMetricValue, titleCaseLocationName } from "@/lib/data";
import type { ScopeRegion } from "@/lib/data/fetchers/market-explorer";
import type { LeaderboardRow } from "../components/Leaderboard";
import {
  EXPLORER_METRICS,
  FETCHED_METRICS,
  type ExplorerMetricId,
} from "./explorer-config";
import {
  metricSeriesFor,
  scoreChip,
  formatExplorerValue,
  type SeriesByMetric,
} from "./explorer-math";

const at = (arr: (number | null)[] | undefined, i: number): number | null =>
  arr ? (arr[i] ?? null) : null;
const lastNonNull = (arr?: (number | null)[]): number | null => {
  if (!arr) return null;
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]!;
  return null;
};

export function buildBubbleScalars(
  entities: ScopeRegion[],
  series: SeriesByMetric,
  metricId: ExplorerMetricId,
  monthIndex: number,
) {
  const xByRegion: Record<string, number | null> = {};
  const yByRegion: Record<string, number | null> = {};
  const scoreByRegion: Record<string, number | null> = {};
  const radiusByRegion: Record<string, number | null> = {};
  for (const e of entities) {
    xByRegion[e.id] = at(series.home_value?.[e.id], monthIndex);
    yByRegion[e.id] = at(metricSeriesFor(metricId, series, e.id), monthIndex);
    scoreByRegion[e.id] = at(series.propertyiq_score?.[e.id], monthIndex);
    radiusByRegion[e.id] = lastNonNull(series.for_sale_inventory?.[e.id]);
  }
  return { xByRegion, yByRegion, scoreByRegion, radiusByRegion };
}

export function buildLeaderboardRows(
  entities: ScopeRegion[],
  series: SeriesByMetric,
  metricId: ExplorerMetricId,
  monthIndex: number,
  windowStart: number,
  listCount: number,
): LeaderboardRow[] {
  const cfg = EXPLORER_METRICS.find((m) => m.id === metricId)!;
  const dir = cfg.betterHigh ? -1 : 1;
  const withVal = entities
    .map((e) => ({
      e,
      series: metricSeriesFor(metricId, series, e.id),
      score: at(series.propertyiq_score?.[e.id], monthIndex),
    }))
    .map((x) => ({ ...x, v: at(x.series, monthIndex) }))
    .filter((x) => x.v != null)
    .sort((a, b) => dir * ((a.v as number) - (b.v as number)))
    .slice(0, listCount);

  return withVal.map((x, i) => {
    const score = Math.round(x.score ?? 50);
    const chip = scoreChip(score);
    const price = at(series.home_value?.[x.e.id], monthIndex);
    const isScore = metricId === "score";
    return {
      id: x.e.id,
      rank: String(i + 1).padStart(2, "0"),
      name: titleCaseLocationName(x.e.name),
      sub: `${x.e.state}${price != null ? ` · ${formatMetricValue(price, "currency")}` : ""}`,
      valueLabel: isScore
        ? getScoreLabel(score)
        : formatExplorerValue(x.v, cfg.format),
      valueColor: isScore ? chip.color : "var(--md-on-surface)",
      score,
      scoreBg: chip.bg,
      scoreColor: chip.color,
      spark: x.series.slice(windowStart),
      markerIndex: Math.max(0, monthIndex - windowStart),
    };
  });
}

export function coverageConfidence(
  series: SeriesByMetric,
  regionId: string,
  monthIndex: number,
  latestDate: string,
) {
  const available = FETCHED_METRICS.filter(
    (m) => at(series[m]?.[regionId], monthIndex) != null,
  ).length;
  const percentage = Math.round((available / FETCHED_METRICS.length) * 100);
  const level: "a" | "b" | "c" | "f" =
    percentage >= 80
      ? "a"
      : percentage >= 65
        ? "b"
        : percentage >= 45
          ? "c"
          : "f";
  const freshnessInDays = latestDate
    ? Math.max(
        0,
        Math.round(
          (Date.now() -
            new Date(`${latestDate.slice(0, 10)}T00:00:00`).getTime()) /
            86400000,
        ),
      )
    : 0;
  return {
    level,
    percentage,
    metricsAvailable: available,
    metricsTotal: FETCHED_METRICS.length,
    freshnessInDays,
  };
}

export function buildDetailStats(
  series: SeriesByMetric,
  regionId: string,
  monthIndex: number,
) {
  const price = at(series.home_value?.[regionId], monthIndex);
  const yoy = at(
    metricSeriesFor("home_value_yoy", series, regionId),
    monthIndex,
  );
  const yld = at(metricSeriesFor("rent_yield", series, regionId), monthIndex);
  const hot = at(series.hotness_score?.[regionId], monthIndex);
  const dom = at(series.days_on_market?.[regionId], monthIndex);
  const sup = at(metricSeriesFor("supply", series, regionId), monthIndex);
  const pos = "var(--md-tertiary)",
    neg = "var(--md-error)",
    on = "var(--md-on-surface)";
  return [
    {
      label: "Median value",
      value: formatMetricValue(price, "currency"),
      color: on,
    },
    {
      label: "Value YoY",
      value: formatExplorerValue(yoy, "percent"),
      color: (yoy ?? 0) >= 0 ? pos : neg,
    },
    {
      label: "Rent yield",
      value: formatExplorerValue(yld, "percent_abs"),
      color: on,
    },
    { label: "Hotness", value: formatExplorerValue(hot, "index"), color: on },
    {
      label: "Days on mkt",
      value: formatExplorerValue(dom, "days"),
      color: on,
    },
    {
      label: "Mo. supply",
      value: formatExplorerValue(sup, "months"),
      color: on,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/lib/__tests__/explorer-view-model.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/lib/explorer-view-model.ts" "packages/frontend/app/(app)/market/explorer/lib/__tests__/explorer-view-model.test.ts"
git commit -m "feat(market-explorer): per-frame view-model builders"
```

---

### Task 27: `MarketExplorer` orchestrator — state, data, and composition

**Files:**

- Create: `packages/frontend/app/(app)/market/explorer/MarketExplorer.tsx`
- Test: `packages/frontend/app/(app)/market/explorer/__tests__/MarketExplorer.test.tsx`

**Interfaces:**

- Consumes: everything above — `useReducer(explorerReducer)`, `useExplorerScopeData`, `resolveScope`, the view-model builders, `aggregateScopeKpis`/`computeMovers`/`metricSeriesFor`/`scoreChip`/`formatExplorerValue` (math), `getScoreColor` (`ScoreDisplay`), `formatMetricValue`/`titleCaseLocationName`/`isMetricSupportedForGeo` (`@/lib/data`), all components (Tasks 12–25), `useRouter` (`next/navigation`).
- Produces: `MarketExplorer()` default export — the page's root client component.

**`includeNearby` (full behavior, ported from the prototype's `nearbyEnts()`):** the Nearby toggle is shown whenever a parent scope exists (`hasNearby = !!scope.parentId`) — i.e. once you've drilled in. The nearby set is resolved **server-side** in **Task 29** and returned inside the same roster with `nearby: true`, so the batched metric fetch already covers them (no extra frontend fetch). It branches on scope exactly like the prototype: drilled into a **state** (showing metros) → metros of geographically **tile-adjacent** states; drilled into a **metro** (showing counties) → counties of sibling metros in the same state; drilled into a **county** (showing ZIPs) → ZIPs of sibling counties in the same metro. The bubble chart renders nearby entities dashed/faded (Task 29 edits `BubbleChart`).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/app/(app)/market/explorer/__tests__/MarketExplorer.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../lib/useExplorerScopeData", () => ({
  MAX_MONTHS: 120,
  useExplorerScopeData: () => ({
    dates: ["2026-04-01", "2026-05-01"],
    regions: [
      { id: "35620", name: "New York", state: "NY", population: 20000000 },
      { id: "31080", name: "Los Angeles", state: "CA", population: 13000000 },
    ],
    series: {
      home_value: { "35620": [680000, 690000], "31080": [950000, 960000] },
      rent_index: { "35620": [3000, 3050], "31080": [3400, 3450] },
      for_sale_inventory: { "35620": [30000, 31000], "31080": [15000, 15500] },
      days_on_market: { "35620": [45, 44], "31080": [42, 41] },
      hotness_score: { "35620": [78, 79], "31080": [71, 72] },
      new_listings: { "35620": [9000, 9100], "31080": [5000, 5100] },
      home_sales: { "35620": [8000, 8100], "31080": [4600, 4700] },
      propertyiq_score: { "35620": [72, 74], "31080": [58, 60] },
    },
    isLoading: false,
    error: null,
  }),
}));

import MarketExplorer from "../MarketExplorer";

describe("MarketExplorer", () => {
  it("renders the explorer with hero, metric switcher, and leaderboard", () => {
    render(<MarketExplorer />);
    expect(screen.getByText("Market Explorer")).toBeTruthy();
    expect(screen.getByText("PropertyIQ Score")).toBeTruthy(); // metric chip
    expect(screen.getByText(/Rankings/)).toBeTruthy();
    expect(screen.getAllByText("New York").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/__tests__/MarketExplorer.test.tsx`
Expected: FAIL with "Failed to resolve import '../MarketExplorer'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/app/(app)/market/explorer/MarketExplorer.tsx
"use client";
import React, { useEffect, useMemo, useReducer } from "react";
import { useRouter } from "next/navigation";
import {
  formatMetricValue,
  isMetricSupportedForGeo,
  titleCaseLocationName,
} from "@/lib/data";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";
import {
  explorerReducer,
  initialExplorerState,
  resolveScope,
} from "./lib/explorer-reducer";
import { useExplorerScopeData } from "./lib/useExplorerScopeData";
import {
  EXPLORER_METRICS,
  RANGE_PRESETS,
  childGeoLevel,
  type ExplorerMetricId,
} from "./lib/explorer-config";
import {
  aggregateScopeKpis,
  computeMovers,
  metricSeriesFor,
  scoreChip,
  formatExplorerValue,
} from "./lib/explorer-math";
import {
  buildBubbleScalars,
  buildLeaderboardRows,
  buildDetailStats,
  coverageConfidence,
} from "./lib/explorer-view-model";
import { GeoDrillBar } from "./components/GeoDrillBar";
import { MetricSwitcher } from "./components/MetricSwitcher";
import { KpiStrip } from "./components/KpiStrip";
import { HeroVisualization } from "./components/HeroVisualization";
import { BubbleChart } from "./components/BubbleChart";
import { StateTileMap } from "./components/StateTileMap";
import { TimelineScrubber } from "./components/TimelineScrubber";
import { ListingsActivityChart } from "./components/ListingsActivityChart";
import { MomentumDonut } from "./components/MomentumDonut";
import { TopMoversList } from "./components/TopMoversList";
import { CompareStrip } from "./components/CompareStrip";
import { Leaderboard } from "./components/Leaderboard";
import { DetailRail } from "./components/DetailRail";

const UNIT_PLURAL: Record<string, string> = {
  state: "states",
  metro: "metros",
  county: "counties",
  zip: "ZIPs",
};
const CHILD_PLURAL: Record<string, string> = {
  state: "metros",
  metro: "counties",
  county: "ZIP codes",
};
const monthLabelOf = (iso?: string) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`)
        .toLocaleString("en-US", { month: "short", year: "2-digit" })
        .replace(" ", " ’")
    : "";

export default function MarketExplorer() {
  const router = useRouter();
  const [state, dispatch] = useReducer(explorerReducer, initialExplorerState);
  const scope = resolveScope(state);
  const scopeKey = `${scope.geoLevel}:${scope.parentId ?? ""}:${state.view}`;

  const { dates, regions, series, isLoading } = useExplorerScopeData(
    scope.geoLevel,
    scope.parentLevel,
    scope.parentId,
    state.includeNearby,
  );
  // Nearby overlay is available whenever a parent scope exists (drilled in).
  const hasNearby = !!scope.parentId;

  // Reset month to latest + selection to first whenever the scope changes.
  useEffect(() => {
    if (dates.length)
      dispatch({ type: "SET_MONTH", monthIndex: dates.length - 1 });
  }, [scopeKey, dates.length]);
  useEffect(() => {
    if (regions.length && !regions.some((r) => r.id === state.selectedId)) {
      dispatch({ type: "SELECT", id: regions[0].id });
    }
  }, [scopeKey, regions, state.selectedId]);

  const lastIdx = Math.max(0, dates.length - 1);
  const mi = Math.min(state.monthIndex, lastIdx);
  const windowStart = Math.max(0, dates.length - state.range);
  const metricCfg = EXPLORER_METRICS.find((m) => m.id === state.metric)!;
  const selected =
    regions.find((r) => r.id === state.selectedId) ?? regions[0] ?? null;

  const scalars = useMemo(
    () => buildBubbleScalars(regions, series, state.metric, mi),
    [regions, series, state.metric, mi],
  );
  const agg = useMemo(
    () =>
      aggregateScopeKpis(
        regions.map((r) => r.id),
        series,
        dates.length,
      ),
    [regions, series, dates.length],
  );
  const movers = useMemo(
    () => computeMovers(regions, series.propertyiq_score ?? {}, mi),
    [regions, series, mi],
  );
  const rows = useMemo(
    () =>
      buildLeaderboardRows(regions, series, state.metric, mi, windowStart, 15),
    [regions, series, state.metric, mi, windowStart],
  );
  const donutScores = regions
    .map((r) => scalars.scoreByRegion[r.id])
    .filter((v): v is number => v != null);

  const unitPlural = UNIT_PLURAL[scope.geoLevel];
  const scopeName = state.path[state.path.length - 1]?.name;

  // ── handlers ──
  const onSelect = (id: string) => dispatch({ type: "SELECT", id });
  const onDrillEntity = (id: string) => {
    const r = regions.find((e) => e.id === id);
    if (!r) return;
    dispatch({
      type: "DRILL",
      crumb: { level: scope.geoLevel, id, name: r.name },
    });
  };
  const openDashboard = (r: { id: string; state: string } | null) => {
    if (!r) return;
    const params = new URLSearchParams({ type: scope.geoLevel });
    if (r.state) params.set("state", r.state);
    router.push(`/market/${r.id}?${params.toString()}`);
  };

  // ── breadcrumbs + level tabs ──
  const crumbs = [
    {
      label: "United States",
      active: state.path.length === 0,
      onClick: () => dispatch({ type: "RESET_NATIONAL" }),
    },
    ...state.path.map((c, i) => ({
      label: titleCaseLocationName(c.name),
      active: i === state.path.length - 1,
      onClick: () => dispatch({ type: "NAVIGATE_CRUMB", index: i }),
    })),
  ];
  const crumbAt = (lvl: string) => state.path.findIndex((c) => c.level === lvl);
  const tab = (label: string, level: "state" | "metro" | "county" | "zip") => {
    if (level === "state")
      return {
        label,
        active: state.view === "map",
        enabled: true,
        onClick: () => dispatch({ type: "SET_VIEW", view: "map" }),
      };
    if (level === "metro")
      return {
        label,
        active: scope.geoLevel === "metro" && state.view !== "map",
        enabled: true,
        onClick: () => {
          const i = crumbAt("state");
          i >= 0
            ? dispatch({ type: "NAVIGATE_CRUMB", index: i })
            : dispatch({ type: "RESET_NATIONAL" });
        },
      };
    const parent = level === "county" ? "metro" : "county";
    const i = crumbAt(parent);
    return {
      label,
      active: scope.geoLevel === level,
      enabled: i >= 0,
      onClick: () => i >= 0 && dispatch({ type: "NAVIGATE_CRUMB", index: i }),
    };
  };
  const levelTabs = [
    tab("State", "state"),
    tab("Metro", "metro"),
    tab("County", "county"),
    tab("ZIP", "zip"),
  ];

  const disabledMetricIds = EXPLORER_METRICS.filter(
    (m) =>
      m.source.kind === "fetched" &&
      !isMetricSupportedForGeo(m.source.series, scope.geoLevel as any) &&
      !series[m.source.series],
  ).map((m) => m.id) as ExplorerMetricId[];

  // ── hero chart ──
  const heroChart =
    state.view === "map" ? (
      <StateTileMap
        entities={regions}
        scoreByRegion={scalars.scoreByRegion}
        valueByRegion={scalars.yByRegion}
        format={metricCfg.format}
        onDrill={(fips, name) =>
          dispatch({ type: "DRILL", crumb: { level: "state", id: fips, name } })
        }
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

  const scrubber = (
    <TimelineScrubber
      min={windowStart}
      max={lastIdx}
      value={mi}
      playing={state.playing}
      onTogglePlay={() => dispatch({ type: "TOGGLE_PLAY" })}
      onScrub={(v) => {
        dispatch({ type: "SET_MONTH", monthIndex: v });
        dispatch({ type: "SET_PLAYING", playing: false });
      }}
      onAdvance={(v) => dispatch({ type: "SET_MONTH", monthIndex: v })}
      onStop={() => dispatch({ type: "SET_PLAYING", playing: false })}
      rangeOptions={RANGE_PRESETS.map((r) => ({
        months: r.months,
        label: r.label,
        active: state.range === r.months,
        onClick: () => dispatch({ type: "SET_RANGE", range: r.months }),
      }))}
      startLabel={monthLabelOf(dates[windowStart])}
      midLabel={monthLabelOf(dates[Math.round((windowStart + lastIdx) / 2)])}
      endLabel={monthLabelOf(dates[lastIdx])}
      monthLabel={monthLabelOf(dates[mi])}
    />
  );

  // ── pins + rail ──
  const pins = state.pinnedIds
    .map((id) => regions.find((r) => r.id === id))
    .filter(Boolean)
    .map((r) => {
      const sc = Math.round(scalars.scoreByRegion[r!.id] ?? 50);
      return {
        id: r!.id,
        name: titleCaseLocationName(r!.name),
        sub: `${scope.geoLevel} · ${r!.state}`,
        score: sc,
        scoreColor: getScoreColor(sc, 100),
        stats: buildDetailStats(series, r!.id, mi).slice(0, 4),
      };
    });

  const selScore = selected ? scalars.scoreByRegion[selected.id] : null;
  const selMetricSeries = selected
    ? metricSeriesFor(state.metric, series, selected.id)
    : [];
  const selChildPlural = CHILD_PLURAL[scope.geoLevel];
  const rail = selected && (
    <DetailRail
      name={titleCaseLocationName(selected.name)}
      sub={`${selected.state} · ${scope.geoLevel}${scope.geoLevel === "metro" ? ` · CBSA ${selected.id}` : ""}`}
      score={selScore}
      confidence={coverageConfidence(series, selected.id, mi, dates[lastIdx])}
      inherited={
        selScore == null && state.path.length > 0
          ? {
              sourceType: state.path[state.path.length - 1].level as any,
              sourceName: scopeName,
            }
          : null
      }
      stats={buildDetailStats(series, selected.id, mi)}
      metricLabel={metricCfg.label}
      metricValueNow={formatExplorerValue(
        selMetricSeries[mi] ?? null,
        metricCfg.format,
      )}
      railSpark={selMetricSeries.slice(windowStart)}
      railMarker={Math.max(0, mi - windowStart)}
      isPinned={state.pinnedIds.includes(selected.id)}
      onTogglePin={() =>
        dispatch({
          type: state.pinnedIds.includes(selected.id) ? "UNPIN" : "PIN",
          id: selected.id,
        })
      }
      hasDrill={scope.geoLevel !== "zip"}
      drillLabel={`Explore ${selChildPlural ?? "detail"} in ${titleCaseLocationName(selected.name)} ↓`}
      onDrill={() => onDrillEntity(selected.id)}
      onOpenDashboard={() => openDashboard(selected)}
    />
  );

  const heroTitle = `${scopeName ? `${scopeName} — ` : ""}${state.view === "map" ? `${metricCfg.label} state tile map` : `${metricCfg.label} across ${regions.length} ${unitPlural}`}`;
  const boardTitle = `Rankings — ${unitPlural} in ${scopeName ?? "U.S."}${metricCfg.betterHigh ? "" : " (lower is better)"}`;

  return (
    <main
      style={{
        width: "100%",
        maxWidth: 1600,
        margin: "0 auto",
        padding: "24px 32px 48px",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 26,
          fontWeight: 600,
          color: "var(--md-on-surface)",
        }}
      >
        Market Explorer
      </h1>
      <p
        style={{
          margin: "6px 0 16px",
          fontSize: 13,
          color: "var(--md-on-surface-variant)",
        }}
      >
        Drill from the whole country down to a single ZIP — click a market to
        inspect it, drag the timeline to travel through up to 10 years of
        history.
      </p>

      <GeoDrillBar crumbs={crumbs} levelTabs={levelTabs} />
      <div style={{ marginBottom: 16 }}>
        <MetricSwitcher
          active={state.metric}
          disabledIds={disabledMetricIds}
          onPick={(id) => dispatch({ type: "SET_METRIC", metric: id })}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <KpiStrip agg={agg} monthIndex={mi} windowStart={windowStart} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 360px",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            minWidth: 0,
          }}
        >
          <HeroVisualization
            title={heroTitle}
            hint={
              state.view === "map"
                ? ""
                : `Click a bubble to inspect · double-click to drill into its ${selChildPlural ?? "detail"} · size = active inventory`
            }
            view={state.view}
            onSetView={(v) => dispatch({ type: "SET_VIEW", view: v })}
            hasNearby={hasNearby}
            includeNearby={state.includeNearby}
            onToggleNearby={() => dispatch({ type: "TOGGLE_NEARBY" })}
            nearbyLabel={`${state.includeNearby ? "✓ Nearby " : "+ Nearby "}${unitPlural}`}
            chart={heroChart}
            scrubber={scrubber}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
              gap: 20,
            }}
          >
            <div
              style={{
                background: "var(--md-surface-container)",
                border: "1px solid var(--md-outline-variant)",
                borderRadius: 16,
                padding: "16px 18px",
              }}
            >
              {selected && (
                <ListingsActivityChart
                  title={`Listings activity — ${titleCaseLocationName(selected.name)}`}
                  newListings={series.new_listings?.[selected.id] ?? []}
                  pending={series.home_sales?.[selected.id] ?? []}
                  months={dates}
                  monthIndex={mi}
                />
              )}
            </div>
            <div
              style={{
                background: "var(--md-surface-container)",
                border: "1px solid var(--md-outline-variant)",
                borderRadius: 16,
                padding: "16px 18px",
              }}
            >
              <MomentumDonut scores={donutScores} unitPlural={unitPlural} />
            </div>
            <div
              style={{
                background: "var(--md-surface-container)",
                border: "1px solid var(--md-outline-variant)",
                borderRadius: 16,
                padding: "16px 18px",
              }}
            >
              <TopMoversList movers={movers} onSelect={onSelect} />
            </div>
          </div>

          <CompareStrip
            pins={pins}
            onUnpin={(id) => dispatch({ type: "UNPIN", id })}
            onClear={() => dispatch({ type: "CLEAR_PINS" })}
          />
          <Leaderboard
            title={boardTitle}
            monthLabel={monthLabelOf(dates[mi])}
            rows={rows}
            selectedId={state.selectedId}
            onSelect={onSelect}
          />
        </div>
        {rail}
      </div>
      {isLoading && (
        <div
          style={{
            padding: 12,
            fontSize: 12,
            color: "var(--md-on-surface-variant)",
          }}
        >
          Loading market data…
        </div>
      )}
    </main>
  );
}
```

Note: this file is close to the 400-line component limit. If it exceeds after formatting, split the left-column "charts row + compare + leaderboard" into a `MarketExplorerAnalytics.tsx` presentational sub-component (props already computed here) before committing.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run app/\(app\)/market/explorer/__tests__/MarketExplorer.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/explorer/MarketExplorer.tsx" "packages/frontend/app/(app)/market/explorer/__tests__/MarketExplorer.test.tsx"
git commit -m "feat(market-explorer): MarketExplorer orchestrator"
```

---

### Task 28: Replace `/market` landing with the Explorer + full-page verification + cleanup

**Files:**

- Modify: `packages/frontend/app/(app)/market/page.tsx` (render `MarketExplorer` instead of `MarketLanding`)
- Delete (after the import-guard in Step 1 confirms no other importers): `packages/frontend/app/(app)/market/MarketLanding.tsx`, `packages/frontend/app/(app)/market/MarketPageSkeleton.tsx`, `packages/frontend/app/(app)/market/TopMarketsSection.tsx`, `packages/frontend/app/(app)/market/recent-markets.ts`
- Keep untouched: `market/[id]/**`, `market/compare/**`, `market/components/**` (unrelated / separately owned).

**Interfaces:**

- Consumes: `MarketExplorer` (Task 27). No new exports.

- [ ] **Step 1: Guard — confirm the landing files are only used by `page.tsx`**

Run:

```bash
cd packages/frontend
rg -n "MarketLanding|MarketPageSkeleton|TopMarketsSection|recent-markets" app lib --glob '!**/market/MarketLanding.tsx' --glob '!**/market/page.tsx' --glob '!**/market/MarketPageSkeleton.tsx' --glob '!**/market/TopMarketsSection.tsx'
```

Expected: no matches outside the market landing files themselves. (`recent-markets` is also imported by `QuickActions`/other surfaces — if `rg` shows an importer elsewhere, DO NOT delete that file; only delete the files with zero external importers. Leaving an unused file is acceptable; deleting a still-used one is not.)

- [ ] **Step 2: Rewrite `page.tsx`**

```tsx
// packages/frontend/app/(app)/market/page.tsx
import MarketExplorer from "./explorer/MarketExplorer";

export default function MarketPage() {
  return <MarketExplorer />;
}
```

Then delete only the landing files confirmed unused in Step 1.

- [ ] **Step 3: Type-check, lint, and run the full new test set**

Run:

```bash
cd packages/backend && npx tsc -p tsconfig.json --noEmit && npx jest src/market-explorer
cd ../frontend && npx tsc --noEmit && npx vitest run app/\(app\)/market/explorer lib/data/fetchers/__tests__/market-explorer.test.ts
```

Expected: type-check clean, all market-explorer suites PASS.

- [ ] **Step 4: Full-page browser verification against real data (NOT a mock)**

Start both servers (`cd packages/backend && npm run start:dev`; `cd packages/frontend && npm run dev`), open `http://localhost:3000/market`, and confirm the golden path end-to-end:

1. National view loads ~40 metro bubbles; a metro is selected in the rail with a real score gauge + confidence stars.
2. Switch the metric chips through all 6 (Score, Hotness, Home Value YoY, Rent Yield, DOM, Months of Supply) — the y-axis, leaderboard, and rail update with **no refetch** (watch the Network tab: switching metric or scrubbing the timeline fires zero `/api/market-explorer` calls; only scope changes do).
3. Drag the timeline scrubber and press play — bubbles/KPIs/leaderboard/donut/movers animate; the month label advances.
4. Change the range presets (6M…10Y) — the window reslices with no refetch.
5. Double-click a metro bubble (or the rail's drill button) → drills to its counties; breadcrumb + level tabs update; drill again to ZIPs.
6. Click the "Map" view toggle → the US state tile map renders, colored by state avg score (Score aggregated from metros); click a state tile → drills into its metros.
7. Pin 2–3 markets → the compare strip appears; unpin works.
8. Click "Open full market dashboard →" → navigates to `/market/[id]?type=<level>&state=<abbr>`.
9. Confirm **Months of Supply** scrubs like the others (derived active÷pending). If Task 6's reconciliation flagged divergence, confirm the flat-line fallback annotation is shown instead.

Record screenshots of the national bubble view, a drilled county view, and the tile map in the PR. If anything fails to render (200 ≠ rendered), fix before proceeding — do not claim success on API status alone.

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/market/page.tsx"
git rm "packages/frontend/app/(app)/market/MarketLanding.tsx" "packages/frontend/app/(app)/market/MarketPageSkeleton.tsx" "packages/frontend/app/(app)/market/TopMarketsSection.tsx" 2>/dev/null || true
git commit -m "feat(market-explorer): replace /market landing with Market Explorer"
```

---

### Task 29: Geographic-adjacency Nearby overlay (port `nearbyEnts()`) + wiring

**Files:**

- Create: `packages/backend/src/market-explorer/us-tiles.ts`
- Create: `packages/backend/src/market-explorer/resolve-nearby-regions.ts`
- Test: `packages/backend/src/market-explorer/__tests__/resolve-nearby-regions.spec.ts`
- Modify: `packages/backend/src/market-explorer/resolve-child-regions.ts` (export the two helpers)
- Modify: `packages/backend/src/market-explorer/market-explorer.service.ts` (append nearby when `dto.includeNearby`)
- Modify: `packages/frontend/lib/data/fetchers/market-explorer.ts` (add `includeNearby` to `ScopeQuery`)
- Modify: `packages/frontend/app/(app)/market/explorer/lib/useExplorerScopeData.ts` (thread `includeNearby`)
- Modify: `packages/frontend/app/(app)/market/explorer/components/BubbleChart.tsx` (dim `nearby` bubbles)
- Test: `packages/frontend/app/(app)/market/explorer/components/__tests__/BubbleChart.test.tsx` (add a nearby-dimming case)

**Interfaces:**

- Consumes: `US_STATE_TILES` grid geometry (ported to backend), `stateAbbrByFips` (Task 5), `distinctCrosswalkIds`/`snapshotRoster` (Task 3, now exported), `ScopeRegion`.
- Produces:
  - `US_STATE_TILES: Record<string,[number,number]>` and `adjacentStateFips(fips: string): string[]` (Chebyshev distance ≤1 on the tile grid).
  - `resolveNearbyRegions(supabase, geoLevel, parentLevel, parentId): Promise<ScopeRegion[]>` — entities marked `nearby: true`, branching on scope exactly like the prototype's `nearbyEnts()`.

**Ported logic (prototype lines ~443–463):** state-scope (metros) → metros of tile-adjacent states; metro-scope (counties) → counties of sibling metros in the same state; county-scope (zips) → zips of sibling counties in the same metro.

- [ ] **Step 1: Write the failing backend test**

```typescript
// packages/backend/src/market-explorer/__tests__/resolve-nearby-regions.spec.ts
import { adjacentStateFips } from "../us-tiles";
import { resolveNearbyRegions } from "../resolve-nearby-regions";

describe("adjacentStateFips", () => {
  it("returns tile-adjacent states (TX → OK, LA) and excludes self/far states", () => {
    const adj = adjacentStateFips("48"); // Texas
    expect(adj).toContain("40"); // Oklahoma
    expect(adj).toContain("22"); // Louisiana
    expect(adj).not.toContain("48"); // not self
    expect(adj).not.toContain("36"); // New York is far
  });
});

/** Thenable crosswalk/snapshot mock. */
function makeSupabase(
  cbsaByState: Record<string, string[]>,
  roster: (ids: string[]) => any[],
) {
  return {
    from(table: string) {
      const st: any = {};
      const b: any = {
        select: () => b,
        eq: (c: string, v: string) => {
          st[c] = v;
          return b;
        },
        in: (_c: string, ids: string[]) => {
          st.ids = ids;
          return b;
        },
        not: () => b,
        limit: () => b,
        then: (res: any) => {
          const data =
            table === "geography_crosswalk"
              ? (cbsaByState[st.state_fips] ?? []).map((cbsa_code) => ({
                  cbsa_code,
                }))
              : roster(st.ids ?? []);
          return Promise.resolve({ data, error: null }).then(res);
        },
      };
      return b;
    },
  } as any;
}

describe("resolveNearbyRegions", () => {
  it("state scope → metros of adjacent states, marked nearby", async () => {
    const supabase = makeSupabase(
      { "40": ["11100"], "22": ["12940"] }, // OK / LA metros
      (ids) =>
        ids.map((id) => ({
          region_id: id,
          region_name: id,
          state_code: "XX",
          population: 500000,
        })),
    );
    const rows = await resolveNearbyRegions(supabase, "metro", "state", "48");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.nearby === true)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(
      expect.arrayContaining(["11100", "12940"]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/resolve-nearby-regions.spec.ts`
Expected: FAIL with "Cannot find module '../us-tiles'".

- [ ] **Step 3a: `us-tiles.ts`**

```typescript
// packages/backend/src/market-explorer/us-tiles.ts
import { stateAbbrByFips, stateFipsByAbbr } from "./us-states";

/** US state tile grid [col,row] — same geometry ported for the frontend tile map. */
export const US_STATE_TILES: Record<string, [number, number]> = {
  AK: [0, 0],
  ME: [11, 0],
  VT: [10, 1],
  NH: [11, 1],
  WA: [1, 2],
  ID: [2, 2],
  MT: [3, 2],
  ND: [4, 2],
  MN: [5, 2],
  WI: [6, 2],
  MI: [8, 2],
  NY: [9, 2],
  MA: [10, 2],
  RI: [11, 2],
  OR: [1, 3],
  NV: [2, 3],
  WY: [3, 3],
  SD: [4, 3],
  IA: [5, 3],
  IL: [6, 3],
  IN: [7, 3],
  OH: [8, 3],
  PA: [9, 3],
  NJ: [10, 3],
  CT: [11, 3],
  CA: [1, 4],
  UT: [2, 4],
  CO: [3, 4],
  NE: [4, 4],
  MO: [5, 4],
  KY: [6, 4],
  WV: [7, 4],
  VA: [8, 4],
  MD: [9, 4],
  DE: [10, 4],
  AZ: [2, 5],
  NM: [3, 5],
  KS: [4, 5],
  AR: [5, 5],
  TN: [6, 5],
  NC: [7, 5],
  SC: [8, 5],
  DC: [9, 5],
  OK: [3, 6],
  LA: [4, 6],
  MS: [5, 6],
  AL: [6, 6],
  GA: [7, 6],
  HI: [0, 7],
  TX: [3, 7],
  FL: [8, 7],
};

/** State FIPS codes whose tile is within one grid cell (Chebyshev ≤1) of `fips`. */
export function adjacentStateFips(fips: string): string[] {
  const abbr = stateAbbrByFips[fips];
  const t0 = abbr ? US_STATE_TILES[abbr] : undefined;
  if (!t0) return [];
  const out: string[] = [];
  for (const [a, [c, r]] of Object.entries(US_STATE_TILES)) {
    if (a === abbr) continue;
    if (Math.abs(c - t0[0]) <= 1 && Math.abs(r - t0[1]) <= 1) {
      const f = stateFipsByAbbr[a];
      if (f) out.push(f);
    }
  }
  return out;
}
```

- [ ] **Step 3b: Export the two helpers from `resolve-child-regions.ts`**

Change their declarations from `async function distinctCrosswalkIds(` / `async function snapshotRoster(` to `export async function distinctCrosswalkIds(` / `export async function snapshotRoster(` (no other change).

- [ ] **Step 3c: `resolve-nearby-regions.ts`**

```typescript
// packages/backend/src/market-explorer/resolve-nearby-regions.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { ScopeRegion } from "./market-explorer.types";
import { distinctCrosswalkIds, snapshotRoster } from "./resolve-child-regions";
import { adjacentStateFips } from "./us-tiles";

const uniq = (xs: string[]) => [...new Set(xs)];
const mark = (rows: ScopeRegion[]): ScopeRegion[] =>
  rows.map((r) => ({ ...r, nearby: true }));

async function lookupOne(
  supabase: SupabaseClient,
  selectCol: string,
  filterCol: string,
  val: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("geography_crosswalk")
    .select(selectCol)
    .eq(filterCol, val)
    .not(selectCol, "is", null)
    .limit(1);
  const row = (data ?? [])[0] as any;
  return row?.[selectCol] ?? null;
}

/** Same-level peers of the current scope, per the prototype's nearbyEnts() branching. */
export async function resolveNearbyRegions(
  supabase: SupabaseClient,
  geoLevel: string,
  parentLevel: string | undefined,
  parentId: string | undefined,
): Promise<ScopeRegion[]> {
  if (!parentLevel || !parentId) return [];

  // Drilled into a state (showing metros) → metros of tile-adjacent states.
  if (geoLevel === "metro" && parentLevel === "state") {
    const cbsas: string[] = [];
    for (const fips of adjacentStateFips(parentId)) {
      cbsas.push(
        ...(await distinctCrosswalkIds(
          supabase,
          "cbsa_code",
          "state_fips",
          fips,
        )),
      );
    }
    return mark(await snapshotRoster(supabase, "metro", uniq(cbsas)));
  }

  // Drilled into a metro (showing counties) → counties of sibling metros in the same state.
  if (geoLevel === "county" && parentLevel === "metro") {
    const stateFips = await lookupOne(
      supabase,
      "state_fips",
      "cbsa_code",
      parentId,
    );
    if (!stateFips) return [];
    const sibs = (
      await distinctCrosswalkIds(supabase, "cbsa_code", "state_fips", stateFips)
    ).filter((c) => c !== parentId);
    const counties: string[] = [];
    for (const c of sibs)
      counties.push(
        ...(await distinctCrosswalkIds(
          supabase,
          "county_fips",
          "cbsa_code",
          c,
        )),
      );
    return mark(await snapshotRoster(supabase, "county", uniq(counties)));
  }

  // Drilled into a county (showing zips) → zips of sibling counties in the same metro.
  if (geoLevel === "zip" && parentLevel === "county") {
    const cbsa = await lookupOne(
      supabase,
      "cbsa_code",
      "county_fips",
      parentId,
    );
    if (!cbsa) return [];
    const sibs = (
      await distinctCrosswalkIds(supabase, "county_fips", "cbsa_code", cbsa)
    ).filter((c) => c !== parentId);
    const zips: string[] = [];
    for (const c of sibs)
      zips.push(
        ...(await distinctCrosswalkIds(supabase, "zip_code", "county_fips", c)),
      );
    return mark(await snapshotRoster(supabase, "zip", uniq(zips)));
  }

  return [];
}
```

- [ ] **Step 3d: Append nearby in the service** (`market-explorer.service.ts`)

In the non-state branch of `getScopeSeries`, after resolving `regions`, union the nearby set (current regions win on id collision):

```typescript
regions = await resolveChildRegions(
  this.supabase,
  geoLevel,
  dto.parentLevel,
  dto.parentId,
  !!dto.includeNearby,
);
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
rows = await fetchMetricSeriesForRegions(
  this.supabase,
  dto.metric,
  geoLevel,
  regions.map((r) => r.id),
  startDate,
);
```

Add `import { resolveNearbyRegions } from './resolve-nearby-regions';` at the top.

- [ ] **Step 4: Run backend tests**

Run: `cd packages/backend && npx jest src/market-explorer/__tests__/resolve-nearby-regions.spec.ts && npx jest src/market-explorer`
Expected: PASS (new nearby suite + all existing market-explorer suites still green).

- [ ] **Step 5: Thread `includeNearby` through the frontend fetcher + hook**

In `lib/data/fetchers/market-explorer.ts`, add `includeNearby?: boolean` to `ScopeQuery` and send it only when true (so the backend never sees the `'false'`→true class-transformer trap):

```typescript
export interface ScopeQuery {
  parentLevel?: "state" | "metro" | "county";
  parentId?: string;
  metric: string;
  months: number;
  includeNearby?: boolean;
}
// inside fetchScopeSeries params:
    includeNearby: query.includeNearby ? "true" : undefined,
```

In `useExplorerScopeData.ts`, add the parameter and include it in every query key so toggling refetches:

```typescript
export function useExplorerScopeData(
  geoLevel: ScopeGeoLevel,
  parentLevel?: "state" | "metro" | "county",
  parentId?: string,
  includeNearby?: boolean,
) {
  const results = useQueries({
    queries: FETCHED_METRICS.map((metric) => ({
      queryKey: ["me-scope", geoLevel, parentLevel ?? null, parentId ?? null, metric, !!includeNearby],
      queryFn: () => fetchScopeSeries(geoLevel, { parentLevel, parentId, metric, months: MAX_MONTHS, includeNearby }),
      staleTime: 2 * 60 * 60 * 1000,
      gcTime: 2 * 60 * 60 * 1000,
    })),
  });
  // ...unchanged (merge + return)
```

- [ ] **Step 6: Dim `nearby` bubbles in `BubbleChart.tsx` (+ test)**

Extend `BubbleEntity` and apply the prototype's nearby styling. Change the `BubbleEntity` interface to `{ id: string; name: string; state: string; nearby?: boolean }`, then in the bubble render replace the `<circle>` opacity/stroke props with:

```tsx
          fillOpacity={sel ? 0.92 : e.nearby ? 0.38 : 0.68}
          stroke={sel ? "var(--md-on-surface)" : pinned ? "var(--md-on-surface-variant)" : color}
          strokeWidth={sel ? 2.5 : pinned ? 1.8 : 1}
          strokeDasharray={(pinned || e.nearby) && !sel ? "4 3" : "none"}
```

Add to `BubbleChart.test.tsx`:

```tsx
it("renders nearby entities dimmed", () => {
  const props = {
    ...base,
    entities: [{ id: "A", name: "Metro A", state: "TX", nearby: true }],
  };
  const { container } = render(
    <BubbleChart {...props} onSelect={() => {}} onDrill={() => {}} />,
  );
  const circle = container.querySelector("circle");
  expect(circle?.getAttribute("fill-opacity")).toBe("0.38");
});
```

(The orchestrator already passes `regions` — `ScopeRegion[]` which carries `nearby` — as `entities`, and already sets `hasNearby = !!scope.parentId` and forwards `includeNearby` to the hook per the Task 27 edits.)

- [ ] **Step 7: Run frontend tests + type-check**

Run:

```bash
cd packages/frontend && npx tsc --noEmit \
  && npx vitest run app/\(app\)/market/explorer/components/__tests__/BubbleChart.test.tsx lib/data/fetchers/__tests__/market-explorer.test.ts
```

Expected: type-check clean; BubbleChart (now 3 tests) + fetcher tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/market-explorer/us-tiles.ts packages/backend/src/market-explorer/resolve-nearby-regions.ts packages/backend/src/market-explorer/__tests__/resolve-nearby-regions.spec.ts packages/backend/src/market-explorer/resolve-child-regions.ts packages/backend/src/market-explorer/market-explorer.service.ts "packages/frontend/lib/data/fetchers/market-explorer.ts" "packages/frontend/app/(app)/market/explorer/lib/useExplorerScopeData.ts" "packages/frontend/app/(app)/market/explorer/components/BubbleChart.tsx" "packages/frontend/app/(app)/market/explorer/components/__tests__/BubbleChart.test.tsx"
git commit -m "feat(market-explorer): geographic-adjacency Nearby overlay (nearbyEnts port)"
```

---

## Self-Review

**1. Spec coverage** — every prototype feature maps to a task:

| Prototype feature                                                                                                                         | Task(s)                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Geo drill State→Metro→County→ZIP (breadcrumbs + level tabs)                                                                               | 3, 10 (`resolveScope`), 22, 27                                       |
| Two view modes (log bubble chart + US state tile map)                                                                                     | 13, 14, 25, 27                                                       |
| 6-metric switcher (Score/Hotness/HV-YoY/Rent-Yield/DOM/MoS)                                                                               | 8, 9, 23                                                             |
| 10-yr monthly scrub + play + range presets (index pre-fetched, no per-tick refetch)                                                       | 2, 11 (`MAX_MONTHS`, merge), 24, 27                                  |
| 5-KPI aggregate strip with sparklines                                                                                                     | 9 (`aggregateScopeKpis`), 12, 15                                     |
| Listings bar + momentum donut + top-movers                                                                                                | 16, 17, 18, 27                                                       |
| Pin-to-compare (≤3)                                                                                                                       | 10 (PIN cap), 20, 27                                                 |
| Ranked leaderboard w/ per-row sparklines                                                                                                  | 19, 26, 27                                                           |
| Sticky detail rail (ScoreGaugeRing + confidence + inherited + stats + trend + drill + CTA)                                                | 21, 26, 27                                                           |
| CTA → `/market/[id]` (existing `?type=&state=` convention)                                                                                | 27 (`openDashboard`)                                                 |
| Ported algorithms: `bubbleChart`, `tileMap`, `scopeAgg`, `spark`/`railSpark`, `scoreColor`, `drill`/`scopeEnt`/`childrenOf`, `togglePlay` | 9, 12–14, 24, 27                                                     |
| Replaces `MarketLanding.tsx`                                                                                                              | 28                                                                   |
| **State level via aggregation** (score has no state rows)                                                                                 | 5 (`me_state_score_series` RPC), 6                                   |
| **Months of Supply kept** (no native series)                                                                                              | Global Constraints + 9 (`deriveMonthsOfSupply`) + 6 (reconciliation) |
| Backend batch endpoint (one metric × many regions, aligned)                                                                               | 1–6, 7                                                               |
| `includeNearby` overlay — full `nearbyEnts()` port (tile-adjacent states' metros; sibling metros' counties; sibling counties' ZIPs)       | 29 (backend resolver + wiring), 27 (toggle)                          |

**2. Placeholder scan** — no `TBD`/`similar to Task N`/"add validation" placeholders; every code step contains complete, runnable code and every test step an exact command + expected result. The one data compromise (MoS derivation) is stated explicitly with concrete handling and a documented fallback, not deferred. The Nearby overlay is now fully implemented server-side (Task 29), including the tile-adjacency flavor.

**3. Type/signature consistency (checked):**

- `ScopeSeriesResponse`/`ScopeRegion` are identical in the backend (Task 1) and frontend fetcher (Task 7); the frontend never references a backend-only field.
- `SeriesByMetric = Record<metricId, Record<regionId, (number|null)[]>>` is used identically by the merge (Task 11), math (Task 9), and view-model (Task 26).
- `ExplorerState` shape (`path, selectedId, pinnedIds, metric, monthIndex, view, range, playing, includeNearby`) is defined once (Task 8) and consumed unchanged by the reducer (Task 10) and orchestrator (Task 27).
- Action names match across reducer (Task 10) and every `dispatch` in the orchestrator (Task 27): `SET_METRIC/SET_MONTH/SET_RANGE/SET_VIEW/SELECT/PIN/UNPIN/CLEAR_PINS/TOGGLE_PLAY/SET_PLAYING/TOGGLE_NEARBY/DRILL/NAVIGATE_CRUMB/RESET_NATIONAL`.
- `LeaderboardRow` (Task 19) is produced by `buildLeaderboardRows` (Task 26) with matching fields.
- `FETCHED_METRICS` (8 ids, Task 8) are the exact keys read by the batch fetch (Task 4/5), the merge (Task 11), aggregation (Task 9), and coverage confidence (Task 26).
- The 8 fetched metric ids all exist in `timeseries-metric-mapping.ts` (verified): `propertyiq_score, home_value, rent_index, for_sale_inventory, days_on_market, hotness_score, new_listings, home_sales`.
