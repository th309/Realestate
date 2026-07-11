# SEO Market Page Internal Linking — Design

**Date:** 2026-07-11
**Status:** DRAFT — awaiting user review
**Trigger:** `docs/audits/reventure-competitor-capture-2026-07-09/ACTION-PLAN.md` item #1 ("push SSR per-geography market page coverage and internal linking harder — this is the whole game"). Scoped down from the full item during brainstorming (see §1).

---

## 1. Problem & Scope

The competitor audit's item #1 bundled two different-sized problems: "expand scored-geo coverage" and "internal linking depth." A coverage-headroom investigation (live DB query against `propertyiq_scores_v2` + `geography_crosswalk`, 2026-07-11) found coverage is already near-saturated:

| Level  | Max universe | Published | % covered | Real headroom                                                                                                                                                            |
| ------ | ------------ | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Metro  | 928 CBSAs    | 935       | ~100%+    | none — already maxed                                                                                                                                                     |
| County | 3,238        | 3,138     | 96.9%     | 13 recoverable via freshness fix; 87 structurally uncoverable (no data, ever)                                                                                            |
| ZIP    | 39,499       | 29,708    | 75.2%     | ~4,431 recoverable (fell out of the 2-month publish window, no new data needed); ~18,552 structurally capped (would need new data sourcing — separate future initiative) |

**This spec covers internal linking only.** ZIP publish-window recovery and any new data sourcing are explicitly out of scope — separate, smaller/larger projects respectively, not attempted here.

### 1.1 Current internal-linking state (verified 2026-07-11)

All under `packages/frontend/app/(public)/markets/`:

- Every page type (`[slug]/page.tsx` metro, `county/[slug]/page.tsx`, `zip/[slug]/page.tsx`, `state/[state]/page.tsx`) has its own copy-pasted inline "related markets" block — no shared component.
- All existing crosslinks are **same-tier, same-state only**, ranked by score: metro→~5 other metros, county→~6 other counties (+1 parent metro link), ZIP→~6 other ZIPs (+county +metro links).
- **Zero cross-tier down-links.** Metro pages never link to their counties or ZIPs. County pages never link to their ZIPs. Only the state hub (`state/[state]/page.tsx`) shows the full hierarchy, capped at 12 ZIPs per parent.
- Breadcrumbs are shallow everywhere — `Home / Markets / {current page}` only, no intermediate state/metro/county crumbs, matched by equally shallow `BreadcrumbList` JSON-LD.
- The plumbing to fix this already exists: backend `geography_crosswalk` table + `GeographyChainService`, and frontend static slug-data (`metro-slug-data.ts`, `county-slug-data.ts`, `zip-slug-data.ts`) where every entry already carries its parent pointer (`cbsaCode`, `countyFips`). What's missing is the _reverse_ index (parent → children) and a shared component to render it.

---

## 2. Goals / Non-Goals

**Goals:**

- Every metro page links down to its counties and ZIPs (capped + "view all").
- Every county page links down to its ZIPs (capped + "view all").
- Full breadcrumb chain (Home / Markets / State / Metro / County / ZIP, skipping tiers that don't apply) with matching JSON-LD on every market page.
- Consolidate the four duplicated same-tier link blocks into one shared component.
- All new links are genuinely crawlable (real routes, not client-only reveals) and included in the sitemap.

**Non-Goals:**

- True geographic-proximity "nearby" (lat/long distance) — hierarchy relationships only (metro's counties, county's ZIPs, same-state ranked list). No new geo data sourced.
- Recovering the ~4,431 freshness-gapped ZIPs or the ~18,552 structurally-uncovered ZIPs/counties.
- Changing the scoring pipeline, publish-window logic, or de-scored-redirect _policy_ (only extending its _coverage_ to new routes, see §3.4).

---

## 3. Architecture

### 3.1 Data layer — `lib/data/market-hierarchy.ts`

A new shared, memoized utility built from the **existing** static slug-data (no new generation step, no new JSON emitted at slug-gen time — avoids a second source of truth that could drift from `generate-{metro,county,zip}-slugs.ts`):

- `getCountiesForMetro(cbsaCode)` / `getZipsForMetro(cbsaCode)` / `getZipsForCounty(countyFips)` — reverse indexes built once by grouping `county-slug-data.ts` / `zip-slug-data.ts` entries on their existing `cbsaCode`/`countyFips` fields. This is the same grouping `state/[state]/page.tsx` already does ad hoc (`zipsByMetro`/`zipsByCounty`) — pulled into one reusable place.
- `getAncestorChain(geoType, slug)` — resolves the full parent chain (state, metro, county as applicable) for breadcrumbs. Returns partial chains gracefully — a non-CBSA county (no parent metro; common) omits the metro tier rather than erroring.
- ZIPs dropped at slug-gen time for unresolvable city names (existing `skippedNoCity` logic) are absent from the source data and therefore automatically absent from every reverse-index list — no extra filtering needed.

### 3.2 Components

**`MarketRelatedLinks`** (`app/(public)/markets/components/`) replaces the four duplicated inline blocks. Renders up to three groups depending on the current page's tier:

- **Down-links** (metro→counties/zips, county→zips): capped list (top N by score) + "View all N →" link to the corresponding overflow page (§3.3). Suppressed entirely when total children ≤ cap — an overflow page identical to the capped list is dead weight.
- **Up-links** (county→metro, zip→county→metro): same links as today, now sourced from `market-hierarchy.ts` instead of each page's own inline lookup.
- **Same-tier nearby** (same-state, ranked by score): unchanged behavior, just moved out of the four duplicated blocks into this one component.

**`MarketBreadcrumbs`** replaces the four separate shallow breadcrumb implementations. Renders the full ancestor chain from `getAncestorChain()`, skipping inapplicable tiers, and emits the matching `BreadcrumbList` JSON-LD from the _same_ chain data so visible crumbs and structured data cannot drift apart.

### 3.3 New overflow routes

| Route                               | Contents                   |
| ----------------------------------- | -------------------------- |
| `/markets/[metroSlug]/counties`     | every county in that metro |
| `/markets/[metroSlug]/zips`         | every ZIP in that metro    |
| `/markets/county/[countySlug]/zips` | every ZIP in that county   |

Generated via `generateStaticParams` only for metros/counties that already have a published page — no separate score-gating logic needed. Each gets `MarketBreadcrumbs` and is genuinely indexable content (a link-hub page, same spirit as the existing state hub which already passed SEO audit), not thin/utility content to noindex. Approximate new-page count: ~925 metro→counties + ~925 metro→zips + ~3,115 county→zips ≈ **4,965 pages**.

### 3.4 Sitemap & de-scored redirects

- New overflow URLs are added to the existing child-sitemap pattern in `lib/seo/sitemap-builder.ts` (extends existing metro/county/zip sections — no new sitemap-index entry type needed).
- `scripts/generate-descored-redirects.ts` is extended so that when a metro/county is de-scored, its overflow pages 307-redirect alongside its main page (to the same ancestor target the main page redirects to) — otherwise a de-scored parent's overflow pages would orphan/404 while the redirect fires only on the main page.

---

## 4. Edge Cases

- **Non-CBSA counties** (no parent metro — common, rural): omit the metro crumb/link everywhere; `getAncestorChain` returns a chain without that tier rather than erroring.
- **Small metros/counties** (child count ≤ display cap): suppress the "view all" link — nothing new to show.
- **De-scored geo**: its page and all its overflow pages must redirect together (§3.4) — no orphaned overflow page pointing at a since-removed parent.
- **ZIPs with no resolvable city name**: already excluded at slug-gen time; must not appear in any reverse-index list (automatic, since the index is built from the same filtered source data).

---

## 5. Testing

- Unit tests for `market-hierarchy.ts` — given fixture slug-data, verify metro→counties/zips and county→zips group correctly, including the non-CBSA-county case.
- Unit tests for `MarketBreadcrumbs` — visible crumb list matches emitted `BreadcrumbList` JSON-LD for each tier, including the omitted-metro case.
- Build-time spot check: one large metro (many counties/ZIPs, overflow page + "view all" link present) and one small metro (below cap, no overflow page/link) render correctly after `generateStaticParams`.
- Manual E2E: walk a live metro→county→ZIP chain end to end, confirm every new link resolves (no 404s), confirm the new URLs appear in `/sitemap.xml`'s child sitemaps, and confirm the de-scored-redirect fast-follow fires correctly for an overflow page of a manually-de-scored test geo.

---

## 6. Out of Scope (explicit)

- ZIP publish-window freshness recovery (~4,431 ZIPs) — smaller, separate fast-follow candidate.
- New data sourcing for structurally-uncovered ZIPs/counties (~18,552 / 87) — larger, separate initiative on the scale of the paused "Backlog #4" work.
- True geographic-proximity nearby-markets (lat/long distance).
