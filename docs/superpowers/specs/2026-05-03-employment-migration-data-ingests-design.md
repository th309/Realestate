# Employment & Migration Data Ingests — Design

**Date:** 2026-05-03
**Status:** Design approved, awaiting plan
**Scope:** Data ingest + central API exposure only. No UI work.
**Branch target:** new branch off `main`, name TBD by implementer

---

## 1. Summary

Add four data ingests so downstream tools (a future listing-presentation page, the MCP server, dashboards) can pull fresh employment-by-sector and migration data through the existing `@/lib/data` patterns.

**Two domains, four sources, freshness-tiered:**

| Domain                     | Source                   | Geo                               | Lag        | Cadence                       |
| -------------------------- | ------------------------ | --------------------------------- | ---------- | ----------------------------- |
| Employment by sector       | **BLS CES**              | Metro, State                      | ~1 month   | Monthly                       |
| Employment by sector       | **BLS QCEW** (extension) | County, Metro                     | ~6 months  | Quarterly                     |
| Migration (current pulse)  | **Redfin Migration**     | Metro                             | ~1 month   | Monthly                       |
| Migration (income profile) | **IRS SOI**              | County (origin↔destination pairs) | ~24 months | Monthly poll, ingest when new |

CES and QCEW are unified behind a single set of 11 metrics, with `MetricResolutionService` falling back from CES (fresher) to QCEW (more granular) automatically by geography level. Redfin and IRS migration are exposed as separate metrics because they answer different questions (current intent vs. historical realized moves with income profile).

---

## 2. Constraints (locked in)

- All consumer access goes through `@/lib/data` using existing patterns. No new abstractions.
- 22 new metric scalars register in `lib/data/registry.ts` and are served by existing `useSnapshotData` / `useTimeSeriesData` hooks.
- Two flow-data fetchers (origin↔destination pairs) are added to `lib/data/fetchers/` — same exception pattern as `fetchScore` (relational data, not metric scalars).
- All backend metric resolution goes through `MetricResolutionService` per `CLAUDE.md` Section 5.1.
- No mock data, no placeholder URLs in production code (per platform feedback).
- No UI work in this project.

---

## 3. Storage

### 3.1 QCEW sector — extend existing wide-column tables

Existing `economic_county` and `economic_metro` already have `total_nonfarm_employment` + `employment_yoy`. Extend with 11 sector columns each:

```sql
-- migration 057-qcew-sector-columns.sql
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
-- mirror for economic_metro
```

GRANTs follow Section 1.2 of CLAUDE.md (auto-grant to `service_role`, `authenticated`).

### 3.2 CES sector — new wide-column tables (or extend existing)

CES is metro/state only. Extend `economic_metro` and `economic_state` with the same 11 sector columns prefixed `ces_employment_<sector>` to disambiguate from QCEW. The MetricResolutionService chooses which to read.

```sql
-- migration 058-ces-sector-columns.sql
ALTER TABLE economic_metro
  ADD COLUMN IF NOT EXISTS ces_employment_construction BIGINT,
  -- ... (11 supersector columns)
  ADD COLUMN IF NOT EXISTS ces_period_date DATE; -- separate "as-of" since CES updates monthly
-- mirror for economic_state
```

Naming separation keeps the ETL idempotent: a CES run never overwrites a QCEW column and vice-versa. The fallback registry maps the logical metric name (`employment_construction`) to either source.

### 3.3 Redfin Migration — new per-geography table

Mirrors the existing Redfin pattern (`redfin_metro`, `redfin_county`, etc.). Redfin Migration data is metro-only.

```sql
-- migration 059-redfin-migration-tables.sql
CREATE TABLE IF NOT EXISTS redfin_migration_metro (
  cbsa_code TEXT NOT NULL,
  region_name TEXT,
  period_date DATE NOT NULL,
  net_inflow NUMERIC,                 -- net of inbound vs outbound user searches
  inflow_share_pct NUMERIC,           -- % of out-of-metro searches inbound to this metro
  outflow_share_pct NUMERIC,
  total_users INT,                    -- denominator
  PRIMARY KEY (cbsa_code, period_date)
);
CREATE INDEX idx_redfin_migration_metro_period ON redfin_migration_metro(period_date DESC);

CREATE TABLE IF NOT EXISTS redfin_migration_flows_metro (
  origin_cbsa TEXT NOT NULL,
  destination_cbsa TEXT NOT NULL,
  period_date DATE NOT NULL,
  share_pct NUMERIC,                  -- share of inbound from this origin
  net_searches INT,
  PRIMARY KEY (origin_cbsa, destination_cbsa, period_date)
);
CREATE INDEX idx_redfin_flows_dest ON redfin_migration_flows_metro(destination_cbsa, period_date DESC);
CREATE INDEX idx_redfin_flows_origin ON redfin_migration_flows_metro(origin_cbsa, period_date DESC);

GRANT ALL ON redfin_migration_metro TO service_role, authenticated;
GRANT ALL ON redfin_migration_flows_metro TO service_role, authenticated;
```

### 3.4 IRS SOI Migration — flows + aggregates

Long-format aggregates because there's a new domain with annual cadence. Flows table for origin/destination pairs.

```sql
-- migration 060-irs-migration-tables.sql
CREATE TABLE IF NOT EXISTS irs_county_migration_flows (
  origin_fips TEXT NOT NULL,        -- '00000' for "non-migrants" / 'foreign' for foreign
  destination_fips TEXT NOT NULL,
  tax_year INT NOT NULL,            -- ending year of the FY pair (e.g., 2023 for FY22-23)
  num_returns INT NOT NULL,
  num_exemptions INT NOT NULL,
  agi_thousands BIGINT,             -- adjusted gross income in thousands
  PRIMARY KEY (origin_fips, destination_fips, tax_year)
);
CREATE INDEX idx_irs_flows_dest ON irs_county_migration_flows(destination_fips, tax_year DESC);
CREATE INDEX idx_irs_flows_origin ON irs_county_migration_flows(origin_fips, tax_year DESC);

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
  in_avg_agi NUMERIC,               -- in_agi_thousands * 1000 / in_returns
  out_avg_agi NUMERIC,
  PRIMARY KEY (county_fips, tax_year)
);

GRANT ALL ON irs_county_migration_flows TO service_role, authenticated;
GRANT ALL ON irs_migration_county_aggregates TO service_role, authenticated;
```

Aggregates are computed in a post-ingest step from the flows table (sum of inbound/outbound for each county). Stored to keep `MetricResolutionService` reads simple — single-row lookup, no aggregation at query time.

---

## 4. Ingest scripts

### 4.1 QCEW sector (extend existing)

`scripts/download-qcew-employment.ts` already exists and pulls industry code 10 (total). Refactor to loop over the 11 NAICS supersectors:

| NAICS supersector code | Logical sector name            |
| ---------------------- | ------------------------------ |
| 1011                   | natural_resources_mining       |
| 1012                   | construction                   |
| 1013                   | manufacturing                  |
| 1021                   | trade_transport_utilities      |
| 1022                   | information                    |
| 1023                   | financial_activities           |
| 1024                   | professional_business_services |
| 1025                   | education_health_services      |
| 1026                   | leisure_hospitality            |
| 1027                   | other_services                 |
| 1028                   | public_administration          |

Plus continue pulling industry 10 for `total_nonfarm_employment`. Same CSV-slice URL pattern (`https://data.bls.gov/cew/data/api/{year}/{qtr}/industry/{code}.csv`). Filter on `own_code = 5` (private) for sector lines, `own_code in (1,2,3,5)` (all owners) for total.

Also extract `total_qtrly_wages / (3 * sum_emplvl)` → `qcew_avg_weekly_wage` and `qtrly_estabs` → `qcew_total_establishments`.

Cadence: quarterly. New GitHub Actions step in `economic-monthly-import.yml` that runs on quarter-boundary months (Apr/Jul/Oct/Jan).

### 4.2 CES sector (new)

`scripts/sources/census-economic/ces-importer.ts` reuses existing `bls-api-client.ts` batch helper. Series ID format: `SMU<state><area><supersector><datatype>` for metros, `SMS<state>00000000000001` for state totals.

Build seriesId list at startup (one per metro × per supersector + per state × per supersector × `01` datatype = all-employees). ~3000 series for full US coverage. Batch in 50s, year ranges per existing helper.

Cadence: monthly cron, ~22nd of each month (BLS CES release schedule).

### 4.3 Redfin Migration (new)

`scripts/sources/redfin/redfin-migration-download.ts` mirrors `redfin-download.ts` pattern. URL: `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/migration/migration_metro.tsv000.gz` (verify exact path during implementation — may need to fetch the data center page if path varies).

TSV processor extracts metro-level rows → `redfin_migration_metro`. Pair-level rows → `redfin_migration_flows_metro`. Same gzipped-TSV pipeline as existing Redfin imports.

Cadence: monthly.

### 4.4 IRS SOI Migration (new, idempotent monthly poll)

`scripts/download-irs-migration.ts`:

1. Fetch the IRS SOI Migration page: `https://www.irs.gov/statistics/soi-tax-stats-migration-data`.
2. Parse the page for the latest county-flow file links: `countyinflow{YY}{YY}.{xlsx,csv}` and `countyoutflow{YY}{YY}.{xlsx,csv}`.
3. Compare the parsed `tax_year` (ending year of the FY pair, e.g., `23` → 2023) to `MAX(tax_year)` in `irs_county_migration_flows`.
4. If newer year found: download both inflow and outflow files, parse via `xlsx` or `csv-parse`, upsert into `irs_county_migration_flows`. Then derive aggregates → `irs_migration_county_aggregates`.
5. If no new year: log "no new IRS data" and exit cleanly (zero-cost call).

File parsing must handle the IRS quirk that `state_code='96'` means "Non-migrants", `'97'` = "All migrants", `'98'` = "Foreign". These get bucketed into reserved origin/destination FIPS values (`'00000'` for non-migrants, `'99999'` for foreign).

Cadence: monthly cron. Idempotent — safe to run anytime.

---

## 5. Backend exposure

### 5.1 MetricResolutionService entries

Add 11 sector entries to `FALLBACK_REGISTRY` in `packages/backend/src/metric-resolution/fallback-registry.ts`:

```ts
employment_construction: {
  sources: ['ces', 'qcew'],         // ces fresher, qcew fallback
  supportsGeoInheritance: true,     // metro CES → county QCEW via crosswalk
  format: 'number',
},
// ... 10 more for other supersectors
```

Add 9 migration entries (7 IRS + 2 Redfin) with single source each:

```ts
irs_migration_in_returns:    { sources: ['irs'], format: 'number' },
irs_migration_in_avg_agi:    { sources: ['irs'], format: 'currency' },
// ... etc
redfin_migration_net_inflow:    { sources: ['redfin-migration'], format: 'number' },
redfin_migration_inflow_share:  { sources: ['redfin-migration'], format: 'percent' },
```

Extend `source-fetcher.service.ts` with table/column routing for `'ces'`, `'irs'`, `'redfin-migration'` per geography.

### 5.2 Migration flows endpoint (only new endpoint type)

```
GET /api/migration/flows/:source/:fips?direction=in&limit=5
  source ∈ {'irs', 'redfin'}
  direction ∈ {'in', 'out'}
  fips: county FIPS for IRS, CBSA code for Redfin
```

Returns:

```json
{
  "geography": { "fips": "37183", "name": "Wake County, NC", "level": "county" },
  "source": "irs",
  "direction": "in",
  "as_of": "2023",
  "flows": [
    { "origin_fips": "37063", "origin_name": "Durham County, NC", "num_returns": 4128, "num_exemptions": 8341, "avg_agi": 78400 },
    ...
  ]
}
```

Implemented by a new `MigrationModule` (`packages/backend/src/migration/`):

- `migration.module.ts`
- `migration.controller.ts` — single endpoint above, validated with Zod or class-validator
- `migration.service.ts` — Supabase query against `irs_county_migration_flows` or `redfin_migration_flows_metro`, ranked by `num_returns DESC` or `share_pct DESC`, joined to `geographies` table for names

All metric scalars (the 22 above) reuse the existing `/api/metrics/...` endpoint structure via `MetricResolutionService`. No new metric endpoint.

---

## 6. Frontend `@/lib/data` exposure

### 6.1 Registry entries (22 metrics)

Append to `packages/frontend/lib/data/registry.ts`:

```ts
// 11 sector employment (fall back metro-CES → county-QCEW automatically server-side)
employment_construction: {
  id: 'employment_construction',
  title: 'Construction Employment',
  format: 'number',
  dataSource: 'bls',
  apiEndpoint: '/api/metrics/employment_construction/{geo}',
  supportedGeos: ['state', 'metro', 'county'],
  rangeType: 'min-95',
},
// ... 10 more sectors, qcew_avg_weekly_wage, qcew_total_establishments

// 7 IRS migration aggregates
irs_migration_in_returns:  { ..., supportedGeos: ['county'], format: 'number' },
irs_migration_in_avg_agi:  { ..., supportedGeos: ['county'], format: 'currency' },
// ... etc

// 2 Redfin migration metrics
redfin_migration_net_inflow:    { ..., supportedGeos: ['metro'], format: 'number' },
redfin_migration_inflow_share:  { ..., supportedGeos: ['metro'], format: 'percent' },
```

All 22 work through existing `useSnapshotData(metricId, geoLevel, options)` and `useTimeSeriesData(metricId, geoLevel, geoId, options)`. Zero consumer changes.

### 6.2 New flows fetcher (single file)

`packages/frontend/lib/data/fetchers/migration-flows.ts`:

```ts
export interface MigrationFlow {
  origin_fips?: string;
  destination_fips?: string;
  origin_name?: string;
  destination_name?: string;
  num_returns?: number;
  num_exemptions?: number;
  avg_agi?: number;
  share_pct?: number;
}

export interface MigrationFlowsResult {
  geography: { fips: string; name: string; level: "county" | "metro" };
  source: "irs" | "redfin";
  direction: "in" | "out";
  as_of: string;
  flows: MigrationFlow[];
}

export async function fetchMigrationFlows(
  fips: string,
  source: "irs" | "redfin",
  direction: "in" | "out",
  limit = 5,
): Promise<MigrationFlowsResult> {
  /* ... */
}

export function useMigrationFlows(
  fips: string,
  source: "irs" | "redfin",
  direction: "in" | "out",
  limit = 5,
) {
  /* React Query wrapper */
}
```

Exported from `packages/frontend/lib/data/index.ts`. Same exception pattern as `fetchScore` (which is also relational data, not a metric scalar).

---

## 7. MCP server tools

Three tools in `packages/mcp-server/src/tools/`:

| Tool                                                    | File            | Returns                                                                                                      |
| ------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| `get_employment_by_sector(geoLevel, fips)`              | `employment.ts` | 11-sector breakdown via `MetricResolutionService` batch resolve, with per-sector source label and as-of date |
| `get_migration_summary(countyFips)`                     | `migration.ts`  | IRS aggregates + parent-metro Redfin overlay (via geography crosswalk)                                       |
| `get_migration_flows(fips, source, direction, limit=5)` | `migration.ts`  | Same shape as the REST endpoint                                                                              |

Each tool wraps the existing backend endpoints (no direct DB access from MCP server). Validates inputs with Zod. Caches per existing MCP cache pattern with appropriate TTLs (employment: 24h, migration: 7d for IRS, 24h for Redfin).

---

## 8. Cron / GitHub Actions

Extend `.github/workflows/economic-monthly-import.yml`:

| Job                       | Schedule                         | What                                             |
| ------------------------- | -------------------------------- | ------------------------------------------------ |
| `import-ces`              | Monthly, 23rd                    | Runs CES importer for previous month             |
| `import-qcew`             | Quarterly (Apr/Jul/Oct/Jan, 5th) | Runs extended QCEW download for previous quarter |
| `import-redfin-migration` | Monthly, 5th                     | Runs Redfin Migration TSV download               |
| `poll-irs-migration`      | Monthly, 1st                     | Polls IRS page; ingests if new tax year detected |

All jobs are idempotent — safe to re-run. Each job posts metrics row count + as-of date to logs for the existing `data_ingestion_runs` audit table (check whether this exists; if not, log to stdout and let existing observability surface it).

---

## 9. Testing

For each ingest:

- Unit tests for parsers (CSV/TSV/XLSX → row records) with realistic fixture data
- Integration test that runs the importer against a small fixture and asserts upsert correctness, idempotency (re-run yields same row count), and aggregate derivation

For backend:

- Controller test for `/api/migration/flows/:source/:fips` with Zod validation cases
- Service test against test Supabase project (or mocked Supabase client per project convention)

For MetricResolutionService:

- Test that `employment_construction` resolves via CES at metro and falls back to QCEW at county

For frontend:

- Test `useMigrationFlows` React Query hook (success, error, loading)
- Snapshot test for fetcher response shape

Per `feedback_plans-must-include-e2e-tests.md`: include an E2E task that runs the full ingest → query path against the real Supabase project for one county (Wake NC, FIPS 37183) and one metro (Raleigh-Cary CBSA 39580) before claiming done.

### 9.1 TDD ordering (mandatory for every implementation task)

Every unit of work in the implementation plan **must** be ordered:

1. **Capture a real-world fixture first.** No synthetic shapes guessed from documentation. Concretely:
   - QCEW: `curl` one industry-slice CSV for one quarter, save to `__fixtures__/qcew-{year}q{n}-industry-{code}.csv`
   - CES: capture one BLS API JSON response for one batch of 5 series, save to `__fixtures__/ces-batch-sample.json`
   - Redfin Migration: download one TSV row sample to `__fixtures__/redfin-migration-sample.tsv`
   - IRS: save one `countyinflow{YY}{YY}.xlsx` to `__fixtures__/irs-county-inflow-{year}.xlsx`
2. **Write the failing test against the fixture.** Parser tests assert exact row count, column types, edge cases (e.g., IRS reserved state codes 96/97/98). Hook tests assert React Query cache key shape and error handling.
3. **Implement until the test passes.** No other production code written before its test exists.
4. **Refactor with the test as a safety net.** Only after green.

This applies to:

- Each ingest parser (4: QCEW extension, CES, Redfin Migration, IRS)
- Aggregate derivation step (IRS flows → county aggregates)
- Each `MetricResolutionService` fallback addition (CES → QCEW for the 11 sector metrics)
- Migration controller endpoint (Zod validation cases first, then handler)
- `fetchMigrationFlows` + `useMigrationFlows` (hook test first, then implementation)
- Each MCP tool (input-validation test → handler test → integration test)

The plan task list must read in pairs: `Task N — write failing test for X` immediately followed by `Task N+1 — implement X to pass test`. If a single task does both, it violates this section.

### 9.2 Hermeneutic verification loop (after every change)

Per `CLAUDE.md` §1.0: every change must be followed by a re-evaluation of the whole. The plan must include explicit verification steps after each substantive change, not just at the end.

| After this change                                                  | Verify the whole still holds                                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration 057 (QCEW sector columns) applies                        | Re-run existing `download-qcew-employment.ts` for one quarter; confirm `total_nonfarm_employment` populates exactly as before. Existing `unemployment_rate` queries unchanged. |
| QCEW script extended to loop sectors                               | Existing total-only run path still works (with a `--sectors-only` or default-all flag); re-run produces identical `total_nonfarm_employment` values. No drift.                 |
| Migration 058 (CES columns) applies                                | Existing `economic_metro` consumers still resolve. No column-name collisions with existing fields.                                                                             |
| CES added to `FALLBACK_REGISTRY`                                   | Snapshot test: every previously-resolving metric resolves to the same `(source, value, as_of)` it did before. No accidental rerouting.                                         |
| Migrations 059, 060 (Redfin Migration + IRS tables) apply          | Existing `redfin_metro` and `economic_county` queries unchanged in plan and runtime. New tables don't appear in any existing fetcher's joins.                                  |
| 22 new entries appended to `lib/data/registry.ts`                  | No duplicate metric IDs (programmatic check); existing `useSnapshotData` calls for old metrics return identical shapes; TypeScript compile clean across all packages.          |
| New `MigrationModule` registered in backend                        | `nest build` succeeds; existing controllers' route table unchanged; OpenAPI/Swagger output (if generated) only adds new routes.                                                |
| New `migration-flows.ts` fetcher exported from `lib/data/index.ts` | Frontend `tsc --noEmit` clean; existing imports from `@/lib/data` resolve unchanged; no namespace collisions.                                                                  |
| Each MCP tool added                                                | Existing MCP tool list unchanged in shape; no cache key collisions; existing entitlement-cache invalidation behavior unchanged.                                                |
| Each cron job added to GitHub Actions workflow                     | Existing jobs (`import-economic`, etc.) still scheduled and parameterized identically; no shared environment-variable mutations.                                               |

The plan must surface these as explicit "verify" tasks between implementation tasks, not as a single end-of-plan checklist. A failure at any verification halts the plan and triggers re-planning per `CLAUDE.md` §2.1.

Verification commands the plan must use (not optional):

- `npm run build` (each affected package) after every code change
- `npm test -- <changed area>` after every test/code change
- `nest build` after every backend module change
- `tsc --noEmit` across affected packages after registry/type changes
- For each migration: apply on a Supabase branch, query the previous-state-equivalent, diff the result

---

## 10. Out of scope

- Listing-presentation UI or any frontend page consuming these metrics
- Any change to PropertyIQ Score formula or inputs
- Backfill beyond 5 years (CES/QCEW back to 2020; IRS back to FY18-19; Redfin back to whatever S3 publishes)
- Forecasting / projection on top of these series
- Aggregating sector data into derived "primary industry" labels — leave that to the consuming UI
- Geocoded migration visualizations (Sankey diagrams, etc.)

---

## 11. Acceptance criteria (gates, not advisory)

A staff engineer should be able to verify each of these _as a precondition for shipping_:

1. `useSnapshotData('employment_construction', 'county', '37183')` returns a real value with a `dataSource` label of `'qcew'` and an as-of date within 9 months of today.
2. `useSnapshotData('employment_construction', 'metro', '39580')` returns a real value with `dataSource: 'ces'` and as-of within 2 months.
3. `useSnapshotData('irs_migration_in_avg_agi', 'county', '37183')` returns a numeric AGI value and an as-of `tax_year`.
4. `useMigrationFlows('37183', 'irs', 'in', 5)` returns an array of 5 origin counties with names, return counts, and avg AGI.
5. `useMigrationFlows('39580', 'redfin', 'in', 5)` returns 5 origin metros with share percentages.
6. The IRS poll cron, run twice in a row, produces the same database state on the second run (idempotent).
7. MCP tool `get_employment_by_sector('county', '37183')` returns 11-sector breakdown.
8. All migrations apply cleanly on a fresh Supabase branch and roll back cleanly via `DROP COLUMN IF EXISTS` / `DROP TABLE IF EXISTS` reversals.

---

## 12. Risks & mitigations

| Risk                                                                                                             | Mitigation                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------ |
| Redfin changes their S3 path                                                                                     | Pin URL via env var `REDFIN_MIGRATION_S3_URL` with sensible default; fail loudly on 404                                                        |
| IRS file format changes year-over-year (column order, sheet names)                                               | Parser uses column-name lookup, not positional; year-specific overrides if needed                                                              |
| BLS rate limits with 3000 CES series                                                                             | Reuse existing `BLS_BATCH_SIZE = 50` + `rateLimitWait()` helper; respects API key tier                                                         |
| Idempotency drift if a CES revision republishes earlier months                                                   | Use `ON CONFLICT (cbsa_code, period_date) DO UPDATE` upserts everywhere — never insert-only                                                    |
| County FIPS in IRS uses 2-digit state + 3-digit county (5 char total) but some columns use separate state/county | Normalize at parse time to 5-char `state_fips                                                                                                  |     | county_fips` for storage |
| `economic_county` getting wide (many ALTER TABLE adds)                                                           | Acceptable — matches existing pattern; revisit if it crosses ~50 columns                                                                       |
| Aggregate derivation drift (sum of flows ≠ aggregates table)                                                     | Aggregates are _computed from_ flows in the same transaction; if it ever drifts, recompute via `recompute-irs-aggregates.ts` script (one-shot) |
