# Redfin Data Center Adapter (Option A)

**Date:** 2026-05-23
**Status:** Approved
**Scope:** Add a new data adapter for Redfin's `redfin_data_center/` S3 product alongside the existing `redfin_market_tracker/` adapter. Ingest 8 dashboards in the new format: 4 with full geo coverage (`price_drops`, `contract_cancellations`, `delistings_relistings`, and `housing_market`) and 4 metro-only (`investors`, `cash_loan`, `buyers_and_sellers`, `rhpi`). `housing_market` is ingested in new format specifically to feed a genuine `months_of_supply` computed fallback (from its `ACTIVE LISTINGS` / `HOMES SOLD`) that survives legacy deprecation. Wire `months_of_supply` through `MetricResolutionService` with that computed source as a fallback behind the legacy source. All add-only — no consumer cutover (that's Option C).

## Problem

Redfin redesigned the Data Center and quietly shipped a parallel flat-file product at `redfin-public-data.s3.us-west-2.amazonaws.com/redfin_data_center/`. The new product:

- Uses plain CSV instead of gzipped TSV.
- Publishes an authoritative `index.json` manifest.
- Adds frequency variants (`monthly` + `four_weeks`) and pre-cut subsets (`top_50`, `in_top_50_metros`).
- Exposes **9 dashboards we don't currently consume**, including investor share, financing trends, buyer-seller balance, and a Redfin Home Price Index.
- For the `housing_market` dataset we already share, **drops 4 columns we use today**, most critically `months_of_supply` — an input to the PropertyIQ Score formula.

The legacy `redfin_market_tracker/` URLs continue to refresh, but the cosmetic redesign signals that the new format is the strategic direction. Today's dashboards are gated behind disabled "Download Data" buttons on the public page, but the underlying CSVs are live and dated within the last week.

## Solution

**Option A — Add-only.** Build a new adapter for the `redfin_data_center/` product alongside the existing one. Ingest **7 dashboards in P1** with the maximum geo coverage Redfin physically publishes. Wire `months_of_supply` through `MetricResolutionService` with both a legacy source (current) and a computed fallback (new-format-derived). Do **not** cut over the existing `housing_market` consumers — that's deferred to Option C, scheduled for a 1-week revisit (remote agent routine `trig_01QF8iHDTW8sxXpVEEwwwWyz`).

This buys us the unique data signals (investor share, financing, cycle position, RHPI) without risking the existing score, MCP tools, data layer, or map.

## Design Decisions

| Decision                         | Choice                                                                                                                                                                              | Rationale                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Strategy                         | Add-only; new adapter parallel to legacy                                                                                                                                            | Zero regression risk to existing score/MCP/data-layer. Cutover (Option C) revisited in 1 week.                                                                           |
| Code location                    | New directory `scripts/sources/redfin-data-center/` parallel to `scripts/sources/redfin/`                                                                                           | Fundamentally different data product. Co-locating with legacy would create a fragile module with two formats.                                                            |
| URL discovery                    | Fetch `index.json` at run start; use its paths                                                                                                                                      | Forward-proofs against Redfin renaming files within a dashboard. Hardcoded constants are fallback if `index.json` itself 404s.                                           |
| DB schema                        | Per-(dashboard × geo) wide tables, matching `redfin_metro` pattern                                                                                                                  | Existing `MetricResolutionService` extends with one new route. Long-format would require new fetcher and slow queries. ~30 tables — large but each is small and scoped.  |
| Table prefix                     | `redfin_dc_`                                                                                                                                                                        | Greppable boundary from legacy `redfin_*` tables. When Option C runs, the cutover diff is mechanical.                                                                    |
| Geo IDs                          | Resolve region names → standard IDs (CBSA, FIPS, postal code) using existing `redfin-geoid-lookup.ts` + `county-fips-lookup.ts`, with a new normalizer for `" metro area"` suffixes | New CSVs only ship region names. Legacy adapter already solved this problem. Reuse over rewrite.                                                                         |
| Geo scope                        | country / state / metro / county / zip (P1). City + neighborhood → P1.5                                                                                                             | Captures the geos our data layer and MCP consume. City/neighborhood files are >100MB each and rarely queried.                                                            |
| Frequency scope                  | monthly only (P1). `four_weeks` (weekly) → P1.5                                                                                                                                     | Monthly is the cadence our score uses. Weekly adds value but doubles the ingest surface; defer until essentials are stable.                                              |
| Subset scope                     | `all_X` files only. `top_50` / `in_top_50_metros` subsets → P1.5                                                                                                                    | We can WHERE-filter from `all_X` at query time. Ingesting subsets separately would create denormalized duplicates and a sync problem.                                    |
| Geo-resolution failure threshold | Hard-fail run if **>10% of rows** in a file can't resolve to a known geo ID                                                                                                         | Below 10% means new metros Redfin added that haven't been crosswalked yet (acceptable). Above 10% means schema drift or a broken source. Loud failure beats silent skip. |
| MoS fallback chain order         | `[legacy redfin source, calculated source]`                                                                                                                                         | Legacy wins while it still publishes. Calculated takes over silently if legacy 404s. No score-quality regression unless legacy actually dies.                            |
| MoS computation formula          | v1: `active_listings / nullif(homes_sold, 0)` per (region, period_end). Refine to 3-month rolling avg if MAE vs legacy MoS >5% on overlap                                           | Redfin's official formula uses 3-month rolling sales pace; v1 simpler. Empirical comparison decides whether the simpler form is good enough.                             |

## P1 Dashboard Inventory

### Full-coverage (4 dashboards × 5 geos = 20 tables)

| Dashboard                | Tables                                                                            | Key metrics                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `price_drops`            | `redfin_dc_price_drops_country`, `_state`, `_metro`, `_county`, `_zip`            | Price Drops count, % Active With Price Drops, Average Size Of Price Drop (%)                                                                                 |
| `contract_cancellations` | `redfin_dc_contract_cancellations_country`, `_state`, `_metro`, `_county`, `_zip` | Home Purchase Cancellations, % Of Pending Sales                                                                                                              |
| `delistings_relistings`  | `redfin_dc_delistings_relistings_country`, `_state`, `_metro`, `_county`, `_zip`  | Total Delistings, Share Of Listings Delisted, Total Relistings, Share Relisted                                                                               |
| `housing_market`         | `redfin_dc_housing_market_country`, `_state`, `_metro`, `_county`, `_zip`         | Homes Sold, Median Sale Price, Median DOM, Active Listings, New Listings, Pending Sales. **Feeds the MoS computed fallback (Active Listings / Homes Sold).** |

### Metro-only (4 dashboards = 10 tables)

| Dashboard            | Tables                                                         | Notes                                                                                                                                         |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `investors`          | `redfin_dc_investors_country`, `_metro`, `_by_category`        | Metro file covers ~39 metros (the "Available Metros" Redfin computes investor data for). `_by_category` splits by price_tier + property_type. |
| `cash_loan`          | `redfin_dc_cash_loan_country`, `_metro`                        | "Available Metros" coverage (similar to investors).                                                                                           |
| `buyers_and_sellers` | `redfin_dc_buyers_sellers_country`, `_census_region`, `_metro` | Metro = top 50 (Redfin's only published subset for this dashboard). Census region adds 4 macro rows per period.                               |
| `rhpi`               | `redfin_dc_rhpi_country`, `_metro`                             | Metro file named `all_metros.csv` but contains only 50 (verified empirically — filename misleads, `coverage_label` is truthful).              |

**Conflict keys:** `(period_end, region_id)` for all tables except `redfin_dc_investors_by_category` which uses `(period_end, category_type, category_value)`.

## Architecture

### 1. Adapter code (`scripts/sources/redfin-data-center/`)

```
scripts/sources/redfin-data-center/
  import-redfin-dc.ts                CLI entry. Flags: --dashboard, --geo, --full/--recent, --limit
  redfin-dc-config.ts                Static config: dashboards, geo levels, table names, conflict keys, fallback URL list
  redfin-dc-index-fetcher.ts         Fetches and validates index.json at run start
  redfin-dc-csv-processor.ts         Generic: stream CSV → csv-parse → map → batch upsert
  redfin-dc-geo-resolver.ts          Wraps existing lookups with new-format string normalization
  column-maps/
    price-drops.ts
    contract-cancellations.ts
    delistings-relistings.ts
    housing-market.ts
    investors.ts
    cash-loan.ts
    buyers-sellers.ts
    rhpi.ts
  __fixtures__/                      Tiny sample CSVs (3-5 rows each per dashboard)
  __tests__/                         Per-mapper specs + index.json contract test
```

**Reuses from `scripts/lib/`:** `getSupabaseClient`, `batchUpsert`, `getIncrementalCutoff`, `parseIncrementalFlagsFromArgv`, `createIngestionLogger`, `printSummaryBanner`, `reportStatusToBackend`, `csv-loader.downloadFromUrl` (extended if needed for plain CSV streaming).

### 2. Backend metric resolution (`packages/backend/src/metric-resolution/`)

**New file `fallback-registry/redfin-dc.ts`:** registers metrics introduced by the new dashboards (e.g. `investor_market_share`, `pct_all_cash`, `pct_active_with_price_drops`, `home_purchase_cancellations`, `redfin_home_price_index`, `buyer_seller_ratio`).

**`calculated.ts` gains one entry (P2):**

```typescript
months_of_supply: {
  metricId: 'months_of_supply',
  sources: [{ source: 'calculated', column: 'months_of_supply' }],
  supportsGeoInheritance: false,
}
```

Merged into the top-level `FALLBACK_REGISTRY` in `fallback-registry/index.ts` such that the registry entry for `months_of_supply` has both sources in order: `[redfin (legacy column), calculated (new-format computation)]`.

**`source-fetcher.service.ts`** gains a new private `fetchRedfinDcMetric(metricId, geoLevel, geoId)` route, mirroring the existing `fetchRedfinMetric` shape but routing to the `redfin_dc_*` tables. Selection happens in the existing dispatcher (line 47-61) by adding a `source: 'redfin_dc'` case.

**`v4-scoring-data-fetcher.ts`** refactored: the direct SQL read of `months_of_supply` (line 44) is replaced by a call to `MetricResolutionService.resolveMetric('months_of_supply', geoLevel, geoId)`. The other two score inputs (`sold_above_list`, `median_dom`) remain unchanged for now — refactoring all three is Option C scope.

### 3. Database

**8 dashboard migrations** under `supabase/migrations/`, one per dashboard:

- `<timestamp>_create_redfin_dc_price_drops_tables.sql`
- `<timestamp>_create_redfin_dc_contract_cancellations_tables.sql`
- `<timestamp>_create_redfin_dc_delistings_relistings_tables.sql`
- `<timestamp>_create_redfin_dc_housing_market_tables.sql`
- `<timestamp>_create_redfin_dc_investors_tables.sql`
- `<timestamp>_create_redfin_dc_cash_loan_tables.sql`
- `<timestamp>_create_redfin_dc_buyers_sellers_tables.sql`
- `<timestamp>_create_redfin_dc_rhpi_tables.sql`

**1 migration for the MoS computed column:**

- `<timestamp>_add_months_of_supply_to_calculated_metrics.sql` — adds `months_of_supply` column to `calculated_metrics` plus a stored Postgres function `compute_months_of_supply(active_listings, homes_sold)` that returns `active_listings / nullif(homes_sold, 0)`. The materialization reads `ACTIVE LISTINGS` and `HOMES SOLD` from the **new-format `redfin_dc_housing_market_*` tables** (not legacy `redfin_metro`), so the fallback survives full deprecation of the legacy product. Runs via a post-import hook after the `housing_market` dashboard ingests.

Each table follows the pattern:

```sql
CREATE TABLE redfin_dc_<dashboard>_<geo> (
  region_id           text NOT NULL,        -- the standard ID for this geo (FIPS / CBSA / postal / region_name)
  region_name         text NOT NULL,        -- the human-readable name from the CSV
  period_begin        date NOT NULL,
  period_end          date NOT NULL,
  frequency           text NOT NULL,        -- 'Monthly' (P1.5 will add 'Four Weeks')
  last_updated        date,
  -- ... metric columns, all numeric, NULL allowed ...
  PRIMARY KEY (period_end, region_id)
);
CREATE INDEX redfin_dc_<dashboard>_<geo>_period_end_idx ON redfin_dc_<dashboard>_<geo> (period_end DESC);
GRANT ALL ON redfin_dc_<dashboard>_<geo> TO service_role;
GRANT ALL ON redfin_dc_<dashboard>_<geo> TO authenticated;
```

`GRANT ALL` is critical — per memory `Supabase Key Architecture (March 2026)`, missing GRANTs cause silent permission-denied errors even with `sb_secret_` keys.

## Data Flow

```
1. Fetch index.json from S3 (with hardcoded fallback URLs if 404)
2. For each (dashboard, geo) in scope:
   a. Resolve URL from index.json
   b. Stream CSV from S3 via csv-loader.downloadFromUrl (retry 30s/60s/120s)
   c. csv-parse with { columns: true, delimiter: ',', quote: '"', trim: true, skip_empty_lines: true }
   d. For each row:
      - Apply column-map → raw record
      - Resolve region name → standard geo ID (skip + count if unresolvable)
      - Produce dbRecord
   e. Batch upsert into redfin_dc_<dashboard>_<geo> (chunk 1000 rows, conflict key as defined)
   f. Track { inserted, failed, skipped, latestPeriodEnd }
   g. HARD-FAIL if skipped/total > 10%
3. After the housing_market dashboard completes: trigger post-import hook → recompute months_of_supply into calculated_metrics from redfin_dc_housing_market_* for affected (region, period_end) pairs
4. Print summary banner; POST status to /api/health/pipeline-status
```

Incremental imports use the existing `getIncrementalCutoff({ frequency: 'monthly' })` helper — same 3-month lookback as the legacy redfin adapter.

## Error Handling

| Failure                                 | Behavior                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `index.json` fetch fails                | Fall back to hardcoded URL constants in `redfin-dc-config.ts`. Log loudly. Continue.                          |
| CSV download HTTP 5xx                   | Retry 3× with 30s/60s/120s backoff (`csv-loader.ts` retry logic).                                             |
| CSV download HTTP 404                   | Mark that (dashboard, geo) `failed` in `ImportGeographyResult`. Continue with siblings. Surface in summary.   |
| Missing expected column                 | Hard fail with `{dashboard}/{geo}: required column "{name}" missing`. Block run.                              |
| Geo name unresolvable (one row)         | Skip row. Increment `skipped` count.                                                                          |
| Geo name unresolvable (>10% of rows)    | Hard fail. Likely schema drift or source change. Better to alarm than to ingest garbage.                      |
| Partial batch upsert failure (Supabase) | Retry with chunk size halved. If still failing, log offending records and continue. Mark `recordsFailed > 0`. |
| Sanity check (e.g. percent > 100)       | Log warning. Store as-is. Let downstream interpret.                                                           |
| Post-import MoS materialization fails   | Score continues using legacy source (chain order keeps legacy first). Log error. Don't fail the import.       |

## Testing Strategy

**Unit (per column-map):** fixture CSV in `__fixtures__/` with 3-5 hand-picked rows hitting edge cases — `NA` nulls, embedded commas in region names, leading whitespace inside quotes (Redfin's known quirk), unresolvable region. Each test asserts the mapper transforms the row to the expected `dbRecord` or skips it for the right reason.

**Integration:** full pipeline against fixture CSVs (no network). Asserts row counts in target tables. Lives in `__tests__/integration.spec.ts`.

**Index.json contract test:** fetches the live `index.json` (not stubbed) and asserts every expected path key exists. Catches Redfin path changes within hours of CI running.

**Live-data test (manual, pre-merge, per dashboard):**

```bash
npx tsx scripts/sources/redfin-data-center/import-redfin-dc.ts \
  --dashboard price_drops --geo metro --limit 100
```

against staging Supabase. Verify: row count matches expectation, geo resolution rate >90%, no errors, `latestPeriodEnd` within last 2 months, sample 3 rows by hand against the CSV.

**Regression gate (after each dashboard ships):** run PropertyIQ Score for 10 fixed metros (CBSA codes to be locked in implementation), confirm scores haven't shifted by >0.5 absolute points.

**P2 fallback verification:**

1. After MoS wiring, populate `calculated_metrics.months_of_supply` for >95% of regions.
2. Force-disable legacy source by temporarily editing the fallback chain. Confirm score still computes via calculated fallback for all 10 sample metros.
3. Re-enable legacy. Confirm score returns to identical values.
4. Measure latency — must not regress vs current direct-SQL path.

## Verification Protocol (per user direction: "ensure nothing broke")

**Per dashboard (P1 inner loop, fires after each of 8 dashboards ships):**

1. `pnpm build` passes
2. `pnpm typecheck` passes
3. Unit tests for that dashboard's mapper pass
4. Migration applied to staging successfully (verify with `\d redfin_dc_<dashboard>_<geo>`)
5. Live ingest of one geo file completes without error
6. Row count, schema, and `latestPeriodEnd` match expectations
7. PropertyIQ Score for 5 sample metros computes identically to pre-change

**Per phase (after all P1 dashboards):**

8. Full ingest of all 8 dashboards (20 full-coverage + 10 metro-only tables) completes within reasonable time (target: <30 min for incremental, <2 hr for full)
9. Zero errors in `data_ingestion_log` table
10. `MetricResolutionService.resolveMetric()` returns a valid value for one sample metric from each new dashboard

**After P2 MoS fallback:**

11. `calculated_metrics.months_of_supply` populated for >95% of regions present in `redfin_metro`
12. Force-disable legacy source: score computes via calculated fallback for all 10 sample metros
13. Re-enable legacy: score returns to identical values
14. Score computation latency unchanged or improved

## Out of Scope (Explicitly Deferred)

- **Option C cutover** — repointing the score, MCP tools, data layer, and map at the new tables and retiring legacy `redfin_market_tracker/` tables. Note `housing_market` IS ingested in new format here (add-only, into `redfin_dc_housing_market_*`), but no consumer is switched over to it except the MoS computed fallback. Revisited 2026-05-30 via remote agent routine.
- **Weekly (`four_weeks`) ingestion** — P1.5.
- **City + neighborhood geos** — P1.5.
- **`top_50` / `in_top_50_metros` subset tables** — P1.5. Filter from `all_X` until then.
- **Frontend exposure of new metrics** — separate spec once data is landing reliably. New metrics need data-layer fetchers, registry entries, and category assignments in `metric-categories.tsx`.
- **MCP server tools for new metrics** — separate spec.
- **Refactoring `sold_above_list` and `median_dom` reads to go through `MetricResolutionService`** — only `months_of_supply` is refactored in P2. The other two stay on direct SQL until Option C.

## Open Questions Resolved During Brainstorming

- ✅ Strategy: Option A (add-only), revisit Option C in 1 week.
- ✅ Dashboards in P1: 8 — 4 full-coverage (incl. `housing_market`) + 4 metro-only.
- ✅ MoS computed fallback sources from new-format `redfin_dc_housing_market_*` (Active Listings / Homes Sold), not legacy — so it survives full legacy deprecation.
- ✅ Geo scope: country/state/metro/county/zip. No city/neighborhood.
- ✅ Frequency: monthly only.
- ✅ Subsets: `all_X` only.
- ✅ Geo IDs: reuse existing legacy redfin lookups + new normalizer.
- ✅ Index.json-driven URL discovery: yes.
- ✅ Geo-resolution hard-fail threshold: >10%.
- ✅ MoS fallback chain order: legacy first, calculated second.
