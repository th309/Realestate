# PropertyIQ Full SEO Audit Report

**Date:** 2026-03-10
**URL:** https://www.propertyiq.app
**Business Type:** SaaS — Real Estate Analytics Platform (B2C + B2B)
**Pages Analyzed:** 15 live pages fetched + 24 codebase routes audited + sitemap (955 URLs)
**Method:** Live production fetch + codebase analysis + PageSpeed Insights API (Lighthouse 13.0.1)

---

## Executive Summary

### SEO Health Score: 70 / 100

| Category                 | Score  | Weight | Weighted |
| ------------------------ | ------ | ------ | -------- |
| Technical SEO            | 76/100 | 25%    | 19.0     |
| Content Quality          | 72/100 | 25%    | 18.0     |
| On-Page SEO              | 62/100 | 20%    | 12.4     |
| Schema / Structured Data | 70/100 | 10%    | 7.0      |
| Performance (CWV)        | 80/100 | 10%    | 8.0      |
| Images                   | 52/100 | 5%     | 2.6      |
| AI Search Readiness      | 55/100 | 5%     | 2.75     |
| **Total**                |        |        | **69.8** |

### Top 5 Critical Issues

1. **`/markets` index page has ZERO metadata** — No title, no meta description, no canonical, no OG tags, no JSON-LD, no robots directive. This is the gateway to 935 market pages and is effectively invisible to search engines
2. **Wrong OG tags on multiple pages** — `/scores/methodology` og:url points to `/scores`, `/contact` OG tags all show homepage values, `/scores/accuracy` missing og:url and og:image entirely
3. **`/reports` returns 200 with `index, follow` but renders login page** — Crawlers index auth UI as the reports page content
4. **Market page 404s from slug mismatches** — `/markets/austin-round-rock-georgetown-tx` returns 404; correct slug is `austin-round-rock-san-marcos-tx`. Louisville slug has forward slash (`louisville/jefferson-county-ky-in`)
5. **935 market pages are thin content** — Template-only with no unique server-rendered text content beyond JS-rendered widgets

### Top 5 Quick Wins

1. Add metadata export to `/markets/page.tsx` (title, description, canonical, OG)
2. Fix OG tags on `/scores/methodology`, `/scores/accuracy`, and `/contact`
3. Add `noindex` to `/reports` auth redirect or create public landing page
4. Add Austin slug redirect and fix Louisville slug
5. Add JSON-LD schema to `/pricing`, `/methodology`, `/accuracy`, `/compare/*`

### Changes Since Last Audit

| Item                    | Previous Status | Current Status                               |
| ----------------------- | --------------- | -------------------------------------------- |
| Content-Security-Policy | MISSING         | PRESENT (added in commit 5cee8a26)           |
| security.txt            | MISSING         | PRESENT at `/.well-known/security.txt`       |
| Blog publication dates  | All Feb 25      | Varied (Feb 10, 17, 25, Mar 4)               |
| Related posts           | MISSING         | PRESENT (RelatedPosts.tsx component)         |
| Scores FAQ schema       | MISSING         | PRESENT (ScoresFaqJsonLd)                    |
| llms.txt                | Present         | 404 IN PRODUCTION (on develop, not deployed) |
| /markets metadata       | Unknown         | CONFIRMED MISSING (live fetch)               |
| Core Web Vitals         | Estimated       | MEASURED via PageSpeed Insights              |

---

## 1. Technical SEO (76/100)

### Crawlability

| Check                   | Status  | Notes                                                                                       |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------- |
| robots.txt              | PASS    | Well-configured with AI bot rules for GPTBot, ClaudeBot, PerplexityBot                      |
| robots.txt (non-www)    | WARNING | 404 on `propertyiq.app/robots.txt` — middleware matcher excludes `.txt` files from redirect |
| Sitemap                 | WARNING | 955 URLs, flat (not indexed), missing `/scores/accuracy` and `/reports`                     |
| Non-www to www redirect | PASS    | 301 redirect in middleware.ts                                                               |
| HTTPS                   | PASS    | Enforced via HSTS with preload (2-year max-age)                                             |
| Canonical tags          | FAIL    | Missing on `/markets`, `/reports`; wrong on none                                            |
| Mobile viewport         | PASS    | Proper viewport meta tag                                                                    |
| lang attribute          | PASS    | `<html lang="en">` set                                                                      |

### Indexability

| Check                | Status   | Notes                                                                                         |
| -------------------- | -------- | --------------------------------------------------------------------------------------------- |
| robots meta          | PASS     | `index, follow` on all public pages                                                           |
| Googlebot directives | PASS     | `max-image-preview: large`, `max-snippet: -1`                                                 |
| JavaScript rendering | CRITICAL | `/pricing` renders "JavaScript Required" only. `/map`, `/graphs`, `/market` also JS-dependent |
| noindex leaks        | WARNING  | `/reports` should be `noindex` (shows login page) but has `index, follow`                     |
| Orphan pages         | WARNING  | `/scores/accuracy` has limited internal link equity                                           |

### Security Headers (Production-Verified)

| Header                     | Status  | Value                                                      |
| -------------------------- | ------- | ---------------------------------------------------------- |
| Strict-Transport-Security  | PASS    | `max-age=63072000; includeSubDomains; preload`             |
| X-Content-Type-Options     | PASS    | `nosniff`                                                  |
| X-Frame-Options            | PASS    | `SAMEORIGIN`                                               |
| Referrer-Policy            | PASS    | `strict-origin-when-cross-origin`                          |
| Permissions-Policy         | PASS    | `camera=(), microphone=(), geolocation=()`                 |
| Content-Security-Policy    | PASS    | Present with script/style/connect/font/img sources defined |
| Cross-Origin-Opener-Policy | MISSING | Not configured — recommended for XSS mitigation            |
| X-Powered-By               | PASS    | Disabled (`poweredByHeader: false`)                        |

**CSP Note:** Lighthouse flags CSP as "not effective against XSS" due to `unsafe-inline` and `unsafe-eval` in script-src. These are required for Next.js but reduce CSP effectiveness. Consider using nonce-based CSP in the future.

### Sitemap Analysis (955 URLs)

| Category         | Count | Priority | Changefreq     |
| ---------------- | ----- | -------- | -------------- |
| Static pages     | 13    | 0.3-1.0  | weekly/monthly |
| Market pages     | 935   | 0.7      | weekly         |
| Blog posts       | 4     | 0.6      | monthly        |
| Comparison pages | 3     | 0.6      | monthly        |

**Sitemap Issues:**

| Issue                                                                                   | Severity |
| --------------------------------------------------------------------------------------- | -------- |
| Louisville slug has forward slash: `louisville/jefferson-county-ky-in` → 404            | CRITICAL |
| `/scores/accuracy` page not in sitemap                                                  | HIGH     |
| `/reports` page not in sitemap                                                          | HIGH     |
| `lastmod` format inconsistent: static = `2026-03-10`, blog = `2026-02-25T00:00:00.000Z` | MEDIUM   |
| Dynamic `lastmod` causes SEO churn on every build                                       | MEDIUM   |
| Should use sitemap index (955 URLs / 154KB) instead of flat file                        | MEDIUM   |
| `/market` (singular, auth-gated) in sitemap may waste crawl budget                      | LOW      |

### URL Structure

| Check                       | Status  | Notes                                     |
| --------------------------- | ------- | ----------------------------------------- |
| Clean URLs                  | PASS    | Semantic, lowercase, hyphenated slugs     |
| Consistent trailing slashes | PASS    | No trailing slashes                       |
| URL depth                   | PASS    | Max 3 levels (`/scores/methodology`)      |
| Query parameters            | PASS    | No unnecessary parameters in indexed URLs |
| Market page slugs           | WARNING | Some slugs are very long (5+ city names)  |

---

## 2. Content Quality (72/100)

### E-E-A-T Assessment

| Dimension             | Score | Evidence                                                                                                                                         |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Experience**        | 6/10  | 6 years of backtested data, validation tables. No personal experience narratives                                                                 |
| **Expertise**         | 8/10  | Strong methodology page (~8,000 words), specific ML models (XGBoost, LightGBM, ElasticNet), SHAP feature importance. Missing: author credentials |
| **Authoritativeness** | 6/10  | No external citations, media mentions, or third-party reviews. Comparison pages help but are self-published                                      |
| **Trustworthiness**   | 7/10  | Transparent data sources page, methodology disclosure, accuracy validation, security.txt. Missing: team bios                                     |

### Content Depth by Page (Production-Verified)

| Page                  | Word Count | Assessment                                       |
| --------------------- | ---------- | ------------------------------------------------ |
| Homepage              | ~1,800     | GOOD — Clear value prop, specific stats          |
| /scores/methodology   | ~8,000     | EXCELLENT — Deep technical content               |
| /scores/accuracy      | ~3,000     | GOOD — Quantified claims, competitive comparison |
| Blog posts (4)        | ~2,800 avg | GOOD — Data-driven, varied dates                 |
| /data                 | ~900       | GOOD — Transparent sourcing                      |
| /scores               | ~500       | THIN — Key landing page, needs expansion         |
| /about                | ~500       | THIN — Missing founder bio, team info            |
| /compare/\* (3 pages) | ~400 each  | THIN — Needs expanded feature analysis           |
| /pricing              | ~300       | THIN — JS-dependent, crawlers see nothing        |
| /contact              | ~200       | THIN — Minimal content                           |
| /markets/[slug] (935) | ~200       | CRITICAL — Template-only, no unique text         |
| /markets (index)      | ~100       | CRITICAL — Directory only, no metadata           |

### Thin Content Risk

**935 market pages** promise "Housing Market 2026 | Prices, Scores & Forecast" in title tags but deliver primarily JS-rendered widgets with no server-side text content. Additionally, a `generate-seo-content.ts` file exists but its output may not be server-rendered.

### Author Attribution

| Check               | Status  | Notes                                                            |
| ------------------- | ------- | ---------------------------------------------------------------- |
| Blog author bylines | MISSING | Author set to "PropertyIQ" (organization), no individual authors |
| Author bios         | MISSING | No author bio pages or sections                                  |
| Author schema       | PARTIAL | Article schema uses Organization as author, not Person           |
| Team page           | MISSING | No team or founder page exists                                   |

---

## 3. On-Page SEO (62/100)

### Title Tags (Production-Verified)

| Page                | Title                                                            | Length    | Issues                   |
| ------------------- | ---------------------------------------------------------------- | --------- | ------------------------ |
| /                   | "PropertyIQ: AI Housing Market Data & Forecasts by ZIP Code"     | 60 chars  | PASS                     |
| /map                | "Interactive Housing Market Map \| PropertyIQ"                   | 45 chars  | PASS                     |
| /scores             | "PropertyIQ Scores \| PropertyIQ"                                | 31 chars  | WARNING — brand repeated |
| /scores/methodology | "Methodology — How PropertyIQ Scores Predict Market Performance" | 63 chars  | PASS                     |
| /scores/accuracy    | "Forecast Accuracy — PropertyIQ Scores Beat the Competition"     | 59 chars  | PASS                     |
| /pricing            | "Pricing & Plans \| PropertyIQ"                                  | 29 chars  | PASS but short           |
| /blog               | "Blog - Housing Market Insights & Analysis \| PropertyIQ"        | 55 chars  | PASS                     |
| /blog/[slug]        | Dynamic from frontmatter                                         | ~70 chars | PASS                     |
| /markets            | **NOT RENDERED**                                                 | —         | **CRITICAL**             |
| /markets/[slug]     | "[City], TX Housing Market 2026 \| Prices, Scores & Forecast"    | ~62 chars | PASS                     |
| /about              | "About PropertyIQ \| PropertyIQ"                                 | 30 chars  | WARNING — brand repeated |
| /data               | "Data Sources \| PropertyIQ"                                     | 26 chars  | PASS but short           |
| /contact            | "Contact PropertyIQ \| PropertyIQ"                               | 32 chars  | WARNING — brand repeated |
| /compare/[slug]     | "PropertyIQ vs [Competitor]: Real Estate Analytics Compared"     | ~59 chars | PASS                     |
| /reports            | Homepage title (wrong)                                           | —         | **CRITICAL**             |

### Meta Descriptions (Production-Verified)

| Page                | Present              | Issues                      |
| ------------------- | -------------------- | --------------------------- |
| /                   | YES                  | PASS — 87 chars             |
| /scores             | YES                  | PASS — 97 chars             |
| /scores/methodology | YES                  | PASS — 107 chars            |
| /scores/accuracy    | YES                  | PASS — 143 chars            |
| /pricing            | YES                  | PASS — 119 chars            |
| /blog               | YES                  | PASS — comprehensive        |
| /markets            | **NO**               | **CRITICAL — not rendered** |
| /markets/[slug]     | YES                  | PASS — dynamic, descriptive |
| /about              | YES                  | PASS — 110 chars            |
| /data               | YES                  | PASS — 135 chars            |
| /contact            | YES                  | PASS — 102 chars            |
| /compare/[slug]     | YES                  | PASS                        |
| /reports            | Homepage description | **CRITICAL — wrong page**   |

### Open Graph Tags (Production-Verified)

| Page                | og:title    | og:description | og:url                        | og:image        | Issues                                           |
| ------------------- | ----------- | -------------- | ----------------------------- | --------------- | ------------------------------------------------ |
| /                   | PASS        | PASS           | PASS                          | PASS (1200x630) | Missing og:type                                  |
| /scores             | PASS        | PASS           | PASS                          | PASS            | Missing og:type                                  |
| /scores/methodology | WRONG       | WRONG          | **WRONG** (points to /scores) | PASS            | **CRITICAL: all OG tags are parent page values** |
| /scores/accuracy    | PASS        | PASS           | **MISSING**                   | **MISSING**     | **CRITICAL: og:url and og:image absent**         |
| /pricing            | PASS        | PASS           | PASS                          | PASS            | OK                                               |
| /blog               | PASS        | PASS           | PASS                          | PASS            | Missing og:type                                  |
| /blog/[slug]        | PASS        | PASS           | PASS                          | PASS            | Has og:type: article                             |
| /markets            | **MISSING** | **MISSING**    | **MISSING**                   | **MISSING**     | **CRITICAL: zero OG tags**                       |
| /markets/[slug]     | PASS        | PASS           | PASS                          | PASS (dynamic)  | PASS                                             |
| /about              | PASS        | PASS           | PASS                          | PASS            | OK                                               |
| /data               | PASS        | PASS           | PASS                          | PASS            | OK                                               |
| /contact            | **WRONG**   | **WRONG**      | **WRONG** (homepage)          | PASS            | **CRITICAL: all OG = homepage defaults**         |
| /compare/[slug]     | PASS        | PASS           | PASS                          | **MISSING**     | Missing og:image, og:type                        |
| /reports            | WRONG       | WRONG          | WRONG                         | —               | Shows homepage values                            |

### Heading Structure (Production-Verified)

| Page                | H1 Count | H1 Content                                                | Issues                           |
| ------------------- | -------- | --------------------------------------------------------- | -------------------------------- |
| /                   | 3        | "AI-Powered...", "Find housing...", "JavaScript Required" | WARNING: 3 H1s (noscript adds 1) |
| /scores             | 2        | "PropertyIQ Scores", "JavaScript Required"                | WARNING: noscript H1             |
| /scores/methodology | 2        | "The Proof Behind...", "How Scores Predict..."            | WARNING: 2 content H1s           |
| /scores/accuracy    | 2        | "0.37 OOS Correlation...", "Forecast Accuracy"            | WARNING: 2 content H1s           |
| /pricing            | 1        | "JavaScript Required"                                     | **CRITICAL: no real H1**         |
| /blog               | 2        | "PropertyIQ Blog", "JavaScript Required"                  | WARNING: noscript H1             |
| /blog/[slug]        | 2        | Title appears twice                                       | WARNING: duplicate H1            |
| /markets            | 1        | "US Housing Markets"                                      | PASS                             |
| /markets/[slug]     | 2        | "[City] Market Analysis", "JavaScript Required"           | WARNING: noscript H1             |
| /about              | 1        | "About PropertyIQ"                                        | PASS                             |
| /data               | 1        | "Data Sources"                                            | PASS                             |
| /contact            | 1        | "Contact Us"                                              | PASS                             |
| /compare/[slug]     | 1        | Comparison title                                          | PASS                             |

**Pattern:** The `noscript` fallback adds a spurious "JavaScript Required" H1 on most pages. Consider changing this to an `<h2>` or `<p>`.

### Internal Linking

| Check               | Status  | Notes                                                                             |
| ------------------- | ------- | --------------------------------------------------------------------------------- |
| Navigation coverage | PASS    | All major pages in header nav                                                     |
| Footer links        | PASS    | About, Data, Methodology, Accuracy, 3 comparisons, Contact, Terms                 |
| Cross-page linking  | WARNING | Blog posts don't link to market pages; market pages don't link to blog            |
| Breadcrumbs         | PARTIAL | Present on scores, blog, markets, about, data. Missing on /map, /graphs, /pricing |
| Anchor text variety | WARNING | Many CTAs use generic "Explore the Map" or "Get Started"                          |

---

## 4. Schema / Structured Data (70/100)

### Current Implementation (Production-Verified)

| Page                | Schema Types                                                                      | Quality      |
| ------------------- | --------------------------------------------------------------------------------- | ------------ |
| / (Homepage)        | Organization, SoftwareApplication, WebSite, WebPage (with SpeakableSpecification) | EXCELLENT    |
| /scores             | WebPage, BreadcrumbList, **FAQPage** (6 items)                                    | GOOD         |
| /scores/methodology | **NONE**                                                                          | **CRITICAL** |
| /scores/accuracy    | **NONE**                                                                          | **CRITICAL** |
| /pricing            | **NONE** (should have Product/Offer)                                              | **CRITICAL** |
| /blog               | CollectionPage, BreadcrumbList                                                    | GOOD         |
| /blog/[slug]        | Article (headline, dates, author, publisher), BreadcrumbList                      | GOOD         |
| /markets            | **NONE**                                                                          | **CRITICAL** |
| /markets/[slug]     | BreadcrumbList, Place (containedInPlace)                                          | GOOD         |
| /about              | WebPage, BreadcrumbList                                                           | GOOD         |
| /data               | WebPage, BreadcrumbList                                                           | GOOD         |
| /contact            | **NONE** (should have ContactPage)                                                | WARNING      |
| /compare/[slug]     | **NONE** (should have Product comparison)                                         | WARNING      |
| /reports            | **NONE**                                                                          | WARNING      |

### Missing Schema Opportunities

| Schema Type          | Recommended For                                              | Rich Result Impact             |
| -------------------- | ------------------------------------------------------------ | ------------------------------ |
| `FAQPage`            | /pricing, /methodology, /accuracy                            | Expandable Q&A in SERPs        |
| `Product` + `Offer`  | /pricing                                                     | Pricing rich results           |
| `Article`            | /methodology, /accuracy                                      | Article-style snippets         |
| `HowTo`              | /methodology                                                 | Step-by-step in SERPs          |
| `ContactPage`        | /contact                                                     | Organization contact info      |
| `Dataset`            | /data                                                        | Dataset search results         |
| `Product` comparison | /compare/\*                                                  | Enhanced comparison snippets   |
| `BreadcrumbList`     | /scores/methodology, /scores/accuracy, /contact, /compare/\* | Breadcrumb navigation in SERPs |

### Validation Issues

| Issue                                                                              | Severity |
| ---------------------------------------------------------------------------------- | -------- |
| SoftwareApplication pricing: schema shows $29/mo Pro — verify matches live pricing | MEDIUM   |
| Missing `aggregateRating` in SoftwareApplication                                   | LOW      |
| Article schema uses Organization as author (not Person) — less E-E-A-T signal      | MEDIUM   |

---

## 5. Performance — Core Web Vitals (80/100)

### Lighthouse Scores (Measured via PageSpeed Insights API)

| Category           | Homepage (Mobile) | Homepage (Desktop) | /scores (Mobile) | /markets/dallas (Mobile) |
| ------------------ | :---------------: | :----------------: | :--------------: | :----------------------: |
| **Performance**    |      **100**      |         94         |        85        |            86            |
| **Accessibility**  |        95         |      **100**       |        93        |            90            |
| **Best Practices** |        96         |         96         |        96        |            96            |
| **SEO**            |      **100**      |      **100**       |     **100**      |         **100**          |

### Core Web Vitals (Measured)

| Metric              | Target  | Homepage (M)  |  Homepage (D)  |  /scores (M)  | /markets/dallas (M) |
| ------------------- | ------- | :-----------: | :------------: | :-----------: | :-----------------: |
| **LCP**             | < 2.5s  | **1.7s PASS** | **1.3s PASS**  |   4.2s FAIL   |      3.8s FAIL      |
| **TBT** (INP proxy) | < 200ms | **20ms PASS** | **130ms PASS** | **30ms PASS** |     210ms FAIL      |
| **CLS**             | < 0.1   |  **0 PASS**   | **0.002 PASS** |  **0 PASS**   |     **0 PASS**      |
| **FCP**             | < 1.8s  | **1.1s PASS** | **0.3s PASS**  | **1.5s PASS** |    **1.1s PASS**    |
| **TTFB**            | < 800ms | **60ms PASS** | **80ms PASS**  | **10ms PASS** |    **2ms PASS**     |
| **Speed Index**     | < 3.4s  | **1.9s PASS** | **0.8s PASS**  | **2.5s PASS** |    **2.5s PASS**    |
| **TTI**             | < 5.0s  |   4.1s PASS   | **1.8s PASS**  |   4.2s PASS   |      6.8s FAIL      |

**Verdict:**

- Homepage: **ALL PASS** — Excellent performance
- /scores: **LCP FAIL** (4.2s — nearly 2x target)
- /markets/dallas: **LCP FAIL** (3.8s) + **TBT FAIL** (210ms) + **TTI FAIL** (6.8s)

### Resource Analysis

| Resource       |   Homepage (M)    |   Homepage (D)    |    /scores (M)    | /markets/dallas (M) |
| -------------- | :---------------: | :---------------: | :---------------: | :-----------------: |
| Total Requests |        40         |        95         |        35         |         58          |
| Total Size     |     2,380 KB      |     3,140 KB      |      592 KB       |      1,099 KB       |
| JavaScript     | 16 files / 284 KB | 35 files / 949 KB | 18 files / 303 KB |  26 files / 815 KB  |
| CSS            |  2 files / 33 KB  |  3 files / 39 KB  |  2 files / 34 KB  |   3 files / 41 KB   |
| Fonts          |    6 / 216 KB     |    6 / 216 KB     |    6 / 220 KB     |     4 / 164 KB      |
| Images         |    4 / 369 KB     |    5 / 404 KB     |         0         |          0          |
| Video          |   2 / 1,420 KB    |   2 / 1,420 KB    |         0         |          0          |

### Performance Bottlenecks

| Issue                  | Severity | Details                                                                                             |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `a3319169-*.js` bundle | HIGH     | 448 KB with 80% unused code. Causes 181-286ms long tasks. Primary driver of slow TTI on inner pages |
| `7687-*.js` chunk      | MEDIUM   | 54 KB / 82% unused — appears on every page                                                          |
| Render-blocking CSS    | MEDIUM   | 630-920ms savings possible from inlining critical CSS                                               |
| 4 Google Fonts         | MEDIUM   | 216 KB of font files. Consider reducing to 2 (Roboto + Roboto Mono)                                 |
| PNG images (homepage)  | MEDIUM   | 286 KB savings from WebP/AVIF conversion                                                            |

---

## 6. Images (52/100)

### Issues Found

| Issue                  | Severity | Details                                                                            |
| ---------------------- | -------- | ---------------------------------------------------------------------------------- |
| PNG format             | HIGH     | Homepage images (market-map-hero, graphs-poster, ai-report) are PNG, not WebP/AVIF |
| Missing alt text       | MEDIUM   | SVG icons across pages lack alt text or `role="presentation"`                      |
| Video missing captions | MEDIUM   | Homepage autoplay video has no `<track kind="captions">`                           |
| OG images              | PASS     | `/og-image.png` (1200x630), dynamic OG for market pages via `/api/og`              |
| Twitter image          | PASS     | Separate `/twitter-image.png` from OG image                                        |
| Favicon                | PASS     | favicon.ico + apple-touch-icon + PWA icons (192, 512)                              |

### Image Optimization Opportunities (Homepage)

| Image                      | Current Size | Potential Savings |
| -------------------------- | ------------ | ----------------- |
| market-map-hero-v4.png     | 113 KB       | 100 KB (→ WebP)   |
| graphs-poster.png          | 96 KB        | 67 KB             |
| ai-report-narrative-v2.png | 83 KB        | 67 KB             |
| top-ranked-markets-v2.png  | 74 KB        | 59 KB             |
| **Total**                  | **366 KB**   | **~286 KB**       |

---

## 7. AI Search Readiness (55/100)

### AI Crawler Access

| Crawler          | Status  | Notes                                           |
| ---------------- | ------- | ----------------------------------------------- |
| GPTBot           | ALLOWED | robots.txt with fewer restrictions than default |
| ClaudeBot        | ALLOWED | Same as GPTBot                                  |
| PerplexityBot    | ALLOWED | Same as GPTBot                                  |
| General crawlers | ALLOWED | Public paths allowed, sensitive paths blocked   |

### llms.txt

| Check                    | Status  | Notes                                                                          |
| ------------------------ | ------- | ------------------------------------------------------------------------------ |
| Exists in codebase       | YES     | `public/llms.txt` (3.6KB) + `public/llms-full.txt` (8.8KB)                     |
| Accessible in production | **404** | Files are on `develop` branch, not yet deployed to `main`/production           |
| Content quality          | GOOD    | Covers overview, scoring, validation, data sources, pricing, citation guidance |
| Completeness             | GOOD    | llms-full.txt adds methodology, feature engineering, model ensemble details    |

### security.txt

| Check     | Status | Notes                            |
| --------- | ------ | -------------------------------- |
| Location  | PASS   | `/.well-known/security.txt`      |
| Contact   | PASS   | `mailto:security@propertyiq.app` |
| Expiry    | PASS   | 2027-03-10                       |
| Languages | PASS   | en                               |

### Citability Assessment

| Factor             | Score | Notes                                                                          |
| ------------------ | ----- | ------------------------------------------------------------------------------ |
| Factual density    | 8/10  | Strong quantified claims ("5.55 pp/year", "23,000+ locations", "0.37 OOS IC")  |
| Source attribution | 6/10  | Data sources named in /data page but not always linked in context              |
| Passage structure  | 6/10  | Some pages have clear, extractable passages; others fragmented by JS widgets   |
| Unique data        | 9/10  | Proprietary scores, validation data, and backtest results are uniquely citable |
| Authority signals  | 5/10  | No external backlinks visible, no media citations, no expert endorsements      |

---

## 8. Accessibility (Production-Verified)

| Issue                           | Pages Affected              | Impact                                          |
| ------------------------------- | --------------------------- | ----------------------------------------------- |
| Buttons without accessible name | All except Desktop homepage | Icon-only buttons missing `aria-label`          |
| Video missing captions          | Homepage                    | Autoplay video has no `<track kind="captions">` |
| Heading order skipped           | /scores                     | Headings skip levels                            |
| Color contrast ratio            | /markets/[slug]             | Foreground/background fails WCAG ratio          |

---

## 9. Page-by-Page SEO Quality Ranking

Pages ranked from best to worst SEO implementation:

| Rank | Page                  | Score | Key Strengths                                                    | Key Issues                                                         |
| ---- | --------------------- | ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1    | `/blog/[slug]`        | A     | Article + BreadcrumbList JSON-LD, complete OG, correct canonical | Duplicate H1                                                       |
| 2    | `/data`               | A     | WebPage + BreadcrumbList, full OG, single H1                     | Short title                                                        |
| 3    | `/about`              | A-    | WebPage + BreadcrumbList, full OG                                | Brand repeated in title, thin content                              |
| 4    | `/blog`               | B+    | CollectionPage + BreadcrumbList                                  | Missing og:type                                                    |
| 5    | `/scores`             | B+    | WebPage + BreadcrumbList + FAQPage                               | 2 H1s, thin content                                                |
| 6    | `/markets/[slug]`     | B     | BreadcrumbList + Place, dynamic OG image                         | 2 H1s, thin content                                                |
| 7    | `/compare/[slug]`     | C     | Good title, canonical                                            | Missing JSON-LD, og:image, og:type                                 |
| 8    | `/pricing`            | C-    | OG present                                                       | No JSON-LD, no SSR content, no real H1                             |
| 9    | `/scores/accuracy`    | C-    | Good title, canonical                                            | No JSON-LD, missing og:url + og:image                              |
| 10   | `/scores/methodology` | C-    | Excellent content                                                | No JSON-LD, WRONG og:url (parent page)                             |
| 11   | `/contact`            | D     | Has H1, canonical                                                | No JSON-LD, all OG = homepage defaults                             |
| 12   | `/reports`            | F     | —                                                                | 200 + index on login page, all metadata wrong                      |
| 13   | `/markets` (index)    | F     | Has H1                                                           | **ZERO metadata** — no title, desc, canonical, OG, JSON-LD, robots |

---

## 10. Programmatic SEO — Market Pages

### Scale

- **935 metro area pages** in sitemap
- **URL pattern:** `/markets/[city-state-abbreviation]`
- **Template:** Same structure for all, data-driven via PropertyIQ scores

### Issues

| Issue                        | Severity | Details                                                                                                 |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| Thin content                 | CRITICAL | Pages are template-only with no unique text. `generate-seo-content.ts` exists but output may not be SSR |
| /markets index page          | CRITICAL | Zero metadata — invisible to search engines                                                             |
| Austin slug 404              | HIGH     | `austin-round-rock-georgetown-tx` → 404; correct is `austin-round-rock-san-marcos-tx`                   |
| Louisville slug broken       | HIGH     | Forward slash in slug: `louisville/jefferson-county-ky-in`                                              |
| No search/filter on /markets | MEDIUM   | Only alphabetical browsing (MarketSearch.tsx added but JS-dependent)                                    |
| No cross-linking             | MEDIUM   | Market pages don't link to blog posts or comparison content                                             |
| No data freshness signals    | MEDIUM   | No "Last updated" dates visible                                                                         |

### Recommendations

1. Add 200-300 words of unique server-rendered content per market page
2. Add full metadata to `/markets/page.tsx`
3. Fix slug mismatches (Austin redirect, Louisville dash)
4. Cross-link to blog posts and comparisons
5. Show "Last updated" date on each page

---

## 11. Comparison Pages

### Current State

3 comparison pages:

- `/compare/propertyiq-vs-mashvisor`
- `/compare/propertyiq-vs-neighborhoodscout`
- `/compare/propertyiq-vs-reventure`

### Issues

| Issue                                                            | Severity |
| ---------------------------------------------------------------- | -------- |
| No JSON-LD schema (no BreadcrumbList despite visual breadcrumbs) | HIGH     |
| Missing og:image on all 3 pages                                  | MEDIUM   |
| Missing og:type                                                  | LOW      |
| ~400 words each — thin for competitive comparison keywords       | MEDIUM   |
| No "Best Real Estate Analytics Tools" hub page                   | LOW      |

---

## Appendix A: Page-by-Page Status Matrix

| Page                         | HTTP      | Title     | Meta Desc | Canonical | OG Tags     | JSON-LD     | H1       | SSR Content |
| ---------------------------- | --------- | --------- | --------- | --------- | ----------- | ----------- | -------- | ----------- |
| /                            | 200       | PASS      | PASS      | PASS      | PASS        | Full graph  | 3 (warn) | GOOD        |
| /map                         | 200       | PASS      | PASS      | PASS      | PASS        | NONE        | JS only  | THIN        |
| /scores                      | 200       | WEAK      | PASS      | PASS      | PASS        | WebPage+FAQ | 2 (warn) | THIN        |
| /scores/methodology          | 200       | PASS      | PASS      | PASS      | **WRONG**   | **NONE**    | 2 (warn) | EXCELLENT   |
| /scores/accuracy             | 200       | PASS      | PASS      | PASS      | **PARTIAL** | **NONE**    | 2 (warn) | GOOD        |
| /pricing                     | 200       | PASS      | PASS      | PASS      | PASS        | **NONE**    | JS only  | **JS ONLY** |
| /blog                        | 200       | PASS      | PASS      | PASS      | PASS        | Collection  | 2 (warn) | GOOD        |
| /blog/[slug]                 | 200       | PASS      | PASS      | PASS      | PASS        | Article     | 2 (warn) | GOOD        |
| /markets                     | 200       | **NONE**  | **NONE**  | **NONE**  | **NONE**    | **NONE**    | PASS     | DIRECTORY   |
| /markets/[slug]              | 200       | PASS      | PASS      | PASS      | PASS        | Place+BC    | 2 (warn) | THIN        |
| /markets/austin...georgetown | **404**   | —         | —         | —         | —           | —           | —        | **BROKEN**  |
| /markets/louisville/...      | **404**   | —         | —         | —         | —           | —           | —        | **BROKEN**  |
| /about                       | 200       | WEAK      | PASS      | PASS      | PASS        | WebPage+BC  | PASS     | THIN        |
| /data                        | 200       | PASS      | PASS      | PASS      | PASS        | WebPage+BC  | PASS     | GOOD        |
| /contact                     | 200       | WEAK      | PASS      | PASS      | **WRONG**   | **NONE**    | PASS     | THIN        |
| /compare/[slug]              | 200       | PASS      | PASS      | PASS      | PARTIAL     | **NONE**    | PASS     | THIN        |
| /reports                     | 200→login | **WRONG** | **WRONG** | **NONE**  | **WRONG**   | **NONE**    | JS only  | **GATED**   |
| /graphs                      | 200       | PASS      | PASS      | PASS      | PASS        | WebPage+BC  | JS only  | THIN        |
| /market                      | 200       | PASS      | PASS      | PASS      | PASS        | NONE        | JS only  | THIN        |
| /about/terms                 | 200       | DUPE      | **NONE**  | PASS      | PASS        | NONE        | PASS     | GOOD        |
| /auth/sign-up                | 200       | GENERIC   | GENERIC   | —         | GENERIC     | NONE        | NONE     | THIN        |

---

## Appendix B: Competitor SEO Positioning

| Feature             | PropertyIQ                        | Mashvisor   | NeighborhoodScout | Reventure               |
| ------------------- | --------------------------------- | ----------- | ----------------- | ----------------------- |
| Market coverage     | 925 metros                        | ~200 metros | —                 | —                       |
| Blog content        | 4 posts                           | Extensive   | Extensive         | YouTube-focused         |
| Schema markup       | Partial (homepage excellent)      | Minimal     | Minimal           | Minimal                 |
| AI search readiness | Moderate (llms.txt ready but 404) | Low         | Low               | Low                     |
| E-E-A-T signals     | Moderate                          | Strong      | Strong            | Strong (founder-driven) |
| Core Web Vitals     | Homepage: 100/100                 | Unknown     | Unknown           | Unknown                 |
| Programmatic pages  | 935 metros                        | ~200        | ~1000+            | ~200                    |

---

_Report generated by Claude Code SEO Audit — March 10, 2026_
_Lighthouse 13.0.1 | No CrUX field data (insufficient real-user traffic)_
