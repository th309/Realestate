# Content & Spam Audit — PropertyIQ Programmatic Location Pages

> **Audit date:** 2026-06-19
> **Rubric applied:** `docs/seo/google-rubric/01-foundations-content-quality.md` (Google Search Central, read 2026-06-19)
> **Scope:** The ~43,665 programmatic `/markets/*` location pages (935 metro + 3,231 county + ~39,499 ZIP). Real estate is **YMYL (finance)** — the E-E-A-T bar is high.
> **Method:** Read the page templates + prose generators + stats fetcher (code), fetched 6 live pages (WebFetch), and queried the production scores DB (Supabase project `pysflbhpnqwoczyuaaif`) for coverage.

---

## TL;DR VERDICTS

| Question                    | Verdict                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Scaled content abuse**    | **AT RISK (borderline violation).** The _narrative prose_ is a fixed template library with only place-name/state/region interpolated — zero data in the prose. Genuine per-geo value lives **only** in the separate `MarketStatsBlock` (real numbers). Where that block is present the page survives B1; where it is absent (empty geos), the page is pure templated boilerplate and crosses the line. |
| **Thin/empty-geo handling** | **VIOLATION (Critical).** No data-sufficiency gate exists. ~10,082 ZIP pages (25.5%) and ~94 county pages have **no current PropertyIQ score**, yet all render indexable 200 shells AND are listed in the sitemap. This is textbook soft-404 + scaled-content exposure.                                                                                                                                |
| **E-E-A-T / YMYL**          | **Significant gaps.** No author byline, no public methodology link (methodology page is auth-gated), no Organization/publisher schema sitewide, and a stale-data fallback that presents 2-year-old scores as current.                                                                                                                                                                                  |
| **Doorway-page risk**       | **Medium.** A real state→metro→county→ZIP hierarchy with crawlable internal links exists (mitigates B2), but the prose's repeated "Generate a free AI market report / Explore the interactive map" CTAs plus near-identical templates lean toward funnel-first.                                                                                                                                        |

---

## HOW THE PAGE CONTENT IS GENERATED (evidence)

**Three page templates**, structurally identical:

- `packages/frontend/app/(public)/markets/[slug]/page.tsx` (metro)
- `packages/frontend/app/(public)/markets/county/[slug]/page.tsx`
- `packages/frontend/app/(public)/markets/zip/[slug]/page.tsx`

Each page renders two distinct content layers:

### Layer 1 — Narrative prose (`seoContent`): FIXED TEMPLATES, NO DATA

`seoContent` comes from `generate-seo-content.ts` in each route dir. The generators:

- `packages/frontend/app/(public)/markets/[slug]/generate-seo-content.ts`
- `packages/frontend/app/(public)/markets/county/[slug]/generate-seo-content.ts`
- `packages/frontend/app/(public)/markets/zip/[slug]/generate-seo-content.ts`

Mechanism (`generateMarketSeoContent` etc.): a deterministic `hashString(geoId + slug)` picks one of **5 opening / 3 middle / 3 closing** template functions, plus a region paragraph keyed on a 9-bucket `STATE_REGIONS` map and an optional `STATE_CONTEXT` blurb for ~11 large states. **The template functions take only `(name, state)` / `(shortName, zip, state)` — never a single market number.** Example (metro opening template, lines 116-117):

> "The {name} metropolitan area represents a distinct segment of {state}'s housing landscape. The PropertyIQ Score combines price momentum…"

Every paragraph describing "the market" is generic methodology copy with the place name swapped in. There is **no median price, rent, DOM, YoY, or score** anywhere in the prose. This was confirmed verbatim on all 6 live pages — e.g. Austin's and Aberdeen's overview paragraphs are word-for-word identical except for "Austin, TX" / "Aberdeen, SD" and the region/state blurb.

**Combinatorics:** the entire prose universe is 5×3×3 = 45 opening/middle/closing permutations × 9 region paragraphs × ~11 optional state blurbs. ~39,499 ZIP pages draw their prose from **3 ZIP opening × 3 middle × 3 closing × 9 region = 81 base permutations**. Thousands of pages share byte-identical prose bodies differing only by place name.

### Layer 2 — `MarketStatsBlock`: REAL per-geo data (the only genuine value)

`packages/frontend/app/(public)/markets/components/MarketStatsBlock.tsx`, fed by `fetchSeoMarketStats` in `packages/frontend/lib/data/fetchers/market-stats.ts`. This renders the actual varying numbers: PropertyIQ Score + grade, Median Price, Rent (ZORI), Median DOM, YoY, the four "what drives the score" receipts, a sparkline, a "Data through {month year}" line, and per-source attribution. JSON-LD `Dataset` (`buildStatsJsonLd.ts`) is emitted alongside.

**Critical coupling:** `fetchSeoMarketStats` returns `null` when `snapshot.success === false` (line 176). The page renders the block **only** `{stats && <MarketStatsBlock .../>}`. So on a no-data geo, **the entire data layer disappears and the page is reduced to Layer 1 templated prose** — with no `notFound()`, no `noindex`. The page never calls `notFound()` for missing data; it only 404s on an unknown slug.

### Coverage gap (production DB, latest score period 2026-05-31)

| Geo     | Slugs (pages) | Scored at latest period | Unscored shells     |
| ------- | ------------- | ----------------------- | ------------------- |
| Metro   | 935           | 935                     | 0 (100%)            |
| County  | 3,231         | 3,137                   | ~94 (~3%)           |
| **ZIP** | **~39,499**   | **29,417**              | **~10,082 (25.5%)** |

~10,000+ ZIP pages have no current score. The sitemap (`packages/frontend/lib/seo/sitemap-builder.ts`) lists **every** slug with no data filter (only a `/^\d{5}$/` shape check on ZIPs), actively inviting Google to crawl the empty shells.

---

## FINDINGS (rule → evidence → severity → fix)

### F1 — Thin/empty geographies ship as indexable 200 shells (no data-sufficiency gate)

- **Rule:** B1 Scaled Content Abuse + C3 Thin-content gate + A2 (soft-404). "If you're hosting such content on your site, exclude it from Search." ZIPs/counties with sparse data "get excluded from Search, not shipped as 200 shells." — `developers.google.com/search/docs/essentials/spam-policies`, `…/fundamentals/creating-helpful-content`, `…/essentials/technical`
- **Observed:** No `noindex`/`notFound()` is ever conditioned on data presence (confirmed across all 3 `page.tsx` + `(public)` layouts + root `app/layout.tsx`, which defaults `robots: index:true`). `fetchSeoMarketStats` returns `null` on no-data and the page silently drops `MarketStatsBlock`, leaving only templated prose, yet still returns 200 and is sitemapped. DB shows ~10,082 ZIP + ~94 county slugs unscored at the latest period.
- **Severity:** **Critical**
- **Fix:**
  1. In each `markets/**/page.tsx`, after `const stats = await fetchSeoMarketStats(...)`, gate indexability on data sufficiency. Define a threshold (valid PropertyIQ score AND ≥1 populated headline metric AND a fresh `latestDate`). If unmet, either `return notFound()` (preferred for never-scored geos) or emit `noindex` via `generateMetadata` (`robots: { index: false, follow: true }`). Because `generateMetadata` and the page body both run per request, lift the sufficiency check into a shared `getGeoData(slug)` helper so metadata and body agree.
  2. In `packages/frontend/lib/seo/sitemap-builder.ts`, filter `buildZipChunkUrls` / `buildCountiesUrls` / `buildMetrosUrls` to only slugs that pass the same sufficiency gate (requires a build-time manifest of scored geo IDs, or a cached coverage set). Keep the sitemap in lockstep with the index gate (rubric E6).

### F2 — Narrative prose is template-with-place-name, not data-driven (scaled-content / spin risk)

- **Rule:** B1 ("unoriginal content that provides little to no value… no matter how it's created"; "synonymizing… or other obfuscation"), B3 cookie-cutter templated content, C2c ("extensive automation… without value"), C2d ("summarizing what others have to say without adding much value"). — `…/essentials/spam-policies`, `…/fundamentals/creating-helpful-content`
- **Observed:** The `seoContent` prose contains zero geo-specific numbers; it is one of ~45-81 fixed permutations with the place name interpolated. Austin and Aberdeen overview paragraphs are byte-identical except the proper noun. On pages WHERE `MarketStatsBlock` renders, the real data rescues the page; on empty geos (F1) only this prose remains, which is exactly the "many pages where the content makes little or no sense to a reader but contains search keywords" pattern.
- **Severity:** **High** (escalates to Critical on the empty-geo subset)
- **Fix:** Make the prose genuinely data-derived. In each `generate-seo-content.ts`, change the generator signature to also accept the fetched `MarketStatsData` and weave the actual numbers + comparisons into the sentences (e.g. "Aberdeen's median home value is $243K, up 10.6% year over year, with homes selling in a median 43 days — a PropertyIQ Score of 81 (top band) versus the South Dakota average of 50."). Vary the _substance_ (the numbers, the direction of trends, the state comparison), not just the noun. This is the single highest-leverage change to move from "at risk" to "compliant" on B1. Pair with F1 so no-data pages never reach the prose at all.

### F3 — Stale-data fallback presents outdated scores as current (freshness / trust)

- **Rule:** D4b "keep data current… show data 'as of' dates"; C2h "changing the date of pages to make them seem fresh when the content has not substantially changed." — `…/fundamentals/creating-helpful-content`
- **Observed:** Live ZIP `35201-birmingham-al` (a PO-box-only ZIP, dropped from current scoring) renders **PropertyIQ Score 44** with **"Data through Jan 2026"** and YoY/3-mo momentum shown as "—". DB confirms its latest score row is **2024-02-29** while the system's latest ZIP period is **2026-05-31**. The page serves a 2-year-old score with no staleness warning, presented identically to fresh pages. This is the snapshot fetcher returning the most-recent-available row regardless of age.
- **Severity:** **High** (YMYL — a user makes a financial decision on a stale number)
- **Fix:** Add a max-staleness threshold in `assembleMarketStats` / the snapshot path (e.g. score/metric older than ~90 days is treated as absent). Stale geos then fall into the F1 gate (noindex/404). Where data is shown, surface the actual observation date prominently and a visible "as of" badge when older than the latest pipeline period. Confirm `dateModified` in the `Dataset` JSON-LD reflects the true observation date (it currently uses `data.latestDate`, which is good — but it must not advance when nothing changed, per C2h).

### F4 — No author/Organization/methodology E-E-A-T signals on the YMYL pages

- **Rule:** D1 (authorship self-evident, bylines), D2 (AI/automation disclosure — "Is the use of automation, including AI-generation, self-evident to visitors?"), D4a (cite credible sources), F-section Organization schema. — `…/fundamentals/creating-helpful-content`, `…/appearance/structured-data/sd-policies`
- **Observed:**
  - **No author byline** on any market page.
  - **No public methodology link.** A methodology page exists at `app/(app)/scores/methodology/page.tsx` but it is in the auth-gated `(app)` group — not reachable by Googlebot or anonymous users, and not linked from any public market page.
  - **No sitewide Organization/publisher schema.** Only a per-stats `Dataset` (with `creator: Organization "PropertyIQ"`) and a `BreadcrumbList` are emitted, and the `Dataset` only renders when stats exist.
  - Source attribution text IS present ("Sourced from Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED, BLS, and BEA") — good, partially satisfies D4a — but it is a flat string with no links to the source authorities and lists sources (Redfin, BEA) not actually used by the score.
- **Severity:** **High** (YMYL)
- **Fix:**
  1. Publish a **public** methodology page (move/duplicate `/scores/methodology` out of `(app)` to a crawlable route, e.g. `/methodology` or `/scores/methodology` in `(public)`), disclosing the score formula, the four inputs, data sources + cadence, validation window, and that narratives are data-generated (satisfies D2). Link to it from every market page footer near the source line.
  2. Add a sitewide `Organization` JSON-LD (in root or `(public)` layout) with `name`, `url`, `logo`, and `sameAs`, independent of per-stats data.
  3. Add a visible byline/attribution ("Analysis by PropertyIQ — methodology") linking to the methodology page; consider `author`/`publisher` on a `Dataset` or `WebPage`.
  4. Correct the source line to list only sources that actually back the displayed stats (per-statistic source is already shown in the block — make the footer consistent and link each source).

### F5 — Doorway / funnel-first leanings in near-duplicate templates

- **Rule:** B2 Doorway abuse ("substantially similar pages closer to search results than a browseable hierarchy"; "pages generated specifically to funnel visitors elsewhere"), D3 "Why" must be helping users not funneling. — `…/essentials/spam-policies`, `…/fundamentals/creating-helpful-content`
- **Observed:** Mitigating factors are real: a genuine crawlable state→metro→county→ZIP hierarchy exists with descriptive `<a href>` internal links (e.g. ZIP pages link to parent county + parent metro + nearby ZIPs ranked by score), satisfying E3 and pushing back on the doorway label. BUT every closing paragraph is a CTA ("Generate a free AI market report", "Explore the interactive map", "view the full market dashboard"), and the templates are otherwise near-identical across thousands of pages — the combination reads funnel-leaning, especially on thin geos.
- **Severity:** **Medium**
- **Fix:** Once F2 makes each page's body genuinely data-distinct and F1 removes empty shells, the doorway risk largely resolves. Additionally, demote the repeated signup CTA from the prose body to a single unobtrusive component, and ensure the page's primary value (the data + analysis) is complete without needing to click through (rubric C1d/C2e — reader shouldn't need to search/sign up again).

### F6 — Internal linking & hierarchy (compliant — note as strength)

- **Rule:** E3 crawlable internal links + descriptive anchors; B2 real browseable hierarchy. — `…/fundamentals/seo-starter-guide`
- **Observed:** Server-rendered `<Link>` (real `<a href>`) lists of nearby same-state geos ranked by PropertyIQ score, plus parent county/metro links, all in SSR HTML (confirmed on live pages — Austin links to Abilene/Snyder/Amarillo etc.; ZIPs link to parent county + metro). Descriptive anchors (place names). This is correctly implemented.
- **Severity:** **Low (no action)** — keep; this is a genuine doorway-defense.

### F7 — Titles/descriptions/canonicals (mostly compliant — minor)

- **Rule:** E1 unique titles, E2 unique descriptions, E5 one canonical. — `…/fundamentals/seo-starter-guide`
- **Observed:** Each page sets a per-geo `title` ("{name} Housing Market — 2026 Analysis"), a per-geo `description`, and a self-referential `canonical` (confirmed in all 3 `generateMetadata`). Titles/descriptions vary by place name but the structure and the hardcoded "2026 Analysis" are boilerplate, and descriptions are template-with-name (not built from the geo's standout data, which E2 recommends).
- **Severity:** **Low**
- **Fix:** Optionally enrich descriptions with the geo's actual standout number (e.g. "Median $243K, +10.6% YoY, PropertyIQ Score 81"). Avoid hardcoding a year in the title if it can go stale; drive it from `latestDate`.

---

## SOURCES (Google Search Central, per rubric, read 2026-06-19)

- Spam policies — https://developers.google.com/search/docs/essentials/spam-policies
- Technical requirements — https://developers.google.com/search/docs/essentials/technical
- Creating helpful, reliable, people-first content (E-E-A-T) — https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- How Search Works — https://developers.google.com/search/docs/fundamentals/how-search-works
- SEO Starter Guide — https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Structured data policies — https://developers.google.com/search/docs/appearance/structured-data/sd-policies

## KEY FILES

- `packages/frontend/app/(public)/markets/[slug]/page.tsx` (+ `county/`, `zip/`) — page templates, no data/index gate
- `packages/frontend/app/(public)/markets/[slug]/generate-seo-content.ts` (+ `county/`, `zip/`) — fixed prose template libraries (no data)
- `packages/frontend/app/(public)/markets/components/MarketStatsBlock.tsx` — the only genuine per-geo value layer
- `packages/frontend/lib/data/fetchers/market-stats.ts` — `fetchSeoMarketStats` returns null on no-data (page degrades to prose-only)
- `packages/frontend/lib/data/fetchers/market-snapshot.ts` — snapshot fetch (stale-row fallback, no freshness ceiling)
- `packages/frontend/app/(public)/markets/components/buildStatsJsonLd.ts` — `Dataset` JSON-LD (only when data exists)
- `packages/frontend/lib/seo/sitemap-builder.ts` — emits ALL slugs, no data filter
- `packages/frontend/app/robots.ts` — allows all `/markets/*`
- `packages/frontend/app/(app)/scores/methodology/page.tsx` — methodology page, auth-gated (not public/crawlable)
