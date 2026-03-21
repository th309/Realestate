# PropertyIQ SEO Action Plan

**Generated:** 2026-03-10 | **SEO Health Score:** 70/100 | **Target:** 85+/100

**Method:** Live production fetch + codebase analysis + PageSpeed Insights (Lighthouse 13.0.1)

---

## CRITICAL (Fix Immediately — Blocks Indexing or Rankings)

### 1. Add Metadata to /markets Index Page

**Impact:** Gateway to 935 market pages has ZERO metadata — completely invisible to search engines. Live fetch confirmed: no title, no meta description, no canonical, no OG tags, no JSON-LD, no robots directive.
**Estimated lift:** +3-5 points on On-Page SEO score
**Action:**

```typescript
// packages/frontend/app/markets/page.tsx
export const metadata: Metadata = {
  title: "Housing Markets — Browse 925+ US Metro Areas",
  description:
    "Explore AI-powered housing market scores for 925+ US metros. Compare HomeReady, InvestorEdge, and Market Health scores to find markets that outperform.",
  alternates: { canonical: "https://www.propertyiq.app/markets" },
  openGraph: {
    title: "Housing Markets — Browse 925+ US Metro Areas",
    description: "Explore AI-powered housing market scores for 925+ US metros.",
    url: "https://www.propertyiq.app/markets",
    siteName: "PropertyIQ",
    images: ["/og-image.png"],
  },
};
```

Add `CollectionPage` + `BreadcrumbList` JSON-LD.

**File:** `packages/frontend/app/markets/page.tsx`

### 2. Fix Wrong OG Tags on Multiple Pages

**Impact:** Social shares and link previews show wrong content. Crawlers get confused by mismatched URLs.
**Pages affected:** `/scores/methodology`, `/scores/accuracy`, `/contact`

**Action:**

| Page                  | Issue                                                          | Fix                                                            |
| --------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `/scores/methodology` | og:url, og:title, og:description all point to `/scores` parent | Add explicit `openGraph` to methodology page's metadata export |
| `/scores/accuracy`    | og:url and og:image missing entirely                           | Add full `openGraph` block to accuracy page's metadata export  |
| `/contact`            | All OG tags show homepage defaults                             | Add explicit `openGraph` with contact-specific values          |

**Files:**

- `packages/frontend/app/scores/methodology/page.tsx`
- `packages/frontend/app/scores/accuracy/page.tsx`
- `packages/frontend/app/contact/page.tsx`

### 3. Fix /reports Indexing of Login Page

**Impact:** `/reports` returns HTTP 200 with `index, follow` but renders the sign-in page. Crawlers index auth UI as reports content.
**Action (choose one):**

- **Option A (recommended):** Create a public landing page at `/reports` describing the Reports feature, screenshots, CTA to sign up. Gate actual reports at `/reports/[id]`.
- **Option B (quick fix):** Add `robots: { index: false, follow: false }` to the reports layout metadata, so the login redirect page isn't indexed.

**File:** `packages/frontend/app/reports/layout.tsx` or `page.tsx`

### 4. Fix Market Page Slug Mismatches

**Impact:** Internal links point to 404 pages, wasting crawl budget and link equity.
**Action:**

| Slug Issue                                          | Fix                                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `austin-round-rock-georgetown-tx` → 404             | Add redirect to `austin-round-rock-san-marcos-tx` in middleware or next.config.mjs |
| `louisville/jefferson-county-ky-in` (forward slash) | Fix slug in `METRO_SLUG_DATA` to `louisville-jefferson-county-ky-in`               |

- Audit all internal link references against `METRO_SLUG_DATA` for other mismatches
- Verify fix: `curl -s -o /dev/null -w "%{http_code}" https://www.propertyiq.app/markets/[slug]`

**Files:**

- `packages/frontend/lib/data/metro-slug-data.json`
- `packages/frontend/lib/data/metro-slugs.ts`
- `packages/frontend/middleware.ts` or `next.config.mjs` (redirects)

### 5. Deploy llms.txt to Production

**Impact:** `llms.txt` and `llms-full.txt` return 404 in production. Files exist on `develop` branch but haven't been merged to `main`.
**Action:**

- Merge the llms.txt changes from `develop` to `main`, or deploy develop branch
- Verify accessibility: `curl -I https://www.propertyiq.app/llms.txt`

### 6. Add /scores/accuracy to Sitemap

**Impact:** Page exists with good content but is not in the sitemap, reducing crawl priority.
**Action:**

```typescript
// packages/frontend/app/sitemap.ts — add to staticRoutes array
{ url: '/scores/accuracy', changeFrequency: 'monthly', priority: 0.6 },
```

**File:** `packages/frontend/app/sitemap.ts`

---

## HIGH (Fix Within 1 Week — Significant Rankings Impact)

### 7. Add JSON-LD Schema to Key Pages

**Impact:** 7 pages missing JSON-LD = 7 missed rich result opportunities.
**Estimated lift:** +2-3 points on Schema score
**Action:**

| Page                  | Schema to Add                                              |
| --------------------- | ---------------------------------------------------------- |
| `/scores/methodology` | `Article` + `BreadcrumbList` (Home > Scores > Methodology) |
| `/scores/accuracy`    | `Article` + `BreadcrumbList` (Home > Scores > Accuracy)    |
| `/pricing`            | `Product` with 3 `Offer`s + `BreadcrumbList`               |
| `/contact`            | `ContactPage` + `BreadcrumbList`                           |
| `/compare/[slug]`     | `BreadcrumbList` (Home > Compare > [Title])                |
| `/markets` (index)    | `CollectionPage` + `BreadcrumbList`                        |

Use existing `WebPageJsonLd` component pattern or create page-specific schema components.

**Files:** Respective `page.tsx` or `layout.tsx` files

### 8. Add Author Attribution to All Content

**Impact:** E-E-A-T is a primary ranking factor — no authorship significantly hurts credibility.
**Action:**

- Add founder/team author info to all blog posts (name, bio, photo, credentials)
- Add `author` field to blog frontmatter (currently hardcoded as "PropertyIQ" organization)
- Add author bio section to methodology and accuracy pages
- Update Article JSON-LD to include `Person` as author (not just Organization)

**Files:** Blog post MDX files, `app/blog/[slug]/page.tsx`, `app/blog/[slug]/BlogPostContent.tsx`

### 9. Fix Noscript H1 Pattern

**Impact:** 9 of 15 pages have multiple H1 tags because the `noscript` fallback renders "JavaScript Required" as `<h1>`.
**Action:**

- Change the noscript fallback from `<h1>` to `<p>` or `<div>` with appropriate styling
- This single change fixes the multiple-H1 issue across all pages at once

**File:** Root layout or the noscript component (likely in `app/layout.tsx` or a shared component)

### 10. Fix Title Tag Redundancy

**Impact:** Weak titles hurt CTR and keyword targeting.
**Action:**

| Page       | Current                            | Recommended                                                                    |
| ---------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `/scores`  | "PropertyIQ Scores \| PropertyIQ"  | "AI Real Estate Scores — HomeReady, InvestorEdge & MarketHealth \| PropertyIQ" |
| `/about`   | "About PropertyIQ \| PropertyIQ"   | "About Us — Our Mission, Team & Data Sources \| PropertyIQ"                    |
| `/contact` | "Contact PropertyIQ \| PropertyIQ" | "Contact Us — Get in Touch \| PropertyIQ"                                      |
| `/data`    | "Data Sources \| PropertyIQ"       | "90+ Real Estate Data Sources — Zillow, Census, FRED & More \| PropertyIQ"     |

**Files:** Respective `page.tsx` metadata exports

### 11. Server-Render Pricing Content

**Impact:** `/pricing` page shows only "JavaScript Required" to crawlers. Title promises plans comparison but body is empty for non-JS.
**Action:**

- Ensure pricing tiers, feature lists, and plan comparison are server-rendered (RSC)
- The Product/Offer JSON-LD (item 7) will also help, but the actual content must be in the HTML

**File:** `packages/frontend/app/pricing/` components

---

## MEDIUM (Fix Within 1 Month — Optimization Opportunities)

### 12. Add Server-Rendered Content to Market Pages

**Impact:** 935 pages at risk of thin content penalty — this is the bulk of indexed pages.
**Action:**

- The `generate-seo-content.ts` file already exists — verify its output is server-rendered
- Target: 200-300 words of unique market narrative per page
- Include: market summary, key metrics text, score interpretation, trend description
- Add "Last updated: [date]" visible on each page

**Files:** `packages/frontend/app/markets/[slug]/page.tsx`, `generate-seo-content.ts`

### 13. Fix LCP on Inner Pages

**Impact:** `/scores` LCP is 4.2s (target < 2.5s), `/markets/dallas` LCP is 3.8s. Both fail Core Web Vitals.
**Action:**

- Investigate what the LCP element is on these pages — likely text rendered after JS execution
- The `a3319169-*.js` bundle (448 KB, 80% unused) is the primary bottleneck — code-split it
- Consider lazy-loading heavy chart/widget libraries
- Inline critical CSS (630-920ms savings possible)

### 14. Convert Images to WebP/AVIF

**Impact:** ~286 KB savings on homepage from format conversion.
**Action:**

- Convert `market-map-hero-v4.png`, `graphs-poster.png`, `ai-report-narrative-v2.png`, `top-ranked-markets-v2.png` to WebP
- Use Next.js `<Image>` component for automatic format negotiation
- Add descriptive alt text to any images currently missing it

### 15. Expand Comparison Pages

**Action:** Expand each from ~400 to 1,000+ words with:

- Detailed feature comparison tables
- Pricing comparison with current data
- Use case recommendations ("Best for...")
- Add BreadcrumbList + FAQ schema
- Add og:image to each comparison page
- Create "Best Real Estate Analytics Platforms 2026" hub page

### 16. Improve Internal Cross-Linking

**Action:**

- Blog posts → link to relevant market pages
- Market pages → link to relevant blog posts
- Scores page → link to methodology + accuracy more prominently
- Add breadcrumbs to /map, /graphs, /pricing
- Vary CTA anchor text (not always "Explore the Map")

### 17. Use Sitemap Index Instead of Flat Sitemap

**Action:** Split the 955-URL flat sitemap into a sitemap index:

```
sitemap-index.xml
├── sitemap-static.xml (13 pages)
├── sitemap-markets.xml (935 pages)
├── sitemap-blog.xml (4+ pages)
└── sitemap-compare.xml (3 pages)
```

Next.js supports `generateSitemaps()` for this natively.

**File:** `packages/frontend/app/sitemap.ts`

### 18. Fix Sitemap lastmod Inconsistency

**Action:**

- Use consistent date format: `YYYY-MM-DD` for all entries (not full ISO for blog)
- Consider using fixed dates (not `new Date()`) to prevent SEO churn on every build
- Use actual content modification dates where possible

**File:** `packages/frontend/app/sitemap.ts`

### 19. Expand About Page

**Action:** Add to ~1,500 words:

- Founder bio with credentials and photo
- Company history/timeline
- Team section (if applicable)
- Mission statement expansion

### 20. Reduce Font Count

**Action:** Currently loading 4 Google Fonts (216 KB):

- Roboto (M3 standard) — keep
- Roboto Mono (code) — keep if used
- Source Serif 4 (editorial) — load only on blog/report pages
- DM Sans — evaluate if actually used; remove if redundant

---

## LOW (Backlog — Nice to Have)

### 21. Add Accessibility Fixes

- Add `aria-label` to icon-only buttons across all pages
- Add `<track kind="captions">` to homepage autoplay video
- Fix heading order on /scores page
- Fix color contrast on market pages

### 22. Add /about/terms Metadata

- Add meta description: "Read PropertyIQ's Terms of Service covering data usage, IP, disclaimers, and user responsibilities."
- Fix title from "PropertyIQ | PropertyIQ" to "Terms of Service | PropertyIQ"

### 23. Add Related Posts to Blog (if not already rendering)

- `RelatedPosts.tsx` component exists — verify it renders server-side

### 24. Add aggregateRating to SoftwareApplication Schema

- Collect and display user ratings to enable star rating rich results

### 25. Add Dataset Schema to Data Sources Page

- Use `schema.org/Dataset` for each data source

### 26. Remove /market (singular) from Sitemap

- Auth-gated dashboard page wastes crawl budget in sitemap

### 27. Add Cross-Origin-Opener-Policy Header

- Add `Cross-Origin-Opener-Policy: same-origin` for XSS mitigation

---

## Effort vs. Impact Matrix

```
                        HIGH IMPACT
                            |
         +------------------+------------------+
         |  #1 /markets     |  #12 Market      |
         |     metadata     |     content      |
         |  #2 Fix OG tags  |  #8  Author      |
         |  #4 Fix slugs    |     attribution  |
         |  #5 Deploy llms  |  #13 Fix LCP     |
         |  #9 Fix noscript |                  |
   LOW   |                  |                  |  HIGH
  EFFORT +------------------+------------------+ EFFORT
         |  #6 Sitemap fix  |  #15 Comparisons |
         |  #10 Title tags  |  #17 Sitemap     |
         |  #22 Terms meta  |     index        |
         |  #27 COOP header |  #19 About page  |
         |                  |  #16 Cross-links |
         +------------------+------------------+
                            |
                        LOW IMPACT
```

**Recommended execution order:**

1. **#1** Add /markets metadata (5 min fix, biggest SEO gap)
2. **#2** Fix OG tags on methodology/accuracy/contact (15 min)
3. **#4** Fix market slug mismatches + Louisville (30 min)
4. **#5** Deploy llms.txt to production (merge to main)
5. **#3** Fix /reports indexing (add noindex or create landing page)
6. **#6** Add /scores/accuracy to sitemap (2 min)
7. **#9** Fix noscript H1 → p/div (5 min, fixes 9 pages at once)
8. **#7** Add JSON-LD to 6 pages (1-2 hours)
9. **#10** Fix title tags (15 min)
10. **#11** Server-render pricing content (30 min - 1 hour)
11. **#8** Add author attribution (1-2 hours)
12. **#13** Fix LCP on inner pages (investigation + code-split)
13. **#12** Add server-rendered market page content

**Quick wins (items 1-6):** ~1 hour of work for an estimated +5-8 points on SEO Health Score.

---

## Score Improvement Projections

| After completing...    | Estimated Score | Key improvements            |
| ---------------------- | :-------------: | --------------------------- |
| Current state          |       70        | —                           |
| Critical items (1-6)   |       76        | On-Page +8, AI Readiness +5 |
| + High items (7-11)    |       82        | Schema +12, On-Page +4      |
| + Medium items (12-20) |       88        | Content +8, Performance +5  |
| All items complete     |       90+       | Full optimization           |

---

_Generated by Claude Code SEO Audit — March 10, 2026_
_Lighthouse 13.0.1 | No CrUX field data (insufficient real-user traffic)_
