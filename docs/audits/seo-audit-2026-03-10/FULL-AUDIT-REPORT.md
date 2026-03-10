# PropertyIQ Full Website SEO Audit

**Site:** https://www.propertyiq.app
**Date:** 2026-03-10
**Pages Crawled:** ~50 (sampled from 935+ in sitemap)
**Business Type Detected:** SaaS / Real Estate Analytics Platform
**Stack:** Next.js 16 (App Router) on Railway + Fastly CDN

---

## Executive Summary

**Overall SEO Health Score: 36/100**

PropertyIQ has a **strong homepage** with excellent structured data and compelling content, but the site suffers from **three critical systemic failures** that undermine the SEO value of its largest content assets:

1. **Every page's canonical URL points to the homepage** — Google is being told that all 935+ pages are duplicates of the homepage
2. **935 market pages are thin content shells** — only ~200 words of template text; all scores, prices, and AI analysis are client-rendered and invisible to crawlers
3. **Zero security headers** — no CSP, HSTS, X-Frame-Options, or any standard security headers

The site's best content (methodology, accuracy, data sources pages) is buried and under-linked, while its most numerous content (market pages) is effectively invisible to search engines.

**Top 5 Quick Wins:**

1. Fix canonical URLs across all pages (Next.js metadata config issue)
2. Add security headers via `next.config.js`
3. Server-render market page data (scores, prices, AI summaries)
4. Add author/team credentials to About page
5. Add BreadcrumbList schema site-wide

---

## Score Breakdown

| Category                 | Weight   | Score  | Weighted |
| ------------------------ | -------- | ------ | -------- |
| Technical SEO            | 25%      | 25/100 | 6.3      |
| Content Quality          | 25%      | 35/100 | 8.8      |
| On-Page SEO              | 20%      | 40/100 | 8.0      |
| Schema / Structured Data | 10%      | 35/100 | 3.5      |
| Performance (CWV)        | 10%      | 60/100 | 6.0      |
| Images                   | 5%       | 40/100 | 2.0      |
| AI Search Readiness      | 5%       | 30/100 | 1.5      |
| **TOTAL**                | **100%** |        | **36.1** |

---

## 1. Technical SEO (25/100)

### CRITICAL

#### T1. All canonical URLs point to homepage

**Affected:** Every page except `/markets/[city]` pages
**Root cause:** `packages/frontend/app/layout.tsx` (line ~112) sets `alternates.canonical: "https://www.propertyiq.app"` and no child route overrides it.

Pages verified broken: `/map`, `/pricing`, `/about`, `/blog`, `/blog/*`, `/scores`, `/data`, `/graphs`

**Impact:** Google may treat all pages as duplicates of the homepage, effectively de-indexing the entire site except the homepage. This is the single most damaging SEO bug.

**Fix:** Each route's `page.tsx` or `layout.tsx` must set its own canonical:

```typescript
// In each page.tsx generateMetadata()
alternates: {
  canonical: `https://www.propertyiq.app/${slug}`;
}
```

#### T2. Non-www domain SSL failure

`https://propertyiq.app` (without www) returns HTTP 405 and fails SSL handshake. No redirect to `www.propertyiq.app`.

**Impact:** Backlinks pointing to `propertyiq.app` are dead. Search engines may split link equity between www and non-www.

**Fix:** Configure DNS/Railway to 301 redirect `propertyiq.app` → `www.propertyiq.app`.

#### T3. Zero security headers

| Header                           | Status  |
| -------------------------------- | ------- |
| Content-Security-Policy          | MISSING |
| X-Frame-Options                  | MISSING |
| X-Content-Type-Options           | MISSING |
| Strict-Transport-Security (HSTS) | MISSING |
| Referrer-Policy                  | MISSING |
| Permissions-Policy               | MISSING |

Additionally, `X-Powered-By: Next.js` is exposed, leaking framework info.

**Fix:** Add headers via `next.config.js` `headers()` function. Set `poweredByHeader: false`.

### HIGH

#### T4. Dual URL patterns for market content

- Sitemap uses: `/markets/austin-round-rock-san-marcos-tx` (SEO-friendly slug)
- Market index links to: `/market/12420?type=metro&view=investor` (internal ID)

Link equity is split between two URL structures for the same content.

**Fix:** Consolidate to `/markets/[slug]` as canonical. Either 301 redirect `/market/[id]` or add `noindex` to it.

#### T5. Missing sitemap pages

- `/reports/sample` — public page, not in sitemap
- Comparison pages (`/compare/*`) — in sitemap but zero internal links from navigation

#### T6. No preconnect hints

Missing `<link rel="preconnect">` for critical third-party domains (Mapbox API, backend API).

### MEDIUM

#### T7. Sitemap `lastmod` all identical (2026-02-25)

Google treats uniform `lastmod` as unreliable and may ignore it.

#### T8. No `<noscript>` fallback

If JS fails, users see a blank white page.

#### T9. No PWA manifest

Both `/manifest.json` and `/manifest.webmanifest` return 404.

### LOW

#### T10. No `llms.txt` file

Emerging standard for AI crawler guidance. Not yet required but forward-looking.

#### T11. No `security.txt`

RFC 9116 best practice for responsible disclosure.

#### T12. `keywords` meta tag present

Google ignores this since 2009. Not harmful but provides zero value.

---

## 2. Content Quality (35/100)

### CRITICAL

#### CQ1. 935 market pages are thin content shells (~200 words each)

Server-rendered HTML contains only:

- City name in H1
- Template text (identical across all pages)
- CTAs and navigation
- "Loading market data..." placeholders

All differentiated content (scores, prices, AI analysis, charts) is client-rendered via JavaScript. Googlebot may or may not execute this JavaScript.

**Impact:** Google sees 935 near-identical thin pages. Risk of doorway page classification or algorithmic suppression.

**Fix:** Server-side render (SSR) at minimum:

- 3-5 key metrics (median home price, YoY change, score values)
- 2-3 sentence AI-generated market summary
- Data freshness timestamp

#### CQ2. Market page AI overview is entirely client-rendered

`MarketOverviewSection.tsx` is a `"use client"` component using `useInsight()`. The only substantial unique text per market page may be completely invisible to crawlers.

### HIGH

#### CQ3. Blog has no author attribution

- 4 blog posts, all by "PropertyIQ Research + AI"
- No named person, photo, bio, or credentials
- No author pages

**Impact:** Severely undermines E-E-A-T for financial/real estate content (YMYL-adjacent).

#### CQ4. About page lacks team credentials

- References a founder but provides no name, photo, or professional background
- Footer shows "Federal Contracting Services LLC" with no explanation of relationship
- No advisory board, data team, or expertise signals

#### CQ5. Blog posts have zero images

All 4 posts are 2,000-3,200 words of text-only content. No charts, maps, or visualizations despite being data analysis content.

#### CQ6. Blog OG tags inherit homepage values

Social shares of blog posts show homepage title, URL, and generic image instead of post-specific content.

### MEDIUM

#### CQ7. Scores page is thin (~450 words)

Excellent methodology and accuracy subpages exist but are poorly linked (1 link each).

#### CQ8. All 4 blog posts share the same publication date

Every post has `date: "2026-02-25"`. Looks unnatural.

#### CQ9. Pricing page renders empty

Client-side only rendering. Shows "Coming Soon" with no actual pricing despite schema claiming $29/mo and $99/mo tiers.

#### CQ10. No external outbound links in blog content

All blog posts link exclusively to internal pages. Authoritative outbound links (Census.gov, FRED, Zillow) improve trust signals.

---

## 3. On-Page SEO (40/100)

### CRITICAL

#### OP1. Market pages have completely generic metadata

All 935 market pages share:

- Same title: "Market Intelligence - Housing Market Rankings | PropertyIQ"
- Same meta description (generic platform copy)
- Same OG tags (homepage defaults)

Google sees 935 pages with identical titles and descriptions.

**Fix:** Dynamic metadata per market:

```
Title: "Austin, TX Housing Market Analysis & Scores | PropertyIQ"
Description: "Austin metro home prices, market health score, and AI-powered forecasts. Median home value: $XXX,XXX. PropertyIQ Score: XX/100."
```

### HIGH

#### OP2. Missing H1 tags on key pages

Pages without H1: `/map`, `/pricing`, all `/market/[id]` dashboard pages

#### OP3. Title tags exceed 60 characters

- `/pricing`: 74 chars (truncated in SERPs)
- `/about`: 76 chars (truncated)
- Blog posts: ~74 chars (truncated)

#### OP4. Meta descriptions out of range

- `/blog`: 98 chars (too short — wastes SERP real estate)
- `/about`: 172 chars (too long — truncated)
- Blog post: 201 chars (severely truncated)
- Market pages: up to 248 chars (heavily truncated)

#### OP5. No heading structure on `/map` and `/pricing`

Zero H1/H2/H3 tags. Search engines cannot parse content structure.

### MEDIUM

#### OP6. Blog H1 appears twice

`BlogPostContent.tsx` renders `<h1>` from frontmatter, and MDX content starts with `# Title`. Duplicate H1.

#### OP7. Comparison pages not linked from navigation

3 comparison pages exist in sitemap but have zero internal link equity.

#### OP8. Market nearby links only show same-state metros

Misses economically relevant cross-state metros (e.g., NYC should link to Newark NJ).

---

## 4. Schema / Structured Data (35/100)

### What's Working

The **homepage** has excellent schema:

- `Organization` with social profiles
- `SoftwareApplication` with pricing tiers
- `WebSite` with `SearchAction` (sitelinks search box)
- `FAQPage` with 5 Q&A pairs
- `WebPage` with `speakable`

### CRITICAL

#### SD1. FAQPage schema doesn't match visible content

Homepage has FAQ schema but no visible FAQ section. Google guidelines require schema to match visible content. Risk of structured data penalty.

### HIGH

| Page                  | Current Schema      | Missing Schema                                                                        |
| --------------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `/markets/[city]`     | `Place` (minimal)   | `WebPage`, `BreadcrumbList`, `Place` with `additionalProperty` for metrics, `Dataset` |
| `/market` (index)     | None                | `WebPage`, `ItemList`                                                                 |
| `/scores`             | None                | `WebPage`, `BreadcrumbList`                                                           |
| `/scores/accuracy`    | None                | `WebPage`, `TechArticle`                                                              |
| `/scores/methodology` | None                | `WebPage`, `TechArticle`                                                              |
| `/data`               | None                | `WebPage`, `Dataset` (multiple)                                                       |
| `/blog`               | None                | `Blog`, `CollectionPage`                                                              |
| `/blog/[slug]`        | `Article` (partial) | Add `dateModified`, `image`, `wordCount`, `BreadcrumbList`                            |
| `/pricing`            | None                | `WebPage`, `SoftwareApplication` with `Offer`                                         |
| `/about`              | None                | `WebPage`, `Organization`, `Person` (founder)                                         |

### MEDIUM

#### SD2. Pricing inconsistency in schema

Homepage schema: Free ($0), Pro ($29/mo), Team ($99/mo)
Visible homepage: Free, Pro, Enterprise (prices hidden)
Scores/accuracy page: mentions $39/month

#### SD3. Blog Article schema missing key fields

Missing: `dateModified`, `image`, `wordCount`, `articleSection`, `inLanguage`

#### SD4. No BreadcrumbList schema anywhere

Visual breadcrumbs exist on several pages but no JSON-LD to earn SERP breadcrumb trails.

---

## 5. Performance (60/100)

### What's Working

- **Fonts:** Self-hosted woff2, properly preloaded (4 files)
- **Images:** Next.js Image optimization with AVIF/WebP, responsive srcset
- **Code splitting:** Next.js automatic code splitting active
- **CDN:** Fastly edge caching via Railway

### HIGH

#### P1. Render-blocking CSS

Two CSS files loaded synchronously in `<head>` with no critical CSS inlining.

**Fix:** Extract critical above-the-fold CSS and inline it. Or verify `optimizeCss` is enabled in next.config.

#### P2. Hero image not preloaded

Four font files are preloaded but the hero image (`market-map-hero-v4.png` at `w=3840&q=75`) — the likely LCP element — is not.

**Fix:** Add `priority` prop to the hero `<Image>` component.

### MEDIUM

#### P3. Map page loads ~16 JS chunks

High chunk count for initial load. Analyze with `next/bundle-analyzer`.

#### P4. No skip-to-content link

WCAG 2.1 Level A failure. Keyboard users must tab through entire navigation.

---

## 6. Images (40/100)

### HIGH

#### I1. Zero images in blog content

4 blog posts averaging 2,600 words with zero images, charts, or visualizations.

#### I2. Zero content images on market pages

Market pages have no server-rendered images showing market data or trends.

### MEDIUM

#### I3. Favicon only 16x16 ICO

Missing larger icons (32x32, 192x192, 512x512) for modern devices.

#### I4. No apple-touch-icon

Mobile bookmark icons will use generic fallback.

---

## 7. AI Search Readiness (30/100)

### Strengths

- Homepage has clear, quotable claims with specific numbers
- Scores/accuracy page is highly citable (IC = 0.37, hit rate = 69.5%)
- Data sources page clearly lists all inputs with links
- Methodology page is transparent about limitations

### Weaknesses

#### AI1. No `llms.txt` file

No guidance for AI crawlers on how to index the site.

#### AI2. No AI bot directives in robots.txt

No specific rules for GPTBot, ClaudeBot, PerplexityBot.

#### AI3. Market data invisible to AI scrapers

All market-specific data is client-rendered. AI models cannot extract market statistics.

#### AI4. No "How to cite" guidance

No explicit citation format for AI models or researchers.

#### AI5. Claims lack inline source attribution

Numbers like "2,400,000+ Properties Analyzed" and "1.1 million observations" are stated without source links.

---

## What's Working Well

1. **Homepage JSON-LD** — Comprehensive schema (Organization, SoftwareApplication, WebSite, FAQPage, WebPage) with SearchAction
2. **Blog content quality** — 2,000-3,200 word data-driven articles with good heading structure
3. **Methodology transparency** — Scores/accuracy and scores/methodology pages are genuinely excellent
4. **robots.txt** — Well-configured, blocking appropriate paths (/api, /admin, /auth)
5. **Sitemap** — Exists with 935+ URLs and differentiated priorities
6. **Image optimization** — Next.js Image with AVIF/WebP and responsive srcset
7. **Font loading** — Self-hosted woff2 with preload
8. **Market page slugs** — SEO-friendly URL pattern (`/markets/austin-round-rock-san-marcos-tx`)
9. **Blog categorization** — Category system in place (investment, market-analysis, methodology, news)
10. **RSS feed exists** — Available at `/blog/rss.xml` (though not discoverable via `<link>` tag)
