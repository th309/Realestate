# Phase 0 Baselines (2026-05-03)

Captured before/after the four Phase 0 migrations applied to project `pysflbhpnqwoczyuaaif`.

All migrations are purely additive (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`), so the hermeneutic invariant — existing metric data is unaffected — is structurally satisfied by Postgres metadata-only DDL semantics on PG11+. The values below are spot-checks confirming no regression.

## Schema verification (post-apply)

```
economic_county QCEW-related cols (employment_*/qcew_*):  14   (13 new + pre-existing total_nonfarm_employment)
economic_metro  QCEW-related cols (employment_*/qcew_*):  14
economic_metro  CES cols (ces_*):                         13   (12 employment + ces_period_date)
economic_state  CES cols (ces_*):                         13
redfin_migration_metro table:                              ✓
redfin_migration_flows_metro table:                        ✓
irs_county_migration_flows table:                          ✓
irs_migration_county_aggregates table:                     ✓
```

## Existing-metric spot-checks (post-apply)

```
SELECT COUNT(*) FROM economic_county WHERE total_nonfarm_employment IS NOT NULL
  → 123,318 rows

SELECT COUNT(*) FROM economic_metro WHERE total_nonfarm_employment IS NOT NULL
  → 14,300 rows

SELECT COUNT(*) FROM economic_county WHERE unemployment_rate IS NOT NULL
  → 960,754 rows

SELECT total_nonfarm_employment FROM economic_county
  WHERE fips_code='37183' AND total_nonfarm_employment IS NOT NULL
  ORDER BY period_date DESC LIMIT 1
  → 577,015 (Wake County, NC)

SELECT MAX(period_date) FROM economic_county WHERE total_nonfarm_employment IS NOT NULL
  → 2025-06-01
```

## Notes / observations

- `economic_metro` row for cbsa_code='39580' (Raleigh-Cary) has NULL `total_nonfarm_employment` — pre-existing data gap, unrelated to this migration. Will be revisited if needed when CES importer (Phase 2) populates `ces_total_nonfarm_employment` for the same cbsa.
- `zillow_metro` is a long-format table with columns `(region_id, value)` plus likely a metric*name column — the plan's example baseline query referenced a non-existent `zhvi` column. Spot-check substituted with `economic*\*` table queries which match the wide-format schema actually present.

## Phase 0 commit summary

| Task | SHA      | Description                                               |
| ---- | -------- | --------------------------------------------------------- |
| 0.1  | d0f03020 | Backend DataSource union extension                        |
| 0.2  | 04e6c5b8 | Frontend DataSource union extension + DATA_DATES/ANCHORS  |
| 0.3  | cba15c63 | Migration: QCEW sector columns                            |
| 0.4  | cdfadd29 | Migration: CES sector columns (incl. ces_total_nonfarm)   |
| 0.5  | 85214b0f | Migration: Redfin Migration metro + flows tables          |
| 0.6  | b5ac6d7e | Migration: IRS county flows + aggregates tables           |
| 0.7  | dec78ca9 | table-routes.ts: routes for ces/qcew/irs/redfin_migration |

All migrations applied successfully via Supabase MCP `apply_migration`.
