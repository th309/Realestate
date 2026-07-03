# Data-Source Refresh + Redfin Data Center Exposure — Design

**Date:** 2026-07-03
**Status:** DRAFT — awaiting user review (author working while user is AFK)
**Author:** Claude (session 812633a0)
**Trigger:** User reported DB data looks stale (e.g. "Redfin DC data is from 4/30"); asked to update all data sources, ensure Redfin DC covers metro/county/zip, create tables if needed, and surface the data through the `@/lib` data layer.

---

## 1. Problem & Diagnosis (verified against live DB, 2026-07-03)

The user's instinct was right, but the cause is narrower than "everything is stale."

### 1.1 Freshness (ground truth, `MAX(period)` per source)

| Source                                                                                                         | Latest in DB   | Upstream latest                       | Verdict        |
| -------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------- | -------------- |
| Zillow (all geos)                                                                                              | 2026-05-31     | 2026-05                               | current        |
| Redfin Market Tracker                                                                                          | 2026-05-31     | 2026-05                               | current        |
| Realtor.com                                                                                                    | 2026-05-01     | 2026-05                               | current        |
| Economic (FRED/BEA/BLS)                                                                                        | 2026-04-01     | ~Apr (reporting lag)                  | likely current |
| Building permits (Census BPS)                                                                                  | 2026-04-01     | ~Apr (reporting lag)                  | likely current |
| **Redfin Data Center** (housing_market, price_drops, contract_cancellations, delistings, RHPI, buyers/sellers) | **2026-04-30** | **2026-05-31** (published 2026-06-03) | **STALE**      |
| **Redfin DC** cash_loan, investors (quarterly)                                                                 | **2025-12-31** | Q1 2026 likely                        | **STALE**      |

Confirmed upstream: `housing_market/country.csv` carries `LAST UPDATED = 2026-06-03`, `MAX(PERIOD END) = 2026-05-31`. Our DB is a month+ behind.

### 1.2 Root cause

The Redfin Data Center importer (`scripts/sources/redfin-data-center/import-redfin-dc.ts`) is fully built, tested, and has ~30 populated tables — **but it is wired into no schedule**. It is absent from `scripts/import-all-non-zillow.config.ts` `PIPELINES` and from every GitHub Actions workflow. Every other source refreshes monthly (17th, `monthly-data-pipeline.yml`); DC only ran when someone ran it by hand, last ~April → frozen at 4/30.

This is a "the code exists but nothing calls it" failure. Row counts stayed healthy (millions of rows), so it hid — only `MAX(period)` reveals it.

### 1.3 Coverage is already as complete as Redfin allows

`redfin-dc-config.ts` is explicit about what Redfin publishes:

- **Full 5-geo** (country/state/metro/county/zip) — already have county + ZIP tables: `housing_market`, `price_drops`, `contract_cancellations`, `delistings_relistings`.
- **Metro-max upstream** (cannot add county/zip — the data does not exist): `investors` (metro + category), `cash_loan` (metro), `buyers_and_sellers` (top-50 metro), `rhpi` (metro). The config even warns: _"Redfin only publishes this dashboard at the top-50-metro level… Do not 'fix' this to all_metros."_

**Implication:** "include DC for metro/county/zip" is already satisfied for every dataset that upstream supports. No new tables are required. The problem is purely freshness + exposure.

### 1.4 `@/lib` exposure is thin

Despite all those datasets in the DB, the frontend surfaces Redfin as a _first-class, selectable metric_ in only **two** places (the metro-only migration metrics). Everything else (sale-to-list, sold-above-list, price-drop share, delistings, cancellations, RHPI, investor share, cash share) reaches the UI only as a **fallback provenance label** — not a metric a user can pick. Backend `getRedfinDcRoute` routes only **metro/county/zip** and only the **`housing_market`** table — it ignores the state DC tables that exist and the other 7 dashboards.

### 1.5 Score boundary is safe

The live PropertyIQ score is clean Zillow + Realtor (no Redfin) — refreshing/exposing DC does not touch it (verified along `propertyiq-data-fetcher.ts` → `propertyiq-scoring-engine.ts`). There is _misleading stale copy_ claiming the score uses "3 Redfin demand indicators" (`lib/data/definitions.ts`, dead comment in `formula-weights.ts`) — a documentation hazard to correct, not a functional risk.

### 1.6 Adjacent pipeline gaps found during the audit

- `qcew-employment` and `irs-migration` are defined `PIPELINES` but **excluded from the scheduled `--only` list** — they never refresh on schedule.
- `redfin-migration` is a **guaranteed no-op** (Redfin publishes no public migration file; both candidate S3 URLs 403).
- The "new data" freshness gate keys **only on Zillow(county) + Realtor** — a month that advances only DC/economic/census/permits/hud does **not** trigger the post-import scoring/refresh.

---

## 2. Open Decisions (need user input; defaults chosen to proceed while AFK)

1. **Uncommitted WIP files.** The working tree has live uncommitted edits in the DC routing area: `table-routes-redfin.ts` (untracked/new) + modified `table-routes.ts`, `sales-activity.ts`, `calculated.ts`, `metric-resolution.types.ts` (+ a test snapshot). These overlap the "fix state routing" task.
   - **Default while AFK:** _Leave them alone._ Do not edit those 5 files. Phase 3's routing change is deferred/coordinated, not applied on top of live WIP.
2. **Refresh mechanism for the full audit.**
   - **Default:** _Hybrid._ Run Redfin DC locally now (public data, no secrets, idempotent — fixes the cited complaint immediately). Route the heavy/secret-gated full refresh (Realtor ZIP ≈770 MB/8 GB heap; FRED/BEA/BLS/Census API keys not in local `.env`) through CI `workflow_dispatch` with `force_refresh` after the scheduling fix is merged to `main`.
3. **DC metric shortlist for `@/lib`** — see §4.2. Confirm/trim the proposed set.

---

## 3. Scope

**In scope (maximal, per user):** full freshness audit + refresh of every source; schedule Redfin DC + repair the dropped pipelines + fix the freshness gate; expose a curated set of first-class DC metrics through `@/lib`; extend DC backend routing to state + additional dashboards; correct the stale "score uses Redfin" copy.

**Out of scope:** any change to the PropertyIQ score inputs (Redfin stays out of the score); creating county/zip tables for datasets Redfin only publishes at metro (impossible); the legacy v3 `rf_*` scoring scaffolding beyond the doc/copy fix.

---

## 4. Design

### Phase 1 — Fix the root cause (scheduling & gate)

- Register `redfin-data-center` as a `PIPELINE` in `scripts/import-all-non-zillow.config.ts` (entry point `import-redfin-dc.ts`, appropriate timeout).
- Add it (and re-add `qcew-employment`, `irs-migration`) to the scheduled `--only` list in `.github/workflows/monthly-data-pipeline.yml`, and to the `workflow_dispatch` source choices.
- Decide `redfin-migration`: either document it as intentionally-manual (needs `REDFIN_MIGRATION_S3_URL`) or drop it from `PIPELINES` so it stops implying scheduled coverage.
- Extend the freshness gate (`scripts/lib/latest-periods.ts` + the workflow diff step) to include a DC bellwether (`redfin_dc_housing_market_county.period_end`) and an economic bellwether, so non-Zillow/Realtor months still trigger the refresh.

### Phase 2 — Refresh everything now

- **Redfin DC:** run `import-redfin-dc.ts` (incremental; `--full` for the quarterly `investors`/`cash_loan` if the 3-month window misses Q1 2026). Target: DC → 2026-05-31 (monthly) / latest quarter (quarterly). _(Housing-market validation run already in progress this session.)_
- **Everything else:** CI `force_refresh`. Verify each source's `MAX(period)` advances (or is confirmed at true upstream latest). Record before/after in a results doc.

### Phase 3 — Expose through `@/lib`

**Backend (deferred if WIP files are locked):**

- Extend `getRedfinDcRoute` to `state` (tables exist) and to a `(dashboard, geo)` shape so dashboards beyond `housing_market` are routable.
- Add DC entries to the fallback registry where DC is the best/only source (respecting existing primaries; DC is already primary for `sale_to_list`).

**Frontend (`packages/frontend/lib/data`, safe — no WIP overlap):**

- Add first-class metrics to the registry + a DC fetcher + `metric-categories.tsx`, each with correct `supportedGeos` and `format`, sourced from the metrics SSOT (no duplication; use `formatValue`/registry format).
- Correct `definitions.ts` score provenance copy + the dead `formula-weights.ts` comment.

### Phase 4 — Verify

- `nest build` + backend tests + frontend `vitest` + lint, all clean (fix ALL errors, not just ours — per lessons.md).
- Render each new metric on the map + a report against the live DB (no mocks — per feedback).
- Dry-run the freshness gate + confirm the workflow `--only` includes DC.

### 4.2 Proposed DC metric shortlist (§2 decision 3)

**Full geo (metro/county/zip):**
| Metric | DC column | Dashboard | Notes |
| --- | --- | --- | --- |
| Sold Above List % | `share_sold_above_original_list` | housing_market | competitiveness/demand signal; net-new |
| Listings w/ Price Cuts % | `percent_active_with_price_drops` | price_drops | ⚠ overlaps Realtor `price_reduced_share` — distinct measure; label carefully |
| Delisting Share % | `share_of_listings_delisted` | delistings_relistings | unique; nothing else has it |
| Pending Cancellation % | `percent_of_pending_sales` | contract_cancellations | deal fall-through; unique |
| Sale-to-List Ratio | `average_sale_to_list_ratio` | housing_market | already DC-primary; promote to selectable |

**Metro-only (correct `supportedGeos: ['metro']`):**
| Metric | DC column | Dashboard | Cadence |
| --- | --- | --- | --- |
| Redfin HPI | `redfin_home_price_index` | rhpi | monthly |
| Investor Market Share % | `investor_market_share` | investors | quarterly |
| All-Cash Purchase % | `percent_all_cash` | cash_loan | quarterly |
| Buyer/Seller Ratio | `buyer_seller_ratio` | buyers_and_sellers | monthly (top-50) |

---

## 5. Risks & Mitigations

- **Clobbering live WIP** → default: don't touch the 5 uncommitted files; coordinate first.
- **Score contamination** → DC never added to `PROPERTYIQ_FORMULA_METRICS`; frontend metrics are display-only; verify score inputs unchanged post-change.
- **Metric duplication** (CLAUDE.md §1.1) → price-cuts metric overlaps Realtor's; either alias or clearly distinguish; single source of truth in the registry.
- **Heavy local imports OOM** → run heavy/secret-gated sources via CI, not locally.
- **Quarterly incremental miss** → use `--full` for `investors`/`cash_loan` if the monthly 3-month cutoff skips Q1 2026.
- **Norton/node TLS** → run imports with `NODE_OPTIONS=--use-system-ca`.

## 6. Acceptance criteria

- `redfin_dc_*` monthly tables at `MAX(period_end) = 2026-05-31`; quarterly at latest published quarter.
- `import-redfin-dc.ts` runs on the monthly schedule; freshness gate reacts to DC-only advances.
- All confirmed-stale sources at true upstream latest (before/after recorded).
- Proposed DC metrics selectable in the UI, rendering live data at correct geos, formatted via the registry.
- Score inputs provably unchanged; stale "score uses Redfin" copy corrected.
- Build + tests + lint clean; live-data render verified.
