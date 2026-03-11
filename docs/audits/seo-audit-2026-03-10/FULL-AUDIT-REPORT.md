# PropertyIQ Full SEO Audit Report

**Date:** 2026-03-10
**URL:** https://www.propertyiq.app
**Business Type:** SaaS — Real Estate Analytics Platform (B2C + B2B)
**Pages Analyzed:** 24 (homepage, 10 core pages, 4 content pages, 3 market pages, 3 comparison/data pages, sitemap + robots.txt, 30 sampled market URLs)

---

## Executive Summary

### SEO Health Score: 72 / 100

| Category                 | Score  | Weight | Weighted |
| ------------------------ | ------ | ------ | -------- |
| Technical SEO            | 78/100 | 25%    | 19.5     |
| Content Quality          | 74/100 | 25%    | 18.5     |
| On-Page SEO              | 76/100 | 20%    | 15.2     |
| Schema / Structured Data | 68/100 | 10%    | 6.8      |
| Performance (CWV)        | 65/100 | 10%    | 6.5      |
| Images                   | 50/100 | 5%     | 2.5      |
| AI Search Readiness      | 60/100 | 5%     | 3.0      |
| **Total**                |        |        | **72.0** |

### Top 5 Critical Issues

1. **JavaScript-dependent rendering** — /map, /pricing, and other interactive pages render "JavaScript Required" for crawlers that don't execute JS, risking content invisibility to Googlebot in some scenarios
2. **Market page 404s from internal links** — Homepage links to `/markets/austin-round-rock-georgetown-tx` (404) while sitemap correctly uses `/markets/austin-round-rock-san-marcos-tx` (200). Slug mismatch between internal links and sitemap
3. **Missing Content-Security-Policy header** — No CSP header detected; only basic security headers are present
4. **Thin market pages** — 935 programmatic market pages have minimal unique content beyond template framework, risking thin content penalties
5. **No author attribution** — Zero author bylines, credentials, or team bios across all content pages (blog, methodology, accuracy)

### Top 5 Quick Wins

1. Add `Content-Security-Policy` header to `next.config.mjs`
2. Fix Austin/Miami market slug mismatches in internal linking
3. Add author names and bios to blog posts and methodology page
4. Add `FAQPage` schema to pricing, methodology, and accuracy pages
5. Add alt text to all images across the site

---

## 1. Technical SEO (78/100)

### Crawlability

| Check                  | Status  | Notes                                                                                                              |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| robots.txt             | PASS    | Well-configured with AI bot rules for GPTBot, ClaudeBot, PerplexityBot                                             |
| Sitemap                | PASS    | Dynamic Next.js sitemap at `/sitemap.xml` with 1000+ URLs, proper priorities                                       |
| Non-www → www redirect | PASS    | 301 redirect in middleware.ts                                                                                      |
| HTTPS                  | PASS    | Enforced via HSTS with preload                                                                                     |
| Canonical tags         | PASS    | Per-page canonicals correctly implemented                                                                          |
| Mobile viewport        | PASS    | Proper viewport meta tag                                                                                           |
| lang attribute         | PASS    | `<html lang="en">` set                                                                                             |
| Sitemap 404s           | WARNING | Internal links point to market slugs that differ from sitemap URLs (e.g., "georgetown" vs "san-marcos" for Austin) |

### Indexability

| Check                | Status   | Notes                                                                                                                                                                                                         |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| robots meta          | PASS     | `index, follow` on all public pages                                                                                                                                                                           |
| Googlebot directives | PASS     | `max-image-preview: large`, `max-snippet: -1`                                                                                                                                                                 |
| JavaScript rendering | CRITICAL | `/map`, `/pricing`, and interactive pages show "JavaScript Required" fallback. While Googlebot renders JS, this affects: (1) non-JS crawlers, (2) initial crawl before rendering, (3) crawl budget efficiency |
| noindex leaks        | PASS     | No accidental noindex tags found                                                                                                                                                                              |
| Orphan pages         | WARNING  | `/scores/accuracy` linked only from footer of scores page — low internal link equity                                                                                                                          |

### Security Headers

| Header                    | Status  | Value                                          |
| ------------------------- | ------- | ---------------------------------------------- |
| Strict-Transport-Security | PASS    | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options    | PASS    | `nosniff`                                      |
| X-Frame-Options           | PASS    | `SAMEORIGIN`                                   |
| Referrer-Policy           | PASS    | `strict-origin-when-cross-origin`              |
| Permissions-Policy        | PASS    | `camera=(), microphone=(), geolocation=()`     |
| Content-Security-Policy   | MISSING | No CSP header — vulnerability to XSS           |
| X-XSS-Protection          | MISSING | Deprecated but still useful for older browsers |

### URL Structure

| Check                       | Status  | Notes                                                                                       |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| Clean URLs                  | PASS    | Semantic, lowercase, hyphenated slugs                                                       |
| Consistent trailing slashes | PASS    | No trailing slashes                                                                         |
| URL depth                   | PASS    | Max 3 levels (`/scores/methodology`)                                                        |
| Query parameters            | PASS    | No unnecessary parameters in indexed URLs                                                   |
| Market page slugs           | WARNING | Long slugs like `/markets/phoenix-mesa-chandler-az` are fine but some contain 5+ city names |

### Server & Infrastructure

| Check             | Status  | Notes                                                                    |
| ----------------- | ------- | ------------------------------------------------------------------------ |
| Hosting           | INFO    | Railway (us-east4) with Fastly CDN edge                                  |
| Cache headers     | PASS    | `s-maxage=31536000` with `X-Nextjs-Cache: HIT`                           |
| Server header     | WARNING | Exposes `railway-edge` — consider removing for security                  |
| `poweredByHeader` | PASS    | Disabled in next.config.mjs                                              |
| SSL certificate   | WARNING | Certificate revocation check failed during testing (may be intermittent) |

---

## 2. Content Quality (74/100)

### E-E-A-T Assessment

| Dimension             | Score | Evidence                                                                                                                                                        |
| --------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Experience**        | 6/10  | 6 years of backtested data, but no personal experience narratives. "Coming Soon" banner undermines perceived experience                                         |
| **Expertise**         | 8/10  | Strong technical methodology page (~8,000 words), specific ML model names (XGBoost, LightGBM, ElasticNet), SHAP feature importance. Missing: author credentials |
| **Authoritativeness** | 6/10  | No external citations, no media mentions, no third-party reviews or certifications. Comparison pages help but are self-published                                |
| **Trustworthiness**   | 7/10  | Transparent data sources page, methodology disclosure, accuracy validation. Missing: privacy policy link, security.txt file, team bios                          |

### Content Depth by Page

| Page                 | Word Count | Assessment                                               |
| -------------------- | ---------- | -------------------------------------------------------- |
| Homepage             | ~1,800     | GOOD — Clear value prop, specific stats                  |
| Methodology          | ~8,000     | EXCELLENT — Deep technical content, validation tables    |
| Accuracy             | ~3,000     | GOOD — Quantified claims, competitive comparison         |
| Blog posts (4)       | ~2,800 avg | GOOD — Data-driven, specific rankings                    |
| Scores               | ~500       | THIN — Too lean for a key landing page                   |
| Pricing              | ~300       | THIN — JS-dependent, no visible content for crawlers     |
| About                | ~500       | THIN — Missing founder bio, team info, company history   |
| Markets (individual) | ~200       | CRITICAL — Template-only, no unique market analysis text |
| Comparison pages     | ~400       | THIN — Needs expanded feature analysis                   |
| Data Sources         | ~900       | GOOD — Transparent sourcing                              |

### Thin Content Risk

**935 market pages** with minimal unique content beyond the template framework. These pages promise "Housing Market 2026 | Prices, Scores & Forecast" in their title tags but deliver primarily JS-rendered widgets with no server-side text content. This creates a significant thin content risk at scale.

**Recommendation:** Add 200-300 words of unique, server-rendered market narrative per page (auto-generated from data is acceptable if varied and substantive).

### Duplicate Content

| Check                 | Status  | Notes                                                                      |
| --------------------- | ------- | -------------------------------------------------------------------------- |
| Canonical consistency | PASS    | Per-page canonicals correctly set                                          |
| www/non-www           | PASS    | 301 redirect from non-www                                                  |
| HTTP/HTTPS            | PASS    | HSTS enforced                                                              |
| Near-duplicate pages  | WARNING | 935 market pages share identical template structure with only data varying |

---

## 3. On-Page SEO (76/100)

### Title Tags

| Page         | Title                                                            | Length   | Issues                                   |
| ------------ | ---------------------------------------------------------------- | -------- | ---------------------------------------- |
| Homepage     | "PropertyIQ: AI Housing Market Data & Forecasts by ZIP Code"     | 60 chars | PASS                                     |
| /map         | "Interactive Housing Market Map \| PropertyIQ"                   | 45 chars | PASS                                     |
| /scores      | "PropertyIQ Scores \| PropertyIQ"                                | 31 chars | WARNING — Generic, "PropertyIQ" repeated |
| /pricing     | "Pricing & Plans \| PropertyIQ"                                  | 29 chars | PASS but short                           |
| /blog        | "Blog - Housing Market Insights & Analysis \| PropertyIQ"        | 55 chars | PASS                                     |
| /markets     | Not visible (JS-dependent)                                       | —        | WARNING                                  |
| /about       | "About PropertyIQ \| PropertyIQ"                                 | 30 chars | WARNING — "PropertyIQ" repeated          |
| /methodology | "Methodology — How PropertyIQ Scores Predict Market Performance" | 63 chars | PASS                                     |
| /accuracy    | "Forecast Accuracy — PropertyIQ Scores Beat the Competition"     | 59 chars | PASS — compelling                        |
| Market pages | "Phoenix, AZ Housing Market 2026 \| Prices, Scores & Forecast"   | 62 chars | PASS                                     |

**Issues found:**

- `/scores` title is generic — should be "AI Real Estate Scores: HomeReady, InvestorEdge & MarketHealth | PropertyIQ"
- `/about` duplicates brand name — should be "About Us — Our Mission & Data Sources | PropertyIQ"

### Meta Descriptions

| Page         | Length    | Issues                             |
| ------------ | --------- | ---------------------------------- |
| Homepage     | 87 chars  | PASS                               |
| /scores      | 97 chars  | PASS — includes validation metrics |
| /pricing     | 119 chars | PASS                               |
| /methodology | 107 chars | PASS                               |
| /accuracy    | 143 chars | PASS                               |
| /data        | 135 chars | PASS                               |
| /about       | 110 chars | PASS                               |

All meta descriptions are present and within optimal range. Good keyword inclusion.

### Heading Structure

| Page         | H1                                            | H2 Count                  | Issues                                     |
| ------------ | --------------------------------------------- | ------------------------- | ------------------------------------------ |
| Homepage     | "Find housing markets that outperform"        | 7                         | PASS                                       |
| /map         | "JavaScript Required" (noscript)              | 0                         | CRITICAL — No semantic headings for non-JS |
| /scores      | "PropertyIQ Scores"                           | 2                         | PASS                                       |
| /pricing     | Not rendered (JS)                             | 0                         | CRITICAL                                   |
| /blog        | Present                                       | 4 posts                   | PASS                                       |
| /markets     | "US Housing Markets"                          | ~50 (state abbrevs as H2) | WARNING — Overuse of H2 for state codes    |
| /about       | "About PropertyIQ"                            | 5                         | PASS                                       |
| /methodology | "The Proof Behind PropertyIQ Scores"          | Multiple                  | PASS                                       |
| /accuracy    | "0.37 OOS Correlation. 4 Windows. Real Data." | Multiple                  | PASS — compelling H1                       |

### Internal Linking

| Check               | Status  | Notes                                                                                          |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| Navigation coverage | PASS    | All major pages in header nav                                                                  |
| Footer links        | PASS    | 9 links covering About, Data, Methodology, Accuracy, Comparisons, Contact, Terms               |
| Cross-page linking  | WARNING | Blog posts don't link to relevant market pages. Market pages don't link to relevant blog posts |
| Breadcrumbs         | PARTIAL | Present on scores, blog, markets. Missing on /map, /graphs, /pricing                           |
| Anchor text variety | WARNING | Many CTA links use generic "Explore the Map" or "Get Started" — should vary                    |

---

## 4. Schema / Structured Data (68/100)

### Current Implementation

| Page             | Schema Types                                        | Quality                                    |
| ---------------- | --------------------------------------------------- | ------------------------------------------ |
| Homepage         | Organization, SoftwareApplication, WebSite, WebPage | EXCELLENT — Full graph with @id references |
| /scores          | WebPage, BreadcrumbList                             | GOOD                                       |
| /blog listing    | CollectionPage, BreadcrumbList                      | GOOD                                       |
| Blog posts       | Article (with datePublished, author, publisher)     | GOOD                                       |
| /about           | WebPage, BreadcrumbList                             | GOOD                                       |
| /data            | WebPage, BreadcrumbList                             | GOOD                                       |
| Market pages     | BreadcrumbList, Place                               | GOOD                                       |
| /pricing         | None detected                                       | CRITICAL                                   |
| /map             | None detected                                       | CRITICAL                                   |
| /methodology     | None detected                                       | WARNING                                    |
| /accuracy        | None detected                                       | WARNING                                    |
| Comparison pages | None detected                                       | WARNING                                    |

### Missing Schema Opportunities

| Schema Type                | Recommended For                      | Impact                               |
| -------------------------- | ------------------------------------ | ------------------------------------ |
| `FAQPage`                  | Pricing, Methodology, Accuracy       | Rich results with expandable Q&A     |
| `Product` with `Review`    | Comparison pages                     | Enhanced product comparison snippets |
| `HowTo`                    | Methodology page                     | Step-by-step methodology in SERPs    |
| `Dataset`                  | Data Sources page                    | Dataset rich results                 |
| `Article`                  | Methodology & Accuracy               | Article-style rich results           |
| `LocalBusiness` or `Place` | Market pages (enhanced)              | Location-aware search features       |
| `SpeakableSpecification`   | Already on homepage — extend to blog | Voice search optimization            |

### Validation Issues

| Issue                                | Severity | Details                                                                                   |
| ------------------------------------ | -------- | ----------------------------------------------------------------------------------------- |
| SoftwareApplication pricing mismatch | MEDIUM   | Schema shows $29/mo Pro, but homepage mentions $39/mo in some places — verify consistency |
| Missing `aggregateRating`            | LOW      | No review/rating data in SoftwareApplication schema                                       |
| Organization `logo` path             | LOW      | References `/logo.png` — verify file exists and is 512x512+                               |

---

## 5. Performance (65/100)

### Server-Side Performance

| Metric            | Value                                         | Assessment           |
| ----------------- | --------------------------------------------- | -------------------- |
| CDN               | Fastly via Railway                            | GOOD                 |
| Cache strategy    | `s-maxage=31536000`, ISR with 300s stale time | GOOD                 |
| Next.js prerender | Yes (`X-Nextjs-Prerender: 1`)                 | GOOD                 |
| Server response   | Railway us-east4                              | PASS — single region |

### Client-Side Concerns

| Issue               | Severity | Details                                                                                  |
| ------------------- | -------- | ---------------------------------------------------------------------------------------- |
| JavaScript bundle   | HIGH     | Heavy JS dependency — entire pages fail without JS                                       |
| Font loading        | MEDIUM   | 4 Google Fonts loaded (Roboto, Roboto Mono, Source Serif 4, DM Sans) — consider reducing |
| Preconnect hints    | PASS     | `api.mapbox.com` and backend API preconnected                                            |
| Third-party scripts | MEDIUM   | Google Analytics, Mapbox GL, backend API — each adds load time                           |
| GeoJSON files       | INFO     | Excluded from serverless bundles correctly via `outputFileTracingExcludes`               |

### Estimated Core Web Vitals Impact

| Metric | Risk Level | Cause                                                               |
| ------ | ---------- | ------------------------------------------------------------------- |
| LCP    | MEDIUM     | Map/chart components are heavy; hero images may defer               |
| INP    | HIGH       | Interactive map with Mapbox GL has complex event handling           |
| CLS    | MEDIUM     | Dynamic data loading without skeleton placeholders may cause shifts |

**Note:** Actual CWV measurements require Lighthouse/PageSpeed Insights — these are estimates based on architecture analysis.

---

## 6. Images (50/100)

### Issues Found

| Issue             | Severity | Details                                                                          |
| ----------------- | -------- | -------------------------------------------------------------------------------- |
| Missing alt text  | HIGH     | SVG icons on /scores page lack alt text. Blog images not confirmed with alt text |
| OG image          | PASS     | `/og-image.png` at 1200x630 — correct dimensions                                 |
| Twitter image     | PASS     | `/twitter-image.png` specified                                                   |
| Favicon           | PASS     | favicon.ico + apple-touch-icon present                                           |
| Image format      | WARNING  | No evidence of WebP/AVIF modern format usage                                     |
| Lazy loading      | UNKNOWN  | Not confirmed in static HTML analysis                                            |
| Responsive images | UNKNOWN  | `srcset` usage not confirmed                                                     |

### Recommendations

1. Audit all `<img>` tags for alt text — particularly market page screenshots and blog post images
2. Implement WebP with fallback for all content images
3. Use Next.js `<Image>` component for automatic optimization (width, height, srcset, lazy loading)
4. Add structured `ImageObject` schema for key images

---

## 7. AI Search Readiness (60/100)

### AI Crawler Access

| Crawler          | Status  | Notes                                        |
| ---------------- | ------- | -------------------------------------------- |
| GPTBot           | ALLOWED | robots.txt grants access to all public pages |
| ClaudeBot        | ALLOWED | robots.txt grants access to all public pages |
| PerplexityBot    | ALLOWED | robots.txt grants access to all public pages |
| General crawlers | ALLOWED | `/` allowed, sensitive paths blocked         |

### llms.txt

| Check        | Status  | Notes                                                                                         |
| ------------ | ------- | --------------------------------------------------------------------------------------------- |
| Exists       | PASS    | `/llms.txt` returns structured content                                                        |
| Quality      | MEDIUM  | Covers overview, data sources, scoring system, access points                                  |
| Completeness | WARNING | Missing: methodology summary, pricing tiers, comparison with competitors, data coverage depth |

### Citability Assessment

| Factor             | Score | Notes                                                                     |
| ------------------ | ----- | ------------------------------------------------------------------------- |
| Factual density    | 8/10  | Strong quantified claims ("5.55 pp/year", "23,000+ locations")            |
| Source attribution | 6/10  | Data sources named but not always linked in context                       |
| Passage structure  | 6/10  | Some pages have clear, extractable passages; others are too fragmented    |
| Unique data        | 9/10  | Proprietary scores and validation data create unique citeable content     |
| Authority signals  | 5/10  | No external backlinks visible, no media citations, no expert endorsements |

### Recommendations for AI Visibility

1. **Expand llms.txt** with methodology summary, pricing details, and key data points
2. **Add structured passages** with clear topic sentences and supporting data — ideal for AI extraction
3. **Create a llms-full.txt** with deeper content for AI models that consume long-form
4. **Build entity consistency** — ensure "PropertyIQ" is described consistently across all pages
5. **Add schema.org `speakable`** to blog posts and key content pages (already on homepage)

---

## 8. Blog & Content Strategy (Bonus Section)

### Current State

- **4 blog posts** — all dated February 25, 2026
- **Categories:** Investment, Market Analysis, Methodology
- **Missing:** Author bylines, publication frequency signals, related posts, comments/engagement

### Issues

| Issue                 | Severity | Details                                                          |
| --------------------- | -------- | ---------------------------------------------------------------- |
| No author attribution | HIGH     | Zero author info across all blog posts — critical for E-E-A-T    |
| Low post count        | MEDIUM   | 4 posts is insufficient for topical authority                    |
| Same publication date | LOW      | All posts dated Feb 25, 2026 — looks artificial                  |
| No pagination         | LOW      | Only 4 posts, but no infrastructure for scaling                  |
| No related posts      | MEDIUM   | Each post is isolated — no cross-linking between related content |
| "Coming Soon" banner  | MEDIUM   | Undermines authority signals for all pages                       |

### Content Gap Opportunities

1. **City/market analysis posts** — "Is [City] a Good Investment in 2026?" for top 20 metros
2. **Data methodology explainers** — "How We Score Rental Demand" deep dives
3. **Market update posts** — Monthly or quarterly data summaries
4. **Glossary/educational content** — "What is an Information Coefficient?" for long-tail
5. **Case studies** — Even hypothetical: "If you followed our 2023 top picks..."

---

## 9. Programmatic SEO — Market Pages (Critical Section)

### Scale

- **935 metro area pages** in sitemap
- **URL pattern:** `/markets/[city-state-abbreviation]`
- **Template:** Same structure for all, data-driven via PropertyIQ scores

### Issues

| Issue                     | Severity | Details                                                                                                                                |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Thin content              | CRITICAL | Pages are template-only with no unique text content. Title promises "Prices, Scores & Forecast" but body is mostly JS-rendered widgets |
| Internal link mismatches  | HIGH     | Homepage/navigation links use different slugs than sitemap (e.g., "georgetown" vs "san-marcos" for Austin)                             |
| Missing search/filter     | MEDIUM   | `/markets` directory page has no search or filtering — only alphabetical browsing                                                      |
| No cross-linking          | MEDIUM   | Market pages link to 5 "More Markets in [State]" but not to related blog posts or comparison content                                   |
| No data freshness signals | MEDIUM   | No "Last updated" dates visible on market pages                                                                                        |
| Schema limited            | LOW      | Has BreadcrumbList + Place but could add StatisticalPopulation, Dataset                                                                |

### Recommendations

1. **Add 200-300 words of unique server-rendered content per market page** — AI-generated market summaries from data
2. **Fix slug mismatches** — Audit `METRO_SLUG_DATA` against internal link references
3. **Add search functionality** to `/markets` directory
4. **Show "Last updated" date** on each market page
5. **Cross-link** to relevant blog posts and comparison pages
6. **Add FAQ section** per market ("Is [City] a good place to invest?")

---

## 10. Comparison Pages

### Current State

3 comparison pages identified:

- `/compare/propertyiq-vs-mashvisor`
- `/compare/propertyiq-vs-neighborhoodscout`
- `/compare/propertyiq-vs-reventure`

### Issues

| Issue                     | Severity | Details                                                                     |
| ------------------------- | -------- | --------------------------------------------------------------------------- |
| Thin content              | MEDIUM   | ~400 words each — needs expansion for competitive keywords                  |
| No JSON-LD schema         | LOW      | Could add `Product` comparison schema                                       |
| Limited internal linking  | LOW      | No links from comparison pages back to specific features                    |
| Missing alternatives page | MEDIUM   | No "PropertyIQ alternatives" or "Best real estate analytics tools" hub page |

### Recommendations

1. Expand each comparison to 1,000+ words with detailed feature breakdowns
2. Add a "Best Real Estate Analytics Platforms 2026" hub page linking to all comparisons
3. Add FAQ schema to each comparison page
4. Include pricing comparison tables with structured data

---

## Appendix A: Page-by-Page Status

| Page                          | HTTP | Title OK | Meta OK | JSON-LD    | H1 OK   | Content Depth |
| ----------------------------- | ---- | -------- | ------- | ---------- | ------- | ------------- |
| /                             | 200  | YES      | YES     | Full graph | YES     | GOOD          |
| /map                          | 200  | YES      | YES     | NO         | NO (JS) | THIN (JS)     |
| /scores                       | 200  | WEAK     | YES     | WebPage    | YES     | THIN          |
| /pricing                      | 200  | YES      | YES     | NO         | NO (JS) | THIN          |
| /blog                         | 200  | YES      | YES     | Collection | YES     | GOOD          |
| /blog/best-cities-2026        | 200  | YES      | YES     | Article    | YES     | GOOD          |
| /markets                      | 200  | UNKNOWN  | UNKNOWN | NO         | YES     | DIRECTORY     |
| /markets/phoenix...           | 200  | YES      | YES     | Place+BC   | YES     | THIN          |
| /markets/austin... (old slug) | 404  | N/A      | N/A     | N/A        | N/A     | BROKEN        |
| /about                        | 200  | WEAK     | YES     | WebPage    | YES     | THIN          |
| /data                         | 200  | SHORT    | YES     | WebPage+BC | YES     | GOOD          |
| /scores/methodology           | 200  | YES      | YES     | NO         | YES     | EXCELLENT     |
| /scores/accuracy              | 200  | YES      | YES     | NO         | YES     | GOOD          |
| /compare/vs-mashvisor         | 200  | YES      | YES     | NO         | YES     | THIN          |
| /contact                      | 200  | YES      | YES     | NO         | NO      | THIN (~200w)  |
| /reports                      | 307  | N/A      | N/A     | N/A        | N/A     | GATED         |
| /graphs                       | 200  | YES      | YES     | NO         | NO (JS) | THIN (~50w)   |
| /market                       | 200  | YES      | YES     | NO         | NO (JS) | THIN (~200w)  |
| /auth/sign-up                 | 200  | GENERIC  | GENERIC | NO         | NO      | THIN (~100w)  |
| /about/terms                  | 200  | DUPE     | MISSING | NO         | NO      | GOOD (~9000w) |
| /markets/louisville/...       | 404  | N/A      | N/A     | N/A        | N/A     | BROKEN        |

## Appendix B: Additional Findings (Background Agents)

### Sitemap Health Check (30 sampled market URLs)

- **916 total market URLs** in sitemap
- **29/30 sampled returned 200** — sitemap URLs are generally healthy
- **1 broken sitemap URL:** `/markets/louisville/jefferson-county-ky-in` — has a forward slash in the slug causing Next.js to interpret it as nested route. This is the only market with a slash in its slug
- The earlier Austin/Miami 404s were from **internal links using wrong slugs**, not from sitemap errors

### Internal Link Audit (6 additional pages)

| Page            | Critical Issues                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/reports`      | **307 redirect to sign-in** — crawlers can't see content. Key feature invisible to search. Needs public landing page |
| `/graphs`       | ~50 words, no H1, entirely JS-dependent. "Loading Market Explorer..." is all crawlers see                            |
| `/market`       | ~200 words, no H1, JS-dependent. "Loading markets..." placeholder only                                               |
| `/contact`      | No H1 (uses H2), no schema, thin. Missing `Organization` or `ContactPage` schema                                     |
| `/auth/sign-up` | **Generic homepage title/description** — not customized. Should be "Create Your Free Account"                        |
| `/about/terms`  | **No meta description**, title has duplicate "PropertyIQ \| PropertyIQ", ~9,000 words of content but no schema       |

### Key Patterns

1. **Missing H1 tags** across all JS-dependent pages in server-rendered HTML
2. **No JSON-LD** on any of these 6 pages despite the SEO overhaul commit
3. **`/reports` completely gated** — 307 redirect means zero search visibility for a key feature

## Appendix B: Competitor Comparison (SEO Positioning)

| Feature             | PropertyIQ    | Mashvisor   | NeighborhoodScout | Reventure               |
| ------------------- | ------------- | ----------- | ----------------- | ----------------------- |
| Market coverage     | 925 metros    | ~200 metros | —                 | —                       |
| Blog content        | 4 posts       | Extensive   | Extensive         | YouTube-focused         |
| Schema markup       | Partial       | —           | —                 | —                       |
| AI search readiness | Moderate      | Low         | Low               | Low                     |
| E-E-A-T signals     | Moderate      | Strong      | Strong            | Strong (founder-driven) |
| Backlink profile    | Unknown (new) | Established | Established       | Growing                 |

---

_Report generated by Claude Code SEO Audit — March 10, 2026_
