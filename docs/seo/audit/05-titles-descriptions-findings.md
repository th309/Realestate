# SEO Audit 05 — Titles & Meta Descriptions Across the 33k Programmatic Market Pages

> **Audited:** 2026-06-19
> **Rubric:** `docs/seo/google-rubric/05-appearance-titles-snippets-sd-core.md`
> **Scope:** `generateMetadata` for the four programmatic market route types (metro / ZIP / county / state) plus root robots/snippet config.
> **Core question answered:** Are titles/descriptions differentiated by per-page DATA, or boilerplate that varies only by place-name (which Google rewrites/penalizes)?

## Verdict (one line)

**Boilerplate.** Across all 33k+ pages, titles and descriptions interpolate **only the geography name + a hardcoded "2026"** — **zero live data** (no median price, no YoY %, no PropertyIQ score, no real date). This is exactly the two anti-patterns Google calls out: **"micro-boilerplate text in `<title>` elements"** (→ Google rewrites the title) and **"identical or similar descriptions on every page"** (→ "aren't helpful"). The live numbers that would fix this are **already fetched server-side** on the same page (`fetchSeoMarketStats` → `MarketStatsData.score / grade / headline.medianPrice / headline.yoy`); `generateMetadata` simply doesn't use them. **The remedy is low-cost.**

---

## What the templates actually emit (source of truth = the `generateMetadata` functions)

### Metro — `packages/frontend/app/(public)/markets/[slug]/page.tsx` (lines 16–56)

```
title:       `${metro.shortName} Housing Market — 2026 Analysis`
description: `See the latest ${metro.shortName} housing market data — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.`
```

- Interpolates: **place name only** (`metro.shortName`). Everything else, including the year, is a string literal.
- No brand in the `<title>` (the og/twitter title adds `| PropertyIQ` on ZIP/county but **not** the metro `<title>`).

### ZIP — `packages/frontend/app/(public)/markets/zip/[slug]/page.tsx` (lines 18–57)

```
cityState = zip.shortName.replace(`${zip.zip}, `, "")   // "99611, Kenai, AK" -> "Kenai, AK"
title:       `${zip.zip} ${cityState} Housing Market — 2026 Analysis`
description: `${zip.shortName} housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends at the ZIP code level. Updated 2026.`
```

- Interpolates: **ZIP + city/state only.** No live numbers.

### County — `packages/frontend/app/(public)/markets/county/[slug]/page.tsx` (lines 19–57)

```
title:       `${county.shortName} Housing Market — 2026 Analysis`
description: `${county.shortName} housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends. Updated 2026.`
```

- Interpolates: **place name only.** No live numbers.

### State — `packages/frontend/app/(public)/markets/state/[state]/page.tsx` (lines 17–58)

```
title:       `Best Cities to Invest in ${stateEntry.name} — 2026 Real Estate Market`
description: `Compare housing markets across ${stateEntry.name} — PropertyIQ scores, median home prices, rental yields, and AI-powered forecasts for every metro area and county. Find the best cities to invest in ${stateEntry.name} in 2026.`
```

- Interpolates: **state name only.** No live numbers. (51 pages — lower duplication risk than the 33k tail, but same boilerplate shape.)

**Conclusion of Step 2:** Every template interpolates **geography name + hardcoded "2026"** and nothing data-driven. Confirmed by the rendered visible title on the live ZIP page (WebFetch returned the page beginning with the literal `99611 Kenai, AK Housing Market — 2026 Analysis`), proving the templates render byte-for-byte as written.

---

## Live examples (reconstructed verbatim from the live templates + slug data; live H1 confirmed via fetch)

> Raw `<head>` byte-capture via curl/Invoke-WebRequest was blocked by tool permissions in this environment, so the strings below are computed from the exact template literals in `generateMetadata` and the real `shortName` values in the slug data (`metro-slug-data.json`, `county-slug-data.json`, `zip-slug-data.json`). They are what ships. The visible title on the Kenai ZIP page was independently confirmed verbatim via WebFetch.

### Metros (`shortName`: "Austin, TX" / "Aberdeen, SD" / "Denver, CO")

| Page                            | `<title>`                                     | `<meta name=description>`                                                                                                                       |
| ------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| austin-round-rock-san-marcos-tx | `Austin, TX Housing Market — 2026 Analysis`   | `See the latest Austin, TX housing market data — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.`   |
| aberdeen-sd                     | `Aberdeen, SD Housing Market — 2026 Analysis` | `See the latest Aberdeen, SD housing market data — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.` |
| denver-aurora-centennial-co     | `Denver, CO Housing Market — 2026 Analysis`   | `See the latest Denver, CO housing market data — median home prices, AI-powered forecasts, investor scores, and rental trends. Updated 2026.`   |

➡ The three descriptions are **word-for-word identical except the place name** — the textbook "identical or similar" case. (Note also the metro slug expands to a 3-city CBSA name "Austin-Round Rock-San Marcos, TX" but `shortName` collapses to "Austin, TX"; the title's geography is fine, it's the missing _data_ that's the problem.)

### Counties (`shortName`: "Alameda County, CA" / "Autauga County, AL")

| Page              | `<title>`                                           | `<meta name=description>`                                                                                                              |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| alameda-county-ca | `Alameda County, CA Housing Market — 2026 Analysis` | `Alameda County, CA housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends. Updated 2026.` |
| autauga-county-al | `Autauga County, AL Housing Market — 2026 Analysis` | `Autauga County, AL housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends. Updated 2026.` |

➡ Identical except the county name. Alameda (~1.6M people, ~$1.1M median) and Autauga (~60k people, ~$230k median) get **indistinguishable** metadata despite radically different markets.

### ZIPs (`shortName`: "35201, Birmingham, AL" / "99611, Kenai, AK" / "99645, Palmer, AK")

| Page                | `<title>`                                                           | `<meta name=description>`                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 35201-birmingham-al | `35201 Birmingham, AL Housing Market — 2026 Analysis`               | `35201, Birmingham, AL housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends at the ZIP code level. Updated 2026.` |
| 99611-kenai-ak      | `99611 Kenai, AK Housing Market — 2026 Analysis` _(confirmed live)_ | `99611, Kenai, AK housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends at the ZIP code level. Updated 2026.`      |
| 99645-palmer-ak     | `99645 Palmer, AK Housing Market — 2026 Analysis`                   | `99645, Palmer, AK housing market data — home prices, PropertyIQ demand score, investment analysis, and rental trends at the ZIP code level. Updated 2026.`     |

➡ Identical except the ZIP + city/state. ~34,000 ZIP descriptions share one sentence.

---

## Findings (graded against the rubric)

### 🔴 FINDING 1 — Titles are micro-boilerplate; Google will likely rewrite them (Rubric A2, checklist #2)

- **Google rule:** Google flags _"long text in the `<title>` element that varies by only a single piece of information"_ and _"micro-boilerplate text… where repeated boilerplate appears across a subset of pages with crucial distinguishing information missing."_ Remedy: _"dynamically update the `<title>` element to better reflect the actual content of the page."_ When boilerplate dominates, Google _"can detect the … information used in large, prominent title text and insert"_ its own. **Source:** https://developers.google.com/search/docs/appearance/title-link
- **Observed template:** `{Place} Housing Market — 2026 Analysis` on every metro/county/ZIP. The only varying token is the place name; `Housing Market — 2026 Analysis` is a fixed 27-char suffix repeated across all 33k+ pages. No page-specific data point.
- **Severity:** 🔴 CRITICAL (this is THE programmatic-scale rule).
- **Exact fix:** Interpolate one live datapoint that already exists in `MarketStatsData`. In each `generateMetadata`, call `fetchSeoMarketStats(geoType, geoId, state)` (already imported/used in the page body) and shape the title, e.g.:
  - Metro/county: `${name} Housing Market 2026: $${medianK}K Median, ${yoySign}${yoy}% YoY | PropertyIQ`
  - ZIP: `${zip} ${cityState}: $${medianK}K Median, PropertyIQ Score ${score} | PropertyIQ`
  - Files: `[slug]/page.tsx` L29, `zip/[slug]/page.tsx` L32, `county/[slug]/page.tsx` L32, `state/[state]/page.tsx` L27.
  - Guard nulls: if stats are missing, fall back to the current place-name title (keeps A1 satisfied — never empty).
- **Note (A4/A5):** the metro `<title>` has **no brand suffix** while ZIP/county OG titles do — make the `| PropertyIQ` suffix consistent (once, at the end). The H1 already equals the title intent (`{Place} Housing Market` H1 ↔ title), so A4 alignment holds; just keep the new data tokens in the title without changing the H1's geography.

### 🔴 FINDING 2 — Descriptions are "identical or similar" across pages (only the name swaps) (Rubric B2, checklist #6)

- **Google rule:** _"Identical or similar descriptions on every page of a site aren't helpful when individual pages appear in search results."_ Permission + remedy in the same doc: _"programmatic generation of the descriptions can be appropriate and are encouraged… Page-specific data is a good candidate for programmatic generation."_ **Source:** https://developers.google.com/search/docs/appearance/snippet
- **Observed:** Three live examples per geo type above are **word-for-word identical except the place name.** Distinctness within each cohort is effectively 1 unique sentence per ~11,000–34,000 pages. This is the exact anti-pattern at maximum scale.
- **Severity:** 🔴 CRITICAL.
- **Exact fix:** Inject the live numbers already returned by `fetchSeoMarketStats`. Example target (matches the rubric's worked example):
  > `Aberdeen, SD home values are ${yoyDir} ${yoy}% YoY to a $${medianK}K median, with a PropertyIQ Score of ${score} (${grade}). See 2026 forecasts, rent, and demand data.`
  > The `{yoy}`, `{medianK}`, `{score}`, `{grade}` tokens make each of the 33k descriptions genuinely distinct. Data source is `MarketStatsData.headline.yoy.value`, `headline.medianPrice.value`, `score`, `grade` — **no new fetch needed** (see "Why the fix is cheap" below). Apply to the four `generateMetadata` description lines: `[slug]` L30, `zip/[slug]` L33, `county/[slug]` L33, `state/[state]` L28. Null-guard each token; drop the clause if its value is null so the sentence stays human-readable.
- **B3 bonus:** the descriptions also promise "AI-powered forecasts" / "investor scores" — fine as long as the page renders them (it does, via `MarketStatsBlock`); keep claims aligned with rendered content.

### 🟠 FINDING 3 — Hardcoded "2026" → staleness + cross-page sameness (Rubric A3, checklist #3)

- **Google rule:** Google rewrites _"obsolete `<title>` elements"_ — _"page content updates but the `<title>` element doesn't reflect current information (e.g., outdated year). Google may detect this inconsistency and uses the right date from the visible title on the page."_ **Source:** https://developers.google.com/search/docs/appearance/title-link
- **Observed:** Literal `2026` appears in **every** title and description across all four route types (8 occurrences in the four files). It is a string constant, not derived from data or `new Date()`. On Jan 1 2027 all 33k titles silently claim "2026" while the underlying data is 2027, and the year token is also a shared-boilerplate signal feeding Findings 1–2.
- **Severity:** 🟠 HIGH.
- **Exact fix (pick one, prefer the data-driven option):**
  1. **Data-driven (best):** replace `2026` with the real freshness date already on the page — `stats.latestDate` → `new Date(stats.latestDate).getFullYear()` (the page body footer already renders "Market data through {Month Year}" from this exact field). This makes the year track the data, satisfying A3's "roll title + H1 + body atomically."
  2. **Minimum:** a single `const SEO_YEAR = new Date().getUTCFullYear()` shared constant interpolated everywhere, so the year self-updates. (Note ISR `revalidate = 86400` means pages refresh within 24h of the rollover.)
  - The state page already computes `today` from `new Date()` for its visible footer (L157) but still hardcodes `2026` in its title/description — inconsistent; unify on the dynamic value.

### ✅ FINDING 4 — No accidental site-wide snippet suppression (Rubric B4, checklist #7) — PASS

- **Checked:** root `app/layout.tsx` L69–79 sets `robots: { index:true, follow:true, googleBot:{ "max-snippet": -1, "max-image-preview":"large", "max-video-preview":-1 } }` — i.e. **no limit**, snippets fully enabled. `app/robots.ts` disallows only `/api/`, `/admin/`, `/auth/`, `/account/`, `/dev/`, `/health/`, `/betatest/` (with `/api/og` explicitly re-allowed for OG images); the public `/markets/*` tree is crawlable. The only `index:false` / `noindex` declarations are on gated `(app)` routes (account, dashboard, auth, alerts, embed, reports) — **none touch the public market pages**. No `nosnippet`, no `max-snippet:0`, no `data-nosnippet` leakage found.
- **Severity:** ⚪ none (informational — confirmed clean as the rubric expected).

---

## Why the fix is cheap (do this once, fixes Findings 1–3 for all 33k pages)

The live data each template needs is **already fetched server-side on the same page**. `fetchSeoMarketStats(geoType, geoId, state)` (in `packages/frontend/lib/data/fetchers/market-stats.ts`) returns `MarketStatsData`:

```ts
{ score, grade, headline: { medianPrice, rent, daysOnMarket, yoy }, latestDate, ... }
```

The page body already calls it (e.g. `[slug]/page.tsx` L97) to render `MarketStatsBlock` + the `Dataset` JSON-LD. The only change is to **also call it inside `generateMetadata`** (Next.js dedupes/caches the fetch within a request, and these results are wrapped in a 24h-revalidate cache tag `piq-market-data`, so there is no meaningful extra cost) and interpolate `score`, `grade`, `headline.medianPrice.value`, `headline.yoy.value` into the title + description, with null-guards that fall back to the current place-name-only strings when a market lacks data. This satisfies rubric **A2 (data in title)**, **B2 (unique data-rich descriptions)**, and **A3 (year from `latestDate`)** in one edit per route file — and keeps title↔H1 alignment (A4) and the single brand mention (A5) intact.

---

## Severity summary

| #   | Finding                                                                                                                 | Rubric | Severity    |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | Titles are micro-boilerplate (`{Place} Housing Market — 2026 Analysis`), no page-specific data → Google likely rewrites | A2     | 🔴 CRITICAL |
| 2   | Descriptions identical except place name across 33k pages, no live numbers                                              | B2     | 🔴 CRITICAL |
| 3   | Hardcoded "2026" in every title + description → staleness + sameness                                                    | A3     | 🟠 HIGH     |
| 4   | No site-wide `nosnippet`/`max-snippet:0`; market pages crawlable + snippet-enabled                                      | B4     | ✅ PASS     |
| —   | Metro `<title>` missing brand suffix that ZIP/county OG titles have (consistency)                                       | A5     | 🟡 MEDIUM   |

**Files to change (all `generateMetadata`, read-confirmed):**
`packages/frontend/app/(public)/markets/[slug]/page.tsx` (L29–30) ·
`packages/frontend/app/(public)/markets/zip/[slug]/page.tsx` (L32–33) ·
`packages/frontend/app/(public)/markets/county/[slug]/page.tsx` (L32–33) ·
`packages/frontend/app/(public)/markets/state/[state]/page.tsx` (L27–28).
Data source already available: `packages/frontend/lib/data/fetchers/market-stats.ts` (`fetchSeoMarketStats` → `MarketStatsData`).
