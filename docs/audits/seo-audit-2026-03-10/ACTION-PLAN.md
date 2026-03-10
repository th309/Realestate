# PropertyIQ SEO Action Plan

**Based on:** Full SEO Audit (2026-03-10)
**Current Score:** 36/100
**Target Score:** 75/100 (after completing Critical + High fixes)

---

## Week 1: Critical Fixes (Score impact: +20-25 points)

### 1. Fix canonical URLs across all pages

**Issue:** T1, CQ2 | **Impact:** Highest single-impact fix
**Root cause:** `packages/frontend/app/layout.tsx` line ~112 sets global canonical to homepage

**Action:**

- Remove global `alternates.canonical` from root `layout.tsx`
- Add self-referencing canonical to every route's `generateMetadata()`:
  - `/map` → `https://www.propertyiq.app/map`
  - `/pricing` → `https://www.propertyiq.app/pricing`
  - `/about` → `https://www.propertyiq.app/about`
  - `/blog` → `https://www.propertyiq.app/blog`
  - `/blog/[slug]` → `https://www.propertyiq.app/blog/${slug}`
  - `/scores` → `https://www.propertyiq.app/scores`
  - `/data` → `https://www.propertyiq.app/data`
  - `/markets/[slug]` → `https://www.propertyiq.app/markets/${slug}`
  - All other routes

**Files to modify:**

- `packages/frontend/app/layout.tsx`
- Every route's `page.tsx` that has or needs `generateMetadata()`

---

### 2. Add security headers

**Issue:** T3 | **Impact:** Security + trust signal

**Action:** Add to `next.config.js` (or `next.config.ts`):

```javascript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }];
},
poweredByHeader: false,
```

---

### 3. Dynamic metadata for market pages

**Issue:** OP1 | **Impact:** 935 pages become indexable

**Action:** Update `/markets/[slug]/page.tsx` `generateMetadata()`:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const market = await getMarketBySlug(params.slug);
  return {
    title: `${market.shortName} Housing Market Analysis & Scores | PropertyIQ`,
    description: `${market.shortName} real estate market data, PropertyIQ scores, and AI forecasts. Explore home prices, trends, and investment potential.`,
    alternates: {
      canonical: `https://www.propertyiq.app/markets/${params.slug}`,
    },
    openGraph: {
      title: `${market.shortName} Housing Market | PropertyIQ`,
      description: `...`,
      url: `https://www.propertyiq.app/markets/${params.slug}`,
    },
  };
}
```

---

### 4. Fix FAQ schema mismatch

**Issue:** SD1 | **Impact:** Avoid structured data penalty

**Action:** Either:

- (A) Add a visible FAQ section to the homepage that matches the schema content, OR
- (B) Remove FAQPage schema from homepage and move it to a dedicated `/faq` page

---

### 5. Fix non-www redirect

**Issue:** T2 | **Impact:** Consolidate link equity

**Action:** In Railway dashboard, configure `propertyiq.app` to 301 redirect to `www.propertyiq.app`. Or add a DNS CNAME/A record that routes to the same Railway service.

---

## Week 2: High-Priority Fixes (Score impact: +10-15 points)

### 6. Add H1 tags to pages missing them

**Issue:** OP2
**Pages:** `/map`, `/pricing`, `/market/[id]` dashboard pages

### 7. Trim title tags to ≤60 characters

**Issue:** OP3

- `/pricing`: "PropertyIQ Pricing & Plans" (26 chars)
- `/about`: "About PropertyIQ | AI Real Estate Intel" (40 chars)
- Blog posts: Shorten per post

### 8. Fix meta descriptions (150-160 chars)

**Issue:** OP4

- `/blog`: Expand to ~155 chars
- `/about`: Trim to ~155 chars
- Blog posts: Trim to ~155 chars
- Market pages: Use shorter template with `shortName`

### 9. Make OG/Twitter tags page-specific

**Issue:** CQ6, H2

- Each route should override OG title, description, URL, and image
- Blog posts: Add `og:url` and `og:image` (generate dynamic OG images or add featured images to frontmatter)

### 10. Add JSON-LD to key pages

**Issue:** SD table

- `/pricing`: `SoftwareApplication` with `Offer` entries
- `/blog`: `Blog` or `CollectionPage` schema
- `/scores`: `WebPage` with `BreadcrumbList`
- `/data`: `WebPage` with `Dataset` entries
- `/about`: `Organization` + `Person` (founder)

### 11. Add BreadcrumbList schema site-wide

**Issue:** SD4

- Add to all pages that have visual breadcrumbs
- Use JSON-LD format

### 12. Add author/team info to About page

**Issue:** CQ4

- Add founder name, photo, professional background
- Explain "Federal Contracting Services LLC" relationship
- Add any data team or advisory credentials

---

## Month 1: Content & Performance (Score impact: +10-15 points)

### 13. Server-render market page data

**Issue:** CQ1, CQ2 | **Most complex fix**

- Convert `ScoreWidget` to support server-side initial data
- Pre-fetch 3-5 key metrics (median price, YoY change, scores) in `page.tsx`
- Server-render `MarketOverviewSection` initial content
- Add "Data as of [date]" timestamp in HTML

### 14. Add images to blog posts

**Issue:** CQ5

- Add data visualizations, market charts, and maps
- Include descriptive alt text
- Use Next.js `<Image>` component for optimization

### 15. Add blog author attribution

**Issue:** CQ3

- Add real author names to frontmatter
- Create author pages (`/blog/author/[name]`)
- Update Article schema with `Person` author type

### 16. Preload hero image

**Issue:** P2

- Add `priority` prop to hero `<Image>` component on homepage

### 17. Add preconnect hints

**Issue:** T6

```html
<link rel="preconnect" href="https://api.mapbox.com" />
<link rel="preconnect" href="https://backend-production-ee4d.up.railway.app" />
```

### 18. Fix sitemap `lastmod` dates

**Issue:** T7

- Generate `lastmod` dynamically based on actual content update timestamps
- Blog posts: use frontmatter `date` or `dateModified`
- Market pages: use data refresh date

### 19. Consolidate `/market/` vs `/markets/` URL patterns

**Issue:** T4

- Make `/markets/[slug]` the canonical pattern
- Either 301 redirect `/market/[id]` or add `noindex` meta tag

### 20. Add RSS feed discovery tag

```html
<link
  rel="alternate"
  type="application/rss+xml"
  title="PropertyIQ Blog"
  href="/blog/rss.xml"
/>
```

---

## Month 2: Polish & AI Readiness (Score impact: +5-10 points)

### 21. Create `llms.txt` file

Provide AI crawler guidance on site structure and content.

### 22. Add AI bot directives to robots.txt

Explicit allow rules for GPTBot, ClaudeBot, PerplexityBot.

### 23. Add "How to cite" section

On `/data` or `/about` page.

### 24. Link comparison pages from navigation

Add to footer or pricing page.

### 25. Enhance market page internal linking

- Include cross-state economically related metros
- Increase from 5 to 8-10 nearby market links

### 26. Add `dateModified` to all schema

Blog posts, market pages, data-driven content pages.

### 27. Create PWA manifest

`manifest.webmanifest` with proper icons, theme colors, display mode.

### 28. Add skip-to-content link

WCAG 2.1 Level A compliance.

### 29. Add `<noscript>` fallback

"JavaScript is required to use PropertyIQ."

### 30. Expand favicon set

Add 32x32, 192x192, 512x512 PNG icons and apple-touch-icon.

---

## Projected Score After Completion

| Phase                   | Actions | Projected Score |
| ----------------------- | ------- | --------------- |
| Current state           | —       | 36/100          |
| After Week 1 (Critical) | #1-5    | 50-55/100       |
| After Week 2 (High)     | #6-12   | 60-65/100       |
| After Month 1 (Content) | #13-20  | 70-80/100       |
| After Month 2 (Polish)  | #21-30  | 80-85/100       |

---

## Key Files to Modify (Summary)

| File                                                | Changes Needed                                         |
| --------------------------------------------------- | ------------------------------------------------------ |
| `packages/frontend/app/layout.tsx`                  | Remove global canonical, add security-related metadata |
| `packages/frontend/next.config.ts`                  | Security headers, `poweredByHeader: false`, preconnect |
| `packages/frontend/app/map/page.tsx`                | Add canonical, H1, heading structure                   |
| `packages/frontend/app/pricing/page.tsx`            | Add canonical, H1, JSON-LD, SSR content                |
| `packages/frontend/app/about/page.tsx`              | Add canonical, team info, JSON-LD                      |
| `packages/frontend/app/blog/page.tsx`               | Add canonical, JSON-LD                                 |
| `packages/frontend/app/blog/[slug]/page.tsx`        | Add canonical, og:url, og:image, author                |
| `packages/frontend/app/blog/layout.tsx`             | Add canonical                                          |
| `packages/frontend/app/scores/page.tsx`             | Add canonical, JSON-LD, expand content                 |
| `packages/frontend/app/data/page.tsx`               | Add canonical, Dataset JSON-LD                         |
| `packages/frontend/app/markets/[slug]/page.tsx`     | Dynamic metadata, SSR data, JSON-LD                    |
| `packages/frontend/app/sitemap.ts`                  | Dynamic lastmod dates                                  |
| `packages/frontend/public/robots.txt`               | AI bot directives                                      |
| `packages/frontend/public/llms.txt`                 | New file                                               |
| `packages/frontend/public/.well-known/security.txt` | New file                                               |
