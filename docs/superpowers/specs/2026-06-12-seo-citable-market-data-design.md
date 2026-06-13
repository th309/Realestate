# Design: Citable Market Data on SEO Pages (Backlog #4 — GEO Play)

**Date:** 2026-06-12
**Status:** Approved design → writing implementation plan
**Backlog item:** #4 "Put real, citable market data on the 94%-traffic SEO pages (GEO play)"
**Audit ref:** `docs/superpowers/results/2026-06-10-piq-product-audit.md` §3 Rec #4
**Discovery artifact:** `tasks/issue4-discovery-findings.md` (7-agent codebase + DB sweep)

---

## 1. Problem & Goal

94% of traffic lands on programmatic SEO pages (`/markets/[slug]`, `/markets/county/[slug]`, `/markets/zip/[slug]`, `/markets/state/[state]`) that today show **one unexplained PropertyIQ score plus boilerplate prose** — while the real market data (price, rent, DOM, months of supply, YoY) sits in the database unused. Structured, attributed, fresh numbers are exactly what Google AI Overviews, Perplexity, and ChatGPT cite. The goal is to put **real, server-rendered, source-attributed market data** on every SEO page so the pages become citable (GEO) and convert.

**Success = a crawler with JavaScript disabled sees the real numbers, each labeled with its actual source and as-of date, matching direct DB queries.**

---

## 2. Current State (verified in discovery)

- **Pages:** All four levels are RSC shell (`page.tsx`) + client content component (`MetroPageContent`/`CountyPageContent`/`ZipPageContent`/`StatePageContent`), ISR `revalidate = 86400`, `generateStaticParams()` over static slug data. Today the numbers (score, AI overview) are fetched **client-side** → invisible to crawlers.
- **Batch endpoint already exists:** `GET /api/market-snapshot/{geoType}/{geoId}?state=XX` → `fetchMarketSnapshot()` (`lib/data/fetchers/market-snapshot.ts`). Returns score + grade + all metrics, each with `{value, date, source, sourceGeoId, sourceGeoLevel, isInherited, isFallback}`. SSR-friendly: one call per page.
- **Data depth (verified by SQL):** 14+ trailing monthly points at metro/county, 10+ years at ZIP. 12-month sparkline + YoY are real. Freshness: Zillow/Realtor ≈ Apr 2026, legacy Redfin frozen Mar 2026.
- **YoY data is abundant** in `redfin_*`/`realtor_*` (`median_sale_price_yoy`, `median_dom_yoy`, `median_listing_price_yy`, …). The empty `calculated_metrics.zhvi_yoy_change` column is irrelevant.
- **Months of supply:** computed `MoS = active_listings / homes_sold` from `redfin_dc_housing_market_*` via `scripts/sources/redfin-data-center/redfin-dc-mos-hook.ts` → `calculated_metrics`. **County (Apr 2026, ~3,107) and ZIP (~30,249) are fresh and broad. Metro is the gap: the Redfin DC _metro_ feed only carries ~93 metros.** The legacy `redfin_metro.months_of_supply` is dead (frozen Mar 2026). The PropertyIQ Score's supply input reads legacy Redfin first, computed `calculated_metrics` as fallback (`propertyiq-data-fetcher.ts`) — so it is exposed to the same staleness.
- **Bugs confirmed:** county SEO generator double-appends state ("Bastrop County, TX, TX") at `app/markets/county/[slug]/generate-seo-content.ts:139`; AI-insights endpoint `GET /api/insights/:geoLevel/:regionId` throws **404** when generation is unavailable (no fallback), section silently disappears.
- **Related markets** are an alphabetical `.filter(state).slice(N)` with no relevance signal; the rankings API (`get_top_markets_by_state` RPC, `/api/v1/rankings/...`) exists but is unused by SEO pages.
- **Capture components** exist and are reusable: `NewsletterSignup` (source/context tracked → `newsletter_signups`), `LeadMagnetModal` (`/api/lead-magnet`), `AnonCaptureModal` (email-first, backlog #2). Persona type `"agent" | "investor" | "homebuyer"` exists; SEO pages are anonymous (persona = UI toggle, not stateful).

---

## 3. Scope

**Full backlog #4 in one plan**, plus the prerequisite MOS-computation fix it depends on. Eight workstreams:

1. **MOS computation fix (P0, backend)** — county→metro CBSA rollup; prefer computed over dead legacy Redfin.
2. **`MarketStatsBlock`** — server-rendered stats block on metro/county/ZIP.
3. **Freshness + attribution + confidence + schema.org** — honest, real-`period_date` labels.
4. **State-page top-10 ranked tables.**
5. **Bug: "TX, TX" double-state suffix.**
6. **Bug: AI-insights 404 → 200 + templated fallback.**
7. **Relevance-based related markets.**
8. **Role-segmented capture blocks (investor / homebuyer / agent).**

---

## 4. Component Designs

### 4.1 MOS computation fix (P0 — gates the stats block and protects the score)

**Why first:** the stats block must show a fresh, broad MOS at metro level, and the legacy Redfin column is dead. The fresh source (`redfin_dc_housing_market_county`, ~3,107 counties, Apr 2026) covers everything; metros are county aggregations.

**Change:** extend `redfin-dc-mos-hook.ts` to compute **metro** MOS by rolling county DC rows up to CBSA:

- Join `redfin_dc_housing_market_county.region_id` (county FIPS) → `geography_crosswalk` → `cbsa_code`.
- Sum `active_listings` and `homes_sold` per `(cbsa_code, period_end)`, then `MoS = Σactive / Σhomes_sold` (skip metros with zero homes sold).
- Upsert into `calculated_metrics` (`geography_type='metro'`, conflict key `geography_id,geography_type,period_date`).
- Keep the existing direct metro path for the ~93 metros Redfin publishes directly; rollup fills the rest. Prefer the direct value when present (it's the true CBSA figure), rollup otherwise.

**Resolver preference:** in `fallback-registry/calculated.ts`, flip `months_of_supply` so `calculated` is tried **before** the dead `redfin` legacy column. Verify this does not regress PropertyIQ scores (compare computed vs legacy MoS on a sample; confirm `propertyiq-data-fetcher.ts` fallback still resolves). Per the "never bulk re-score history" rule, do **not** re-score historical periods — only ensure the current/next period resolves a fresh computed MoS.

**Run:** execute the hook to backfill metro MOS; verify metro coverage in `calculated_metrics` jumps from ~93 to ~900+ at the latest period.

**Acceptance:** metro MOS present for ≥~900 metros at the latest period; values sane vs known markets; score sample unchanged within tolerance; county/ZIP unaffected.

### 4.2 `MarketStatsBlock` (server component)

A **pure server component** (no `'use client'`) rendered inside each `page.tsx` (metro/county/zip) so the numbers are in the initial HTML.

- **Data:** one server-side `fetchMarketSnapshot(geoType, geoId, state)` for headline values + score + per-field metadata, plus a server-side 12-month `fetchTimeSeriesData` for the headline metric's sparkline + YoY (computed from the same series so the % matches the number shown). All via `@/lib/data` (add a thin server fetcher if needed; never direct `fetch`).
- **Fields (6):** median price, rent, DOM, months of supply, YoY delta, 12-month sparkline.
- **Sparkline:** rendered as a **static inline SVG** server-side (no JS, fully crawlable).
- **Composition:** reuse `StatCard`/`StatGrid` (`components/data-display/StatCard.tsx`) where it composes cleanly as a server component; otherwise a focused new presentational component. Per the audit-follow-composition rule, read every child before assuming reuse.
- **Placement:** in the crawlable region of `page.tsx` (between H1/score and the SEO prose section), at all three geo levels. County/ZIP share the block; props differ only by geo identity.
- **Missing data:** render `DataUnavailable`-style states per field; never fabricate or `|| 0`.

### 4.3 Freshness, attribution, confidence, schema.org

- **Replace** the misleading `"Last updated: {today}"` footer with the **real `period_date`** per field: `"Data through {Mon YYYY} · Source: {Zillow|Redfin|Realtor|Census}"`, derived from snapshot `date`/`source` metadata. Different fields may show different dates (e.g., MoS Apr 2026 computed; price Apr 2026 Zillow) — that's honest and correct.
- **Confidence chip:** A/B/C/F from snapshot recency + `isFallback`/`isInherited` (reuse `app/components/scoring/` confidence utilities; do not invent a parallel system).
- **Schema.org:** structured data describing the stat values + dates so they are machine-citable; `dateModified` = actual latest `period_date`.

### 4.4 State-page top-10 ranked tables

Replace the unranked top-12 grid in `StatePageContent` with **server-rendered** top-10 metros and top-10 counties **by PropertyIQ score** (via `get_top_markets_by_state` RPC / rankings API, server-side), each row: rank, name (link), score + grade, and 1–2 stats (e.g., median price, DOM). Keep a "Browse all" list below. Add appropriate table schema.org markup.

### 4.5 Bug — "TX, TX" double-state suffix

Fix `app/markets/county/[slug]/generate-seo-content.ts` so the opening template receives a name **without** the state (use `county.name`, not `county.shortName`, or drop the `, ${state}` in the template). Audit `metro`/`zip` `generate-seo-content.ts` for the same double-append. Add a scripted sweep over all state-suffix slugs to prove zero "XX, XX".

### 4.6 Bug — AI-insights 404 → 200 + templated fallback

In `packages/backend/src/insights/*`, when generation is unavailable/fails, return **200 with a deterministic, data-driven summary** built from the real stats (price/rent/DOM/MoS/score) instead of throwing 404. The fallback prose follows the AI-prose rules (no markdown, no em-dashes, no code identifiers — see `feedback_ai-prose-style`). Live AI overwrites it when present. Preserve the cache path. Frontend renders whatever 200 returns.

### 4.7 Relevance-based related markets

Replace the alphabetical slice in metro/county/zip pages with **same-state top-by-PropertyIQ-score** (rankings API/RPC, server-side); for county/ZIP, group candidates under their parent metro (`cbsaCode` already in slug data). No lat/lon regeneration. Falls back to existing same-state list if rankings are unavailable.

### 4.8 Role-segmented capture blocks

A capture block with three tappable persona tabs — **Investor / Homebuyer / Agent** — each with tailored value-prop copy (investor: monthly score + cashflow; homebuyer: affordability + best-time signals; agent: listing-presentation data). Submits to the existing `/api/newsletter` (and/or `/api/lead-magnet`) with the selected persona carried in the `source`/`context` field so conversion-by-persona is measurable. Visually and behaviorally consistent with the email-first `AnonCaptureModal` (backlog #2). Render server-side where possible; the tab toggle is a small client island.

---

## 5. Cross-cutting

- **Data-layer compliance:** every new fetch goes through `@/lib/data` (add fetchers, export from `index.ts`). No direct `fetch(API_URL...)`.
- **Build/perf:** to avoid ~24k build-time backend calls, `generateStaticParams` pre-renders top-N popular slugs only; the long tail generates on-demand via ISR (`dynamicParams=true`, `revalidate=86400`). Watch the frontend Railway build heap (`project_railway-frontend-heap`).
- **Source-of-truth:** metric IDs/formats stay in `app/map/config/metrics.ts` / `registry.ts`; formatting via `formatMetricValue()`/`getMetricFormat()`. No duplicate metric definitions.
- **Backend metric fallback** stays in `MetricResolutionService` / `FALLBACK_REGISTRY` — the MoS source change is a registry edit, not ad-hoc code.

---

## 6. Non-Goals

- No new score type; no changes to the PropertyIQ Score formula (only protect its MoS input freshness).
- No `overvalued_pct`/seasonality (those are backlog #24).
- No paywall/gating redesign (#2/#19); no analyzer bridge changes (#3, already shipped).
- No Redfin data-vendor negotiation; metro MoS is solved by county→CBSA rollup of existing data.

---

## 7. Risks & Mitigations

| Risk                                                             | Mitigation                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| County→metro MoS rollup misses metros lacking crosswalk coverage | First acceptance gate: verify ≥~900 CBSAs reachable from DC counties via `geography_crosswalk`; report any gap loudly before shipping |
| Flipping MoS resolver order changes PropertyIQ scores            | Compare computed vs legacy MoS on a sample; verify latest-period score unchanged within tolerance; do not re-score history            |
| SSR snapshot fetch slows build / OOMs Railway                    | Pre-render top-N + on-demand ISR for the tail; monitor build heap                                                                     |
| Headline value and YoY come from different sources               | Compute YoY from the same timeseries used for the headline; label source per field                                                    |
| Stat block reuse assumptions wrong                               | Read every reused child component before composing (audit-follow-composition)                                                         |

---

## 8. E2E Verification (real DB, real browser — no mocks)

- **curl (JS disabled)** of 5 metro, 3 county, 3 ZIP real pages returns the stats block with numbers **matching direct DB queries** for those regions.
- **MoS:** metro `calculated_metrics` coverage ≥~900 at latest period; stats block shows a real MoS (not "—") on sampled metros; score sample verified unchanged.
- **"TX, TX" sweep** over all state-suffix slugs returns zero.
- **AI-insights** returns **200 or designed fallback** on 20 sampled slugs — no 404s.
- **schema.org** validates (Rich Results); freshness label = actual latest `period_date` from DB.
- **State pages:** top-10 tables render real scores matching the rankings API.
- **Related markets:** rendered list is relevance-ordered (same-state by score), not alphabetical.
- **Capture:** each persona tab submits and lands a row with the correct persona in the real DB.
- Verified across anonymous + free tiers in a live browser.

---

## 9. Open Questions

None blocking. Methodology note to surface in UI: computed MoS is closed-sales-based (`active_listings / homes_sold`); metro values for non-DC metros are county-rollup aggregates — label accordingly if we expose methodology copy.
