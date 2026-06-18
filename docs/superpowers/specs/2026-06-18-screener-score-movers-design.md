# Screener PropertyIQ Score Movers — Design Spec

- **Date:** 2026-06-18
- **Status:** Approved design → ready for implementation plan
- **Author:** Claude (brainstormed with th309)
- **Topic:** Screen markets by PropertyIQ Score change over time on `/screener`; refresh the lookup table monthly, after rescoring.

---

## 1. Goal

On the `/screener` page, let users screen for the **biggest movers up and down** in the
**PropertyIQ Score** across six time windows: **1M, 3M (~90d), 6M (~180d), 1Y, 3Y, 5Y**.

A "mover" is the **change in the PropertyIQ Score itself** over the window
(e.g. a metro that went from 64 → 78 over one year = **+14 pts**). Not price, not rent.

The capability ships in **two UI surfaces** that read the **same single lookup table**:

1. **Integrated** into the existing filterable screener (Δ column + Gainers/Losers presets + Δ filter).
2. A **dedicated Movers tab** (Top Gainers / Top Losers leaderboards).

---

## 2. Key findings (from DB + code investigation)

### 2.1 No backfill needed — history is already complete

The current Redfin-free Zillow+Realtor formula already has **complete monthly history** in
`propertyiq_scores_v2` (read via the `propertyiq_scores` view) for all three geo levels:

| Geo    | Earliest   | Latest     | Distinct periods | Regions |
| ------ | ---------- | ---------- | ---------------- | ------- |
| metro  | 2001-01-31 | 2026-05-31 | ~305             | 935     |
| county | 2001-01-31 | 2026-05-31 | 305              | 3,151   |
| zip    | 2001-01-31 | 2026-05-31 | 305              | ~34,000 |

Every requested window is a lookup against existing data. **No backfill, no re-scoring**
(re-scoring historical months is explicitly forbidden — Redfin revises inputs; the score
history is frozen except the latest period). The index
`idx_piq_v2_location (geography, location_id, score_date DESC)` already makes
"score at date X for region Y" a cheap seek.

### 2.2 Latent ordering bug this feature also fixes

Today the screener snapshot is refreshed **before** the monthly rescore:

- `.github/workflows/post-import-refresh.yml`
  - Job `refresh-calculated-metrics` → runs `packages/backend/src/scripts/refresh-calculated-metrics.ts`,
    which calls `ScreenerService.refreshScreenerSnapshot()` at **lines 113–127** (non-fatal).
  - Job `run-scoring-pipeline` (`needs: refresh-calculated-metrics`) → runs
    `packages/backend/src/scripts/refresh-piq-scores.ts`, which writes the new month to
    `propertyiq_scores_v2`.

So the snapshot is rebuilt from **last month's** scores; the fresh rescore reaches the
screener only on the _next_ monthly run. The user's requirement ("update this table after
rescoring") corrects this: the snapshot must refresh **after** scoring completes.

---

## 3. Data model — extend the single lookup table

The screener already reads exactly one denormalized table, `screener_snapshot`, rebuilt by
the `refresh_screener_snapshot()` Postgres RPC. **Add six nullable numeric columns to that
same table** (no second table, no live history self-join at request time):

```
score_chg_1m   score_chg_3m   score_chg_6m   score_chg_1y   score_chg_3y   score_chg_5y
```

### 3.1 Delta semantics

Per region, using that region's own latest score `s0` at date `d0` (the snapshot `as_of`):

```
score_chg_Nm = round( s0 - score_at(d0 − N months) )
```

- Scores are month-end dated and dense monthly back to 2001, so the **baseline is an exact
  month-end match**: `baseline_date = (date_trunc('month', d0) - interval 'N months')` snapped
  to month-end, joined on `(geography, location_id, score_type='propertyiq', score_date)`.
- **Window → months:** 1M→1, 3M→3 (~90d), 6M→6 (~180d), 1Y→12, 3Y→36, 5Y→60.
- Deltas are **integer points** (scores are clamped 1–99, so range ≈ −98…+98). Positive =
  gainer, negative = loser.

### 3.2 Null handling (short history)

If a region has no score at the baseline month-end (e.g. a ZIP first scored in 2016 has no
5Y baseline), `score_chg_Nm` is `NULL`. NULL deltas render as `—` in the UI and are
**excluded** from that window's gainers/losers ranking (`nullsFirst: false`, and filtered out
of leaderboards).

### 3.3 Refresh function changes

Extend `refresh_screener_snapshot()` (current definition in
`supabase/migrations/20260615162207_screener_snapshot_home_value_rent.sql` lines 10–116):

- Add a CTE that, for each `(geography, location_id)` already in `latest_scores`, computes the
  six baseline scores via month-end-matched joins to `propertyiq_scores_v2` (or the
  `propertyiq_scores` view) and derives the six deltas.
- Populate the six new columns in the INSERT.
- Keep the existing 600s statement timeout; the six extra seeks per region are index-served.
- New migration follows convention `YYYYMMDDhhmmss_<desc>.sql` (e.g.
  `<ts>_screener_snapshot_score_movers.sql`): `ALTER TABLE … ADD COLUMN …` ×6, then
  `CREATE OR REPLACE FUNCTION refresh_screener_snapshot()` with the delta logic.

---

## 4. Orchestration — refresh **after** rescoring, monthly

**Requirement:** the snapshot (now carrying the deltas) updates every month, _after_ the PIQ
rescore. Implementation:

1. **Remove** the `refreshScreenerSnapshot()` call from `refresh-calculated-metrics.ts`
   (lines 113–127) so the table is no longer built prematurely.
2. **Add a new CI job** `refresh-screener-after-scoring` in `post-import-refresh.yml`:
   - `needs: run-scoring-pipeline`
   - `if:` scoring job reported success
   - runs a new dedicated script
     `packages/backend/src/scripts/refresh-screener-snapshot-only.ts` that boots a minimal
     Nest context and calls `ScreenerService.refreshScreenerSnapshot()`.
   - In this job the refresh is **fatal** (non-zero exit on failure) — a stale/half-built
     movers table should fail loudly, not warn.

This guarantees the table is rebuilt exactly once per month, after both fresh calculated
metrics (job 1) and fresh scores (job 2) exist, so every delta reflects the latest rescore.

> Alternative considered (B): append the refresh to the end of `refresh-piq-scores.ts`.
> Rejected as default because it couples scoring and snapshot concerns in one script and
> loses the clean CI-level success gate. Chosen approach keeps the existing job-dependency
> pattern used elsewhere in the workflow.

---

## 5. Backend

`packages/backend/src/screener/`

### 5.1 Read path (integrated screener)

- `screener.dto.ts`: add the six `score_chg_*` columns to `SORTABLE_COLUMNS`; add query params
  `changeWindow` (`1m|3m|6m|1y|3y|5y`) + optional `changeMin` / `changeMax` (class-validator).
- `screener.service.ts` `queryScreener()`: when `changeMin`/`changeMax` present, apply the
  range filter to the column resolved from `changeWindow`; allow `sortBy` to be any
  `score_chg_*` column. Select the six columns into `ScreenerRow`.

### 5.2 Movers endpoint (dedicated tab)

- `GET /api/screener/:geo/movers?window=1y&limit=25&state=TX` →
  `{ window, gainers: ScreenerRow[], losers: ScreenerRow[] }`.
- Implemented as two ordered reads of `screener_snapshot` on the resolved `score_chg_*`
  column (desc for gainers, asc for losers, both filtering out NULLs), optional `state`
  filter. Reuses existing query plumbing; no new table.
- Public read-only, same caching posture as `GET /api/screener/:geo`.

---

## 6. Frontend

`packages/frontend/app/(app)/screener/` + `packages/frontend/lib/data/`

### 6.1 Data layer (`lib/data/fetchers/screener.ts`, `lib/data/hooks/`)

- Add the six `score_chg_*` fields to `ScreenerRow`.
- Add `changeWindow` / `changeMin` / `changeMax` to `ScreenerQuery`.
- Add `MoverWindow = '1m'|'3m'|'6m'|'1y'|'3y'|'5y'`, `fetchScreenerMovers(geo, window, opts)`
  and `useScreenerMovers(geo, window, opts)`. Export from `lib/data/index.ts`.

### 6.2 Shared controls

- **Tab switch** `Screener | Movers` (URL state via existing `screener-url-state.ts`).
- **Window selector** (`1M · 3M · 6M · 1Y · 3Y · 5Y`, labels show `90d`/`180d` tooltips),
  shared by both tabs; URL-persisted. New component `components/WindowSelector.tsx`.

### 6.3 Integrated tab

- New **Δ Score** column in `ScreenerTable.tsx` bound to the active window's `score_chg_*`
  value: `▲ +N` green / `▼ −N` red / `—` neutral (`text-on-surface-variant`). Sortable.
- Two new presets in `PresetChips.tsx`: **Biggest Gainers**
  (`sortBy: score_chg_<window>, sortOrder: desc`) and **Biggest Losers** (`… asc`).
- Δ range filter (min/max) for the active window in `FilterRail.tsx`.
- CSV export gains a `Score Δ (window)` column.

### 6.4 Movers tab

- New `components/MoversTab.tsx`: Top Gainers + Top Losers leaderboards side-by-side for the
  active window + geo + state, each row = rank · market · `▲/▼ ±N` · current score. Uses
  `useScreenerMovers`.

### 6.5 File-size compliance

`ScreenerPageInner.tsx` is already 325 lines (limit 400). Extract the tab/window/leaderboard
orchestration into child components (`WindowSelector`, `MoversTab`, a `ScreenerTabs` switch)
so no file exceeds its limit; one exported component per file.

### 6.6 Gating

Δ inherits today's gating exactly: ZIP stays Pro-gated (`GeoLockCard`), CSV export stays Pro.
No new paywalls. Movers tab honors the same ZIP gate.

---

## 7. Edge cases

- **Missing baseline** → `NULL` delta → `—`, excluded from rankings (§3.2).
- **Per-region `as_of`** — each region's delta uses its own latest score date as `d0`; a
  region missing the current month (rare) computes deltas from its latest available month.
- **Ties** — leaderboards break ties by current `score` desc, then `region_name`.
- **Clamping** — deltas can be large at long windows (a market crossing the full 1–99 range);
  display the raw integer, no artificial cap.

---

## 8. Testing (real DB, no mocks)

- **SQL/migration:** apply migration to a Supabase branch (or verify against prod read-only);
  assert the six columns populate and spot-check a known metro's 1Y delta against a manual
  `propertyiq_scores_v2` two-row query.
- **Backend E2E:** hit `GET /api/screener/metro?sortBy=score_chg_1y&sortOrder=desc` and
  `GET /api/screener/metro/movers?window=1y` against the real DB; assert ordering, NULL
  exclusion, and that gainers[0].score_chg_1y ≥ gainers[1]….
- **Frontend E2E (Playwright, live data):** load `/screener`, switch window, toggle the
  Movers tab, apply a Gainers preset, confirm the Δ column renders signed colored values and
  the leaderboard matches the API. Open the real page in a browser before declaring done.
- **Orchestration:** dry-run `refresh-screener-snapshot-only.ts` against the DB and confirm
  row count > 0 and `as_of` equals the latest scored month.

---

## 9. Non-goals

- No backfill / re-scoring (history complete to 2001; re-scoring is forbidden).
- No price/rent/other-metric movers (score change only).
- No daily/real-time updates (monthly, post-rescore only).
- No new entitlement gates beyond today's.

---

## 10. Open choices deferred to implementation

- Exact Δ color thresholds (flat green/red vs. magnitude-graded intensity).
- Default window on first load (proposed: **1Y**).
- Leaderboard length on the Movers tab (proposed: top **25** each side).
