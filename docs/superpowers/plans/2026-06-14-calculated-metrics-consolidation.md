# Calculated Metrics Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan touches a live production data pipeline — every phase ends with a real-DB verification gate (team rule: no mocks).

**Goal:** Restore the monthly `calculated_metrics` refresh by consolidating all generation onto the NestJS `CalculatedMetricsService`, fix the metro `cbsa_code` root cause at ingest, and restore full per-geo coverage (cap-rate family, months-of-supply, overvalued %) so the market screener (backlog #6) can be built on trustworthy data.

**Architecture:** A new headless CLI (`NestFactory.createApplicationContext`) invokes a single `refreshAllCalculatedMetrics()` orchestrator on the service; the broken GitHub Actions cron is repointed to it; the duplicate `scripts/calculations/{investment,valuation}*` modules are deleted; affordability scripts (no service equivalent) are kept and still invoked. The ingest is fixed so `zillow_metro.cbsa_code` is never born NULL. Months-of-supply is computed for all geos from the Realtor `active_listing_count / pending_listing_count` proxy; overvalued % gains county/zip paths.

**Tech Stack:** NestJS 11 (standalone application context), TypeScript, Supabase (Postgres), Vitest/Jest (backend unit tests), GitHub Actions (cron), `ts-node` for headless execution.

**Root cause reference:** `memory/reference_calculated-metrics-staggered-coverage.md` (RC-1 dead CI script `2bf168b6`; RC-2 lean replacement; RC-3 `cbsa_code` NULL `8ba07f65`; RC-4 metro MOS via fuzzy Redfin geoid; RC-5 no county/zip overvalued/5yr path; RC-0 two parallel impls).

---

## File Structure

**Create:**

- `packages/backend/src/scripts/refresh-calculated-metrics.ts` — headless CLI; boots app context, runs orchestrator, prints `TOTAL:` gate line.
- `scripts/sources/zillow/zillow-metro-cbsa-map.ts` — `buildCanonicalMetroCbsaMap()`; one-region-per-CBSA map ported from migration `20260613140100`.
- `packages/backend/src/metrics/__tests__/months-of-supply-proxy.spec.ts` — unit test for the MOS proxy.
- `packages/backend/src/metrics/__tests__/overvalued-geo.spec.ts` — unit test for the overvalued formula at county/zip.
- `scripts/sources/zillow/__tests__/zillow-metro-cbsa-map.spec.ts` — unit test for canonical-owner dedup.

**Modify:**

- `packages/backend/src/metrics/calculated-metrics.service.ts` — add Realtor MOS helper + wire into the 3 investment methods; add `calculateOvervaluedForCounties/Zips`; add `refreshAllCalculatedMetrics`; extend `calculateAllInvestmentMetrics`.
- `packages/backend/src/metrics/metrics.controller.ts:764-769` — flatten nested overvalued totals.
- `scripts/sources/zillow/import-zillow.ts` — stamp canonical `cbsa_code` on metro records before upsert.
- `.github/workflows/post-import-refresh.yml:63-84` — repoint to the new CLI + keep affordability runner.
- `scripts/calculations/calculated-metrics-runner.ts` — trim to affordability-only.

**Delete (true duplicates):**

- `scripts/calculations/investment-metrics.ts`, `scripts/calculations/valuation-metrics.ts`, `scripts/utils/refresh-calculated-metrics.ts`, `scripts/refresh-all-metrics.ts`, `scripts/run-refresh-calculated.ts`.

**Keep (NOT duplicates — no service equivalent):**

- `scripts/calculations/affordability-metrics.ts` (income_to_buy, affordable_home_price — needs FRED rate), `scripts/calculations/years-to-save-metrics.ts`, `scripts/calculations/metric-calculation-helpers.ts`.

---

## Phase 0: Pre-flight verification gates (no code; confirm assumptions before building)

### Task 0: Confirm prerequisites against the live DB

- [ ] **Step 1: Confirm the cbsa backfill migration actually ran** (out-of-order migrations are skipped silently)

Run (Supabase MCP `execute_sql`, project `pysflbhpnqwoczyuaaif`):

```sql
SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20260613140100';
```

Expected: one row. If absent, the migration never applied — flag before proceeding (the importer fix still stands, but existing months need the one-time backfill).

- [ ] **Step 2: Confirm county/zip income coverage exists** (gates overvalued county/zip — check row counts, not just schema)

Run:

```sql
SELECT geography_type, count(*) AS rows, count(median_income) AS has_income
FROM census_data
WHERE geography_type IN ('county','zip') AND metric_name = 'median_income'
GROUP BY geography_type;
```

(If `census_data` is not the income source the metro overvalued method reads, instead introspect the table used by `calculateOvervaluedForMetros` at `calculated-metrics.service.ts:1639-1763` and count income coverage for county/zip there.)
Expected: non-trivial coverage at both levels. If county/zip income is sparse, scope overvalued to the levels with data and note it in the run summary.

- [ ] **Step 3: Confirm Realtor MOS-proxy inputs** (already measured 2026-06-14, re-confirm at run time)

Run:

```sql
WITH m AS (SELECT max(period_date) d FROM realtor_metro)
SELECT count(*) rows, count(active_listing_count) active, count(pending_listing_count) pending
FROM realtor_metro WHERE period_date = (SELECT d FROM m);
```

Expected: active ≈ rows, pending ≥ ~95% of rows.

---

## Phase 1: Fix the `cbsa_code` root cause at ingest

### Task 1: Canonical metro→CBSA map helper (TDD)

**Files:**

- Create: `scripts/sources/zillow/zillow-metro-cbsa-map.ts`
- Test: `scripts/sources/zillow/__tests__/zillow-metro-cbsa-map.spec.ts`

- [ ] **Step 1: Write the failing test** (canonical-owner dedup: one region per CBSA, title-match wins, ties broken by lowest region_id)

```ts
import { describe, it, expect, vi } from "vitest";
import { buildCanonicalMetroCbsaMap } from "../zillow-metro-cbsa-map";

function fakeSupabase(rows: any[]) {
  return {
    from: () => ({
      select: () => ({
        not: () => ({
          range: (from: number) =>
            from === 0
              ? Promise.resolve({ data: rows, error: null })
              : Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  } as any;
}

describe("buildCanonicalMetroCbsaMap", () => {
  it("keeps one canonical region per CBSA (title match wins)", async () => {
    const rows = [
      {
        zillow_region_id: 200,
        zillow_region_name: "Helena, MT",
        cbsa_code: "25740",
        cbsa_title: "Helena, MT",
      },
      {
        zillow_region_id: 100,
        zillow_region_name: "Helena, AR",
        cbsa_code: "25740",
        cbsa_title: "Helena, MT",
      },
    ];
    const map = await buildCanonicalMetroCbsaMap(fakeSupabase(rows));
    expect(map.get(200)).toBe("25740"); // name matches title -> canonical
    expect(map.has(100)).toBe(false); // non-canonical -> absent (stays NULL)
  });

  it("breaks ties by lowest region_id when neither matches title", async () => {
    const rows = [
      {
        zillow_region_id: 900,
        zillow_region_name: "Aaa, XX",
        cbsa_code: "99999",
        cbsa_title: "Zzz, XX",
      },
      {
        zillow_region_id: 800,
        zillow_region_name: "Bbb, XX",
        cbsa_code: "99999",
        cbsa_title: "Zzz, XX",
      },
    ];
    const map = await buildCanonicalMetroCbsaMap(fakeSupabase(rows));
    expect(map.get(800)).toBe("99999");
    expect(map.has(900)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/sources/zillow/__tests__/zillow-metro-cbsa-map.spec.ts`
Expected: FAIL — `buildCanonicalMetroCbsaMap` not found.

- [ ] **Step 3: Write the implementation** (ports migration `20260613140100` canonical logic)

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Build the canonical region_id -> cbsa_code map from zillow_metro_crosswalk,
 * enforcing one canonical region per CBSA (mirrors migration
 * 20260613140100_fix_zillow_metro_cbsa_from_crosswalk.sql).
 * Canonical owner = region whose name matches the CBSA title
 * (cbsa_title ILIKE "<region name before comma>%"), ties broken by lowest
 * zillow_region_id. Non-canonical regions are absent so their cbsa_code stays NULL.
 */
export async function buildCanonicalMetroCbsaMap(
  supabase: SupabaseClient,
): Promise<Map<number, string>> {
  const rows: Array<{
    zillow_region_id: number;
    zillow_region_name: string | null;
    cbsa_code: string | null;
    cbsa_title: string | null;
  }> = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("zillow_metro_crosswalk")
      .select("zillow_region_id, zillow_region_name, cbsa_code, cbsa_title")
      .not("cbsa_code", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`crosswalk load failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  const titleMatchRank = (r: (typeof rows)[number]): number => {
    const namePrefix = (r.zillow_region_name ?? "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const title = (r.cbsa_title ?? "").toLowerCase();
    return namePrefix && title.startsWith(namePrefix) ? 0 : 1;
  };

  const bestByCbsa = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!r.cbsa_code) continue;
    const incumbent = bestByCbsa.get(r.cbsa_code);
    if (!incumbent) {
      bestByCbsa.set(r.cbsa_code, r);
      continue;
    }
    const a = titleMatchRank(r);
    const b = titleMatchRank(incumbent);
    if (a < b || (a === b && r.zillow_region_id < incumbent.zillow_region_id)) {
      bestByCbsa.set(r.cbsa_code, r);
    }
  }

  const map = new Map<number, string>();
  for (const [cbsa, owner] of bestByCbsa) map.set(owner.zillow_region_id, cbsa);
  return map;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/sources/zillow/__tests__/zillow-metro-cbsa-map.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/zillow/zillow-metro-cbsa-map.ts scripts/sources/zillow/__tests__/zillow-metro-cbsa-map.spec.ts
git commit -m "feat(ingest): canonical metro->cbsa map helper for zillow import"
```

### Task 2: Stamp `cbsa_code` on metro records during ingest

**Files:**

- Modify: `scripts/sources/zillow/import-zillow.ts` (import near line 30; insert between the empty-records guard at line 146 and `logger.updateProgress` at line 148, before `batchUpsert` at line 151)

- [ ] **Step 1: Add the import** at the top of `import-zillow.ts` (after the last existing import, ~line 30)

```ts
import { buildCanonicalMetroCbsaMap } from "./zillow-metro-cbsa-map";
```

- [ ] **Step 2: Insert the stamp block** immediately before the `batchUpsert` call (after `records` is built by `transposeAllRows`, ~line 147)

```ts
// Stamp canonical cbsa_code on every metro record from the crosswalk.
// Zillow metro CSVs do not reliably carry a CBSACode column, and the
// full-row upsert (scripts/lib/batch-upsert.ts) NULLs any column absent
// from the payload. Without this, every incremental run writes new-month
// metro rows with NULL cbsa_code, dropping them from cbsa_code-keyed
// joins/scoring (root cause of the 2026-02+ metro coverage collapse).
if (dataset.geography === "metro") {
  const cbsaByRegionId = await buildCanonicalMetroCbsaMap(supabase);
  let stamped = 0;
  let missing = 0;
  for (const rec of records) {
    const code = cbsaByRegionId.get(rec.region_id as number);
    if (code) {
      rec.cbsa_code = code;
      stamped++;
    } else {
      delete (rec as Record<string, unknown>).cbsa_code;
      missing++;
    }
  }
  console.log(
    `  CBSA stamp: ${stamped} mapped, ${missing} left NULL (non-canonical / not in crosswalk)`,
  );
}
```

(Verify exact line numbers at edit time — `region_id` is already a `number` per `zillow-csv-transformer.ts:195`. If `records`/`supabase`/`dataset.geography` identifiers differ in scope, adapt to the actual names in `importSingleDataset`.)

- [ ] **Step 3: Type-check**

Run: `cd packages/frontend && npx tsc --noEmit -p ../../tsconfig.json` is NOT applicable; instead transpile-check the script:
Run: `npx tsc --noEmit scripts/sources/zillow/import-zillow.ts 2>&1 | head -20` (or the repo's script lint). Expected: no new errors referencing the stamp block.

- [ ] **Step 4: Commit**

```bash
git add scripts/sources/zillow/import-zillow.ts
git commit -m "fix(ingest): stamp canonical cbsa_code on zillow_metro to stop NULL-on-new-month regression"
```

### Task 3: Verify the importer fix path (gate)

- [ ] **Step 1:** If migration `20260613140100` did NOT apply (Task 0 Step 1), apply the one-time backfill via Supabase migration before continuing, then re-run Task 0 Step 1.

- [ ] **Step 2: Baseline the current NULL state** (so the next ingest can be compared)

```sql
SELECT period_date, count(*) total,
       count(*) FILTER (WHERE cbsa_code IS NULL) null_cbsa
FROM zillow_metro
WHERE period_date >= (CURRENT_DATE - INTERVAL '6 months')
GROUP BY period_date ORDER BY period_date DESC;
```

Record the result. The real proof that the importer fix works lands in Phase 4 after the next ingest (or a manual `import-zillow.ts metro` run): new-month `null_cbsa` must be 0.

---

## Phase 2: NestJS service additions

### Task 4: Months-of-supply Realtor proxy (TDD) + wire into investment methods

**Files:**

- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts` (add a `fetchRealtorMosByRegion` helper; call it in `calculateInvestmentMetricsForMetros` ~1193, `...ForCounties` ~1856, `...ForZips` ~2292; add `months_of_supply` + `absorption_rate` to each upsert payload and column list)
- Test: `packages/backend/src/metrics/__tests__/months-of-supply-proxy.spec.ts`

- [ ] **Step 1: Write the failing test** for the proxy math (uses the existing pure methods at `:111` and `:124`)

```ts
import { CalculatedMetricsService } from "../calculated-metrics.service";

describe("months-of-supply Realtor proxy", () => {
  const svc = new CalculatedMetricsService({} as any); // supabase unused for pure math

  it("computes MOS = active / pending", () => {
    expect(svc.calculateMonthsOfSupply(600, 200)).toBeCloseTo(3.0);
  });
  it("returns null when pending is missing or zero", () => {
    expect(svc.calculateMonthsOfSupply(600, 0)).toBeNull();
    expect(svc.calculateMonthsOfSupply(600, undefined)).toBeNull();
  });
  it("absorption is the reciprocal percentage", () => {
    expect(svc.calculateAbsorptionRate(200, 600)).toBeCloseTo(33.33, 1);
  });
});
```

- [ ] **Step 2: Run to verify it fails/passes appropriately**

Run: `cd packages/backend && npx jest months-of-supply-proxy`
Expected: PASS for the math (methods already exist) — this test pins the proxy contract before wiring. If the constructor signature differs, instantiate via the test module pattern used in sibling specs.

- [ ] **Step 3: Add the shared fetch helper** to `calculated-metrics.service.ts` (place near the other private fetch helpers). It returns active+pending per region for a geo level at the latest Realtor period.

```ts
  /**
   * Months-of-supply proxy inputs from Realtor: active_listing_count and
   * pending_listing_count (pending used as the monthly-sales proxy, since
   * Realtor has no closed-sales column). Returns Map<regionId, {active, pending}>.
   * geoLevel: 'metro' -> realtor_metro keyed by cbsa_code;
   *           'county' -> realtor_county keyed by county_fips;
   *           'zip'    -> realtor_zip keyed by postal_code.
   */
  private async fetchRealtorMosInputs(
    geoLevel: "metro" | "county" | "zip",
  ): Promise<Map<string, { active: number; pending: number }>> {
    const table = `realtor_${geoLevel}`;
    const idCol = geoLevel === "metro" ? "cbsa_code"
      : geoLevel === "county" ? "county_fips" : "postal_code";
    const { data: latest } = await this.supabase
      .from(table).select("period_date").order("period_date", { ascending: false }).limit(1).maybeSingle();
    const out = new Map<string, { active: number; pending: number }>();
    if (!latest?.period_date) return out;
    let from = 0; const page = 1000;
    while (true) {
      const { data, error } = await this.supabase
        .from(table)
        .select(`${idCol}, active_listing_count, pending_listing_count`)
        .eq("period_date", latest.period_date)
        .range(from, from + page - 1);
      if (error) throw new Error(`${table} MOS inputs failed: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const r of data as any[]) {
        const id = r[idCol]; if (!id) continue;
        out.set(String(id), {
          active: Number(r.active_listing_count),
          pending: Number(r.pending_listing_count),
        });
      }
      if (data.length < page) break; from += page;
    }
    return out;
  }
```

- [ ] **Step 4: Wire MOS into each investment method.** In `calculateInvestmentMetricsForMetros`, `...ForCounties`, `...ForZips`: before the per-region loop, fetch the proxy map for that geo level; inside each push (both the ZORI-path push and the HUD-FMR fallback push the architect identified), add the two fields. Exact change per method:

In each method, after the existing input fetches add:

```ts
const mosInputs = await this.fetchRealtorMosInputs(GEO); // GEO = 'metro' | 'county' | 'zip'
```

In each `records.push({ ... })` for that method, add these fields (use the region's join id — `cbsaCode` for metro, `fips`/`county_fips` for county, `postal`/`region_name` for zip — matching how price is looked up in that method):

```ts
      months_of_supply: (() => { const m = mosInputs.get(String(JOIN_ID)); return m ? this.calculateMonthsOfSupply(m.active, m.pending) : null; })(),
      absorption_rate:  (() => { const m = mosInputs.get(String(JOIN_ID)); return m ? this.calculateAbsorptionRate(m.pending, m.active) : null; })(),
```

Add `'months_of_supply'` and `'absorption_rate'` to the upsert column list used by these methods (the architect noted the column-list array; mirror the existing `'cap_rate'` entry).

- [ ] **Step 5: Run the proxy test + backend build**

Run: `cd packages/backend && npx jest months-of-supply-proxy && npx tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/metrics/calculated-metrics.service.ts packages/backend/src/metrics/__tests__/months-of-supply-proxy.spec.ts
git commit -m "feat(metrics): compute months_of_supply for all geos via Realtor active/pending proxy"
```

### Task 5: Overvalued % at county and zip (TDD)

**Files:**

- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts` (add `calculateOvervaluedForCounties` and `calculateOvervaluedForZips` after `calculateOvervaluedForMetros` at line 1763, mirroring it)
- Test: `packages/backend/src/metrics/__tests__/overvalued-geo.spec.ts`

- [ ] **Step 1: Write the failing test** for the formula (price/income vs 3.5 benchmark, the same math as metro)

```ts
import { CalculatedMetricsService } from "../calculated-metrics.service";

describe("overvalued % formula (geo-agnostic)", () => {
  const svc = new CalculatedMetricsService({} as any);
  it("0% when price/income == benchmark (3.5)", () => {
    // 350000 / 100000 = 3.5 -> 0% over benchmark
    expect(svc.calculateOvervalued(350000, 100000)).toBeCloseTo(0, 5);
  });
  it("positive when above benchmark", () => {
    expect(svc.calculateOvervalued(525000, 100000)).toBeCloseTo(50, 5); // 5.25/3.5 -1 = +50%
  });
  it("null on missing/zero income", () => {
    expect(svc.calculateOvervalued(350000, 0)).toBeNull();
  });
});
```

(If `calculateOvervalued` is currently private/inline in the metro method, extract it to a pure method first so it is testable and reused by all three geo methods — DRY.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && npx jest overvalued-geo`
Expected: FAIL — `calculateOvervalued` not exported as a callable method.

- [ ] **Step 3: Implement.** Extract the shared formula to a pure method:

```ts
  calculateOvervalued(price?: number, income?: number): number | null {
    const BENCHMARK = 3.5;
    if (!price || !income || income === 0) return null;
    return ((price / income - BENCHMARK) / BENCHMARK) * 100;
  }
```

Then add `calculateOvervaluedForCounties()` and `calculateOvervaluedForZips()` by **mirroring `calculateOvervaluedForMetros` (lines 1639-1763)** with exactly these substitutions:

- ZHVI source: `zillow_metro` → `zillow_county` / `zillow_zip`.
- Income source: the metro income table/view → the county/zip equivalent confirmed in Task 0 Step 2.
- Join key: `cbsa_code` → `county_fips` (county) / `postal_code` (zip).
- `geography_type`: `'metro'` → `'county'` / `'zip'`.
- **Latest period only** (do NOT loop full history — the row-by-row `upsertOvervalued` is O(rows) and 34k ZIPs over history is prohibitive; we never bulk-recompute history). Restrict the ZHVI date selection to the single latest date.
- Reuse the extracted `this.calculateOvervalued(price, income)` for the math.

- [ ] **Step 4: Run test + build**

Run: `cd packages/backend && npx jest overvalued-geo && npx tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/metrics/calculated-metrics.service.ts packages/backend/src/metrics/__tests__/overvalued-geo.spec.ts
git commit -m "feat(metrics): add overvalued_pct for county and zip (latest period)"
```

### Task 6: Single orchestrator + controller totals shim

**Files:**

- Modify: `packages/backend/src/metrics/calculated-metrics.service.ts` (add `refreshAllCalculatedMetrics`; extend `calculateAllInvestmentMetrics` at 2745-2773 to include county/zip overvalued)
- Modify: `packages/backend/src/metrics/metrics.controller.ts:764-769` (flatten nested overvalued totals)

- [ ] **Step 1: Add the orchestrator** after `calculateAllInvestmentMetrics` (~line 2773). Runs everything the cron must produce; returns a summary; latest-period semantics inherited from the methods.

```ts
  /**
   * Single entry point for the monthly calculated_metrics refresh.
   * Investment (incl. months_of_supply) + overvalued for all geos + 5yr growth.
   * Affordability metrics (income_to_buy/affordable_home_price/years_to_save)
   * are produced separately by scripts/calculations (FRED-dependent) and are
   * NOT part of this method.
   */
  async refreshAllCalculatedMetrics(year?: number): Promise<{
    investment: any; overvalued: { metro: any; county: any; zip: any }; growth: any;
  }> {
    const investment = await this.calculateAllInvestmentMetrics(year); // metros/counties/zips incl MOS
    const overvalued = {
      metro: await this.calculateOvervaluedForMetros(year),
      county: await this.calculateOvervaluedForCounties(),
      zip: await this.calculateOvervaluedForZips(),
    };
    const growth = await this.calculate5YrGrowthForAll(year);
    return { investment, overvalued, growth };
  }
```

(If `calculateAllInvestmentMetrics` already calls `calculateOvervaluedForMetros` internally, drop the duplicate metro call here to avoid double work — verify at edit time.)

- [ ] **Step 2: Extend `calculateAllInvestmentMetrics` (2745-2773)** so its returned `overvalued` is `{ metro, county, zip }` (add the two new calls), OR leave it metro-only and let the orchestrator own county/zip (pick one; keep the controller shim consistent with the choice).

- [ ] **Step 3: Fix the controller totals** at `metrics.controller.ts:764-769` to handle the nested overvalued shape:

```ts
      totals: {
        processed:
          results.investmentMetrics.processed +
          results.overvalued.metro.processed +
          (results.overvalued.county?.processed ?? 0) +
          (results.overvalued.zip?.processed ?? 0),
        stored:
          results.investmentMetrics.stored +
          results.overvalued.metro.stored +
          (results.overvalued.county?.stored ?? 0) +
          (results.overvalued.zip?.stored ?? 0),
      },
```

- [ ] **Step 4: Build**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/metrics/calculated-metrics.service.ts packages/backend/src/metrics/metrics.controller.ts
git commit -m "feat(metrics): refreshAllCalculatedMetrics orchestrator + controller totals"
```

---

## Phase 3: Headless CLI, cron repoint, and deletions

### Task 7: Headless refresh CLI

**Files:**

- Create: `packages/backend/src/scripts/refresh-calculated-metrics.ts` (model on `populate-outcomes.ts:49` / `backfill-historical-scores.ts:94`)

- [ ] **Step 1: Write the CLI**

```ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { CalculatedMetricsService } from "../metrics/calculated-metrics.service";

async function main() {
  const start = Date.now();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const svc = app.get(CalculatedMetricsService);
    const yearArg = process.argv.find((a) => a.startsWith("--year="));
    const year = yearArg ? Number(yearArg.split("=")[1]) : undefined;

    const res = await svc.refreshAllCalculatedMetrics(year);
    const stored =
      (res.investment?.stored ?? 0) +
      (res.overvalued?.metro?.stored ?? 0) +
      (res.overvalued?.county?.stored ?? 0) +
      (res.overvalued?.zip?.stored ?? 0) +
      (res.growth?.stored ?? 0);
    // CI success gate greps for "TOTAL:"
    console.log(
      `TOTAL: ${stored} calculated_metrics rows stored in ${((Date.now() - start) / 1000).toFixed(1)}s`,
    );
    await app.close();
    process.exit(0);
  } catch (err) {
    console.error("[FATAL] calculated metrics refresh failed:", err);
    await app.close();
    process.exit(1);
  }
}

void main();
```

- [ ] **Step 2: Smoke-test compilation**

Run: `npx ts-node -P packages/backend/tsconfig.json --transpile-only -e "require('./packages/backend/src/scripts/refresh-calculated-metrics.ts')" 2>&1 | head -5`
(Or simply `npx tsc --noEmit -p packages/backend/tsconfig.json`.) Expected: compiles; do not execute the full refresh yet (that's Phase 4).

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/scripts/refresh-calculated-metrics.ts
git commit -m "feat(metrics): headless CLI to run the calculated-metrics refresh from cron"
```

### Task 8: Repoint the cron workflow

**Files:**

- Modify: `.github/workflows/post-import-refresh.yml:63-84`

- [ ] **Step 1: Replace the step body** (lines 63-84) with:

```yaml
run: |
  echo "=============================================="
  echo "Refreshing Calculated Metrics - $(date)"
  echo "Trigger: ${{ github.event.inputs.trigger_source || 'scheduled' }}"
  echo "=============================================="

  echo ""
  echo ">>> Running NestJS calculated metrics refresh..."
  npx ts-node -P packages/backend/tsconfig.json \
    packages/backend/src/scripts/refresh-calculated-metrics.ts \
    2>&1 | tee metrics-output.txt

  echo ""
  echo ">>> Running affordability metrics (income_to_buy, affordable_home_price, years_to_save)..."
  npx tsx scripts/calculations/calculated-metrics-runner.ts 2>&1 | tee -a metrics-output.txt

  if grep -q "TOTAL:" metrics-output.txt && ! grep -q "\[FATAL\]" metrics-output.txt; then
    echo "metrics_status=success" >> $GITHUB_OUTPUT
  else
    echo "metrics_status=error" >> $GITHUB_OUTPUT
  fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/post-import-refresh.yml
git commit -m "fix(ci): repoint calculated-metrics cron to NestJS refresh; keep affordability runner"
```

### Task 9: Trim the affordability runner, then delete duplicate scripts

**Files:**

- Modify: `scripts/calculations/calculated-metrics-runner.ts` (remove `runInvestmentMetrics` + `runValuationMetrics` imports/calls; keep only `runIncomeToBuyMetrics`, `runAffordableHomePriceMetrics`, `runYearsToSaveMetrics`; update its result type)
- Delete: the five duplicate files listed in File Structure.

- [ ] **Step 1: Trim the runner** — leave only the affordability calls in `refreshCalculatedMetrics()`. This MUST happen before deleting `investment-metrics.ts`/`valuation-metrics.ts` (the runner imports them).

- [ ] **Step 2: Delete the true duplicates**

```bash
git rm scripts/calculations/investment-metrics.ts \
       scripts/calculations/valuation-metrics.ts \
       scripts/utils/refresh-calculated-metrics.ts \
       scripts/refresh-all-metrics.ts \
       scripts/run-refresh-calculated.ts
```

- [ ] **Step 3: Grep for any remaining references** to the deleted files (and the long-dead `populate-calculated-metrics.ts`)

Run: `git grep -n "populate-calculated-metrics\|refresh-all-metrics\|run-refresh-calculated\|utils/refresh-calculated-metrics\|calculations/investment-metrics\|calculations/valuation-metrics"`
Expected: only the affordability runner's own (now-removed) lines should have existed; resolve any stragglers (e.g. `scripts/ensure-calculated-metrics-populated.ts` still references the dead populate script — update or delete it).

- [ ] **Step 4: Commit**

```bash
git add -A scripts/
git commit -m "refactor(metrics): remove duplicate script-layer calc; keep affordability runner only"
```

---

## Phase 4: Execute the refresh and verify against the live DB (E2E gates)

### Task 10: Run the consolidated refresh

- [ ] **Step 1: Run the new CLI locally against the real DB** (requires `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` in the backend env). Start with `--year=2026` to bound work.

Run: `npx ts-node -P packages/backend/tsconfig.json packages/backend/src/scripts/refresh-calculated-metrics.ts --year=2026`
Expected: ends with a `TOTAL: <n> ... stored` line, exit 0, no `[FATAL]`.

- [ ] **Step 2: (If a fresh metro ingest is feasible) run `import-zillow.ts` for metro** to prove the cbsa stamp works on a real import; otherwise rely on the existing backfill + the Phase 1 baseline.

### Task 11: Coverage verification gates (must pass before declaring done)

- [ ] **Step 1: cap_rate / months_of_supply / overvalued coverage at the latest period, all geos**

```sql
WITH latest AS (
  SELECT geography_type, max(period_date) d FROM calculated_metrics
  WHERE geography_type IN ('metro','county','zip') GROUP BY geography_type
)
SELECT c.geography_type, l.d AS latest,
       count(*) rows,
       count(cap_rate) cap_rate,
       count(months_of_supply) mos,
       count(overvalued_pct) overvalued
FROM calculated_metrics c JOIN latest l
  ON c.geography_type=l.geography_type AND c.period_date=l.d
GROUP BY c.geography_type, l.d ORDER BY c.geography_type;
```

Expected (directional, vs the broken baseline of metro MOS ~92 / metro cap_rate 0 / county+zip overvalued 0):

- **metro**: months_of_supply ≈ Realtor metro coverage (~900+, NOT ~92); cap_rate > 0 (no longer 0).
- **county / zip**: overvalued_pct > 0 (was 0); months_of_supply still strong; cap_rate ≥ prior coverage.

- [ ] **Step 2: cbsa NULL regression guard** (proves Phase 1)

```sql
WITH latest AS (SELECT max(period_date) d FROM zillow_metro)
SELECT count(*) AS null_cbsa_in_latest
FROM zillow_metro z JOIN latest l ON z.period_date=l.d
JOIN zillow_metro_crosswalk x ON x.zillow_region_id=z.region_id
WHERE z.cbsa_code IS NULL;
```

Expected: 0 (only after a post-fix ingest; otherwise note "pending next ingest").

- [ ] **Step 3: No-regression on affordability** (the kept scripts still populate these)

```sql
WITH latest AS (SELECT geography_type, max(period_date) d FROM calculated_metrics GROUP BY geography_type)
SELECT c.geography_type, count(income_to_buy) itb, count(affordable_home_price) ahp, count(years_to_save) yts
FROM calculated_metrics c JOIN latest l ON c.geography_type=l.geography_type AND c.period_date=l.d
WHERE c.geography_type IN ('metro','county','zip')
GROUP BY c.geography_type;
```

Expected: non-zero where they were non-zero before (affordability not regressed by the deletions).

### Task 12: Final commit + summary

- [ ] **Step 1:** Record the before/after coverage numbers in the plan's review section.
- [ ] **Step 2: Commit** any verification notes; do NOT push (user pushes manually — `memory/feedback_default-branch-develop`).

---

## Self-Review

- **Spec coverage:** RC-1 (Task 7/8), RC-2 (Task 4/5 restore coverage + fallbacks preserved by keeping the bulk methods), RC-3 (Task 1/2/3 + Task 11 Step 2), RC-4 metro MOS (Task 4 Realtor proxy + retire Redfin reliance), RC-5 county/zip overvalued (Task 5) + 5yr growth all-geo already in service via `calculate5YrGrowthForAll` (Task 6 orchestrator), RC-0 single orchestrator + deletions (Task 6/9). Affordability non-regression (Task 8 keep + Task 11 Step 3).
- **Open follow-ups (explicitly out of scope, tracked):** (a) port affordability/years-to-save into the service to finish full consolidation; (b) sibling cbsa/fips NULL bugs in `zillow_county.fips_code`, `zillow_zip.county_fips`, `realtor_county.cbsa_code`, `redfin_county.fips_code` (same defect class — same stamp pattern); (c) retire the Redfin MOS hook for county/zip once the Realtor proxy is confirmed at those levels; (d) `home_value_5yr_cagr` column stores true CAGR via the service now — confirm no consumer expected the old simple-% script value.
- **Placeholder scan:** none — formulas, column names, join keys, and SQL gates are explicit; the two in-method edits (MOS fields, overvalued mirror) name exact substitutions and the executor reads the immediate method.
- **Type consistency:** `refreshAllCalculatedMetrics` return shape matches the CLI's `stored` summation and the controller totals shim (`overvalued.{metro,county,zip}`); `calculateMonthsOfSupply`/`calculateAbsorptionRate`/`calculateOvervalued` are the exact existing/extracted method names.

---

## EXECUTION OUTCOME (2026-06-14 → 06-15)

**Status: data fix DONE + verified live; screener (backend + frontend) DONE + verified live in a browser. All on `develop`.**

### What shipped (do NOT redo)

- **calculated_metrics consolidation** — cron repointed to a NestJS headless CLI (`packages/backend/src/scripts/refresh-calculated-metrics.ts` → `CalculatedMetricsService.refreshAllCalculatedMetrics`), MOS via Realtor `active/pending` proxy (latest-period only, never clobbers Redfin), overvalued % added for county/zip (latest-period, non-clobber batched upsert), cbsa fixed at ingest (`scripts/sources/zillow/zillow-metro-cbsa-map.ts` contains-in-title rule + stamp in `import-zillow.ts`). Affordability still produced by the kept `scripts/calculations/calculated-metrics-runner.ts` (FRED-dependent).
- **Two bugs found ONLY by the live run** (tsc/unit passed): (1) `absorption_rate` column never existed though the code wrote it → every latest-period batch 400'd → silently blocked the MOS/cap_rate write. Fixed via migration `20260614233816_add_absorption_rate_to_calculated_metrics.sql`. (2) overvalued ZHVI/income fetches used 2000/5000-row `.range()` windows but **PostgREST caps reads at ~1000** → loop broke after one page → capped at exactly 1000. Fixed to 1000-row windows.
- **Verified coverage @2026-04-30** (66,339 rows, 0 errors): metro cap_rate **0→865**, MOS **92→871**; county overvalued **0→3,072**, MOS 2,955, cap_rate 1,907; zip overvalued **0→26,275**, MOS 24,788, cap_rate 8,312. cbsa backfill was a no-op (data already canonical). Investment `.range` windows audited — NOT capped (cap_rate tracks ZORI coverage).
- **Screener** — `screener_snapshot` table + `refresh_screener_snapshot()` SQL fn (migrations `20260615111801/02`, 33,566 rows); `GET /api/screener/:geo` (`packages/backend/src/screener/`, filters/sort/pagination, allowlisted sort, validated); frontend `/screener` (`packages/frontend/app/(app)/screener/`) — ranked table, geo control, 3 preset chips, range filters, **state selector**, URL-shareable state, CSV + ZIP tier gating. Verified live in a real browser: 50 rows render with correct formatting/score-colors; ZIP shows "ZIP Code Data Requires Pro" lock for free users; CSV button locked for free. Vitest covers the filter-summary helper (6/6).

### CRITICAL context for any follow-up session

- Supabase project id `pysflbhpnqwoczyuaaif` (use `mcp__plugin_supabase_supabase__execute_sql`). Memories: `reference_calculated-metrics-staggered-coverage` (RESOLVED), `reference_supabase-1000-row-read-cap`.
- **PostgREST caps reads at ~1000 rows** → always paginate supabase-js `.range()` in 1000-row windows (`.range(off, off+999)`, break on `<1000`). Raw SQL / the SQL fn is exempt.
- **A parallel `piq-validation` session is active on `develop`** — it auto-commits/pushes and currently has **uncommitted** `scripts/import-realtor-data.ts` + `scripts/sources/realtor/import-realtor.ts`. Stage ONLY your own files (`git -C <repo> add <explicit paths>`), never `git add -A`. develop is auto-synced (push often "Everything up-to-date").
- **Playwright MCP is disconnected** → verify UI with a temp `@playwright/test` headless chromium script + `Read` the screenshot. Frontend tests run on **vitest** (not jest). Delete temp scripts after.
- Refresh CLI: `npx ts-node -P packages/backend/tsconfig.json packages/backend/src/scripts/refresh-calculated-metrics.ts --year=2026` (loads `packages/backend/.env.local`). Frontend: `npm run dev:fresh`. Verify branch before commit; user pushes.

---

## SESSION UPDATE 2026-06-15 (cont.) — A, B, D + map-layer wiring SHIPPED

**Done + committed on `develop` (live-verified, no mocks):**

- **A. Row-stagger animation** — added `screener-row-in` keyframe + `.animate-screener-row` (reduced-motion safe) in `globals.css`; the rows already set `animationDelay` but had no keyframe. Commit `bb8adede`.
- **B. home_value / rent columns** — new migration `20260615162207_screener_snapshot_home_value_rent.sql`: `refresh_screener_snapshot()` now LEFT JOINs latest ZHVI→`home_value` + ZORI→`rent` (metro=cbsa, county=fips, zip=region_name); inline `SET statement_timeout='600s'` so CREATE OR REPLACE keeps the relax. Screener table gained a **Rent** column (exact `$` via `formatMetricValue(...,'number')`, not the `$K` bucket); CSV gained Rent. Verified live: home_value ≈ median_price (so NOT surfaced as a dup column), rent coverage metro 755 / county 1,413 / zip 8,897. Browser-verified Rent renders ("$1,185"). Commit `bb8adede`.
- **MAP-LAYER WIRING (extra, user-requested)** — MoS + county/zip overvalued existed in `calculated_metrics` + investment-bundle + screener but were NOT selectable map metrics. Added: backend `getInvestmentMetricsForMap` accepts `months_of_supply`/`absorption_rate`; new pre-calc endpoints `months-of-supply/{metros,counties,zips}` + `overvalued/{counties,zips}`; registry `months_of_supply` (index_1dec, all geos, no timeseries) + `overvalued_pct` → all geos; added to Demand & Risk + Market Competition categories + a metric definition. Verified live: all 5 endpoints return real data; MoS selectable on the map (entitlement modal titled "Unlock Months of Supply" confirms registry integration). Commit `c5d6e1c8`.
- **D. Affordability port** — `income_to_buy` / `affordable_home_price` / `years_to_save` ported INTO `CalculatedMetricsService` (faithful), wired into `refreshAllCalculatedMetrics`, FRED rate fetched once (optional — warns + uses default rate if key absent, no fallback _key_ per §1.2). CLI counts affordability; workflow drops the separate runner step. Verified live: itb 32,438 / ahp 38,238 / yts 32,242 stored, 0 errors (national/state yts gaps are pre-existing script quirks, faithfully preserved). Commit `42f52170`.

**REMAINING: E (service split) + C (dead-script delete — now has a NEW complication):**

- **C complication (resolve before deleting):** the parallel session committed `60aaa8f7` which **repoints `scripts/import-realtor-data.ts` → `calculated-metrics-runner.ts`** (the affordability runner). So the runner + `affordability-metrics.ts` + `years-to-save-metrics.ts` are NOT dead — they are now the affordability path for the LOCAL realtor-import flow, while the CI cron computes affordability via the service (Task D). Two affordability paths now exist. Deleting the runner/scripts (original Task 9 / D cleanup) would break `import-realtor-data.ts`. Also `scripts/refresh-all-metrics.ts` is still called by `import-all-non-zillow.ts`. **Decision needed:** either (a) also consolidate the local import flow onto the backend CLI (then delete runner + affordability scripts), or (b) keep the runner for local imports and only delete the truly-unreferenced files (`investment-metrics.ts`, `valuation-metrics.ts`, the `utils/refresh-calculated-metrics.ts` shim + its `run-refresh-calculated.ts` consumer, `ensure-calculated-metrics-populated.ts`) after updating `import-all-non-zillow.ts`/`refresh-all-metrics.ts`.
- **E** remains a large ATOMIC refactor (now ~3,929 lines incl. affordability): extract investment + valuation (+ affordability) calculators behind the facade, preserve exact behavior (MOS latest-period gating, overvalued non-clobber + 1000-row pagination, absorption_rate, HUD fallbacks), then re-run the refresh CLI + re-check coverage.

---

## REMAINING WORK (next session — suggested order: A+B → D → E → C)

### A. Frontend polish — row-stagger animation (small, low risk)

`packages/frontend/app/(app)/screener/components/ScreenerTable.tsx`: each `<tr>` sets `style={{ animationDelay }}` (capped 300ms) but has **no paired keyframe / `animate-*` class** → no visible entrance. Add a fade-in-up keyframe (reuse an existing reveal utility from `globals.css`/tailwind config if present) + apply to rows. Verify with a headless screenshot.

### B. Frontend polish — populate `home_value` / `rent` columns

`screener_snapshot.home_value` + `rent` are **NULL** (the fn doesn't populate them). Recommended: populate **rent** (ZORI) — useful cash-flow context; `home_value` (ZHVI) ≈ `median_price` (populate too, cheap, or drop).

- Update `refresh_screener_snapshot()` (`supabase/migrations/20260615111802_refresh_screener_snapshot_fn.sql` + apply via `execute_sql` CREATE OR REPLACE): LEFT JOIN latest `zillow_{metro,county,zip}` ZHVI→home_value, ZORI→rent per region (keys: metro=cbsa_code, county=fips_code, zip=region_name; `period_date >= now()-6mo` + DISTINCT ON, like the existing zip_state CTE). SQL → no 1000-row cap.
- `SELECT refresh_screener_snapshot();` then verify `count(rent)` per geo. Add a **Rent** column to `ScreenerTable.tsx` (mono, `formatMetricValue(rent,'currency')`) + `CSV_COLUMNS` in `ScreenerPageInner.tsx`.

### C. Delete dead duplicate calc scripts (#14)

Delete `scripts/calculations/investment-metrics.ts`, `scripts/calculations/valuation-metrics.ts`, `scripts/utils/refresh-calculated-metrics.ts` (shim), `scripts/refresh-all-metrics.ts`, `scripts/run-refresh-calculated.ts`, and obsolete `scripts/ensure-calculated-metrics-populated.ts`.

- Nearly unblocked (trimmed runner no longer imports investment/valuation; only the shim's own doc comment referenced the dead paths). Before deleting: fix `import-all-non-zillow.ts` (`execFileSync ... refresh-all-metrics.ts` string ref) and check what imports the shim (committed `import-realtor-data.ts` may; the parallel session's uncommitted copy repoints to the runner). **Coordinate with the parallel session — ideally do C after it commits its `import-realtor` work** to avoid clobbering its WIP. Verify scripts tsc after.

### D. Affordability port (scripts → service) — do BEFORE E

Move `income_to_buy` / `affordable_home_price` / `years_to_save` from `scripts/calculations/affordability-metrics.ts` + `years-to-save-metrics.ts` INTO `CalculatedMetricsService` (finishes RC-0, single source of truth). **Gotcha: port the FRED rate fetch** (`scripts/calculations/metric-calculation-helpers.ts` `fetchMortgageRateFromFRED`) — the service has no FRED integration. Then call from `refreshAllCalculatedMetrics`, remove the affordability-runner step from `.github/workflows/post-import-refresh.yml`, delete the affordability scripts + runner. Re-run; verify the three metrics populate.

### E. Split `calculated-metrics.service.ts` (3,362 lines → focused files) — do LAST

§1.3 hard-limit violation. Keep the facade (`@Injectable` + per-record calc helpers + `storeMetrics` + read methods `getMetrics`/`getMetricsForMap` + `refreshAllCalculatedMetrics`); extract `calculateInvestmentMetricsFor{Metros,Counties,Zips}` + `fetchRealtorMosInputs` into an investment calculator, and overvalued + 5yr-growth into a valuation calculator (separate `@Injectable`s delegated to, or free functions taking the supabase client). **CRITICAL — preserve exact behavior**: MOS latest-period gating (omit keys otherwise; never clobber Redfin), overvalued non-clobber batched upsert + **1000-row pagination**, `absorption_rate` writes, HUD-FMR fallbacks. Gate: `cd packages/backend && npx tsc --noEmit` clean, THEN re-run the refresh CLI and re-check coverage (metro cap_rate ~865 / MOS ~871; county/zip overvalued full) — no regression.

### Other tracked defects (lower priority, same class as RC-3)

Sibling NULL-on-incremental-upsert bugs: `zillow_county.fips_code`, `zillow_zip.county_fips` (likely never populated), `realtor_county.cbsa_code`, `redfin_county.fips_code` — same canonical-stamp fix pattern. Not screener-blocking.
