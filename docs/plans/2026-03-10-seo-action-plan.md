# SEO Action Plan Implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all 30 items from the SEO audit action plan to bring the site from 36/100 to 80+/100.

**Architecture:** Fix canonical URLs site-wide (root cause: global canonical in layout.tsx), add per-page metadata/OG/canonical to all routes, add JSON-LD structured data, security headers, and AI search readiness files. Client component pages use their layout.tsx for metadata.

**Tech Stack:** Next.js 16 App Router metadata API, JSON-LD via script tags, next.config.mjs headers

---

## Task 1: Fix Root Layout Canonical (HIGHEST IMPACT)

**Files:**

- Modify: `packages/frontend/app/layout.tsx:111-113`

**Step 1:** Remove the global canonical from root layout. This is the root cause of every page's canonical pointing to the homepage.

Change line 111-113 from:

```typescript
  alternates: {
    canonical: "https://www.propertyiq.app",
  },
```

to:

```typescript
// Canonical URLs are set per-page in each route's metadata/layout.
// Do NOT set a global canonical here — it overrides all child routes.
```

**Step 2:** Verify the build still works:

```bash
cd packages/frontend && npx next build 2>&1 | head -30
```

---

## Task 2: Add Canonical URLs to All Layout Files

**Files:**

- Modify: `packages/frontend/app/map/layout.tsx`
- Modify: `packages/frontend/app/pricing/layout.tsx`
- Modify: `packages/frontend/app/graphs/layout.tsx`
- Modify: `packages/frontend/app/scores/layout.tsx`
- Modify: `packages/frontend/app/data/layout.tsx`
- Modify: `packages/frontend/app/blog/layout.tsx`
- Modify: `packages/frontend/app/compare/layout.tsx`
- Modify: `packages/frontend/app/markets/layout.tsx`
- Create: `packages/frontend/app/reports/layout.tsx`

**Step 1:** Add `alternates.canonical` to each layout's metadata. Also add openGraph and fix title lengths where needed.

**map/layout.tsx** — replace metadata:

```typescript
export const metadata: Metadata = {
  title: "Interactive Housing Market Map",
  description:
    "Explore the interactive housing market heat map. Visualize home values, rent prices, inventory, and 40+ metrics across 925 US metros and 33,000+ ZIP codes.",
  alternates: { canonical: "https://www.propertyiq.app/map" },
  openGraph: {
    title: "Interactive Housing Market Map | PropertyIQ",
    description:
      "Visualize home values, rent prices, inventory, and 40+ metrics across 925 US metros and 33,000+ ZIP codes.",
    url: "https://www.propertyiq.app/map",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Interactive Housing Map",
      },
    ],
  },
};
```

**pricing/layout.tsx** — replace metadata (fix title to ≤60 chars):

```typescript
export const metadata: Metadata = {
  title: "Pricing & Plans",
  description:
    "Compare PropertyIQ plans: Free, Pro, and Enterprise. AI-powered market analysis, scores, reports, and maps for real estate professionals.",
  alternates: { canonical: "https://www.propertyiq.app/pricing" },
  openGraph: {
    title: "Pricing & Plans | PropertyIQ",
    description:
      "Compare PropertyIQ plans: Free, Pro, and Enterprise. AI-powered market analysis, scores, reports, and maps.",
    url: "https://www.propertyiq.app/pricing",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Pricing Plans",
      },
    ],
  },
};
```

**graphs/layout.tsx** — replace metadata:

```typescript
export const metadata: Metadata = {
  title: "Housing Market Graphs & Trends",
  description:
    "Interactive charts and graphs showing housing market trends, price history, inventory levels, and economic indicators across US metros.",
  alternates: { canonical: "https://www.propertyiq.app/graphs" },
  openGraph: {
    title: "Housing Market Graphs & Trends | PropertyIQ",
    description:
      "Interactive charts showing housing market trends, price history, inventory levels, and economic indicators.",
    url: "https://www.propertyiq.app/graphs",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Market Graphs",
      },
    ],
  },
};
```

**scores/layout.tsx** — replace metadata:

```typescript
export const metadata: Metadata = {
  title: "PropertyIQ Scores",
  description:
    "AI-powered scores that predict real estate market performance, validated across 23,000+ locations and 924 metros.",
  alternates: { canonical: "https://www.propertyiq.app/scores" },
  openGraph: {
    title: "PropertyIQ Scores | AI Market Predictions",
    description:
      "AI-powered scores predicting real estate market performance, validated across 23,000+ locations.",
    url: "https://www.propertyiq.app/scores",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Scores",
      },
    ],
  },
};
```

**data/layout.tsx** — replace metadata:

```typescript
export const metadata: Metadata = {
  title: "Data Sources",
  description:
    "Learn about the data sources powering PropertyIQ: Zillow, Realtor.com, Redfin, U.S. Census Bureau, FRED, BLS, and BEA. 90+ metrics updated monthly.",
  alternates: { canonical: "https://www.propertyiq.app/data" },
  openGraph: {
    title: "Data Sources | PropertyIQ",
    description:
      "PropertyIQ aggregates data from Zillow, Realtor.com, Redfin, Census, FRED, BLS, and BEA. 90+ metrics.",
    url: "https://www.propertyiq.app/data",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Data Sources",
      },
    ],
  },
};
```

**blog/layout.tsx** — replace metadata:

```typescript
export const metadata: Metadata = {
  title: "Blog - Housing Market Insights & Analysis",
  description:
    "Data-driven housing market analysis, investment insights, and AI-powered forecasts from the PropertyIQ research team. Updated weekly.",
  alternates: { canonical: "https://www.propertyiq.app/blog" },
  openGraph: {
    title: "PropertyIQ Blog | Housing Market Insights",
    description:
      "Data-driven housing market analysis, investment insights, and AI-powered forecasts from PropertyIQ.",
    url: "https://www.propertyiq.app/blog",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Blog",
      },
    ],
  },
};
```

**compare/layout.tsx** — replace metadata:

```typescript
export const metadata: Metadata = {
  title: "Compare PropertyIQ",
  description:
    "See how PropertyIQ compares to other real estate analytics platforms like Mashvisor, NeighborhoodScout, and Reventure.",
  alternates: { canonical: "https://www.propertyiq.app/compare" },
  openGraph: {
    title: "Compare PropertyIQ | Platform Comparisons",
    description:
      "See how PropertyIQ compares to Mashvisor, NeighborhoodScout, Reventure, and other real estate analytics platforms.",
    url: "https://www.propertyiq.app/compare",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Compare PropertyIQ",
      },
    ],
  },
};
```

**markets/layout.tsx** — replace metadata:

```typescript
export const metadata: Metadata = {
  title: "Housing Markets - Browse 925+ US Metro Areas",
  description:
    "Browse AI-powered housing market analysis for 925+ US metro areas. PropertyIQ scores, median home prices, rental demand, trends, and forecasts.",
  alternates: { canonical: "https://www.propertyiq.app/markets" },
};
```

**Create reports/layout.tsx:**

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market Reports",
  description:
    "AI-generated real estate market reports with data-driven analysis, scores, and forecasts for any US metro area.",
  alternates: { canonical: "https://www.propertyiq.app/reports" },
  openGraph: {
    title: "Market Reports | PropertyIQ",
    description:
      "AI-generated real estate market reports with data-driven analysis, scores, and forecasts.",
    url: "https://www.propertyiq.app/reports",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ Market Reports",
      },
    ],
  },
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

---

## Task 3: Add Canonical URLs to Page-Level Metadata

**Files:**

- Modify: `packages/frontend/app/page.tsx` (homepage)
- Modify: `packages/frontend/app/about/page.tsx`
- Modify: `packages/frontend/app/contact/page.tsx`
- Modify: `packages/frontend/app/about/terms/page.tsx`
- Modify: `packages/frontend/app/scores/accuracy/page.tsx`
- Modify: `packages/frontend/app/scores/methodology/page.tsx`
- Modify: `packages/frontend/app/blog/[slug]/page.tsx`
- Modify: `packages/frontend/app/compare/[slug]/page.tsx`

**Step 1:** Add canonical + OG to each page's metadata.

**Homepage (page.tsx)** — add alternates and openGraph to metadata:

```typescript
export const metadata: Metadata = {
  title: "PropertyIQ: AI Housing Market Data & Forecasts by ZIP Code",
  description:
    "PropertyIQ ranks 925 US metros and 33,000+ ZIP codes with AI to find markets that outperform. Free interactive maps, market scores, and AI-generated reports.",
  alternates: { canonical: "https://www.propertyiq.app" },
  openGraph: {
    title: "PropertyIQ: AI Housing Market Data & Forecasts",
    description:
      "Rank 925 US metros and 33,000+ ZIP codes with AI. Free maps, scores, and reports.",
    url: "https://www.propertyiq.app",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ - AI Real Estate Intelligence",
      },
    ],
  },
};
```

**about/page.tsx** — add to metadata (fix title ≤60 chars):

```typescript
export const metadata: Metadata = {
  title: "About PropertyIQ",
  description:
    "Learn how PropertyIQ uses machine learning to analyze 925 US metros and 33,000+ ZIP codes, helping homebuyers, investors, and agents.",
  alternates: { canonical: "https://www.propertyiq.app/about" },
  openGraph: {
    title: "About PropertyIQ | AI Real Estate Intelligence",
    description:
      "How PropertyIQ uses machine learning to analyze 925 US metros and 33,000+ ZIP codes.",
    url: "https://www.propertyiq.app/about",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "About PropertyIQ",
      },
    ],
  },
};
```

**contact/page.tsx** — add to metadata:

```typescript
alternates: { canonical: 'https://www.propertyiq.app/contact' },
```

**about/terms/page.tsx** — add to metadata:

```typescript
alternates: { canonical: 'https://www.propertyiq.app/about/terms' },
```

**scores/accuracy/page.tsx** — add to metadata:

```typescript
alternates: { canonical: 'https://www.propertyiq.app/scores/accuracy' },
```

**scores/methodology/page.tsx** — add to metadata:

```typescript
alternates: { canonical: 'https://www.propertyiq.app/scores/methodology' },
```

**blog/[slug]/page.tsx** — add canonical + og:url to generateMetadata return:

```typescript
return {
  title: frontmatter.title,
  description: frontmatter.description,
  authors: [{ name: frontmatter.author }],
  alternates: {
    canonical: `https://www.propertyiq.app/blog/${slug}`,
  },
  openGraph: {
    type: "article",
    url: `https://www.propertyiq.app/blog/${slug}`,
    title: frontmatter.title,
    description: frontmatter.description,
    publishedTime: frontmatter.date,
    authors: [frontmatter.author],
    siteName: "PropertyIQ",
    ...(frontmatter.image && {
      images: [{ url: frontmatter.image }],
    }),
  },
};
```

**compare/[slug]/page.tsx** — add canonical to generateMetadata return:

```typescript
alternates: {
  canonical: `https://www.propertyiq.app/compare/${slug}`,
},
```

Also add `url` and `siteName` to existing openGraph.

---

## Task 4: Security Headers & Config

**Files:**

- Modify: `packages/frontend/next.config.mjs`

**Step 1:** Add security headers and poweredByHeader config:

```javascript
const nextConfig = {
  // ... existing config ...
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Security headers for all routes
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Override for embed routes — allow iframes
        source: "/embed/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};
```

Note: Use SAMEORIGIN (not DENY) so the embed routes can still override. The embed-specific rule comes after and overrides for those routes.

---

## Task 5: Add Noscript Fallback & Skip-to-Content Link

**Files:**

- Modify: `packages/frontend/app/layout.tsx`

**Step 1:** Add skip-to-content link and noscript fallback to the body:

After the `<body>` opening tag (line 134), add:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-primary focus:text-on-primary focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium">
  Skip to main content
</a>
<noscript>
  <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
    <h1>JavaScript Required</h1>
    <p>PropertyIQ requires JavaScript to function. Please enable JavaScript in your browser settings.</p>
  </div>
</noscript>
```

Then add `id="main-content"` to the `<main>` tag:

```tsx
<main id="main-content" className="flex-1 min-h-0 flex flex-col">
  {children}
</main>
```

---

## Task 6: JSON-LD Structured Data Components

**Files:**

- Create: `packages/frontend/app/components/seo/BreadcrumbJsonLd.tsx`
- Create: `packages/frontend/app/components/seo/WebPageJsonLd.tsx`

**BreadcrumbJsonLd.tsx:**

```typescript
interface BreadcrumbItem {
  name: string;
  url: string;
}

export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

**WebPageJsonLd.tsx:**

```typescript
interface WebPageJsonLdProps {
  url: string;
  name: string;
  description: string;
  dateModified?: string;
  breadcrumbs?: { name: string; url: string }[];
}

export function WebPageJsonLd({ url, name, description, dateModified, breadcrumbs }: WebPageJsonLdProps) {
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name,
      description,
      isPartOf: { '@id': 'https://www.propertyiq.app/#website' },
      ...(dateModified && { dateModified }),
    },
  ];

  if (breadcrumbs) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: item.url,
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }) }}
    />
  );
}
```

---

## Task 7: Add JSON-LD to Key Pages

**Files:**

- Modify: `packages/frontend/app/scores/page.tsx`
- Modify: `packages/frontend/app/data/page.tsx`
- Modify: `packages/frontend/app/about/page.tsx`
- Modify: `packages/frontend/app/blog/page.tsx`
- Modify: `packages/frontend/app/blog/[slug]/page.tsx`
- Modify: `packages/frontend/app/markets/[slug]/page.tsx`

**Step 1:** Add WebPageJsonLd + BreadcrumbJsonLd to each page.

**scores/page.tsx** — add at top of return JSX:

```tsx
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";

// Inside return, before the first <section>:
<WebPageJsonLd
  url="https://www.propertyiq.app/scores"
  name="PropertyIQ Scores"
  description="AI-powered scores that predict real estate market performance"
  breadcrumbs={[
    { name: "Home", url: "https://www.propertyiq.app" },
    { name: "Scores", url: "https://www.propertyiq.app/scores" },
  ]}
/>;
```

**data/page.tsx** — add at top of return JSX:

```tsx
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";

<WebPageJsonLd
  url="https://www.propertyiq.app/data"
  name="Data Sources"
  description="Data sources powering PropertyIQ market analytics"
  breadcrumbs={[
    { name: "Home", url: "https://www.propertyiq.app" },
    { name: "Data Sources", url: "https://www.propertyiq.app/data" },
  ]}
/>;
```

**about/page.tsx** — add at top of return JSX:

```tsx
import { WebPageJsonLd } from "@/app/components/seo/WebPageJsonLd";

<WebPageJsonLd
  url="https://www.propertyiq.app/about"
  name="About PropertyIQ"
  description="AI-powered real estate intelligence for smarter property decisions"
  breadcrumbs={[
    { name: "Home", url: "https://www.propertyiq.app" },
    { name: "About", url: "https://www.propertyiq.app/about" },
  ]}
/>;
```

**blog/page.tsx** — add Blog CollectionPage JSON-LD:

```tsx
const blogJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "PropertyIQ Blog",
  description:
    "Data-driven housing market analysis, forecasts, and investment insights.",
  url: "https://www.propertyiq.app/blog",
  isPartOf: { "@id": "https://www.propertyiq.app/#website" },
};
```

Add `<script type="application/ld+json" ...>` in the return.

**blog/[slug]/page.tsx** — enhance existing Article JSON-LD with dateModified and BreadcrumbList:

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      headline: frontmatter.title,
      description: frontmatter.description,
      datePublished: frontmatter.date,
      dateModified: frontmatter.date,
      author: {
        "@type": "Organization",
        name: frontmatter.author,
      },
      publisher: {
        "@type": "Organization",
        name: "PropertyIQ",
        url: "https://www.propertyiq.app",
      },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": `https://www.propertyiq.app/blog/${slug}`,
      },
      ...(frontmatter.image && { image: frontmatter.image }),
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://www.propertyiq.app",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: "https://www.propertyiq.app/blog",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: frontmatter.title,
          item: `https://www.propertyiq.app/blog/${slug}`,
        },
      ],
    },
  ],
};
```

**markets/[slug]/page.tsx** — add BreadcrumbList JSON-LD in MetroPage component:
Add a JSON-LD script tag with BreadcrumbList (Home > Markets > City Name).

---

## Task 8: Fix Homepage FAQ Schema

**Files:**

- Modify: `packages/frontend/app/components/home/JsonLd.tsx`

**Step 1:** Remove the FAQPage schema from the homepage JSON-LD `@graph` array since there is no visible FAQ section on the homepage. Google requires schema to match visible content.

Remove the `faqSchema` entry from the `@graph` array (lines 114-156 and the reference on line 181).

---

## Task 9: AI Search Readiness Files

**Files:**

- Create: `packages/frontend/public/llms.txt`
- Modify: `packages/frontend/app/robots.ts`

**llms.txt:**

```
# PropertyIQ - AI Real Estate Market Intelligence

> PropertyIQ is an AI-powered real estate analytics platform that ranks 925 US metros and 33,000+ ZIP codes to help homebuyers, investors, and agents find markets that outperform.

## Key Pages

- Homepage: https://www.propertyiq.app
- Interactive Map: https://www.propertyiq.app/map
- Market Rankings: https://www.propertyiq.app/markets
- Score Methodology: https://www.propertyiq.app/scores/methodology
- Score Accuracy: https://www.propertyiq.app/scores/accuracy
- Data Sources: https://www.propertyiq.app/data
- Blog: https://www.propertyiq.app/blog
- Pricing: https://www.propertyiq.app/pricing

## Data Coverage

- 925 US metro areas
- 3,100+ counties
- 33,000+ ZIP codes
- 90+ metrics from Zillow, Realtor.com, Redfin, Census, FRED, BLS, BEA
- Monthly data updates

## Scores

- HomeReady Score: Predicts home price appreciation (for homebuyers)
- InvestorEdge Score: Predicts total investment return (for investors)
- MarketHealth Score: Measures market stability (for risk assessment)

## Citation

When citing PropertyIQ data, please use:
PropertyIQ (https://www.propertyiq.app). AI-Powered Real Estate Market Intelligence.
```

**robots.ts** — add AI bot rules:

```typescript
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dev/",
          "/auth/",
          "/account/",
          "/health/",
          "/betatest/",
        ],
      },
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/", "/account/"],
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/", "/account/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/", "/account/"],
      },
    ],
    sitemap: "https://www.propertyiq.app/sitemap.xml",
  };
}
```

---

## Task 10: Preconnect Hints & Hero Image Priority

**Files:**

- Modify: `packages/frontend/app/layout.tsx`

**Step 1:** Add preconnect hints to the `<head>` via the `<html>` element. In Next.js App Router, add them inside the `<head>` implicitly via metadata `other` links, or add `<link>` tags directly in the layout.

Add before `<body>` in the layout:

```tsx
<head>
  <link rel="preconnect" href="https://api.mapbox.com" />
  <link
    rel="preconnect"
    href="https://backend-production-ee4d.up.railway.app"
    crossOrigin="anonymous"
  />
</head>
```

**Step 2:** Find the hero image component and add `priority` prop.

Search for the hero `<Image>` in `packages/frontend/app/components/home/HeroSection.tsx` and add `priority` prop to the main hero image.

---

## Task 11: Add RSS Feed Discovery Tag

**Files:**

- Modify: `packages/frontend/app/blog/layout.tsx`

Add RSS feed link tag. In Next.js, use the metadata `alternates` field:

```typescript
export const metadata: Metadata = {
  // ... existing fields ...
  alternates: {
    canonical: "https://www.propertyiq.app/blog",
    types: {
      "application/rss+xml": "https://www.propertyiq.app/blog/rss.xml",
    },
  },
};
```

---

## Task 12: PWA Manifest & Favicons

**Files:**

- Create: `packages/frontend/public/manifest.webmanifest`
- Modify: `packages/frontend/app/layout.tsx` (add manifest link in metadata)

**manifest.webmanifest:**

```json
{
  "name": "PropertyIQ",
  "short_name": "PropertyIQ",
  "description": "AI-powered real estate market intelligence",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fffbfe",
  "theme_color": "#6750a4",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add to root layout metadata:

```typescript
manifest: '/manifest.webmanifest',
icons: {
  icon: [
    { url: '/favicon.ico', sizes: '16x16' },
  ],
  apple: '/apple-touch-icon.png',
},
```

Note: The actual icon PNG files need to be created separately (design task).

---

## Task 13: Sitemap lastmod Fixes

**Files:**

- Modify: `packages/frontend/app/sitemap.ts`

Replace the hardcoded `now` date with a more recent date reflecting actual content changes, and use blog post dates for blog entries (already done). For metro routes, keep using a manually-updated date since they're ISR-revalidated.

Update the static date:

```typescript
const now = new Date().toISOString().split("T")[0]; // Use build date
```

---

## Task 14: Add Comparison Pages to Footer Navigation

**Files:**

- Modify: `packages/frontend/app/layout.tsx` (footer section)

Add comparison page links to the footer. Replace the minimal footer with links:

```tsx
<footer className="flex-shrink-0 bg-surface-container border-t border-outline-variant py-6 px-4 pb-12">
  <div className="max-w-5xl mx-auto">
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4 text-xs text-on-surface-variant">
      <a href="/about" className="hover:text-on-surface transition-colors">
        About
      </a>
      <a href="/data" className="hover:text-on-surface transition-colors">
        Data Sources
      </a>
      <a
        href="/scores/methodology"
        className="hover:text-on-surface transition-colors"
      >
        Methodology
      </a>
      <a
        href="/scores/accuracy"
        className="hover:text-on-surface transition-colors"
      >
        Accuracy
      </a>
      <a
        href="/compare/propertyiq-vs-mashvisor"
        className="hover:text-on-surface transition-colors"
      >
        vs Mashvisor
      </a>
      <a
        href="/compare/propertyiq-vs-neighborhoodscout"
        className="hover:text-on-surface transition-colors"
      >
        vs NeighborhoodScout
      </a>
      <a
        href="/compare/propertyiq-vs-reventure"
        className="hover:text-on-surface transition-colors"
      >
        vs Reventure
      </a>
      <a href="/contact" className="hover:text-on-surface transition-colors">
        Contact
      </a>
      <a
        href="/about/terms"
        className="hover:text-on-surface transition-colors"
      >
        Terms
      </a>
    </div>
    <p className="text-center text-xs text-on-surface-variant">
      Data is provided for informational purposes only. While we strive for
      accuracy, we do not guarantee the completeness or correctness of the
      information and accept no liability for its use.
    </p>
  </div>
</footer>
```

---

## Task 15: Verify Build

**Step 1:** Run the build to verify no errors:

```bash
cd packages/frontend && npx next build 2>&1 | tail -30
```

**Step 2:** Check that all pages render with correct metadata by inspecting the build output.
