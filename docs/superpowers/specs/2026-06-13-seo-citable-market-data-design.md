# Design: Citable Market Data on SEO Pages (Backlog #4 — GEO Play) — REBUILD

**Date:** 2026-06-13
**Status:** Approved design → writing implementation plan
**Backlog item:** #4 "Put real, citable market data on the 94%-traffic SEO pages (GEO play)"
**Audit ref:** `docs/superpowers/results/2026-06-10-piq-product-audit.md` §3 Rec #4
**Supersedes:** `docs/superpowers/specs/2026-06-12-seo-citable-market-data-design.md` (built around a Months-of-Supply score input that no longer exists — see §2.1)
**Discovery artifacts:** `tasks/issue4-discovery-findings.md` (7-agent sweep) + live scoring/DB re-verification 2026-06-13 (this doc §2).

---

## 1. Problem & Goal

94% of traffic lands on programmatic SEO pages (`/markets/[slug]`, `/markets/county/[slug]`, `/markets/zip/[slug]`, `/markets/state/[state]`) that today show **one PropertyIQ score plus boilerplate prose** — while the real market data (price, rent, DOM, YoY) and the score's own inputs sit in the database, fetched client-side and therefore **invisible to crawlers**. Structured, attributed, fresh numbers are exactly what Google AI Overviews, Perplexity, and ChatGPT cite.

**Goal:** put **real, server-rendered, source-attributed market data + the score's own receipts** on every SEO page so the pages become citable (GEO) and convert.

**Success = a crawler with JavaScript disabled sees the real numbers — both the headline market stats and the four values that produced the PropertyIQ score — each labeled with its actual source and as-of date, matching direct DB queries.**

---

## 2. Current State (verified 2026-06-13)

### 2.1 The scoring overhaul that invalidated the prior spec

On 2026-06-12 the PropertyIQ Score was rebuilt (commits `7dff1ce8`, `b9427c23`):

- **Formula:** `signal = z(zhvi_yoy) + z(zhvi_mom_3m) − z(median_days_on_market) − z(price_reduced_share)` → percentile rank → re-center at zero-crossing **50** → clamp 1–99 → grade + confidence. (`packages/backend/src/scoring/formula-weights.ts:656-679`, `propertyiq-scoring-engine.ts`)
- **Four inputs, two sources, Redfin-free:** ZHVI YoY + ZHVI 3-mo momentum (**Zillow**); median days on market + price-reduced share (**Realtor.com**). `months_of_supply` and all Redfin columns are **removed from the live scoring path** (`propertyiq-data-fetcher.ts` has zero Redfin references; MOS survives only in dead `COMPONENT_GROUPS`/`percentile.service.ts`).
- **Basis — computed nationally, calibrated to state** (resolved in commit `72f68bb3`, documented in `CLAUDE.md:431/451` and `scoring.service.ts:7-9`): z-scores and the percentile rank are cross-sectional across ALL markets at a geo level (**not** partitioned by state); the scale is then calibrated/validated so **50 = the market's state-average 3-yr performance**. Both "national-basis computation" and "50 = state average" are true — they answer different questions. **Hard rule: never write that the score is "ranked within state" / "relative within each state, not nationally."** A real `CalibrationService` backs this.

**Consequence for this spec:** the prior spec's P0 workstream (county→CBSA Months-of-Supply rollup, existing only to "protect the score's MOS input") is **deleted**. There is no MOS input. The audit's "three named inputs (% Sold Above List, Median DOM, Months of Supply)" are the _old_ inputs and must not appear anywhere.

### 2.2 The score row already carries the receipts (verified in DB)

`propertyiq_scores` (READ view; WRITE to `propertyiq_scores_v2`) columns: `geography, location_id, location_name, score_type, score, grade, confidence, confidence_level, median_price, return_1y, return_3y_ann, score_date, z_scores (jsonb)`.

- `scoring.service.ts:142` persists the four raw inputs as `z_scores: JSON.stringify(r.inputMetrics)`; `:192-198` rebuilds them into `components` when `options.components === true`.
- **Coverage at latest period (2026-04-30), verified by SQL:**

  | Geo    | Scored | With `z_scores` | With `median_price` |
  | ------ | ------ | --------------- | ------------------- |
  | metro  | 935    | 935 (100%)      | 865 (92%)           |
  | county | 3,134  | 3,134 (100%)    | 3,072 (98%)         |
  | zip    | 29,213 | 29,213 (100%)   | 26,275 (90%)        |

- `z_scores` holds **raw, displayable values** (despite the column name), e.g. `{"zhvi_yoy":0.336,"zhvi_mom_3m":0.079,"median_days_on_market":13,"price_reduced_share":0}`. `zhvi_yoy`/`zhvi_mom_3m`/`price_reduced_share` are fractions (format as %); `median_days_on_market` is raw days.
- **Per-field nulls are real:** low-confidence rows (scored on 2/4 inputs, `confidence_level` C/F) have null `median_days_on_market`/`price_reduced_share`. The receipts strip must render a clean "—" per missing field and the confidence grade explains why.
- Live ZIP coverage is **29,213** (not the "~34,000" CLAUDE.md cites). Use verified numbers in any copy.

### 2.3 Batch endpoint exposes score + receipts + headline metrics in one call

`GET /api/market-snapshot/{geoType}/{geoId}?state=XX` → `fetchMarketSnapshot()` (`packages/frontend/lib/data/fetchers/market-snapshot.ts`). The service (`packages/backend/src/market-snapshot/market-snapshot.service.ts`):

- Calls `getScore(..., {components: true})` (line 732) and returns `scores.propertyiq.{score, grade, components}` (line 440) — **components = the four input values, server-side, ungated at the service layer.**
- Returns `metrics` (price, rent/ZORI, DOM, …) each with `{value, date, source, sourceGeoId, sourceGeoLevel, isInherited, isFallback}`.
- **Gating caveat:** the _scoring controller_ (`scoring.controller.ts:980-998`) strips `components` for non-Pro users (score/grade/confidence always public; breakdown Pro-only). The **market-snapshot** path bypasses that controller. **Decision (approved): receipts are public on SEO pages** — exposed via the SSR market-snapshot path; Pro gating stays on the interactive app surfaces. (DOM and price-reduced-share are headline stats anyway, so nothing truly secret is exposed.) **Verify** the market-snapshot endpoint is anon-accessible and does not itself strip `components`.

### 2.4 SEO page structure

- Four levels = RSC shell `page.tsx` + client content component (`MetroPageContent`/`CountyPageContent`/`ZipPageContent`/`StatePageContent`). ISR `revalidate = 86400`, `generateStaticParams()` over static slug data (`@/lib/data/*-slug-data`). Today score + AI overview are fetched **client-side** → invisible to crawlers.
- The server-rendered SEO section already exists (H2 + prose + attribution footer); it's where server-rendered numbers belong.
- **Stat components for reuse:** `components/data-display/StatCard.tsx` (`StatCard`, `StatGrid`, `MiniStat`). Confidence utilities live in `app/components/scoring/`. Per the audit-follow-composition rule, read every child before assuming reuse.

### 2.5 Bugs & gaps confirmed

- **"Bastrop County, TX, TX":** `county.shortName` already includes state; `app/markets/county/[slug]/generate-seo-content.ts:139` templates append `, ${state}` again. Audit metro/zip generators for the same pattern.
- **AI-insights 404:** `GET /api/insights/:geoLevel/:regionId` (`insights.controller.ts`) throws **404** when generation is unavailable (`insights.service.ts:78` returns null → controller 404). Frontend swallows it; section silently disappears.
- **Related markets** are an alphabetical `.filter(state).slice(N)` (metro `MetroPageContent.tsx:31-33`, county `page.tsx:70-72`, zip `page.tsx:75-77`). The `get_top_markets_by_state` RPC and `/api/v1/rankings/...` exist but are unused by SEO pages.
- **Score copy:** commit `72f68bb3` fixed score copy in `county/` and `zip/` `generate-seo-content.ts`, **but not metro's** `markets/[slug]/generate-seo-content.ts` (the bulk of ~935 pages) — must verify/fix.
- **Capture:** `NewsletterSignup` (→ `/api/newsletter`, `source`/`context` tracked), `LeadMagnetModal` (→ `/api/lead-magnet`), `AnonCaptureModal` (email-first). Persona type `"agent" | "investor" | "homebuyer"` exists; SEO pages are anonymous (persona = UI toggle, not stateful).

---

## 3. Scope — 7 workstreams

(The old 8 minus the deleted MOS workstream.)

1. **`MarketStatsBlock`** server component (metro/county/zip): headline stats + score-receipts strip.
2. **Freshness + attribution + confidence + schema.org** — honest real-`period_date` labels.
3. **State-page top-10 ranked tables.**
4. **Bug:** "TX, TX" double-state suffix.
5. **Bug:** AI-insights 404 → 200 + templated fallback.
6. **Relevance-based related markets** (same-state by PropertyIQ score).
7. **Role-segmented capture blocks** (investor / homebuyer / agent).

---

## 4. Component Designs

### 4.1 `MarketStatsBlock` (server component)

A **pure server component** (no `'use client'`) rendered inside each `page.tsx` (metro/county/zip) so numbers are in the initial HTML.

- **Data (2 server calls, both via `@/lib/data`; no direct `fetch`):**
  1. `fetchMarketSnapshot(geoType, geoId, state)` → score, grade, confidence, the 4 receipt `components`, and headline `metrics` (median price, rent/ZORI, DOM) with per-field `{source, date, isFallback, isInherited}`.
  2. `fetchTimeSeriesData('home_value', geoLevel, geoId, { historyMonths: 12 })` → 12 points for the price sparkline.
  - Add thin **server** fetchers if the existing ones are client-only; export from `lib/data/index.ts`.
- **Two regions:**
  - **Headline row (4 stats):** Median Price, Rent (ZORI), Median DOM, YoY + 12-mo sparkline under price.
  - **"What drives the score" strip (4 receipts):** ZHVI YoY, ZHVI 3-mo momentum, Median DOM, Price-Reduced Share — read from the score's `z_scores`/`components`.
- **Consistency rule (load-bearing):** headline **YoY** = `z_scores.zhvi_yoy` and headline **DOM** = `z_scores.median_days_on_market`, so the headline number can never contradict the receipts strip. Price/rent come from the snapshot's resolved sources.
- **Formatting:** via `formatMetricValue()`/`getMetricFormat()` only (CLAUDE.md §6). `zhvi_yoy`/`zhvi_mom_3m`/`price_reduced_share` → percent; DOM → days; price/rent → currency.
- **Sparkline:** static inline **SVG** rendered server-side (no JS, fully crawlable). Reuse `StatCard`'s sparkline rendering only if it composes as a server component; otherwise a focused presentational SVG helper.
- **Missing data:** per-field `DataUnavailable`-style "—"; never fabricate or `|| 0`.
- **Placement:** in the crawlable region of `page.tsx`, between the H1/score and the SEO prose section, all three geo levels. County/ZIP share the component; props differ by geo identity only.
- **Reference layout (approved):**
  ```
  ┌──────────────────────────────────────────────┐
  │ Austin, TX  ·  PropertyIQ Score 72 (B)         │
  ├──────────────────────────────────────────────┤
  │ Median Price  Rent(ZORI)  Median DOM   YoY     │
  │ $469K         $1,604      90 days     -0.5%    │
  │ ▁▂▃▅▆▇                                          │
  ├─ What drives the score ───────────────────────┤
  │ ZHVI YoY +2.1% │ 3-mo +0.8% │ DOM 90d │ cuts18%│
  │ Source: Zillow/Realtor · Data through Apr 2026 │
  └──────────────────────────────────────────────┘
  ```
- **UI build:** invoke `frontend-design:frontend-design` at implementation time for the actual component (team convention).

### 4.2 Freshness, attribution, confidence, schema.org

- **Replace** the misleading `"Last updated: {today}"` footer with **real per-field `period_date`**: `"Data through {Mon YYYY} · Source: {Zillow|Realtor|Redfin|Census}"` from snapshot `date`/`source`. Different fields may carry different dates — that's honest. If a field resolves to frozen Redfin (Mar 2026), label it truthfully; do not silently substitute.
- **Confidence:** surface the score's existing `confidence_level` (A/B/C/F) and explainer using `app/components/scoring/` utilities. **Do not invent a parallel per-field grading system** (YAGNI); per-field honesty is carried by the source+date label, and the receipt nulls visibly explain a lower grade.
- **Score explainer copy** uses the national-basis-+-state-calibration language from `72f68bb3`; **never** "ranked within state."
- **Schema.org:** structured data describing the stat values + dates so they are machine-citable; `dateModified` = actual latest `period_date`. Validate in Rich Results.

### 4.3 State-page top-10 ranked tables

Replace the unranked top-12 grid in `StatePageContent` with **server-rendered** top-10 metros and top-10 counties **by PropertyIQ score** (`get_top_markets_by_state` RPC / rankings API, server-side). Each row: rank, name (link), score + grade, and 1–2 stats (median price, DOM). Keep a "Browse all" list below. Add table schema.org markup.

### 4.4 Bug — "TX, TX" double-state suffix

Fix `app/markets/county/[slug]/generate-seo-content.ts` so the opening template receives a name **without** the state (use `county.name`, or drop the `, ${state}` in the template). Audit metro/zip generators for the same double-append. Scripted sweep over all state-suffix slugs proves zero "XX, XX".

### 4.5 Bug — AI-insights 404 → 200 + templated fallback

In `packages/backend/src/insights/*`, when generation is unavailable/fails, return **200 with a deterministic, data-driven summary** built from the real stats (price/rent/DOM/score/the four inputs) instead of 404. Fallback prose follows AI-prose rules (no markdown, no em-dashes, no code identifiers — `feedback_ai-prose-style`). Live AI overwrites it when present; preserve the cache path. Frontend renders whatever 200 returns.

### 4.6 Relevance-based related markets (approved: same-state top-by-score)

Replace the alphabetical slice with **same-state markets ranked by PropertyIQ score** (rankings API/RPC, server-side). For county/ZIP, group candidates under their parent metro (`cbsaCode` is in slug data). No lat/lon regeneration, no slug-data pipeline change. Fall back to the existing same-state list if rankings are unavailable.

### 4.7 Role-segmented capture blocks

A capture block with three persona tabs — **Investor / Homebuyer / Agent** — each with tailored copy (investor: monthly score + cashflow; homebuyer: affordability + best-time; agent: listing-presentation data). Submits to `/api/newsletter` with the selected persona in the `source`/`context` field so conversion-by-persona is measurable. Visually/behaviorally consistent with the email-first `AnonCaptureModal` (backlog #2). Server-render where possible; the tab toggle is a small client island.

---

## 5. Cross-cutting

- **Data-layer compliance:** every new fetch goes through `@/lib/data` (add server fetchers, export from `index.ts`). No direct `fetch(API_URL…)`.
- **Source-of-truth:** metric IDs/formats stay in `app/map/config/metrics.ts` / `registry.ts`; formatting via `formatMetricValue()`/`getMetricFormat()`. No duplicate metric definitions.
- **Backend metric fallback** stays in `MetricResolutionService` / `FALLBACK_REGISTRY` — no ad-hoc fallback code.
- **Build/perf:** `generateStaticParams` pre-renders top-N popular slugs; the long tail (~33k pages) generates on-demand via ISR (`dynamicParams=true`, `revalidate=86400`). Watch the frontend Railway build heap (`project_railway-frontend-heap`).
- **No re-scoring:** this work only _reads_ `propertyiq_scores`; it never recomputes or backfills scores (`reference_redfin-rescore-history-diverges`).

---

## 6. Non-Goals

- No change to the PropertyIQ Score formula, basis, or calibration (read-only consumer).
- No MOS computation/rollup (deleted — the score has no MOS input).
- No `overvalued_pct`/seasonality (backlog #24).
- No paywall/gating redesign (#2/#19); no analyzer bridge changes (#3, shipped).
- No new score visualizations outside `app/components/scoring/` (CLAUDE.md §9).

---

## 7. Risks & Mitigations

| Risk                                                                    | Mitigation                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| market-snapshot endpoint strips `components` for anon, or requires auth | First verification gate: confirm anon SSR receives `components`; if not, add a public read path that returns them for SEO pages |
| Headline YoY/DOM diverge from the receipts                              | Source both from the score's `z_scores` (single source of truth) — not from a second metric fetch                               |
| Per-field null inputs render as "0" or blanks                           | Explicit "—" per missing field, tied to the displayed confidence grade                                                          |
| Metro `generate-seo-content.ts` still has stale/old-input score copy    | Verify and fix metro generator (not covered by `72f68bb3`) before shipping                                                      |
| SSR snapshot fetch slows build / OOMs Railway                           | Pre-render top-N + on-demand ISR for the tail; monitor build heap                                                               |
| A field resolves to frozen Redfin (Mar 2026)                            | Label source+date honestly; never silently substitute or relabel                                                                |
| Stat-block child-component reuse assumptions wrong                      | Read every reused child before composing (audit-follow-composition)                                                             |

---

## 8. E2E Verification (real DB, real browser — no mocks)

- **curl (JS disabled)** of 5 metro, 3 county, 3 ZIP real pages returns the stats block **and** the four receipt values, matching direct DB queries (`propertyiq_scores.z_scores` + market-snapshot) for those regions.
- **Receipts = score inputs:** the four displayed values equal `z_scores` for that geo; headline YoY/DOM equal the corresponding receipt values.
- **Null handling:** a low-confidence geo (2/4 inputs) renders "—" for the missing receipts and the matching confidence grade.
- **"TX, TX" sweep** over all state-suffix slugs returns zero.
- **AI-insights** returns 200 or designed fallback on 20 sampled slugs — no 404s.
- **schema.org** validates (Rich Results); freshness label = actual latest `period_date` from DB.
- **State pages:** top-10 tables render real scores matching the rankings RPC.
- **Related markets:** rendered list is same-state by score (county/ZIP grouped under parent metro), not alphabetical.
- **Capture:** each persona tab submits and lands a row with the correct persona in the real DB.
- **Score copy** on metro/county/zip uses the national-basis + state-calibration language; grep proves zero "within state / relative within each state" strings in rendered output.
- Verified across anonymous + free tiers in a live browser.

---

## 9. Decisions Made (this session)

- **Stats block content:** headline market stats + score receipts (Option A).
- **Receipts gating:** public on SEO pages via SSR market-snapshot; Pro gating stays on interactive app surfaces.
- **Related markets:** same-state top-by-PropertyIQ-score (county/ZIP grouped under parent metro); no proximity/lat-lon work.

## 10. Open Questions

None blocking. Methodology note to surface if we expose score-input methodology copy: `zhvi_yoy`/`zhvi_mom_3m` are Zillow ZHVI momentum; `median_days_on_market`/`price_reduced_share` are Realtor.com flow metrics; the score is computed nationally and calibrated so 50 = the market's state average.
