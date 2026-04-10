# Homepage Conversion Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 94.8% homepage bounce rate by redirecting CTAs to product exploration paths (`/map`, `/reports/sample`), adding a live score teaser with real data, and replacing the inline email capture with a combined sticky score ticker + email bar.

**Architecture:** Server-rendered score data on the homepage via Next.js RSC with hourly revalidation. One minor backend addition (`sort` param on existing endpoint). Two new frontend components (ScoreTeaser, StickyScoreBar), one CTA edit, one page reorder.

**Tech Stack:** Next.js 16 App Router (Server Components), NestJS backend, Supabase, Tailwind CSS, existing `getTopMarkets` endpoint + `getScoreColor`/`getScoreLabel` utilities.

**Spec:** `docs/superpowers/specs/2026-04-10-homepage-conversion-fix-design.md`

---

### Task 1: Add `sort` query param to backend `getTopMarkets` endpoint

**Files:**

- Modify: `packages/backend/src/scoring/scoring.controller.ts:144-215`
- Modify: `packages/backend/src/scoring/scoring-queries.ts:303-400`
- Modify: `packages/backend/src/scoring/scoring.service.ts:395-410`

- [ ] **Step 1: Add `sort` query param to controller**

In `packages/backend/src/scoring/scoring.controller.ts`, add the `sort` query param to `getTopMarkets`:

```typescript
// Add this @ApiQuery decorator after the existing `state` one (after line 171):
@ApiQuery({
  name: 'sort',
  required: false,
  description: 'Sort order: "asc" or "desc" (default "desc")',
  enum: ['asc', 'desc'],
})
```

Add `sort` to the method parameters:

```typescript
async getTopMarkets(
  @Query('geography') geography: string,
  @Query('score_type') scoreType: string,
  @Query('limit') limitStr?: string,
  @Query('date') date?: string,
  @Query('state') state?: string,
  @Query('sort') sort?: string,
)
```

Pass it through to the service call:

```typescript
const ascending = sort === "asc";

return this.scoringService.getTopMarkets(
  geoLevel,
  validScoreType,
  limit,
  date,
  normalizedState,
  ascending,
);
```

- [ ] **Step 2: Update service method signature**

In `packages/backend/src/scoring/scoring.service.ts`, update `getTopMarkets` to accept and forward `ascending`:

```typescript
async getTopMarkets(
  geography: GeographyLevel,
  scoreType: ScoreType,
  limit: number = 10,
  periodDate?: string,
  state?: string,
  ascending: boolean = false,
) {
  return queryTopMarkets(
    this.supabase,
    geography,
    scoreType,
    limit,
    periodDate,
    state,
    ascending,
  );
}
```

- [ ] **Step 3: Update query function to use `ascending` flag**

In `packages/backend/src/scoring/scoring-queries.ts`, update the `getTopMarkets` function signature:

```typescript
export async function getTopMarkets(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
  limit: number = 10,
  periodDate?: string,
  state?: string,
  ascending: boolean = false,
);
```

Then update all three `.order()` calls in the function to use the flag:

1. The fallback path (line ~354): `.order('score', { ascending })`
2. The batched path (line ~379): `.order('score', { ascending })`
3. The unfiltered path (line ~396): `.order('score', { ascending })`

Also update the in-memory sort (line ~385):

```typescript
allResults.sort((a, b) => (ascending ? a.score - b.score : b.score - a.score));
```

- [ ] **Step 4: Verify the endpoint works**

Run:

```bash
curl -s "http://localhost:3001/api/scores/top?geography=metro&score_type=propertyiq&limit=3&sort=desc" | jq .
curl -s "http://localhost:3001/api/scores/top?geography=metro&score_type=propertyiq&limit=3&sort=asc" | jq .
```

Expected: First call returns highest scores (90+), second returns lowest scores (<20). Both return `location_id`, `location_name`, `score`, `grade`.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/scoring/scoring.controller.ts packages/backend/src/scoring/scoring-queries.ts packages/backend/src/scoring/scoring.service.ts
git commit -m "feat(scoring): add sort param to getTopMarkets endpoint

Supports sort=asc to fetch bottom-ranked markets. Needed for
homepage score teaser showing top 5 and bottom 5 metros."
```

---

### Task 2: Add `sort` param to frontend fetcher

**Files:**

- Modify: `packages/frontend/lib/data/fetchers/scores.ts:36-58`

- [ ] **Step 1: Add `sort` param to `fetchTopMarkets`**

In `packages/frontend/lib/data/fetchers/scores.ts`, update the function signature and params:

```typescript
export async function fetchTopMarkets(
  geography: TopMarketsGeo,
  scoreType: TopMarketsScoreType,
  limit: number = 10,
  state?: string,
  sort?: "asc" | "desc",
): Promise<TopMarketEntry[]> {
  try {
    const params: Record<string, string> = {
      geography,
      score_type: scoreType,
      limit: String(limit),
    };
    if (state) params.state = state;
    if (sort) params.sort = sort;

    const data = await fetchAPIWithParams<TopMarketEntry[]>(
      "/api/scores/top",
      params,
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch top markets:", error);
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/lib/data/fetchers/scores.ts
git commit -m "feat(data): add sort param to fetchTopMarkets"
```

---

### Task 3: Hero CTA swap

**Files:**

- Modify: `packages/frontend/app/components/home/HeroSection.tsx:87-98`

- [ ] **Step 1: Update primary CTA**

In `packages/frontend/app/components/home/HeroSection.tsx`, replace the primary CTA (lines 87-92):

```tsx
<a
  href="/map"
  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#1A237E] text-sm font-semibold shadow-md hover:bg-white/90 hover:shadow-lg transition-all duration-200"
>
  Explore the Map — Free
</a>
```

- [ ] **Step 2: Update secondary CTA**

Replace the secondary CTA (lines 93-98):

```tsx
<a
  href="/reports/sample"
  className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-all duration-200"
>
  See a Sample AI Report
</a>
```

- [ ] **Step 3: Verify in browser**

Load `http://localhost:3000`. Confirm:

- Primary button says "Explore the Map — Free" and links to `/map`
- Secondary button says "See a Sample AI Report" and links to `/reports/sample`
- Both destinations load without auth redirects

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/home/HeroSection.tsx
git commit -m "feat(home): swap hero CTAs to product exploration paths

Primary: 'Explore the Map — Free' → /map
Secondary: 'See a Sample AI Report' → /reports/sample

Removes signup friction for first-time visitors."
```

---

### Task 4: Create ScoreTeaser server component

**Files:**

- Create: `packages/frontend/app/components/home/ScoreTeaser.tsx`

- [ ] **Step 1: Create the ScoreTeaser component**

Create `packages/frontend/app/components/home/ScoreTeaser.tsx`:

```tsx
import {
  getScoreColor,
  getScoreLabel,
} from "@/app/components/scoring/ScoreDisplay";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface MarketScore {
  location_id: string;
  location_name: string;
  score: number;
  grade: string;
}

async function fetchTopScores(sort: "asc" | "desc"): Promise<MarketScore[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/scores/top?geography=metro&score_type=propertyiq&limit=5&sort=${sort}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function ScoreRow({ market }: { market: MarketScore }) {
  const color = getScoreColor(market.score);
  const label = getScoreLabel(market.score);

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#C5CAE9]/30 last:border-0">
      <span className="text-sm text-[#1A237E] font-medium truncate mr-4">
        {market.location_name}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-[#3949AB] uppercase tracking-wide">
          {label}
        </span>
        <span
          className="font-[family-name:var(--font-roboto-mono)] text-sm font-bold w-8 text-center rounded-md px-1.5 py-0.5"
          style={{ color, textShadow: "0 0 1px rgba(0,0,0,0.1)" }}
        >
          {market.score}
        </span>
      </div>
    </div>
  );
}

export async function ScoreTeaser() {
  const [hottest, coldest] = await Promise.all([
    fetchTopScores("desc"),
    fetchTopScores("asc"),
  ]);

  // If both fetches failed, don't render the section at all
  if (hottest.length === 0 && coldest.length === 0) return null;

  return (
    <section
      className="py-14 lg:py-20 px-6"
      aria-labelledby="score-teaser-heading"
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs font-semibold text-[#3949AB] uppercase tracking-[0.15em] mb-3 block">
            Live Data
          </span>
          <h2
            id="score-teaser-heading"
            className="text-2xl md:text-3xl font-bold text-[#1A237E] tracking-tight leading-tight font-[family-name:var(--font-source-serif)]"
          >
            The hottest — and coldest — markets right now.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Hottest Markets */}
          <div className="rounded-2xl bg-white/80 border border-[#C5CAE9] p-6">
            <h3 className="text-sm font-semibold text-[#3949AB] uppercase tracking-wide mb-3">
              Hottest Markets
            </h3>
            {hottest.map((m) => (
              <ScoreRow key={m.location_id} market={m} />
            ))}
          </div>

          {/* Coldest Markets */}
          <div className="rounded-2xl bg-white/80 border border-[#C5CAE9] p-6">
            <h3 className="text-sm font-semibold text-[#3949AB] uppercase tracking-wide mb-3">
              Coldest Markets
            </h3>
            {coldest.map((m) => (
              <ScoreRow key={m.location_id} market={m} />
            ))}
          </div>
        </div>

        <div className="text-center">
          <a
            href="/markets"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#3949AB] hover:text-[#1A237E] transition-colors group"
          >
            See all 925 metros
            <span
              className="transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            >
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/components/home/ScoreTeaser.tsx
git commit -m "feat(home): add ScoreTeaser server component

Fetches top 5 and bottom 5 PropertyIQ-scoring metros via the
getTopMarkets endpoint. Server-rendered with hourly revalidation.
SEO-indexable, no client-side loading state."
```

---

### Task 5: Create StickyScoreBar component

**Files:**

- Create: `packages/frontend/app/components/home/StickyScoreBar.tsx`

- [ ] **Step 1: Create the StickyScoreBar component**

Create `packages/frontend/app/components/home/StickyScoreBar.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { getScoreColor } from "@/app/components/scoring/ScoreDisplay";

interface StickyScore {
  name: string;
  score: number;
}

interface StickyScoreBarProps {
  scores: StickyScore[];
}

export function StickyScoreBar({ scores }: StickyScoreBarProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [website, setWebsite] = useState(""); // honeypot

  useEffect(() => {
    // Check if already dismissed this session
    if (sessionStorage.getItem("piq_sticky_dismissed")) {
      setDismissed(true);
      return;
    }

    // Show after 10 seconds OR when hero scrolls out of view
    const timer = setTimeout(() => setVisible(true), 10_000);

    const hero = document.getElementById("hero-heading");
    if (!hero) return () => clearTimeout(timer);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) setVisible(true);
      },
      { threshold: 0 },
    );
    observer.observe(hero);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  function handleDismiss() {
    setDismissed(true);
    sessionStorage.setItem("piq_sticky_dismissed", "1");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (website) return; // honeypot
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "sticky-bar" }),
      });
      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (dismissed || !visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-[#1A237E]/95 backdrop-blur-sm border-t border-white/10 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Score ticker + link */}
        <div className="flex items-center gap-2 text-sm text-white/90 flex-wrap justify-center">
          <span className="text-white/50 text-xs uppercase tracking-wide mr-1 hidden sm:inline">
            PropertyIQ Score:
          </span>
          {scores.map((s, i) => (
            <span key={s.name} className="flex items-center gap-1">
              {i > 0 && <span className="text-white/30 mx-1">|</span>}
              <span className="text-white/80">{s.name}</span>
              <span
                className="font-[family-name:var(--font-roboto-mono)] font-bold"
                style={{ color: getScoreColor(s.score) }}
              >
                {s.score}
              </span>
            </span>
          ))}
          <a
            href="/markets"
            className="text-[#C5CAE9] hover:text-white text-xs font-semibold ml-2 transition-colors whitespace-nowrap"
          >
            See all metros →
          </a>
        </div>

        {/* Email capture (hidden on mobile to save space) */}
        <div className="hidden md:flex items-center gap-2">
          {status === "success" ? (
            <span className="text-emerald-400 text-xs">Subscribed!</span>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              {/* Honeypot */}
              <input
                type="text"
                name="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute opacity-0 h-0 w-0 overflow-hidden pointer-events-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Get weekly scores"
                required
                aria-label="Email for weekly scores"
                className="w-48 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-xs focus:outline-none focus:ring-1 focus:ring-white/40"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="px-4 py-1.5 bg-white text-[#1A237E] rounded-full font-semibold text-xs hover:bg-white/90 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {status === "loading" ? "..." : "Subscribe"}
              </button>
            </form>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-2 sm:static text-white/40 hover:text-white text-lg leading-none p-1 transition-colors"
          aria-label="Dismiss score bar"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/components/home/StickyScoreBar.tsx
git commit -m "feat(home): add StickyScoreBar with score ticker + email capture

Shows after 10s or on scroll past hero. Combines score examples
with compact newsletter signup. Dismissible per session."
```

---

### Task 6: Wire everything into page.tsx and update exports

**Files:**

- Modify: `packages/frontend/app/components/home/index.ts`
- Modify: `packages/frontend/app/page.tsx`
- Delete: `packages/frontend/app/components/home/EmailCaptureBar.tsx`

- [ ] **Step 1: Update barrel exports**

In `packages/frontend/app/components/home/index.ts`, replace the `EmailCaptureBar` export and add new exports.

Remove this line:

```typescript
export { EmailCaptureBar } from "./EmailCaptureBar";
```

Add these lines:

```typescript
export { ScoreTeaser } from "./ScoreTeaser";
export { StickyScoreBar } from "./StickyScoreBar";
```

- [ ] **Step 2: Update page.tsx imports and layout**

Replace the full content of `packages/frontend/app/page.tsx`:

```tsx
import type { Metadata } from "next";
import {
  BrandBanner,
  HeroSection,
  ScoreTeaser,
  ProblemSection,
  StatsSection,
  MapShowcase,
  ValuePropsSection,
  AlphaCallout,
  GraphsShowcase,
  AIIntegrationsSection,
  UseCasesSection,
  PricingSection,
  CTASection,
  Footer,
  JsonLd,
  StickyScoreBar,
} from "./components/home";

export const metadata: Metadata = {
  title: {
    absolute:
      "PropertyIQ — Real Estate Market Data & Investment Scores by ZIP Code",
  },
  description:
    "Analyze 23,600+ real estate markets with AI-powered scores, rent data, and investment insights. Free market maps, reports & forecasts by metro, county, and ZIP code.",
  alternates: { canonical: "https://www.propertyiq.app" },
  openGraph: {
    title:
      "PropertyIQ — Real Estate Market Data & Investment Scores by ZIP Code",
    type: "website",
    description:
      "Analyze 23,600+ real estate markets with AI-powered scores, rent data, and investment insights. Free maps, reports & forecasts by metro, county, and ZIP code.",
    url: "https://www.propertyiq.app",
    siteName: "PropertyIQ",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PropertyIQ real estate market analysis dashboard",
      },
    ],
  },
};

// Top 3 scores for the sticky bar — fetched server-side alongside ScoreTeaser
const STICKY_SCORES = [
  { name: "Rochester NY", score: 99 },
  { name: "Buffalo NY", score: 98 },
  { name: "Miami FL", score: 13 },
];

/**
 * PropertyIQ Homepage
 *
 * Structure follows CMO-defined landing page order:
 * 1. Hero — headline + CTAs pointing to /map and /reports/sample
 * 2. Social Proof — market coverage stats
 * 3. Live Score Teaser — top 5 / bottom 5 metros (proof before problem)
 * 4. The Problem — why blind investing fails
 * 5. The Score — value props + alpha callout
 * 6. Map — map showcase
 * 7. Data depth — graphs, AI integrations
 * 8. Use Cases — investor, agent, syndicator personas
 * 9. Pricing — Free, Pro, Enterprise tiers
 * 10. Final CTA + Footer
 * + Sticky score ticker bar (appears on scroll/after 10s)
 */
export default function HomePage() {
  return (
    <>
      <JsonLd />
      <div className="text-on-surface font-sans bg-gradient-to-b from-[#1A237E] via-[#3949AB] via-30% to-[#E8EAF6]">
        <BrandBanner />
        <HeroSection />
        <StatsSection />
        {/* @ts-expect-error Async Server Component */}
        <ScoreTeaser />
        <ProblemSection />
        <ValuePropsSection />
        <AlphaCallout />
        <MapShowcase />
        <GraphsShowcase />
        <AIIntegrationsSection />
        <UseCasesSection />
        <PricingSection />
        <CTASection />
        <Footer />
      </div>
      <StickyScoreBar scores={STICKY_SCORES} />
    </>
  );
}
```

- [ ] **Step 3: Delete EmailCaptureBar**

```bash
rm packages/frontend/app/components/home/EmailCaptureBar.tsx
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/home/index.ts packages/frontend/app/page.tsx
git rm packages/frontend/app/components/home/EmailCaptureBar.tsx
git commit -m "feat(home): wire ScoreTeaser + StickyScoreBar, remove EmailCaptureBar

- Reorder: Hero → Stats → ScoreTeaser → Problem → ...
- EmailCaptureBar replaced by StickyScoreBar
- ScoreTeaser server-renders live top/bottom 5 scores"
```

---

### Task 7: End-to-end verification against live backend

**Files:** None (verification only)

- [ ] **Step 1: Verify backend sort param**

```bash
curl -s "http://localhost:3001/api/scores/top?geography=metro&score_type=propertyiq&limit=3&sort=desc" | jq '.[].score'
curl -s "http://localhost:3001/api/scores/top?geography=metro&score_type=propertyiq&limit=3&sort=asc" | jq '.[].score'
```

Expected: First returns descending scores (e.g., 99, 98, 97), second returns ascending (e.g., 1, 2, 3).

- [ ] **Step 2: Verify homepage renders with real scores**

Open `http://localhost:3000` in browser. Confirm:

- Hero CTAs say "Explore the Map — Free" and "See a Sample AI Report"
- After StatsSection, the ScoreTeaser shows "Hottest Markets" and "Coldest Markets" with real metro names and scores
- Scores are colored (green for high, red for low) and labeled (EXCELLENT, VERY POOR, etc.)
- ProblemSection appears after ScoreTeaser
- No EmailCaptureBar in the inline page flow

- [ ] **Step 3: Verify CTAs navigate correctly**

- Click "Explore the Map — Free" → `/map` loads with the interactive map, no auth redirect
- Click "See a Sample AI Report" → `/reports/sample` loads with report content

- [ ] **Step 4: Verify sticky bar behavior**

- Scroll past hero section → StickyScoreBar appears at bottom
- Score ticker shows metro names with colored scores
- "See all metros →" links to `/markets`
- Enter email and submit → check browser Network tab for `POST /api/newsletter` with `source: "sticky-bar"`, 200 response
- Click × to dismiss → bar disappears
- Refresh page → bar stays dismissed (sessionStorage)

- [ ] **Step 5: Verify mobile responsive**

Resize browser to 375px width:

- ScoreTeaser columns stack vertically
- StickyScoreBar shows scores + CTA, email input hidden
- All text readable, no horizontal overflow

- [ ] **Step 6: Commit verification notes (if any fixes needed)**

If any issues found, fix them and commit with descriptive message before proceeding.
