# PropertyIQ SEO Action Plan

**Generated:** 2026-03-10 | **SEO Health Score:** 72/100 | **Target:** 85+/100

---

## CRITICAL (Fix Immediately — Blocks Indexing or Rankings)

### 1. Fix Market Page Slug Mismatches

**Impact:** Internal links point to 404 pages, wasting crawl budget and link equity
**Pages affected:** At least Austin TX, Miami FL — likely more
**Action:**

- Audit `METRO_SLUG_DATA` in `lib/data/metro-slug-data.ts` against all internal link references
- Either update internal links to match sitemap slugs OR add redirects for old slugs
- Verify: `curl -s -o /dev/null -w "%{http_code}" https://www.propertyiq.app/markets/[slug]` for all 935 entries
  **File:** `packages/frontend/app/sitemap.ts` (line 92-97), homepage link references

### 2. Add Server-Rendered Content to Market Pages

**Impact:** 935 pages at risk of thin content penalty — this is the bulk of indexed pages
**Action:**

- Generate 200-300 words of unique market narrative per page using existing data
- Render server-side (not behind JS) — use Next.js `generateStaticParams` + SSG
- Include: market summary, key metrics text, score interpretation, trend description
- Add "Last updated: [date]" visible on each page
  **Files:** `packages/frontend/app/markets/[slug]/page.tsx`, `MetroPageContent.tsx`

### 3. Add Content-Security-Policy Header

**Impact:** XSS vulnerability without CSP; also a technical SEO trust signal
**Action:**

```javascript
// In next.config.mjs headers()
{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://api.mapbox.com; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com; connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://backend-production-ee4d.up.railway.app https://*.supabase.co; font-src 'self' https://fonts.gstatic.com;" }
```

**File:** `packages/frontend/next.config.mjs` (line 45-51)

### 3b. Fix Louisville Sitemap Slug (Forward Slash in Path)

**Impact:** Sitemap advertises a URL with embedded `/` that returns 404
**Action:**

- Fix slug in `METRO_SLUG_DATA` from `louisville/jefferson-county-ky-in` to `louisville-jefferson-county-ky-in`
- Add redirect from old URL to new URL
  **File:** `packages/frontend/lib/data/metro-slug-data.ts`

### 3c. Create Public Landing Page for /reports

**Impact:** `/reports` returns 307 redirect to sign-in — completely invisible to search engines
**Action:**

- Create a public landing page at `/reports` describing report features
- Gate actual report content at `/reports/[id]` behind auth
- Add `/reports/sample` or `/reports/shared` to showcase
- `/reports/sample` and `/reports/shared` already whitelisted in middleware — verify they have content
  **File:** `packages/frontend/middleware.ts` (line 13-21)

### 3d. Fix /about/terms Meta + Title

**Impact:** 9,000-word page with no meta description and duplicate "PropertyIQ | PropertyIQ" in title
**Action:**

- Add meta description: "Read PropertyIQ's Terms of Service. Covers data usage, intellectual property, disclaimers, and user responsibilities."
- Fix title to: "Terms of Service | PropertyIQ"
  **File:** `packages/frontend/app/about/terms/page.tsx` or layout

---

## HIGH (Fix Within 1 Week — Significant Rankings Impact)

### 4. Add Author Attribution to All Content

**Impact:** E-E-A-T is a primary ranking factor — no authorship kills credibility
**Action:**

- Add founder/team author info to all blog posts (name, bio, photo, credentials)
- Add `author` field to blog frontmatter
- Add author bio section to methodology and accuracy pages
- Update Article JSON-LD to include full author details
  **Files:** Blog post MDX files, `app/blog/[slug]/page.tsx`

### 5. Improve Scores Page Content Depth

**Impact:** Key landing page with only ~500 words — too thin for a competitive keyword
**Action:**

- Expand to 1,500+ words: add FAQ section, use case examples, detailed score explanations
- Add interactive score demo or sample score breakdown
- Include "How to use PropertyIQ Scores" section
- Add FAQ schema
  **File:** `packages/frontend/app/scores/page.tsx`

### 6. Fix Title Tags

**Impact:** Weak titles hurt CTR and keyword targeting
**Action:**

- `/scores`: Change to "AI Real Estate Scores — HomeReady, InvestorEdge & MarketHealth | PropertyIQ"
- `/about`: Change to "About PropertyIQ — Our Mission, Team & Data Sources"
- `/data`: Change to "90+ Real Estate Data Sources — Zillow, Census, FRED & More | PropertyIQ"
  **Files:** Respective `page.tsx` files' `generateMetadata` or `metadata` exports

### 7. Add JSON-LD Schema to Key Pages

**Impact:** Missing schema = missing rich results opportunities
**Action:**

- `/pricing`: Add `Product` with `Offer` schema (SSR, not JS-dependent)
- `/methodology`: Add `Article` + `HowTo` schema
- `/accuracy`: Add `Article` schema with `datePublished`
- `/compare/*`: Add `Product` comparison schema
- All: Add `FAQPage` schema where FAQ sections exist
  **Files:** Create schema components per page or extend `WebPageJsonLd.tsx`

### 8. Add Alt Text to All Images

**Impact:** Accessibility + image SEO — currently many images lack alt text
**Action:**

- Audit all `<img>`, `<svg>`, and Next.js `<Image>` components
- Add descriptive alt text or `role="presentation"` for decorative icons
- Priority: blog post images, market page charts, scores page icons
  **Files:** Various component files across the app

---

## MEDIUM (Fix Within 1 Month — Optimization Opportunities)

### 9. Expand Comparison Pages

**Action:** Expand each from ~400 to 1,000+ words with:

- Detailed feature comparison tables
- Pricing comparison with current data
- Use case recommendations ("Best for...")
- FAQ schema
- Add "Best Real Estate Analytics Platforms 2026" hub page

### 10. Improve Internal Cross-Linking

**Action:**

- Blog posts → link to relevant market pages
- Market pages → link to relevant blog posts
- Scores page → link to methodology + accuracy
- Add breadcrumbs to /map, /graphs, /pricing
- Vary CTA anchor text (not always "Explore the Map")

### 11. Add Search to Markets Directory

**Action:** Add search/filter functionality to `/markets` page:

- Search by city name
- Filter by state
- Sort by score or metric value

### 12. Expand About Page

**Action:** Add to ~1,500 words:

- Founder bio with credentials and photo
- Company history/timeline
- Team section (if applicable)
- Mission statement expansion
- Media mentions or partnerships

### 13. Reduce Font Count

**Action:** Evaluate if all 4 Google Fonts are needed:

- Roboto (primary) — keep
- Roboto Mono (code) — keep if used
- Source Serif 4 (reports) — consider loading only on report pages
- DM Sans — evaluate if used; remove if redundant

### 14. Expand llms.txt

**Action:** Add sections for:

- Methodology summary (how scores work)
- Pricing tiers and what's included
- Key differentiators vs competitors
- Sample data points and coverage stats
- Create `llms-full.txt` with deeper content

### 15. Create security.txt

**Action:** Add `/.well-known/security.txt` with:

- Contact email for security reports
- Preferred languages
- Expiry date
- CSAF/acknowledgments links

---

## LOW (Backlog — Nice to Have)

### 16. Diversify Blog Publication Dates

All 4 posts dated Feb 25, 2026 — looks artificial. Space out dates.

### 17. Add Related Posts to Blog

Show 2-3 related posts at the bottom of each blog post.

### 18. Remove Server Header

Railway exposes `server: railway-edge` — consider suppressing.

### 19. Add `aggregateRating` to SoftwareApplication Schema

Collect and display user ratings to enable star rating rich results.

### 20. Add Dataset Schema to Data Sources Page

Use `schema.org/Dataset` for each data source to enhance visibility in dataset searches.

### 21. Market Page Schema Enhancement

Add `StatisticalPopulation` or enhanced `Place` schema with quantitative data.

### 22. Pricing Page — Server-Render Content

Ensure pricing tiers render server-side for crawlers, not just via client JS.

---

## Effort vs. Impact Matrix

```
                        HIGH IMPACT
                            │
         ┌──────────────────┼──────────────────┐
         │  #1 Fix slugs    │  #2 Market       │
         │  #3 CSP header   │     content      │
         │  #6 Title tags   │  #4 Author       │
         │                  │     attribution   │
   LOW   │                  │                   │  HIGH
  EFFORT ├──────────────────┼───────────────────┤ EFFORT
         │  #8 Alt text     │  #5 Scores page   │
         │  #14 llms.txt    │  #9 Comparisons   │
         │  #15 security.txt│  #11 Markets      │
         │  #16 Blog dates  │      search       │
         │                  │  #10 Cross-links  │
         └──────────────────┼───────────────────┘
                            │
                        LOW IMPACT
```

**Recommended execution order:** 1 → 3 → 6 → 4 → 7 → 2 → 5 → 8 → 10 → 9

---

_Generated by Claude Code SEO Audit — March 10, 2026_
