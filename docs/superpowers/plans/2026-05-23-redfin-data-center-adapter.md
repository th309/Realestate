# Redfin Data Center Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest 8 dashboards from Redfin's new `redfin_data_center/` CSV product into ~30 new `redfin_dc_*` tables, and add a `months_of_supply` computed fallback (sourced from new-format housing_market) wired into the PropertyIQ Score — all add-only, no consumer cutover.

**Architecture:** A new `scripts/sources/redfin-data-center/` adapter parallel to the legacy `scripts/sources/redfin/`. One **generic** CSV processor handles all 8 dashboards because every Data Center CSV shares the same shape (6 metadata columns + N metric columns, all `"UPPER CASE (unit)"` quoted, `NA` for nulls). A column normalizer converts headers to snake*case; a per-dashboard config declares expected columns + geo levels. Geo IDs are resolved by reusing the legacy `resolveRedfinGeoid()`. The MoS fallback computes `active_listings / homes_sold` from `redfin_dc_housing_market*\*`into`calculated_metrics`, and the v4 score fetcher gains a bulk second-pass that fills missing MoS from there.

**Tech Stack:** TypeScript, `tsx` CLI scripts, `csv-parse` (sync + stream), `@supabase/supabase-js`, Supabase Postgres migrations, Jest (ts-jest) for unit tests, NestJS backend for the scoring/metric-resolution changes.

**Spec:** `docs/superpowers/specs/2026-05-23-redfin-data-center-adapter-design.md`

**Branch:** `develop` (work here; do not push without explicit user ask).

---

## File Structure

**New adapter files (`scripts/sources/redfin-data-center/`):**

| File                             | Responsibility                                                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `redfin-dc-config.ts`            | The single source of truth: dashboard definitions (id, S3 sub-path per geo, target table per geo, metric columns, conflict keys, special dims), the geo levels each dashboard publishes, and the hardcoded fallback URL base. |
| `redfin-dc-column-normalizer.ts` | Pure function: `"MEDIAN SALE PRICE MOM (%)"` → `median_sale_price_mom`. Plus `normalizeRegionTypeToGeoLevel()`.                                                                                                               |
| `redfin-dc-index-fetcher.ts`     | Fetches + validates `index.json`; resolves the CSV URL for a (dashboard, geo) pair; falls back to constructed URL on failure.                                                                                                 |
| `redfin-dc-geo-resolver.ts`      | Wraps legacy `resolveRedfinGeoid()` with new-format string normalization (strips `" metro area"`, derives state code from `", XX"` suffix). Returns `{ regionId, resolved }`.                                                 |
| `redfin-dc-csv-processor.ts`     | Generic: stream-download a CSV, parse, normalize columns, resolve geo, build dbRecord, batch upsert. Tracks inserted/failed/skipped/latestPeriodEnd. Enforces the >10% unresolved hard-fail.                                  |
| `import-redfin-dc.ts`            | CLI entry. Flags `--dashboard`, `--geo`, `--full`, `--recent=N`, `--limit`. Orchestrates dashboards, runs the post-import MoS hook, prints banner, reports status.                                                            |
| `__fixtures__/*.csv`             | 3–5 row sample CSVs per dashboard for unit tests.                                                                                                                                                                             |
| `__tests__/*.spec.ts`            | Normalizer unit tests, geo-resolver tests, processor integration test, index.json contract test.                                                                                                                              |

**New migrations (`supabase/migrations/`):** 8 dashboard table migrations + 1 MoS migration (timestamps assigned at creation time using real `now`, per memory `supabase-out-of-order-migrations`).

**Backend changes (`packages/backend/src/`):**

| File                                                | Change                                                       |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `metric-resolution/fallback-registry/calculated.ts` | Add `months_of_supply` calculated entry.                     |
| `metric-resolution/fallback-registry/index.ts`      | (No change — `calculatedMetrics` already merged.)            |
| `scoring/v4-scoring-data-fetcher.ts`                | Add bulk second-pass MoS fallback from `calculated_metrics`. |
| `scoring/__tests__/v4-scoring-data-fetcher.spec.ts` | New regression test for the fallback merge.                  |

---

## Conventions used throughout

- **Column normalizer rules:** lowercase → delete the substrings `($)`, `(%)`, `(ppts)`, `(days)` → replace every run of non-`[a-z0-9]` with `_` → collapse repeats → trim leading/trailing `_`. Embedded words like `mom`, `yoy`, `pct` survive, so `MEDIAN DOWN PAYMENT ($)` → `median_down_payment` stays distinct from `MEDIAN DOWN PAYMENT PCT (%)` → `median_down_payment_pct`.
- **Null handling:** CSV value `"NA"` (or empty) → SQL `NULL`. Numeric parse via `Number()`, but `NaN` → `NULL`.
- **Conflict key:** `(period_end, region_id)` except `investors_by_category` = `(period_end, category_type, category)` and `buyers_and_sellers_*` = `(period_end, region_id, property_type)`.
- **Migration timestamp:** run `date -u +%Y%m%d%H%M%S` at creation to get a real, monotonic version. Never backdate.
- **Commit cadence:** one commit per task. No `Co-Authored-By` line (per user preference).
- **Verify after every task:** the final step of each implementation task runs build/typecheck/tests.

---

## Phase 0 — Core scaffolding (the reusable engine)

### Task 0.1: Column normalizer

**Files:**

- Create: `scripts/sources/redfin-data-center/redfin-dc-column-normalizer.ts`
- Test: `scripts/sources/redfin-data-center/__tests__/redfin-dc-column-normalizer.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import {
  normalizeColumnName,
  normalizeRegionTypeToGeoLevel,
} from "../redfin-dc-column-normalizer";

describe("normalizeColumnName", () => {
  it("strips unit suffixes and snake-cases", () => {
    expect(normalizeColumnName("MEDIAN SALE PRICE MOM (%)")).toBe(
      "median_sale_price_mom",
    );
    expect(normalizeColumnName("AVERAGE SIZE OF PRICE DROP YOY (PPTS)")).toBe(
      "average_size_of_price_drop_yoy",
    );
    expect(normalizeColumnName("MEDIAN DAYS ON MARKET (DAYS)")).toBe(
      "median_days_on_market",
    );
  });

  it("keeps $-price and pct-percent columns distinct", () => {
    expect(normalizeColumnName("MEDIAN DOWN PAYMENT ($)")).toBe(
      "median_down_payment",
    );
    expect(normalizeColumnName("MEDIAN DOWN PAYMENT PCT (%)")).toBe(
      "median_down_payment_pct",
    );
  });

  it("handles embedded symbols and hyphens", () => {
    expect(normalizeColumnName("BUYER-SELLER RATIO")).toBe(
      "buyer_seller_ratio",
    );
    expect(normalizeColumnName("SELLER-BUYER % DIFFERENCE")).toBe(
      "seller_buyer_difference",
    );
  });
});

describe("normalizeRegionTypeToGeoLevel", () => {
  it("maps Redfin REGION TYPE values to our geo levels", () => {
    expect(normalizeRegionTypeToGeoLevel("Country")).toBe("country");
    expect(normalizeRegionTypeToGeoLevel("State")).toBe("state");
    expect(normalizeRegionTypeToGeoLevel("Metro")).toBe("metro");
    expect(normalizeRegionTypeToGeoLevel("County")).toBe("county");
    expect(normalizeRegionTypeToGeoLevel("Zip")).toBe("zip");
    expect(normalizeRegionTypeToGeoLevel("Census Region")).toBe(
      "census_region",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-column-normalizer.spec.ts`
Expected: FAIL — "Cannot find module '../redfin-dc-column-normalizer'".

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Pure header/region normalization for the Redfin Data Center CSV format.
 * Every dashboard shares the same column-naming convention, so one
 * normalizer serves all of them.
 */

/** Convert a raw Redfin DC header to a snake_case DB column name. */
export function normalizeColumnName(header: string): string {
  return header
    .toLowerCase()
    .replace(/\(\$\)|\(%\)|\(ppts\)|\(days\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Map a Redfin "REGION TYPE" cell to our internal geo-level string. */
export function normalizeRegionTypeToGeoLevel(regionType: string): string {
  const t = regionType.trim().toLowerCase();
  if (t === "country") return "country";
  if (t === "state") return "state";
  if (t === "metro") return "metro";
  if (t === "county") return "county";
  if (t === "zip") return "zip";
  if (t === "census region") return "census_region";
  return t;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-column-normalizer.spec.ts`
Expected: PASS (3 + 1 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/redfin-data-center/redfin-dc-column-normalizer.ts scripts/sources/redfin-data-center/__tests__/redfin-dc-column-normalizer.spec.ts
git commit -m "feat(redfin-dc): column + region-type normalizer with tests"
```

---

### Task 0.2: Dashboard config

**Files:**

- Create: `scripts/sources/redfin-data-center/redfin-dc-config.ts`
- Test: `scripts/sources/redfin-data-center/__tests__/redfin-dc-config.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import {
  DASHBOARDS,
  getDashboard,
  S3_BASE,
  ALL_DASHBOARD_IDS,
} from "../redfin-dc-config";

describe("redfin-dc-config", () => {
  it("defines all 8 dashboards", () => {
    expect(ALL_DASHBOARD_IDS).toEqual([
      "price_drops",
      "contract_cancellations",
      "delistings_relistings",
      "housing_market",
      "investors",
      "cash_loan",
      "buyers_and_sellers",
      "rhpi",
    ]);
  });

  it("price_drops publishes 5 geos with table names + paths", () => {
    const d = getDashboard("price_drops");
    expect(Object.keys(d.geos).sort()).toEqual([
      "country",
      "county",
      "metro",
      "state",
      "zip",
    ]);
    expect(d.geos.metro.table).toBe("redfin_dc_price_drops_metro");
    expect(d.geos.metro.path).toBe("price_drops/monthly/all_metros.csv");
    expect(d.geos.country.path).toBe("price_drops/monthly/country.csv");
  });

  it("investors has by_category with category conflict key", () => {
    const d = getDashboard("investors");
    expect(d.geos.by_category.table).toBe("redfin_dc_investors_by_category");
    expect(d.geos.by_category.conflictKeys).toEqual([
      "period_end",
      "category_type",
      "category",
    ]);
  });

  it("buyers_and_sellers uses property_type in conflict key", () => {
    const d = getDashboard("buyers_and_sellers");
    expect(d.geos.metro.conflictKeys).toEqual([
      "period_end",
      "region_id",
      "property_type",
    ]);
  });

  it("exposes a public S3 base for the new product", () => {
    expect(S3_BASE).toBe(
      "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_data_center",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-config.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Single source of truth for the Redfin Data Center adapter.
 *
 * Each dashboard declares the geo levels it publishes, the S3 sub-path and
 * target table for each geo, the conflict key, and any extra text-dimension
 * columns (category dims, property_type) that are part of the row identity.
 *
 * Metric columns are NOT enumerated here — the generic processor derives them
 * from the CSV header via the column normalizer, intersected with the table's
 * actual columns (unknown columns are ignored, so Redfin adding a column never
 * breaks an ingest).
 */

export const S3_BASE =
  "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_data_center";

/** A single (dashboard, geo) target. */
export interface GeoTarget {
  /** S3 path relative to S3_BASE. */
  path: string;
  /** Target Supabase table. */
  table: string;
  /** Upsert conflict key columns. */
  conflictKeys: string[];
  /** Extra text dimension columns beyond region_id/region_name. */
  textDims?: string[];
  /** True when rows carry no geo (category breakdowns) — skip geo resolution. */
  noGeo?: boolean;
}

export interface DashboardConfig {
  id: string;
  /** index.json top-level key (differs from id for some dashboards). */
  indexKey: string;
  geos: Record<string, GeoTarget>;
}

const STD_CONFLICT = ["period_end", "region_id"];

/** Build the 5 standard geo targets for a full-coverage dashboard. */
function fullCoverage(id: string, folder: string): Record<string, GeoTarget> {
  return {
    country: {
      path: `${folder}/monthly/country.csv`,
      table: `redfin_dc_${id}_country`,
      conflictKeys: STD_CONFLICT,
    },
    state: {
      path: `${folder}/monthly/all_states.csv`,
      table: `redfin_dc_${id}_state`,
      conflictKeys: STD_CONFLICT,
    },
    metro: {
      path: `${folder}/monthly/all_metros.csv`,
      table: `redfin_dc_${id}_metro`,
      conflictKeys: STD_CONFLICT,
    },
    county: {
      path: `${folder}/monthly/all_counties.csv`,
      table: `redfin_dc_${id}_county`,
      conflictKeys: STD_CONFLICT,
    },
    zip: {
      path: `${folder}/monthly/all_zips.csv`,
      table: `redfin_dc_${id}_zip`,
      conflictKeys: STD_CONFLICT,
    },
  };
}

export const DASHBOARDS: Record<string, DashboardConfig> = {
  price_drops: {
    id: "price_drops",
    indexKey: "price_drops",
    geos: fullCoverage("price_drops", "price_drops"),
  },
  contract_cancellations: {
    id: "contract_cancellations",
    indexKey: "contract_cancellations",
    geos: fullCoverage("contract_cancellations", "contract_cancellations"),
  },
  delistings_relistings: {
    id: "delistings_relistings",
    indexKey: "delistings_relistings",
    geos: fullCoverage("delistings_relistings", "delistings_relistings"),
  },
  housing_market: {
    id: "housing_market",
    indexKey: "housing_market",
    geos: fullCoverage("housing_market", "housing_market"),
  },
  investors: {
    id: "investors",
    indexKey: "investors",
    geos: {
      country: {
        path: "investors/by_metro/country.csv",
        table: "redfin_dc_investors_country",
        conflictKeys: STD_CONFLICT,
      },
      metro: {
        path: "investors/by_metro/all_metros.csv",
        table: "redfin_dc_investors_metro",
        conflictKeys: STD_CONFLICT,
      },
      by_category: {
        path: "investors/by_category/price_tier.csv",
        table: "redfin_dc_investors_by_category",
        conflictKeys: ["period_end", "category_type", "category"],
        textDims: ["category_type", "category", "property_type"],
        noGeo: true,
      },
    },
  },
  cash_loan: {
    id: "cash_loan",
    indexKey: "cash_loan",
    geos: {
      country: {
        path: "all_cash_loan_types/country.csv",
        table: "redfin_dc_cash_loan_country",
        conflictKeys: STD_CONFLICT,
      },
      metro: {
        path: "all_cash_loan_types/all_metros.csv",
        table: "redfin_dc_cash_loan_metro",
        conflictKeys: STD_CONFLICT,
      },
    },
  },
  buyers_and_sellers: {
    id: "buyers_and_sellers",
    indexKey: "buyers_and_sellers",
    geos: {
      country: {
        path: "buyers_and_sellers/monthly/country.csv",
        table: "redfin_dc_buyers_sellers_country",
        conflictKeys: ["period_end", "region_id", "property_type"],
        textDims: ["property_type", "balance_of_power"],
      },
      census_region: {
        path: "buyers_and_sellers/monthly/all_census_regions.csv",
        table: "redfin_dc_buyers_sellers_census_region",
        conflictKeys: ["period_end", "region_id", "property_type"],
        textDims: ["property_type", "balance_of_power"],
      },
      metro: {
        path: "buyers_and_sellers/monthly/top_50_metros.csv",
        table: "redfin_dc_buyers_sellers_metro",
        conflictKeys: ["period_end", "region_id", "property_type"],
        textDims: ["property_type", "balance_of_power"],
      },
    },
  },
  rhpi: {
    id: "rhpi",
    indexKey: "rhpi",
    geos: {
      country: {
        path: "rhpi/monthly/country.csv",
        table: "redfin_dc_rhpi_country",
        conflictKeys: STD_CONFLICT,
      },
      metro: {
        path: "rhpi/monthly/all_metros.csv",
        table: "redfin_dc_rhpi_metro",
        conflictKeys: STD_CONFLICT,
      },
    },
  },
};

export const ALL_DASHBOARD_IDS = Object.keys(DASHBOARDS);

export function getDashboard(id: string): DashboardConfig {
  const d = DASHBOARDS[id];
  if (!d) {
    throw new Error(
      `Unknown dashboard "${id}". Valid: ${ALL_DASHBOARD_IDS.join(", ")}`,
    );
  }
  return d;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-config.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/redfin-data-center/redfin-dc-config.ts scripts/sources/redfin-data-center/__tests__/redfin-dc-config.spec.ts
git commit -m "feat(redfin-dc): dashboard config (8 dashboards, geo targets, conflict keys)"
```

---

### Task 0.3: Geo resolver wrapper

**Files:**

- Create: `scripts/sources/redfin-data-center/redfin-dc-geo-resolver.ts`
- Test: `scripts/sources/redfin-data-center/__tests__/redfin-dc-geo-resolver.spec.ts`

**Context:** Legacy `resolveRedfinGeoid(supabase, regionType, regionName, stateCode)` (in `scripts/sources/redfin/redfin-geoid-lookup.ts`) already handles state/metro/county/zip and never returns null (it generates a `REDFIN-…` fallback). The new format names differ slightly (`"Akron, OH metro area"` vs legacy `"Akron, OH"`), so we normalize before delegating, and we report whether the result was a real match or a generated fallback so the processor can enforce the >10% unresolved threshold.

- [ ] **Step 1: Write the failing test**

```typescript
import { extractStateCode, stripMetroSuffix } from "../redfin-dc-geo-resolver";

describe("redfin-dc-geo-resolver helpers", () => {
  it("strips the ' metro area' suffix Redfin DC appends", () => {
    expect(stripMetroSuffix("Akron, OH metro area")).toBe("Akron, OH");
    expect(stripMetroSuffix("Akron, OH")).toBe("Akron, OH");
  });

  it("extracts a 2-letter state code from a trailing ', XX'", () => {
    expect(extractStateCode("Bergen County, NJ")).toBe("NJ");
    expect(extractStateCode("Akron, OH metro area")).toBe("OH");
    expect(extractStateCode("National")).toBeNull();
    expect(extractStateCode("07002")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-geo-resolver.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Resolve Redfin Data Center region names to our standard geo IDs.
 *
 * Delegates the heavy lifting to the legacy resolveRedfinGeoid (tiger tables +
 * markets fallback), after normalizing the new format's name quirks. Reports
 * whether the ID is a real match or a generated REDFIN-… fallback so callers
 * can enforce an unresolved-rate threshold.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRedfinGeoid } from "../redfin/redfin-geoid-lookup";

/** Remove the " metro area" suffix the DC format appends to metro names. */
export function stripMetroSuffix(name: string): string {
  return name.replace(/\s+metro area$/i, "").trim();
}

/** Pull a trailing ", XX" 2-letter state code, or null. */
export function extractStateCode(name: string): string | null {
  const m = name.match(/,\s*([A-Z]{2})(?:\s+metro area)?$/);
  return m ? m[1] : null;
}

export interface ResolvedGeo {
  regionId: string;
  /** False when resolveRedfinGeoid fell back to a generated REDFIN-… id. */
  resolved: boolean;
}

/**
 * Resolve a (geoLevel, regionName) to a standard geo id.
 * For 'country' there is one fixed id ('US').
 */
export async function resolveDcGeo(
  supabase: SupabaseClient,
  geoLevel: string,
  regionName: string,
): Promise<ResolvedGeo> {
  if (geoLevel === "country") return { regionId: "US", resolved: true };
  if (geoLevel === "census_region") {
    return { regionId: regionName.trim(), resolved: true };
  }

  const stateCode = extractStateCode(regionName) ?? undefined;
  const cleanName =
    geoLevel === "metro" ? stripMetroSuffix(regionName) : regionName;

  const regionId = await resolveRedfinGeoid(
    supabase,
    geoLevel,
    cleanName,
    stateCode,
  );
  return { regionId, resolved: !regionId.startsWith("REDFIN-") };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-geo-resolver.spec.ts`
Expected: PASS (2 tests). (The async `resolveDcGeo` is covered later by the processor integration test with a stubbed Supabase.)

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/redfin-data-center/redfin-dc-geo-resolver.ts scripts/sources/redfin-data-center/__tests__/redfin-dc-geo-resolver.spec.ts
git commit -m "feat(redfin-dc): geo resolver wrapper over legacy resolveRedfinGeoid"
```

---

### Task 0.4: Index.json fetcher

**Files:**

- Create: `scripts/sources/redfin-data-center/redfin-dc-index-fetcher.ts`
- Test: `scripts/sources/redfin-data-center/__tests__/redfin-dc-index-fetcher.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { resolveCsvUrl } from "../redfin-dc-index-fetcher";
import { S3_BASE } from "../redfin-dc-config";

describe("resolveCsvUrl", () => {
  it("prefers the index.json path when present", () => {
    const index = {
      price_drops: { metro: { all: "price_drops/monthly/all_metros.csv" } },
    };
    expect(
      resolveCsvUrl(
        index,
        "price_drops",
        "metro",
        "price_drops/monthly/all_metros.csv",
      ),
    ).toBe(`${S3_BASE}/price_drops/monthly/all_metros.csv`);
  });

  it("falls back to the configured path when index lacks the key", () => {
    expect(
      resolveCsvUrl(
        {},
        "price_drops",
        "metro",
        "price_drops/monthly/all_metros.csv",
      ),
    ).toBe(`${S3_BASE}/price_drops/monthly/all_metros.csv`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-index-fetcher.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Fetch and consult the Redfin Data Center index.json manifest.
 *
 * index.json is the authoritative list of published CSV paths. We use it to
 * resolve URLs at runtime so Redfin reshuffling filenames within a dashboard
 * doesn't break us. When the manifest is unreachable or lacks an expected
 * key, we fall back to the path baked into redfin-dc-config.ts.
 */

import { downloadFromUrl } from "../../lib/csv-loader";
import { S3_BASE } from "./redfin-dc-config";

export type RedfinIndex = Record<string, unknown>;

/** Fetch index.json. Returns {} on any failure (caller falls back to config). */
export async function fetchIndex(): Promise<RedfinIndex> {
  try {
    const buf = await downloadFromUrl(`${S3_BASE}/index.json`, {
      maxRetries: 2,
    });
    return JSON.parse(buf.toString("utf-8")) as RedfinIndex;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `  [redfin-dc] index.json unavailable (${msg}). Falling back to configured paths.`,
    );
    return {};
  }
}

/**
 * Resolve the full CSV URL for a (dashboard, geo). The index path overrides the
 * configured fallback path when present; both are joined to S3_BASE.
 */
export function resolveCsvUrl(
  index: RedfinIndex,
  indexKey: string,
  geoKey: string,
  fallbackPath: string,
): string {
  let path = fallbackPath;
  const dash = index[indexKey] as Record<string, any> | undefined;
  const geo = dash?.[geoKey] as Record<string, any> | undefined;
  if (geo && typeof geo.all === "string") {
    path = geo.all;
  }
  return `${S3_BASE}/${path}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-index-fetcher.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sources/redfin-data-center/redfin-dc-index-fetcher.ts scripts/sources/redfin-data-center/__tests__/redfin-dc-index-fetcher.spec.ts
git commit -m "feat(redfin-dc): index.json fetcher with config fallback"
```

---

### Task 0.5: Generic CSV processor

**Files:**

- Create: `scripts/sources/redfin-data-center/redfin-dc-csv-processor.ts`
- Create fixture: `scripts/sources/redfin-data-center/__fixtures__/price_drops_metro_sample.csv`
- Test: `scripts/sources/redfin-data-center/__tests__/redfin-dc-csv-processor.spec.ts`

**Context:** This is the engine. It accepts already-parsed rows (the download/stream concern is separated so the test needs no network), maps each row to a DB record using the normalizer + the table's real columns, resolves geo, and returns records + counters. The `>10%` unresolved hard-fail lives here.

- [ ] **Step 1: Create the fixture**

Create `scripts/sources/redfin-data-center/__fixtures__/price_drops_metro_sample.csv` (header + 3 rows; note `NA` and an embedded comma in the region name):

```csv
"LAST UPDATED","FREQUENCY","PERIOD BEGIN","PERIOD END","REGION TYPE","REGION NAME","PRICE DROPS","PRICE DROPS MOM (%)","PRICE DROPS YOY (%)","AVERAGE SIZE OF PRICE DROP (%)","AVERAGE SIZE OF PRICE DROP MOM (PPTS)","AVERAGE SIZE OF PRICE DROP YOY (PPTS)","PERCENT ACTIVE WITH PRICE DROPS (%)","PERCENT ACTIVE WITH PRICE DROPS MOM (PPTS)","PERCENT ACTIVE WITH PRICE DROPS YOY (PPTS)"
"2026-05-03","Monthly","2026-04-01","2026-04-30","Metro","Akron, OH metro area",1234,1.5,NA,5.1,0.1,-0.2,30.5,1.1,2.2
"2026-05-03","Monthly","2026-04-01","2026-04-30","Metro","Austin, TX metro area",5678,-2.0,3.3,4.8,NA,0.5,28.1,-0.5,1.0
"2026-05-03","Monthly","2026-04-01","2026-04-30","Metro","Akron, OH metro area",1200,1.0,1.0,5.0,0.0,0.0,30.0,1.0,2.0
```

- [ ] **Step 2: Write the failing test**

```typescript
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { mapRowToRecord, processRows } from "../redfin-dc-csv-processor";
import { getDashboard } from "../redfin-dc-config";

const KNOWN_COLUMNS = [
  "region_id",
  "region_name",
  "period_begin",
  "period_end",
  "frequency",
  "last_updated",
  "price_drops",
  "price_drops_mom",
  "price_drops_yoy",
  "average_size_of_price_drop",
  "average_size_of_price_drop_mom",
  "average_size_of_price_drop_yoy",
  "percent_active_with_price_drops",
  "percent_active_with_price_drops_mom",
  "percent_active_with_price_drops_yoy",
];

// Stub resolver: Akron->10420, Austin->12420, deterministic + always resolved.
const fakeResolve = async (_s: any, _g: string, name: string) => ({
  regionId: name.startsWith("Akron") ? "10420" : "12420",
  resolved: true,
});

function loadFixtureRows() {
  const csv = readFileSync(
    join(__dirname, "..", "__fixtures__", "price_drops_metro_sample.csv"),
    "utf-8",
  );
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

describe("mapRowToRecord", () => {
  it("normalizes columns, converts NA to null, attaches region_id", async () => {
    const rows = loadFixtureRows();
    const rec = await mapRowToRecord(
      {} as any,
      rows[0],
      "metro",
      getDashboard("price_drops").geos.metro,
      KNOWN_COLUMNS,
      fakeResolve as any,
    );
    expect(rec).not.toBeNull();
    expect(rec!.region_id).toBe("10420");
    expect(rec!.region_name).toBe("Akron, OH metro area");
    expect(rec!.period_end).toBe("2026-04-30");
    expect(rec!.price_drops).toBe(1234);
    expect(rec!.price_drops_yoy).toBeNull(); // "NA"
    expect(rec!.average_size_of_price_drop_mom).toBe(0.1);
    expect("region_type" in rec!).toBe(false); // dropped, encoded in table name
  });
});

describe("processRows", () => {
  it("maps all rows and tracks the latest period_end", async () => {
    const rows = loadFixtureRows();
    const out = await processRows(
      {} as any,
      rows,
      "metro",
      getDashboard("price_drops").geos.metro,
      KNOWN_COLUMNS,
      fakeResolve as any,
    );
    expect(out.records).toHaveLength(3);
    expect(out.skipped).toBe(0);
    expect(out.latestPeriodEnd).toBe("2026-04-30");
  });

  it("hard-fails when >10% of rows are unresolvable", async () => {
    const rows = loadFixtureRows();
    const allUnresolved = async () => ({
      regionId: "REDFIN-METRO-X",
      resolved: false,
    });
    await expect(
      processRows(
        {} as any,
        rows,
        "metro",
        getDashboard("price_drops").geos.metro,
        KNOWN_COLUMNS,
        allUnresolved as any,
      ),
    ).rejects.toThrow(/unresolved/i);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-csv-processor.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write minimal implementation**

```typescript
/**
 * Generic processor for Redfin Data Center CSVs.
 *
 * Because every dashboard CSV shares the same shape (6 metadata columns + N
 * metric columns), one mapper handles all of them: normalize each header,
 * keep only columns that exist in the target table, convert NA→null, resolve
 * the region, and emit a DB record.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeColumnName,
  normalizeRegionTypeToGeoLevel,
} from "./redfin-dc-column-normalizer";
import type { GeoTarget } from "./redfin-dc-config";
import { resolveDcGeo, type ResolvedGeo } from "./redfin-dc-geo-resolver";

const META_TO_COLUMN: Record<string, string> = {
  "period begin": "period_begin",
  "period end": "period_end",
  frequency: "frequency",
  "last updated": "last_updated",
};

type ResolveFn = (
  supabase: SupabaseClient,
  geoLevel: string,
  regionName: string,
) => Promise<ResolvedGeo>;

function parseValue(raw: string | undefined): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t === "" || t.toUpperCase() === "NA") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

/**
 * Map one raw CSV row to a DB record. Returns null only on a missing period_end
 * (structurally invalid row). Unresolved geos still produce a record (with the
 * fallback id) but are counted by the caller via the returned `resolved` flag.
 */
export async function mapRowToRecord(
  supabase: SupabaseClient,
  row: Record<string, string>,
  geoLevel: string,
  target: GeoTarget,
  knownColumns: string[],
  resolve: ResolveFn = resolveDcGeo,
): Promise<(Record<string, unknown> & { __resolved: boolean }) | null> {
  const known = new Set(knownColumns);
  const rec: Record<string, unknown> = {};

  // Metadata + metric columns
  for (const [rawHeader, rawValue] of Object.entries(row)) {
    const header = rawHeader.trim();
    const lower = header.toLowerCase();
    if (lower === "region type") continue; // encoded in table name
    if (lower === "region name") {
      rec.region_name = (rawValue ?? "").trim();
      continue;
    }
    if (META_TO_COLUMN[lower]) {
      const col = META_TO_COLUMN[lower];
      const v = (rawValue ?? "").trim();
      rec[col] = v === "" || v.toUpperCase() === "NA" ? null : v;
      continue;
    }
    const col = normalizeColumnName(header);
    if (!known.has(col)) continue; // ignore unknown columns (forward-compatible)
    // Text dimensions stay as strings; everything else is numeric.
    if (target.textDims?.includes(col)) {
      const v = (rawValue ?? "").trim();
      rec[col] = v === "" || v.toUpperCase() === "NA" ? null : v;
    } else {
      rec[col] = parseValue(rawValue);
    }
  }

  if (!rec.period_end) return null;

  // Geo resolution
  let resolved = true;
  if (target.noGeo) {
    rec.region_id = "US"; // category breakdowns are national
  } else {
    const regionName = String(rec.region_name ?? "");
    const r = await resolve(supabase, geoLevel, regionName);
    rec.region_id = r.regionId;
    resolved = r.resolved;
  }

  return Object.assign(rec, { __resolved: resolved });
}

export interface ProcessResult {
  records: Record<string, unknown>[];
  skipped: number;
  unresolved: number;
  latestPeriodEnd: string | null;
}

const UNRESOLVED_HARD_FAIL_RATIO = 0.1;

/** Map an array of rows; enforce the >10% unresolved hard-fail. */
export async function processRows(
  supabase: SupabaseClient,
  rows: Record<string, string>[],
  geoLevel: string,
  target: GeoTarget,
  knownColumns: string[],
  resolve: ResolveFn = resolveDcGeo,
): Promise<ProcessResult> {
  const records: Record<string, unknown>[] = [];
  let skipped = 0;
  let unresolved = 0;
  let latestPeriodEnd: string | null = null;

  for (const row of rows) {
    const mapped = await mapRowToRecord(
      supabase,
      row,
      geoLevel,
      target,
      knownColumns,
      resolve,
    );
    if (!mapped) {
      skipped += 1;
      continue;
    }
    const { __resolved, ...rec } = mapped;
    if (!__resolved) unresolved += 1;
    const pe = String(rec.period_end);
    if (!latestPeriodEnd || pe > latestPeriodEnd) latestPeriodEnd = pe;
    records.push(rec);
  }

  const total = records.length + skipped;
  if (total > 0 && unresolved / total > UNRESOLVED_HARD_FAIL_RATIO) {
    throw new Error(
      `[redfin-dc] ${target.table}: ${unresolved}/${total} rows unresolved ` +
        `(>${UNRESOLVED_HARD_FAIL_RATIO * 100}%). Aborting — likely schema/source drift.`,
    );
  }

  return { records, skipped, unresolved, latestPeriodEnd };
}

export { normalizeRegionTypeToGeoLevel };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-csv-processor.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/sources/redfin-data-center/redfin-dc-csv-processor.ts scripts/sources/redfin-data-center/__fixtures__/price_drops_metro_sample.csv scripts/sources/redfin-data-center/__tests__/redfin-dc-csv-processor.spec.ts
git commit -m "feat(redfin-dc): generic CSV processor with NA handling + unresolved hard-fail"
```

---

### Task 0.6: CLI entry + download/upsert wiring

**Files:**

- Create: `scripts/sources/redfin-data-center/import-redfin-dc.ts`

**Context:** This wires download → parse → `processRows` → `batchUpsert`, iterating the requested dashboards/geos. It reuses `getSupabaseClient`, `downloadFromUrl`, `batchUpsert`, `createIngestionLogger`, `printSummaryBanner`, `reportStatusToBackend`, `getIncrementalCutoff`, `parseIncrementalFlagsFromArgv`. Large ZIP files (housing_market all_zips ≈ 425 MB) are parsed from the downloaded buffer via `csv-parse/sync`; if memory becomes an issue in the live test, switch that one geo to a streamed parse (noted in Phase 9 risk).

To know each table's real columns (for `knownColumns`), the CLI introspects the target table once via `information_schema` using a tiny RPC-free query.

- [ ] **Step 1: Write the implementation**

```typescript
#!/usr/bin/env npx tsx
/**
 * Redfin Data Center importer.
 *
 * Usage:
 *   npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts
 *   npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --dashboard price_drops
 *   npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --dashboard housing_market --geo metro
 *   npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --full
 */

import { parse as csvParse } from "csv-parse/sync";
import { getSupabaseClient } from "../../lib/db-client";
import { batchUpsert } from "../../lib/batch-upsert";
import { downloadFromUrl } from "../../lib/csv-loader";
import {
  getIncrementalCutoff,
  parseIncrementalFlagsFromArgv,
} from "../../lib/incremental-cutoff";
import {
  printSummaryBanner,
  reportStatusToBackend,
} from "../../lib/import-reporter";
import type {
  ImportGeographyResult,
  ImportSourceResult,
} from "../../lib/types";
import { createIngestionLogger } from "../../utils/ingestion-logger";
import {
  ALL_DASHBOARD_IDS,
  getDashboard,
  type GeoTarget,
} from "./redfin-dc-config";
import { fetchIndex, resolveCsvUrl } from "./redfin-dc-index-fetcher";
import { processRows } from "./redfin-dc-csv-processor";
import { runMonthsOfSupplyHook } from "./redfin-dc-mos-hook";

const UPSERT_BATCH_SIZE = 1000;

function argValue(flag: string): string | null {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=")[1];
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

/** Read a table's column names from information_schema (for knownColumns). */
async function getTableColumns(
  supabase: ReturnType<typeof getSupabaseClient>,
  table: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("information_schema.columns" as any)
    .select("column_name")
    .eq("table_name", table);
  if (error || !data) {
    throw new Error(
      `Could not introspect columns for ${table}: ${error?.message}`,
    );
  }
  return (data as { column_name: string }[]).map((r) => r.column_name);
}

async function importGeo(
  supabase: ReturnType<typeof getSupabaseClient>,
  index: Record<string, unknown>,
  dashboardId: string,
  indexKey: string,
  geoLevel: string,
  target: GeoTarget,
  dateCutoff: string | null,
  rowLimit: number | undefined,
): Promise<ImportGeographyResult> {
  const start = Date.now();
  const result: ImportGeographyResult = {
    geographyId: `${dashboardId}/${geoLevel}`,
    tableName: target.table,
    status: "failed",
    recordsInserted: 0,
    recordsFailed: 0,
    totalRowsLoaded: 0,
    rowsSkippedByMapping: 0,
    latestPeriodDate: null,
    errors: [],
    durationMs: 0,
  };

  try {
    const url = resolveCsvUrl(index, indexKey, geoLevel, target.path);
    console.log(`\n--- ${dashboardId}/${geoLevel} → ${target.table} ---`);
    const buf = await downloadFromUrl(url);
    let rows = csvParse(buf, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as Record<string, string>[];
    result.totalRowsLoaded = rows.length;
    if (rowLimit) rows = rows.slice(0, rowLimit);
    if (dateCutoff) {
      rows = rows.filter((r) => {
        const pe = (r["PERIOD END"] ?? r["period end"] ?? "").trim();
        return !pe || pe >= dateCutoff;
      });
    }

    const knownColumns = await getTableColumns(supabase, target.table);
    const { records, skipped, latestPeriodEnd } = await processRows(
      supabase,
      rows,
      geoLevel,
      target,
      knownColumns,
    );
    result.rowsSkippedByMapping = skipped;
    result.latestPeriodDate = latestPeriodEnd;

    const up = await batchUpsert(supabase, records, {
      tableName: target.table,
      conflictKeys: target.conflictKeys,
      batchSize: UPSERT_BATCH_SIZE,
    });
    result.recordsInserted = up.inserted;
    result.recordsFailed = up.failed;
    result.errors.push(...up.errors);
    result.status =
      up.failed === 0 && up.inserted > 0
        ? "success"
        : up.inserted > 0
          ? "partial"
          : "failed";
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    result.status = "failed";
    console.error(
      `  FATAL ${dashboardId}/${geoLevel}: ${result.errors.at(-1)}`,
    );
  }

  result.durationMs = Date.now() - start;
  return result;
}

async function main(): Promise<void> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  const flags = parseIncrementalFlagsFromArgv();
  const dateCutoff = getIncrementalCutoff({ frequency: "monthly", ...flags });
  const rowLimit = argValue("--limit")
    ? parseInt(argValue("--limit")!, 10)
    : undefined;

  const dashboardFilter = argValue("--dashboard");
  const geoFilter = argValue("--geo");
  const dashboardIds = dashboardFilter ? [dashboardFilter] : ALL_DASHBOARD_IDS;

  const index = await fetchIndex();
  const geoResults: ImportGeographyResult[] = [];
  let housingMarketImported = false;

  for (const id of dashboardIds) {
    const dash = getDashboard(id);
    const logger = createIngestionLogger(supabase, {
      source: "redfin",
      tableName: `redfin_dc_${id}`,
      datasetId: `redfin-dc-${id}`,
    });
    await logger.start(0);
    const geoKeys = geoFilter ? [geoFilter] : Object.keys(dash.geos);
    for (const geoLevel of geoKeys) {
      const target = dash.geos[geoLevel];
      if (!target) continue;
      const r = await importGeo(
        supabase,
        index,
        id,
        dash.indexKey,
        geoLevel,
        target,
        dateCutoff,
        rowLimit,
      );
      geoResults.push(r);
    }
    if (id === "housing_market") housingMarketImported = true;
    await logger.complete({
      recordsProcessed: geoResults.reduce(
        (s, g) => s + g.recordsInserted + g.recordsFailed,
        0,
      ),
      recordsSuccess: geoResults.reduce((s, g) => s + g.recordsInserted, 0),
      recordsError: geoResults.reduce((s, g) => s + g.recordsFailed, 0),
      errors: [],
    });
  }

  // Post-import: recompute months_of_supply once housing_market landed.
  if (housingMarketImported) {
    try {
      await runMonthsOfSupplyHook(supabase);
    } catch (err) {
      console.warn(
        `  [redfin-dc] MoS hook failed (non-fatal): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  const totalInserted = geoResults.reduce((s, g) => s + g.recordsInserted, 0);
  const totalFailed = geoResults.reduce((s, g) => s + g.recordsFailed, 0);
  const allOk = geoResults.every(
    (g) => g.status === "success" || g.status === "skipped",
  );
  const anyOk = geoResults.some(
    (g) => g.status === "success" || g.status === "partial",
  );
  const overallStatus = allOk ? "success" : anyOk ? "partial" : "failed";

  const sourceResult: ImportSourceResult = {
    source: "redfin",
    geographies: geoResults,
    overallStatus,
    totalInserted,
    totalFailed,
    totalDurationMs: Date.now() - startTime,
  };
  printSummaryBanner(sourceResult);
  await reportStatusToBackend(sourceResult);
  if (overallStatus === "failed") process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

> Note: `runMonthsOfSupplyHook` is created in Task 9.3. To keep Phase 0–8 compiling before then, create a temporary stub now and replace it in Task 9.3.

- [ ] **Step 2: Create the temporary MoS hook stub**

Create `scripts/sources/redfin-data-center/redfin-dc-mos-hook.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

/** Replaced with the real implementation in Task 9.3. */
export async function runMonthsOfSupplyHook(
  _supabase: SupabaseClient,
): Promise<void> {
  console.log("  [redfin-dc] MoS hook stub (no-op until Task 9.3).");
}
```

- [ ] **Step 3: Typecheck**

Run: `cd scripts && npx tsc --noEmit -p tsconfig.json` (or the repo's script-typecheck command; if scripts share the root `tsconfig`, run `npx tsc --noEmit` from root).
Expected: no errors in `scripts/sources/redfin-data-center/`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sources/redfin-data-center/import-redfin-dc.ts scripts/sources/redfin-data-center/redfin-dc-mos-hook.ts
git commit -m "feat(redfin-dc): CLI entry orchestrator + temporary MoS hook stub"
```

---

## Phases 1–8 — Per-dashboard migrations + live ingest

Each dashboard follows the identical pattern: create the migration (real columns below), apply it, run a limited live ingest, verify rows, then a full ingest. Because the processor is generic, **no per-dashboard code** is written here — only SQL + verification.

**Shared column definitions** (normalized, all `NUMERIC` unless noted):

<details><summary>price_drops (5 tables)</summary>

`price_drops, price_drops_mom, price_drops_yoy, average_size_of_price_drop, average_size_of_price_drop_mom, average_size_of_price_drop_yoy, percent_active_with_price_drops, percent_active_with_price_drops_mom, percent_active_with_price_drops_yoy`

</details>

<details><summary>contract_cancellations (5 tables)</summary>

`home_purchase_cancellations, home_purchase_cancellations_mom, home_purchase_cancellations_yoy, percent_of_pending_sales, percent_of_pending_sales_mom, percent_of_pending_sales_yoy`

</details>

<details><summary>delistings_relistings (5 tables)</summary>

`total_delistings, total_delistings_mom, total_delistings_yoy, total_relistings, total_relistings_mom, total_relistings_yoy, share_of_listings_delisted, share_of_listings_delisted_mom, share_of_listings_delisted_yoy, share_of_listings_relisted, share_of_listings_relisted_mom, share_of_listings_relisted_yoy`

</details>

<details><summary>housing_market (5 tables)</summary>

`homes_sold, homes_sold_mom, homes_sold_yoy, median_sale_price, median_sale_price_mom, median_sale_price_yoy, median_days_on_market, median_days_on_market_mom, median_days_on_market_yoy, average_sale_to_list_ratio, average_sale_to_list_ratio_mom, average_sale_to_list_ratio_yoy, share_sold_above_original_list, share_sold_above_original_list_mom, share_sold_above_original_list_yoy, new_listings, new_listings_mom, new_listings_yoy, active_listings, active_listings_mom, active_listings_yoy, pending_sales, pending_sales_mom, pending_sales_yoy`

</details>

<details><summary>investors_by_metro (country, metro)</summary>

`investor_home_purchases, investor_home_purchases_yoy, investor_market_share`

</details>

<details><summary>investors_by_category (1 table; text dims category_type, category, property_type)</summary>

`investor_home_purchases, investor_home_purchases_yoy, investor_market_share, share_of_investor_home_purchases`

</details>

<details><summary>cash_loan (country, metro)</summary>

`percent_all_cash, percent_all_cash_yoy, median_down_payment, median_down_payment_yoy, median_down_payment_pct, median_down_payment_pct_yoy, percent_fha_loan, percent_fha_loan_yoy, percent_va_loan, percent_va_loan_yoy, percent_conventional_loan, percent_conventional_loan_yoy, percent_conventional_conforming_loan, percent_conventional_conforming_loan_yoy, percent_conventional_jumbo_loan, percent_conventional_jumbo_loan_yoy`

</details>

<details><summary>buyers_and_sellers (country, census_region, metro; text dims property_type, balance_of_power)</summary>

`buyers, buyers_yoy, sellers, sellers_yoy, buyer_seller_ratio, buyer_seller_ratio_yoy, seller_buyer_difference, seller_buyer_difference_yoy`

</details>

<details><summary>rhpi (country, metro)</summary>

`redfin_home_price_index, redfin_home_price_index_mom, redfin_home_price_index_yoy`

</details>

---

### Task 1: price_drops (template — all phases mirror this)

**Files:**

- Create: `supabase/migrations/<ts>_create_redfin_dc_price_drops_tables.sql`

- [ ] **Step 1: Create the migration**

Run `date -u +%Y%m%d%H%M%S` to get `<ts>`. Create the file. The 5 tables share the standard columns + the price_drops metrics. ZIP/state/county/metro/country differ only in table name:

```sql
-- <ts>_create_redfin_dc_price_drops_tables.sql
-- Redfin Data Center: price drops dashboard (new CSV format, add-only).

DO $$
DECLARE
  geo TEXT;
BEGIN
  FOREACH geo IN ARRAY ARRAY['country','state','metro','county','zip'] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS redfin_dc_price_drops_%s (
        region_id   TEXT NOT NULL,
        region_name TEXT,
        period_begin DATE,
        period_end   DATE NOT NULL,
        frequency    TEXT,
        last_updated DATE,
        price_drops NUMERIC,
        price_drops_mom NUMERIC,
        price_drops_yoy NUMERIC,
        average_size_of_price_drop NUMERIC,
        average_size_of_price_drop_mom NUMERIC,
        average_size_of_price_drop_yoy NUMERIC,
        percent_active_with_price_drops NUMERIC,
        percent_active_with_price_drops_mom NUMERIC,
        percent_active_with_price_drops_yoy NUMERIC,
        PRIMARY KEY (period_end, region_id)
      );
      CREATE INDEX IF NOT EXISTS idx_redfin_dc_price_drops_%s_period
        ON redfin_dc_price_drops_%s (period_end DESC);
      GRANT ALL ON redfin_dc_price_drops_%s TO service_role, authenticated;
    $f$, geo, geo, geo, geo);
  END LOOP;
END $$;
```

- [ ] **Step 2: Apply the migration**

Apply via the project's normal mechanism (Supabase MCP `apply_migration`, or `supabase db push` against staging). Verify:

Run (psql or Supabase SQL editor): `SELECT to_regclass('public.redfin_dc_price_drops_metro');`
Expected: returns the table name (not NULL).

- [ ] **Step 3: Limited live ingest**

Run: `npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --dashboard price_drops --geo metro --limit 100`
Expected: banner shows `[OK] price_drops/metro ... N inserted, 0 failed`, latest date within ~2 months.

- [ ] **Step 4: Verify rows landed**

Run: `SELECT count(*), max(period_end) FROM redfin_dc_price_drops_metro;`
Expected: count > 0, max(period_end) recent. Spot-check one metro: `SELECT region_id, region_name, price_drops FROM redfin_dc_price_drops_metro ORDER BY period_end DESC LIMIT 3;` and compare to the CSV.

- [ ] **Step 5: Full ingest (all 5 geos)**

Run: `npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --dashboard price_drops`
Expected: all 5 geos `OK`. ZIP is the largest; confirm it completes.

- [ ] **Step 6: Regression check — score unaffected**

Run the score for 5 sample metros (CBSA 35620, 31080, 16980, 19100, 12060) via the existing scoring CLI/endpoint and confirm values are unchanged from a pre-change baseline captured in Task 9.0.
(price_drops does not feed the score, so this must be a no-op — it proves the new tables/ingest didn't disturb anything.)

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/<ts>_create_redfin_dc_price_drops_tables.sql
git commit -m "feat(redfin-dc): price_drops tables + live ingest verified"
```

---

### Tasks 2–8: remaining dashboards

Repeat Task 1's 7 steps for each dashboard below, substituting the table name(s), geo set, and column list from the **Shared column definitions**. Each is its own migration + commit.

- [ ] **Task 2: contract_cancellations** — 5 tables, columns per the contract_cancellations block. Standard PK `(period_end, region_id)`.
- [ ] **Task 3: delistings_relistings** — 5 tables, delistings_relistings columns. Standard PK.
- [ ] **Task 4: housing_market** — 5 tables, housing_market columns. Standard PK. (Feeds MoS in Phase 9 — make sure `active_listings` and `homes_sold` columns are present and populated; verify in Step 4 that both are non-null for sample rows.)
- [ ] **Task 5: investors** — 3 tables:
  - `redfin_dc_investors_country`, `redfin_dc_investors_metro`: columns `investor_home_purchases, investor_home_purchases_yoy, investor_market_share`. PK `(period_end, region_id)`.
  - `redfin_dc_investors_by_category`: text columns `category_type TEXT NOT NULL, category TEXT NOT NULL, property_type TEXT` + the 4 investor metrics. PK `(period_end, category_type, category)`. No `region_id`/`region_name` geo (national). For this table set `region_id`/`region_name` columns absent — adjust the generic processor path via `noGeo` (already handled: it sets `region_id='US'`; include a `region_id TEXT` column with default `'US'` to satisfy the record, OR omit region_id from this table and strip it in the mapper). **Decision:** include `region_id TEXT` and `region_name TEXT` columns for uniformity; `noGeo` sets region_id='US', region_name stays from CSV.
- [ ] **Task 6: cash_loan** — 2 tables (country, metro), cash_loan columns. Standard PK.
- [ ] **Task 7: buyers_and_sellers** — 3 tables (country, census_region, metro). Add `property_type TEXT NOT NULL` and `balance_of_power TEXT`. PK `(period_end, region_id, property_type)`. For census_region, region_id is the census region name (resolver returns it verbatim).
- [ ] **Task 8: rhpi** — 2 tables (country, metro), rhpi columns. Standard PK.

After Task 8: **Phase verification** — run `npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --full` (all 8 dashboards). Confirm zero `FAIL` geos in the banner and zero error rows in `data_ingestion_log` for `datasetId LIKE 'redfin-dc-%'`.

---

## Phase 9 — months_of_supply computed fallback (P2)

### Task 9.0: Capture score baseline

- [ ] **Step 1: Record current scores for 10 fixed metros**

Run the existing score for CBSA 35620, 31080, 16980, 19100, 12060, 33100, 38060, 26420, 47900, 41860 and save the JSON to `.scratch/score-baseline-2026-05-23.json` (gitignored). This is the regression oracle for Tasks 1–8 Step 6 and Task 9.4.

- [ ] **Step 2: Commit** (nothing to commit — baseline is gitignored; note it in the task log).

---

### Task 9.1: Migration — months_of_supply on calculated_metrics + compute function

**Files:**

- Create: `supabase/migrations/<ts>_add_months_of_supply_to_calculated_metrics.sql`

- [ ] **Step 1: Create the migration**

```sql
-- <ts>_add_months_of_supply_to_calculated_metrics.sql
-- Computed months_of_supply fallback, sourced from new-format housing_market.

ALTER TABLE calculated_metrics
  ADD COLUMN IF NOT EXISTS months_of_supply NUMERIC;

-- Point-in-time MoS = active listings / homes sold. NULL-safe.
CREATE OR REPLACE FUNCTION compute_months_of_supply(
  active_listings NUMERIC,
  homes_sold NUMERIC
) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN homes_sold IS NULL OR homes_sold = 0 THEN NULL
    ELSE active_listings / homes_sold
  END;
$$;

GRANT EXECUTE ON FUNCTION compute_months_of_supply(NUMERIC, NUMERIC)
  TO service_role, authenticated;
```

- [ ] **Step 2: Apply + verify**

Apply the migration. Verify:
`SELECT compute_months_of_supply(3000, 1000);` → `3`.
`SELECT compute_months_of_supply(3000, 0);` → `NULL`.
`SELECT column_name FROM information_schema.columns WHERE table_name='calculated_metrics' AND column_name='months_of_supply';` → one row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/<ts>_add_months_of_supply_to_calculated_metrics.sql
git commit -m "feat(redfin-dc): calculated_metrics.months_of_supply column + compute fn"
```

---

### Task 9.2: calculated.ts registry entry

**Files:**

- Modify: `packages/backend/src/metric-resolution/fallback-registry/calculated.ts`

- [ ] **Step 1: Add the entry**

Add to the `calculatedMetrics` object (after `affordable_home_price`):

```typescript
  months_of_supply: {
    metricId: 'months_of_supply',
    sources: [{ source: 'calculated', column: 'months_of_supply' }],
    supportsGeoInheritance: false,
  },
```

- [ ] **Step 2: Typecheck the backend**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/metric-resolution/fallback-registry/calculated.ts
git commit -m "feat(redfin-dc): register months_of_supply calculated fallback"
```

---

### Task 9.3: MoS post-import hook (replaces the stub)

**Files:**

- Modify: `scripts/sources/redfin-data-center/redfin-dc-mos-hook.ts`
- Test: `scripts/sources/redfin-data-center/__tests__/redfin-dc-mos-hook.spec.ts`

**Context:** After housing*market ingests, compute MoS per (region, period_end) from `redfin_dc_housing_market*{metro,county,zip,state}`and upsert into`calculated_metrics` (`geography_id`, `geography_type`, `period_date`, `months_of_supply`). `calculated_metrics`is keyed by`geography_id`+`geography_type`+`period_date`(confirmed in`source-fetcher.service.ts` `fetchCalculatedMetric`). Map our geo levels to its `geography_type` values (`metro`/`county`/`zip`/`state`).

- [ ] **Step 1: Write the failing test**

```typescript
import { buildMosRows } from "../redfin-dc-mos-hook";

describe("buildMosRows", () => {
  it("computes MoS and shapes calculated_metrics rows", () => {
    const hm = [
      {
        region_id: "35620",
        period_end: "2026-04-30",
        active_listings: 3000,
        homes_sold: 1000,
      },
      {
        region_id: "16980",
        period_end: "2026-04-30",
        active_listings: 2000,
        homes_sold: 0,
      },
      {
        region_id: "31080",
        period_end: "2026-04-30",
        active_listings: null,
        homes_sold: 500,
      },
    ];
    const rows = buildMosRows(hm as any, "metro");
    // 35620 → 3.0; 16980 → homes_sold 0 → skipped; 31080 → active null → skipped
    expect(rows).toEqual([
      {
        geography_id: "35620",
        geography_type: "metro",
        period_date: "2026-04-30",
        months_of_supply: 3,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-mos-hook.spec.ts`
Expected: FAIL — `buildMosRows` not exported.

- [ ] **Step 3: Implement**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { batchUpsert } from "../../lib/batch-upsert";

interface HmRow {
  region_id: string;
  period_end: string;
  active_listings: number | null;
  homes_sold: number | null;
}

/** Pure transform: housing_market rows → calculated_metrics MoS rows. */
export function buildMosRows(
  rows: HmRow[],
  geographyType: string,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    if (r.active_listings == null || !r.homes_sold) continue;
    out.push({
      geography_id: r.region_id,
      geography_type: geographyType,
      period_date: r.period_end,
      months_of_supply: r.active_listings / r.homes_sold,
    });
  }
  return out;
}

const GEO_TYPES: Array<{ table: string; type: string }> = [
  { table: "redfin_dc_housing_market_metro", type: "metro" },
  { table: "redfin_dc_housing_market_county", type: "county" },
  { table: "redfin_dc_housing_market_zip", type: "zip" },
  { table: "redfin_dc_housing_market_state", type: "state" },
];

/** Recompute months_of_supply into calculated_metrics from new-format housing_market. */
export async function runMonthsOfSupplyHook(
  supabase: SupabaseClient,
): Promise<void> {
  console.log(
    "  [redfin-dc] Recomputing months_of_supply into calculated_metrics...",
  );
  let total = 0;
  for (const { table, type } of GEO_TYPES) {
    const { data, error } = await supabase
      .from(table)
      .select("region_id, period_end, active_listings, homes_sold");
    if (error) {
      console.warn(`    skip ${table}: ${error.message}`);
      continue;
    }
    const rows = buildMosRows((data ?? []) as any, type);
    if (rows.length === 0) continue;
    const up = await batchUpsert(supabase, rows, {
      tableName: "calculated_metrics",
      conflictKeys: ["geography_id", "geography_type", "period_date"],
      batchSize: 1000,
    });
    total += up.inserted;
    console.log(`    ${type}: ${up.inserted} MoS rows upserted`);
  }
  console.log(`  [redfin-dc] MoS recompute complete: ${total} rows.`);
}
```

> If `calculated_metrics` has additional NOT NULL columns without defaults, the upsert will fail — in that case the hook must include those columns. Verify the table definition during Step 5 and adjust if needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest scripts/sources/redfin-data-center/__tests__/redfin-dc-mos-hook.spec.ts`
Expected: PASS.

- [ ] **Step 5: Live hook run + verify**

Run: `npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --dashboard housing_market`
Expected: ends with `MoS recompute complete: N rows` (N large).
Verify: `SELECT count(*) FROM calculated_metrics WHERE months_of_supply IS NOT NULL;` → > 0.
Coverage check: compare against legacy — `SELECT count(DISTINCT cbsa_code) FROM redfin_metro` vs distinct metro geography_ids with MoS; expect >95% coverage.

- [ ] **Step 6: Commit**

```bash
git add scripts/sources/redfin-data-center/redfin-dc-mos-hook.ts scripts/sources/redfin-data-center/__tests__/redfin-dc-mos-hook.spec.ts
git commit -m "feat(redfin-dc): months_of_supply post-import hook from new-format housing_market"
```

---

### Task 9.4: Wire MoS fallback into the v4 score fetcher (bulk)

**Files:**

- Modify: `packages/backend/src/scoring/v4-scoring-data-fetcher.ts`
- Test: `packages/backend/src/scoring/__tests__/v4-scoring-data-fetcher.spec.ts`

**Context (correction vs spec):** the spec said "replace the direct read with `resolveMetric('months_of_supply', …)`". That API is per-region; `fetchV4Metrics` is bulk (one paged query for all regions of a geo). Calling per-region would be thousands of queries. Instead we keep the bulk read of legacy `months_of_supply`, then do **one** bulk pass over `calculated_metrics` for the same geo+period and fill any region whose legacy MoS was null. Fallback semantics (legacy wins, computed fills gaps) are preserved; mechanism is bulk-appropriate.

- [ ] **Step 1: Write the failing test**

```typescript
import { mergeMosFallback } from "../v4-scoring-data-fetcher";

describe("mergeMosFallback", () => {
  it("fills missing months_of_supply from the calculated map; legacy wins", () => {
    const locs = [
      { location_id: "35620", months_of_supply: 2.5 }, // legacy present → keep
      { location_id: "16980" }, // missing → fill 4.0
      { location_id: "31080", months_of_supply: undefined }, // missing → fill 1.2
    ] as any[];
    const calc = new Map<string, number>([
      ["35620", 9.9],
      ["16980", 4.0],
      ["31080", 1.2],
    ]);
    mergeMosFallback(locs, calc);
    expect(locs[0].months_of_supply).toBe(2.5); // legacy preserved
    expect(locs[1].months_of_supply).toBe(4.0);
    expect(locs[2].months_of_supply).toBe(1.2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/scoring/__tests__/v4-scoring-data-fetcher.spec.ts`
Expected: FAIL — `mergeMosFallback` not exported.

- [ ] **Step 3: Implement the merge + bulk fallback fetch**

In `v4-scoring-data-fetcher.ts`, add the exported helper and a bulk calc fetch, and call them at the end of `fetchV4Metrics` before `return results`:

```typescript
/** Map geography level → calculated_metrics.geography_type. */
function calcGeographyType(geography: GeographyLevel): string {
  return String(geography); // 'metro' | 'county' | 'zip' | 'state'
}

/** Bulk-load computed months_of_supply for a geo+period into a Map<id, mos>. */
export async function fetchCalculatedMosMap(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const geoType = calcGeographyType(geography);
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("calculated_metrics")
      .select("geography_id, months_of_supply, period_date")
      .eq("geography_type", geoType)
      .eq("period_date", toEndOfMonth(periodDate))
      .not("months_of_supply", "is", null)
      .order("geography_id", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`calc MoS fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as Record<string, any>[]) {
      map.set(String(row.geography_id), Number(row.months_of_supply));
    }
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
  return map;
}

/** Fill any location missing months_of_supply from the calculated map. Legacy wins. */
export function mergeMosFallback(
  locations: Array<Record<string, any>>,
  calcMos: Map<string, number>,
): void {
  for (const loc of locations) {
    if (loc.months_of_supply == null) {
      const fallback = calcMos.get(String(loc.location_id));
      if (fallback != null) loc.months_of_supply = fallback;
    }
  }
}
```

Then near the end of `fetchV4Metrics`, before `return results;`:

```typescript
// Fallback: fill any region missing legacy months_of_supply from the
// computed source (new-format housing_market → calculated_metrics).
const needsFallback = results.some(
  (r) => (r as Record<string, any>).months_of_supply == null,
);
if (needsFallback) {
  const calcMos = await fetchCalculatedMosMap(supabase, geography, periodDate);
  mergeMosFallback(results as Array<Record<string, any>>, calcMos);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/scoring/__tests__/v4-scoring-data-fetcher.spec.ts`
Expected: PASS.

- [ ] **Step 5: Backend typecheck + full scoring test suite**

Run: `cd packages/backend && npx tsc --noEmit && npx jest src/scoring`
Expected: no type errors; scoring tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/scoring/v4-scoring-data-fetcher.ts packages/backend/src/scoring/__tests__/v4-scoring-data-fetcher.spec.ts
git commit -m "feat(redfin-dc): bulk months_of_supply fallback in v4 score fetcher"
```

---

### Task 9.5: Fallback regression verification (live)

- [ ] **Step 1: Baseline parity**

Re-run the score for the 10 baseline metros (Task 9.0). Confirm values match the baseline within ±0.5 (legacy MoS still present → fallback is a no-op).

- [ ] **Step 2: Force the fallback path**

Temporarily simulate legacy MoS loss: in a scratch query, confirm that for a metro where you NULL out legacy MoS (or pick a metro absent from legacy `redfin_metro` but present in `redfin_dc_housing_market_metro`), the score still computes using the calculated MoS. Document the metro used and the before/after MoS source.

- [ ] **Step 3: Latency check**

Time `fetchV4Metrics` for the metro level before and after the change. The added work is one extra paged query only when some region lacks legacy MoS. Confirm no material regression (the fallback query is skipped entirely when legacy is complete).

- [ ] **Step 4: Commit** (verification notes only — no code change; record results in the task log / PR description).

---

## Phase 10 — End-to-end live validation

### Task 10.1: Full pipeline E2E against real DB

- [ ] **Step 1: Full ingest**

Run: `npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts --full`
Expected: banner shows all geos across all 8 dashboards as `OK`/`PARTIAL`, zero `FAIL`. MoS hook runs after housing_market.

- [ ] **Step 2: Row + freshness audit**

For each of the 30 tables: `SELECT '<table>', count(*), max(period_end) FROM <table>;` (script it). Confirm every table has rows and a recent `max(period_end)`.

- [ ] **Step 3: Ingestion log audit**

`SELECT dataset_id, status, records_error FROM data_ingestion_log WHERE dataset_id LIKE 'redfin-dc-%' ORDER BY created_at DESC LIMIT 20;`
Expected: all `status='success'` (or `partial` with explained errors), `records_error=0`.

- [ ] **Step 4: Resolver smoke test**

From the backend, confirm `MetricResolutionService.resolveMetric('months_of_supply', 'metro', '35620')` returns a non-null value sourced from `calculated` when legacy is absent, and from `redfin` (legacy) when present. (Add a one-off script or use an existing debug endpoint.)

- [ ] **Step 5: Final score regression**

Re-run scores for the 10 baseline metros. Confirm parity with the Task 9.0 baseline.

- [ ] **Step 6: Commit / PR**

No code change in this task. Summarize the E2E results. If the user approves, prepare a PR from `develop` (do not push without explicit ask).

---

## Self-Review

**Spec coverage:**

- ✅ 8 dashboards, ~30 tables — Phases 1–8 (price_drops, contract_cancellations, delistings_relistings, housing_market, investors[×3], cash_loan[×2], buyers_and_sellers[×3], rhpi[×2]).
- ✅ New adapter parallel to legacy — Phase 0 file structure.
- ✅ index.json-driven URLs with fallback — Task 0.4.
- ✅ Geo IDs via legacy lookups + normalizer — Task 0.3.
- ✅ >10% unresolved hard-fail — Task 0.5.
- ✅ MoS computed fallback from new-format housing_market — Tasks 9.1–9.4.
- ✅ MoS fallback chain (legacy wins, computed fills) — Task 9.4 (bulk mechanism; deviation from spec's per-region wording documented inline, semantics preserved).
- ✅ Verification after each dashboard + E2E — Task 1 Step 6, Phase-8 verify, Phase 10.
- ✅ GRANTs on every table — migration template.
- ✅ Out-of-scope respected: no weekly, no city/neighborhood, no top_50 subset tables, no frontend/MCP exposure, no fallback-registry entries for new-dashboard metrics (YAGNI — no consumer yet; dropped from the original spec §2 list with rationale).

**Placeholder scan:** Migration timestamps use a real `date -u` command (not a literal placeholder); `<ts>`/`<table>` are explicit substitution instructions, not unfilled blanks. All code steps contain complete code.

**Type consistency:** `GeoTarget`, `DashboardConfig`, `ResolvedGeo`, `ProcessResult` defined in Phase 0 and used consistently. `resolveDcGeo` signature `(supabase, geoLevel, regionName)` matches its stub usage in the processor test. `buildMosRows`/`mergeMosFallback`/`fetchCalculatedMosMap` signatures consistent between Task 9.3/9.4 definitions and tests. `batchUpsert` / `downloadFromUrl` / `getIncrementalCutoff` signatures match the real lib files read during planning.

**Known deviations from spec (intentional, documented):**

1. One generic processor + config instead of 8 hand-written column-maps (DRYer; same behavior).
2. Bulk MoS fallback in the score fetcher instead of per-region `resolveMetric` (perf; same semantics).
3. New-dashboard metrics are NOT registered in the fallback registry in P1 (YAGNI — deferred with frontend/MCP exposure).

---

## Postscript: Metro CBSA mis-key bug + fail-loud guard (2026-07-04)

**Symptom.** Some metro metric cards silently blanked. Root cause: the metro
crosswalk resolved a Redfin metro NAME to a canonical CBSA geoid with a
**state-blind `%name%` substring match**, so a principal city landed on any CBSA
whose name merely contained it as a substring — e.g. `"Charlotte, NC"` filed
under CBSA **16820 = Charlottesville, VA** (also `"Kansas City" -> Arkansas
City-Winfield, KS`, `"Portland, OR" -> Portland-South Portland, ME`). A mis-key
does not error; it just points a metro at the wrong region, so downstream cards
read no data.

**Fix.** `redfin-dc-metro-crosswalk.ts` now matches on a **city token + state
token** against `tiger_cbsa` (the complete Census CBSA gazetteer — `geographies`
is missing ~11 CBSAs Redfin uses, including the 3 valid CT metros Bridgeport
14860 / Hartford 25540 / New Haven 35300). Matching is anchored + state-filtered
and tiered (full pre-comma name → hyphen components → single words); the first
tier with a UNIQUE in-state match wins, and an ambiguous/empty result returns
`null` (emit an unmapped fallback, never guess). This applied a **16-metro
remap** to the previously mis-keyed principal cities.

**New post-import guard.** `redfin-dc-metro-key-validator.ts` +
`validateRedfinDcMetroKeys(supabase)`, wired into `import-redfin-dc.ts` after the
metro upserts + MoS hook. It asserts that every DISTINCT
`(region_id, region_name)` in `redfin_dc_housing_market_metro` (the metro
superset) has a stored `region_name` state that agrees with the canonical CBSA
state for its `region_id`, joined against **`tiger_cbsa`** (NOT `geographies`).
Any violation (`STATE_MISMATCH` / `NO_CANONICAL_CBSA` / `NON_NUMERIC_KEY`) is
logged per-row and **throws**, so the monthly pipeline job exits non-zero instead
of publishing a silently-broken metro. Verified: returns 0 violations against
live prod. Tests: `__tests__/redfin-dc-metro-key-validator.spec.ts`.
