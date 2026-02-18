# PropertyIQ Entitlements & User Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the complete entitlements overhaul, Stripe billing, gating UI, and retention features per the approved design doc at `docs/plans/2026-02-18-entitlements-user-flow-design.md`.

**Architecture:** Update existing entitlements config + scoring guard, build 4 new gating UI components, integrate Stripe Checkout for billing, and add 5 retention features (watchlist, alerts, benchmarking, score trends, Markets to Watch + weekly digest). All limits configurable via admin.

**Tech Stack:** Next.js (frontend), NestJS (backend), Supabase (DB + Auth), Stripe (billing), Redis (caching), React Query (frontend cache), Resend/SendGrid (email).

**Pre-launch context:** No existing users. Breaking changes are safe. No migration risk.

---

## Phase Overview

| Phase | Description | Dependencies |
|-------|-------------|--------------|
| 1 | DB Foundation — new features, updated tier config, cleanup | None |
| 2 | Score Visibility — show scores to all tiers, gate breakdown | Phase 1 |
| 3 | Gating UI Components — BlurredTeaser, GeoLockCard, ScoreBreakdownGate, ContextualUpgradeCTA | Phase 1 |
| 4 | Stripe Integration — checkout, webhooks, billing portal | Phase 1 |
| 5 | Unauthenticated Access — search-first flow, anonymous entitlements | Phases 2, 3 |
| 6 | Watchlist & Saved Markets — CRUD, dashboard | Phase 4 |
| 7 | Benchmarking — parent-geo comparisons on every metric | Phase 1 |
| 8 | Alert System — threshold triggers, in-app + email notifications | Phase 6 |
| 9 | Score Trends & Markets to Watch — dashboard enhancements, recommendations | Phase 6 |
| 10 | Weekly Digest Email — automated email with deep links | Phases 6, 8, 9 |
| 11 | Analytics Events — unified event tracking, admin dashboards | All prior phases |
| 12 | Caching & Scale — Redis TTL tuning, React Query optimization | All prior phases |

---

## Phase 1: DB Foundation

### Task 1.1: New Feature Definitions Migration

Add new feature definitions for score breakdown gating, report limits, AI analysis limits, historical trends, and weekly digest.

**Files:**
- Create: `PropertyIQ/supabase/migrations/20260218000100_entitlements_v2_features.sql`

**Step 1: Write the migration**

```sql
-- ============================================================================
-- Entitlements V2: New Feature Definitions + Updated Tier Config
-- ============================================================================

BEGIN;

-- New feature definitions for V2 entitlements
INSERT INTO feature_definitions (slug, name, category, value_type, default_value, is_enforced) VALUES
  -- Score breakdown gating (new - controls component visibility)
  ('feature_score_breakdown', 'Score Breakdown Access', 'feature', 'boolean', 'false', true),
  ('feature_score_history', 'Score History Access', 'feature', 'boolean', 'false', true),
  ('feature_score_weights', 'Score Component Weights', 'feature', 'boolean', 'false', true),

  -- Rate-limited AI features
  ('feature_reports_monthly', 'Monthly Report Limit', 'feature', 'integer', '2', true),
  ('feature_ai_analysis_monthly', 'Monthly AI Analysis Limit', 'feature', 'integer', '0', true),

  -- Historical trends (months available)
  ('feature_history_months', 'Historical Trend Months', 'feature', 'integer', '12', true),

  -- Weekly digest
  ('feature_weekly_digest', 'Weekly Digest Email', 'feature', 'boolean', 'false', true),

  -- Benchmarking
  ('feature_benchmarking', 'Metric Benchmarking', 'feature', 'boolean', 'false', true),

  -- Markets to Watch
  ('feature_recommendations', 'Markets to Watch', 'feature', 'boolean', 'false', true)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  value_type = EXCLUDED.value_type,
  is_enforced = EXCLUDED.is_enforced,
  updated_at = NOW();

-- ============================================================================
-- Update Free tier headline metrics (expand from 4 to 10)
-- ============================================================================

-- Add new free-tier metrics
INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('metric_home_value_yoy', 'Home Value YoY', 'metrics', 'boolean', 'true'),
  ('metric_median_listing_price', 'Median Listing Price', 'metrics', 'boolean', 'true'),
  ('metric_population_growth', 'Population Growth', 'metrics', 'boolean', 'true'),
  ('metric_homeownership_rate', 'Homeownership Rate', 'metrics', 'boolean', 'true'),
  ('metric_unemployment', 'Unemployment Rate', 'metrics', 'boolean', 'true')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- Grant new free metrics to free tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free' AND f.slug IN (
  'metric_home_value_yoy', 'metric_median_listing_price',
  'metric_population_growth', 'metric_homeownership_rate', 'metric_unemployment',
  -- Also grant to existing free metrics that may be missing
  'metric_home_value', 'metric_population', 'metric_piq_score', 'metric_median_income',
  -- Inventory and DOM are part of the 10 headline metrics
  'metric_inventory', 'metric_days_on_market'
)
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- Tier Features: New V2 features per tier
-- ============================================================================

-- FREE TIER: V2 features
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.slug
    WHEN 'feature_score_breakdown' THEN 'false'::jsonb
    WHEN 'feature_score_history' THEN 'false'::jsonb
    WHEN 'feature_score_weights' THEN 'false'::jsonb
    WHEN 'feature_reports_monthly' THEN '2'::jsonb
    WHEN 'feature_ai_analysis_monthly' THEN '0'::jsonb
    WHEN 'feature_history_months' THEN '12'::jsonb
    WHEN 'feature_weekly_digest' THEN 'false'::jsonb
    WHEN 'feature_benchmarking' THEN 'false'::jsonb
    WHEN 'feature_recommendations' THEN 'false'::jsonb
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free' AND f.slug LIKE 'feature_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- PRO TIER: V2 features
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.slug
    WHEN 'feature_score_breakdown' THEN 'true'::jsonb
    WHEN 'feature_score_history' THEN 'true'::jsonb
    WHEN 'feature_score_weights' THEN 'false'::jsonb
    WHEN 'feature_reports_monthly' THEN '10'::jsonb
    WHEN 'feature_ai_analysis_monthly' THEN '20'::jsonb
    WHEN 'feature_history_months' THEN '120'::jsonb   -- 10 years
    WHEN 'feature_weekly_digest' THEN 'true'::jsonb
    WHEN 'feature_benchmarking' THEN 'true'::jsonb
    WHEN 'feature_recommendations' THEN 'true'::jsonb
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'pro' AND f.slug LIKE 'feature_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ENTERPRISE TIER: V2 features
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.slug
    WHEN 'feature_score_breakdown' THEN 'true'::jsonb
    WHEN 'feature_score_history' THEN 'true'::jsonb
    WHEN 'feature_score_weights' THEN 'true'::jsonb
    WHEN 'feature_reports_monthly' THEN '50'::jsonb
    WHEN 'feature_ai_analysis_monthly' THEN '-1'::jsonb  -- unlimited
    WHEN 'feature_history_months' THEN '-1'::jsonb        -- max available
    WHEN 'feature_weekly_digest' THEN 'true'::jsonb
    WHEN 'feature_benchmarking' THEN 'true'::jsonb
    WHEN 'feature_recommendations' THEN 'true'::jsonb
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'enterprise' AND f.slug LIKE 'feature_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ADMIN TIER: Everything unlimited
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.value_type
    WHEN 'boolean' THEN 'true'::jsonb
    WHEN 'integer' THEN '-1'::jsonb
    ELSE 'true'::jsonb
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'admin' AND f.slug LIKE 'feature_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- Add Stripe columns to subscription_tiers
-- ============================================================================

ALTER TABLE subscription_tiers
  ADD COLUMN IF NOT EXISTS stripe_product_id VARCHAR,
  ADD COLUMN IF NOT EXISTS stripe_price_monthly_id VARCHAR,
  ADD COLUMN IF NOT EXISTS stripe_price_yearly_id VARCHAR;

-- ============================================================================
-- Add subscription fields to user_profiles (if not present)
-- ============================================================================

-- These may already exist; IF NOT EXISTS prevents errors
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR;

-- ============================================================================
-- Update preview_timeseries_months for free tier to 12
-- ============================================================================

UPDATE tier_features tf
SET value = '12'::jsonb, updated_at = NOW()
FROM subscription_tiers t, feature_definitions f
WHERE tf.tier_id = t.id AND tf.feature_id = f.id
  AND t.slug = 'free' AND f.slug = 'preview_timeseries_months';

COMMIT;
```

**Step 2: Apply the migration**

```bash
# Apply via Supabase MCP or direct SQL
# This migration is idempotent (ON CONFLICT DO UPDATE)
```

**Step 3: Commit**

```bash
git add PropertyIQ/supabase/migrations/20260218000100_entitlements_v2_features.sql
git commit -m "feat(db): add V2 entitlements features — score breakdown, rate limits, retention"
```

### Task 1.2: Add `favorableDirection` to Metric Registry

Needed for benchmarking (Phase 7). Add now to avoid touching registry twice.

**Files:**
- Modify: `packages/frontend/lib/data/registry.ts`

**Step 1: Add `favorableDirection` field to the MetricConfig type and to each metric definition**

Add `favorableDirection: 'higher' | 'lower' | 'neutral'` to the metric config type. Then add the field to every metric in the registry. General rules:
- Home values, income, population, growth rates → `'higher'`
- Days on market, unemployment, inventory (oversupply), price cuts → `'lower'`
- Affordability ratios, homeownership → `'neutral'` (context-dependent)

This is a large but mechanical change — add the field to each metric object.

**Step 2: Export helper function**

Add to `registry-helpers.ts`:
```typescript
export function getMetricFavorableDirection(metricId: string): 'higher' | 'lower' | 'neutral' {
  const config = getMetricConfig(metricId);
  return config?.favorableDirection ?? 'neutral';
}
```

**Step 3: Commit**

```bash
git add packages/frontend/lib/data/registry.ts packages/frontend/lib/data/registry-helpers.ts
git commit -m "feat(data): add favorableDirection to metric registry for benchmarking"
```

### Task 1.3: Add New Feature Slugs to Entitlements Context

The `FEATURES` array in `EntitlementsContext.tsx` only lists 5 features. Add the new V2 feature slugs.

**Files:**
- Modify: `packages/frontend/lib/entitlements/EntitlementsContext.tsx` (line 52)

**Step 1: Update the FEATURES array**

Change line 52 from:
```typescript
const FEATURES = ['analytics_assistant', 'export_csv', 'reports', 'ai_insights', 'scores'];
```
to:
```typescript
const FEATURES = [
  'analytics_assistant', 'export_csv', 'reports', 'ai_insights', 'scores',
  'score_breakdown', 'score_history', 'score_weights',
  'reports_monthly', 'ai_analysis_monthly', 'history_months',
  'weekly_digest', 'benchmarking', 'recommendations',
];
```

**Step 2: Commit**

```bash
git add packages/frontend/lib/entitlements/EntitlementsContext.tsx
git commit -m "feat(entitlements): add V2 feature slugs to context resource list"
```

---

## Phase 2: Score Visibility

### Task 2.1: Modify Scoring Guard — Scores Visible to All Tiers

Change `SCORE_ACCESS_CONFIG` so all score types return data for all tiers. The gating moves from "can you see the score at all" to "can you see the breakdown."

**Files:**
- Modify: `packages/backend/src/scoring/scoring.types.ts` (lines 97-101)

**Step 1: Update SCORE_ACCESS_CONFIG**

Change:
```typescript
export const SCORE_ACCESS_CONFIG: Record<import('./formula-weights').ScoreType, UserTier[]> = {
  markethealth: ['free', 'basic', 'pro', 'enterprise'], // Available to all
  homeready: ['pro', 'enterprise'], // Pro+ only
  investoredge: ['pro', 'enterprise'], // Pro+ only
};
```
to:
```typescript
export const SCORE_ACCESS_CONFIG: Record<import('./formula-weights').ScoreType, UserTier[]> = {
  markethealth: ['free', 'basic', 'pro', 'enterprise'],
  homeready: ['free', 'basic', 'pro', 'enterprise'],   // Score visible to all; breakdown gated separately
  investoredge: ['free', 'basic', 'pro', 'enterprise'], // Score visible to all; breakdown gated separately
};
```

**Step 2: Add breakdown access config**

Add below `SCORE_ACCESS_CONFIG`:
```typescript
/**
 * Controls which tiers can see score component breakdowns.
 * Score number + gauge + grade are visible to all tiers.
 * Breakdowns (contributing factors, component scores) are gated here.
 */
export const SCORE_BREAKDOWN_ACCESS_CONFIG: Record<import('./formula-weights').ScoreType, UserTier[]> = {
  markethealth: ['free', 'basic', 'pro', 'enterprise'], // Breakdown visible to all
  homeready: ['pro', 'enterprise'],                       // Breakdown Pro+ only
  investoredge: ['pro', 'enterprise'],                    // Breakdown Pro+ only
};

/**
 * Controls which tiers can see full component weights.
 */
export const SCORE_WEIGHTS_ACCESS_CONFIG: Record<import('./formula-weights').ScoreType, UserTier[]> = {
  markethealth: ['pro', 'enterprise'],
  homeready: ['enterprise'],
  investoredge: ['enterprise'],
};
```

**Step 3: Update scoring guard helper functions**

In `packages/backend/src/scoring/scoring.guard.ts`, add new functions:
```typescript
export function canAccessScoreBreakdown(scoreType: ScoreType, userTier: UserTier): boolean {
  const allowedTiers = SCORE_BREAKDOWN_ACCESS_CONFIG[scoreType];
  return allowedTiers.includes(userTier);
}

export function canAccessScoreWeights(scoreType: ScoreType, userTier: UserTier): boolean {
  const allowedTiers = SCORE_WEIGHTS_ACCESS_CONFIG[scoreType];
  return allowedTiers.includes(userTier);
}
```

Import `SCORE_BREAKDOWN_ACCESS_CONFIG` and `SCORE_WEIGHTS_ACCESS_CONFIG` from `scoring.types`.

**Step 4: Update scoring controller to strip breakdown for non-Pro users**

Find the scoring controller endpoint that returns scores. After computing the full score result, check the user's tier. If they don't have breakdown access, remove the `components` field from the response:

```typescript
// In the score response handler, after computing result:
const userTier = this.scoreAccessService.getUserTierFromRequest(request);

for (const scoreType of ['homeready', 'investoredge', 'markethealth'] as const) {
  if (result.scores[scoreType] && !canAccessScoreBreakdown(scoreType, userTier)) {
    delete result.scores[scoreType].components;
  }
}
```

**Step 5: Update upgrade messages for new model**

In `scoring.guard.ts`, update `getUpgradeMessage`:
```typescript
export function getUpgradeMessage(scoreType: ScoreType): string {
  switch (scoreType) {
    case 'homeready':
      return 'See what drives this HomeReady score — affordability, market timing, and livability factors.';
    case 'investoredge':
      return 'See what drives this InvestorEdge score — cash flow, appreciation, and risk analysis.';
    default:
      return 'Upgrade to see the full score breakdown.';
  }
}
```

**Step 6: Commit**

```bash
git add packages/backend/src/scoring/scoring.types.ts packages/backend/src/scoring/scoring.guard.ts packages/backend/src/scoring/scoring.controller.ts
git commit -m "feat(scoring): show scores to all tiers, gate breakdown to Pro+"
```

### Task 2.2: Update Frontend Score Components for New Access Model

The score components need to show gauge + grade to all users but gate the breakdown section.

**Files:**
- Modify: `packages/frontend/app/map/components/sidebar-components/SidebarScoreCard.tsx`
- Modify: `packages/frontend/app/components/scoring/ScoreCard.tsx`
- Modify: `packages/frontend/app/components/scoring/ScoreBadge.tsx`

**Step 1: Update SidebarScoreCard**

Currently HomeReady and InvestorEdge show a lock icon in the center of the gauge for free users. Change this: always show the score value in the gauge. Only show the lock/upgrade prompt on the breakdown section below the gauge.

Remove `isPro` gating from the ScoreDisplay rendering. Keep the "PRO" badge label but change its meaning to indicate breakdown access.

**Step 2: Update ScoreCard teaser logic**

The `TeaserOverlay` currently covers the entire card. Change it to only cover the component breakdown section. The score gauge at the top should always be visible and interactive.

**Step 3: Update ScoreBadge**

Remove the lock icon from the center of the badge. Score badges should always show the score number. The badge's "PRO" label should indicate "breakdown available with Pro" not "score locked."

**Step 4: Commit**

```bash
git add packages/frontend/app/map/components/sidebar-components/SidebarScoreCard.tsx
git add packages/frontend/app/components/scoring/ScoreCard.tsx
git add packages/frontend/app/components/scoring/ScoreBadge.tsx
git commit -m "feat(scores): always show score value, gate breakdown only"
```

---

## Phase 3: Gating UI Components

### Task 3.1: Create `BlurredTeaser` Component

Shows content behind a blur overlay with upgrade CTA. Used for Metro metrics on Free tier.

**Files:**
- Create: `packages/frontend/components/entitlements/BlurredTeaser.tsx`

**Implementation:**
- Props: `children` (content to blur), `title`, `description`, `ctaText`, `ctaHref`, `resourceType`, `resourceId`
- Renders children with `backdrop-blur-md` CSS
- Centered overlay card with context, value proposition, and CTA button
- On mount, calls `trackPaywallView` via `useEntitlements()`
- CTA button calls `trackUpgradeClick` and navigates to pricing/checkout

**Step 1: Build the component**

```tsx
'use client';

import React, { useEffect } from 'react';
import { useEntitlements } from '@/lib/entitlements';
import type { ResourceType } from '@/lib/entitlements';
import Link from 'next/link';

interface BlurredTeaserProps {
  children: React.ReactNode;
  title: string;
  description: string;
  ctaText?: string;
  ctaHref?: string;
  resourceType: ResourceType;
  resourceId: string;
}

export function BlurredTeaser({
  children,
  title,
  description,
  ctaText = 'Go Pro →',
  ctaHref = '/pricing',
  resourceType,
  resourceId,
}: BlurredTeaserProps) {
  const { trackPaywallView, trackUpgradeClick } = useEntitlements();

  useEffect(() => {
    trackPaywallView(resourceType, resourceId);
  }, [resourceType, resourceId, trackPaywallView]);

  return (
    <div className="relative">
      <div className="blur-md pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-surface-container/95 backdrop-blur-sm rounded-2xl p-6 max-w-sm text-center shadow-lg">
          <p className="text-on-surface-variant text-sm mb-1">{title}</p>
          <p className="text-on-surface font-medium mb-4">{description}</p>
          <Link
            href={ctaHref}
            onClick={() => trackUpgradeClick(resourceType, resourceId)}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/components/entitlements/BlurredTeaser.tsx
git commit -m "feat(entitlements): add BlurredTeaser gating component"
```

### Task 3.2: Create `GeoLockCard` Component

Hard lock for County/ZIP on Free tier. No data shown, just an explanation card.

**Files:**
- Create: `packages/frontend/components/entitlements/GeoLockCard.tsx`

**Implementation:**
- Props: `geoName`, `geoLevel`, `parentGeoName?`, `features?: string[]`
- Lock icon + geography name
- 2-3 bullet points of what they'd see
- CTA button to pricing
- Tracks paywall events

**Step 1: Build the component (follow same pattern as BlurredTeaser)**

**Step 2: Commit**

```bash
git add packages/frontend/components/entitlements/GeoLockCard.tsx
git commit -m "feat(entitlements): add GeoLockCard component for County/ZIP gating"
```

### Task 3.3: Create `ScoreBreakdownGate` Component

Shows score gauge (visible) with gated breakdown section below.

**Files:**
- Create: `packages/frontend/components/entitlements/ScoreBreakdownGate.tsx`

**Implementation:**
- Props: `scoreType`, `children` (the breakdown content), `scoreValue`, `grade`
- Renders a light card with lock icon where breakdown would go
- Teaser text: "This score is driven by N factors. The top driver is [blurred]."
- CTA: "See what's driving this score → Go Pro"

**Step 1: Build the component**

**Step 2: Commit**

```bash
git add packages/frontend/components/entitlements/ScoreBreakdownGate.tsx
git commit -m "feat(entitlements): add ScoreBreakdownGate component"
```

### Task 3.4: Create `ContextualUpgradeCTA` Component

Inline prompt for specific feature gates (save, alert, export, comparison).

**Files:**
- Create: `packages/frontend/components/entitlements/ContextualUpgradeCTA.tsx`

**Implementation:**
- Props: `featureSlug`, `title`, `description`, `ctaText?`, `ctaHref?`
- Renders inline (not modal) where the action would happen
- Icon + title + description + CTA button
- Tracks paywall events

**Step 1: Build the component**

**Step 2: Export all new components from barrel**

Update `packages/frontend/components/entitlements/index.ts` to export all 4 new components.

**Step 3: Commit**

```bash
git add packages/frontend/components/entitlements/ContextualUpgradeCTA.tsx
git add packages/frontend/components/entitlements/index.ts
git commit -m "feat(entitlements): add ContextualUpgradeCTA, export all V2 gating components"
```

---

## Phase 4: Stripe Integration

### Task 4.1: Create Backend Billing Module

**Files:**
- Create: `packages/backend/src/billing/billing.module.ts`
- Create: `packages/backend/src/billing/billing.service.ts`
- Create: `packages/backend/src/billing/billing.controller.ts`
- Create: `packages/backend/src/billing/stripe.service.ts`
- Modify: `packages/backend/src/app.module.ts` (register BillingModule)

**Step 1: Install Stripe SDK**

```bash
cd packages/backend && npm install stripe
```

**Step 2: Create `stripe.service.ts`**

Wraps the Stripe SDK. Methods:
- `createCheckoutSession(userId, tier, interval, returnContext)` → returns checkout URL
- `createBillingPortalSession(stripeCustomerId)` → returns portal URL
- `constructWebhookEvent(body, signature)` → verifies and parses webhook
- `getOrCreateCustomer(userId, email)` → finds or creates Stripe customer

**Step 3: Create `billing.service.ts`**

Business logic layer:
- `startCheckout(userId, tier, interval, returnContext)` → calls stripe.service, returns URL
- `handleWebhookEvent(event)` → processes checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed
- `syncUserTier(userId, tier, stripeSubscriptionId)` → updates user_profiles
- `getBillingPortalUrl(userId)` → creates portal session

**Step 4: Create `billing.controller.ts`**

Endpoints:
- `POST /api/billing/checkout` — requires auth, returns `{ checkoutUrl }`
- `POST /api/billing/webhook` — no auth (Stripe signature verification), raw body
- `GET /api/billing/portal` — requires auth, returns `{ portalUrl }`

**Step 5: Create `billing.module.ts` and register in `app.module.ts`**

**Step 6: Commit**

```bash
git add packages/backend/src/billing/
git add packages/backend/src/app.module.ts
git commit -m "feat(billing): add Stripe billing module with checkout, webhooks, portal"
```

### Task 4.2: Update Entitlements Service to Read User Subscription Tier

Currently `entitlements.service.ts` line 50 has `// TODO: Check actual subscription tier when Stripe is integrated`. Implement this.

**Files:**
- Modify: `packages/backend/src/entitlements/entitlements.service.ts`

**Step 1: After trial check, query `user_profiles.subscription_tier`**

```typescript
if (userId && !tierOverride) {
  // Check for active trial
  const trialInfo = await this.getActiveTrial(userId);
  if (trialInfo) {
    tier = trialInfo.tier;
    trial = { active: true, daysRemaining: trialInfo.daysRemaining, tier: trialInfo.tier };
  } else {
    // Check subscription tier from Stripe sync
    const { data: profile } = await this.supabase.getClient()
      .from('user_profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', userId)
      .single();

    if (profile?.subscription_tier && profile.subscription_status === 'active') {
      tier = profile.subscription_tier;
    }
  }
}
```

**Step 2: Commit**

```bash
git add packages/backend/src/entitlements/entitlements.service.ts
git commit -m "feat(entitlements): read subscription tier from user_profiles (Stripe sync)"
```

### Task 4.3: Frontend Checkout Flow

**Files:**
- Create: `packages/frontend/app/upgrade/success/page.tsx`
- Modify: `packages/frontend/app/pricing/page.tsx`
- Create: `packages/frontend/lib/billing/api.ts`

**Step 1: Create billing API helpers**

```typescript
// packages/frontend/lib/billing/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function startCheckout(tier: string, interval: 'month' | 'year', returnContext?: string) {
  const res = await fetch(`${API_URL}/api/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tier, interval, returnContext }),
  });
  const data = await res.json();
  return data.checkoutUrl;
}

export async function getBillingPortalUrl() {
  const res = await fetch(`${API_URL}/api/billing/portal`, {
    credentials: 'include',
  });
  const data = await res.json();
  return data.portalUrl;
}
```

**Step 2: Create upgrade success page**

`/upgrade/success` — verifies session, refreshes entitlements, redirects to returnContext.

**Step 3: Update pricing page CTAs to call `startCheckout`**

Replace the current "Start Free Trial" buttons with checkout flow. Show monthly/yearly toggle.

**Step 4: Update gating components to pass `returnContext` through to checkout**

The `BlurredTeaser`, `GeoLockCard`, `ScoreBreakdownGate`, and `ContextualUpgradeCTA` components should encode their context (e.g., `geo:zip:60614`) and pass it through to the checkout URL so the success page can redirect back.

**Step 5: Commit**

```bash
git add packages/frontend/app/upgrade/ packages/frontend/lib/billing/ packages/frontend/app/pricing/page.tsx
git commit -m "feat(billing): frontend checkout flow with context-preserving redirects"
```

### Task 4.4: Account Billing Page

**Files:**
- Create: `packages/frontend/app/account/billing/page.tsx`

Shows current plan, renewal date, usage stats, and "Manage Subscription" link to Stripe Billing Portal.

**Step 1: Build the page**

**Step 2: Commit**

```bash
git add packages/frontend/app/account/billing/
git commit -m "feat(billing): add account billing page with usage stats"
```

---

## Phase 5: Unauthenticated Access

### Task 5.1: Allow Anonymous Entitlements Resolution

**Files:**
- Modify: `packages/backend/src/entitlements/entitlements.service.ts`
- Modify: `packages/backend/src/entitlements/entitlements.controller.ts`

The entitlements check endpoint already accepts `userId: null`. Ensure it works correctly for anonymous users — should return `free` tier access without requiring auth headers.

**Step 1: Verify anonymous flow works in entitlements service (it should — `userId` is already nullable)**

**Step 2: Add anonymous session tracking**

For unauthenticated visitors, generate a session ID (stored in a cookie) so we can track their paywall interactions and market views for the soft gate ("you've viewed 3 markets").

**Step 3: Add anonymous market view counter**

In the frontend, track how many markets an unauthenticated user has viewed. After 3, show a signup prompt. Store count in `sessionStorage`.

**Step 4: Commit**

```bash
git add packages/backend/src/entitlements/ packages/frontend/lib/entitlements/
git commit -m "feat(auth): support anonymous entitlements resolution with session tracking"
```

### Task 5.2: Search-First Landing Flow

**Files:**
- Modify: `packages/frontend/app/page.tsx` (or home page component)
- Modify: Navigation component to show search when not authenticated

**Step 1: Add prominent search bar to the landing page / hero section**

The search bar should accept ZIP codes, city names, metro names, state names. On submit, navigate to the map/market view for that location.

**Step 2: Ensure market view pages work without auth**

Currently the map and market pages should work with anonymous entitlements (free tier access). Verify that scores and headline metrics render for unauthenticated visitors at National/State levels, with proper gating at Metro (blurred) and County/ZIP (locked).

**Step 3: Add signup prompt component**

After 3 anonymous market views, show a banner: "Create a free account to save this market and track changes."

**Step 4: Commit**

```bash
git add packages/frontend/app/ packages/frontend/components/
git commit -m "feat(auth): search-first landing flow for unauthenticated visitors"
```

---

## Phase 6: Watchlist & Saved Markets

### Task 6.1: Watchlist Database Tables

**Files:**
- Create: `PropertyIQ/supabase/migrations/20260218000200_create_watchlist_tables.sql`

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS user_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  geography_type VARCHAR NOT NULL,  -- metro, county, zip
  geography_id VARCHAR NOT NULL,
  geography_name VARCHAR NOT NULL,
  state_code VARCHAR,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, geography_type, geography_id)
);

CREATE INDEX idx_watchlist_user ON user_watchlist(user_id);
CREATE INDEX idx_watchlist_geo ON user_watchlist(geography_type, geography_id);

COMMIT;
```

### Task 6.2: Watchlist Backend CRUD

**Files:**
- Create: `packages/backend/src/watchlist/watchlist.module.ts`
- Create: `packages/backend/src/watchlist/watchlist.service.ts`
- Create: `packages/backend/src/watchlist/watchlist.controller.ts`
- Modify: `packages/backend/src/app.module.ts`

**Endpoints:**
- `GET /api/watchlist` — list saved markets (check `watchlist_limit`)
- `POST /api/watchlist` — add market (enforce limit from entitlements)
- `DELETE /api/watchlist/:id` — remove market
- `GET /api/watchlist/summary` — batch fetch current scores + 30-day score changes for all saved markets

### Task 6.3: Watchlist Frontend Components

**Files:**
- Create: `packages/frontend/components/watchlist/SaveMarketButton.tsx`
- Create: `packages/frontend/components/watchlist/WatchlistDashboard.tsx`
- Create: `packages/frontend/lib/watchlist/api.ts`
- Create: `packages/frontend/lib/watchlist/hooks.ts`

**SaveMarketButton:** Heart/bookmark icon. Toggles save state. Shows `ContextualUpgradeCTA` when at limit.

**WatchlistDashboard:** Grid of saved market cards showing score gauge, trend arrow, top changed metric. Used on the main dashboard page.

### Task 6.4: Dashboard Page with Watchlist

**Files:**
- Create or modify: `packages/frontend/app/dashboard/page.tsx`

Dashboard for authenticated users:
- "Your Markets" section (WatchlistDashboard)
- Empty state with search prompt for new users
- Alert feed section (placeholder, implemented in Phase 8)
- "Markets to Watch" section (placeholder, implemented in Phase 9)

**Commit after each task in this phase.**

---

## Phase 7: Benchmarking

### Task 7.1: Benchmarking Backend Endpoint

**Files:**
- Create: `packages/backend/src/benchmarks/benchmarks.module.ts`
- Create: `packages/backend/src/benchmarks/benchmarks.service.ts`
- Create: `packages/backend/src/benchmarks/benchmarks.controller.ts`
- Modify: `packages/backend/src/app.module.ts`

**Endpoint:**
```
GET /api/benchmarks/:geoLevel/:geoId?metrics=home_value,days_on_market
```

**Service logic:**
1. Fetch current metric value for the target geography
2. Determine parent geography (ZIP → County, County → Metro, Metro → State)
3. Fetch parent geography metric value
4. Calculate percentage difference
5. Use `favorableDirection` from metric registry to determine "better"/"worse"
6. Calculate percentile among sibling geographies (optional, can be Phase 2)

**Response:**
```json
[
  {
    "metricId": "days_on_market",
    "value": 22,
    "parentGeo": { "level": "county", "id": "17031", "name": "Cook County" },
    "parentValue": 35,
    "diff": -37.1,
    "direction": "better",
    "percentile": null
  }
]
```

### Task 7.2: Benchmarking Frontend Components

**Files:**
- Create: `packages/frontend/components/benchmarks/BenchmarkBadge.tsx`
- Create: `packages/frontend/lib/benchmarks/api.ts`
- Create: `packages/frontend/lib/benchmarks/hooks.ts`

**BenchmarkBadge:** Small colored pill shown next to metric values:
- Green: "↓ 37% vs Cook County" (favorable)
- Red: "↑ 12% vs Cook County" (unfavorable)
- Gray: "≈ County avg" (within 5%)

**Hook:** `useBenchmarks(geoLevel, geoId, metricIds)` — fetches benchmark data, gated to Pro+ via entitlements check.

### Task 7.3: Wire Benchmarks into Metric Cards

Wherever metric values are displayed in Pro+ views, add the `BenchmarkBadge` component next to the value. Only renders when user has `feature_benchmarking` access.

**Commit after each task in this phase.**

---

## Phase 8: Alert System

### Task 8.1: Alert Database Tables

**Files:**
- Create: `PropertyIQ/supabase/migrations/20260218000300_create_alerts_tables.sql`

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  geography_type VARCHAR NOT NULL,
  geography_id VARCHAR NOT NULL,
  geography_name VARCHAR NOT NULL,
  metric_id VARCHAR NOT NULL,
  condition VARCHAR NOT NULL,  -- 'above', 'below', 'crosses'
  threshold DECIMAL NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES user_alerts(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  metric_value DECIMAL NOT NULL,
  notified_via VARCHAR DEFAULT 'in-app',  -- 'in-app', 'email', 'both'
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_alerts_user ON user_alerts(user_id, is_active);
CREATE INDEX idx_alert_history_alert ON alert_history(alert_id, triggered_at DESC);
CREATE INDEX idx_alert_history_unread ON alert_history(alert_id) WHERE read_at IS NULL;

COMMIT;
```

### Task 8.2: Alert Backend CRUD + Processing Job

**Files:**
- Create: `packages/backend/src/alerts/alerts.module.ts`
- Create: `packages/backend/src/alerts/alerts.service.ts`
- Create: `packages/backend/src/alerts/alerts.controller.ts`
- Create: `packages/backend/src/alerts/alert-processor.service.ts`
- Modify: `packages/backend/src/app.module.ts`

**CRUD Endpoints:**
- `GET /api/alerts` — list user's alerts (with history)
- `POST /api/alerts` — create alert (enforce `alerts_limit`)
- `PATCH /api/alerts/:id` — update threshold/active
- `DELETE /api/alerts/:id` — delete
- `GET /api/alerts/history` — triggered alert history (with unread count)
- `PATCH /api/alerts/history/:id/read` — mark as read

**AlertProcessorService:**
- Scheduled cron job (configurable, e.g., daily at 6am UTC)
- For each active alert: fetch current metric value, compare to threshold based on condition
- If triggered and not already triggered for current value: insert alert_history, queue email notification
- Deduplication: skip if `last_triggered_at` is recent and value hasn't changed

### Task 8.3: Alert Frontend Components

**Files:**
- Create: `packages/frontend/components/alerts/CreateAlertForm.tsx`
- Create: `packages/frontend/components/alerts/AlertBell.tsx`
- Create: `packages/frontend/components/alerts/AlertFeed.tsx`
- Create: `packages/frontend/app/alerts/page.tsx`
- Create: `packages/frontend/lib/alerts/api.ts`
- Create: `packages/frontend/lib/alerts/hooks.ts`

**AlertBell:** Nav header icon with unread count badge. Dropdown shows recent triggered alerts.

**CreateAlertForm:** Used on metric cards — "Set alert" opens inline form with metric pre-selected, condition dropdown (above/below/crosses), threshold input.

**AlertFeed:** Dashboard section showing triggered alerts with deep links to relevant markets.

**/alerts page:** Full alert management — list of active alerts, history, create/edit/delete.

**Commit after each task in this phase.**

---

## Phase 9: Score Trends & Markets to Watch

### Task 9.1: Score Trends on Dashboard

**Files:**
- Modify: `packages/frontend/components/watchlist/WatchlistDashboard.tsx`
- Create: `packages/frontend/components/watchlist/ScoreTrendSparkline.tsx`

Add 6-month score sparklines to each saved market card on the dashboard. Uses existing `fetchScore` with date parameters to get historical points.

### Task 9.2: Markets to Watch Backend

**Files:**
- Create: `packages/backend/src/recommendations/recommendations.module.ts`
- Create: `packages/backend/src/recommendations/recommendations.service.ts`
- Create: `packages/backend/src/recommendations/recommendations.controller.ts`
- Modify: `packages/backend/src/app.module.ts`

**Endpoint:** `GET /api/recommendations/markets-to-watch`

**Algorithm (v1):**
1. Get user's saved markets and their score profiles
2. Query markets at same geo level within ±15 score points
3. Filter to positive 30-day score trend
4. Exclude watchlist markets
5. Rank by score improvement magnitude
6. Return top 5-10 with reason

Cache result in Redis for 1 hour per user.

### Task 9.3: Markets to Watch Frontend

**Files:**
- Create: `packages/frontend/components/recommendations/MarketsToWatch.tsx`
- Modify: `packages/frontend/app/dashboard/page.tsx`

Card carousel below watchlist on dashboard. Each card: market name, score gauges, reason, "Save" button. Gated to Pro+ — Free sees `ContextualUpgradeCTA`.

**Commit after each task in this phase.**

---

## Phase 10: Weekly Digest Email

### Task 10.1: Email Infrastructure

**Files:**
- Create: `packages/backend/src/email/email.module.ts`
- Create: `packages/backend/src/email/email.service.ts`
- Create: `PropertyIQ/supabase/migrations/20260218000400_create_email_tables.sql`
- Modify: `packages/backend/src/app.module.ts`

**Install:** Email provider SDK (Resend: `npm install resend`, or SendGrid: `npm install @sendgrid/mail`)

**Database:**
```sql
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_digest BOOLEAN DEFAULT true,
  alert_emails BOOLEAN DEFAULT true,
  marketing BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email_type VARCHAR NOT NULL,  -- 'digest', 'alert', 'marketing'
  subject VARCHAR,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);
```

**EmailService:** Send transactional emails, manage preferences, log sends.

### Task 10.2: Digest Cron Job

**Files:**
- Create: `packages/backend/src/email/digest.service.ts`

**Scheduled job:** `@Cron('0 8 * * MON')` (every Monday 8am UTC)

For each Pro+ user with `weekly_digest = true`:
1. Fetch saved markets from watchlist
2. Compute score changes vs 7 days ago
3. Fetch triggered alerts from past 7 days
4. Get top Markets to Watch recommendation
5. Render email HTML template
6. Send via email provider
7. Log in email_log

**Email template:** HTML email with score change cards, alert summary, recommendation card, deep links with UTM params.

### Task 10.3: Email Preferences UI

**Files:**
- Create or modify: `packages/frontend/app/account/notifications/page.tsx`

Toggle switches for: weekly digest, alert emails, marketing emails. Calls `PATCH /api/email/preferences`.

**Commit after each task in this phase.**

---

## Phase 11: Analytics Events

### Task 11.1: Analytics Events Database

**Files:**
- Create: `PropertyIQ/supabase/migrations/20260218000500_create_analytics_events_table.sql`

```sql
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id VARCHAR,
  event_type VARCHAR NOT NULL,
  event_name VARCHAR NOT NULL,
  properties JSONB DEFAULT '{}',
  user_tier VARCHAR,
  page_path VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_type ON analytics_events(event_type, event_name, created_at DESC);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_events_time ON analytics_events(created_at DESC);
```

### Task 11.2: Analytics Backend

**Files:**
- Create: `packages/backend/src/analytics/events.controller.ts`
- Modify: `packages/backend/src/analytics/analytics.module.ts`

**Endpoint:** `POST /api/analytics/events` — bulk insert events.

### Task 11.3: Frontend Event Tracking

**Files:**
- Create: `packages/frontend/lib/analytics/tracker.ts`

Lightweight `trackEvent(eventName, properties)` function:
- Batches events (sends every 5 seconds or on page unload)
- Uses `navigator.sendBeacon` on page close
- POSTs to `/api/analytics/events`
- Auto-includes: `user_tier`, `page_path`, `session_id`, `timestamp`

### Task 11.4: Wire Event Tracking into Components

Add `trackEvent` calls to:
- Gating components (paywall.view, paywall.upgrade_click, paywall.dismiss)
- Signup flow (signup.search_unauth, signup.form_start, signup.form_complete)
- Feature usage (feature.market_save, feature.alert_create, feature.report_generate, etc.)
- Navigation (nav.geo_drilldown, nav.search)
- Session tracking (engagement.session_start, engagement.session_duration)

**Commit after each task in this phase.**

---

## Phase 12: Caching & Scale Optimization

### Task 12.1: Tune Redis TTLs

**Files:**
- Modify: `packages/backend/src/redis/redis.service.ts`
- Modify: Any service that sets cache entries

Update Redis TTLs per the design doc:
- Metric snapshots: 6 hours
- Time series: 6 hours
- Scores: 6 hours
- GeoJSON: 24 hours
- Market lists: 12 hours
- Benchmarks: 6 hours
- Entitlements (per-tier): 30 minutes
- Watchlist: 5 minutes
- Recommendations: 1 hour

### Task 12.2: Optimize Entitlements Caching

Cache entitlements responses by tier instead of per-user. Since most users on the same tier get identical access, we can serve the same response for all free users, all pro users, etc. Only query per-user when the user has overrides.

**Files:**
- Modify: `packages/backend/src/entitlements/entitlements.service.ts`

### Task 12.3: Tune React Query Settings

**Files:**
- Modify: `packages/frontend/lib/data/hooks/` (all hooks)

Update `staleTime` and `cacheTime` per the design doc values.

### Task 12.4: Add Cache-Control Headers to Public Endpoints

**Files:**
- Modify score and metric endpoints to add `Cache-Control: public, max-age=21600` (6 hours) for unauthenticated requests

**Commit after each task in this phase.**

---

## Implementation Priority

If you need to ship incrementally, the phases above are ordered by dependency and impact:

| Priority | Phase | Why |
|----------|-------|-----|
| P0 | Phase 1 (DB Foundation) | Everything depends on this |
| P0 | Phase 2 (Score Visibility) | Core UX change — scores as the hook |
| P0 | Phase 3 (Gating UI) | Required for the new free tier experience |
| P0 | Phase 4 (Stripe) | Can't monetize without this |
| P1 | Phase 5 (Unauth Access) | Critical for conversion funnel |
| P1 | Phase 6 (Watchlist) | Foundation for all retention features |
| P1 | Phase 7 (Benchmarking) | Killer Pro retention feature |
| P2 | Phase 8 (Alerts) | Retention loop driver |
| P2 | Phase 9 (Score Trends + Recommendations) | Dashboard value |
| P2 | Phase 10 (Digest Email) | Re-engagement driver |
| P3 | Phase 11 (Analytics) | Measurement — can backfill later |
| P3 | Phase 12 (Caching) | Optimization — tune under load |

**Minimum viable launch:** Phases 1-6 (foundation + billing + core UX + watchlist).
**Full launch:** All 12 phases.
