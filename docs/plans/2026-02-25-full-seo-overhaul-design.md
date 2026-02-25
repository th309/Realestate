# Full SEO Overhaul — Design Document

**Date:** 2026-02-25
**Author:** Troy Houston + Claude
**Status:** Approved

## Problem Statement

PropertyIQ.app has zero SEO visibility — no indexed keywords, no organic traffic, and three critical technical issues preventing search engines from discovering the site. Competitors like Reventure (103K monthly visits) and NeighborhoodScout (26K+ indexed keywords) dominate organic search in the real estate analytics space.

The product is competitive, but search engines can't find it.

## Goals

1. Fix all critical technical SEO blockers so Google can index the site
2. Build programmatic metro pages (925 markets) as the primary organic traffic driver
3. Launch a blog with MDX content and an AI-powered drafting workflow
4. Create comparison and content pages to capture commercial-intent keywords

## Phased Approach

### Phase 1: Critical Technical SEO Fixes

**Priority:** Immediate — unblocks all other phases.

#### 1.1 Canonical Tag Fix

**Problem:** `app/page.tsx` sets `alternates: { canonical: 'https://propertyiq.com' }` — a completely different business. `JsonLd.tsx` also uses `propertyiq.com` throughout. The root layout correctly uses `propertyiq.app`.

**Fix:**
- Remove `alternates.canonical` from `app/page.tsx` — the root layout's `metadataBase: 'https://www.propertyiq.app'` handles canonical generation via Next.js metadata merging
- Update every URL in `app/components/home/JsonLd.tsx` from `propertyiq.com` to `www.propertyiq.app`
- Grep the entire frontend for any remaining `propertyiq.com` references and fix them

#### 1.2 robots.txt

Create `app/robots.ts` (Next.js App Router convention):

```typescript
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dev/', '/auth/', '/account/', '/health/'],
      },
    ],
    sitemap: 'https://www.propertyiq.app/sitemap.xml',
  };
}
```

Blocked paths: `/api/` (API routes), `/admin/` (admin panel), `/dev/` (dev tools), `/auth/` (auth flows), `/account/` (private user data), `/health/` (health checks).

#### 1.3 XML Sitemap

Create `app/sitemap.ts` using Next.js native sitemap generation:

```typescript
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    { url: 'https://www.propertyiq.app', changeFrequency: 'weekly', priority: 1.0 },
    { url: 'https://www.propertyiq.app/about', changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://www.propertyiq.app/pricing', changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://www.propertyiq.app/contact', changeFrequency: 'monthly', priority: 0.4 },
    { url: 'https://www.propertyiq.app/scores', changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://www.propertyiq.app/data', changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://www.propertyiq.app/graphs', changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://www.propertyiq.app/map', changeFrequency: 'weekly', priority: 0.8 },
    // ... additional static routes
  ];

  // Dynamic: metro pages (Phase 2), blog posts (Phase 3), metric pages
  // These will be added as each phase is implemented

  return staticRoutes;
}
```

Will be extended in Phase 2 (metro slugs) and Phase 3 (blog posts).

#### 1.4 Title Tag & Meta Optimization

**Homepage (`app/page.tsx`):**
- Title: `"PropertyIQ: AI Housing Market Data & Forecasts by ZIP Code"` (57 chars)
- Description: ~155 chars, front-loaded with keywords
- Remove `alternates.canonical` (handled by layout)

**H1 (`app/components/home/HeroSection.tsx`):**
- Change from `"We find the markets that outperform"` to something keyword-rich but compelling, e.g., `"AI-Powered Housing Market Intelligence for Every ZIP Code"`
- Keep the original tagline as a `<p>` subtitle

**Add metadata exports to pages missing them:**

| Page | Proposed Title |
|------|---------------|
| `/about` | `"About PropertyIQ - AI Real Estate Market Intelligence"` |
| `/contact` | `"Contact PropertyIQ - Get in Touch"` |
| `/pricing` | `"Pricing - PropertyIQ Plans for Investors, Agents & Homebuyers"` |
| `/market` | `"Market Intelligence - Housing Market Rankings | PropertyIQ"` |
| `/graphs` | `"Housing Market Graphs & Trends | PropertyIQ"` |
| `/map` | `"Interactive Housing Market Map | PropertyIQ"` |

#### 1.5 Structured Data Enhancement

Update `JsonLd.tsx`:
- Fix all `propertyiq.com` → `www.propertyiq.app`
- Verify `Organization`, `SoftwareApplication`, `FAQPage`, `WebSite` schemas are correct
- Fix the `SearchAction` URL to point to propertyiq.app
- Add `BreadcrumbList` schema (reusable component for all pages)

#### 1.6 Google Analytics 4

Add GA4 via `next/script` in root layout:
- Environment variable: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Script strategy: `afterInteractive`
- Basic pageview tracking (enhanced measurement handles most events)
- User needs to create GA4 property and add the measurement ID to Railway env vars

#### 1.7 Open Graph Images

- Create/verify `app/opengraph-image.png` (1200x630) — Next.js serves this automatically
- Create/verify `app/twitter-image.png` (1200x600)
- Ensure `logo.png` exists in `public/` for the Organization schema

#### 1.8 Cleanup

- Remove default Next.js SVGs from `public/`: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`

---

### Phase 2: Programmatic Metro SEO Pages

**Priority:** Highest-impact SEO play. NeighborhoodScout's 26K+ indexed keywords come primarily from location pages.

#### 2.1 URL Structure

`/markets/[slug]` where slug format is: `{city-name}-{state-abbrev}`

Examples:
- `/markets/austin-tx`
- `/markets/los-angeles-ca`
- `/markets/miami-fort-lauderdale-fl`

#### 2.2 Metro Slug Mapping

Static mapping file: `lib/data/metro-slugs.ts`

```typescript
export interface MetroSlugEntry {
  cbsaCode: string;
  slug: string;
  name: string;       // Full metro name: "Austin-Round Rock-Georgetown, TX"
  shortName: string;  // Display name: "Austin, TX"
  state: string;      // State abbreviation
}
```

Generated from existing metro data in the database. Build a one-time script to export this mapping.

#### 2.3 Data Source

Each page fetches from existing backend APIs — no new endpoints needed:
- Score data via `fetchScore('metro', cbsaCode, scoreType)`
- Key metrics via `fetchSnapshotData(metricId, 'metro')`
- Trends via `fetchTimeSeriesData(metricId, 'metro', cbsaCode)`

All server-rendered — data fetched at build time via `generateStaticParams()` + ISR (revalidate every 24 hours).

#### 2.4 Page Template

Server-rendered (no top-level `'use client'`):

```
[Breadcrumb: Home > Markets > Austin, TX]

<h1>Austin, TX Housing Market Analysis</h1>
<p class="lead">AI-powered market intelligence for the Austin-Round Rock-Georgetown, TX metro area.
   Median home price: $485,000. HomeReady Score: 72/100.</p>

## PropertyIQ Scores
[ScoreWidget cards: HomeReady | InvestorEdge | Market Health]

## Key Market Metrics
[Data grid: Median Home Price, Rent Index, Price-to-Income, Inventory, Days on Market, etc.]

## Price Trends
[12-month sparkline chart — client island component]

## Market Summary
[Template-based paragraph with actual metric values filled in]
[Future: AI-generated narrative per metro]

## Explore This Market
[CTA: "View on Interactive Map" → /map?metro={cbsaCode}]
[CTA: "Get Full Market Report" → /reports?metro={cbsaCode}]

## Nearby Markets
[Internal links to 3-5 geographically related metros]

[JSON-LD: Place schema + BreadcrumbList]
```

#### 2.5 SEO Per Page

- `generateMetadata()`: Title like `"Austin, TX Housing Market 2026 | Prices, Scores & Forecast | PropertyIQ"` (unique per metro)
- Description with actual data: `"Austin TX median home price is $485K (+3.2% YoY). HomeReady Score: 72. AI-powered analysis of the Austin metro housing market."`
- `generateStaticParams()` for all 925 metros → ISR with 24h revalidation
- Canonical auto-set by Next.js metadata merging
- BreadcrumbList + Place JSON-LD per page

#### 2.6 Internal Linking

- Each metro page links to 3-5 nearby metros (same state or region)
- Homepage gets a "Top Markets" section linking to 10-20 featured metros
- Sitemap extended with all `/markets/*` URLs
- Blog posts cross-link to relevant metro pages

#### 2.7 Metro Index Page

`/markets` (index) — a browseable, SEO-friendly listing of all 925 metros:
- Grouped by state
- Each entry shows: metro name, score badge, median price
- Links to individual metro pages
- Good for internal link equity distribution

---

### Phase 3: Blog Infrastructure + AI Drafting Skill

#### 3.1 Technical Setup

- **Route:** `app/blog/` with `[slug]/page.tsx`
- **Content storage:** `content/blog/` at frontend root (MDX files)
- **Drafts:** `content/blog/drafts/` (AI-generated, pending review)
- **Packages:** `@next/mdx`, `gray-matter` for frontmatter
- **Index page:** `/blog` — post listing sorted by date, paginated
- **RSS:** Route handler at `/blog/rss.xml`

#### 3.2 Blog Post Frontmatter

```yaml
---
title: "Housing Market Forecast 2026: What AI Predicts for Every Metro"
description: "PropertyIQ's AI analyzes 925 metros..."
date: "2026-02-25"
author: "PropertyIQ Research"
category: "market-analysis"
tags: ["forecast", "2026", "housing-market"]
targetKeyword: "housing market forecast 2026"
image: "/images/blog/forecast-2026-hero.png"
---
```

#### 3.3 SEO Per Post

- `generateMetadata()` from frontmatter
- `generateStaticParams()` from all MDX files
- Article JSON-LD (author, datePublished, dateModified, publisher)
- Blog listing page has dedicated metadata
- RSS feed for syndication

#### 3.4 Category Pages

- `/blog` — all posts
- `/blog/category/[category]` — filtered by category
- Categories: `market-analysis`, `investment`, `methodology`, `news`

#### 3.5 MDX Components

Blog posts can embed interactive React components:
- `<MetroScoreCard metro="austin-tx" />` — inline score widget
- `<MetricChart metricId="home_value" geoLevel="metro" />` — inline trend chart
- `<CompareTable metros={["austin-tx", "dallas-tx"]} />` — side-by-side comparison

#### 3.6 Seed Content (4 posts)

1. **"Housing Market Forecast 2026: What AI Predicts for Every Metro"** — target: `housing market forecast 2026`
2. **"Best Cities to Buy a House in 2026: Data-Driven Rankings"** — target: `best real estate markets to invest in 2026`
3. **"How PropertyIQ Predicts Housing Markets: Our Methodology"** — target: `AI real estate analytics`
4. **"Is It a Good Time to Buy a House? Here's What the Data Says"** — target: `is it a good time to buy a house`

#### 3.7 Blog Drafting Skill (`suggest-blog-posts`)

A Claude Code skill for ongoing content creation:

**Suggest mode:**
1. Reads `content/blog/keyword-tracker.md` to see which keywords are already covered
2. Checks the keyword opportunity list from the SEO audit
3. Considers current market trends (can query backend APIs for recent data shifts)
4. Proposes 3-5 post ideas with: title, target keyword, content outline, estimated search value

**Draft mode:**
1. On user approval, writes a complete MDX file to `content/blog/drafts/`
2. Includes proper frontmatter, keyword-optimized headings, embedded data widget components
3. Internal links to relevant metro pages and other blog posts
4. CTAs to PropertyIQ features

**Publish mode:**
1. User reviews and edits the draft
2. On approval, moves from `drafts/` to `content/blog/`
3. Updates `keyword-tracker.md` with the new post's target keyword

**Keyword tracker (`content/blog/keyword-tracker.md`):**
```markdown
| Keyword | Post | Date | Status |
|---------|------|------|--------|
| housing market forecast 2026 | housing-market-forecast-2026.mdx | 2026-02-25 | Published |
| best real estate markets 2026 | best-cities-to-buy-2026.mdx | 2026-02-25 | Published |
| AI real estate analytics | propertyiq-methodology.mdx | 2026-02-26 | Draft |
```

---

### Phase 4: Comparison Pages + Newsletter

#### 4.1 Comparison Pages

Static pages at `/compare/[slug]`:
- `/compare/propertyiq-vs-reventure`
- `/compare/propertyiq-vs-mashvisor`
- `/compare/propertyiq-vs-neighborhoodscout`

Each page structure:
- H1: "PropertyIQ vs Reventure App: Which Housing Market Tool Is Better?"
- Feature comparison table
- Pricing comparison
- Data coverage comparison
- Unique differentiators section
- CTA: "Try PropertyIQ Free"
- FAQ schema for rich snippets

#### 4.2 Newsletter Signup Component

Reusable `<NewsletterSignup />` component placed on:
- Homepage (below hero)
- Blog posts (end of article)
- Metro pages (after market summary)

Backend: Next.js API route → stores email in Supabase `newsletter_signups` table.
Future: Connect to email service (Resend, already in the stack for beta invites).

#### 4.3 Additional Structured Data

- FAQ schema on pricing page
- Product schema on comparison pages
- Article schema on all blog posts (handled in Phase 3)
- BreadcrumbList on all pages (handled in Phase 1)

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sitemap generation | Next.js native `app/sitemap.ts` | No external dependency, integrates with App Router |
| Blog engine | MDX in repo | Full control, embeddable React components, zero external deps |
| Metro page rendering | ISR (24h revalidation) | Data changes daily, not hourly. Static for speed, fresh enough for accuracy |
| Metro content | Template-based (AI later) | Ship fast, still unique per page due to different data |
| Blog drafting | Claude Code skill | Fits existing workflow, no admin UI overhead |
| Newsletter storage | Supabase table | Already in the stack, minimal new infrastructure |
| GA4 | next/script in layout | Standard approach, minimal code |
| robots.txt | `app/robots.ts` | Next.js convention, type-safe |

## Out of Scope

- YouTube / video content strategy (marketing, not engineering)
- Backlink outreach / PR campaigns (marketing, not engineering)
- Google Search Console setup (manual step, not code — user will do this)
- Mobile app
- Page speed optimization for scatter animation (separate task)

## Success Metrics

- Google indexes all static pages within 2 weeks of Phase 1 deploy
- 925 metro pages live and indexed within 1 month
- First organic search impressions within 3-4 weeks
- Blog producing 2-4 posts/month via the drafting skill
