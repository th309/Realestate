# Homepage Conversion Fix — Design Spec

**Date:** 2026-04-10
**Problem:** 94.8% bounce rate, 53-second average session, 0 signups from 988 organic visitors. Users who reach `/map` spend 15 minutes — the product is compelling but the homepage isn't creating pull to get visitors there.
**Goal:** Reduce homepage bounce rate by redirecting CTAs toward product exploration (no-friction paths to `/map` and `/reports/sample`) and adding live data proof that creates curiosity.

---

## 1. Hero CTA Swap

**File:** `packages/frontend/app/components/home/HeroSection.tsx`

### Current State

| CTA       | Label                         | Destination     |
| --------- | ----------------------------- | --------------- |
| Primary   | "Start Free — No Credit Card" | `/auth/sign-up` |
| Secondary | "See How It Works"            | `#demo`         |

### New State

| CTA       | Label                    | Destination       |
| --------- | ------------------------ | ----------------- |
| Primary   | "Explore the Map — Free" | `/map`            |
| Secondary | "See a Sample AI Report" | `/reports/sample` |

**Rationale:** The primary CTA sends visitors to a signup wall — maximum friction for a first-time visitor who doesn't yet understand the product. The data shows `/map` retains users for 15 minutes and `/reports/sample` has 50% bounce (vs. 94.8% site average). Route visitors to the product, not the gate.

No changes to the search bar, trust signals, heading, or subhead.

---

## 2. Live Score Teaser (New Section — Replaces ProblemSection Position)

**New file:** `packages/frontend/app/components/home/ScoreTeaser.tsx`

### Purpose

Show the top 5 and bottom 5 PropertyIQ-scoring metros right now. Real, live data from the scoring system. Makes the value proposition concrete and creates curiosity ("Why is Rochester a 99? Why is Miami a 13?").

### Data Source

- Backend endpoint: `GET /api/scores/top-markets?geography=metro&score_type=propertyiq&limit=5`
- Two calls: one for top 5 (`sort=desc`, default), one for bottom 5 (`sort=asc`)
- Returns: `{ location_id, location_name, score, grade }`
- **Minor backend change required:** Add `sort` query param (`asc`|`desc`, default `desc`) to `scoring.controller.ts` `getTopMarkets` and pass `ascending: sort === 'asc'` through to the Supabase `.order()` call in `scoring-queries.ts`

### Rendering

- **Server Component** — fetched at request time with `fetch()` + `next: { revalidate: 3600 }` (hourly revalidation). Scores update monthly so hourly is more than sufficient.
- No client-side fetching, no loading states, no layout shift.
- SEO-indexable — Google sees the actual scores in HTML.

### Layout

- Section heading: "The hottest — and coldest — markets right now."
- Two columns (or single table): "Hottest Markets" (top 5) and "Coldest Markets" (bottom 5)
- Each row: metro name, PropertyIQ Score (colored by score tier using `getScoreColor()`), score label (using `getScoreLabel()`)
- Score displayed in monospace font per brand spec (`font-[family-name:var(--font-roboto-mono)]`)
- CTA below: "See all 925 metros" linking to `/markets`

### Styling

- Sits on the light end of the page gradient (`#E8EAF6` area) — use dark text colors consistent with PricingSection/UseCasesSection pattern: `text-[#1A237E]` for headings, `text-[#3949AB]` for body, `bg-white/80` cards with `border-[#C5CAE9]`
- Score badges use the existing `getScoreColor()` utility for background tinting

---

## 3. Page Section Reorder

**File:** `packages/frontend/app/page.tsx`

### Current Order

1. BrandBanner
2. HeroSection
3. EmailCaptureBar
4. StatsSection
5. ProblemSection
6. ValuePropsSection
7. AlphaCallout
8. MapShowcase
9. GraphsShowcase
10. AIIntegrationsSection
11. UseCasesSection
12. PricingSection
13. CTASection
14. Footer

### New Order

1. BrandBanner
2. HeroSection
3. StatsSection
4. **ScoreTeaser** (new — replaces ProblemSection's position)
5. ProblemSection
6. ValuePropsSection
7. AlphaCallout
8. MapShowcase
9. GraphsShowcase
10. AIIntegrationsSection
11. UseCasesSection
12. PricingSection
13. CTASection
14. Footer

**Changes:**

- `EmailCaptureBar` removed from inline flow (its functionality moves to the sticky bar)
- `ScoreTeaser` inserted before `ProblemSection` — show the proof, then explain the problem
- All other sections unchanged

---

## 4. Map Page — No Changes Needed

**Finding:** `/map` is not in the `PROTECTED_PREFIXES` array in `middleware.ts`. Anonymous visitors can access the map freely. Paywalls only gate sub-features:

- County/ZIP geo level switching (`GeoLevelPills.tsx`)
- Certain premium metrics (`MetricSelector.tsx`)
- Report generation (`QuickActions.tsx`)
- Context menu actions (`MapContextMenu.tsx`)

National, state, and metro-level map exploration works without authentication. This item is already satisfied.

---

## 5. Combined Sticky Score Ticker + Email Capture

**New file:** `packages/frontend/app/components/home/StickyScoreBar.tsx`
**Replaces:** `EmailCaptureBar` (removed from inline page flow)

### Behavior

- **Trigger:** Appears after user scrolls past the hero section (IntersectionObserver on hero) OR after 10 seconds, whichever comes first
- **Position:** Fixed to bottom of viewport (`fixed bottom-0 inset-x-0`)
- **Dismissible:** X button stores dismissal in `localStorage('piq_sticky_dismissed')`. Stays dismissed for the session.
- **z-index:** `z-50` — above page content, below modals

### Layout

Left side (score ticker):

- 3 score examples: "Rochester NY 99 | Buffalo NY 98 | Miami FL 13"
- Scores colored by tier using `getScoreColor()`
- Link: "See all metros" → `/markets`

Right side (email capture):

- Compact single-line: email input + "Get Scores" submit button
- Same newsletter API call as current EmailCaptureBar (`POST /api/newsletter` with `source: "sticky-bar"`)
- Honeypot field carried over from existing implementation

### Styling

- Dark background: `bg-[#1A237E]` with slight transparency/blur for contrast against page
- White text, scores in monospace
- Responsive: on mobile, stack vertically (scores on top, email below) or show only the score ticker with a CTA link (hide email input)

### Data

- Score values can be hardcoded initially (they change monthly) or passed from the same server fetch as ScoreTeaser
- If server-rendered: pass top 3 scores as props from page.tsx to avoid a separate fetch

---

## Files Changed Summary

| File                                                 | Change                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `app/components/home/HeroSection.tsx`                | Swap CTA labels and hrefs                                                      |
| `app/components/home/ScoreTeaser.tsx`                | New server component                                                           |
| `app/components/home/StickyScoreBar.tsx`             | New client component (replaces EmailCaptureBar)                                |
| `app/components/home/index.ts`                       | Export ScoreTeaser, StickyScoreBar; remove EmailCaptureBar export              |
| `app/page.tsx`                                       | Reorder sections, add ScoreTeaser, replace EmailCaptureBar with StickyScoreBar |
| `app/components/home/EmailCaptureBar.tsx`            | Can be deleted (functionality merged into StickyScoreBar)                      |
| `packages/backend/src/scoring/scoring.controller.ts` | Add `sort` query param to `getTopMarkets`                                      |
| `packages/backend/src/scoring/scoring-queries.ts`    | Pass `ascending` flag to `.order()` call                                       |

One minor backend change: add `sort` query param to `getTopMarkets` endpoint (controller + query function).

---

## Out of Scope

- Blog post CTAs (separate recommendation in the report)
- Reports paywall copy changes (separate recommendation)
- Signup event tracking (separate recommendation)
- Any changes to `/map` page behavior
