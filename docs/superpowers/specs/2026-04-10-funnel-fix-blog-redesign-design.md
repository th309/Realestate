# Signup Funnel Fix + Blog Redesign — Design Spec

**Date:** 2026-04-10
**Problem:** 988 visitors → 0 signups. Blog has 100% bounce rate. Homepage search navigates away without showing value. Blog index is a flat list of 182 posts with no search or structure.
**Goal:** Create "aha moments" that bridge visitors from content to product — inline score previews on hero search, product CTAs on blog posts, and a usable blog index.

---

## 1. Hero Search Score Preview

**File:** `packages/frontend/app/components/home/HeroSearchBar.tsx`

### Current Behavior

User types → dropdown shows results → user selects → immediately navigates to `/map?geo=...&id=...`.

### New Behavior

User types → dropdown shows results → user selects → dropdown closes → **score preview card slides in below the search bar** → user can click through to map or sign up.

### Score Preview Card

Appears below the search bar when a result is selected. Fetches the PropertyIQ Score for the selected geography.

**Data fetch:** `GET /api/scores?geography={type}&location_id={id}` — endpoint already exists, returns `{ score, grade, confidence, ... }`.

**Card contents:**

- Market name (from search result)
- PropertyIQ Score as a colored number (using inlined `getScoreColor()` since hero is "use client")
- Score label (e.g., "EXCELLENT", "POOR")
- Two CTAs:
  - Primary: "Explore on Map →" → navigates to `/map?geo=...&id=...` (current behavior)
  - Secondary: "See Full Market Data →" → `/markets/{slug}` if a slug match exists, otherwise `/map`

**Edge cases:**

- Score fetch fails or no score available → navigate directly to `/map` (current behavior, no card shown)
- User types a new search while card is showing → card dismisses, new search starts
- Card has a small × dismiss button to clear and return to empty search

**Styling:** Card uses the dark-surface pattern (this is in the hero area on the dark gradient). `bg-white/5 border border-white/10 rounded-2xl`, white text, score colored by `getScoreColor()`.

---

## 2. Blog Product CTA Component

**New file:** `packages/frontend/app/blog/[slug]/BlogMarketCTA.tsx`

### Purpose

Every city/metro blog post should link visitors to the corresponding PropertyIQ market page. This bridges "I read about Atlanta" to "I can explore Atlanta's live data."

### Content

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Explore [City Name] on PropertyIQ

See live scores, AI reports, and 50+ metrics
for this market — updated monthly.

[Explore [City Name] → /markets/{slug}]  [Try Free — No Credit Card → /auth/sign-up]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### City Name Extraction

Extract from the post's `tags` array. Filter out generic tags (`"2026"`, `"market-analysis"`, `"real-estate-market"`, `"investment"`, `"methodology"`, `"news"`, `"sun-belt"`, `"midwest"`, `"northeast"`, `"market-recovery"`). The first remaining tag that matches a state name is the state; the first non-state tag is the city.

Example: tags `["atlanta", "georgia", "real-estate-market", "market-analysis", "2026", "sun-belt"]` → city = "Atlanta", state = "Georgia".

### Market Slug Matching

Use the city + state to construct a slug: `{city}-{state_abbrev}` → `/markets/{slug}`. Example: "Atlanta" + "Georgia" → `/markets/atlanta-ga`.

If no city tag can be extracted (e.g., methodology posts, thematic roundups), don't render the component.

### Placement

In `BlogPostContent.tsx`, render `<BlogMarketCTA>` between the MDX content and the existing newsletter signup. Pass `tags` from the post frontmatter.

---

## 3. Market-Specific Blog Newsletter Copy

**File:** `packages/frontend/app/blog/[slug]/BlogPostContent.tsx`

### Current State

```tsx
<NewsletterSignup
  label="PropertyIQ Market Pulse"
  description="Get the weekly PropertyIQ Market Pulse — data-driven housing market analysis for 400+ U.S. markets, delivered free every week."
  buttonText="Subscribe Free"
/>
```

### New State

If a city name is extracted from tags (same logic as §2), pass market-specific copy:

```tsx
<NewsletterSignup
  label={`Get ${cityName} Market Updates`}
  description={`Free weekly data on ${cityName} and 400+ U.S. markets — scores, trends, and investment signals delivered to your inbox.`}
  buttonText="Subscribe Free"
/>
```

If no city name (generic posts), keep existing copy unchanged.

---

## 4. Blog Index Page Redesign

**Files:**

- Modify: `packages/frontend/app/blog/page.tsx`
- Replace: `packages/frontend/app/blog/BlogFilterableList.tsx` → new `BlogIndexContent.tsx`

### Structure

```
┌─────────────────────────────────────────────┐
│  Search Bar (useUniversalSearch)            │
│  + Text filter input                        │
├─────────────────────────────────────────────┤
│  FEATURED (3 most recent posts, large cards)│
├─────────────────────────────────────────────┤
│  CITY & METRO ANALYSIS (6 cards, expandable)│
├─────────────────────────────────────────────┤
│  STATE & REGIONAL ROUNDUPS (6, expandable)  │
├─────────────────────────────────────────────┤
│  MARKET COMPARISONS (6, expandable)         │
├─────────────────────────────────────────────┤
│  STRATEGY & METHODOLOGY (6, expandable)     │
└─────────────────────────────────────────────┘
```

### Search Behavior

**Market search** (useUniversalSearch): When a user selects a market from the universal search dropdown (e.g., "Atlanta"), filter the blog list to posts whose tags include that city or state name. Show a "Showing posts about Atlanta" chip with an × to clear.

**Text filter**: A simple text input that filters posts by title and description match. Can be combined with market filter.

Both filters work together — selecting "Atlanta" from market search and typing "investment" shows Atlanta posts with "investment" in the title/description.

### Post Categorization (Derived from Slug/Tags)

Posts are grouped by analyzing the slug pattern:

| Group                     | Detection Rule                                                                                                                                                              | Examples                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| City & Metro Analysis     | Slug matches `{city}-real-estate-market-*` or `{city}-{state}-real-estate-market-*`                                                                                         | `atlanta-real-estate-market-2026`                                            |
| State & Regional Roundups | Slug contains `best-real-estate-markets-{state}` or `best-states-*` or `{state}-real-estate-markets-*` or tag is a region (sun-belt, midwest, etc.)                         | `best-real-estate-markets-florida-2026`, `sun-belt-real-estate-markets-2026` |
| Market Comparisons        | Slug contains `-vs-` or `comparison`                                                                                                                                        | `austin-vs-houston-real-estate-2026`                                         |
| Strategy & Methodology    | `category` = `"methodology"` or `"investment"`, or slug contains `best-cash-flow-*`, `rent-to-price-*`, `passive-income-*`, `fastest-selling-*`, `best-cities-for-airbnb-*` | `propertyiq-score-methodology`, `best-cash-flow-real-estate-markets-2026`    |

Posts that don't match any pattern default to "City & Metro Analysis" (the largest group).

### Featured Section

The 3 most recent posts displayed as larger cards in a 3-column grid (1-column on mobile). Each card shows: title, description (2 lines), date, category chip, reading time.

### Category Sections

Each section:

- Section heading with post count: "City & Metro Analysis (142)"
- Shows first 6 posts as compact cards (title, date, category, reading time)
- "Show all 142 posts →" link expands to show all posts in that group
- Sorted by date descending within each group

### When Filtered

When a market or text filter is active:

- Featured section is hidden
- Category sections are hidden
- Show a flat filtered list with: "[N] posts matching [filter]" header
- Clear filter button

---

## Files Changed Summary

| File                                    | Change                                                 |
| --------------------------------------- | ------------------------------------------------------ |
| `app/components/home/HeroSearchBar.tsx` | Add score preview card on selection                    |
| `app/blog/[slug]/BlogMarketCTA.tsx`     | New component — product CTA with market link           |
| `app/blog/[slug]/BlogPostContent.tsx`   | Add BlogMarketCTA, market-specific newsletter copy     |
| `app/blog/BlogFilterableList.tsx`       | Delete (replaced by BlogIndexContent)                  |
| `app/blog/BlogIndexContent.tsx`         | New component — search, featured, categorized sections |
| `app/blog/page.tsx`                     | Wire BlogIndexContent, pass categorized posts          |
| `lib/blog/extract-market.ts`            | New utility — shared city/state extraction from tags   |

No backend changes required.

---

## Verification (REQUIRED — Implementation Is Not Complete Without This)

The implementation plan MUST include a dedicated verification task that runs every check below against the live local backend (port 3001) and frontend (port 3000) connected to the real Supabase database. No mocks, no skipping.

1. **Hero search preview — live score fetch:** Type "Atlanta" in homepage search → select result → verify the score preview card fetches and displays a real score from the backend (not hardcoded) → confirm the score value matches `curl http://localhost:3001/api/scores?geography=metro&location_id=12060` → "Explore on Map" navigates to `/map` → "See Full Market Data" navigates to `/markets/atlanta-ga`
2. **Hero search preview — error handling:** Disconnect backend or use an invalid ID → verify card does NOT appear and search falls back to direct `/map` navigation
3. **Blog product CTA — city post:** Visit `/blog/atlanta-real-estate-market-2026` → scroll to bottom → see "Explore Atlanta on PropertyIQ" card → click link → arrives at `/markets/atlanta-ga`
4. **Blog product CTA — non-city post:** Visit a methodology or thematic post → verify BlogMarketCTA does NOT render
5. **Newsletter copy — personalized:** On Atlanta blog post, newsletter section says "Get Atlanta Market Updates"
6. **Newsletter copy — generic fallback:** On methodology post, newsletter section shows default "PropertyIQ Market Pulse" copy
7. **Blog index — market search with live data:** Visit `/blog` → type "Atlanta" in market search → select from universal search dropdown → posts filter to Atlanta-tagged posts → "Showing posts about Atlanta" chip visible → clear filter restores full view
8. **Blog index — text filter:** Type "investment" in text filter → posts filter by title/description match → combine with market filter and verify intersection works
9. **Blog index — featured section:** 3 most recent posts displayed as larger cards at top
10. **Blog index — category grouping:** Posts correctly grouped into City Analysis, State Roundups, Comparisons, Strategy → counts match → "Show all" expands each section
11. **Blog index — empty state:** Filter to a term with no matches → shows empty state message
12. **Mobile responsive:** Resize to 375px → hero preview card, blog CTA, blog index all render without overflow

---

## Out of Scope

- Blog post inline CTA (mid-article) — separate effort
- /reports/sample sticky bar — already exists
- Blog "Related Markets" sidebar — future enhancement
- Schema.org markup for blog categories — future SEO task
