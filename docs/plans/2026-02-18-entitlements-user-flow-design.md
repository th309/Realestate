# PropertyIQ Entitlements Audit & User Flow Optimization — Design Document

**Date:** 2026-02-18
**Status:** Approved
**Context:** Pre-launch. No existing users. All changes are safe to make without migration.
**Scale Target:** ~2,000 concurrent users at launch.

---

## Table of Contents

1. [Audit Summary](#1-audit-summary)
2. [Design Decisions](#2-design-decisions)
3. [Tier Access Matrix](#3-tier-access-matrix)
4. [User Flows](#4-user-flows)
5. [Gating UI Components](#5-gating-ui-components)
6. [Stripe Integration & Upgrade Flow](#6-stripe-integration--upgrade-flow)
7. [Retention Features](#7-retention-features)
8. [Weekly Digest Email](#8-weekly-digest-email)
9. [Caching & Scale](#9-caching--scale)
10. [Analytics Events](#10-analytics-events)
11. [Success Metrics](#11-success-metrics)

---

## 1. Audit Summary

### What's Built (and solid)

- **Feature matrix system** — 40+ features across 8 categories (analytics, persistence, alerts, export, collaboration, metrics, geography, preview), database-driven via `subscription_tiers`, `feature_definitions`, and `tier_features` tables.
- **Entitlements context** — React Context provider (`EntitlementsContext.tsx`) with `useEntitlements()` hook, `canAccess()`, `getAccess()`, `isMetricGated()`, paywall event tracking, 30-minute refresh, dev mode simulation via `?tier=` URL param.
- **Paywall components** — `PaywallOverlay`, `PaywallCard`, `ScorePaywall`, `InsightsPaywall`, `EntitlementGate`, `ScoreCard` with `TeaserOverlay`. Located in `packages/frontend/components/entitlements/`.
- **Score visualization** — Full suite: `ScoreDisplay` (circular gauge), `ScoreBadge` (compact with lock icon), `ScoreCard` (expandable with teaser overlay), `ScoreWidget` (auto-fetching wrapper), `ScoreGaugeCard`, `SidebarScoreCard` (carousel). Located in `packages/frontend/app/components/scoring/`.
- **Data layer** — 180+ metrics in centralized registry (`lib/data/registry.ts`), comprehensive fetcher/hook system (`fetchSnapshotData`, `fetchTimeSeriesData`, `fetchScore`, `useDataCard`, `useMetricAccess`), React Query + Redis caching.
- **Trial system** — 14-day pro trial config via `trial_config` table, per-user trial records in `user_trials`, trial banner on pricing page.
- **Grandfathering** — Full system for preserving features on tier changes (`user_grandfathering` table, `grandfathering.service.ts`).
- **Admin tools** — Tier editor (`/dev/admin/entitlements/tiers`), feature matrix, trial config, paywall analytics dashboard, user management.
- **Report builder** — Wizard flow, 95+ section components, single and comparison report support.
- **Backend entitlements** — `entitlements.service.ts` resolves access via: user override > grandfathering > tier features > defaults. `scoring.guard.ts` controls score access with teaser/full responses.

### What's Missing (to be built)

1. **Stripe integration** — Env vars defined (`STRIPE_SECRET_KEY`, etc.), zero implementation. No checkout, webhooks, billing portal, or subscription lifecycle management.
2. **Unauthenticated data access** — No search-first flow. Currently requires account context for any data.
3. **Saved markets / watchlist UI** — DB schema exists (`watchlist_enabled`, `watchlist_limit` features) but no frontend components or API endpoints.
4. **Alert system** — DB schema exists (`alerts_enabled`, `alerts_limit` features) but no user-facing implementation, no alert processing job.
5. **Benchmarking** — No "ZIP vs County average" comparisons on metrics. No `favorableDirection` field in metric registry.
6. **Weekly digest email** — No email service integration, no digest job, no email preferences.
7. **Markets to Watch recommendations** — No recommendation algorithm or UI.
8. **Score visibility change** — `scoring.guard.ts` fully gates HomeReady/InvestorEdge to Pro+. Needs to return score values to all tiers with gated breakdown.
9. **Analytics events** — `paywall_events` table exists but event coverage is incomplete. No conversion funnel, feature usage, or engagement tracking.

### Known DB Issues to Fix Pre-Launch

- Duplicate features in `feature_definitions` (need cleanup)
- Type mismatches in some `tier_features` values
- Hardcoded tier in `StepTemplate` (line 196)
- `preview_metrics_limit` and `preview_markets_limit` exist but enforcement is incomplete
- Pricing page partially hardcoded — should read from `subscription_tiers` table

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Score visibility | Gauge + grade + number visible to ALL tiers; breakdown gated to Pro+ | Scores are the hook. Showing them creates curiosity about "why." Gating the breakdown drives upgrades. |
| Free tier model | More metrics, less geography. 10 headline metrics at National/State. Metro scores visible, metrics blurred. County/ZIP locked. | Geographic depth is the natural upgrade lever for real estate. Broader surface data validates the platform's quality. |
| Metro scores for Free | Free users see score gauge + grade at Metro level (no breakdown) | Scores only exist at Metro/County/ZIP. Without Metro score visibility, Free users would never see a score. |
| Unauthenticated access | Search-first flow. Visitors see data before signup. | Highest conversion potential. See data → want more → sign up. |
| Stripe approach | Stripe Checkout (hosted page) | Minimal frontend work, PCI-compliant out of the box, handles billing portal. Fastest to ship. |
| Historical trends | Free: 12 months, Pro: 10 years, Enterprise: max available | Real estate investors need multi-year cycle data. 10 years covers 2 full cycles. |
| All limits configurable | Every limit stored in `tier_features`, editable via admin UI | Business can adjust without code deploys. |
| Implementation approach | Update existing config + fix known issues + build missing features. No architectural rebuild. | Existing entitlements system is well-built. The problem is configuration values and missing features, not architecture. |
| AI feature rate limits | Reports and AI analysis rate-limited per month | AI APIs have per-request costs. Limits are configurable and can be adjusted post-launch. |

---

## 3. Tier Access Matrix

All values stored in `tier_features` table and configurable via admin UI.

### Score Access

| Score | Free / Unauth | Pro | Enterprise |
|-------|--------------|-----|------------|
| Market Health | Full (gauge + grade + breakdown) | Full | Full |
| HomeReady | Gauge + grade + number only | Full (gauge + grade + breakdown + history) | Full + component weights |
| InvestorEdge | Gauge + grade + number only | Full (gauge + grade + breakdown + history) | Full + component weights |

*Scores only exist at Metro, County, and ZIP levels.*

### Geography Access

| Geo Level | Free / Unauth | Pro | Enterprise |
|-----------|--------------|-----|------------|
| National | Full headline metrics | Full all metrics | Full |
| State | Full headline metrics | Full all metrics | Full |
| Metro | Scores visible + headline metrics blurred | Full all metrics + scores | Full |
| County | Locked with contextual CTA | Full | Full |
| ZIP | Locked with contextual CTA | Full | Full |
| Tract | N/A | N/A | Full |

### Headline Metrics (Free at National/State — ~10)

1. `home_value` — Median Home Value
2. `home_value_yoy` — Home Value YoY Change
3. `median_listing_price` — Median Listing Price
4. `median_income` — Median Household Income
5. `population` — Population
6. `population_growth` — Population Growth
7. `inventory` — Active Inventory
8. `days_on_market` — Days on Market
9. `homeownership_rate` — Homeownership Rate
10. `unemployment` — Unemployment Rate

### Feature Access

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Reports | 2 preview | 10/month | 50/month |
| AI Market Analysis | 0 | 20/month | Unlimited |
| Saved Markets | 1 | 20 | Unlimited |
| Alerts | 0 | 5 | Unlimited |
| Market Comparison | 0 | 5 markets | Unlimited |
| CSV Export | No | Yes | Yes |
| API Access | No | No | Yes |
| Analytics Assistant | No | 20 queries/day | Unlimited |
| Score Breakdown | Market Health only | All scores, top factors | All + component weights |
| Historical Trends | 12 months | 10 years | Max available |
| Weekly Digest Email | No | Yes | Yes |
| Team Features | No | No | Yes (25 seats) |

---

## 4. User Flows

### 4.1 Unauthenticated Visitor Flow

```
Landing page (propertyiq.com)
  → Prominent search bar: "Search any market — ZIP, city, metro, or state"
  → User searches "Austin" or "60614"
  → Results page:
      • Breadcrumb: United States > Texas > Austin-Round Rock Metro
      • HomeReady + InvestorEdge scores VISIBLE (gauge + grade, no breakdown)
      • Market Health score with full breakdown
      • 10 headline metrics at National/State level (full values)
      • Metro headline metrics BLURRED with "Create free account to see metro data"
  → User can view 2-3 markets before soft gate:
      "You've explored 3 markets. Create a free account to keep going."
  → Signup: email + password (minimal friction)
  → Redirect back to the SAME market they were viewing (preserve context)
```

### 4.2 Free User Flow (Authenticated)

```
Login → Dashboard
  → "Your Markets" section (1 saved market or empty state with search prompt)
  → Search / explore markets
  → National + State: full 10 headline metrics
  → Metro: scores visible (gauge + grade) + headline metrics BLURRED
      • "Go Pro to see Austin metro market data →"
  → County/ZIP: LOCKED with contextual message
      • "Go Pro to explore neighborhoods in Cook County →"
  → Score breakdown click → "See what's driving this score → Go Pro"
  → Second save attempt → "Save unlimited markets with Pro →"
```

### 4.3 Pro User Flow (First Session After Upgrade)

```
Post-Stripe-Checkout redirect
  → Land on the SPECIFIC market/element they were trying to access
      (e.g., if they clicked "Unlock ZIP 60614", go straight to ZIP 60614)
  → Dismissible "What's new with Pro" highlights:
      • "Full metro, county, and ZIP data"
      • "Score breakdowns showing what drives each score"
      • "Set up alerts to track your markets"
      • "Save up to 20 markets to your watchlist"
  → Prompt: set up first alert or save a market (activation)
```

### 4.4 Pro User Ongoing Flow

```
Dashboard
  → Saved Markets watchlist with score trends + headline changes
  → Alert feed: recent triggered alerts
  → "Markets to Watch" suggestions

Market View (any geo level)
  → Full drill-down: National → State → Metro → County → ZIP
  → All metrics with benchmarking (ZIP vs County avg, County vs Metro avg)
  → Score breakdowns: top contributing factors with direction
  → Historical trend charts (10-year lookback)
  → Comparison view: side-by-side 2-5 markets
```

### 4.5 Enterprise Additions

```
Everything Pro gets, plus:
  → Full component weights on all scores
  → Forecast metrics (1m/3m/12m predictions)
  → Tract-level data
  → API access for programmatic data pulls
  → Branded/custom report generation (50/month)
  → Team features: 25 seats, shared watchlists, team alerts
  → Max available historical data
```

---

## 5. Gating UI Components

Four distinct gating states, each with a reusable component. All components:
- Read from `useEntitlements()` context (never hardcode tier checks)
- Track events via `paywall_events` table (view, click_upgrade, dismiss)
- Accept `onUpgradeClick` callback that navigates to Stripe Checkout with context
- Pull upgrade copy from a config object (editable from admin), not hardcoded strings

### 5.1 `BlurredTeaser` — Metro metrics on Free tier

Shows the actual data layout with a frosted blur overlay. User can see data exists and the page structure, but can't read values.

- Content rendered behind `backdrop-blur-md`
- Overlay card centered:
  - Context: "Austin-Round Rock Metro has 12 key metrics"
  - Value: "See how this market compares across affordability, demand, and growth"
  - CTA: "Go Pro to unlock metro data →"
- Tracks `paywall_view` with `resource_type: 'geo'`, `resource_id: 'metro'`

### 5.2 `GeoLockCard` — County/ZIP on Free tier

Hard lock — no blur, no teaser data. Clean card explaining what's behind the gate.

- Lock icon + geography name they tried to access
- "Go Pro to explore [Cook County / ZIP 60614]"
- 2-3 bullet points of what they'd see (scores, metrics, benchmarks)
- CTA: "Go Pro →"
- Tracks `paywall_view` with `resource_type: 'geo'`, `resource_id: 'county'` or `'zip'`

### 5.3 `ScoreBreakdownGate` — Score details on Free tier

Score gauge + grade + number fully visible. Breakdown section below is gated.

- Score gauge renders normally (all tiers)
- Below the gauge, where components would show:
  - Light surface card with lock icon
  - "This score is driven by 5 factors. The top driver is [blurred word]."
  - CTA: "See what's driving this score → Go Pro"
- Tracks `paywall_view` with `resource_type: 'feature'`, `resource_id: 'score_breakdown'`

### 5.4 `ContextualUpgradeCTA` — Inline feature gates

Appears inline where the action would happen (not a modal). Pattern: `[What they tried] + [What they'd get] + [CTA]`.

Examples:
- **Save:** "Track all your target markets in one place. → Go Pro to save up to 20 markets"
- **Alert:** "Get notified when metrics cross your thresholds. → Go Pro to set up alerts"
- **Export:** "Download this data as CSV. → Go Pro to export"
- **Comparison:** "Compare markets side-by-side. → Go Pro to unlock comparisons"

Tracks `paywall_view` with `resource_type: 'feature'`, `resource_id: '<feature_slug>'`

---

## 6. Stripe Integration & Upgrade Flow

### 6.1 Stripe Setup

- 3 Stripe Products: Free (no price), Pro, Enterprise
- Each paid product has 2 Prices: monthly and yearly
- New columns on `subscription_tiers`: `stripe_product_id`, `stripe_price_monthly_id`, `stripe_price_yearly_id`

### 6.2 Backend Endpoints

```
POST /api/billing/checkout
  Body: { tier: 'pro'|'enterprise', interval: 'month'|'year', returnContext?: string }
  → Creates Stripe Checkout Session
  → returnContext encodes where the user was (e.g., "zip:60614", "score:homeready:12420")
  → Returns { checkoutUrl }

POST /api/billing/webhook
  → Stripe webhook handler (signature-verified)
  → Events handled:
    • checkout.session.completed → update user tier, set subscription_status = 'active'
    • customer.subscription.updated → handle plan changes
    • customer.subscription.deleted → downgrade to free
    • invoice.payment_failed → flag subscription, notify user

GET /api/billing/portal
  → Creates Stripe Billing Portal session
  → Returns { portalUrl }
```

### 6.3 Frontend Upgrade Flow

```
User hits gating component → clicks CTA
  → POST /api/billing/checkout with { tier, interval, returnContext }
  → Redirect to Stripe Checkout (hosted page)
  → User completes payment
  → Stripe redirects to /upgrade/success?session_id=xxx&context=zip:60614
  → Success page:
    1. Verify session & sync tier via backend
    2. Refresh entitlements context immediately
    3. Redirect to returnContext location (ZIP 60614, now unlocked)
```

### 6.4 Pricing Page

- `/pricing` shows tier comparison cards (already built, needs to read from DB instead of hardcoded values)
- Monthly/yearly toggle
- "Start Pro" / "Start Enterprise" → Stripe Checkout flow
- If user already has a plan → "Manage Subscription" → Stripe Billing Portal

### 6.5 Account Billing Page

New `/account/billing` page:
- Current plan + renewal date
- "Manage Subscription" → Stripe Billing Portal
- Usage stats: reports this month, AI analyses used, saved markets count

### 6.6 Subscription Lifecycle

| Event | Action |
|-------|--------|
| Checkout complete | Set tier, subscription_status = 'active' |
| Payment failed | subscription_status = 'past_due', show banner in app |
| Subscription canceled | Schedule downgrade to free at period end |
| Period ends (canceled) | Set tier to 'free', subscription_status = 'canceled' |
| Plan upgraded | Update tier immediately |
| Plan downgraded | Apply at end of current period |
| Trial started | Set trial record, tier via trial |
| Trial expired | Fall back to subscription_tier |

---

## 7. Retention Features

### 7.1 Saved Markets / Watchlist

**Database:**
- `user_watchlist` table: `user_id`, `geography_type`, `geography_id`, `geography_name`, `added_at`
- Limit enforced by `watchlist_limit` feature (Free: 1, Pro: 20, Enterprise: unlimited)

**Backend:**
```
GET    /api/watchlist              → list saved markets
POST   /api/watchlist              → add market { geoType, geoId }
DELETE /api/watchlist/:id          → remove market
GET    /api/watchlist/summary      → scores + headline changes for all saved markets
```

The `/summary` endpoint batch-fetches current scores and compares to 30 days ago for each saved market. Returns score direction (up/down/stable) and top metric change. Powers the dashboard.

**Frontend:**
- Save heart/bookmark icon on every market view header
- Dashboard "Your Markets" cards: score gauge, trend arrow, top changed metric per market
- Click card → full market view
- Save beyond limit → `ContextualUpgradeCTA`

### 7.2 Alert System

**Database:**
- `user_alerts` table: `user_id`, `geography_type`, `geography_id`, `metric_id`, `condition` (above/below/crosses), `threshold`, `is_active`, `last_triggered_at`, `created_at`
- `alert_history` table: `alert_id`, `triggered_at`, `metric_value`, `notified_via` (email/in-app/both)
- Limit enforced by `alerts_limit` feature (Free: 0, Pro: 5, Enterprise: unlimited)

**Backend:**
```
GET    /api/alerts                 → list user's alerts
POST   /api/alerts                 → create alert
PATCH  /api/alerts/:id             → update (threshold, active/inactive)
DELETE /api/alerts/:id             → delete
GET    /api/alerts/history         → triggered alert history
```

**Alert Processing:**
- Scheduled cron job runs when new data lands (monthly/weekly sources)
- For each active alert: fetch current metric, compare to threshold
- If triggered: insert to `alert_history`, send email, create in-app notification
- Deduplication: don't re-trigger if value unchanged since last trigger

**Frontend:**
- Alert bell in nav with unread count badge
- On any metric card: "Set alert" → form with condition + threshold
- `/alerts` page: active alerts + triggered history
- Each triggered alert deep-links to the relevant market + metric

### 7.3 Benchmarking

Every metric at every geography shows how it compares to the parent geography.

**Backend:**
```
GET /api/benchmarks/:geoLevel/:geoId?metrics=home_value,days_on_market
  → Returns per metric:
    {
      metricId: "days_on_market",
      value: 22,
      parentGeo: { level: "county", id: "17031", name: "Cook County" },
      parentValue: 35,
      diff: -37.1,
      direction: "better",
      percentile: 18
    }
```

**"Better/worse" determination:**
- New `favorableDirection` field on metric registry: `'higher'` | `'lower'` | `'neutral'`
- Benchmarking service uses this to label comparisons

**Frontend:**
- Every metric card in Pro+ views gets a benchmark badge:
  - Green: "↓ 37% vs Cook County" (favorable)
  - Red: "↑ 12% vs Cook County" (unfavorable)
  - Gray: "≈ County avg" (within 5%)
- Expandable detail: parent value, sibling percentile rank, mini distribution chart
- Pro+ only (Free can't access County/ZIP, and Metro lacks meaningful parent benchmark at headline level)

### 7.4 Score Trend Tracking

Historical score visualization largely exists already (`ScoreHistoryChart`). What's needed:

- **Dashboard sparklines**: 6-month score trend per saved market on watchlist summary
- **Score change alerts**: Integrate with alert system — "Alert me when InvestorEdge drops below 70"
- **Score direction on market cards**: Trend arrow (↑/↓/→) next to each score based on 30-day change
- **Historical lookback tiers**: Free = 12 months, Pro = 10 years, Enterprise = max available

### 7.5 "Markets to Watch" Recommendations

**Backend:**
```
GET /api/recommendations/markets-to-watch
  → Returns 5-10 markets based on:
    1. Same geo type as user's saved markets
    2. Similar score profiles (within ±15 points)
    3. Rising scores (positive 30-day trend)
    4. Not already in watchlist
  → Each: geoId, geoName, geoType, scores, topReason
```

**Algorithm (v1):**
1. Extract score ranges from user's saved markets
2. Query same geo level within ±15 score points
3. Filter to positive 30-day trend
4. Exclude watchlist markets
5. Rank by score improvement magnitude
6. Return top 5-10

**Frontend:**
- Dashboard section below watchlist: "Markets to Watch" card carousel
- Each card: market name, score gauges, recommendation reason, "Save" button
- Pro+ only — Free sees teaser: "Go Pro to get personalized market recommendations"

### Retention Loop

```
Data updates (monthly) → Alert processing cron
  → Triggered alerts → Email + in-app notification
    → User opens app → Dashboard:
        • Watchlist with score changes
        • Alert feed
        • Markets to Watch
    → User drills into markets → benchmarking
    → User sets new alerts → cycle continues

Weekly → Digest email
  → Score changes + alerts + recommendation
  → Deep links back to app
```

---

## 8. Weekly Digest Email

### Content Structure

```
Subject: "Your PropertyIQ Weekly Digest — 3 score changes this week"

Sections:
1. SCORE CHANGES
   - Per saved market: score name, old → new, direction, top driver
   - Deep link: [View Market →]

2. TRIGGERED ALERTS (if any)
   - Alert description + current value
   - Deep link: [View Alert →]

3. MARKET TO WATCH (top 1 recommendation)
   - Market name, score highlight, reason
   - Deep link: [Explore Market →]

4. [Open Dashboard →]

Footer: Manage preferences · Unsubscribe
```

### Implementation

**Email Service:** Transactional provider (Resend, SendGrid, or Postmark). Not Supabase email (auth only).

**Database:**
- `email_preferences` table: `user_id`, `weekly_digest` (boolean), `alert_emails` (boolean), `marketing` (boolean)
- Pro+ users default opt-in on signup

**Scheduled Job:**
```
Cron: Every Monday 8am UTC
  → Query all Pro+ users with weekly_digest = true
  → For each: fetch watchlist, compare scores to 7 days ago, get alerts, get recommendation
  → Render and send email
  → Log in email_log table
```

**Deep Links:** All links include UTM params (`?utm_source=digest&utm_medium=email&utm_campaign=weekly`) for analytics.

---

## 9. Caching & Scale

### Key Insight

Market data is the same for all users at the same tier. 2K concurrent users looking at cached endpoints = Redis reads (~100K+ ops/sec capacity). Only per-user data: watchlist, alerts, entitlements.

### Backend Caching (Redis)

| Data Type | TTL | Cache Key Pattern |
|-----------|-----|-------------------|
| Metric snapshots | 6 hours | `snapshot:{metricId}:{geoLevel}:{state?}` |
| Time series | 6 hours | `timeseries:{metricId}:{geoLevel}:{geoId}` |
| Scores | 6 hours | `scores:{geoLevel}:{geoId}` |
| GeoJSON boundaries | 24 hours | `geojson:{geoLevel}:{state?}` |
| Search/market lists | 12 hours | `markets:{geoLevel}` |
| Benchmarks | 6 hours | `benchmark:{geoLevel}:{geoId}` |
| Entitlements (per-tier) | 30 minutes | `entitlements:{tier}` |
| User watchlist | 5 minutes | `watchlist:{userId}` |
| User alerts | 5 minutes | `alerts:{userId}` |
| Recommendations | 1 hour | `recommendations:{userId}` |

### Frontend Caching (React Query)

| Data Type | staleTime | cacheTime | Refetch |
|-----------|-----------|-----------|---------|
| Metric snapshots | 5 min | 30 min | On window focus |
| Time series | 5 min | 30 min | On window focus |
| Scores | 5 min | 30 min | On window focus |
| GeoJSON | 60 min | 24 hours | Never (static) |
| Entitlements | 30 min | 60 min | On focus + post-checkout |
| Watchlist | 1 min | 10 min | On mutation |
| Alerts | 1 min | 10 min | On mutation |

### Bottleneck Mitigations

1. **Entitlements** — Cache by tier (not per-user). Most users share the same tier config. Only check user-specific overrides if the user has overrides.
2. **Score batch queries** — Already paginated. Redis cache covers repeated requests.
3. **GeoJSON** — Large payloads (5-10MB for counties). 24-hour Redis cache + CDN `Cache-Control: public, max-age=86400` (already implemented).
4. **Report generation** — AI calls are slow (5-30s). Rate limits handle cost. Queue with background processing, return "generating" status immediately.
5. **DB connections** — Use connection pooling (PgBouncer / Supabase pooler). With caching, DB sees ~50-100 unique queries/minute, not 2K.

---

## 10. Analytics Events

### Event Schema

Unified `analytics_events` table (extends existing `paywall_events`):

```sql
analytics_events (
  id           UUID PRIMARY KEY,
  user_id      UUID REFERENCES auth.users,  -- nullable for unauth
  session_id   VARCHAR,
  event_type   VARCHAR,     -- category: paywall, conversion, signup, feature, nav, email
  event_name   VARCHAR,     -- specific event name
  properties   JSONB,       -- event-specific data
  user_tier    VARCHAR,
  page_path    VARCHAR,
  created_at   TIMESTAMPTZ DEFAULT NOW()
)
```

### Paywall Events

| Event | Fires When | Properties |
|-------|------------|------------|
| `paywall.view` | Gating component renders | `{ resource_type, resource_id, component_type }` |
| `paywall.upgrade_click` | User clicks upgrade CTA | `{ resource_type, resource_id, cta_text, destination }` |
| `paywall.dismiss` | User navigates away | `{ resource_type, resource_id, time_on_page_ms }` |

### Conversion Funnel

| Event | Fires When | Properties |
|-------|------------|------------|
| `conversion.checkout_start` | Stripe session created | `{ tier, interval, return_context, source_page }` |
| `conversion.checkout_complete` | Payment confirmed | `{ tier, interval, revenue }` |
| `conversion.checkout_abandon` | Return without payment | `{ tier, interval }` |
| `conversion.trial_start` | Trial begins | `{ trial_tier, duration_days }` |
| `conversion.trial_expire` | Trial ends unconverted | `{ trial_tier }` |
| `conversion.trial_convert` | Trial → paid | `{ tier, interval }` |
| `conversion.downgrade` | User cancels | `{ from_tier, to_tier, reason }` |

### Signup Funnel

| Event | Fires When | Properties |
|-------|------------|------------|
| `signup.search_unauth` | Unauth visitor searches | `{ query, matched_geo_type, matched_geo_id }` |
| `signup.market_view_unauth` | Unauth views market | `{ geo_type, geo_id, view_count }` |
| `signup.soft_gate_shown` | "Create account" prompt | `{ markets_viewed }` |
| `signup.form_start` | Signup form opened | `{ source_page }` |
| `signup.form_complete` | Signup completed | `{ source_page, time_to_signup_ms }` |

### Feature Usage

| Event | Fires When | Properties |
|-------|------------|------------|
| `feature.market_save` | Market saved | `{ geo_type, geo_id, total_saved }` |
| `feature.alert_create` | Alert created | `{ metric_id, geo_type, geo_id, condition, total_alerts }` |
| `feature.alert_triggered` | Alert fires | `{ alert_id, metric_id, metric_value }` |
| `feature.report_generate` | Report started | `{ geo_type, geo_id, report_type, monthly_count }` |
| `feature.comparison_create` | Markets compared | `{ market_count, geo_type }` |
| `feature.export_csv` | Data exported | `{ page, data_type }` |
| `feature.score_breakdown_view` | Breakdown expanded | `{ score_type, geo_type, geo_id }` |
| `feature.benchmark_view` | Benchmark viewed | `{ metric_id, geo_type, geo_id }` |

### Navigation & Engagement

| Event | Fires When | Properties |
|-------|------------|------------|
| `nav.geo_drilldown` | Deeper geo nav | `{ from_level, to_level, geo_id }` |
| `nav.geo_drillup` | Breadcrumb up | `{ from_level, to_level }` |
| `nav.search` | Market search | `{ query, result_count, selected_geo_type }` |
| `engagement.session_start` | App opened | `{ source }` |
| `engagement.session_duration` | Session ends | `{ duration_ms, pages_viewed, markets_viewed }` |

### Email Events

| Event | Fires When | Properties |
|-------|------------|------------|
| `email.digest_sent` | Digest sent | `{ markets_count, alerts_count }` |
| `email.digest_opened` | Email opened | `{}` (pixel tracking) |
| `email.digest_clicked` | Link clicked | `{ link_type }` |
| `email.alert_sent` | Alert email sent | `{ alert_id }` |
| `email.alert_clicked` | Alert link clicked | `{ alert_id }` |
| `email.unsubscribe` | Unsubscribe | `{ email_type }` |

### Frontend Implementation

Lightweight `trackEvent(name, properties)` function. Batches events (sends every 5 seconds or on page unload via `navigator.sendBeacon`). POSTs to `POST /api/analytics/events` with bulk insert on the backend.

### Admin Dashboards

1. **Conversion Funnel** — Unauth → signup → free → paywall → checkout → Pro. Drop-off per step.
2. **Paywall Heatmap** — Which resources trigger most views? Highest upgrade CTR? Validates tier boundaries.
3. **Feature Adoption** — % of Pro users using alerts, watchlist, comparisons, reports in first week.
4. **Retention** — Weekly active Pro users, sessions/week, digest open rate, alert-driven sessions.
5. **Revenue** — MRR, conversion rate, churn rate, ARPU, trial conversion rate.

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Free → Pro conversion (30 days) | 5-8% |
| Time to first "aha moment" | < 60 seconds (search → see score) |
| Pro 30-day retention | > 70% active in second month |
| Pro weekly active usage | 2+ sessions/week |
| Upgrade prompt CTR | Track per touchpoint, optimize over time |
| Pro alert adoption (first week) | > 30% configure at least 1 alert |
| Weekly digest open rate | > 40% |
| Digest click-through rate | > 15% |

---

## Appendix: Key File Paths

### Entitlements System (Existing)
- `packages/frontend/lib/entitlements/EntitlementsContext.tsx` — React context
- `packages/frontend/lib/entitlements/api.ts` — API calls + event tracking
- `packages/frontend/lib/entitlements/types.ts` — Type definitions
- `packages/frontend/components/entitlements/` — Paywall components
- `packages/backend/src/entitlements/entitlements.service.ts` — Access resolution
- `packages/backend/src/entitlements/entitlements.controller.ts` — API endpoints
- `packages/backend/src/scoring/scoring.guard.ts` — Score access control
- `packages/backend/src/admin/features/` — Feature/tier CRUD services

### Data Layer (Existing)
- `packages/frontend/lib/data/registry.ts` — Metric definitions (180+)
- `packages/frontend/lib/data/fetchers/` — API fetch functions
- `packages/frontend/lib/data/hooks/` — React hooks
- `packages/frontend/lib/data/hooks/useMetricAccess.ts` — Metric gating hook

### Score Components (Existing)
- `packages/frontend/app/components/scoring/ScoreDisplay.tsx` — Circular gauge
- `packages/frontend/app/components/scoring/ScoreCard.tsx` — Expandable card + teaser
- `packages/frontend/app/components/scoring/ScoreBadge.tsx` — Compact badge
- `packages/frontend/app/components/scoring/ComponentBar.tsx` — Breakdown bars

### Database Migrations (Existing)
- `PropertyIQ/supabase/migrations/20240101005700_seed-feature-configuration.sql` — Tiers + features
- `PropertyIQ/supabase/migrations/20240101005800_add-resource-gating-features.sql` — Metric/geo gating
- `PropertyIQ/supabase/migrations/20240101005900_create-paywall-events-table.sql` — Event tracking
- `PropertyIQ/supabase/migrations/20240101006000_create-trial-tables.sql` — Trial system
