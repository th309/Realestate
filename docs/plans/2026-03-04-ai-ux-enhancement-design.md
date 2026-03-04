# PropertyIQ AI & UX Enhancement Design

**Date:** 2026-03-04
**Status:** Approved
**Scope:** Three-phase enhancement leveraging AI across the product + email strategy + custom research briefs

---

## Overview

Five interconnected initiatives to make PropertyIQ feel AI-native, personally relevant, and growth-driving:

1. **Ambient Intelligence Layer** — AI-generated micro-insights on every data surface
2. **Personalized Journey** — Onboarding quiz, Market Match Score, personalized dashboard
3. **Content & Shareability Engine** — SEO pages, social cards, lead magnets, embeddable widgets, auto-generated blog posts
4. **Email Strategy** — Onboarding drip, monthly personalized digest, threshold alerts
5. **Custom Research Briefs** — Ask-a-question, get-a-document agentic research feature

**AI cost model:** DeepSeek for all batch/bulk generation. Claude for high-value moments only (shared reports on public URLs, agentic data gathering for research briefs). Estimated total AI cost: <$10/mo at moderate usage.

---

## 1. Ambient Intelligence Layer

### Purpose

Every data surface gets short AI-generated insights that make numbers meaningful. No chatbot — just smart annotations that are always present.

### Where Insights Appear

| Surface                                  | Insight Type                                     | Example                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Map right panel (region selected)        | Market take (2 sentences)                        | "Austin's score climbed 8 pts in 6 months — inventory relief is the driver. But affordability is tightening faster than the national avg." |
| Score cards                              | "Why this score" one-liner                       | "Strong growth potential offset by declining affordability."                                                                               |
| Graphs page                              | Trend interpretation (1-2 sentences below chart) | "Denver home values +4.2% YoY, outpacing state (+2.8%) but below its own 3Y avg (+6.1%)."                                                  |
| Market landing pages (`/markets/[slug]`) | Market summary paragraph (3-4 sentences)         | Full narrative overview                                                                                                                    |
| Weekly email digest                      | Watchlist movers summary                         | "3 of your watched markets moved: Austin +5 pts, Denver -3 pts..."                                                                         |

### Generation Strategy

- **Monthly batch** — runs immediately after the scoring pipeline completes (same trigger). Generates all insights once, caches until next month's data refresh.
- **On-demand with 30-day cache** — for graphs page (user-specific metric combos) and any geography not covered by the batch (e.g., less popular ZIPs). Generated on first request, cached until next data refresh.
- **No nightly runs** — data only changes monthly, so generation runs monthly.
- **Model:** DeepSeek for all batch insights. Claude only for insights appearing on shared/public report URLs.

### Data Flow

```
Monthly scoring pipeline completes
  → InsightGenerationService triggered
  → For each metro: gather score + top 3 component changes + benchmarks + trends
  → Build prompt template → Call DeepSeek batch
  → Store in market_insights table (geography_id, insight_type, text, generated_at, expires_at)

Frontend request → GET /api/insights/{geoLevel}/{geoId}?type=market_take
  → Check cache (market_insights table) → Return if fresh
  → If stale/missing → generate on-demand → cache → return
```

### New Infrastructure

| Component                                | Layer               | Notes                                                                        |
| ---------------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| `market_insights` table                  | Database            | region_id, geo_level, insight_type, content, model, generated_at, expires_at |
| `InsightGenerationService`               | Backend             | New module, triggered after scoring pipeline                                 |
| `InsightController`                      | Backend             | GET endpoint for cached insights                                             |
| `useInsight(geoLevel, geoId, type)` hook | Frontend data layer | Standard React Query pattern                                                 |
| Monthly cron trigger                     | Backend             | Piggyback on existing scoring batch                                          |

### Tier Gating

Configured via entitlements admin (source of truth). Enforced via existing `useEntitlements()` and `<EntitlementGate>`.

**Design intent for entitlements configuration:**

- **Free users:** See first sentence of market takes only (truncated with "Upgrade to see full analysis")
- **Pro users:** Full insights everywhere

### Cost

~900 metros x 5 insight types x ~200 tokens each = ~900K tokens/month ≈ **$0.12/month with DeepSeek.**

---

## 2. Personalized Journey

### Purpose

Turn PropertyIQ from "here's data, go explore" into "tell us what you're looking for, we'll tell you where to look."

### Part 2A: Onboarding Quiz

**When it appears:** After signup (or as a prompted banner for existing users who haven't completed it). Skippable but incentivized ("Complete your profile to unlock personalized recommendations").

**Flow (4-5 steps, ~60 seconds):**

| Step | Question                    | Options                                                                              | Purpose                                                      |
| ---- | --------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1    | "What's your goal?"         | First-time buyer · Relocating · Investor (rental) · Investor (flip) · Just exploring | Determines which score to weight (HomeReady vs InvestorEdge) |
| 2    | "What matters most?"        | Affordability · Growth potential · Stability/low risk · Cash flow · Job market       | Sets priority weights                                        |
| 3    | "Budget range?"             | Slider or brackets: <$200K, $200-400K, $400-600K, $600K-1M, $1M+                     | Filters by price range                                       |
| 4    | "Any location preferences?" | Multi-select state/region chips + "Open to anywhere"                                 | Geographic filter                                            |
| 5    | "Timeline?"                 | Buying in <6 months · 6-12 months · 1-2 years · Just researching                     | Affects weight of current conditions vs trends               |

**Storage:** New `user_preferences` table. Editable anytime from account settings.

**No AI needed** — pure UI + database write.

### Part 2B: Market Match Score

A 0-100 score unique to each user: "How well does this market fit _your_ criteria?"

**Calculation (no AI, pure math):**

```
Market Match = Σ (weight_i × normalized_metric_i)
```

Weights come from quiz answers:

| User Priority      | Metrics Weighted Higher                                     | Source                      |
| ------------------ | ----------------------------------------------------------- | --------------------------- |
| Affordability      | income_to_buy, rent_as_pct_income, years_to_save            | Existing calculated metrics |
| Growth potential   | home_value_yoy, home_price_forecast, population_growth      | Existing metrics            |
| Stability/low risk | price_stability component, months_of_supply, days_on_market | Existing scores + metrics   |
| Cash flow          | gross_yield, cap_rate, rent_index                           | Existing calculated metrics |
| Job market         | unemployment_rate, job_growth, income_growth                | Existing economic metrics   |

Budget range filters out markets where median home value is outside the user's bracket. Location preferences filter to selected states/regions.

**Where it appears:**

- Map choropleth (toggle: "PropertyIQ Score" vs "Your Match Score")
- Right panel alongside standard scores
- Markets list page (sortable column)
- Personalized dashboard

**Computation:** Calculated client-side or via lightweight backend endpoint. User weights + existing cached scores = instant.

### Part 2C: Personalized Dashboard

**Route:** `/dashboard` (or home screen for logged-in users who completed the quiz)

**Layout:**

```
┌─────────────────────────────────────────────────┐
│  Welcome back, Troy                             │
│  Your profile: Investor · Growth + Cash Flow    │
│  Budget: $200-400K · Open to anywhere     [Edit]│
├─────────────────────────────────────────────────┤
│                                                 │
│  YOUR TOP 10 MARKETS                            │
│  ┌──────────────────────────────────────────┐   │
│  │ 1. Huntsville, AL    Match: 94  PIQ: 82  │   │
│  │    "Strong rental yield (6.2%) with      │   │
│  │     rising demand and prices well within  │   │
│  │     your range..."            [View →]   │   │
│  ├──────────────────────────────────────────┤   │
│  │ 2. Knoxville, TN     Match: 91  PIQ: 78  │   │
│  │    "Affordable entry + 5.8% forecast     │   │
│  │     growth..."                [View →]   │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  MARKETS TO WATCH  (score improving toward fit) │
│  ┌──────────────────────────────────────────┐   │
│  │ Durham, NC  Match: 72 ↑+6  "Trending..." │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  YOUR WATCHLIST UPDATES                         │
│  Austin: PIQ 78→81 ↑ · Denver: PIQ 74→72 ↓    │
│                                                 │
├─────────────────────────────────────────────────┤
│  [Explore Map]  [Generate Report]  [Edit Prefs] │
└─────────────────────────────────────────────────┘
```

### Archetype-Based AI Explanations

Instead of generating per-user, define ~8-12 archetypes from quiz combinations (e.g., "Growth Investor, $200-400K" or "First-time Buyer, Affordability-focused, Southeast"). Generate match explanations per archetype x market during the monthly batch. Most users map to the same handful of archetypes.

**Cost:** ~12 archetypes x 50 top markets x ~150 tokens = ~90K tokens/month ≈ **$0.01/mo with DeepSeek.**

### Tier Gating

Configured via entitlements admin. Enforced via `useEntitlements()` / `<EntitlementGate>`.

**Design intent for entitlements configuration:**

| Feature            | Free                   | Pro                     |
| ------------------ | ---------------------- | ----------------------- |
| Quiz               | Full access            | Full access             |
| Match Score        | See top 3 markets only | All markets             |
| Dashboard          | Top 3 + blurred 4-10   | Full top 10 + watchlist |
| Match explanations | First sentence only    | Full text               |
| Match on map       | Metro only             | All geo levels          |
| "Markets to Watch" | Hidden                 | Visible                 |

### New Infrastructure

| Component                                   | Layer                                     | Effort |
| ------------------------------------------- | ----------------------------------------- | ------ |
| `user_preferences` table                    | Database                                  | Small  |
| Onboarding quiz UI (4-5 step flow)          | Frontend                                  | Medium |
| `UserPreferencesService`                    | Backend                                   | Small  |
| Market Match calculation endpoint           | Backend                                   | Medium |
| `useMarketMatch` hook                       | Frontend data layer                       | Small  |
| `/dashboard` page                           | Frontend                                  | Medium |
| Archetype-based insight generation          | Backend (piggyback on Section 1 pipeline) | Small  |
| Account settings "Edit Preferences" section | Frontend                                  | Small  |

---

## 3. Content & Shareability Engine

### Purpose

AI-generated content that compounds over time — SEO pages for organic traffic, shareable artifacts for viral loops, lead magnets for email capture.

### Part 3A: Enhanced Market Landing Pages

**Existing:** `/markets/[slug]` pages with scores + metrics.

**Enhancement:** Each page gets a rich AI-written market analysis (500-800 words) updated monthly.

**Content structure:**

- Market Overview (current state, score context)
- Key Trends (data table with YoY changes)
- Who Is This Market For? (buyer vs investor fit)
- Outlook (forecast-based forward look)
- Sources & last updated date
- CTAs: "Create Free Report" / "View on Map"

**Generation:** Monthly batch (DeepSeek), ~900 metros x ~800 tokens = ~720K tokens ≈ **$0.10/mo.**

**SEO value:** 900+ pages with unique, data-driven, monthly-refreshed content targeting long-tail searches ("Austin TX real estate market 2026").

### Part 3B: Social OG Cards

Dynamic Open Graph preview images when markets or reports are shared on social media.

**Implementation:**

- Dynamic OG image generation via `@vercel/og` or serverless image endpoint
- Shows: score ring + key metric + one-liner insight (from cached insights)
- Adds `<meta property="og:image">` dynamically per route
- Works for: market pages, shared reports, score pages

**Cost:** Zero AI cost (reuses cached insights). Image generation is CPU only.

### Part 3C: Free Report Lead Magnet

Lightweight 2-page "Market Snapshot" PDF available without login — captures email first.

**Flow:**

```
/markets/[slug] → "Get Free Market Report" button
  → Email capture modal (name + email)
  → Generates 2-page PDF:
      Page 1: Scores + key metrics + trend chart
      Page 2: AI market overview (reuses landing page content)
      Footer: "Get the full 12-page report with PropertyIQ Pro"
  → Sent to email + available for download
  → User added to Resend audience
```

**No new AI generation** — PDF pulls from monthly-cached market page content + existing scores.

### Part 3D: Embeddable Score Widget

Small `<iframe>` snippet for real estate agents, bloggers, analysts to embed on their sites.

```html
<iframe
  src="https://propertyiq.com/embed/score/metro/31080"
  width="300"
  height="180"
  frameborder="0"
></iframe>
```

Displays: market name, score ring, trend arrow, "Powered by PropertyIQ" link (backlinks = SEO).

**Implementation:** New `/embed/score/[geoLevel]/[geoId]` route (lightweight, no nav). Public, read-only.

### Part 3E: Auto-Generated Blog Posts

Monthly data-driven articles published to `/blog`:

- "Top 10 Markets for Homebuyers — March 2026"
- "Top 10 Markets for Investors — March 2026"
- "Markets to Watch: Biggest Score Movers This Month"

**Current blog system:** 4 hand-written MDX files in `content/blog/`. No CMS, no auto-generation.

**Approach:** Generate draft MDX files from scoring data + templates via DeepSeek. Either:

- Output to `content/blog/` as new MDX files for review before committing (file-based workflow)
- Or evolve to DB-backed blog with admin "Generate + Review + Publish" workflow

**Cost:** ~3 posts x ~1500 tokens = ~4,500 tokens/mo ≈ **negligible.**

### Cost Summary

| Component                   | AI Model            | Frequency | Cost/mo         |
| --------------------------- | ------------------- | --------- | --------------- |
| Market landing page content | DeepSeek            | Monthly   | ~$0.10          |
| Social OG cards             | None (reuses cache) | On-demand | $0              |
| Free report lead magnet     | None (reuses cache) | On-demand | Email cost only |
| Embeddable score widget     | None                | Real-time | $0              |
| Monthly blog posts          | DeepSeek            | Monthly   | ~$0.01          |

---

## 4. Email Strategy

### Principles

**Personable, not corporate.** Every email should feel like it's from a knowledgeable friend, not a SaaS notification.

- First name always ("Hey Troy," not "Dear User")
- Conversational tone ("Your top market jumped 6 points" not "We are pleased to inform you of score changes")
- Brief — one clear takeaway per email
- Opinionated where data supports it ("This is worth watching")

### Personalization Layers

| Layer                         | Example                                                      | Data Source            | Available When         |
| ----------------------------- | ------------------------------------------------------------ | ---------------------- | ---------------------- |
| Name + tier                   | "Hey Troy" / "as a Pro member"                               | User profile           | Day 1                  |
| Watchlist-aware               | "Austin, one of your watched markets..."                     | Watchlist              | After first save       |
| Quiz-aware                    | "Since you're focused on cash flow..."                       | Approach B preferences | After quiz             |
| Behavior-aware                | "You've been looking at Texas metros..."                     | Analytics events       | After usage tracking   |
| AI-written personal narrative | 2-3 sentences tying their priorities to this month's changes | DeepSeek per archetype | After Approach B ships |

### Phase 1: Onboarding Drip (ships independently)

Educational sequence for new signups. Static templates, no AI cost.

| Day | Email                                                    | Purpose                            |
| --- | -------------------------------------------------------- | ---------------------------------- |
| 0   | Welcome + quick start                                    | Get them to the map                |
| 1   | "Here's how to read your scores"                         | Education                          |
| 3   | "Did you know you can compare markets?"                  | Feature discovery                  |
| 7   | "Complete your profile for personalized recommendations" | Drive quiz completion (Approach B) |
| 14  | "Your first market report is free"                       | Drive report generation            |

### Phase 2: Monthly Personalized Digest (ships after Approach B)

Tied to the monthly scoring refresh. Uses quiz preferences + watchlist + cached insights.

**Example:**

> **Hey Troy,**
>
> Your March market update is here. Since you're focused on **growth + cash flow in the $200-400K range**, here's what moved:
>
> **Your #1 match shifted.** Huntsville, AL (Match: 94) held the top spot, but Knoxville gained 6 points and is closing in. Rental yields in both markets remain above 5.5%.
>
> **Watchlist movers:**
>
> - Austin: HomeReady 78 → 81 ↑ (affordability improving)
> - Denver: HomeReady 74 → 72 ↓ (inventory tightening)
>
> **One to watch:** Durham, NC just crossed into your top 10 — driven by job growth (+3.2% YoY) and entry prices well within your range.
>
> [View your dashboard →]
>
> — PropertyIQ

**AI component:** The "one to watch" paragraph is generated per archetype during the monthly batch (same pipeline as Section 1 insights). Everything else is template interpolation.

### Phase 3: Threshold Alerts (ships after alert UI)

Event-driven: triggered when a score crosses a user-defined threshold during the monthly refresh.

- "Austin just crossed 80 on HomeReady — the first time in 12 months"
- "A market on your watchlist dropped below your alert threshold"

**Requires:** Alert threshold UI in watchlist settings.

---

## 5. Custom Research Briefs

### Purpose

Users ask a real estate question in plain language and receive a polished, data-grounded research document. Positioned as a new report template within the existing reports infrastructure.

### Flow

```
/reports → "New Report" → "Custom Research" template
  → 3-5 suggested topics (contextual) + freetext option
  → User picks or types topic
  → Claude generates 2-3 clarifying questions (rendered as chips/buttons)
  → User answers
  → Generation kicks off:
      1. Claude (tool-use) interprets question + answers → pulls relevant data
      2. ClaudeNewsService fetches relevant local + national news
      3. DeepSeek generates narrative sections around structured data + news
  → Research Brief rendered as report:
      - Executive Summary
      - Data Analysis (tables, comparisons, charts)
      - Recent Developments (local + national news)
      - Outlook & Recommendations
      - Sources & Confidence Indicators
  → Stored as report, shareable, downloadable as PDF
```

### Suggested Topics (contextual, no AI)

Dynamic suggestions based on what we know about the user:

| If we know...             | Suggested Topics                                                                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| They have a watchlist     | "Compare your watched markets head-to-head" · "Risk assessment for [#1 watchlist market]"                                                                                                                 |
| They completed the quiz   | "Best markets for your profile under $X" · "Cash flow deep dive for [top match market]"                                                                                                                   |
| They just viewed a market | "Full investment analysis for [viewed market]" · "How does [market] compare to similar metros?"                                                                                                           |
| Nothing yet (new user)    | "Best markets for first-time buyers in 2026" · "Top cash flow markets under $300K" · "Is now a good time to buy?" · "Emerging markets showing early momentum" · "Rental market outlook for the Southeast" |

### Clarifying Questions

After user picks/types a topic, Claude asks 2-3 quick multiple-choice questions before generating. Rendered as chip buttons, not a chat UI. Max 3 questions. Each has an "Other" freetext option. Should feel like ~15 seconds.

**Example:**

```
User: "Best cash flow markets under $300K"

Claude asks:
  1. Property type?  [Single-family] [Multi-family] [Both]
  2. Geographic preference?  [Southeast] [Midwest] [Southwest] [No preference]
  3. What matters more?  [Highest yield now] [Yield + appreciation balance] [Low vacancy risk]
```

### News Integration

The existing `ClaudeNewsService` already discovers local market news, economic indicators, and national context. Wired into the research brief:

- After Claude decides which markets to research, fetch news for those geographies
- News gets its own "Recent Developments" section
- Also feeds into narrative context ("Austin's score improvement coincides with three major employer expansions in Q1 2026")
- Sources linked and dated for credibility

### Architecture

Lives within existing reports infrastructure:

- New report template type: `custom_research`
- Reuses: report storage, sharing, PDF generation, conversation follow-ups
- New: agentic data gathering step (Claude tool-use, similar to Quinn's architecture but outputting structured data instead of chat responses)

### Tier Gating

Configured via entitlements admin. Design intent: Pro+ feature. Free users see the template option but receive upgrade prompt.

### Cost

One Claude call for data gathering (~$0.01-0.03 per brief) + one DeepSeek call for narrative (~$0.005). **~$0.02-0.04 per brief.** At 100 briefs/mo across all users = $2-4/mo.

---

## Verification Standard (Hard Gate)

**No feature is complete until it works end-to-end with real production data.** No mocks, no stubs, no placeholder text. Every phase ends with a live verification step that must pass before moving on.

This means:

- Insights generated from actual Zillow/Redfin/Census/FRED scores in the database
- Match scores calculated against real metro/county/ZIP data
- Research briefs pulling from live backend APIs and returning real market numbers
- Emails sent through Resend with real user data (staging environment first, then production)
- OG cards rendering real scores and insights
- Market landing pages showing actual AI-generated content derived from real metrics
- Blog posts grounded in live scoring data, not fabricated examples

**Per-feature verification checklist (applied to every item below):**

1. Feature works locally against staging/production database
2. AI-generated content references real, verifiable numbers (spot-check 3+ markets)
3. Data layer integration confirmed (no direct fetch calls, uses `@/lib/data` or backend services)
4. Entitlements gating verified (free vs pro behavior confirmed in browser)
5. Feature deployed to staging and smoke-tested by a real user account

---

## Implementation Sequence

### Phase 1: Foundation (Weeks 1-3)

1. **Ambient Intelligence** — `InsightGenerationService`, `market_insights` table, monthly batch pipeline, `useInsight` hook, integration into map right panel + score cards
2. **Onboarding Drip Emails** — static templates, Resend integration, day 0/1/3/7/14 sequence

**Live verification gate:**

- [ ] Run insight generation against all ~900 metros in staging DB; spot-check 10 metros for accuracy (numbers match actual scores)
- [ ] Insights render correctly in map right panel and score cards with real data
- [ ] Free user sees truncated insight; Pro user sees full insight
- [ ] All 5 onboarding emails send successfully via Resend to a real test account
- [ ] Email personalization (first name, tier) renders correctly

### Phase 2: Personalization (Weeks 4-7)

3. **Onboarding Quiz** — `user_preferences` table, quiz UI, account settings integration
4. **Market Match Score** — calculation endpoint, `useMarketMatch` hook, map toggle, right panel integration
5. **Personalized Dashboard** — `/dashboard` page, top 10 markets, watchlist updates, archetype-based explanations

**Live verification gate:**

- [ ] Quiz saves preferences to DB; preferences editable from account settings
- [ ] Match score calculated for a real user profile against all metros; top 10 results make intuitive sense (e.g., "cash flow + $200-400K" returns affordable high-yield markets, not Manhattan)
- [ ] Map choropleth toggles between PIQ score and Match score with real data
- [ ] Dashboard renders top 10 with real scores, real match values, and real AI explanations
- [ ] Archetype-based explanations reference actual metro names and real metric values
- [ ] Free user sees top 3 + blurred 4-10; Pro sees all 10

### Phase 3: Content & Growth (Weeks 8-11)

6. **Enhanced Market Landing Pages** — monthly AI content generation for `/markets/[slug]`
7. **Social OG Cards** — dynamic image generation per route
8. **Free Report Lead Magnet** — email capture modal, 2-page PDF generation
9. **Monthly Personalized Digest Email** — ties into Approach B data

**Live verification gate:**

- [ ] Market page AI content generated for all ~900 metros; spot-check 10 for factual accuracy against DB values
- [ ] OG card renders correct score + insight when sharing a market URL on Twitter/LinkedIn (test with actual social preview tool)
- [ ] Lead magnet PDF generated for 3+ metros; numbers in PDF match live data
- [ ] Email captured via lead magnet appears in Resend audience
- [ ] Monthly digest email sent to real test account with real watchlist + match data; all numbers verifiable

### Phase 4: Premium Features (Weeks 12-15)

10. **Custom Research Briefs** — agentic data gathering, clarifying questions UI, news integration, new report template
11. **Embeddable Score Widget** — `/embed/score/` route
12. **Auto-Generated Blog Posts** — monthly generation pipeline
13. **Threshold Alerts** — alert threshold UI, event-driven email triggers

**Live verification gate:**

- [ ] Research brief generated for 3+ different question types; all numbers in output verified against live API responses
- [ ] Clarifying questions render as chips; user answers flow into generation correctly
- [ ] News section includes real, dated, sourced news items (not fabricated)
- [ ] Brief stored as report, shareable via link, downloadable as PDF — all with real data
- [ ] Embeddable widget renders live score for any valid metro when embedded in an external HTML page
- [ ] Blog posts generated from real scoring data; all rankings and numbers match `propertyiq_scores` table
- [ ] Threshold alert fires correctly when a real score crosses a user-defined threshold after a scoring refresh

---

## Total Estimated AI Cost

| Feature                              | Model             | Monthly Cost  |
| ------------------------------------ | ----------------- | ------------- |
| Ambient insights (900 metros)        | DeepSeek          | ~$0.12        |
| Archetype match explanations         | DeepSeek          | ~$0.01        |
| Market landing page content          | DeepSeek          | ~$0.10        |
| Blog post generation                 | DeepSeek          | ~$0.01        |
| Monthly email digest narrative       | DeepSeek          | ~$0.01        |
| Custom research briefs (est. 100/mo) | Claude + DeepSeek | ~$3.00        |
| **Total**                            |                   | **~$3.25/mo** |

All tier gating configured via the entitlements admin system (source of truth) and enforced via existing `useEntitlements()` / `<EntitlementGate>` infrastructure. No hardcoded tier checks.
