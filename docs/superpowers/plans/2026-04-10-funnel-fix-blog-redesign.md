# Funnel Fix + Blog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge visitors from content to product by adding score previews on homepage search, product CTAs on blog posts, market-specific newsletter copy, and a structured blog index with search.

**Architecture:** All frontend changes. Hero search preview uses existing `fetchScore()` from `@/lib/data`. Blog features use a shared `extractMarketFromTags()` utility. Blog index uses `useUniversalSearch` for market search + client-side text filtering + slug-pattern categorization.

**Tech Stack:** Next.js 16 App Router, React 19, `useUniversalSearch` hook, `fetchScore()` from data layer, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-10-funnel-fix-blog-redesign-design.md`

---

### Task 1: Create shared market extraction utility

**Files:**

- Create: `packages/frontend/lib/blog/extract-market.ts`

This utility extracts a city name and state from blog post tags. Used by BlogMarketCTA (Task 3) and BlogPostContent newsletter copy (Task 4).

- [ ] **Step 1: Create the utility**

Create `packages/frontend/lib/blog/extract-market.ts`:

```typescript
/**
 * Extract city name and state from blog post tags.
 * Returns null if no city can be identified (e.g., methodology posts).
 */

const GENERIC_TAGS = new Set([
  "2026",
  "2025",
  "market-analysis",
  "real-estate-market",
  "investment",
  "methodology",
  "news",
  "sun-belt",
  "midwest",
  "northeast",
  "southeast",
  "market-recovery",
  "market-comparison",
  "state-roundup",
  "housing-market",
]);

const US_STATES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new-hampshire": "NH",
  "new-jersey": "NJ",
  "new-mexico": "NM",
  "new-york": "NY",
  "north-carolina": "NC",
  "north-dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode-island": "RI",
  "south-carolina": "SC",
  "south-dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west-virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

export interface ExtractedMarket {
  city: string; // Title-cased: "Atlanta"
  state: string; // Full name: "Georgia"
  stateAbbrev: string; // "GA"
  slug: string; // "atlanta-ga" for /markets/ links
}

export function extractMarketFromTags(tags: string[]): ExtractedMarket | null {
  if (!tags || tags.length === 0) return null;

  const candidateTags = tags.filter((t) => !GENERIC_TAGS.has(t));

  let stateTag: string | null = null;
  let stateAbbrev: string | null = null;
  let cityTag: string | null = null;

  for (const tag of candidateTags) {
    const lower = tag.toLowerCase();
    if (US_STATES[lower] && !stateTag) {
      stateTag = tag;
      stateAbbrev = US_STATES[lower];
    } else if (!cityTag) {
      cityTag = tag;
    }
  }

  if (!cityTag) return null;

  // Title-case the city: "atlanta" -> "Atlanta", "san-antonio" -> "San Antonio"
  const city = cityTag
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const state = stateTag
    ? stateTag
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : "";

  const abbrev = stateAbbrev || "";
  const slug = abbrev ? `${cityTag}-${abbrev.toLowerCase()}` : cityTag;

  return { city, state, stateAbbrev: abbrev, slug };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/lib/blog/extract-market.ts
git commit -m "feat(blog): add extractMarketFromTags utility

Shared utility for extracting city/state from blog post tags.
Used by BlogMarketCTA and market-specific newsletter copy."
```

---

### Task 2: Hero search score preview

**Files:**

- Modify: `packages/frontend/app/components/home/HeroSearchBar.tsx`

- [ ] **Step 1: Replace HeroSearchBar.tsx with score preview support**

Replace the entire content of `packages/frontend/app/components/home/HeroSearchBar.tsx`:

```tsx
"use client";

import React, { useRef, useState } from "react";
import { Search, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";
import { fetchScore } from "@/lib/data";

function getScoreColor(value: number): string {
  const pct = Math.min(Math.max(value / 100, 0), 1);
  return `hsl(${pct * 120}, 100%, 50%)`;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "EXCELLENT";
  if (score >= 80) return "GREAT";
  if (score >= 70) return "GOOD";
  if (score >= 60) return "FAIR";
  if (score >= 50) return "AVERAGE";
  if (score >= 40) return "BELOW AVG";
  if (score >= 20) return "POOR";
  return "VERY POOR";
}

interface SelectedMarket {
  id: string;
  name: string;
  type: string;
  state?: string;
  center?: [number, number];
  score: number | null;
  label: string;
  loading: boolean;
}

export function HeroSearchBar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<SelectedMarket | null>(null);
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useUniversalSearch({});

  const handleSelectResult = async (result: {
    id: string;
    name: string;
    type: string;
    state?: string;
    center?: [number, number];
  }) => {
    clearSearch();

    // Set selected with loading state
    setSelected({
      ...result,
      score: null,
      label: "",
      loading: true,
    });

    // Fetch score
    try {
      const scoreData = await fetchScore(result.type, result.id);
      if (scoreData?.scores?.propertyiq) {
        const s = scoreData.scores.propertyiq.score;
        setSelected((prev) =>
          prev
            ? { ...prev, score: s, label: getScoreLabel(s), loading: false }
            : null,
        );
      } else {
        // No score -- navigate directly
        navigateToMap(result);
      }
    } catch {
      // Score fetch failed -- navigate directly
      navigateToMap(result);
    }
  };

  function navigateToMap(result: {
    id: string;
    name: string;
    type: string;
    state?: string;
    center?: [number, number];
  }) {
    setSelected(null);
    const params = new URLSearchParams({
      geo: result.type,
      id: result.id,
      name: result.name,
    });
    if (result.center) {
      params.set("lng", String(result.center[0]));
      params.set("lat", String(result.center[1]));
    }
    if (result.state) params.set("state", result.state);
    router.push(`/map?${params.toString()}`);
  }

  function handleDismiss() {
    setSelected(null);
    inputRef.current?.focus();
  }

  function handleExploreMap() {
    if (selected) navigateToMap(selected);
  }

  function handleMarketData() {
    if (!selected) return;
    // Build a slug: "Atlanta-Sandy Springs-Alpharetta, GA" -> "atlanta-ga"
    const name = selected.name
      .split(",")[0]
      .trim()
      .split("-")[0]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const state = selected.state?.toLowerCase() || "";
    const slug = state ? `${name}-${state}` : name;
    router.push(`/markets/${slug}`);
  }

  return (
    <div
      ref={searchRef as React.RefObject<HTMLDivElement>}
      className="relative w-full max-w-lg mx-auto"
    >
      <div className="flex items-center bg-surface-container-lowest rounded-full border border-outline-variant shadow-md hover:shadow-lg transition-shadow px-5 py-3.5 gap-3">
        <Search className="w-5 h-5 text-on-surface-variant flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            handleSearch(e.target.value);
            if (selected) setSelected(null);
          }}
          onFocus={() => {
            if (searchQuery.length >= 2) setShowSearchResults(true);
          }}
          placeholder="Search any city, metro, county, or ZIP..."
          className="flex-1 bg-transparent text-base text-on-surface placeholder:text-on-surface-variant/60 outline-none"
        />
      </div>

      {/* Search dropdown */}
      {showSearchResults && !selected && (
        <div className="absolute top-full mt-2 w-full bg-surface-container-lowest rounded-2xl shadow-lg border border-outline-variant/30 z-50 overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {searchLoading && (
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-on-surface-variant">
                  Searching...
                </span>
              </div>
            )}

            {!searchLoading &&
              searchResults.length === 0 &&
              searchQuery.length >= 2 && (
                <p className="px-4 py-3 text-sm text-on-surface-variant text-center">
                  No markets found
                </p>
              )}

            {searchResults.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelectResult(result)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-container transition-colors"
              >
                <MapPin className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-on-surface">
                    {result.name}
                  </div>
                  {result.subtitle && (
                    <div className="text-xs text-on-surface-variant">
                      {result.subtitle}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-wider flex-shrink-0 bg-surface-container-high px-1.5 py-0.5 rounded">
                  {result.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Score preview card */}
      {selected && (
        <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">{selected.name}</h3>
              <p className="text-xs text-[#C5CAE9] uppercase tracking-wide mt-0.5">
                {selected.type === "metro"
                  ? "Metropolitan Area"
                  : selected.type === "county"
                    ? "County"
                    : selected.type.toUpperCase()}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/40 hover:text-white p-1 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selected.loading ? (
            <div className="flex items-center gap-2 py-3">
              <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[#C5CAE9]">Loading score...</span>
            </div>
          ) : selected.score !== null ? (
            <div className="flex items-center gap-4 mb-4">
              <span
                className="font-[family-name:var(--font-roboto-mono)] text-4xl font-bold"
                style={{ color: getScoreColor(selected.score) }}
              >
                {selected.score}
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  PropertyIQ Score
                </p>
                <p className="text-xs text-[#C5CAE9]">{selected.label}</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleExploreMap}
              className="flex-1 px-5 py-2.5 rounded-full bg-white text-[#1A237E] text-sm font-semibold hover:bg-white/90 transition-colors text-center"
            >
              Explore on Map
            </button>
            <button
              onClick={handleMarketData}
              className="flex-1 px-5 py-2.5 rounded-full border border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors text-center"
            >
              See Full Market Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Load `http://localhost:3000`. Type "Atlanta" in search, select a result. Score preview card should appear with a real score. Click "Explore on Map" to navigate to `/map`. Go back, search again, click "See Full Market Data" to navigate to a `/markets/` page.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/components/home/HeroSearchBar.tsx
git commit -m "feat(home): add score preview card to hero search

On selection, fetches PropertyIQ Score and shows inline preview
with two CTAs instead of navigating away immediately. Falls back
to direct /map navigation if no score available."
```

---

### Task 3: Blog product CTA component

**Files:**

- Create: `packages/frontend/app/blog/[slug]/BlogMarketCTA.tsx`
- Modify: `packages/frontend/app/blog/[slug]/BlogPostContent.tsx`

- [ ] **Step 1: Create BlogMarketCTA component**

Create `packages/frontend/app/blog/[slug]/BlogMarketCTA.tsx`:

```tsx
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { extractMarketFromTags } from "@/lib/blog/extract-market";

interface BlogMarketCTAProps {
  tags: string[];
}

export function BlogMarketCTA({ tags }: BlogMarketCTAProps) {
  const market = extractMarketFromTags(tags);
  if (!market) return null;

  return (
    <div className="mt-10 mb-8 rounded-xl bg-primary/5 border border-primary/15 p-6">
      <div className="flex items-start gap-3 mb-3">
        <BarChart3 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-lg font-semibold text-on-surface">
            Explore {market.city} on PropertyIQ
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            See live scores, AI reports, and 50+ metrics for this market —
            updated monthly.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mt-4 ml-8">
        <Link
          href={`/markets/${market.slug}`}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Explore {market.city} →
        </Link>
        <Link
          href="/auth/sign-up"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
        >
          Try Free — No Credit Card
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add BlogMarketCTA to BlogPostContent**

In `packages/frontend/app/blog/[slug]/BlogPostContent.tsx`, add imports at the top:

```typescript
import { BlogMarketCTA } from "./BlogMarketCTA";
import { extractMarketFromTags } from "@/lib/blog/extract-market";
```

After the MDX content closing `</div>` (after line 63), add:

```tsx
{
  /* Product CTA -- links to market page */
}
<BlogMarketCTA tags={post.frontmatter.tags} />;
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/blog/[slug]/BlogMarketCTA.tsx packages/frontend/app/blog/[slug]/BlogPostContent.tsx
git commit -m "feat(blog): add BlogMarketCTA linking readers to market pages

Shows 'Explore [City] on PropertyIQ' CTA at the bottom of city/metro
blog posts. Skips rendering on methodology/thematic posts."
```

---

### Task 4: Market-specific newsletter copy

**Files:**

- Modify: `packages/frontend/app/blog/[slug]/BlogPostContent.tsx`

- [ ] **Step 1: Update newsletter copy to be market-specific**

In `packages/frontend/app/blog/[slug]/BlogPostContent.tsx`, the `extractMarketFromTags` import was added in Task 3.

Replace the existing newsletter footer CTA paragraph, tags section, and NewsletterSignup (lines 65-98) with:

```tsx
{
  /* Newsletter footer CTA + Tags + Signup */
}
{
  (() => {
    const market = extractMarketFromTags(post.frontmatter.tags);
    return (
      <>
        <p className="mt-6 text-sm text-on-surface-variant">
          <strong className="text-on-surface">Want the weekly summary?</strong>{" "}
          The{" "}
          <a
            href="https://propertyiq.app/newsletter?utm_source=blog&utm_medium=cta&utm_campaign=newsletter-footer"
            className="text-primary underline hover:no-underline"
          >
            PropertyIQ Market Pulse
          </a>{" "}
          delivers three scored markets, what changed, and what it means for
          investors — free, every week.
        </p>

        {/* Tags */}
        {post.frontmatter.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-outline-variant">
            {post.frontmatter.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-surface-container-low text-on-surface-variant text-sm rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Newsletter Signup */}
        <NewsletterSignup
          label={
            market
              ? `Get ${market.city} Market Updates`
              : "PropertyIQ Market Pulse"
          }
          description={
            market
              ? `Free weekly data on ${market.city} and 400+ U.S. markets — scores, trends, and investment signals delivered to your inbox.`
              : "Get the weekly PropertyIQ Market Pulse — data-driven housing market analysis for 400+ U.S. markets, delivered free every week."
          }
          buttonText="Subscribe Free"
        />
      </>
    );
  })();
}
```

- [ ] **Step 2: Verify in browser**

Visit `/blog/atlanta-real-estate-market-2026`:

- BlogMarketCTA shows "Explore Atlanta on PropertyIQ"
- Newsletter says "Get Atlanta Market Updates"

Visit `/blog/propertyiq-score-methodology`:

- BlogMarketCTA does NOT render
- Newsletter shows "PropertyIQ Market Pulse"

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/blog/[slug]/BlogPostContent.tsx
git commit -m "feat(blog): market-specific newsletter copy

Shows 'Get [City] Market Updates' on city posts, falls back to
generic 'PropertyIQ Market Pulse' on methodology/thematic posts."
```

---

### Task 5: Blog index page redesign

**Files:**

- Create: `packages/frontend/app/blog/BlogIndexContent.tsx`
- Modify: `packages/frontend/app/blog/page.tsx`
- Delete: `packages/frontend/app/blog/BlogFilterableList.tsx`

- [ ] **Step 1: Create BlogIndexContent component**

Create `packages/frontend/app/blog/BlogIndexContent.tsx`. This is a large component (~250 lines) that replaces BlogFilterableList. It includes:

- Market search using `useUniversalSearch`
- Text filter input
- Featured section (3 most recent posts)
- Categorized sections (City Analysis, State Roundups, Comparisons, Strategy)
- Each section expandable with "Show all N" button
- Filtered view replaces sections with flat list

```tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Search, MapPin, X, BookOpen } from "lucide-react";
import { useUniversalSearch } from "@/app/shared/hooks/useUniversalSearch";

interface BlogPostSummary {
  slug: string;
  frontmatter: {
    title: string;
    description: string;
    date: string;
    category: string;
    tags: string[];
  };
  readingTime: string;
}

type BlogGroup = "city" | "roundup" | "comparison" | "strategy";

const GROUP_LABELS: Record<BlogGroup, string> = {
  city: "City & Metro Analysis",
  roundup: "State & Regional Roundups",
  comparison: "Market Comparisons",
  strategy: "Strategy & Methodology",
};

const GROUP_ORDER: BlogGroup[] = ["city", "roundup", "comparison", "strategy"];

function classifyPost(
  slug: string,
  category: string,
  tags: string[],
): BlogGroup {
  if (slug.includes("-vs-") || slug.includes("comparison")) return "comparison";
  if (
    category === "methodology" ||
    category === "investment" ||
    slug.includes("best-cash-flow-") ||
    slug.includes("rent-to-price-") ||
    slug.includes("passive-income-") ||
    slug.includes("fastest-selling-") ||
    slug.includes("best-cities-for-airbnb-")
  )
    return "strategy";
  if (
    slug.match(/best-real-estate-markets-\w+-\d{4}/) ||
    slug.includes("best-states-") ||
    slug.match(/\w+-real-estate-markets-\d{4}/) ||
    tags.some((t) =>
      [
        "state-roundup",
        "sun-belt",
        "midwest",
        "northeast",
        "southeast",
      ].includes(t),
    )
  )
    return "roundup";
  return "city";
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CategoryChip({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-container text-on-primary-container">
      {category.replace(/-/g, " ")}
    </span>
  );
}

function PostCard({
  post,
  featured = false,
}: {
  post: BlogPostSummary;
  featured?: boolean;
}) {
  return (
    <article
      className={`bg-surface-container-low rounded-xl border border-outline-variant/50 hover:shadow-md transition-shadow ${
        featured ? "p-6" : "p-4"
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <CategoryChip category={post.frontmatter.category} />
        <time
          dateTime={post.frontmatter.date}
          className="text-xs text-on-surface-variant"
        >
          {formatDate(post.frontmatter.date)}
        </time>
        <span className="text-xs text-on-surface-variant">
          {post.readingTime}
        </span>
      </div>
      <Link href={`/blog/${post.slug}`} className="group">
        <h3
          className={`font-medium text-on-surface group-hover:text-primary transition-colors ${featured ? "text-xl" : "text-base"}`}
        >
          {post.frontmatter.title}
        </h3>
      </Link>
      {featured && (
        <p className="mt-2 text-sm text-on-surface-variant leading-relaxed line-clamp-2">
          {post.frontmatter.description}
        </p>
      )}
    </article>
  );
}

function PostSection({
  group,
  posts,
}: {
  group: BlogGroup;
  posts: BlogPostSummary[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? posts : posts.slice(0, 6);

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold text-on-surface">
          {GROUP_LABELS[group]}{" "}
          <span className="text-on-surface-variant font-normal text-sm">
            ({posts.length})
          </span>
        </h2>
        {posts.length > 6 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Show all {posts.length} posts →
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
      {expanded && posts.length > 6 && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-4 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Show less
        </button>
      )}
    </section>
  );
}

export function BlogIndexContent({ posts }: { posts: BlogPostSummary[] }) {
  const [textFilter, setTextFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState<string | null>(null);
  const {
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    setShowSearchResults,
    searchRef,
    handleSearch,
    clearSearch,
  } = useUniversalSearch({});

  const handleSelectMarket = useCallback(
    (result: { name: string }) => {
      const marketName = result.name.split(",")[0].trim().toLowerCase();
      setMarketFilter(marketName);
      clearSearch();
    },
    [clearSearch],
  );

  const clearMarketFilter = useCallback(() => {
    setMarketFilter(null);
  }, []);

  const filteredPosts = useMemo(() => {
    let result = posts;

    if (marketFilter) {
      result = result.filter((p) =>
        p.frontmatter.tags.some((tag) =>
          tag.toLowerCase().includes(marketFilter),
        ),
      );
    }

    if (textFilter.length >= 2) {
      const lower = textFilter.toLowerCase();
      result = result.filter(
        (p) =>
          p.frontmatter.title.toLowerCase().includes(lower) ||
          p.frontmatter.description.toLowerCase().includes(lower),
      );
    }

    return result;
  }, [posts, marketFilter, textFilter]);

  const isFiltered = marketFilter || textFilter.length >= 2;

  const grouped = useMemo(() => {
    const groups: Record<BlogGroup, BlogPostSummary[]> = {
      city: [],
      roundup: [],
      comparison: [],
      strategy: [],
    };
    for (const post of filteredPosts) {
      const group = classifyPost(
        post.slug,
        post.frontmatter.category,
        post.frontmatter.tags,
      );
      groups[group].push(post);
    }
    return groups;
  }, [filteredPosts]);

  const featured = posts.slice(0, 3);

  return (
    <div className="mt-8">
      {/* Search bar area */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Market search (universal) */}
        <div
          ref={searchRef as React.RefObject<HTMLDivElement>}
          className="relative flex-1"
        >
          <div className="flex items-center bg-surface-container-low rounded-lg border border-outline-variant px-4 py-2.5 gap-2">
            <MapPin className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                if (searchQuery.length >= 2) setShowSearchResults(true);
              }}
              placeholder="Search by market..."
              className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none"
            />
          </div>
          {showSearchResults && (
            <div className="absolute top-full mt-1 w-full bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 z-50 overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                {searchLoading && (
                  <div className="flex items-center gap-2 px-4 py-3">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-on-surface-variant">
                      Searching...
                    </span>
                  </div>
                )}
                {!searchLoading &&
                  searchResults.length === 0 &&
                  searchQuery.length >= 2 && (
                    <p className="px-4 py-3 text-sm text-on-surface-variant text-center">
                      No markets found
                    </p>
                  )}
                {searchResults.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => handleSelectMarket(r)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-container transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                    <span className="text-sm text-on-surface">{r.name}</span>
                    <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-wider ml-auto bg-surface-container-high px-1.5 py-0.5 rounded">
                      {r.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text filter */}
        <div className="flex items-center bg-surface-container-low rounded-lg border border-outline-variant px-4 py-2.5 gap-2 sm:w-64">
          <Search className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
          <input
            type="text"
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            placeholder="Filter by keyword..."
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none"
          />
        </div>
      </div>

      {/* Active filters */}
      {marketFilter && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-on-surface-variant">
            Showing posts about
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-sm font-medium">
            {marketFilter.charAt(0).toUpperCase() + marketFilter.slice(1)}
            <button
              onClick={clearMarketFilter}
              className="ml-1 hover:text-primary"
              aria-label="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        </div>
      )}

      {isFiltered ? (
        /* Filtered view -- flat list */
        <section className="mt-6">
          <p className="text-sm text-on-surface-variant mb-4">
            {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}{" "}
            found
          </p>
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-on-surface-variant mx-auto mb-4 opacity-50" />
              <p className="text-lg text-on-surface-variant">
                No posts match your filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPosts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Unfiltered view -- featured + categorized sections */
        <>
          {/* Featured */}
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-on-surface mb-4">
              Latest
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featured.map((post) => (
                <PostCard key={post.slug} post={post} featured />
              ))}
            </div>
          </section>

          {/* Category sections */}
          {GROUP_ORDER.map((group) =>
            grouped[group].length > 0 ? (
              <PostSection key={group} group={group} posts={grouped[group]} />
            ) : null,
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update blog page.tsx**

In `packages/frontend/app/blog/page.tsx`, change the import from `BlogFilterableList` to `BlogIndexContent`:

Replace:

```typescript
import { BlogFilterableList } from "./BlogFilterableList";
```

With:

```typescript
import { BlogIndexContent } from "./BlogIndexContent";
```

Replace:

```tsx
<BlogFilterableList posts={postSummaries} />
```

With:

```tsx
<BlogIndexContent posts={postSummaries} />
```

- [ ] **Step 3: Delete old BlogFilterableList**

```bash
rm packages/frontend/app/blog/BlogFilterableList.tsx
```

- [ ] **Step 4: Verify in browser**

Visit `http://localhost:3000/blog`:

- Market search appears with MapPin icon
- Text filter appears with Search icon
- Featured section shows 3 most recent posts
- Category sections show with correct groupings and counts
- "Show all N posts" expands sections
- Search "Atlanta" in market search, select result, posts filter
- Type "investment" in text filter, posts filter
- Clear both filters, full view restores

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/blog/BlogIndexContent.tsx packages/frontend/app/blog/page.tsx
git rm packages/frontend/app/blog/BlogFilterableList.tsx
git commit -m "feat(blog): redesign index with search, categories, and featured posts

- Market search via useUniversalSearch filters by city/state tags
- Text filter by title/description
- Featured section with 3 most recent posts
- Posts grouped: City Analysis, State Roundups, Comparisons, Strategy
- Each section shows 6 posts with 'Show all' expansion
- Replaces flat BlogFilterableList"
```

---

### Task 6: End-to-end verification against live backend

**Files:** None (verification only)

- [ ] **Step 1: Hero search preview -- live score fetch**

Load `http://localhost:3000`. Type "Atlanta" in search, select a result. Verify score preview card shows a real score. Cross-check:

```bash
curl -s "http://localhost:3001/api/scores/metro/12060" | head -c 200
```

Confirm the score in the card matches the API response.

- [ ] **Step 2: Hero search preview -- error handling**

Search for an obscure ZIP or invalid market. Verify: if no score is returned, the card does NOT appear and navigation goes directly to `/map`.

- [ ] **Step 3: Blog product CTA -- city post**

Visit `http://localhost:3000/blog/atlanta-real-estate-market-2026`. Scroll to bottom. Confirm:

- "Explore Atlanta on PropertyIQ" card visible
- "Explore Atlanta" links to `/markets/atlanta-ga`
- "Try Free -- No Credit Card" links to `/auth/sign-up`

- [ ] **Step 4: Blog product CTA -- non-city post**

Visit `http://localhost:3000/blog/propertyiq-score-methodology`. Confirm BlogMarketCTA does NOT render.

- [ ] **Step 5: Newsletter copy -- personalized vs generic**

On Atlanta post: newsletter says "Get Atlanta Market Updates".
On methodology post: newsletter says "PropertyIQ Market Pulse".

- [ ] **Step 6: Blog index -- market search**

Visit `http://localhost:3000/blog`. Type "Atlanta" in market search, select from dropdown. Posts filter to Atlanta-tagged posts. "Showing posts about Atlanta" chip visible. Click X to clear, full view restores.

- [ ] **Step 7: Blog index -- text filter**

Type "investment" in keyword filter. Posts filter by title/description match. Combine with market filter and verify intersection works.

- [ ] **Step 8: Blog index -- structure**

Verify: Featured section shows 3 most recent. City Analysis has the most posts. Comparisons shows -vs- posts. "Show all" expands correctly.

- [ ] **Step 9: Blog index -- empty state**

Filter to a nonsense term. Shows "No posts match your filters."

- [ ] **Step 10: Mobile responsive**

Resize to 375px. Verify: hero preview card stacks CTAs vertically, blog index search inputs stack, post cards go single-column.

- [ ] **Step 11: Commit if fixes needed**

If any issues found during verification, fix and commit with descriptive message.
