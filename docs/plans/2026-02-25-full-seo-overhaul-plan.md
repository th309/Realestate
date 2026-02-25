# Full SEO Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical SEO blockers, build programmatic metro pages, launch an MDX blog with AI drafting workflow, and add comparison pages + newsletter signup.

**Architecture:** 4-phase rollout. Phase 1 fixes technical blockers (canonical, robots.txt, sitemap, metadata). Phase 2 adds 925 metro SEO pages using existing backend data via ISR. Phase 3 adds MDX blog with `next-mdx-remote` and a Claude Code drafting skill. Phase 4 adds comparison pages and newsletter.

**Tech Stack:** Next.js 16 App Router (metadata API, sitemap.ts, robots.ts), `next-mdx-remote` for blog, existing NestJS backend + Supabase, GA4

**Design Doc:** `docs/plans/2026-02-25-full-seo-overhaul-design.md`

---

## Phase 1: Critical Technical SEO Fixes

### Task 1: Fix canonical tag on homepage

**Files:**
- Modify: `packages/frontend/app/page.tsx:14-22`

**Step 1: Remove the wrong canonical override**

The homepage overrides the root layout's correct canonical (`https://www.propertyiq.app`) with `https://propertyiq.com` — a completely different business. Remove the `alternates` block so the root layout canonical takes effect.

Change `packages/frontend/app/page.tsx` lines 14-22 from:

```typescript
export const metadata: Metadata = {
  title:
    'PropertyIQ - AI Real Estate Market Intelligence for Homebuyers, Investors & Agents',
  description:
    'PropertyIQ uses machine learning to rank 925 US metros, 3,100+ counties, and 33,000+ ZIP codes and generate AI market reports. Find markets that outperform, get personalized analysis, and invest with data—not guesswork.',
  alternates: {
    canonical: 'https://propertyiq.com',
  },
};
```

To:

```typescript
export const metadata: Metadata = {
  title: 'PropertyIQ: AI Housing Market Data & Forecasts by ZIP Code',
  description:
    'PropertyIQ ranks 925 US metros and 33,000+ ZIP codes with AI to find markets that outperform. Free interactive maps, market scores, and AI-generated reports.',
};
```

This simultaneously: (a) removes the wrong canonical, (b) shortens title from 82→57 chars, (c) tightens meta description to ~155 chars with front-loaded keywords. The root layout's `alternates.canonical: "https://www.propertyiq.app"` (layout.tsx:107) handles canonical for all pages.

**Step 2: Verify**

Run: `cd packages/frontend && npx next build 2>&1 | head -30`
Expected: Build succeeds without metadata errors.

**Step 3: Commit**

```bash
git add packages/frontend/app/page.tsx
git commit -m "fix(seo): remove wrong canonical tag and optimize homepage title/description"
```

---

### Task 2: Fix all propertyiq.com references in JsonLd.tsx

**Files:**
- Modify: `packages/frontend/app/components/home/JsonLd.tsx` (14 URL references on lines 15, 17, 20, 33, 40, 96, 97, 100, 105, 161, 162, 165, 166, 167)

**Step 1: Replace all `propertyiq.com` with `www.propertyiq.app`**

Use find-and-replace across the file. Every `https://propertyiq.com` becomes `https://www.propertyiq.app`. The email `support@propertyiq.com` on line 33 becomes `support@propertyiq.app`.

Additionally fix the SearchAction URL on line 105: change `https://propertyiq.com/search?q={search_term_string}` to `https://www.propertyiq.app/map?q={search_term_string}` (there is no `/search` route — the map page accepts search queries).

**Step 2: Verify JSON-LD is valid**

Run: `cd packages/frontend && npx next build 2>&1 | head -30`
Expected: Build succeeds. Optionally validate the JSON-LD output with Google's Rich Results Test after deployment.

**Step 3: Commit**

```bash
git add packages/frontend/app/components/home/JsonLd.tsx
git commit -m "fix(seo): correct all JSON-LD schema URLs from propertyiq.com to propertyiq.app"
```

---

### Task 3: Fix remaining propertyiq.com references across codebase

**Files:**
- Modify: `packages/frontend/app/account/page.tsx:175` — dev mock email
- Modify: `packages/frontend/app/admin/entitlements/playbook/page.tsx:499` — support mailto
- Modify: `packages/frontend/app/components/home/DemoSection.tsx:109` — display text
- Modify: `packages/frontend/components/account/ProfileTab.tsx:404,407` — support mailto + display

**Step 1: Search for all remaining `propertyiq.com` references**

Run a grep for `propertyiq\.com` across the frontend. The known hits are:
- `account/page.tsx:175` — `email: 'dev@propertyiq.com'` → change to `dev@propertyiq.app`
- `admin/entitlements/playbook/page.tsx:499` — `mailto:support@propertyiq.com` → `mailto:support@propertyiq.app`
- `components/home/DemoSection.tsx:109` — display text `propertyiq.com/{tab}` → `propertyiq.app/{tab}`
- `components/account/ProfileTab.tsx:404,407` — `mailto:support@propertyiq.com` and display text → `.app`

Do NOT change test fixtures (`tests/fixtures/mock-api-responses.ts`, `tests/e2e/*.spec.ts`) — those are test data, not user-facing.

**Step 2: Verify no user-facing `.com` references remain**

Run: `grep -r "propertyiq\.com" packages/frontend/app/ packages/frontend/components/ --include="*.tsx" --include="*.ts" -l`
Expected: No results (test files are outside these directories).

**Step 3: Commit**

```bash
git add -A
git commit -m "fix(seo): replace all user-facing propertyiq.com references with propertyiq.app"
```

---

### Task 4: Create robots.txt

**Files:**
- Create: `packages/frontend/app/robots.ts`

**Step 1: Create the robots.ts file**

```typescript
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dev/', '/auth/', '/account/', '/health/', '/betatest/'],
      },
    ],
    sitemap: 'https://www.propertyiq.app/sitemap.xml',
  };
}
```

Blocked paths rationale:
- `/api/` — API routes, not pages
- `/admin/` — admin panel, not public
- `/dev/` — dev tools
- `/auth/` — auth callback flows
- `/account/` — private user settings
- `/health/` — health check endpoint
- `/betatest/` — beta tester internal pages

**Step 2: Verify**

Run: `cd packages/frontend && npx next build 2>&1 | head -30`
Expected: Build succeeds. The route `/robots.txt` will be served automatically by Next.js.

**Step 3: Commit**

```bash
git add packages/frontend/app/robots.ts
git commit -m "feat(seo): add robots.txt with crawl directives and sitemap reference"
```

---

### Task 5: Create XML sitemap

**Files:**
- Create: `packages/frontend/app/sitemap.ts`

**Step 1: Create the sitemap**

```typescript
import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.propertyiq.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Static public pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/map`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/scores`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/graphs`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/data`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/market`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/scores/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/about/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  // TODO Phase 2: Add /markets/[slug] URLs for all 925 metros
  // TODO Phase 3: Add /blog/[slug] URLs for all blog posts

  return staticRoutes;
}
```

**Step 2: Verify**

Run: `cd packages/frontend && npx next build 2>&1 | head -30`
Expected: Build succeeds. `/sitemap.xml` will be auto-served by Next.js.

**Step 3: Commit**

```bash
git add packages/frontend/app/sitemap.ts
git commit -m "feat(seo): add XML sitemap with all public static routes"
```

---

### Task 6: Update H1 on homepage

**Files:**
- Modify: `packages/frontend/app/components/home/HeroSection.tsx:49-52`

**Step 1: Change H1 to include target keywords**

Change lines 49-52 from:

```tsx
          We find the markets that{' '}
          <span className="text-primary">outperform</span>
```

To:

```tsx
          Find housing markets that{' '}
          <span className="text-primary">outperform</span>
```

This adds the keyword "housing markets" while keeping the compelling tagline. "Find" is more action-oriented than "We find" and works better for search intent.

**Step 2: Verify visually**

Run: `cd packages/frontend && npm run dev`
Check: Homepage H1 reads "Find housing markets that outperform" and looks correct visually.

**Step 3: Commit**

```bash
git add packages/frontend/app/components/home/HeroSection.tsx
git commit -m "feat(seo): add target keyword to homepage H1"
```

---

### Task 7: Add metadata to pages missing it

**Files:**
- Modify: `packages/frontend/app/about/page.tsx` — add metadata export
- Modify: `packages/frontend/app/contact/page.tsx` — add metadata export
- Create: `packages/frontend/app/pricing/layout.tsx` — wrapper for client component (pricing/page.tsx is `'use client'`)
- Create: `packages/frontend/app/market/layout.tsx` — wrapper for client component
- Create: `packages/frontend/app/graphs/layout.tsx` — wrapper for client component
- Create: `packages/frontend/app/map/layout.tsx` — wrapper for client component

**Step 1: Add metadata to server component pages**

For `app/about/page.tsx`, add at the top of the file (after imports):

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About PropertyIQ - AI Real Estate Market Intelligence',
  description: 'Learn how PropertyIQ uses machine learning to analyze 925 US metros and 33,000+ ZIP codes, helping homebuyers, investors, and agents make data-driven real estate decisions.',
};
```

For `app/contact/page.tsx`, add:

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact PropertyIQ',
  description: 'Get in touch with the PropertyIQ team. Questions about AI-powered real estate market analysis, pricing, or partnerships.',
};
```

**Step 2: Create layout.tsx wrappers for client component pages**

For pages that are `'use client'` (pricing, market, graphs, map), create a `layout.tsx` in each directory that exports metadata. These are server components that wrap the client page.

`app/pricing/layout.tsx`:
```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - PropertyIQ Plans for Investors, Agents & Homebuyers',
  description: 'Compare PropertyIQ plans: Free, Pro ($29/mo), and Team ($99/mo). AI-powered market analysis, scores, reports, and interactive maps.',
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

`app/market/layout.tsx`:
```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Intelligence - Housing Market Rankings',
  description: 'Explore housing market rankings, scores, and analysis for US metros, counties, and ZIP codes. AI-powered market intelligence by PropertyIQ.',
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

`app/graphs/layout.tsx`:
```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Housing Market Graphs & Trends',
  description: 'Interactive charts and graphs showing housing market trends, price history, inventory levels, and economic indicators across US metros.',
};

export default function GraphsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

`app/map/layout.tsx`:
```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interactive Housing Market Map',
  description: 'Explore the interactive housing market heat map. Visualize home values, rent prices, inventory, and 40+ metrics across 925 US metros and 33,000+ ZIP codes.',
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Step 3: Verify build**

Run: `cd packages/frontend && npx next build 2>&1 | head -30`
Expected: Build succeeds. Each page now has unique title/description.

**Step 4: Commit**

```bash
git add packages/frontend/app/about/page.tsx packages/frontend/app/contact/page.tsx \
  packages/frontend/app/pricing/layout.tsx packages/frontend/app/market/layout.tsx \
  packages/frontend/app/graphs/layout.tsx packages/frontend/app/map/layout.tsx
git commit -m "feat(seo): add unique metadata to all public pages"
```

---

### Task 8: Add Google Analytics 4

**Files:**
- Create: `packages/frontend/app/components/analytics/GoogleAnalytics.tsx`
- Modify: `packages/frontend/app/layout.tsx` — import and render GA component

**Step 1: Create GA4 component**

```typescript
// packages/frontend/app/components/analytics/GoogleAnalytics.tsx
import Script from 'next/script';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
```

**Step 2: Add to root layout**

In `app/layout.tsx`, import the component and render it inside `<body>` before `<Providers>`:

```typescript
import { GoogleAnalytics } from './components/analytics/GoogleAnalytics';
```

Add `<GoogleAnalytics />` as the first child inside `<body>`.

**Step 3: Add env variable locally**

Add to `.env.local` (NOT committed):
```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

User must: (a) create a GA4 property at analytics.google.com, (b) add the measurement ID to Railway production env vars.

**Step 4: Commit**

```bash
git add packages/frontend/app/components/analytics/GoogleAnalytics.tsx packages/frontend/app/layout.tsx
git commit -m "feat(seo): add Google Analytics 4 integration"
```

---

### Task 9: Create Open Graph images

**Files:**
- Create: `packages/frontend/app/opengraph-image.png` (or verify existing)
- Create: `packages/frontend/app/twitter-image.png` (or verify existing)
- Create: `packages/frontend/public/logo.png` (referenced by JsonLd Organization schema)

**Step 1: Check what exists**

Run: `ls packages/frontend/app/opengraph-image* packages/frontend/app/twitter-image* packages/frontend/public/logo* packages/frontend/public/og-image* 2>/dev/null`

If images don't exist, create placeholder OG images. The simplest approach for now:
- Copy an existing product screenshot or hero image as a starting point
- The ideal OG image is 1200x630 with the PropertyIQ logo, tagline, and a preview of the map

If the product screenshot at `public/images/home/market-map-hero-v4.png` exists, it can serve as a temporary OG image until a purpose-built one is designed.

For `logo.png`: check if there's a logo in `public/images/` that can be copied to `public/logo.png`.

**Step 2: Verify metadata references**

The root layout already references `/og-image.png` and `/twitter-image.png`. Next.js App Router also automatically detects `app/opengraph-image.png` and `app/twitter-image.png` by convention. Use the convention-based approach (files in `app/`) as it's cleaner.

**Step 3: Commit**

```bash
git add packages/frontend/app/opengraph-image.png packages/frontend/app/twitter-image.png packages/frontend/public/logo.png
git commit -m "feat(seo): add Open Graph and Twitter card images"
```

---

### Task 10: Clean up default Next.js files

**Files:**
- Delete: `packages/frontend/public/file.svg`
- Delete: `packages/frontend/public/globe.svg`
- Delete: `packages/frontend/public/next.svg`
- Delete: `packages/frontend/public/vercel.svg`
- Delete: `packages/frontend/public/window.svg`

**Step 1: Verify these files are unused**

Run grep to confirm no imports reference them:
```bash
grep -r "file\.svg\|globe\.svg\|next\.svg\|vercel\.svg\|window\.svg" packages/frontend/app/ packages/frontend/components/ packages/frontend/lib/ --include="*.tsx" --include="*.ts"
```

Expected: No results (these are default Next.js scaffolding files).

**Step 2: Delete them**

```bash
rm packages/frontend/public/file.svg packages/frontend/public/globe.svg \
  packages/frontend/public/next.svg packages/frontend/public/vercel.svg \
  packages/frontend/public/window.svg
```

**Step 3: Commit**

```bash
git add -u packages/frontend/public/
git commit -m "chore: remove default Next.js scaffolding SVGs from public/"
```

---

## Phase 2: Programmatic Metro SEO Pages

### Task 11: Create metro slug mapping utility

**Files:**
- Create: `packages/frontend/lib/data/metro-slugs.ts`

**Step 1: Build the slug generation utility**

```typescript
// packages/frontend/lib/data/metro-slugs.ts

export interface MetroSlugEntry {
  cbsaCode: string;
  slug: string;
  name: string;       // Full: "Austin-Round Rock-Georgetown, TX"
  shortName: string;  // Display: "Austin, TX"
  state: string;      // "TX"
}

/**
 * Generate a URL-friendly slug from a metro name.
 * "Austin-Round Rock-Georgetown, TX" → "austin-round-rock-georgetown-tx"
 */
export function generateMetroSlug(metroName: string): string {
  return metroName
    .toLowerCase()
    .replace(/[,.'()]/g, '')      // Remove punctuation
    .replace(/\s+/g, '-')         // Spaces to hyphens
    .replace(/-+/g, '-')          // Collapse multiple hyphens
    .replace(/^-|-$/g, '');       // Trim leading/trailing hyphens
}

/**
 * Extract a short display name from a full metro name.
 * "Austin-Round Rock-Georgetown, TX" → "Austin, TX"
 */
export function getMetroShortName(fullName: string): string {
  const commaIndex = fullName.indexOf(',');
  if (commaIndex === -1) return fullName;

  const cityPart = fullName.substring(0, commaIndex);
  const statePart = fullName.substring(commaIndex + 1).trim();

  // Take first city only (before first hyphen)
  const firstCity = cityPart.split('-')[0].trim();
  // Take first state only (before first hyphen)
  const firstState = statePart.split('-')[0].trim();

  return `${firstCity}, ${firstState}`;
}

/**
 * Extract state abbreviation from metro name.
 * "Austin-Round Rock-Georgetown, TX" → "TX"
 */
export function getMetroState(fullName: string): string {
  const commaIndex = fullName.indexOf(',');
  if (commaIndex === -1) return '';
  const statePart = fullName.substring(commaIndex + 1).trim();
  return statePart.split('-')[0].trim();
}
```

**Step 2: Write tests**

Create `packages/frontend/lib/data/__tests__/metro-slugs.test.ts`:

```typescript
import { generateMetroSlug, getMetroShortName, getMetroState } from '../metro-slugs';

describe('generateMetroSlug', () => {
  it('converts simple metro name', () => {
    expect(generateMetroSlug('Austin-Round Rock-Georgetown, TX')).toBe('austin-round-rock-georgetown-tx');
  });
  it('handles multi-state metros', () => {
    expect(generateMetroSlug('New York-Newark-Jersey City, NY-NJ-PA')).toBe('new-york-newark-jersey-city-ny-nj-pa');
  });
  it('handles apostrophes', () => {
    expect(generateMetroSlug("Coeur d'Alene, ID")).toBe('coeur-dalene-id');
  });
});

describe('getMetroShortName', () => {
  it('extracts first city and state', () => {
    expect(getMetroShortName('Austin-Round Rock-Georgetown, TX')).toBe('Austin, TX');
  });
  it('handles multi-state', () => {
    expect(getMetroShortName('New York-Newark-Jersey City, NY-NJ-PA')).toBe('New York, NY');
  });
});

describe('getMetroState', () => {
  it('extracts state abbreviation', () => {
    expect(getMetroState('Austin-Round Rock-Georgetown, TX')).toBe('TX');
  });
});
```

**Step 3: Run tests**

Run: `cd packages/frontend && npx jest lib/data/__tests__/metro-slugs.test.ts`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add packages/frontend/lib/data/metro-slugs.ts packages/frontend/lib/data/__tests__/metro-slugs.test.ts
git commit -m "feat(seo): add metro slug generation utilities with tests"
```

---

### Task 12: Build metro slug data file

**Files:**
- Create: `packages/frontend/lib/data/metro-slug-data.ts` (generated from API)
- Create: `scripts/generate-metro-slugs.ts` (one-time generation script)

**Step 1: Create generation script**

This script calls the backend API to get all metros, generates slugs, and writes a static TypeScript file.

```typescript
// scripts/generate-metro-slugs.ts
// Run with: npx tsx scripts/generate-metro-slugs.ts

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface MetroEntry {
  regionId: number;
  name: string;
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[,.'()]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function getShortName(fullName: string): string {
  const ci = fullName.indexOf(',');
  if (ci === -1) return fullName;
  const city = fullName.substring(0, ci).split('-')[0].trim();
  const state = fullName.substring(ci + 1).trim().split('-')[0].trim();
  return `${city}, ${state}`;
}

function getState(fullName: string): string {
  const ci = fullName.indexOf(',');
  if (ci === -1) return '';
  return fullName.substring(ci + 1).trim().split('-')[0].trim();
}

async function main() {
  const res = await fetch(`${API_URL}/api/markets/metros`);
  const metros: MetroEntry[] = await res.json();

  const entries = metros.map(m => ({
    cbsaCode: String(m.regionId),
    slug: generateSlug(m.name),
    name: m.name,
    shortName: getShortName(m.name),
    state: getState(m.name),
  }));

  // Check for duplicate slugs
  const slugs = new Set<string>();
  for (const e of entries) {
    if (slugs.has(e.slug)) {
      console.warn(`Duplicate slug: ${e.slug} (${e.name})`);
    }
    slugs.add(e.slug);
  }

  const output = `// Auto-generated by scripts/generate-metro-slugs.ts
// Do not edit manually. Re-run the script to update.

import type { MetroSlugEntry } from './metro-slugs';

export const METRO_SLUG_DATA: MetroSlugEntry[] = ${JSON.stringify(entries, null, 2)};

/** Map from slug → metro entry for O(1) lookup */
export const SLUG_TO_METRO = new Map<string, MetroSlugEntry>(
  METRO_SLUG_DATA.map(e => [e.slug, e])
);

/** Map from CBSA code → metro entry for O(1) lookup */
export const CBSA_TO_METRO = new Map<string, MetroSlugEntry>(
  METRO_SLUG_DATA.map(e => [e.cbsaCode, e])
);
`;

  const fs = await import('fs');
  fs.writeFileSync('packages/frontend/lib/data/metro-slug-data.ts', output);
  console.log(`Generated ${entries.length} metro slug entries.`);
}

main().catch(console.error);
```

**Step 2: Run the script**

Ensure the backend is running locally, then:
```bash
npx tsx scripts/generate-metro-slugs.ts
```

Expected: Creates `packages/frontend/lib/data/metro-slug-data.ts` with ~925 entries.

**Step 3: Export from data layer**

Add to `packages/frontend/lib/data/index.ts`:
```typescript
export { METRO_SLUG_DATA, SLUG_TO_METRO, CBSA_TO_METRO } from './metro-slug-data';
export { generateMetroSlug, getMetroShortName, getMetroState } from './metro-slugs';
export type { MetroSlugEntry } from './metro-slugs';
```

**Step 4: Commit**

```bash
git add scripts/generate-metro-slugs.ts packages/frontend/lib/data/metro-slug-data.ts packages/frontend/lib/data/index.ts
git commit -m "feat(seo): generate metro slug mapping data from backend API"
```

---

### Task 13: Create metro markets index page

**Files:**
- Create: `packages/frontend/app/markets/page.tsx`
- Create: `packages/frontend/app/markets/layout.tsx`

**Step 1: Create layout with metadata**

```typescript
// packages/frontend/app/markets/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Housing Markets - Browse 925+ US Metro Areas',
  description: 'Browse housing market data, scores, and analysis for 925+ US metro areas. Compare home values, trends, and AI-powered market scores by city and state.',
};

export default function MarketsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Step 2: Create index page**

The index page lists all metros grouped by state, with links to individual metro pages. Server-rendered, no `'use client'`.

```typescript
// packages/frontend/app/markets/page.tsx
import Link from 'next/link';
import { METRO_SLUG_DATA } from '@/lib/data/metro-slug-data';

// Group metros by state
function groupByState() {
  const groups: Record<string, typeof METRO_SLUG_DATA> = {};
  for (const metro of METRO_SLUG_DATA) {
    const state = metro.state || 'Other';
    if (!groups[state]) groups[state] = [];
    groups[state].push(metro);
  }
  // Sort states alphabetically
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export default function MarketsIndexPage() {
  const stateGroups = groupByState();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-on-surface mb-2">
        US Housing Markets
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        Browse AI-powered housing market analysis for {METRO_SLUG_DATA.length} US metro areas.
        Each market page includes PropertyIQ scores, key metrics, and price trends.
      </p>

      {stateGroups.map(([state, metros]) => (
        <section key={state} className="mb-8">
          <h2 className="text-xl font-semibold text-on-surface mb-3 border-b border-outline-variant pb-2">
            {state}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {metros.map(metro => (
              <Link
                key={metro.cbsaCode}
                href={`/markets/${metro.slug}`}
                className="px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors text-sm text-on-surface"
              >
                {metro.shortName}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

**Step 3: Verify**

Run: `cd packages/frontend && npm run dev`
Visit: `http://localhost:3000/markets`
Expected: Page shows all metros grouped by state with links.

**Step 4: Update sitemap**

Add to `app/sitemap.ts` in the static routes array:
```typescript
{ url: `${BASE_URL}/markets`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
```

**Step 5: Commit**

```bash
git add packages/frontend/app/markets/
git commit -m "feat(seo): add markets index page with all metros grouped by state"
```

---

### Task 14: Create metro detail page

**Files:**
- Create: `packages/frontend/app/markets/[slug]/page.tsx`
- Create: `packages/frontend/app/markets/[slug]/MetroPageContent.tsx` (client component for interactive parts)

**Step 1: Create the server component page with generateStaticParams + generateMetadata**

```typescript
// packages/frontend/app/markets/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { METRO_SLUG_DATA, SLUG_TO_METRO } from '@/lib/data/metro-slug-data';
import { fetchMarketSnapshot } from '@/lib/data';
import { MetroPageContent } from './MetroPageContent';

// Generate static paths for all metros
export function generateStaticParams() {
  return METRO_SLUG_DATA.map(metro => ({ slug: metro.slug }));
}

// Dynamic metadata per metro
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) return {};

  return {
    title: `${metro.shortName} Housing Market 2026 | Prices, Scores & Forecast`,
    description: `${metro.shortName} housing market analysis. AI-powered scores, median home prices, trends, and forecasts for the ${metro.name} metro area.`,
    openGraph: {
      title: `${metro.shortName} Housing Market Analysis | PropertyIQ`,
      description: `Explore AI-powered market intelligence for ${metro.shortName}. Scores, metrics, and trend data.`,
    },
  };
}

export const revalidate = 86400; // ISR: revalidate every 24 hours

export default async function MetroPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) notFound();

  // Fetch market data at build/request time (server-side)
  let snapshot = null;
  try {
    snapshot = await fetchMarketSnapshot('metro', metro.cbsaCode);
  } catch {
    // Data may not be available for all metros — page still renders
  }

  return (
    <MetroPageContent
      metro={metro}
      snapshot={snapshot}
    />
  );
}
```

**Step 2: Create the client component**

```typescript
// packages/frontend/app/markets/[slug]/MetroPageContent.tsx
'use client';

import Link from 'next/link';
import type { MetroSlugEntry } from '@/lib/data/metro-slugs';
import { formatMetricValue } from '@/lib/data';
import { ScoreWidget } from '@/app/components/scoring/ScoreWidget';

interface MetroPageContentProps {
  metro: MetroSlugEntry;
  snapshot: Record<string, unknown> | null;
}

export function MetroPageContent({ metro, snapshot }: MetroPageContentProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-on-surface-variant mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/markets" className="hover:text-primary">Markets</Link>
        <span className="mx-2">/</span>
        <span className="text-on-surface font-medium">{metro.shortName}</span>
      </nav>

      {/* H1 */}
      <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-3">
        {metro.shortName} Housing Market Analysis
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-2xl">
        AI-powered market intelligence for the {metro.name} metro area.
      </p>

      {/* Scores */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-on-surface mb-4">PropertyIQ Scores</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreWidget geographyType="metro" geographyId={metro.cbsaCode} scoreType="homeready" showConfidence />
          <ScoreWidget geographyType="metro" geographyId={metro.cbsaCode} scoreType="investoredge" showConfidence />
          <ScoreWidget geographyType="metro" geographyId={metro.cbsaCode} scoreType="market_health" showConfidence />
        </div>
      </section>

      {/* CTAs */}
      <section className="flex flex-wrap gap-4 mb-10">
        <Link
          href={`/map?geo=metro&region=${metro.cbsaCode}`}
          className="px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors"
        >
          View on Interactive Map
        </Link>
        <Link
          href={`/market/${metro.cbsaCode}?type=metro`}
          className="px-6 py-3 bg-surface-container-low text-on-surface rounded-full font-medium border border-outline hover:bg-surface-container-high transition-colors"
        >
          Full Market Dashboard
        </Link>
      </section>

      {/* JSON-LD for this metro */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Place',
            name: metro.name,
            url: `https://www.propertyiq.app/markets/${metro.slug}`,
            containedInPlace: {
              '@type': 'Country',
              name: 'United States',
            },
          }),
        }}
      />
    </div>
  );
}
```

Note: This is a starting template. The implementer should expand it with actual metric data from the `snapshot` prop — displaying median home price, rent, inventory, etc. The exact fields depend on what `fetchMarketSnapshot` returns. Check `packages/frontend/lib/data/fetchers/` for the response shape.

**Step 3: Update sitemap to include metro pages**

In `app/sitemap.ts`, add after the static routes:

```typescript
import { METRO_SLUG_DATA } from '@/lib/data/metro-slug-data';

// ...inside the function:
const metroRoutes: MetadataRoute.Sitemap = METRO_SLUG_DATA.map(metro => ({
  url: `${BASE_URL}/markets/${metro.slug}`,
  lastModified: now,
  changeFrequency: 'weekly' as const,
  priority: 0.7,
}));

return [...staticRoutes, ...metroRoutes];
```

**Step 4: Verify**

Run: `cd packages/frontend && npm run dev`
Visit: `http://localhost:3000/markets/austin-round-rock-georgetown-tx` (or whatever slug Austin gets)
Expected: Page renders with H1 "Austin, TX Housing Market Analysis", breadcrumbs, and score widgets.

**Step 5: Commit**

```bash
git add packages/frontend/app/markets/[slug]/ packages/frontend/app/sitemap.ts
git commit -m "feat(seo): add programmatic metro detail pages with ISR and JSON-LD"
```

---

### Task 15: Add internal linking between metro pages

**Files:**
- Modify: `packages/frontend/app/markets/[slug]/MetroPageContent.tsx` — add nearby metros section
- Modify: `packages/frontend/app/page.tsx` — add "Top Markets" section to homepage

**Step 1: Add nearby metros to metro detail page**

Add a "Nearby Markets" section at the bottom of `MetroPageContent.tsx` that links to 5 metros in the same state:

```typescript
import { METRO_SLUG_DATA } from '@/lib/data/metro-slug-data';

// Inside the component, after the CTAs section:
const nearbyMetros = METRO_SLUG_DATA
  .filter(m => m.state === metro.state && m.cbsaCode !== metro.cbsaCode)
  .slice(0, 5);

// Render:
{nearbyMetros.length > 0 && (
  <section className="mt-10 pt-8 border-t border-outline-variant">
    <h2 className="text-xl font-semibold text-on-surface mb-4">
      More Markets in {metro.state}
    </h2>
    <div className="flex flex-wrap gap-2">
      {nearbyMetros.map(m => (
        <Link
          key={m.cbsaCode}
          href={`/markets/${m.slug}`}
          className="px-4 py-2 rounded-full bg-surface-container-low text-on-surface text-sm hover:bg-surface-container-high transition-colors"
        >
          {m.shortName}
        </Link>
      ))}
    </div>
  </section>
)}
```

**Step 2: Add "Top Markets" to homepage**

Add a section to the homepage that links to 12-15 popular metros. Create a new component or add directly to `app/page.tsx`:

```typescript
// In app/page.tsx, add between existing sections
import Link from 'next/link';

// Featured metros (manually curated for maximum SEO value)
const FEATURED_METROS = [
  { slug: 'new-york-newark-jersey-city-ny-nj-pa', name: 'New York, NY' },
  { slug: 'los-angeles-long-beach-anaheim-ca', name: 'Los Angeles, CA' },
  { slug: 'chicago-naperville-elgin-il-in-wi', name: 'Chicago, IL' },
  // ... add 10-12 more major metros
];
```

**Step 3: Commit**

```bash
git add packages/frontend/app/markets/[slug]/MetroPageContent.tsx packages/frontend/app/page.tsx
git commit -m "feat(seo): add internal linking between metro pages and homepage"
```

---

## Phase 3: Blog Infrastructure + AI Drafting

### Task 16: Install blog dependencies

**Files:**
- Modify: `packages/frontend/package.json`

**Step 1: Install packages**

```bash
cd packages/frontend && npm install next-mdx-remote gray-matter reading-time
```

- `next-mdx-remote` — compile MDX strings to React on the server, render on client (no next.config changes needed)
- `gray-matter` — parse YAML frontmatter from MDX files
- `reading-time` — calculate reading time for blog posts

**Step 2: Create MDX type declaration**

Create `packages/frontend/types/mdx.d.ts`:
```typescript
declare module '*.mdx' {
  const MDXContent: (props: Record<string, unknown>) => JSX.Element;
  export default MDXContent;
}
```

**Step 3: Commit**

```bash
git add packages/frontend/package.json packages/frontend/package-lock.json packages/frontend/types/mdx.d.ts
git commit -m "feat(blog): install next-mdx-remote, gray-matter, and reading-time"
```

---

### Task 17: Create blog infrastructure

**Files:**
- Create: `packages/frontend/content/blog/` directory
- Create: `packages/frontend/content/blog/drafts/` directory
- Create: `packages/frontend/content/blog/keyword-tracker.md`
- Create: `packages/frontend/lib/blog/index.ts` — blog utilities (read posts, parse frontmatter)
- Create: `packages/frontend/lib/blog/types.ts` — blog types

**Step 1: Create blog types**

```typescript
// packages/frontend/lib/blog/types.ts
export interface BlogPostFrontmatter {
  title: string;
  description: string;
  date: string;          // ISO date: "2026-02-25"
  author: string;
  category: BlogCategory;
  tags: string[];
  targetKeyword: string;
  image?: string;        // Hero image path
}

export type BlogCategory = 'market-analysis' | 'investment' | 'methodology' | 'news';

export interface BlogPost {
  slug: string;
  frontmatter: BlogPostFrontmatter;
  content: string;       // Raw MDX content (without frontmatter)
  readingTime: string;   // e.g., "5 min read"
}
```

**Step 2: Create blog utilities**

```typescript
// packages/frontend/lib/blog/index.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import readingTime from 'reading-time';
import type { BlogPost, BlogPostFrontmatter } from './types';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.mdx'));

  return files
    .map(filename => {
      const slug = filename.replace(/\.mdx$/, '');
      const filePath = path.join(BLOG_DIR, filename);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(fileContent);

      return {
        slug,
        frontmatter: data as BlogPostFrontmatter,
        content,
        readingTime: readingTime(content).text,
      };
    })
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  return {
    slug,
    frontmatter: data as BlogPostFrontmatter,
    content,
    readingTime: readingTime(content).text,
  };
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''));
}

export { type BlogPost, type BlogPostFrontmatter, type BlogCategory } from './types';
```

**Step 3: Create keyword tracker**

```markdown
<!-- packages/frontend/content/blog/keyword-tracker.md -->
# Blog Keyword Tracker

| Keyword | Post Slug | Date | Status |
|---------|-----------|------|--------|
```

**Step 4: Create directories**

```bash
mkdir -p packages/frontend/content/blog/drafts
```

**Step 5: Commit**

```bash
git add packages/frontend/lib/blog/ packages/frontend/content/blog/
git commit -m "feat(blog): add blog infrastructure - types, utilities, and content directories"
```

---

### Task 18: Create blog index page

**Files:**
- Create: `packages/frontend/app/blog/page.tsx`
- Create: `packages/frontend/app/blog/layout.tsx`

**Step 1: Create layout with metadata**

```typescript
// packages/frontend/app/blog/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog - Housing Market Insights & Analysis',
  description: 'Data-driven housing market analysis, forecasts, and investment insights powered by PropertyIQ AI. Updated weekly with the latest market trends.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {children}
    </div>
  );
}
```

**Step 2: Create blog index page**

```typescript
// packages/frontend/app/blog/page.tsx
import Link from 'next/link';
import { getAllPosts } from '@/lib/blog';

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <>
      <h1 className="text-3xl font-bold text-on-surface mb-2">PropertyIQ Blog</h1>
      <p className="text-on-surface-variant mb-8">
        Data-driven housing market analysis, forecasts, and investment insights.
      </p>

      {posts.length === 0 ? (
        <p className="text-on-surface-variant">Coming soon — check back for our first posts.</p>
      ) : (
        <div className="space-y-8">
          {posts.map(post => (
            <article key={post.slug} className="border-b border-outline-variant pb-8">
              <Link href={`/blog/${post.slug}`} className="group">
                <h2 className="text-xl font-semibold text-on-surface group-hover:text-primary transition-colors mb-2">
                  {post.frontmatter.title}
                </h2>
              </Link>
              <div className="flex items-center gap-3 text-sm text-on-surface-variant mb-3">
                <time dateTime={post.frontmatter.date}>
                  {new Date(post.frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </time>
                <span>·</span>
                <span>{post.readingTime}</span>
                <span>·</span>
                <span className="capitalize">{post.frontmatter.category.replace('-', ' ')}</span>
              </div>
              <p className="text-on-surface-variant">{post.frontmatter.description}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
```

**Step 3: Update sitemap**

Add to `app/sitemap.ts`:
```typescript
import { getAllPosts } from '@/lib/blog';

// Inside the function:
const blogRoutes: MetadataRoute.Sitemap = getAllPosts().map(post => ({
  url: `${BASE_URL}/blog/${post.slug}`,
  lastModified: new Date(post.frontmatter.date).toISOString(),
  changeFrequency: 'monthly' as const,
  priority: 0.6,
}));

return [...staticRoutes, ...metroRoutes, ...blogRoutes];
```

**Step 4: Commit**

```bash
git add packages/frontend/app/blog/ packages/frontend/app/sitemap.ts
git commit -m "feat(blog): add blog index page with post listing"
```

---

### Task 19: Create blog post page

**Files:**
- Create: `packages/frontend/app/blog/[slug]/page.tsx`
- Create: `packages/frontend/app/blog/[slug]/BlogPostContent.tsx` (MDX renderer)
- Create: `packages/frontend/app/blog/[slug]/mdx-components.tsx` (custom MDX components)

**Step 1: Create the server component page**

```typescript
// packages/frontend/app/blog/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllSlugs, getPostBySlug } from '@/lib/blog';
import { BlogPostContent } from './BlogPostContent';

export function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    openGraph: {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      type: 'article',
      publishedTime: post.frontmatter.date,
      authors: [post.frontmatter.author],
      ...(post.frontmatter.image && { images: [post.frontmatter.image] }),
    },
  };
}

export default async function BlogPostPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      {/* Article JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.frontmatter.title,
            description: post.frontmatter.description,
            datePublished: post.frontmatter.date,
            author: { '@type': 'Organization', name: post.frontmatter.author },
            publisher: {
              '@type': 'Organization',
              name: 'PropertyIQ',
              url: 'https://www.propertyiq.app',
            },
            mainEntityOfPage: `https://www.propertyiq.app/blog/${slug}`,
          }),
        }}
      />
      <BlogPostContent post={post} />
    </>
  );
}
```

**Step 2: Create the MDX renderer**

```typescript
// packages/frontend/app/blog/[slug]/BlogPostContent.tsx
'use client';

import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';
import type { BlogPost } from '@/lib/blog/types';
import { mdxComponents } from './mdx-components';

export function BlogPostContent({ post }: { post: BlogPost }) {
  return (
    <article>
      {/* Breadcrumb */}
      <nav className="text-sm text-on-surface-variant mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/blog" className="hover:text-primary">Blog</Link>
        <span className="mx-2">/</span>
        <span className="text-on-surface font-medium">{post.frontmatter.title}</span>
      </nav>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 leading-tight">
          {post.frontmatter.title}
        </h1>
        <div className="flex items-center gap-3 text-sm text-on-surface-variant">
          <time dateTime={post.frontmatter.date}>
            {new Date(post.frontmatter.date).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </time>
          <span>·</span>
          <span>{post.readingTime}</span>
          <span>·</span>
          <span>{post.frontmatter.author}</span>
        </div>
      </header>

      {/* MDX Content */}
      <div className="prose prose-lg max-w-none">
        <MDXRemote source={post.content} components={mdxComponents} />
      </div>

      {/* Tags */}
      {post.frontmatter.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-outline-variant">
          {post.frontmatter.tags.map(tag => (
            <span key={tag} className="px-3 py-1 bg-surface-container-low text-on-surface-variant text-sm rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
```

**Step 3: Create custom MDX components**

```typescript
// packages/frontend/app/blog/[slug]/mdx-components.tsx
import type { MDXComponents } from 'mdx/types';

// These are the default styled components for MDX content.
// Can be extended with interactive widgets (ScoreWidget, charts, etc.)
export const mdxComponents: MDXComponents = {
  h1: (props) => <h1 className="text-3xl font-bold text-on-surface mt-8 mb-4" {...props} />,
  h2: (props) => <h2 className="text-2xl font-semibold text-on-surface mt-8 mb-3" {...props} />,
  h3: (props) => <h3 className="text-xl font-medium text-on-surface mt-6 mb-2" {...props} />,
  p: (props) => <p className="text-on-surface-variant leading-relaxed mb-4" {...props} />,
  a: (props) => <a className="text-primary hover:text-primary/80 underline" {...props} />,
  ul: (props) => <ul className="list-disc pl-6 mb-4 space-y-1 text-on-surface-variant" {...props} />,
  ol: (props) => <ol className="list-decimal pl-6 mb-4 space-y-1 text-on-surface-variant" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-l-4 border-primary pl-4 italic text-on-surface-variant my-4" {...props} />
  ),
  table: (props) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse" {...props} />
    </div>
  ),
  th: (props) => <th className="bg-surface-container-low px-4 py-2 text-left font-semibold border-b border-outline-variant" {...props} />,
  td: (props) => <td className="px-4 py-2 border-b border-outline-variant" {...props} />,
  code: (props) => <code className="bg-surface-container-low px-1.5 py-0.5 rounded text-sm font-mono" {...props} />,
  pre: (props) => <pre className="bg-surface-container-low p-4 rounded-xl overflow-x-auto my-4 text-sm" {...props} />,
};
```

**Step 4: Verify with a test post**

Create a minimal test post at `content/blog/test-post.mdx`:
```markdown
---
title: "Test Blog Post"
description: "Testing the blog infrastructure"
date: "2026-02-25"
author: "PropertyIQ Research"
category: "market-analysis"
tags: ["test"]
targetKeyword: "test"
---

## This is a test

Hello world. This is a test blog post to verify the MDX rendering pipeline.
```

Run: `cd packages/frontend && npm run dev`
Visit: `http://localhost:3000/blog/test-post`
Expected: Post renders with title, date, reading time, and styled content.

Delete the test post after verification.

**Step 5: Commit**

```bash
git add packages/frontend/app/blog/[slug]/
git commit -m "feat(blog): add blog post page with MDX rendering and Article schema"
```

---

### Task 20: Create RSS feed

**Files:**
- Create: `packages/frontend/app/blog/rss.xml/route.ts`

**Step 1: Create RSS route handler**

```typescript
// packages/frontend/app/blog/rss.xml/route.ts
import { getAllPosts } from '@/lib/blog';

const BASE_URL = 'https://www.propertyiq.app';

export async function GET() {
  const posts = getAllPosts();

  const rssItems = posts.map(post => `
    <item>
      <title><![CDATA[${post.frontmatter.title}]]></title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <description><![CDATA[${post.frontmatter.description}]]></description>
      <pubDate>${new Date(post.frontmatter.date).toUTCString()}</pubDate>
      <guid>${BASE_URL}/blog/${post.slug}</guid>
      <category>${post.frontmatter.category}</category>
    </item>`).join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PropertyIQ Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Data-driven housing market analysis, forecasts, and investment insights.</description>
    <language>en-us</language>
    <atom:link href="${BASE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

**Step 2: Verify**

Run: `cd packages/frontend && npm run dev`
Visit: `http://localhost:3000/blog/rss.xml`
Expected: Valid RSS XML output.

**Step 3: Commit**

```bash
git add packages/frontend/app/blog/rss.xml/
git commit -m "feat(blog): add RSS feed for blog posts"
```

---

### Task 21: Write seed blog content (4 posts)

**Files:**
- Create: `packages/frontend/content/blog/housing-market-forecast-2026.mdx`
- Create: `packages/frontend/content/blog/best-cities-to-buy-2026.mdx`
- Create: `packages/frontend/content/blog/propertyiq-methodology.mdx`
- Create: `packages/frontend/content/blog/is-it-a-good-time-to-buy.mdx`
- Update: `packages/frontend/content/blog/keyword-tracker.md`

**Step 1: Write posts**

Each post should:
- Have proper frontmatter with `targetKeyword`
- Be 800-1500 words of substantive, keyword-rich content
- Include internal links to `/markets/[slug]` pages, `/map`, `/scores`
- Use H2/H3 headings with target keywords worked in naturally
- End with a CTA to sign up / explore the platform

The implementer should use the `suggest-blog-posts` skill (Task 22) or write the content manually. Focus on:

1. **housing-market-forecast-2026.mdx** — Target: "housing market forecast 2026". Cover national trends, top metros, AI predictions, link to specific market pages.
2. **best-cities-to-buy-2026.mdx** — Target: "best real estate markets to invest in 2026". Rank top 10-15 metros by PropertyIQ scores, link to each metro page.
3. **propertyiq-methodology.mdx** — Target: "AI real estate analytics". Explain how the scoring works, data sources, ML approach.
4. **is-it-a-good-time-to-buy.mdx** — Target: "is it a good time to buy a house". Answer the question with data, link to market pages.

**Step 2: Update keyword tracker**

```markdown
| housing market forecast 2026 | housing-market-forecast-2026 | 2026-02-25 | Published |
| best real estate markets to invest in 2026 | best-cities-to-buy-2026 | 2026-02-25 | Published |
| AI real estate analytics | propertyiq-methodology | 2026-02-25 | Published |
| is it a good time to buy a house | is-it-a-good-time-to-buy | 2026-02-25 | Published |
```

**Step 3: Commit**

```bash
git add packages/frontend/content/blog/
git commit -m "feat(blog): add 4 seed blog posts targeting high-value keywords"
```

---

### Task 22: Create blog drafting skill

**Files:**
- Create: `.claude/skills/suggest-blog-posts.md`

**Step 1: Write the skill**

```markdown
---
name: suggest-blog-posts
description: Suggest and draft SEO-optimized blog posts for PropertyIQ
---

# Blog Post Suggestion & Drafting

## Suggest Mode

When the user asks to suggest blog posts:

1. Read `packages/frontend/content/blog/keyword-tracker.md` to see covered keywords
2. Review the keyword opportunity table from the SEO audit (in `docs/plans/2026-02-25-full-seo-overhaul-design.md`)
3. Check what metro pages exist for cross-linking opportunities
4. Propose 3-5 post ideas with:
   - Title
   - Target keyword
   - Content outline (5-7 bullet points)
   - Why this keyword matters (search volume, competition)
   - Which metro pages to link to

## Draft Mode

When the user approves a post idea:

1. Write a complete MDX file with frontmatter
2. Save to `packages/frontend/content/blog/drafts/[slug].mdx`
3. Include:
   - Proper frontmatter (title, description, date, author, category, tags, targetKeyword)
   - 800-1500 words of substantive content
   - H2/H3 headings with keywords worked in naturally
   - Internal links to `/markets/[slug]` pages
   - Links to `/map`, `/scores`, `/data` features
   - CTA section at the end
4. Show the user a preview of the frontmatter and outline

## Publish Mode

When the user approves a draft:

1. Move from `content/blog/drafts/[slug].mdx` to `content/blog/[slug].mdx`
2. Update `content/blog/keyword-tracker.md` with the new entry
3. Commit the changes

## Content Guidelines

- Write for real estate investors, homebuyers, and agents
- Use PropertyIQ data and scores as evidence
- Avoid fluff — every paragraph should provide value
- Front-load the primary keyword in the title and first paragraph
- Use the target keyword naturally 3-5 times in the body
- Include at least 3 internal links to PropertyIQ pages
- End with a clear CTA
```

**Step 2: Commit**

```bash
git add .claude/skills/suggest-blog-posts.md
git commit -m "feat(blog): add suggest-blog-posts Claude Code skill for content creation"
```

---

## Phase 4: Comparison Pages + Newsletter

### Task 23: Create comparison page template

**Files:**
- Create: `packages/frontend/app/compare/[slug]/page.tsx`
- Create: `packages/frontend/app/compare/layout.tsx`
- Create: `packages/frontend/lib/data/comparisons.ts` — comparison data

**Step 1: Create comparison data**

```typescript
// packages/frontend/lib/data/comparisons.ts
export interface ComparisonData {
  slug: string;
  competitor: string;
  competitorUrl: string;
  title: string;
  description: string;
  features: {
    feature: string;
    propertyiq: string;
    competitor: string;
    winner: 'propertyiq' | 'competitor' | 'tie';
  }[];
  pricing: {
    tier: string;
    propertyiq: string;
    competitor: string;
  }[];
  summary: string;
}

export const COMPARISONS: ComparisonData[] = [
  {
    slug: 'propertyiq-vs-reventure',
    competitor: 'Reventure App',
    competitorUrl: 'https://www.reventure.app',
    title: 'PropertyIQ vs Reventure App',
    description: 'Compare PropertyIQ and Reventure App for housing market analysis...',
    features: [
      { feature: 'Metro Coverage', propertyiq: '925 metros', competitor: '~500 metros', winner: 'propertyiq' },
      { feature: 'ZIP Code Data', propertyiq: '33,000+ ZIPs', competitor: '30,000+ ZIPs', winner: 'propertyiq' },
      { feature: 'AI Market Reports', propertyiq: 'Yes', competitor: 'No', winner: 'propertyiq' },
      { feature: 'YouTube Community', propertyiq: 'No', competitor: '1M+ followers', winner: 'competitor' },
      { feature: 'Mobile App', propertyiq: 'Web only', competitor: 'iOS + Android', winner: 'competitor' },
      { feature: 'Market Scoring', propertyiq: '3 proprietary scores', competitor: 'Forecast Score', winner: 'propertyiq' },
    ],
    pricing: [
      { tier: 'Free', propertyiq: '$0/mo', competitor: '$0/mo' },
      { tier: 'Pro', propertyiq: '$29/mo', competitor: '$49/mo' },
    ],
    summary: 'PropertyIQ offers broader geographic coverage and AI-generated reports...',
  },
  // Add mashvisor and neighborhoodscout comparisons similarly
];

export function getComparison(slug: string): ComparisonData | undefined {
  return COMPARISONS.find(c => c.slug === slug);
}
```

**Step 2: Create layout**

```typescript
// packages/frontend/app/compare/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare PropertyIQ',
  description: 'See how PropertyIQ compares to other real estate analytics platforms.',
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Step 3: Create comparison page**

```typescript
// packages/frontend/app/compare/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { COMPARISONS, getComparison } from '@/lib/data/comparisons';

export function generateStaticParams() {
  return COMPARISONS.map(c => ({ slug: c.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const comp = getComparison(slug);
  if (!comp) return {};
  return {
    title: `${comp.title}: Which Housing Market Tool Is Better?`,
    description: comp.description,
  };
}

export default async function ComparisonPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const comp = getComparison(slug);
  if (!comp) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <nav className="text-sm text-on-surface-variant mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/compare" className="hover:text-primary">Compare</Link>
        <span className="mx-2">/</span>
        <span className="text-on-surface font-medium">{comp.title}</span>
      </nav>

      <h1 className="text-3xl font-bold text-on-surface mb-4">{comp.title}</h1>
      <p className="text-on-surface-variant mb-8">{comp.description}</p>

      {/* Feature comparison table */}
      <h2 className="text-xl font-semibold text-on-surface mb-4">Feature Comparison</h2>
      <div className="overflow-x-auto mb-8">
        <table className="min-w-full">
          <thead>
            <tr className="border-b-2 border-outline-variant">
              <th className="text-left px-4 py-3 font-semibold">Feature</th>
              <th className="text-left px-4 py-3 font-semibold text-primary">PropertyIQ</th>
              <th className="text-left px-4 py-3 font-semibold">{comp.competitor}</th>
            </tr>
          </thead>
          <tbody>
            {comp.features.map(f => (
              <tr key={f.feature} className="border-b border-outline-variant">
                <td className="px-4 py-3 font-medium">{f.feature}</td>
                <td className={`px-4 py-3 ${f.winner === 'propertyiq' ? 'text-green-600 font-semibold' : ''}`}>
                  {f.propertyiq}
                </td>
                <td className={`px-4 py-3 ${f.winner === 'competitor' ? 'text-green-600 font-semibold' : ''}`}>
                  {f.competitor}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CTA */}
      <div className="bg-primary-container/30 rounded-xl p-6 text-center">
        <h2 className="text-xl font-semibold text-on-surface mb-2">Try PropertyIQ Free</h2>
        <p className="text-on-surface-variant mb-4">Explore AI-powered market intelligence with no credit card required.</p>
        <Link href="/pricing" className="px-6 py-3 bg-primary text-on-primary rounded-full font-medium hover:bg-primary/90 transition-colors inline-block">
          Get Started Free
        </Link>
      </div>
    </div>
  );
}
```

**Step 4: Add to sitemap**

In `app/sitemap.ts`, add:
```typescript
import { COMPARISONS } from '@/lib/data/comparisons';

const comparisonRoutes: MetadataRoute.Sitemap = COMPARISONS.map(c => ({
  url: `${BASE_URL}/compare/${c.slug}`,
  lastModified: now,
  changeFrequency: 'monthly' as const,
  priority: 0.6,
}));
```

**Step 5: Commit**

```bash
git add packages/frontend/app/compare/ packages/frontend/lib/data/comparisons.ts packages/frontend/app/sitemap.ts
git commit -m "feat(seo): add competitor comparison pages with feature tables"
```

---

### Task 24: Create newsletter signup component + API

**Files:**
- Create: `packages/frontend/components/newsletter/NewsletterSignup.tsx`
- Create: `packages/frontend/app/api/newsletter/route.ts`

**Step 1: Create the component**

```typescript
// packages/frontend/components/newsletter/NewsletterSignup.tsx
'use client';

import { useState } from 'react';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="bg-surface-container-low rounded-xl p-6 my-8">
      <h3 className="text-lg font-semibold text-on-surface mb-2">
        Weekly Market Insights
      </h3>
      <p className="text-sm text-on-surface-variant mb-4">
        Get data-driven housing market analysis delivered to your inbox every week.
      </p>

      {status === 'success' ? (
        <p className="text-green-600 font-medium">Thanks! You're subscribed.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="flex-1 px-4 py-2 rounded-full bg-surface border border-outline text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="px-6 py-2 bg-primary text-on-primary rounded-full font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>
      )}
      {status === 'error' && (
        <p className="text-red-600 text-sm mt-2">Something went wrong. Please try again.</p>
      )}
    </section>
  );
}
```

**Step 2: Create the API route**

```typescript
// packages/frontend/app/api/newsletter/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { error } = await supabase
    .from('newsletter_signups')
    .upsert({ email: email.toLowerCase() }, { onConflict: 'email' });

  if (error) {
    console.error('Newsletter signup error:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

**Step 3: Create Supabase migration**

Use the Supabase MCP to create the newsletter_signups table:

```sql
CREATE TABLE IF NOT EXISTS newsletter_signups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  source text DEFAULT 'website'
);

-- RLS: Only service role can insert (via API route)
ALTER TABLE newsletter_signups ENABLE ROW LEVEL SECURITY;
```

**Step 4: Place the component**

Add `<NewsletterSignup />` to:
- `app/blog/[slug]/BlogPostContent.tsx` — after the article content
- `app/markets/[slug]/MetroPageContent.tsx` — after the CTAs section

**Step 5: Commit**

```bash
git add packages/frontend/components/newsletter/ packages/frontend/app/api/newsletter/
git commit -m "feat(seo): add newsletter signup component with Supabase backend"
```

---

### Task 25: Final sitemap update and verification

**Files:**
- Modify: `packages/frontend/app/sitemap.ts` — ensure all routes are included

**Step 1: Final sitemap assembly**

Ensure the sitemap includes:
- All static pages (Task 5)
- All 925 metro pages (Task 14)
- All blog posts (Task 18)
- All comparison pages (Task 23)
- The blog index, markets index

**Step 2: Build and verify**

Run: `cd packages/frontend && npx next build`
Expected: Build succeeds.

Then verify the sitemap output:
Run: `cd packages/frontend && npm run dev`
Visit: `http://localhost:3000/sitemap.xml`
Expected: Valid XML with all pages listed.

Also verify:
- `http://localhost:3000/robots.txt` — serves correctly
- Homepage — correct title tag, no `propertyiq.com` in source
- Blog index — lists posts
- Metro page — renders with scores
- Comparison page — renders with table

**Step 3: Commit final changes**

```bash
git add -A
git commit -m "feat(seo): finalize sitemap with all routes and verify build"
```

---

## Post-Implementation Checklist

After deployment:
1. **Google Search Console:** User must set up GSC, verify domain, submit sitemap URL
2. **GA4 Property:** User must create GA4 property, add measurement ID to Railway env vars
3. **Request Indexing:** In GSC, request indexing of homepage, markets index, and blog index
4. **OG Image Test:** Test social sharing previews on Twitter/LinkedIn
5. **Rich Results Test:** Validate JSON-LD with Google's Rich Results Test tool
6. **Monitor:** Check GSC for crawl errors, indexing status over the next 2 weeks
