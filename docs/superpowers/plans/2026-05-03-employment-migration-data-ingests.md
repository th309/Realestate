# Employment & Migration Data Ingests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four backend data ingests (BLS CES, BLS QCEW extension, Redfin Migration, IRS SOI) so 22 new metric scalars and two flow fetchers are queryable through `@/lib/data`, the existing `MetricResolutionService`, and the MCP server.

**Architecture:** Storage extends existing wide tables (`economic_metro`, `economic_county`, `economic_state`) with sector columns and adds three new tables (`redfin_migration_metro`, `redfin_migration_flows_metro`, `irs_county_migration_flows`, `irs_migration_county_aggregates`). Ingest scripts live under `scripts/` mirroring existing patterns. Backend exposure goes through `MetricResolutionService` for scalars (zero new metric endpoints) and one new `MigrationModule` for flows. Frontend exposure: 22 new `registry.ts` entries (work with existing `useSnapshotData`/`useTimeSeriesData`) plus one new `migration-flows.ts` fetcher exception. Three MCP tools wrap the REST endpoints.

**Tech Stack:** TypeScript, NestJS 11, Supabase (Postgres), React Query, Jest, BLS public API, Redfin S3 TSV, IRS SOI XLSX, Node 18+ `fetch`, GitHub Actions.

**Branch:** `feat/employment-migration-ingests` (already cut from `main`). Spec at `docs/superpowers/specs/2026-05-03-employment-migration-data-ingests-design.md`.

---

## Plan ground rules (per spec §9.1 and §9.2)

- **TDD pairs.** Every implementation task is preceded by a failing-test task. No production code is written before its test exists.
- **Real-world fixtures.** Parser fixtures are captured from the live source (`curl`, IRS download, Redfin S3) and committed under `__fixtures__/`. No synthetic CSV/TSV/XLSX guessed from documentation.
- **Hermeneutic verification after each change.** After a task lands, run the verification commands in its "Verify" step before moving on. A failed verification halts the plan.
- **Frequent commits.** Each task ends with a commit. Push at phase boundaries.
- **No placeholders.** If a step references a constant, identifier, or fixture, it has been defined earlier in the plan.

## File structure to be created or modified

### Migrations (`supabase/migrations/`)

- Create: `20260503000100_qcew_sector_columns.sql`
- Create: `20260503000200_ces_sector_columns.sql`
- Create: `20260503000300_redfin_migration_tables.sql`
- Create: `20260503000400_irs_migration_tables.sql`

### Backend types & metric resolution

- Modify: `packages/backend/src/metric-resolution/metric-resolution.types.ts` — extend `DataSource` union with `'ces' | 'qcew' | 'irs' | 'redfin_migration'`
- Modify: `packages/backend/src/metric-resolution/table-routes.ts` — add routes for `ces`, `qcew`, `irs`, `redfin_migration`
- Modify: `packages/backend/src/metric-resolution/source-fetcher.service.ts` — wire new sources into `getWideTableRoute` switch
- Modify: `packages/backend/src/metric-resolution/fallback-registry.ts` — append 22 metric entries

### Backend MigrationModule (new)

- Create: `packages/backend/src/migration/migration.module.ts`
- Create: `packages/backend/src/migration/migration.controller.ts`
- Create: `packages/backend/src/migration/migration.service.ts`
- Create: `packages/backend/src/migration/dto/get-flows.dto.ts`
- Create: `packages/backend/src/migration/__tests__/migration.service.spec.ts`
- Create: `packages/backend/src/migration/__tests__/migration.controller.spec.ts`
- Modify: `packages/backend/src/app.module.ts` — register `MigrationModule`

### Ingest scripts

- Modify: `scripts/download-qcew-employment.ts` — extend with sector loop + new columns
- Create: `scripts/sources/census-economic/ces-importer.ts`
- Create: `scripts/sources/census-economic/__tests__/ces-importer.spec.ts`
- Create: `scripts/sources/census-economic/__fixtures__/ces-batch-sample.json`
- Create: `scripts/sources/redfin/redfin-migration-download.ts`
- Create: `scripts/sources/redfin/__tests__/redfin-migration-download.spec.ts`
- Create: `scripts/sources/redfin/__fixtures__/redfin-migration-sample.tsv`
- Create: `scripts/download-irs-migration.ts`
- Create: `scripts/__tests__/irs-migration.spec.ts`
- Create: `scripts/__fixtures__/irs-county-inflow-2023.xlsx`
- Create: `scripts/__fixtures__/irs-county-outflow-2023.xlsx`
- Create: `scripts/__fixtures__/qcew-2023q4-industry-1012.csv`

### Frontend data layer

- Modify: `packages/frontend/lib/data/types.ts` — extend `DataSource` with `'bls' | 'irs'`
- Modify: `packages/frontend/lib/data/registry.ts` — append 22 metric entries
- Create: `packages/frontend/lib/data/fetchers/migration-flows.ts`
- Create: `packages/frontend/lib/data/fetchers/__tests__/migration-flows.spec.ts`
- Modify: `packages/frontend/lib/data/index.ts` — export `fetchMigrationFlows` + `useMigrationFlows`

### MCP server tools

- Create: `packages/mcp-server/src/tools/employment.ts`
- Create: `packages/mcp-server/src/tools/migration.ts`
- Create: `packages/mcp-server/src/tools/__tests__/employment.spec.ts`
- Create: `packages/mcp-server/src/tools/__tests__/migration.spec.ts`
- Modify: `packages/mcp-server/src/index.ts` (or wherever the tool registry is wired) — register new tools

### CI / cron

- Modify: `.github/workflows/economic-monthly-import.yml` — add 4 new jobs

---

## Phase 0 — Foundation (no ingest yet)

### Task 0.1: Extend backend `DataSource` union

**Files:**

- Modify: `packages/backend/src/metric-resolution/metric-resolution.types.ts`

- [ ] **Step 1: Edit the union**

```ts
// metric-resolution.types.ts (around line 13)
export type DataSource =
  | "zillow"
  | "realtor"
  | "redfin"
  | "census"
  | "economic"
  | "calculated"
  | "permits"
  | "hud_fmr"
  | "ces"
  | "qcew"
  | "irs"
  | "redfin_migration";
```

- [ ] **Step 2: Run backend type check**

```
cd packages/backend && npx tsc --noEmit
```

Expected: Same baseline ~110 pre-existing errors as before, **zero new errors**. (Per project memory, P1 tsc debt exists in scoring/backtest tests; ignore.)

- [ ] **Step 3: Commit**

```
git add packages/backend/src/metric-resolution/metric-resolution.types.ts
git commit -m "feat(metric-resolution): extend DataSource union for employment+migration sources"
```

### Task 0.2: Extend frontend `DataSource` union

**Files:**

- Modify: `packages/frontend/lib/data/types.ts`

- [ ] **Step 1: Edit the union**

```ts
// types.ts (around line 44)
export type DataSource =
  | "zillow"
  | "realtor"
  | "redfin"
  | "calculated"
  | "census"
  | "fred"
  | "propertyiq"
  | "bls" // covers both CES and QCEW for the user-facing label
  | "irs"
  | "redfin_migration";
```

- [ ] **Step 2: Update `DATA_DATES` and `DATA_SOURCE_ANCHORS`**

Modify: `packages/frontend/lib/data/registry.ts` lines around `DATA_DATES` and `DATA_SOURCE_ANCHORS`:

```ts
export const DATA_DATES: Record<DataSource, string> = {
  zillow: "2025-11-30",
  realtor: "2025-12-01",
  redfin: "2025-12-01",
  census: "2024",
  calculated: "2025-12-01",
  fred: "2025-09-01",
  propertyiq: "2025-12-01",
  bls: "2025-12-01", // updated by importer
  irs: "2023",
  redfin_migration: "2025-12-01",
};

export const DATA_SOURCE_ANCHORS: Record<DataSource, string> = {
  zillow: "zillow",
  realtor: "realtor-com",
  redfin: "redfin",
  census: "census",
  calculated: "propertyiq",
  fred: "fred",
  propertyiq: "propertyiq",
  bls: "bls",
  irs: "irs",
  redfin_migration: "redfin",
};
```

- [ ] **Step 3: Frontend tsc**

```
cd packages/frontend && npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```
git add packages/frontend/lib/data/types.ts packages/frontend/lib/data/registry.ts
git commit -m "feat(lib/data): extend DataSource union for BLS, IRS, Redfin Migration"
```

### Task 0.3: Migration 057 (qcew_sector_columns) — failing apply test

**Files:**

- Create: `supabase/migrations/20260503000100_qcew_sector_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260503000100_qcew_sector_columns.sql
-- Adds 11 NAICS supersector employment columns + wage/establishment counts to
-- economic_county and economic_metro. QCEW source.

ALTER TABLE economic_county
  ADD COLUMN IF NOT EXISTS employment_natural_resources_mining BIGINT,
  ADD COLUMN IF NOT EXISTS employment_construction BIGINT,
  ADD COLUMN IF NOT EXISTS employment_manufacturing BIGINT,
  ADD COLUMN IF NOT EXISTS employment_trade_transport_utilities BIGINT,
  ADD COLUMN IF NOT EXISTS employment_information BIGINT,
  ADD COLUMN IF NOT EXISTS employment_financial_activities BIGINT,
  ADD COLUMN IF NOT EXISTS employment_professional_business_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_education_health_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_leisure_hospitality BIGINT,
  ADD COLUMN IF NOT EXISTS employment_other_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_public_administration BIGINT,
  ADD COLUMN IF NOT EXISTS qcew_avg_weekly_wage NUMERIC,
  ADD COLUMN IF NOT EXISTS qcew_total_establishments INT;

ALTER TABLE economic_metro
  ADD COLUMN IF NOT EXISTS employment_natural_resources_mining BIGINT,
  ADD COLUMN IF NOT EXISTS employment_construction BIGINT,
  ADD COLUMN IF NOT EXISTS employment_manufacturing BIGINT,
  ADD COLUMN IF NOT EXISTS employment_trade_transport_utilities BIGINT,
  ADD COLUMN IF NOT EXISTS employment_information BIGINT,
  ADD COLUMN IF NOT EXISTS employment_financial_activities BIGINT,
  ADD COLUMN IF NOT EXISTS employment_professional_business_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_education_health_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_leisure_hospitality BIGINT,
  ADD COLUMN IF NOT EXISTS employment_other_services BIGINT,
  ADD COLUMN IF NOT EXISTS employment_public_administration BIGINT,
  ADD COLUMN IF NOT EXISTS qcew_avg_weekly_wage NUMERIC,
  ADD COLUMN IF NOT EXISTS qcew_total_establishments INT;

-- Roll-back is implicit via DROP COLUMN IF EXISTS — no separate down migration
-- (Supabase migrations are forward-only by project convention).
```

- [ ] **Step 2: Apply on a Supabase branch**

User executes (cannot be automated by implementer per project policy):

```
node scripts/apply-content-pipeline-migrations.js          # if this script also covers main migrations
# OR via supabase MCP / CLI:
supabase db push --db-url <branch-url>
```

- [ ] **Step 3: Verify columns exist**

Run via Supabase MCP `execute_sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'economic_county'
  AND column_name LIKE 'employment_%' OR column_name LIKE 'qcew_%'
ORDER BY column_name;
```

Expected: all 13 new columns present.

- [ ] **Step 4: Verify hermeneutic invariant — total_nonfarm_employment unaffected**

```sql
SELECT COUNT(*) FROM economic_county WHERE total_nonfarm_employment IS NOT NULL;
```

Expected: same count as before migration (run prior to apply for baseline).

- [ ] **Step 5: Commit**

```
git add supabase/migrations/20260503000100_qcew_sector_columns.sql
git commit -m "feat(db): add QCEW sector columns to economic_county/metro"
```

### Task 0.4: Migration (ces_sector_columns)

**Files:**

- Create: `supabase/migrations/20260503000200_ces_sector_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260503000200_ces_sector_columns.sql
-- CES sector employment for metro and state. Prefixed ces_ to disambiguate
-- from QCEW columns sharing the economic_metro table. ces_period_date tracks
-- CES "as-of" independent of QCEW (CES updates monthly; QCEW quarterly).

ALTER TABLE economic_metro
  ADD COLUMN IF NOT EXISTS ces_employment_natural_resources_mining BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_construction BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_manufacturing BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_trade_transport_utilities BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_information BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_financial_activities BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_professional_business_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_education_health_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_leisure_hospitality BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_other_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_public_administration BIGINT,
  ADD COLUMN IF NOT EXISTS ces_period_date DATE;

ALTER TABLE economic_state
  ADD COLUMN IF NOT EXISTS ces_employment_natural_resources_mining BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_construction BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_manufacturing BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_trade_transport_utilities BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_information BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_financial_activities BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_professional_business_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_education_health_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_leisure_hospitality BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_other_services BIGINT,
  ADD COLUMN IF NOT EXISTS ces_employment_public_administration BIGINT,
  ADD COLUMN IF NOT EXISTS ces_period_date DATE;
```

- [ ] **Step 2: Apply migration** (user-executed; same pattern as Task 0.3)

- [ ] **Step 3: Verify**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('economic_metro', 'economic_state')
  AND column_name LIKE 'ces_%'
ORDER BY table_name, column_name;
```

Expected: 12 columns × 2 tables = 24 rows.

- [ ] **Step 4: Commit**

```
git add supabase/migrations/20260503000200_ces_sector_columns.sql
git commit -m "feat(db): add CES sector columns to economic_metro/state"
```

### Task 0.5: Migration (redfin_migration_tables)

**Files:**

- Create: `supabase/migrations/20260503000300_redfin_migration_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260503000300_redfin_migration_tables.sql
CREATE TABLE IF NOT EXISTS redfin_migration_metro (
  cbsa_code TEXT NOT NULL,
  region_name TEXT,
  period_date DATE NOT NULL,
  net_inflow NUMERIC,
  inflow_share_pct NUMERIC,
  outflow_share_pct NUMERIC,
  total_users INT,
  PRIMARY KEY (cbsa_code, period_date)
);
CREATE INDEX IF NOT EXISTS idx_redfin_migration_metro_period
  ON redfin_migration_metro(period_date DESC);

CREATE TABLE IF NOT EXISTS redfin_migration_flows_metro (
  origin_cbsa TEXT NOT NULL,
  destination_cbsa TEXT NOT NULL,
  period_date DATE NOT NULL,
  share_pct NUMERIC,
  net_searches INT,
  PRIMARY KEY (origin_cbsa, destination_cbsa, period_date)
);
CREATE INDEX IF NOT EXISTS idx_redfin_flows_dest
  ON redfin_migration_flows_metro(destination_cbsa, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_redfin_flows_origin
  ON redfin_migration_flows_metro(origin_cbsa, period_date DESC);

GRANT ALL ON redfin_migration_metro TO service_role, authenticated;
GRANT ALL ON redfin_migration_flows_metro TO service_role, authenticated;
```

- [ ] **Step 2: Apply migration** (user-executed)

- [ ] **Step 3: Verify**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('redfin_migration_metro', 'redfin_migration_flows_metro');
```

Expected: 2 rows. Plus `\d redfin_migration_flows_metro` shows the indexes.

- [ ] **Step 4: Commit**

```
git add supabase/migrations/20260503000300_redfin_migration_tables.sql
git commit -m "feat(db): add Redfin Migration metro + flows tables"
```

### Task 0.6: Migration (irs_migration_tables)

**Files:**

- Create: `supabase/migrations/20260503000400_irs_migration_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260503000400_irs_migration_tables.sql
-- origin_fips reserves: '00000' = non-migrants, '99999' = foreign
CREATE TABLE IF NOT EXISTS irs_county_migration_flows (
  origin_fips TEXT NOT NULL,
  destination_fips TEXT NOT NULL,
  tax_year INT NOT NULL,
  num_returns INT NOT NULL,
  num_exemptions INT NOT NULL,
  agi_thousands BIGINT,
  PRIMARY KEY (origin_fips, destination_fips, tax_year)
);
CREATE INDEX IF NOT EXISTS idx_irs_flows_dest
  ON irs_county_migration_flows(destination_fips, tax_year DESC);
CREATE INDEX IF NOT EXISTS idx_irs_flows_origin
  ON irs_county_migration_flows(origin_fips, tax_year DESC);

CREATE TABLE IF NOT EXISTS irs_migration_county_aggregates (
  county_fips TEXT NOT NULL,
  tax_year INT NOT NULL,
  in_returns INT,
  out_returns INT,
  net_returns INT,
  in_exemptions INT,
  out_exemptions INT,
  in_agi_thousands BIGINT,
  out_agi_thousands BIGINT,
  in_avg_agi NUMERIC,
  out_avg_agi NUMERIC,
  PRIMARY KEY (county_fips, tax_year)
);

GRANT ALL ON irs_county_migration_flows TO service_role, authenticated;
GRANT ALL ON irs_migration_county_aggregates TO service_role, authenticated;
```

- [ ] **Step 2: Apply migration** (user-executed)

- [ ] **Step 3: Verify**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'irs_%';
```

Expected: 2 rows.

- [ ] **Step 4: Commit**

```
git add supabase/migrations/20260503000400_irs_migration_tables.sql
git commit -m "feat(db): add IRS county migration flows + aggregates tables"
```

### Task 0.7: Extend `table-routes.ts` for new sources

**Files:**

- Modify: `packages/backend/src/metric-resolution/table-routes.ts`

- [ ] **Step 1: Add route helper functions**

At the bottom of the file, before the final `}` of the module (or at end of exports):

```ts
export function getQcewRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case "county":
      return {
        table: "economic_county",
        idColumn: "fips_code",
        dateColumn: "period_date",
      };
    case "metro":
      return {
        table: "economic_metro",
        idColumn: "cbsa_code",
        dateColumn: "period_date",
      };
    default:
      return null;
  }
}

export function getCesRoute(geoLevel: GeoLevel): TableRoute | null {
  switch (geoLevel) {
    case "metro":
      return {
        table: "economic_metro",
        idColumn: "cbsa_code",
        dateColumn: "ces_period_date",
      };
    case "state":
      return {
        table: "economic_state",
        idColumn: "state_fips",
        dateColumn: "ces_period_date",
      };
    default:
      return null;
  }
}

export function getRedfinMigrationRoute(geoLevel: GeoLevel): TableRoute | null {
  if (geoLevel !== "metro") return null;
  return {
    table: "redfin_migration_metro",
    idColumn: "cbsa_code",
    dateColumn: "period_date",
  };
}

export function getIrsRoute(geoLevel: GeoLevel): TableRoute | null {
  if (geoLevel !== "county") return null;
  return {
    table: "irs_migration_county_aggregates",
    idColumn: "county_fips",
    dateColumn: "tax_year", // INT column, not DATE — service must coerce when comparing
  };
}
```

- [ ] **Step 2: Wire into `getWideTableRoute`**

```ts
export function getWideTableRoute(
  source: DataSource,
  geoLevel: GeoLevel,
): TableRoute | null {
  switch (source) {
    case "realtor":
      return getRealtorRoute(geoLevel);
    case "census":
      return getCensusRoute(geoLevel);
    case "economic":
      return getEconomicRoute(geoLevel);
    case "permits":
      return getPermitsRoute(geoLevel);
    case "qcew":
      return getQcewRoute(geoLevel);
    case "ces":
      return getCesRoute(geoLevel);
    case "redfin_migration":
      return getRedfinMigrationRoute(geoLevel);
    case "irs":
      return getIrsRoute(geoLevel);
    default:
      return null;
  }
}
```

- [ ] **Step 3: tsc check**

```
cd packages/backend && npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```
git add packages/backend/src/metric-resolution/table-routes.ts
git commit -m "feat(metric-resolution): add table routes for ces/qcew/irs/redfin_migration"
```

### Task 0.8: Verify hermeneutic invariant — existing metrics resolve unchanged

This is a **verify-only** task — no code change. Per spec §9.2 row 4 ("CES added to FALLBACK_REGISTRY → snapshot test").

- [ ] **Step 1: Capture baseline of existing metric resolutions**

Pick 5 representative existing metrics and run a query for each via Supabase MCP:

```sql
-- baseline_home_value_metro_35620
SELECT zhvi FROM zillow_metro WHERE cbsa_code = '35620' ORDER BY period_date DESC LIMIT 1;
-- baseline_unemployment_rate_county_37183
SELECT unemployment_rate FROM economic_county WHERE fips_code = '37183' ORDER BY period_date DESC LIMIT 1;
-- baseline_total_nonfarm_employment_metro_39580
SELECT total_nonfarm_employment FROM economic_metro WHERE cbsa_code = '39580' ORDER BY period_date DESC LIMIT 1;
-- baseline_median_listing_price_metro_35620
SELECT median_listing_price FROM realtor_metro WHERE cbsa_code = '35620' ORDER BY period_date DESC LIMIT 1;
-- baseline_pop_density_county_37183
SELECT density_per_sqmi FROM census_county WHERE fips_code = '37183';
```

Save the values to `tasks/baselines-2026-05-03.md`.

- [ ] **Step 2: Verify the corresponding `useSnapshotData` resolutions**

Hit the dev backend (or a test backend) once for each:

```
GET /api/metrics/home_value/metro/35620
GET /api/metrics/unemployment_rate/county/37183
GET /api/metrics/total_nonfarm_employment/metro/39580
GET /api/metrics/listing_price/metro/35620
GET /api/metrics/pop_density/county/37183
```

Each must return the same value as the SQL baseline. If any drifts, halt the plan — there's a route collision in Task 0.7.

- [ ] **Step 3: Commit baseline doc**

```
git add tasks/baselines-2026-05-03.md
git commit -m "docs(plan): baseline metric values pre-employment-migration ingest"
```

---

## Phase 1 — QCEW sector ingest (extend existing)

### Task 1.1: Capture QCEW sector fixture

**Files:**

- Create: `scripts/__fixtures__/qcew-2023q4-industry-1012.csv` (construction supersector, ~5 MB raw, but we'll snip to first 200 rows for the test fixture)
- Create: `scripts/__fixtures__/qcew-2023q4-industry-10.csv` (total nonfarm, first 200 rows — sanity check that existing total path still parses)

- [ ] **Step 1: Pull live data**

```
curl 'https://data.bls.gov/cew/data/api/2023/4/industry/1012.csv' \
  -o /tmp/qcew-2023q4-construction-full.csv
curl 'https://data.bls.gov/cew/data/api/2023/4/industry/10.csv' \
  -o /tmp/qcew-2023q4-total-full.csv
```

- [ ] **Step 2: Trim to fixture-sized files**

```
head -201 /tmp/qcew-2023q4-construction-full.csv \
  > scripts/__fixtures__/qcew-2023q4-industry-1012.csv
head -201 /tmp/qcew-2023q4-total-full.csv \
  > scripts/__fixtures__/qcew-2023q4-industry-10.csv
```

- [ ] **Step 3: Commit fixtures**

```
git add scripts/__fixtures__/qcew-2023q4-industry-1012.csv scripts/__fixtures__/qcew-2023q4-industry-10.csv
git commit -m "test(qcew): real-world fixtures for q4 2023 sectors 10 + 1012"
```

### Task 1.2: Write failing parser test for QCEW sector loop

**Files:**

- Create: `scripts/__tests__/download-qcew-employment.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// scripts/__tests__/download-qcew-employment.spec.ts
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseQcewSectorRows,
  NAICS_SUPERSECTORS,
} from "../download-qcew-employment";

describe("parseQcewSectorRows", () => {
  it("returns one row per (geo, sector) for sector 1012 (construction)", () => {
    const csv = readFileSync(
      join(__dirname, "..", "__fixtures__", "qcew-2023q4-industry-1012.csv"),
      "utf-8",
    );
    const rows = parseQcewSectorRows(csv, "1012");
    // Sample county/metro rows expected; private-sector own_code=5 only
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.sectorKey === "construction")).toBe(true);
    expect(rows.every((r) => typeof r.month3Emplvl === "number")).toBe(true);
  });

  it("returns one row per geo for industry 10 (total) using all-owners filter", () => {
    const csv = readFileSync(
      join(__dirname, "..", "__fixtures__", "qcew-2023q4-industry-10.csv"),
      "utf-8",
    );
    const rows = parseQcewSectorRows(csv, "10");
    expect(rows.every((r) => r.sectorKey === "total_nonfarm_employment")).toBe(
      true,
    );
    // own_code: 0 (total) is the all-owners summary — verify filter logic
    expect(rows.length).toBeGreaterThan(10);
  });

  it("exposes 11 NAICS supersectors plus total in the registry", () => {
    expect(Object.keys(NAICS_SUPERSECTORS)).toHaveLength(11);
    expect(NAICS_SUPERSECTORS["1012"]).toBe("construction");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```
cd /d/projects/rei-platform && npx jest scripts/__tests__/download-qcew-employment.spec.ts
```

Expected: FAIL — `parseQcewSectorRows is not a function`.

- [ ] **Step 3: Commit failing test**

```
git add scripts/__tests__/download-qcew-employment.spec.ts
git commit -m "test(qcew): failing test for sector parser"
```

### Task 1.3: Implement QCEW sector parser

**Files:**

- Modify: `scripts/download-qcew-employment.ts`

- [ ] **Step 1: Add `NAICS_SUPERSECTORS` map and `parseQcewSectorRows`**

```ts
// At the top of scripts/download-qcew-employment.ts, after imports:

export const NAICS_SUPERSECTORS: Record<string, string> = {
  "1011": "natural_resources_mining",
  "1012": "construction",
  "1013": "manufacturing",
  "1021": "trade_transport_utilities",
  "1022": "information",
  "1023": "financial_activities",
  "1024": "professional_business_services",
  "1025": "education_health_services",
  "1026": "leisure_hospitality",
  "1027": "other_services",
  "1028": "public_administration",
};

export interface QcewParsedRow {
  areaFips: string;
  sectorKey: string; // 'construction' or 'total_nonfarm_employment'
  month3Emplvl: number; // last month of quarter (use as the "level")
  avgWeeklyWage: number | null;
  qtrlyEstabs: number | null;
  year: number;
  qtr: number;
}

export function parseQcewSectorRows(
  csv: string,
  industryCode: string,
): QcewParsedRow[] {
  const lines = csv.trim().split("\n");
  const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const idx = (col: string) => header.indexOf(col);

  const isTotal = industryCode === "10";
  const sectorKey = isTotal
    ? "total_nonfarm_employment"
    : NAICS_SUPERSECTORS[industryCode];
  if (!sectorKey) {
    throw new Error(`Unknown QCEW industry code: ${industryCode}`);
  }

  const ownAllowed = isTotal ? new Set(["0"]) : new Set(["5"]);

  const rows: QcewParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
    const ownCode = cols[idx("own_code")];
    if (!ownAllowed.has(ownCode)) continue;

    const aggLvl = cols[idx("agglvl_code")];
    // 70 = state-by-industry, 71/72/73 = county-by-industry totals; 30s = metro
    if (!["70", "71", "72", "73", "30", "32", "33", "34"].includes(aggLvl))
      continue;

    const areaFips = cols[idx("area_fips")];
    const month3 = parseInt(cols[idx("month3_emplvl")] || "0", 10);
    const avgWeeklyWage =
      parseInt(cols[idx("avg_wkly_wage")] || "0", 10) || null;
    const qtrlyEstabs = parseInt(cols[idx("qtrly_estabs")] || "0", 10) || null;
    const year = parseInt(cols[idx("year")], 10);
    const qtr = parseInt(cols[idx("qtr")], 10);

    rows.push({
      areaFips,
      sectorKey,
      month3Emplvl: month3,
      avgWeeklyWage,
      qtrlyEstabs,
      year,
      qtr,
    });
  }
  return rows;
}
```

- [ ] **Step 2: Run test, expect pass**

```
cd /d/projects/rei-platform && npx jest scripts/__tests__/download-qcew-employment.spec.ts
```

Expected: PASS, 3/3.

- [ ] **Step 3: Commit**

```
git add scripts/download-qcew-employment.ts scripts/__tests__/download-qcew-employment.spec.ts
git commit -m "feat(qcew): parseQcewSectorRows for 11 NAICS supersectors"
```

### Task 1.4: Wire QCEW sector loop into the importer entry point

**Files:**

- Modify: `scripts/download-qcew-employment.ts` (the `main()` or run loop)

- [ ] **Step 1: Loop over sectors and upsert**

In the existing `main()` after the year/quarter args are parsed, add:

```ts
const SECTOR_CODES = ["10", ...Object.keys(NAICS_SUPERSECTORS)]; // total + 11

for (const code of SECTOR_CODES) {
  const csv = await downloadQcewIndustry(year, qtr, code); // existing helper
  const rows = parseQcewSectorRows(csv, code);

  // Group by areaFips so we upsert one row per (geo, period_date)
  const grouped = new Map<string, Partial<Record<string, number | null>>>();
  for (const r of rows) {
    const key = r.areaFips;
    if (!grouped.has(key)) grouped.set(key, {});
    const target = grouped.get(key)!;
    if (r.sectorKey === "total_nonfarm_employment") {
      target.total_nonfarm_employment = r.month3Emplvl;
    } else {
      (target as any)[`employment_${r.sectorKey}`] = r.month3Emplvl;
    }
    target.qcew_avg_weekly_wage = r.avgWeeklyWage;
    target.qcew_total_establishments = r.qtrlyEstabs;
  }

  for (const [areaFips, fields] of grouped) {
    const periodDate = quarterEndDate(year, qtr); // existing helper or add: e.g. 2023q4 -> '2023-12-31'
    await upsertEconomicRow(areaFips, periodDate, fields); // existing helper
  }
}
```

- [ ] **Step 2: Add `quarterEndDate` if it doesn't exist**

```ts
function quarterEndDate(year: number, qtr: number): string {
  const month = qtr * 3; // q1=3, q2=6, q3=9, q4=12
  const lastDay = month === 6 ? 30 : month === 9 ? 30 : month === 3 ? 31 : 31;
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}
```

- [ ] **Step 3: Manual verification — run for one quarter**

```
cd /d/projects/rei-platform && npx ts-node scripts/download-qcew-employment.ts --year 2023 --qtr 4 --counties --dry-run
```

Expected: log line "would upsert N rows" with N > 1000.

- [ ] **Step 4: Live run on a test branch**

```
npx ts-node scripts/download-qcew-employment.ts --year 2023 --qtr 4 --counties
```

Expected: 11 sector columns + total + wage/establishments populated for Wake County (37183).

Verify via Supabase MCP `execute_sql`:

```sql
SELECT employment_construction, employment_manufacturing, qcew_avg_weekly_wage, total_nonfarm_employment
FROM economic_county WHERE fips_code = '37183' AND period_date = '2023-12-31';
```

Expected: all four fields populated.

- [ ] **Step 5: Hermeneutic check — total_nonfarm_employment unchanged**

```sql
SELECT COUNT(*) FROM economic_county WHERE total_nonfarm_employment IS NOT NULL;
```

Expected: ≥ baseline count from Task 0.8.

- [ ] **Step 6: Commit**

```
git add scripts/download-qcew-employment.ts
git commit -m "feat(qcew): extend importer with 11-sector loop + wage/establishments"
```

---

## Phase 2 — CES sector ingest (new)

### Task 2.1: Capture CES batch fixture

**Files:**

- Create: `scripts/sources/census-economic/__fixtures__/ces-batch-sample.json`

- [ ] **Step 1: Identify five real CES series IDs**

Use seriesId format `SMU<state><area><supersector><datatype><seasadj>`:

- `SMU3739580202000001` — Raleigh-Cary, NC, construction (datatype 01 = all employees)
- `SMU3739580303000001` — Raleigh-Cary, manufacturing
- `SMS37000000000000001` — North Carolina state total nonfarm
- `SMU0635620203000001` — New York-Newark-Jersey City, construction
- `SMU0635620909000001` — New York-Newark-Jersey City, leisure & hospitality

- [ ] **Step 2: Pull from BLS API**

```
curl -X POST 'https://api.bls.gov/publicAPI/v2/timeseries/data/' \
  -H 'Content-Type: application/json' \
  -d '{"seriesid":["SMU3739580202000001","SMU3739580303000001","SMS37000000000000001","SMU0635620203000001","SMU0635620909000001"],"startyear":"2023","endyear":"2023"}' \
  > scripts/sources/census-economic/__fixtures__/ces-batch-sample.json
```

- [ ] **Step 3: Sanity-check JSON shape**

```
jq '.Results.series | length' scripts/sources/census-economic/__fixtures__/ces-batch-sample.json
```

Expected: 5

- [ ] **Step 4: Commit fixture**

```
git add scripts/sources/census-economic/__fixtures__/ces-batch-sample.json
git commit -m "test(ces): real-world fixture for 5-series batch"
```

### Task 2.2: Failing test for CES parser

**Files:**

- Create: `scripts/sources/census-economic/__tests__/ces-importer.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseCesBatchResponse,
  parseCesSeriesId,
  CES_SUPERSECTORS,
} from "../ces-importer";

describe("parseCesSeriesId", () => {
  it("decomposes a metro series ID", () => {
    const parsed = parseCesSeriesId("SMU3739580202000001");
    expect(parsed).toEqual({
      level: "metro",
      stateFips: "37",
      areaCode: "39580",
      supersectorCode: "20", // construction
      datatype: "01",
      sectorKey: "construction",
    });
  });

  it("decomposes a state series ID", () => {
    const parsed = parseCesSeriesId("SMS37000000000000001");
    expect(parsed).toEqual({
      level: "state",
      stateFips: "37",
      areaCode: "00000",
      supersectorCode: "00",
      datatype: "01",
      sectorKey: "total_nonfarm",
    });
  });
});

describe("parseCesBatchResponse", () => {
  const json = JSON.parse(
    readFileSync(
      join(__dirname, "..", "__fixtures__", "ces-batch-sample.json"),
      "utf-8",
    ),
  );

  it("returns one row per series × month", () => {
    const rows = parseCesBatchResponse(json);
    // 5 series × ~12 months = up to 60 rows
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.every((r) => typeof r.value === "number")).toBe(true);
  });

  it("groups by (level, areaCode, periodDate) when projecting upserts", () => {
    const rows = parseCesBatchResponse(json);
    const raleighDec = rows.filter(
      (r) => r.areaCode === "39580" && r.periodDate === "2023-12-01",
    );
    // Expect both construction (sector 20) and manufacturing (30) for that month
    expect(raleighDec.length).toBe(2);
  });

  it("exports all 11 CES_SUPERSECTORS", () => {
    expect(Object.keys(CES_SUPERSECTORS)).toHaveLength(11);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```
cd /d/projects/rei-platform && npx jest scripts/sources/census-economic/__tests__/ces-importer.spec.ts
```

Expected: FAIL — `parseCesSeriesId is not a function`.

- [ ] **Step 3: Commit**

```
git add scripts/sources/census-economic/__tests__/ces-importer.spec.ts
git commit -m "test(ces): failing test for series-id + batch-response parser"
```

### Task 2.3: Implement CES parser + importer

**Files:**

- Create: `scripts/sources/census-economic/ces-importer.ts`

- [ ] **Step 1: Implement**

```ts
// scripts/sources/census-economic/ces-importer.ts
import { fetchBlsBatch } from "./bls-api-client"; // existing helper
import { createSupabaseClient } from "../../lib/supabase"; // existing helper used by other importers
import type { SupabaseClient } from "@supabase/supabase-js";

export const CES_SUPERSECTORS: Record<string, string> = {
  "10": "natural_resources_mining", // mapping per BLS CES supersector publish
  "20": "construction",
  "30": "manufacturing",
  "40": "trade_transport_utilities",
  "50": "information",
  "55": "financial_activities",
  "60": "professional_business_services",
  "65": "education_health_services",
  "70": "leisure_hospitality",
  "80": "other_services",
  "90": "public_administration",
};

export interface ParsedCesSeriesId {
  level: "metro" | "state";
  stateFips: string;
  areaCode: string; // CBSA for metro, '00000' for state
  supersectorCode: string;
  datatype: string;
  sectorKey: string; // logical name e.g. 'construction'
}

export function parseCesSeriesId(id: string): ParsedCesSeriesId {
  if (!id.startsWith("SMU") && !id.startsWith("SMS")) {
    throw new Error(`Unknown CES series ID prefix: ${id}`);
  }
  const level = id.startsWith("SMS") ? "state" : "metro";
  // SMU + state(2) + area(5) + supersector(8 padded 3 valid) + datatype(2) + extra
  // BLS layout: SMU37395802020000001 (length 19): SM + S(seas)+state(2)+area(5)+industry(8)+datatype(2)
  // Per BLS docs the seasonal-adjustment char is U|S in position 3.
  const stateFips = id.substring(3, 5);
  const areaCode = id.substring(5, 10);
  const supersectorCode = id.substring(10, 12);
  const datatype = id.substring(id.length - 2);

  let sectorKey: string;
  if (level === "state" && supersectorCode === "00") {
    sectorKey = "total_nonfarm";
  } else {
    sectorKey = CES_SUPERSECTORS[supersectorCode] ?? "unknown";
  }
  return { level, stateFips, areaCode, supersectorCode, datatype, sectorKey };
}

export interface CesValueRow {
  level: "metro" | "state";
  stateFips: string;
  areaCode: string;
  sectorKey: string;
  periodDate: string; // ISO YYYY-MM-01
  value: number;
}

export function parseCesBatchResponse(json: any): CesValueRow[] {
  const out: CesValueRow[] = [];
  for (const series of json.Results?.series ?? []) {
    const meta = parseCesSeriesId(series.seriesID);
    for (const dp of series.data ?? []) {
      // data shape: { year: '2023', period: 'M01', periodName: 'January', value: '8500.0' }
      const month = dp.period.startsWith("M")
        ? parseInt(dp.period.slice(1), 10)
        : null;
      if (!month || month > 12) continue; // skip Q/A annuals
      const periodDate = `${dp.year}-${String(month).padStart(2, "0")}-01`;
      const numeric = parseFloat(dp.value);
      if (isNaN(numeric)) continue;
      // CES publishes in thousands of jobs — multiply by 1000 to land bigint employees
      out.push({
        level: meta.level,
        stateFips: meta.stateFips,
        areaCode: meta.areaCode,
        sectorKey: meta.sectorKey,
        periodDate,
        value: Math.round(numeric * 1000),
      });
    }
  }
  return out;
}

export async function importCes(
  supabase: SupabaseClient,
  seriesIds: string[],
  startYear: number,
  endYear: number,
): Promise<{ inserted: number }> {
  let inserted = 0;
  // BLS_BATCH_SIZE=50 per existing convention
  for (let i = 0; i < seriesIds.length; i += 50) {
    const batch = seriesIds.slice(i, i + 50);
    const json = await fetchBlsBatch(batch, startYear, endYear);
    const rows = parseCesBatchResponse(json);
    for (const r of rows) {
      const sectorCol =
        r.sectorKey === "total_nonfarm"
          ? "ces_total_nonfarm_employment"
          : `ces_employment_${r.sectorKey}`;
      const table = r.level === "metro" ? "economic_metro" : "economic_state";
      const idCol = r.level === "metro" ? "cbsa_code" : "state_code";
      const idVal = r.level === "metro" ? r.areaCode : r.stateFips;

      const { error } = await supabase.from(table).upsert(
        { [idCol]: idVal, ces_period_date: r.periodDate, [sectorCol]: r.value },
        { onConflict: `${idCol},period_date` }, // economic_* PKs use period_date — see existing schema
      );
      if (error) throw error;
      inserted++;
    }
  }
  return { inserted };
}
```

> Note: There is no `ces_total_nonfarm_employment` column in migration 058 — only the 11 sector columns. Add the `ces_total_nonfarm_employment BIGINT` column to migration 058 before this code lands. Either re-edit 058 or create a small migration `20260503000250_ces_total_nonfarm.sql`. For this plan we **edit migration 058 in Task 0.4** before any apply — but if the migration was already applied, add a one-line follow-up migration.

- [ ] **Step 2: Add `ces_total_nonfarm_employment` to migration 058**

If 058 is unapplied: edit `supabase/migrations/20260503000200_ces_sector_columns.sql` to add `ADD COLUMN IF NOT EXISTS ces_total_nonfarm_employment BIGINT,` to both ALTER TABLE blocks.
If 058 is applied: create `supabase/migrations/20260503000250_ces_total_nonfarm.sql`:

```sql
ALTER TABLE economic_metro ADD COLUMN IF NOT EXISTS ces_total_nonfarm_employment BIGINT;
ALTER TABLE economic_state ADD COLUMN IF NOT EXISTS ces_total_nonfarm_employment BIGINT;
```

- [ ] **Step 3: Run test**

```
cd /d/projects/rei-platform && npx jest scripts/sources/census-economic/__tests__/ces-importer.spec.ts
```

Expected: PASS, 4/4.

- [ ] **Step 4: Commit**

```
git add scripts/sources/census-economic/ces-importer.ts \
        supabase/migrations/20260503000200_ces_sector_columns.sql
git commit -m "feat(ces): parser + batch importer for CES sectors"
```

### Task 2.4: Live verification — single-state CES run

- [ ] **Step 1: Run for North Carolina alone (small slice)**

Build the seriesId list for NC: 1 state-total + 11 NC × 11 sectors × ~50 metros (skip if too large; just run state and Raleigh).

```
npx ts-node scripts/sources/census-economic/run-ces-import.ts --states NC --metros 39580
```

(`run-ces-import.ts` is a thin CLI wrapper around `importCes`. Add it as part of this task if it doesn't exist; ~30 lines.)

- [ ] **Step 2: Verify**

```sql
SELECT ces_employment_construction, ces_employment_manufacturing, ces_period_date
FROM economic_metro WHERE cbsa_code = '39580' ORDER BY ces_period_date DESC LIMIT 1;
```

Expected: both populated, `ces_period_date` within last 60 days.

- [ ] **Step 3: Commit**

```
git add scripts/sources/census-economic/run-ces-import.ts
git commit -m "feat(ces): CLI wrapper for ces import"
```

---

## Phase 3 — Redfin Migration ingest

### Task 3.1: Capture Redfin Migration TSV fixture

**Files:**

- Create: `scripts/sources/redfin/__fixtures__/redfin-migration-sample.tsv`

- [ ] **Step 1: Identify the live URL**

Verify via web fetch that the canonical path is one of:

- `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/migration/migration_metro.tsv000.gz`
- `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/migration_metro.tsv000.gz`

Probe both with `curl -I`. Use the one that returns 200. Write the resolved URL into `scripts/sources/redfin/redfin-config.ts` as `REDFIN_MIGRATION_METRO_URL`. (Keep it env-overridable: `process.env.REDFIN_MIGRATION_S3_URL ?? <default>`.)

- [ ] **Step 2: Download and trim**

```
curl 'https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/migration/migration_metro.tsv000.gz' \
  | gunzip | head -201 \
  > scripts/sources/redfin/__fixtures__/redfin-migration-sample.tsv
```

- [ ] **Step 3: Inspect the columns**

```
head -1 scripts/sources/redfin/__fixtures__/redfin-migration-sample.tsv
```

Document the column names in a `redfin-migration-column-map.ts` (similar to existing `redfin-column-maps.ts`).

- [ ] **Step 4: Commit fixture + URL constant**

```
git add scripts/sources/redfin/__fixtures__/redfin-migration-sample.tsv \
        scripts/sources/redfin/redfin-config.ts
git commit -m "test(redfin-migration): real-world TSV fixture + URL constant"
```

### Task 3.2: Failing test for Redfin Migration parser

**Files:**

- Create: `scripts/sources/redfin/__tests__/redfin-migration-download.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseRedfinMigrationTsv,
  splitMetroAndFlowRows,
} from "../redfin-migration-download";

const tsv = readFileSync(
  join(__dirname, "..", "__fixtures__", "redfin-migration-sample.tsv"),
  "utf-8",
);

describe("parseRedfinMigrationTsv", () => {
  it("parses TSV rows with non-zero share_pct values", () => {
    const rows = parseRedfinMigrationTsv(tsv);
    expect(rows.length).toBeGreaterThan(50);
    expect(rows[0]).toHaveProperty("period_date");
    expect(rows[0]).toHaveProperty("cbsa_code");
  });
});

describe("splitMetroAndFlowRows", () => {
  it("splits aggregate rows from origin/destination pair rows", () => {
    const rows = parseRedfinMigrationTsv(tsv);
    const { metroRows, flowRows } = splitMetroAndFlowRows(rows);
    // Aggregate rows have NO origin (or origin == destination) — depends on TSV shape
    expect(metroRows.length).toBeGreaterThan(0);
    expect(flowRows.length).toBeGreaterThan(0);
    expect(flowRows[0]).toHaveProperty("origin_cbsa");
    expect(flowRows[0]).toHaveProperty("destination_cbsa");
  });
});
```

- [ ] **Step 2: Run, expect failure**

```
cd /d/projects/rei-platform && npx jest scripts/sources/redfin/__tests__/redfin-migration-download.spec.ts
```

Expected: FAIL — `parseRedfinMigrationTsv is not a function`.

- [ ] **Step 3: Commit**

```
git add scripts/sources/redfin/__tests__/redfin-migration-download.spec.ts
git commit -m "test(redfin-migration): failing parser test"
```

### Task 3.3: Implement Redfin Migration importer

**Files:**

- Create: `scripts/sources/redfin/redfin-migration-download.ts`

- [ ] **Step 1: Implement parser + importer using existing redfin-download primitives**

```ts
import { downloadToMemory } from "./redfin-download"; // existing helper
import { REDFIN_MIGRATION_METRO_URL } from "./redfin-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RedfinMigrationRow {
  period_date: string; // ISO YYYY-MM-01
  cbsa_code: string;
  region_name?: string;
  origin_cbsa?: string;
  destination_cbsa?: string;
  net_inflow?: number;
  inflow_share_pct?: number;
  outflow_share_pct?: number;
  total_users?: number;
  share_pct?: number;
  net_searches?: number;
}

export function parseRedfinMigrationTsv(tsv: string): RedfinMigrationRow[] {
  const lines = tsv.trim().split("\n");
  const header = lines[0].split("\t");
  const idx = (col: string) => header.indexOf(col);
  const rows: RedfinMigrationRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    // Column names — verify in fixture, then bind:
    const period = cols[idx("period_end")] || cols[idx("month")];
    const periodDate = period?.length === 7 ? `${period}-01` : period; // accept YYYY-MM
    rows.push({
      period_date: periodDate,
      cbsa_code: cols[idx("destination_metro")] ?? cols[idx("region_id")],
      region_name: cols[idx("destination_metro_name")],
      origin_cbsa: cols[idx("origin_metro")] || undefined,
      destination_cbsa: cols[idx("destination_metro")] || undefined,
      net_inflow: parseInt(cols[idx("net_inflow")] || "0", 10) || undefined,
      inflow_share_pct:
        parseFloat(cols[idx("inflow_share")] || "0") || undefined,
      outflow_share_pct:
        parseFloat(cols[idx("outflow_share")] || "0") || undefined,
      total_users: parseInt(cols[idx("total_users")] || "0", 10) || undefined,
      share_pct: parseFloat(cols[idx("share")] || "0") || undefined,
      net_searches: parseInt(cols[idx("net_searches")] || "0", 10) || undefined,
    });
  }
  return rows;
}

export function splitMetroAndFlowRows(rows: RedfinMigrationRow[]) {
  // Aggregate row = origin metro empty OR origin == destination
  const metroRows = rows.filter(
    (r) => !r.origin_cbsa || r.origin_cbsa === r.destination_cbsa,
  );
  const flowRows = rows.filter(
    (r) => r.origin_cbsa && r.origin_cbsa !== r.destination_cbsa,
  );
  return { metroRows, flowRows };
}

export async function importRedfinMigration(supabase: SupabaseClient): Promise<{
  metro: number;
  flows: number;
}> {
  const tsv = await downloadToMemory(REDFIN_MIGRATION_METRO_URL);
  const rows = parseRedfinMigrationTsv(tsv);
  const { metroRows, flowRows } = splitMetroAndFlowRows(rows);

  for (const r of metroRows) {
    await supabase.from("redfin_migration_metro").upsert(
      {
        cbsa_code: r.cbsa_code,
        region_name: r.region_name,
        period_date: r.period_date,
        net_inflow: r.net_inflow,
        inflow_share_pct: r.inflow_share_pct,
        outflow_share_pct: r.outflow_share_pct,
        total_users: r.total_users,
      },
      { onConflict: "cbsa_code,period_date" },
    );
  }
  for (const r of flowRows) {
    await supabase.from("redfin_migration_flows_metro").upsert(
      {
        origin_cbsa: r.origin_cbsa!,
        destination_cbsa: r.destination_cbsa!,
        period_date: r.period_date,
        share_pct: r.share_pct,
        net_searches: r.net_searches,
      },
      { onConflict: "origin_cbsa,destination_cbsa,period_date" },
    );
  }
  return { metro: metroRows.length, flows: flowRows.length };
}
```

> The exact column names depend on the fixture. After Task 3.1, edit the `idx('...')` calls to match. Test will fail until they're right.

- [ ] **Step 2: Iterate parser until tests pass**

Re-run `npx jest scripts/sources/redfin/__tests__/redfin-migration-download.spec.ts`. Adjust column names from the inspected fixture header until 2/2 pass.

- [ ] **Step 3: Idempotency test (live)**

```
npx ts-node scripts/sources/redfin/run-redfin-migration-import.ts
# Expected log: "metro: N rows, flows: M rows"
npx ts-node scripts/sources/redfin/run-redfin-migration-import.ts
# Expected: same N/M, no duplicate-key errors
```

Verify in DB:

```sql
SELECT COUNT(*) FROM redfin_migration_metro;     -- should equal N
SELECT COUNT(*) FROM redfin_migration_flows_metro; -- should equal M
```

- [ ] **Step 4: Commit**

```
git add scripts/sources/redfin/redfin-migration-download.ts \
        scripts/sources/redfin/run-redfin-migration-import.ts
git commit -m "feat(redfin-migration): metro + flows TSV importer"
```

---

## Phase 4 — IRS SOI Migration ingest

### Task 4.1: Capture IRS XLSX fixture

**Files:**

- Create: `scripts/__fixtures__/irs-county-inflow-2023.xlsx`
- Create: `scripts/__fixtures__/irs-county-outflow-2023.xlsx`

- [ ] **Step 1: Find the latest files**

```
curl -s 'https://www.irs.gov/statistics/soi-tax-stats-migration-data' \
  | grep -Eo 'href="[^"]*county(in|out)flow[0-9]+\.(xlsx|csv)"' \
  | sort -u
```

- [ ] **Step 2: Download the most recent inflow + outflow XLSX**

```
curl -L 'https://www.irs.gov/.../countyinflow2223.xlsx' \
  -o scripts/__fixtures__/irs-county-inflow-2023.xlsx
curl -L 'https://www.irs.gov/.../countyoutflow2223.xlsx' \
  -o scripts/__fixtures__/irs-county-outflow-2023.xlsx
```

(File names vary year-to-year; the curl above uses placeholder URLs — substitute real ones from Step 1.)

- [ ] **Step 3: Commit fixtures**

```
git add scripts/__fixtures__/irs-county-inflow-2023.xlsx scripts/__fixtures__/irs-county-outflow-2023.xlsx
git commit -m "test(irs): real-world XLSX fixtures for FY22-23 county flows"
```

### Task 4.2: Failing test for IRS parser

**Files:**

- Create: `scripts/__tests__/irs-migration.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseIrsXlsx,
  normalizeIrsFips,
  deriveCountyAggregates,
} from "../download-irs-migration";

const inflowBuf = readFileSync(
  join(__dirname, "..", "__fixtures__", "irs-county-inflow-2023.xlsx"),
);
const outflowBuf = readFileSync(
  join(__dirname, "..", "__fixtures__", "irs-county-outflow-2023.xlsx"),
);

describe("normalizeIrsFips", () => {
  it("returns '00000' for state_code '96' (non-migrants)", () => {
    expect(normalizeIrsFips("96", "0")).toBe("00000");
  });
  it("returns '99999' for state_code '98' (foreign)", () => {
    expect(normalizeIrsFips("98", "0")).toBe("99999");
  });
  it("zero-pads to 5-char FIPS for normal counties", () => {
    expect(normalizeIrsFips("06", "37")).toBe("06037"); // LA County, CA
    expect(normalizeIrsFips("37", "183")).toBe("37183"); // Wake County, NC
  });
});

describe("parseIrsXlsx", () => {
  it("parses inflow rows", () => {
    const rows = parseIrsXlsx(inflowBuf, "in", 2023);
    expect(rows.length).toBeGreaterThan(100);
    expect(rows[0]).toHaveProperty("origin_fips");
    expect(rows[0]).toHaveProperty("destination_fips");
    expect(rows[0]).toHaveProperty("tax_year", 2023);
  });
  it("parses outflow rows", () => {
    const rows = parseIrsXlsx(outflowBuf, "out", 2023);
    expect(rows.length).toBeGreaterThan(100);
  });
});

describe("deriveCountyAggregates", () => {
  it("produces in_avg_agi = in_agi_thousands * 1000 / in_returns", () => {
    const flows = [
      {
        origin_fips: "37063",
        destination_fips: "37183",
        tax_year: 2023,
        num_returns: 100,
        num_exemptions: 200,
        agi_thousands: 8000,
      },
      {
        origin_fips: "37081",
        destination_fips: "37183",
        tax_year: 2023,
        num_returns: 50,
        num_exemptions: 100,
        agi_thousands: 5000,
      },
    ];
    const aggs = deriveCountyAggregates(flows);
    const wake = aggs.find(
      (a) => a.county_fips === "37183" && a.tax_year === 2023,
    );
    expect(wake).toBeDefined();
    expect(wake!.in_returns).toBe(150);
    expect(wake!.in_agi_thousands).toBe(13000);
    expect(wake!.in_avg_agi).toBeCloseTo((13000 * 1000) / 150, 0);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```
cd /d/projects/rei-platform && npx jest scripts/__tests__/irs-migration.spec.ts
```

Expected: FAIL — `parseIrsXlsx is not a function`.

- [ ] **Step 3: Commit**

```
git add scripts/__tests__/irs-migration.spec.ts
git commit -m "test(irs): failing parser + aggregate test"
```

### Task 4.3: Implement IRS parser + aggregator + ingest

**Files:**

- Create: `scripts/download-irs-migration.ts`

- [ ] **Step 1: Add `xlsx` to backend devDependencies if missing**

```
cd packages/backend && npm i -D xlsx@~0.20.0   # or root package.json — match repo convention
```

- [ ] **Step 2: Implement the importer**

```ts
import * as XLSX from "xlsx";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "../packages/backend/src/lib/supabase"; // adjust to repo helper path

export interface IrsFlowRow {
  origin_fips: string;
  destination_fips: string;
  tax_year: number;
  num_returns: number;
  num_exemptions: number;
  agi_thousands: number;
}

export interface IrsCountyAggregate {
  county_fips: string;
  tax_year: number;
  in_returns?: number;
  out_returns?: number;
  net_returns?: number;
  in_exemptions?: number;
  out_exemptions?: number;
  in_agi_thousands?: number;
  out_agi_thousands?: number;
  in_avg_agi?: number;
  out_avg_agi?: number;
}

export function normalizeIrsFips(
  stateCode: string,
  countyCode: string,
): string {
  if (stateCode === "96" || stateCode === "97") return "00000"; // non-migrants / all migrants
  if (stateCode === "98" || stateCode === "99") return "99999"; // foreign / unknown
  const s = stateCode.padStart(2, "0");
  const c = (countyCode || "0").padStart(3, "0");
  return s + c;
}

export function parseIrsXlsx(
  buf: Buffer,
  direction: "in" | "out",
  taxYear: number,
): IrsFlowRow[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: null,
  });

  const out: IrsFlowRow[] = [];
  for (const row of rows) {
    // Column names vary year-to-year. Use lowercase lookup with common synonyms.
    const get = (...keys: string[]): any => {
      for (const k of keys) {
        for (const actual of Object.keys(row)) {
          if (
            actual.toLowerCase().replace(/[^a-z0-9]/g, "") ===
            k.toLowerCase().replace(/[^a-z0-9]/g, "")
          ) {
            return row[actual];
          }
        }
      }
      return null;
    };

    const yState = String(
      get("y2_statefips", "state_code_destination", "y2statefips") ?? "",
    );
    const yCounty = String(get("y2_countyfips", "y2countyfips") ?? "");
    const xState = String(
      get("y1_statefips", "state_code_origin", "y1statefips") ?? "",
    );
    const xCounty = String(get("y1_countyfips", "y1countyfips") ?? "");
    const numReturns = Number(get("n1", "num_returns")) || 0;
    const numExemptions = Number(get("n2", "num_exemptions")) || 0;
    const agi = Number(get("agi", "agi_thousands")) || 0;

    if (!yState || !xState) continue;
    if (numReturns === 0) continue;

    const yFips = normalizeIrsFips(yState, yCounty); // destination
    const xFips = normalizeIrsFips(xState, xCounty); // origin

    // direction='in' = inflow file: y is destination, x is origin
    // direction='out' = outflow file: y is origin (receiving county), x is destination
    const origin = direction === "in" ? xFips : yFips;
    const destination = direction === "in" ? yFips : xFips;

    out.push({
      origin_fips: origin,
      destination_fips: destination,
      tax_year: taxYear,
      num_returns: numReturns,
      num_exemptions: numExemptions,
      agi_thousands: agi,
    });
  }
  return out;
}

export function deriveCountyAggregates(
  flows: IrsFlowRow[],
): IrsCountyAggregate[] {
  const map = new Map<string, IrsCountyAggregate>();
  const upsert = (key: string, init: IrsCountyAggregate) => {
    if (!map.has(key)) map.set(key, init);
    return map.get(key)!;
  };

  for (const f of flows) {
    if (f.destination_fips !== "00000" && f.destination_fips !== "99999") {
      const key = `${f.destination_fips}|${f.tax_year}`;
      const a = upsert(key, {
        county_fips: f.destination_fips,
        tax_year: f.tax_year,
      });
      a.in_returns = (a.in_returns ?? 0) + f.num_returns;
      a.in_exemptions = (a.in_exemptions ?? 0) + f.num_exemptions;
      a.in_agi_thousands = (a.in_agi_thousands ?? 0) + f.agi_thousands;
    }
    if (f.origin_fips !== "00000" && f.origin_fips !== "99999") {
      const key = `${f.origin_fips}|${f.tax_year}`;
      const a = upsert(key, {
        county_fips: f.origin_fips,
        tax_year: f.tax_year,
      });
      a.out_returns = (a.out_returns ?? 0) + f.num_returns;
      a.out_exemptions = (a.out_exemptions ?? 0) + f.num_exemptions;
      a.out_agi_thousands = (a.out_agi_thousands ?? 0) + f.agi_thousands;
    }
  }

  for (const a of map.values()) {
    a.net_returns = (a.in_returns ?? 0) - (a.out_returns ?? 0);
    if (a.in_returns)
      a.in_avg_agi = ((a.in_agi_thousands ?? 0) * 1000) / a.in_returns;
    if (a.out_returns)
      a.out_avg_agi = ((a.out_agi_thousands ?? 0) * 1000) / a.out_returns;
  }
  return [...map.values()];
}

export async function pollAndIngestIrsMigration(
  supabase: SupabaseClient,
): Promise<{ taxYear: number | null; flows: number; aggregates: number }> {
  const page = await fetch(
    "https://www.irs.gov/statistics/soi-tax-stats-migration-data",
  );
  const html = await page.text();
  const matches = [
    ...html.matchAll(
      /href="([^"]*county(?:in|out)flow(\d{4})\.(?:xlsx|csv))"/g,
    ),
  ];
  if (matches.length === 0) {
    console.log("IRS: no county flow files found on landing page");
    return { taxYear: null, flows: 0, aggregates: 0 };
  }
  const latestYearStr = matches
    .map((m) => m[2])
    .sort()
    .pop()!; // e.g. '2223' for FY22-23
  const taxYear = 2000 + parseInt(latestYearStr.slice(2), 10); // ending year

  const { data: existing } = await supabase
    .from("irs_county_migration_flows")
    .select("tax_year")
    .order("tax_year", { ascending: false })
    .limit(1);
  if (existing && existing.length && existing[0].tax_year >= taxYear) {
    console.log(`IRS: tax year ${taxYear} already ingested; skipping`);
    return { taxYear: null, flows: 0, aggregates: 0 };
  }

  const inflowUrl = matches.find((m) => m[1].includes("countyinflow"))![1];
  const outflowUrl = matches.find((m) => m[1].includes("countyoutflow"))![1];
  const baseUrl = "https://www.irs.gov";
  const inflowBuf = Buffer.from(
    await (
      await fetch(
        inflowUrl.startsWith("http") ? inflowUrl : baseUrl + inflowUrl,
      )
    ).arrayBuffer(),
  );
  const outflowBuf = Buffer.from(
    await (
      await fetch(
        outflowUrl.startsWith("http") ? outflowUrl : baseUrl + outflowUrl,
      )
    ).arrayBuffer(),
  );

  const inflowRows = parseIrsXlsx(inflowBuf, "in", taxYear);
  const outflowRows = parseIrsXlsx(outflowBuf, "out", taxYear);
  // IRS publishes each county-to-county flow in BOTH inflow and outflow files
  // (~87% overlap). Concatenating without dedup causes Postgres `ON CONFLICT
  // DO UPDATE` rejects (same row twice in one chunk) and ~2x double-counting
  // in deriveCountyAggregates. dedupIrsFlows keys by
  // (origin_fips, destination_fips, tax_year) and is last-write-wins.
  const allFlows = dedupIrsFlows(inflowRows, outflowRows);

  for (const f of allFlows) {
    await supabase.from("irs_county_migration_flows").upsert(f, {
      onConflict: "origin_fips,destination_fips,tax_year",
    });
  }
  const aggregates = deriveCountyAggregates(allFlows);
  for (const a of aggregates) {
    await supabase.from("irs_migration_county_aggregates").upsert(a, {
      onConflict: "county_fips,tax_year",
    });
  }
  return { taxYear, flows: allFlows.length, aggregates: aggregates.length };
}
```

- [ ] **Step 3: Run tests**

```
cd /d/projects/rei-platform && npx jest scripts/__tests__/irs-migration.spec.ts
```

Expected: PASS, all assertions.

- [ ] **Step 4: Live run**

```
npx ts-node scripts/download-irs-migration.ts
```

Expected log: `IRS: tax_year=2023, flows=NNN, aggregates=MMM`. Then re-run:

```
npx ts-node scripts/download-irs-migration.ts
```

Expected: `tax year 2023 already ingested; skipping` (idempotent).

- [ ] **Step 5: Verify Wake County aggregate**

```sql
SELECT * FROM irs_migration_county_aggregates WHERE county_fips = '37183' AND tax_year = 2023;
```

Expected: `in_returns`, `out_returns`, `net_returns`, `in_avg_agi`, `out_avg_agi` all populated.

- [ ] **Step 6: Commit**

```
git add scripts/download-irs-migration.ts package.json package-lock.json
git commit -m "feat(irs): SOI county migration importer + aggregate derivation"
```

---

## Phase 5 — Backend exposure

### Task 5.1: Append metric entries to `FALLBACK_REGISTRY`

**Files:**

- Modify: `packages/backend/src/metric-resolution/fallback-registry.ts`

- [ ] **Step 1: Append the 22 entries**

```ts
// At the end of FALLBACK_REGISTRY object, before the closing brace:

  // ==========================================================================
  // Employment by sector — CES (metro/state) → QCEW (county/metro fallback)
  // ==========================================================================
  employment_natural_resources_mining: {
    metricId: 'employment_natural_resources_mining',
    sources: [
      { source: 'ces', column: 'ces_employment_natural_resources_mining' },
      { source: 'qcew', column: 'employment_natural_resources_mining' },
    ],
    supportsGeoInheritance: true,
  },
  employment_construction: {
    metricId: 'employment_construction',
    sources: [
      { source: 'ces', column: 'ces_employment_construction' },
      { source: 'qcew', column: 'employment_construction' },
    ],
    supportsGeoInheritance: true,
  },
  employment_manufacturing: {
    metricId: 'employment_manufacturing',
    sources: [
      { source: 'ces', column: 'ces_employment_manufacturing' },
      { source: 'qcew', column: 'employment_manufacturing' },
    ],
    supportsGeoInheritance: true,
  },
  employment_trade_transport_utilities: {
    metricId: 'employment_trade_transport_utilities',
    sources: [
      { source: 'ces', column: 'ces_employment_trade_transport_utilities' },
      { source: 'qcew', column: 'employment_trade_transport_utilities' },
    ],
    supportsGeoInheritance: true,
  },
  employment_information: {
    metricId: 'employment_information',
    sources: [
      { source: 'ces', column: 'ces_employment_information' },
      { source: 'qcew', column: 'employment_information' },
    ],
    supportsGeoInheritance: true,
  },
  employment_financial_activities: {
    metricId: 'employment_financial_activities',
    sources: [
      { source: 'ces', column: 'ces_employment_financial_activities' },
      { source: 'qcew', column: 'employment_financial_activities' },
    ],
    supportsGeoInheritance: true,
  },
  employment_professional_business_services: {
    metricId: 'employment_professional_business_services',
    sources: [
      { source: 'ces', column: 'ces_employment_professional_business_services' },
      { source: 'qcew', column: 'employment_professional_business_services' },
    ],
    supportsGeoInheritance: true,
  },
  employment_education_health_services: {
    metricId: 'employment_education_health_services',
    sources: [
      { source: 'ces', column: 'ces_employment_education_health_services' },
      { source: 'qcew', column: 'employment_education_health_services' },
    ],
    supportsGeoInheritance: true,
  },
  employment_leisure_hospitality: {
    metricId: 'employment_leisure_hospitality',
    sources: [
      { source: 'ces', column: 'ces_employment_leisure_hospitality' },
      { source: 'qcew', column: 'employment_leisure_hospitality' },
    ],
    supportsGeoInheritance: true,
  },
  employment_other_services: {
    metricId: 'employment_other_services',
    sources: [
      { source: 'ces', column: 'ces_employment_other_services' },
      { source: 'qcew', column: 'employment_other_services' },
    ],
    supportsGeoInheritance: true,
  },
  employment_public_administration: {
    metricId: 'employment_public_administration',
    sources: [
      { source: 'ces', column: 'ces_employment_public_administration' },
      { source: 'qcew', column: 'employment_public_administration' },
    ],
    supportsGeoInheritance: true,
  },

  qcew_avg_weekly_wage: {
    metricId: 'qcew_avg_weekly_wage',
    sources: [{ source: 'qcew', column: 'qcew_avg_weekly_wage' }],
    supportsGeoInheritance: true,
  },
  qcew_total_establishments: {
    metricId: 'qcew_total_establishments',
    sources: [{ source: 'qcew', column: 'qcew_total_establishments' }],
    supportsGeoInheritance: true,
  },

  // ==========================================================================
  // IRS migration aggregates (county only)
  // ==========================================================================
  irs_migration_in_returns: {
    metricId: 'irs_migration_in_returns',
    sources: [{ source: 'irs', column: 'in_returns' }],
    supportsGeoInheritance: false,
  },
  irs_migration_out_returns: {
    metricId: 'irs_migration_out_returns',
    sources: [{ source: 'irs', column: 'out_returns' }],
    supportsGeoInheritance: false,
  },
  irs_migration_net_returns: {
    metricId: 'irs_migration_net_returns',
    sources: [{ source: 'irs', column: 'net_returns' }],
    supportsGeoInheritance: false,
  },
  irs_migration_in_avg_agi: {
    metricId: 'irs_migration_in_avg_agi',
    sources: [{ source: 'irs', column: 'in_avg_agi' }],
    supportsGeoInheritance: false,
  },
  irs_migration_out_avg_agi: {
    metricId: 'irs_migration_out_avg_agi',
    sources: [{ source: 'irs', column: 'out_avg_agi' }],
    supportsGeoInheritance: false,
  },
  irs_migration_in_exemptions: {
    metricId: 'irs_migration_in_exemptions',
    sources: [{ source: 'irs', column: 'in_exemptions' }],
    supportsGeoInheritance: false,
  },
  irs_migration_out_exemptions: {
    metricId: 'irs_migration_out_exemptions',
    sources: [{ source: 'irs', column: 'out_exemptions' }],
    supportsGeoInheritance: false,
  },

  // ==========================================================================
  // Redfin Migration (metro only)
  // ==========================================================================
  redfin_migration_net_inflow: {
    metricId: 'redfin_migration_net_inflow',
    sources: [{ source: 'redfin_migration', column: 'net_inflow' }],
    supportsGeoInheritance: false,
  },
  redfin_migration_inflow_share: {
    metricId: 'redfin_migration_inflow_share',
    sources: [{ source: 'redfin_migration', column: 'inflow_share_pct' }],
    supportsGeoInheritance: false,
  },
```

- [ ] **Step 2: Run existing metric-resolution tests**

```
cd packages/backend && npx jest src/metric-resolution
```

Expected: all green; no regressions.

- [ ] **Step 3: Commit**

```
git add packages/backend/src/metric-resolution/fallback-registry.ts
git commit -m "feat(metric-resolution): register 22 employment+migration metrics"
```

### Task 5.2: Failing test — `employment_construction` resolves CES at metro

**Files:**

- Create: `packages/backend/src/metric-resolution/__tests__/employment-fallback.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { Test } from "@nestjs/testing";
import { MetricResolutionService } from "../metric-resolution.service";
import { MetricResolutionModule } from "../metric-resolution.module";
// Plus whatever Supabase mock the existing tests use — copy the pattern from
// packages/backend/src/metric-resolution/__tests__/<existing>.spec.ts

describe("Employment fallback chain (CES → QCEW)", () => {
  let service: MetricResolutionService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricResolutionModule],
    })
      .overrideProvider(/* SupabaseProvider */ Symbol.for("SUPABASE"))
      .useValue(/* mock with ces_employment_construction populated for cbsa 39580 */)
      .compile();
    service = moduleRef.get(MetricResolutionService);
  });

  it("resolves employment_construction via CES at metro level", async () => {
    const r = await service.resolveMetric(
      "employment_construction",
      "metro",
      "39580",
    );
    expect(r.source).toBe("ces");
    expect(r.value).toBeGreaterThan(0);
  });

  it("falls back to QCEW at county level (CES has no county route)", async () => {
    const r = await service.resolveMetric(
      "employment_construction",
      "county",
      "37183",
    );
    expect(r.source).toBe("qcew");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Expected: FAIL because the mock harness isn't set up. Adapt from an existing metric-resolution spec until 2/2 pass.

- [ ] **Step 3: Commit**

```
git add packages/backend/src/metric-resolution/__tests__/employment-fallback.spec.ts
git commit -m "test(metric-resolution): CES→QCEW fallback for employment_construction"
```

### Task 5.3: MigrationModule — failing controller test

**Files:**

- Create: `packages/backend/src/migration/__tests__/migration.controller.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { MigrationModule } from "../migration.module";

describe("MigrationController", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MigrationModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it("returns 400 on invalid source", async () => {
    await request(app.getHttpServer())
      .get("/api/migration/flows/foo/37183?direction=in&limit=5")
      .expect(400);
  });

  it("returns 400 on invalid direction", async () => {
    await request(app.getHttpServer())
      .get("/api/migration/flows/irs/37183?direction=sideways&limit=5")
      .expect(400);
  });

  it("returns 200 with flows shape for irs/county", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/migration/flows/irs/37183?direction=in&limit=3")
      .expect(200);
    expect(res.body).toHaveProperty("geography.fips", "37183");
    expect(res.body).toHaveProperty("source", "irs");
    expect(res.body).toHaveProperty("flows");
    expect(Array.isArray(res.body.flows)).toBe(true);
    expect(res.body.flows.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Expected: `Cannot find module '../migration.module'`.

- [ ] **Step 3: Commit**

```
git add packages/backend/src/migration/__tests__/migration.controller.spec.ts
git commit -m "test(migration): failing controller test for /api/migration/flows"
```

### Task 5.4: Implement MigrationModule

**Files:**

- Create: `packages/backend/src/migration/migration.module.ts`
- Create: `packages/backend/src/migration/migration.controller.ts`
- Create: `packages/backend/src/migration/migration.service.ts`
- Create: `packages/backend/src/migration/dto/get-flows.dto.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: DTO**

```ts
// dto/get-flows.dto.ts
import { IsIn, IsInt, Max, Min, Matches, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class GetFlowsParamsDto {
  @IsIn(["irs", "redfin"])
  source: "irs" | "redfin";

  @Matches(/^\d{5}$/, { message: "fips must be a 5-digit FIPS or CBSA code" })
  fips: string;
}

export class GetFlowsQueryDto {
  @IsIn(["in", "out"])
  direction: "in" | "out";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 5;
}
```

- [ ] **Step 2: Service**

```ts
// migration.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../lib/supabase/supabase.service"; // adjust to project's supabase provider

@Injectable()
export class MigrationService {
  constructor(private readonly supabase: SupabaseService) {}

  async getFlows(
    source: "irs" | "redfin",
    fips: string,
    direction: "in" | "out",
    limit: number,
  ) {
    if (source === "irs") {
      const dirCol = direction === "in" ? "destination_fips" : "origin_fips";
      const partnerCol =
        direction === "in" ? "origin_fips" : "destination_fips";
      const { data, error } = await this.supabase.client
        .from("irs_county_migration_flows")
        .select(
          `tax_year, num_returns, num_exemptions, agi_thousands, ${partnerCol}`,
        )
        .eq(dirCol, fips)
        .order("num_returns", { ascending: false })
        .limit(limit + 5); // pad for filtering reserved partners
      if (error) throw error;
      const filtered = (data ?? [])
        .filter(
          (r: any) => r[partnerCol] !== "00000" && r[partnerCol] !== "99999",
        )
        .slice(0, limit);
      const taxYear = filtered[0]?.tax_year ?? null;
      const partnerFipsList = filtered.map((r: any) => r[partnerCol]);
      const { data: geos } = await this.supabase.client
        .from("geographies")
        .select("id_value, name")
        .in("id_value", partnerFipsList);
      const geoMap = new Map(
        (geos ?? []).map((g: any) => [g.id_value, g.name]),
      );
      return {
        geography: {
          fips,
          name: geoMap.get(fips) ?? null,
          level: "county" as const,
        },
        source,
        direction,
        as_of: taxYear ? String(taxYear) : null,
        flows: filtered.map((r: any) => ({
          [partnerCol === "origin_fips" ? "origin_fips" : "destination_fips"]:
            r[partnerCol],
          [partnerCol === "origin_fips" ? "origin_name" : "destination_name"]:
            geoMap.get(r[partnerCol]) ?? null,
          num_returns: r.num_returns,
          num_exemptions: r.num_exemptions,
          avg_agi:
            r.num_returns > 0
              ? Math.round((r.agi_thousands * 1000) / r.num_returns)
              : null,
        })),
      };
    }

    // redfin
    const dirCol = direction === "in" ? "destination_cbsa" : "origin_cbsa";
    const partnerCol = direction === "in" ? "origin_cbsa" : "destination_cbsa";
    const { data, error } = await this.supabase.client
      .from("redfin_migration_flows_metro")
      .select(`period_date, share_pct, net_searches, ${partnerCol}`)
      .eq(dirCol, fips)
      .order("share_pct", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const periodDate = data?.[0]?.period_date ?? null;
    const partnerList = (data ?? []).map((r: any) => r[partnerCol]);
    const { data: geos } = await this.supabase.client
      .from("geographies")
      .select("id_value, name")
      .in("id_value", partnerList);
    const geoMap = new Map((geos ?? []).map((g: any) => [g.id_value, g.name]));
    return {
      geography: {
        fips,
        name: geoMap.get(fips) ?? null,
        level: "metro" as const,
      },
      source,
      direction,
      as_of: periodDate,
      flows: (data ?? []).map((r: any) => ({
        [partnerCol === "origin_cbsa" ? "origin_cbsa" : "destination_cbsa"]:
          r[partnerCol],
        [partnerCol === "origin_cbsa" ? "origin_name" : "destination_name"]:
          geoMap.get(r[partnerCol]) ?? null,
        share_pct: r.share_pct,
        net_searches: r.net_searches,
      })),
    };
  }
}
```

- [ ] **Step 3: Controller**

```ts
// migration.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { MigrationService } from "./migration.service";
import { GetFlowsParamsDto, GetFlowsQueryDto } from "./dto/get-flows.dto";

@Controller("api/migration")
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MigrationController {
  constructor(private readonly service: MigrationService) {}

  @Get("flows/:source/:fips")
  async getFlows(
    @Param() params: GetFlowsParamsDto,
    @Query() query: GetFlowsQueryDto,
  ) {
    return this.service.getFlows(
      params.source,
      params.fips,
      query.direction,
      query.limit,
    );
  }
}
```

- [ ] **Step 4: Module**

```ts
// migration.module.ts
import { Module } from "@nestjs/common";
import { MigrationController } from "./migration.controller";
import { MigrationService } from "./migration.service";
import { SupabaseModule } from "../lib/supabase/supabase.module"; // adjust per project

@Module({
  imports: [SupabaseModule],
  controllers: [MigrationController],
  providers: [MigrationService],
})
export class MigrationModule {}
```

- [ ] **Step 5: Register in `app.module.ts`**

Add `MigrationModule` to the `imports` array.

- [ ] **Step 6: Run controller test**

```
cd packages/backend && npx jest src/migration
```

Expected: 3/3 pass.

- [ ] **Step 7: Run full backend suite**

```
npx jest
```

Expected: same baseline counts as before; zero new failures.

- [ ] **Step 8: nest build**

```
npx nest build
```

Expected: clean build.

- [ ] **Step 9: Commit**

```
git add packages/backend/src/migration/ packages/backend/src/app.module.ts
git commit -m "feat(migration): MigrationModule + /api/migration/flows endpoint"
```

---

## Phase 6 — Frontend `@/lib/data` exposure

### Task 6.1: Append 22 metric registry entries

**Files:**

- Modify: `packages/frontend/lib/data/registry.ts`

- [ ] **Step 1: Append entries to `METRICS` (or registry — match existing key)**

Note: this codebase has `lib/data/registry.ts` as the source — verify the export name. The plan assumes the entries land alongside existing metric configs:

```ts
// 11 sector employment
employment_natural_resources_mining: {
  id: 'employment_natural_resources_mining',
  title: 'Natural Resources & Mining Employment',
  format: 'number',
  dataSource: 'bls',
  apiEndpoint: '/api/metrics/employment_natural_resources_mining/{geo}',
  supportedGeos: ['state', 'metro', 'county'],
  rangeType: 'min-95',
},
employment_construction: {
  id: 'employment_construction',
  title: 'Construction Employment',
  format: 'number',
  dataSource: 'bls',
  apiEndpoint: '/api/metrics/employment_construction/{geo}',
  supportedGeos: ['state', 'metro', 'county'],
  rangeType: 'min-95',
},
// ... 9 more sectors with same shape, varying id/title/apiEndpoint

qcew_avg_weekly_wage: {
  id: 'qcew_avg_weekly_wage',
  title: 'Avg Weekly Wage (QCEW)',
  format: 'currency',
  dataSource: 'bls',
  apiEndpoint: '/api/metrics/qcew_avg_weekly_wage/{geo}',
  supportedGeos: ['metro', 'county'],
  rangeType: 'min-95',
},
qcew_total_establishments: {
  id: 'qcew_total_establishments',
  title: 'Total Establishments',
  format: 'number',
  dataSource: 'bls',
  apiEndpoint: '/api/metrics/qcew_total_establishments/{geo}',
  supportedGeos: ['metro', 'county'],
  rangeType: 'min-95',
},

// 7 IRS migration aggregates
irs_migration_in_returns: {
  id: 'irs_migration_in_returns',
  title: 'Inbound Tax Returns',
  format: 'number',
  dataSource: 'irs',
  apiEndpoint: '/api/metrics/irs_migration_in_returns/{geo}',
  supportedGeos: ['county'],
  rangeType: 'min-95',
},
irs_migration_out_returns: { ...same shape with id/title swapped },
irs_migration_net_returns: { ...format: 'number' },
irs_migration_in_avg_agi: { ...format: 'currency' },
irs_migration_out_avg_agi: { ...format: 'currency' },
irs_migration_in_exemptions: { ...format: 'number' },
irs_migration_out_exemptions: { ...format: 'number' },

// 2 Redfin migration metrics
redfin_migration_net_inflow: {
  id: 'redfin_migration_net_inflow',
  title: 'Net Migration Inflow (Redfin)',
  format: 'number',
  dataSource: 'redfin_migration',
  apiEndpoint: '/api/metrics/redfin_migration_net_inflow/{geo}',
  supportedGeos: ['metro'],
  rangeType: 'min-95',
},
redfin_migration_inflow_share: {
  id: 'redfin_migration_inflow_share',
  title: 'Inflow Share (Redfin)',
  format: 'percent',
  dataSource: 'redfin_migration',
  apiEndpoint: '/api/metrics/redfin_migration_inflow_share/{geo}',
  supportedGeos: ['metro'],
  rangeType: 'full',
},
```

- [ ] **Step 2: Programmatic dupe check**

```
cd packages/frontend
node -e "const r = require('./lib/data/registry.ts'); const ids = Object.keys(r.METRICS || {}); const dup = ids.find((id, i) => ids.indexOf(id) !== i); if (dup) { console.error('duplicate:', dup); process.exit(1) } console.log('ok', ids.length)"
```

(If the export name differs, adjust. Goal: prove no duplicate IDs.)

- [ ] **Step 3: tsc check**

```
cd packages/frontend && npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```
git add packages/frontend/lib/data/registry.ts
git commit -m "feat(lib/data): register 22 employment+migration metrics"
```

### Task 6.2: Failing test for `useMigrationFlows` hook

**Files:**

- Create: `packages/frontend/lib/data/fetchers/__tests__/migration-flows.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMigrationFlows, fetchMigrationFlows } from '../migration-flows';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe('useMigrationFlows', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        geography: { fips: '37183', name: 'Wake County, NC', level: 'county' },
        source: 'irs', direction: 'in', as_of: '2023',
        flows: [{ origin_fips: '37063', origin_name: 'Durham', num_returns: 4128, num_exemptions: 8341, avg_agi: 78400 }],
      }),
    } as any);
  });

  it('returns the IRS flows for Wake County', async () => {
    const { result } = renderHook(() => useMigrationFlows('37183', 'irs', 'in', 5), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.flows).toHaveLength(1);
    expect(result.current.data!.flows[0].origin_fips).toBe('37063');
  });

  it('caches by (fips, source, direction, limit)', async () => {
    // Two different limits should produce two fetches
    renderHook(() => useMigrationFlows('37183', 'irs', 'in', 5), { wrapper });
    renderHook(() => useMigrationFlows('37183', 'irs', 'in', 10), { wrapper });
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
```

- [ ] **Step 2: Run, expect failure** (`module '../migration-flows' not found`)

- [ ] **Step 3: Commit**

```
git add packages/frontend/lib/data/fetchers/__tests__/migration-flows.spec.ts
git commit -m "test(lib/data): failing useMigrationFlows hook test"
```

### Task 6.3: Implement `migration-flows.ts` fetcher + hook

**Files:**

- Create: `packages/frontend/lib/data/fetchers/migration-flows.ts`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Implement**

```ts
// migration-flows.ts
import { useQuery } from "@tanstack/react-query";
import { resolveApiUrl } from "./base"; // existing helper used by other fetchers

export interface MigrationFlow {
  origin_fips?: string;
  destination_fips?: string;
  origin_cbsa?: string;
  destination_cbsa?: string;
  origin_name?: string | null;
  destination_name?: string | null;
  num_returns?: number;
  num_exemptions?: number;
  avg_agi?: number;
  share_pct?: number;
  net_searches?: number;
}

export interface MigrationFlowsResult {
  geography: { fips: string; name: string | null; level: "county" | "metro" };
  source: "irs" | "redfin";
  direction: "in" | "out";
  as_of: string | null;
  flows: MigrationFlow[];
}

export async function fetchMigrationFlows(
  fips: string,
  source: "irs" | "redfin",
  direction: "in" | "out",
  limit = 5,
): Promise<MigrationFlowsResult> {
  const url = resolveApiUrl(
    `/api/migration/flows/${source}/${fips}?direction=${direction}&limit=${limit}`,
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchMigrationFlows ${res.status}`);
  return res.json();
}

export function useMigrationFlows(
  fips: string,
  source: "irs" | "redfin",
  direction: "in" | "out",
  limit = 5,
) {
  return useQuery({
    queryKey: ["migration-flows", fips, source, direction, limit],
    queryFn: () => fetchMigrationFlows(fips, source, direction, limit),
    staleTime: 1000 * 60 * 60 * 2, // 2h, matches lib/data convention
    enabled: !!fips,
  });
}
```

- [ ] **Step 2: Export from `index.ts`**

```ts
// index.ts (append)
export {
  fetchMigrationFlows,
  useMigrationFlows,
  type MigrationFlow,
  type MigrationFlowsResult,
} from "./fetchers/migration-flows";
```

- [ ] **Step 3: Run test**

```
cd packages/frontend && npx jest lib/data/fetchers/__tests__/migration-flows.spec.ts
```

Expected: 2/2 pass.

- [ ] **Step 4: Commit**

```
git add packages/frontend/lib/data/fetchers/migration-flows.ts packages/frontend/lib/data/index.ts
git commit -m "feat(lib/data): fetchMigrationFlows + useMigrationFlows hook"
```

---

## Phase 7 — MCP server tools

### Task 7.1: Identify tool registration pattern

This is a **read-only** task — confirm where tools register before writing code.

- [ ] **Step 1: Read existing tool registration**

Read `packages/mcp-server/src/index.ts` (or whichever entry file) and one of the existing tool files (`agents.ts`, `brokerage.ts`, `core.ts`). Document the actual function signature each tool exports and how the server calls it.

- [ ] **Step 2: Document findings inline as a comment in `tasks/mcp-tool-pattern.md`**

```
git add tasks/mcp-tool-pattern.md
git commit -m "docs(plan): MCP tool registration pattern reference"
```

### Task 7.2: Failing test — `get_employment_by_sector`

**Files:**

- Create: `packages/mcp-server/src/tools/__tests__/employment.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { handleGetEmploymentBySector } from "../employment";

describe("get_employment_by_sector", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        metricId: "employment_construction",
        value: 18000,
        source: "qcew",
        as_of: "2023-12-31",
      }),
    } as any);
  });

  it("returns 11-sector breakdown for a county", async () => {
    const out = await handleGetEmploymentBySector({
      geoLevel: "county",
      fips: "37183",
    });
    expect(out.sectors).toHaveLength(11);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(11);
    expect(out.sectors[0]).toHaveProperty("source");
    expect(out.sectors[0]).toHaveProperty("as_of");
  });

  it("rejects unsupported geoLevel", async () => {
    await expect(
      handleGetEmploymentBySector({ geoLevel: "zip", fips: "90210" }),
    ).rejects.toThrow(/geoLevel/);
  });
});
```

- [ ] **Step 2: Run, expect failure**

- [ ] **Step 3: Commit**

```
git add packages/mcp-server/src/tools/__tests__/employment.spec.ts
git commit -m "test(mcp): failing test for get_employment_by_sector"
```

### Task 7.3: Implement `employment.ts` MCP tool

**Files:**

- Create: `packages/mcp-server/src/tools/employment.ts`

- [ ] **Step 1: Implement**

```ts
import { z } from "zod";
import { resolveBackendUrl } from "../lib/backend-client"; // adjust to actual helper

const inputSchema = z.object({
  geoLevel: z.enum(["state", "metro", "county"]),
  fips: z.string().regex(/^\d{2,5}$/),
});

const SECTORS = [
  "employment_natural_resources_mining",
  "employment_construction",
  "employment_manufacturing",
  "employment_trade_transport_utilities",
  "employment_information",
  "employment_financial_activities",
  "employment_professional_business_services",
  "employment_education_health_services",
  "employment_leisure_hospitality",
  "employment_other_services",
  "employment_public_administration",
];

export async function handleGetEmploymentBySector(input: unknown) {
  const { geoLevel, fips } = inputSchema.parse(input);
  const sectors = await Promise.all(
    SECTORS.map(async (metricId) => {
      const url = resolveBackendUrl(
        `/api/metrics/${metricId}/${geoLevel}/${fips}`,
      );
      const r = await fetch(url);
      if (!r.ok) return { metricId, value: null, source: null, as_of: null };
      return r.json();
    }),
  );
  return { geoLevel, fips, sectors };
}

export const employmentTools = [
  {
    name: "get_employment_by_sector",
    description:
      "Returns 11-sector employment breakdown for a state, metro, or county.",
    inputSchema: inputSchema as any,
    handler: handleGetEmploymentBySector,
  },
];
```

- [ ] **Step 2: Register in MCP entry**

Per Task 7.1 findings, add `employmentTools` to the tool registry array.

- [ ] **Step 3: Run test**

```
cd packages/mcp-server && npx jest src/tools/__tests__/employment.spec.ts
```

Expected: 2/2 pass.

- [ ] **Step 4: Commit**

```
git add packages/mcp-server/src/tools/employment.ts packages/mcp-server/src/index.ts
git commit -m "feat(mcp): get_employment_by_sector tool"
```

### Task 7.4: Failing test — migration tools

**Files:**

- Create: `packages/mcp-server/src/tools/__tests__/migration.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import {
  handleGetMigrationFlows,
  handleGetMigrationSummary,
} from "../migration";

describe("get_migration_flows", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        geography: { fips: "37183", name: "Wake County, NC", level: "county" },
        source: "irs",
        direction: "in",
        as_of: "2023",
        flows: Array.from({ length: 5 }, (_, i) => ({
          origin_fips: `370${i}3`,
          num_returns: 1000 - i,
        })),
      }),
    } as any);
  });

  it("forwards the limit parameter", async () => {
    await handleGetMigrationFlows({
      fips: "37183",
      source: "irs",
      direction: "in",
      limit: 5,
    });
    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain("limit=5");
  });

  it("rejects bad source", async () => {
    await expect(
      handleGetMigrationFlows({
        fips: "37183",
        source: "foo" as any,
        direction: "in",
        limit: 5,
      }),
    ).rejects.toThrow();
  });
});

describe("get_migration_summary", () => {
  it("returns IRS aggregates and Redfin parent-metro overlay", async () => {
    // Mock implementation requires the parent-metro lookup — sketch only here.
    // This test will iterate during Task 7.5.
  });
});
```

- [ ] **Step 2: Commit**

```
git add packages/mcp-server/src/tools/__tests__/migration.spec.ts
git commit -m "test(mcp): failing tests for migration tools"
```

### Task 7.5: Implement `migration.ts` MCP tool

**Files:**

- Create: `packages/mcp-server/src/tools/migration.ts`

- [ ] **Step 1: Implement** (mirrors `employment.ts` pattern; calls `/api/migration/flows/...` and `/api/metrics/irs_migration_*/county/<fips>` for the summary)

```ts
import { z } from "zod";
import { resolveBackendUrl } from "../lib/backend-client";

const flowsSchema = z.object({
  fips: z.string().regex(/^\d{5}$/),
  source: z.enum(["irs", "redfin"]),
  direction: z.enum(["in", "out"]),
  limit: z.number().int().min(1).max(50).default(5),
});

export async function handleGetMigrationFlows(input: unknown) {
  const p = flowsSchema.parse(input);
  const url = resolveBackendUrl(
    `/api/migration/flows/${p.source}/${p.fips}?direction=${p.direction}&limit=${p.limit}`,
  );
  const r = await fetch(url);
  if (!r.ok) throw new Error(`mcp:get_migration_flows ${r.status}`);
  return r.json();
}

const summarySchema = z.object({ countyFips: z.string().regex(/^\d{5}$/) });

const IRS_AGG_METRICS = [
  "irs_migration_in_returns",
  "irs_migration_out_returns",
  "irs_migration_net_returns",
  "irs_migration_in_avg_agi",
  "irs_migration_out_avg_agi",
];

export async function handleGetMigrationSummary(input: unknown) {
  const { countyFips } = summarySchema.parse(input);
  const irs = await Promise.all(
    IRS_AGG_METRICS.map(async (m) => {
      const r = await fetch(
        resolveBackendUrl(`/api/metrics/${m}/county/${countyFips}`),
      );
      return r.ok ? r.json() : { metricId: m, value: null };
    }),
  );

  // Look up the parent metro (CBSA) via geography crosswalk endpoint, then fetch redfin overlay
  const cw = await fetch(
    resolveBackendUrl(`/api/geography/parent-metro/${countyFips}`),
  );
  let redfinOverlay: any = null;
  if (cw.ok) {
    const { cbsa_code } = await cw.json();
    if (cbsa_code) {
      const overlay = await fetch(
        resolveBackendUrl(
          `/api/metrics/redfin_migration_net_inflow/metro/${cbsa_code}`,
        ),
      );
      if (overlay.ok) redfinOverlay = await overlay.json();
    }
  }

  return { countyFips, irs, redfinOverlay };
}

export const migrationTools = [
  {
    name: "get_migration_flows",
    description:
      "Top-K origin/destination migration flows for a county (IRS) or metro (Redfin).",
    inputSchema: flowsSchema as any,
    handler: handleGetMigrationFlows,
  },
  {
    name: "get_migration_summary",
    description:
      "IRS county aggregates plus Redfin parent-metro overlay for a county.",
    inputSchema: summarySchema as any,
    handler: handleGetMigrationSummary,
  },
];
```

- [ ] **Step 2: Register tools in MCP entry**

- [ ] **Step 3: Run tests, iterate until green**

- [ ] **Step 4: Commit**

```
git add packages/mcp-server/src/tools/migration.ts packages/mcp-server/src/index.ts
git commit -m "feat(mcp): get_migration_flows + get_migration_summary tools"
```

---

## Phase 8 — Cron jobs

### Task 8.1: Add 4 jobs to `economic-monthly-import.yml`

**Files:**

- Modify: `.github/workflows/economic-monthly-import.yml`

- [ ] **Step 1: Read existing jobs to match format**

```
sed -n '1,80p' .github/workflows/economic-monthly-import.yml
```

- [ ] **Step 2: Append jobs**

Add four jobs mirroring the existing structure. Schedule cron expressions (UTC):

- `import-ces`: `0 6 23 * *` (23rd of each month)
- `import-qcew`: `0 6 5 1,4,7,10 *` (5th of Jan/Apr/Jul/Oct)
- `import-redfin-migration`: `0 6 5 * *` (5th)
- `poll-irs-migration`: `0 6 1 * *` (1st)

Each job:

```yaml
import-ces:
  if: github.event.schedule == '0 6 23 * *'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: "20" }
    - run: npm ci
    - run: npx ts-node scripts/sources/census-economic/run-ces-import.ts
      env:
        BLS_API_KEY: ${{ secrets.BLS_API_KEY }}
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
```

(Remaining 3 jobs follow the same shape with their own script paths.)

- [ ] **Step 3: Validate with `actionlint`**

```
npx actionlint .github/workflows/economic-monthly-import.yml
```

(Skip if actionlint isn't installed; rely on GitHub's syntax check on the next push.)

- [ ] **Step 4: Commit**

```
git add .github/workflows/economic-monthly-import.yml
git commit -m "ci(economic): add CES, QCEW-extended, Redfin Migration, IRS jobs"
```

---

## Phase 9 — End-to-end acceptance

### Task 9.1: E2E happy path against real Supabase

Per `feedback_plans-must-include-e2e-tests.md` and `feedback_e2e-validation-real-output.md` — no mocks; production data path only.

- [ ] **Step 1: Ensure all four importers have run for the demo geographies**

Confirm via Supabase MCP:

```sql
-- Wake County, NC (37183)
SELECT employment_construction, qcew_avg_weekly_wage FROM economic_county
  WHERE fips_code = '37183' ORDER BY period_date DESC LIMIT 1;

-- Raleigh-Cary metro (39580)
SELECT ces_employment_construction, ces_period_date FROM economic_metro
  WHERE cbsa_code = '39580' ORDER BY ces_period_date DESC LIMIT 1;

-- Redfin Migration for Raleigh-Cary
SELECT net_inflow, inflow_share_pct FROM redfin_migration_metro
  WHERE cbsa_code = '39580' ORDER BY period_date DESC LIMIT 1;

-- IRS aggregates for Wake
SELECT in_returns, in_avg_agi, out_returns, net_returns FROM irs_migration_county_aggregates
  WHERE county_fips = '37183' ORDER BY tax_year DESC LIMIT 1;
```

All four queries must return non-null values. If any is null, halt and re-run that ingest.

- [ ] **Step 2: Hit the live `/api/metrics/...` and `/api/migration/flows/...` endpoints**

```
curl http://localhost:3001/api/metrics/employment_construction/county/37183
curl http://localhost:3001/api/metrics/employment_construction/metro/39580
curl http://localhost:3001/api/metrics/irs_migration_in_avg_agi/county/37183
curl 'http://localhost:3001/api/migration/flows/irs/37183?direction=in&limit=5'
curl 'http://localhost:3001/api/migration/flows/redfin/39580?direction=in&limit=5'
```

For each: verify non-empty body, status 200, and the `source` / `as_of` fields are sane. Save the responses to `tasks/e2e-2026-05-03.md`.

- [ ] **Step 3: Hit the MCP server tools through the live MCP harness**

(MCP tool invocation depends on the test harness — use the existing pattern from `packages/mcp-server` integration tests. Fall back to direct call of the handler functions if no harness exists.)

```
get_employment_by_sector({ geoLevel: 'county', fips: '37183' })   // expect 11 sectors, non-null values
get_migration_flows({ fips: '37183', source: 'irs', direction: 'in', limit: 5 })
get_migration_summary({ countyFips: '37183' })
```

- [ ] **Step 4: Idempotency proof**

Re-run each importer. Verify row counts in the four destination tables are unchanged (same row count, no errors). Document the before/after counts in `tasks/e2e-2026-05-03.md`.

- [ ] **Step 5: Commit E2E proof**

```
git add tasks/e2e-2026-05-03.md
git commit -m "docs(e2e): employment+migration ingest acceptance proof"
```

### Task 9.2: Acceptance gate review (spec §11)

- [ ] **Step 1: Walk every acceptance criterion**

For each of the 8 bullets in spec §11, paste the demonstrating curl/SQL output into `tasks/e2e-2026-05-03.md` directly under the corresponding criterion. No criterion is "advisory" — all 8 must show real evidence.

- [ ] **Step 2: Commit**

```
git add tasks/e2e-2026-05-03.md
git commit -m "docs(acceptance): walk all 8 spec §11 gates with real output"
```

### Task 9.3: Final cross-package build verification

- [ ] **Step 1: Run all builds**

```
cd packages/backend && npx nest build && npx tsc --noEmit
cd ../frontend && npm run build && npx tsc --noEmit
cd ../mcp-server && npx tsc --noEmit
cd ../video-template && npx tsc --noEmit
```

Expected: every package builds clean. Any new TS error halts the plan.

- [ ] **Step 2: Run full backend Jest suite**

```
cd packages/backend && npx jest
```

Expected: at least the prior baseline passing count + the new tests added across phases (~16 new tests = parser tests across 4 ingests + service spec + controller spec + employment-fallback spec).

- [ ] **Step 3: Open PR**

```
git push -u origin feat/employment-migration-ingests
gh pr create --title "feat: BLS CES/QCEW + Redfin Migration + IRS SOI data ingests" --body "$(cat <<'EOF'
## Summary
- Adds four backend ingests: BLS CES, BLS QCEW (sector extension), Redfin Migration, IRS SOI
- Registers 22 new metric scalars + two flow fetchers via MetricResolutionService and @/lib/data
- New MigrationModule exposes /api/migration/flows/:source/:fips
- Three MCP tools: get_employment_by_sector, get_migration_flows, get_migration_summary
- Four new GitHub Actions cron jobs

## Spec
docs/superpowers/specs/2026-05-03-employment-migration-data-ingests-design.md

## Plan
docs/superpowers/plans/2026-05-03-employment-migration-data-ingests.md

## Acceptance
All 8 criteria in spec §11 demonstrated in tasks/e2e-2026-05-03.md against real Supabase + live BLS/IRS/Redfin data.

## Test plan
- [ ] CI green
- [ ] Migrations 057/058/059/060 applied on staging
- [ ] /api/migration/flows endpoints reachable
- [ ] MCP tools registered and reachable
- [ ] First scheduled cron firing observed
EOF
)"
```

---

## Self-review summary

**Spec coverage check:**

- Section 3 (Storage): Tasks 0.3–0.6 (4 migrations) ✓
- Section 4 (Ingest scripts): Phases 1–4 (one phase per source) ✓
- Section 5.1 (FALLBACK_REGISTRY): Task 5.1 ✓
- Section 5.2 (Migration endpoint): Tasks 5.3–5.4 ✓
- Section 6.1 (Registry entries): Task 6.1 ✓
- Section 6.2 (Flows fetcher): Tasks 6.2–6.3 ✓
- Section 7 (MCP tools): Phase 7 (3 tools) ✓
- Section 8 (Cron): Task 8.1 ✓
- Section 9.1 (TDD pairing): Every ingest has fixture → failing test → implementation as separate tasks ✓
- Section 9.2 (Hermeneutic verify): Tasks 0.8 baseline; build/tsc/test verify steps embedded in every task ✓
- Section 11 (Acceptance gates): Task 9.2 walks all 8 ✓

**Type consistency check:**

- `DataSource` extended in both backend (Task 0.1) and frontend (Task 0.2) before any consumer references new sources
- `parseQcewSectorRows` (1.3), `parseCesSeriesId` / `parseCesBatchResponse` (2.3), `parseRedfinMigrationTsv` / `splitMetroAndFlowRows` (3.3), `parseIrsXlsx` / `normalizeIrsFips` / `deriveCountyAggregates` (4.3) — names match between failing tests and implementations
- `fetchMigrationFlows` / `useMigrationFlows` (6.3) match the spec's stub at §6.2

**Open issues to confirm during execution:**

1. **Redfin Migration TSV column names** — the parser placeholders in Task 3.3 must be verified against the real fixture header. If the column names differ from `period_end`, `destination_metro`, etc., adjust before merging.
2. **CES total_nonfarm_employment column** — Task 2.3 Step 2 inserts a column that should have been in migration 058. Either edit 058 pre-apply or land a follow-up migration.
3. **`ces_period_date` vs `period_date` for CES upserts** — economic_metro PK includes `period_date`. CES upserts must populate `period_date` too (set to same value as `ces_period_date`) so the row uniqueness still holds. Adjust Task 2.3 importer if existing PK definition rejects null.
4. **MCP tool registration pattern** — Task 7.1 is a recon task because the registry pattern wasn't visible in the file globs. The implementation in Tasks 7.3 and 7.5 may need to reshape the export.
5. **`scripts/apply-content-pipeline-migrations.js`** is content-pipeline-specific; the four migrations here may need a different runner or a generic apply script. User to confirm or create a sibling script before Phase 0 migrations apply.
