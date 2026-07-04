# PropertyIQ — Google Search Central SEO Audit

**Date:** 2026-06-19
**Target:** `https://www.propertyiq.app` (canonical host)
**Method:** Authoritative rubric built from the full Google Search Central documentation + web.dev (8 rubric files in [`docs/seo/google-rubric/`](./google-rubric/)), then the live site + codebase graded against it (6 findings files in [`docs/seo/audit/`](./audit/)).
**Scope:** Homepage, the ~43,700 programmatic location pages (states / metros / counties / ZIPs), reports/blog, structured data, crawl/index/canonical, sitemaps, Core Web Vitals, and AI-search readiness.

> Every finding below cites the specific Google rule it violates (with the source URL captured in the rubric files) and maps to the exact file to change. Nothing here is generic SEO advice — it's PropertyIQ-specific.

---

## 1. Executive summary

**Overall verdict: a strong, professionally-built SEO foundation held back by two cheap-to-fix problems — empty pages that are indexable, and template metadata that ignores data you already fetch.** Fix the Critical/High items (mostly small, surgical edits) and this site moves from "good" to "excellent."

The architecture is genuinely right: server-rendered SEO pages, per-page canonicals, a proper sitemap index, correct hard-404 handling, must-match-visible structured data, and an AI-aware robots policy. The weaknesses are **not** structural — they're missing _gates_ and missing _data interpolation_, both fixable without re-architecting anything.

### SEO Health Score: **68 / 100** — "Good, with a clear path to 85+"

| Category                 | Weight | Score | Why                                                                                                          |
| ------------------------ | ------ | ----- | ------------------------------------------------------------------------------------------------------------ |
| Technical SEO            | 25%    | 80    | Excellent crawl/index/canonical/sitemap architecture; dinged by Railway duplicate-host + fake `lastmod`.     |
| Content Quality          | 25%    | 52    | ~10K empty indexable shells + templated prose with no geo numbers + E-E-A-T gaps. The drag on the score.     |
| On-Page SEO              | 20%    | 62    | Headings/semantics/canonical/OG excellent; titles + descriptions are boilerplate (but trivially fixable).    |
| Schema / Structured Data | 10%    | 82    | Must-match-visible passes; only minor cleanups (placeholder `sameAs`, drop `SearchAction`).                  |
| Performance (CWV)        | 10%    | 70\*  | \*Provisional — live field data was rate-limited. Architecture mostly good; H1 paints after hydration.       |
| Images                   | 5%     | 75    | OG + alt text fine; `next/image` not universal (low-risk on text-heavy pages).                               |
| AI Search Readiness      | 5%     | 68    | Ideal citable-fact substrate, but prose lacks declarative stats and citation bots aren't explicitly allowed. |

**The single highest-impact fact:** ~10,082 ZIP pages (25.5%) and ~94 county pages have **no current PropertyIQ score**, yet each ships as a full indexable HTTP 200 and is listed in the sitemap. That is the one thing most likely to draw a Google **scaled-content / soft-404** assessment, and it's the first thing to fix.

---

## 2. What's already excellent (do not touch)

A balanced audit names the strengths so they're protected during fixes:

- **Hybrid rendering done right** — public market pages are server components that fetch stats server-side and emit JSON-LD + a server-rendered content section; only interactive widgets are `'use client'`. Crawlers see real content without JS. _(Google JS-SEO guidance — rubric 03.)_
- **Hard-404 handling is correct** — fabricated slugs (`/markets/this-is-not-a-real-city-zz`) return real 404s, not 200 shells. _(rubric 02 — audit 03 PASS.)_
- **Canonicalization** — absolute, hard-coded self-canonicals on the `www` host; non-www→www and http→https are single-hop 301s; faceted `/map`/`/screener` URLs consolidate to a bare canonical (no infinite crawl space). _(rubric 03 — audit 03.)_
- **Sitemap architecture** — proper sitemap index, ZIPs chunked at 10k/file (well under Google's 50k/50MB limit), only `www` URLs, no host/HTTP leakage. _(rubric 04 — audit 02.)_
- **Structured data integrity** — the cardinal "markup must match visible content" rule **passes**: `Dataset.variableMeasured` mirrors the visible stats block and drops null values from both. No fabricated ratings. _(rubric 05/06 — audit 04 PASS.)_
- **Breadcrumbs** — positions start at 1, sequential, resolvable on every page. _(rubric 06.)_
- **robots.txt hygiene** — correct `/api/og` carve-out, `/_next/` not blocked, no `Disallow`+`noindex` collisions. _(rubric 02 — audit 03.)_
- **AI stance is fundamentally sound** — pages are Googlebot-crawlable, which is the only real requirement for AI Overviews/AI Mode eligibility. _(rubric 08.)_

---

## 3. Prioritized action plan

Ordered by impact × ease. Each item: the Google rule, the defect, the exact fix, and the detail file.

### 🔴 CRITICAL — fix first

#### C1. Gate indexability + sitemap on data-sufficiency (kills ~10K empty shells)

- **Google rule:** Scaled-content abuse — pages with _"little to no value to users, no matter how it's created"_; and soft-404s (a "no data" page returning 200 with an empty state). _(rubric 01 §spam, rubric 02 §soft-404.)_
- **Defect:** No `notFound()`/`noindex` is ever conditioned on data presence. When `fetchSeoMarketStats()` returns null the page drops its data layer but still ships a full indexable 200 of templated prose — and the sitemap lists it. DB confirms ~10,082 ZIP (25.5%) + ~94 county pages affected.
- **Fix:** In each market `page.tsx`, when there is no sufficient data for the geo, either `return notFound()` (preferred for truly empty geos) or render with `robots: { index: false }` via `generateMetadata`. **And** exclude no-data geos from the sitemap builder (`lib/seo/sitemap-builder.ts`) so the two stay in sync. Define "sufficient" = has a current score OR ≥N current headline metrics.
- **Detail:** [`audit/01-content-findings.md`](./audit/01-content-findings.md)

#### C2. Stop presenting stale data as current

- **Google rule:** E-E-A-T / trustworthiness on YMYL (real-estate = financial) content; accuracy. _(rubric 01 §E-E-A-T.)_
- **Defect:** ZIP `35201` serves a PropertyIQ Score labeled _"Data through Jan 2026"_ whose actual latest row is **2024-02-29** — a 2-year-old value presented as current. No staleness ceiling in the snapshot fallback.
- **Fix:** Add a staleness ceiling to the snapshot fallback — if the latest data row is older than a threshold (e.g. > 3–4 months), either suppress the page from indexing (folds into C1) or label the true `observationDate` instead of the current period. **Worth verifying as a data-freshness bug, not just SEO.**
- **Detail:** [`audit/01-content-findings.md`](./audit/01-content-findings.md)

### 🟠 HIGH — fix this week

#### H1. Interpolate live data into titles + descriptions (the free win)

- **Google rule:** Google rewrites _"micro-boilerplate"_ `<title>`s that vary by one token; _"identical or similar descriptions on every page aren't helpful"_ → use _"page-specific data."_ _(rubric 05 §A2/§B2.)_
- **Defect:** All 33k titles are `{Place} Housing Market — 2026 Analysis`; descriptions are word-for-word identical except the place name. No live numbers.
- **Fix:** The 4 `generateMetadata` functions (`markets/[slug]`, `markets/zip/[slug]`, `markets/county/[slug]`, `markets/state/[state]`) don't read the stats they could. `fetchSeoMarketStats()` **already returns** `score`, `grade`, `medianPrice`, `yoy` server-side and is already called by the page body (24h-cached). Add one call + interpolate (null-guarded), e.g. `"{Place} Housing Market: $429K median, PropertyIQ Score 72 ({year})"`. One edit per route file fixes all 33k pages — and simultaneously feeds the scaled-content fix (C1) and AI citation (A1).
- **Detail:** [`audit/05-titles-descriptions-findings.md`](./audit/05-titles-descriptions-findings.md)

#### H2. Weave real numbers into the body prose

- **Google rule:** Scaled-content / people-first — per-page value must be genuine. _(rubric 01.)_
- **Defect:** The narrative is a ~45–81-permutation template library with **zero geo-specific numbers**; Austin's and Aberdeen's "overview" paragraphs are byte-identical except the proper noun. Real value lives only in the separate `MarketStatsBlock`.
- **Fix:** In `generate-seo-content.ts`, interpolate the actual `MarketStatsData` (median price, rent, DOM, YoY, score, rank) into the prose so each page's body is data-distinct. Same data, already fetched.
- **Detail:** [`audit/01-content-findings.md`](./audit/01-content-findings.md)

#### H3. Redirect the Railway duplicate-host

- **Google rule:** Consolidate duplicate URLs; `rel=canonical` is a _hint_, a 301 is a directive. _(rubric 03 §canonicalization.)_
- **Defect:** `propertyiq.up.railway.app` serves HTTP 200, byte-identical copies of all ~33k pages (Austin page = 50,997 bytes on both hosts). `middleware.ts:62` redirects bare `propertyiq.app`→`www` but has no branch for `*.up.railway.app`. Mitigated (not solved) by the hard-coded `www` canonical → HIGH, not Critical.
- **Fix:** Add a 308 host-redirect at the top of `middleware.ts` for any `*.up.railway.app` host → `www.propertyiq.app`, **plus** a `next.config.mjs redirects()` entry (the middleware matcher excludes `.txt`/`.xml`, so robots/sitemap on the Railway host need the config-level rule).
- **Detail:** [`audit/03-crawl-canonical-findings.md`](./audit/03-crawl-canonical-findings.md)

#### H4. Make sitemap `<lastmod>` honest

- **Google rule:** _"Google uses `<lastmod>` if it's consistently and verifiably accurate"_ — otherwise it's disregarded **site-wide**. _(rubric 04 §R5.)_
- **Defect:** `sitemap-builder.ts` stamps `new Date().toISOString()` per request, so all ~43,700 URLs share one timestamp (live-proven). Only blog posts carry a real date.
- **Fix:** Drive `<lastmod>` from the real monthly data-refresh date per geo (preferred), or drop the tag for data pages (`renderUrlset` already omits it when undefined). Don't ship a fake one.
- **Detail:** [`audit/02-sitemaps-findings.md`](./audit/02-sitemaps-findings.md)

#### H5. Publish the methodology page (E-E-A-T)

- **Google rule:** E-E-A-T on YMYL — disclose how scores/AI narratives are produced; cite sources. _(rubric 01 §E-E-A-T.)_
- **Defect:** The methodology page is **auth-gated** (`app/(app)/scores/methodology`) — not crawlable, not linked from any public page. The score's formula/automation is undisclosed to Google and visitors.
- **Fix:** Expose a public, crawlable methodology page; link it from every market page (near the score) and the footer. Add an author/publisher byline + "data as-of" date to market pages.
- **Detail:** [`audit/01-content-findings.md`](./audit/01-content-findings.md)

#### H6. Fix the homepage LCP element

- **Google rule:** LCP good ≤ 2.5s at the 75th percentile of field data. _(rubric 07.)_
- **Defect:** `HeroSection.tsx:8-41` — the H1 ("33,000+ U.S. Real Estate Markets. Scored.") ships with inline `opacity:0` and only becomes visible after hydration + IntersectionObserver. The LCP text is invisible until JS runs.
- **Fix:** Render the hero H1 at full opacity in the initial server HTML (animate other elements, not the LCP text). Add a `web-vitals` RUM beacon to GA4 so INP/LCP/CLS are actually measurable (currently unmeasured).
- **Detail:** [`audit/07-cwv-findings.md`](./audit/07-cwv-findings.md)

#### H7. Explicitly allow AI citation crawlers

- **Google rule / industry:** AI citation and AI training are _different bots_; citation requires the search-specific bots be allowed. _(rubric 08 §B1.)_
- **Defect:** `robots.ts` names the training bots (GPTBot/ClaudeBot) but the citation bots (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, bingbot) work only by luck of the `*` wildcard — fragile and one edit from silently killing citation.
- **Fix:** In `robots.ts`, explicitly name + allow the citation/search bots; make the training-bot decision deliberate (reasonable stance: block GPTBot/ClaudeBot/Google-Extended to keep proprietary scores out of model training while staying fully citable); keep the wildcard catch-all.
- **Detail:** [`google-rubric/08-ai-generative-seo.md`](./google-rubric/08-ai-generative-seo.md)

### 🟡 MEDIUM / LOW — backlog

- **M1. Drop the hardcoded `2026`** in all titles/descriptions — derive from `stats.latestDate` or `new Date().getUTCFullYear()` (stale on Jan 1). _(audit 05.)_
- **M2. Verify or remove placeholder `sameAs`** (`twitter.com/propertyiq`, `linkedin.com/company/propertyiq`) in `JsonLd.tsx` — if unowned, it's an accuracy violation. _(audit 04.)_
- **L1. Remove `<changefreq>`/`<priority>`** from `renderUrlset` (lines 67–70) — Google ignores them; ~2.5MB of dead bytes across 43,700 URLs. _(audit 02.)_
- **L2. Drop the deprecated `SearchAction`** (sitelinks searchbox retired Nov 2024) — keep bare `WebSite{name,url}`. _(audit 04.)_
- **L3. De-dup `/data` JSON-LD** — `WebPageJsonLd` and an inline script both emit `WebPage`+`BreadcrumbList`. _(audit 04.)_
- **L4. Enrich `Dataset`** with `spatialCoverage`, `temporalCoverage`, `isAccessibleForFree`, `keywords` to strengthen Google Dataset Search eligibility (real opportunity for a market-data site). _(audit 04/06.)_
- **L5. `FAQPage` is inert** (FAQ rich results ended May 2026, never applied to non-gov/health) — keep the accordion for users, stop expecting a rich result; deprioritize the markup. _(audit 04, rubric 05/06.)_

---

## 4. Core Web Vitals — measurement note

Live PageSpeed Insights / CrUX field data could **not** be captured this run (the keyless PSI endpoint rate-limited this IP — HTTP 429 on both WebFetch and direct API). The CWV verdict above is **architecture-derived and provisional**. CrUX is likely origin-fallback only (no URL-level field data) given traffic volume.

**To get real numbers**, run once quota resets (or with a PSI API key):

```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://www.propertyiq.app/&strategy=mobile&category=performance" \
  | python -c "import sys,json;d=json.load(sys.stdin);le=d.get('loadingExperience',{});print('field',le.get('overall_category'),le.get('metrics',{}).keys());print('lab',d['lighthouseResult']['categories']['performance']['score'])"
```

Honest framing (per Google): page experience is _"no single signal"_ and a near-tie differentiator behind relevance — not a ranking lever. Fix H6 because it's a real user-experience defect, not because it will "boost rankings."

---

## 5. Suggested sequencing

1. **C1 + H1 + H2 together** — one coordinated change: read the stats the page already fetches, interpolate into title/description/prose, and gate index+sitemap on data sufficiency. This single coordinated edit resolves the two Criticals' content half, both on-page Highs, and most of the AI-citation gap.
2. **C2** — staleness ceiling (likely surfaces a real data bug).
3. **H3 + H4** — Railway redirect + honest `lastmod` (small, isolated infra edits).
4. **H5 + H7** — publish methodology, explicit AI bot allowlist.
5. **H6** — hero LCP + RUM beacon.
6. **Medium/Low** — backlog sweep.

---

## 6. Source rubrics (the "expert" layer)

The authoritative Google guidance these findings are graded against:

| File                                                                                                                 | Covers                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [`google-rubric/01-foundations-content-quality.md`](./google-rubric/01-foundations-content-quality.md)               | How Search works, Search Essentials, helpful/people-first content, E-E-A-T/YMYL, spam policies (scaled content abuse) |
| [`google-rubric/02-crawling-indexing.md`](./google-rubric/02-crawling-indexing.md)                                   | Crawlers, robots.txt, noindex/X-Robots, HTTP status, soft-404, crawl budget, mobile-first                             |
| [`google-rubric/03-urls-links-canonical-js.md`](./google-rubric/03-urls-links-canonical-js.md)                       | URL structure, crawlable links, canonicalization/duplicate-host, JavaScript SEO                                       |
| [`google-rubric/04-sitemaps.md`](./google-rubric/04-sitemaps.md)                                                     | Sitemap limits, lastmod/changefreq/priority truth, large-site best practices                                          |
| [`google-rubric/05-appearance-titles-snippets-sd-core.md`](./google-rubric/05-appearance-titles-snippets-sd-core.md) | Title-link rewriting, snippets, structured-data general guidelines (must-match-visible), deprecations                 |
| [`google-rubric/06-structured-data-types-images.md`](./google-rubric/06-structured-data-types-images.md)             | Per-type SD (Organization, SoftwareApplication, Breadcrumb, Dataset, FAQ, Article), image/video SEO                   |
| [`google-rubric/07-page-experience-cwv.md`](./google-rubric/07-page-experience-cwv.md)                               | LCP/INP/CLS thresholds, field-vs-lab, page-experience weighting, map-app fixes                                        |
| [`google-rubric/08-ai-generative-seo.md`](./google-rubric/08-ai-generative-seo.md)                                   | Google's AI-features stance, AI crawler allow/block matrix, citable-facts playbook                                    |
