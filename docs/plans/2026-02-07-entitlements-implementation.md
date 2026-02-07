# Entitlements System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing feature gating system to support metrics/geography gating, add paywall analytics, trial management, and build admin UI.

**Architecture:** Build on existing `admin/features` module. Add resource-type gating as new feature definitions. Add paywall events table for analytics. Add trial tables. Build frontend EntitlementsContext that wraps UserFeaturesService. Build admin UI in `/_dev/admin/entitlements`.

**Tech Stack:** NestJS backend (existing), Supabase (existing), React/Next.js frontend, Tailwind CSS, @dnd-kit for drag-and-drop.

---

## Existing Foundation

The backend already has:
- `subscription_tiers` - free, pro, enterprise, admin
- `feature_definitions` - feature registry with value types
- `tier_features` - tier-to-feature mapping
- `user_feature_overrides` - per-user overrides
- `FeaturesService`, `TiersService`, `UserFeaturesService`, `GrandfatheringService`

---

## Phase 1: Extend Schema for Resource Gating

### Task 1.1: Add Resource Feature Definitions

**Files:**
- Create: `scripts/migrations/100-add-resource-gating-features.sql`

**Step 1: Write the migration**

```sql
-- ============================================================================
-- Add Resource Gating Features
-- Migration: 100
--
-- Extends feature system to support metric and geography level gating
-- ============================================================================

BEGIN;

-- ============================================================================
-- FEATURE DEFINITIONS: Metrics Access
-- Each metric gets a feature definition with access level
-- ============================================================================

-- Core metrics (free tier)
INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('metric_home_value', 'Home Value Metric', 'metrics', 'boolean', 'true'),
  ('metric_population', 'Population Metric', 'metrics', 'boolean', 'true'),
  ('metric_piq_score', 'PropertyIQ Score', 'metrics', 'boolean', 'true'),
  ('metric_median_income', 'Median Income Metric', 'metrics', 'boolean', 'true')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- Premium metrics (pro tier)
INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('metric_rental_yield', 'Rental Yield Metric', 'metrics', 'boolean', 'false'),
  ('metric_cap_rate', 'Cap Rate Metric', 'metrics', 'boolean', 'false'),
  ('metric_rent_index', 'Rent Index Metric', 'metrics', 'boolean', 'false'),
  ('metric_days_on_market', 'Days on Market Metric', 'metrics', 'boolean', 'false'),
  ('metric_inventory', 'Inventory Metric', 'metrics', 'boolean', 'false'),
  ('metric_price_cuts', 'Price Cuts Metric', 'metrics', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- Enterprise metrics
INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('metric_forecast', 'Forecast Metrics', 'metrics', 'boolean', 'false'),
  ('metric_custom_analytics', 'Custom Analytics', 'metrics', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- ============================================================================
-- FEATURE DEFINITIONS: Geography Access
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('geo_national', 'National Level Access', 'geography', 'boolean', 'true'),
  ('geo_state', 'State Level Access', 'geography', 'boolean', 'true'),
  ('geo_metro', 'Metro Level Access', 'geography', 'boolean', 'true'),
  ('geo_county', 'County Level Access', 'geography', 'boolean', 'false'),
  ('geo_zip', 'ZIP Code Level Access', 'geography', 'boolean', 'false'),
  ('geo_tract', 'Census Tract Access', 'geography', 'boolean', 'false')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- ============================================================================
-- FEATURE DEFINITIONS: Preview Limits (for teaser mode)
-- ============================================================================

INSERT INTO feature_definitions (slug, name, category, value_type, default_value) VALUES
  ('preview_metrics_limit', 'Preview Metrics Limit', 'preview', 'integer', '3'),
  ('preview_markets_limit', 'Preview Markets Limit', 'preview', 'integer', '5'),
  ('preview_timeseries_months', 'Preview Time Series Months', 'preview', 'integer', '6')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, updated_at = NOW();

-- ============================================================================
-- TIER FEATURES: Free Tier
-- ============================================================================

-- Metrics for free tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free' AND f.slug IN ('metric_home_value', 'metric_population', 'metric_piq_score', 'metric_median_income')
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Geographies for free tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free' AND f.slug IN ('geo_national', 'geo_state', 'geo_metro')
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Preview limits for free tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id,
  CASE f.slug
    WHEN 'preview_metrics_limit' THEN '3'::jsonb
    WHEN 'preview_markets_limit' THEN '5'::jsonb
    WHEN 'preview_timeseries_months' THEN '6'::jsonb
  END
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'free' AND f.slug LIKE 'preview_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- TIER FEATURES: Pro Tier
-- ============================================================================

-- All metrics for pro tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'pro' AND f.category = 'metrics' AND f.slug NOT LIKE 'metric_custom%' AND f.slug NOT LIKE 'metric_forecast%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- More geographies for pro tier
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'pro' AND f.category = 'geography' AND f.slug != 'geo_tract'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- No preview limits for pro (unlimited)
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '-1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'pro' AND f.slug LIKE 'preview_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- TIER FEATURES: Enterprise Tier
-- ============================================================================

-- All metrics and geographies for enterprise
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, 'true'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'enterprise' AND f.category IN ('metrics', 'geography')
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- No limits for enterprise
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT t.id, f.id, '-1'::jsonb
FROM subscription_tiers t, feature_definitions f
WHERE t.slug = 'enterprise' AND f.slug LIKE 'preview_%'
ON CONFLICT (tier_id, feature_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

COMMIT;
```

**Step 2: Run the migration**

Run: `psql $DATABASE_URL -f scripts/migrations/100-add-resource-gating-features.sql`
Expected: No errors, rows inserted

**Step 3: Commit**

```bash
git add scripts/migrations/100-add-resource-gating-features.sql
git commit -m "feat(entitlements): add metric and geography feature definitions"
```

---

### Task 1.2: Add Paywall Events Table

**Files:**
- Create: `scripts/migrations/101-create-paywall-events-table.sql`

**Step 1: Write the migration**

```sql
-- ============================================================================
-- Paywall Events Table
-- Migration: 101
--
-- Tracks user interactions with paywalls for analytics
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS paywall_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  session_id VARCHAR(100),
  resource_type VARCHAR(50) NOT NULL,  -- 'metric', 'geography', 'feature'
  resource_id VARCHAR(100) NOT NULL,   -- 'rental_yield', 'zip', 'ai_insights'
  user_tier VARCHAR(50) NOT NULL,
  page_path VARCHAR(500),
  event_type VARCHAR(50) NOT NULL,     -- 'view', 'click_upgrade', 'dismiss'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_paywall_events_resource
  ON paywall_events(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paywall_events_time
  ON paywall_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paywall_events_user
  ON paywall_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_paywall_events_type
  ON paywall_events(event_type, created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON paywall_events TO service_role;
GRANT SELECT, INSERT ON paywall_events TO authenticated;

COMMIT;
```

**Step 2: Run the migration**

Run: `psql $DATABASE_URL -f scripts/migrations/101-create-paywall-events-table.sql`

**Step 3: Commit**

```bash
git add scripts/migrations/101-create-paywall-events-table.sql
git commit -m "feat(entitlements): add paywall events table for analytics"
```

---

### Task 1.3: Add Trial Tables

**Files:**
- Create: `scripts/migrations/102-create-trial-tables.sql`

**Step 1: Write the migration**

```sql
-- ============================================================================
-- Trial Management Tables
-- Migration: 102
-- ============================================================================

BEGIN;

-- Global trial configuration
CREATE TABLE IF NOT EXISTS trial_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT false,
  duration_days INTEGER DEFAULT 14,
  trial_tier VARCHAR(50) DEFAULT 'pro',
  show_banner BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Ensure only one config row
INSERT INTO trial_config (is_enabled, duration_days, trial_tier, show_banner)
VALUES (false, 14, 'pro', true)
ON CONFLICT DO NOTHING;

-- User trials
CREATE TABLE IF NOT EXISTS user_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  tier VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  converted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_trials_user ON user_trials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trials_expires ON user_trials(expires_at) WHERE converted_at IS NULL AND cancelled_at IS NULL;

-- Grant permissions
GRANT SELECT, UPDATE ON trial_config TO service_role;
GRANT SELECT, INSERT, UPDATE ON user_trials TO service_role;

COMMIT;
```

**Step 2: Run the migration**

Run: `psql $DATABASE_URL -f scripts/migrations/102-create-trial-tables.sql`

**Step 3: Commit**

```bash
git add scripts/migrations/102-create-trial-tables.sql
git commit -m "feat(entitlements): add trial management tables"
```

---

## Phase 2: Backend Services

### Task 2.1: Create Entitlements Public Service

**Files:**
- Create: `packages/backend/src/entitlements/entitlements.module.ts`
- Create: `packages/backend/src/entitlements/entitlements.service.ts`
- Create: `packages/backend/src/entitlements/entitlements.controller.ts`
- Create: `packages/backend/src/entitlements/dto/check-access.dto.ts`

**Step 1: Create the module**

```typescript
// packages/backend/src/entitlements/entitlements.module.ts
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { FeaturesModule } from '../admin/features/features.module';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';

@Module({
  imports: [SupabaseModule, FeaturesModule],
  providers: [EntitlementsService],
  controllers: [EntitlementsController],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
```

**Step 2: Create the service**

```typescript
// packages/backend/src/entitlements/entitlements.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UserFeaturesService } from '../admin/features/user-features.service';

export interface AccessCheck {
  level: 'full' | 'preview' | 'none';
  limit?: number;
  tierRequired?: string;
}

export interface EntitlementsResponse {
  tier: string;
  access: Record<string, AccessCheck>;
  trial: {
    active: boolean;
    daysRemaining?: number;
    tier?: string;
  } | null;
}

@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly userFeatures: UserFeaturesService,
  ) {}

  async checkAccess(
    userId: string | null,
    tierOverride: string | null,
    resources: string[],
  ): Promise<EntitlementsResponse> {
    // Determine effective tier
    let tier = tierOverride || 'free';
    let trial = null;

    if (userId && !tierOverride) {
      // Check for active trial
      const trialInfo = await this.getActiveTrial(userId);
      if (trialInfo) {
        tier = trialInfo.tier;
        trial = {
          active: true,
          daysRemaining: trialInfo.daysRemaining,
          tier: trialInfo.tier,
        };
      }
      // TODO: Check actual subscription tier when Stripe is integrated
    }

    // Get user features
    const resolved = await this.userFeatures.getUserFeatures(userId || '', tier);

    // Build access map
    const access: Record<string, AccessCheck> = {};

    for (const resource of resources) {
      const [type, id] = resource.split(':');
      const featureSlug = `${type}_${id}`;

      const hasAccess = resolved.features[featureSlug];

      if (hasAccess === true || hasAccess === -1) {
        access[resource] = { level: 'full' };
      } else if (typeof hasAccess === 'number' && hasAccess > 0) {
        access[resource] = { level: 'preview', limit: hasAccess };
      } else {
        // Find which tier has this feature
        const tierRequired = await this.findTierWithFeature(featureSlug);
        access[resource] = { level: 'none', tierRequired };
      }
    }

    return { tier, access, trial };
  }

  async trackPaywallEvent(data: {
    userId?: string;
    sessionId?: string;
    resourceType: string;
    resourceId: string;
    userTier: string;
    pagePath?: string;
    eventType: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const client = this.supabase.getClient();

    await client.from('paywall_events').insert({
      user_id: data.userId,
      session_id: data.sessionId,
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      user_tier: data.userTier,
      page_path: data.pagePath,
      event_type: data.eventType,
      metadata: data.metadata || {},
    });
  }

  private async getActiveTrial(userId: string): Promise<{
    tier: string;
    daysRemaining: number;
  } | null> {
    const client = this.supabase.getClient();

    const { data } = await client
      .from('user_trials')
      .select('tier, expires_at')
      .eq('user_id', userId)
      .is('converted_at', null)
      .is('cancelled_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!data) return null;

    const daysRemaining = Math.ceil(
      (new Date(data.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    return { tier: data.tier, daysRemaining };
  }

  private async findTierWithFeature(featureSlug: string): Promise<string> {
    const client = this.supabase.getClient();

    const { data } = await client
      .from('tier_features')
      .select('tier:subscription_tiers(slug)')
      .eq('feature_id', (
        await client
          .from('feature_definitions')
          .select('id')
          .eq('slug', featureSlug)
          .single()
      ).data?.id)
      .eq('value', true)
      .order('tier(display_order)')
      .limit(1)
      .single();

    return (data?.tier as any)?.slug || 'pro';
  }
}
```

**Step 3: Create the controller**

```typescript
// packages/backend/src/entitlements/entitlements.controller.ts
import { Controller, Get, Post, Query, Body, Headers } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

@Controller('api/entitlements')
export class EntitlementsController {
  constructor(private readonly service: EntitlementsService) {}

  @Get('check')
  async checkAccess(
    @Query('resources') resources: string,
    @Query('tier') tierOverride: string,
    @Headers('x-user-id') userId: string,
  ) {
    const resourceList = resources ? resources.split(',') : [];
    return this.service.checkAccess(userId || null, tierOverride || null, resourceList);
  }

  @Post('events')
  async trackEvent(
    @Body() body: {
      resourceType: string;
      resourceId: string;
      eventType: string;
      pagePath?: string;
      metadata?: Record<string, unknown>;
    },
    @Headers('x-user-id') userId: string,
    @Headers('x-session-id') sessionId: string,
    @Headers('x-user-tier') userTier: string,
  ) {
    await this.service.trackPaywallEvent({
      userId: userId || undefined,
      sessionId: sessionId || undefined,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      userTier: userTier || 'free',
      pagePath: body.pagePath,
      eventType: body.eventType,
      metadata: body.metadata,
    });
    return { success: true };
  }
}
```

**Step 4: Register in AppModule**

Modify: `packages/backend/src/app.module.ts`

Add import: `import { EntitlementsModule } from './entitlements/entitlements.module';`
Add to imports array: `EntitlementsModule`

**Step 5: Commit**

```bash
git add packages/backend/src/entitlements/
git add packages/backend/src/app.module.ts
git commit -m "feat(entitlements): add public entitlements API"
```

---

## Phase 3: Frontend Entitlements Context

### Task 3.1: Create Entitlements Types

**Files:**
- Create: `packages/frontend/lib/entitlements/types.ts`

**Step 1: Write the types file**

```typescript
// packages/frontend/lib/entitlements/types.ts

export type UserTier = 'free' | 'pro' | 'enterprise' | 'admin';

export type ResourceType = 'metric' | 'geo' | 'feature';

export type AccessLevel = 'full' | 'preview' | 'none';

export interface AccessInfo {
  level: AccessLevel;
  limit?: number;
  tierRequired?: UserTier;
}

export interface TrialInfo {
  active: boolean;
  daysRemaining?: number;
  tier?: UserTier;
}

export interface EntitlementsState {
  tier: UserTier;
  access: Record<string, AccessInfo>;
  trial: TrialInfo | null;
  loading: boolean;
  error: string | null;
}

export interface EntitlementsContextValue extends EntitlementsState {
  // Access checks
  canAccess: (type: ResourceType, id: string) => boolean;
  getAccess: (type: ResourceType, id: string) => AccessInfo;
  getPreviewLimit: (type: ResourceType, id: string) => number | null;
  getTierRequired: (type: ResourceType, id: string) => UserTier | null;

  // Event tracking
  trackPaywallView: (type: ResourceType, id: string, pagePath?: string) => void;
  trackUpgradeClick: (type: ResourceType, id: string, pagePath?: string) => void;
  trackDismiss: (type: ResourceType, id: string) => void;

  // Tier simulation (dev mode)
  simulatedTier: UserTier | null;
  setSimulatedTier: (tier: UserTier | null) => void;

  // Refresh
  refresh: () => Promise<void>;
}
```

**Step 2: Commit**

```bash
git add packages/frontend/lib/entitlements/types.ts
git commit -m "feat(entitlements): add frontend types"
```

---

### Task 3.2: Create Entitlements API Client

**Files:**
- Create: `packages/frontend/lib/entitlements/api.ts`

**Step 1: Write the API client**

```typescript
// packages/frontend/lib/entitlements/api.ts

import type { EntitlementsState, ResourceType } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export async function fetchEntitlements(
  resources: string[],
  tierOverride?: string | null,
): Promise<EntitlementsState> {
  const params = new URLSearchParams();
  if (resources.length > 0) {
    params.set('resources', resources.join(','));
  }
  if (tierOverride) {
    params.set('tier', tierOverride);
  }

  const response = await fetch(`${API_URL}/api/entitlements/check?${params}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch entitlements');
  }

  const data = await response.json();

  return {
    tier: data.tier,
    access: data.access,
    trial: data.trial,
    loading: false,
    error: null,
  };
}

export async function trackPaywallEvent(
  resourceType: ResourceType,
  resourceId: string,
  eventType: 'view' | 'click_upgrade' | 'dismiss',
  pagePath?: string,
): Promise<void> {
  try {
    await fetch(`${API_URL}/api/entitlements/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        resourceType,
        resourceId,
        eventType,
        pagePath,
      }),
    });
  } catch (error) {
    // Silently fail - analytics should not break the app
    console.warn('Failed to track paywall event:', error);
  }
}
```

**Step 2: Commit**

```bash
git add packages/frontend/lib/entitlements/api.ts
git commit -m "feat(entitlements): add API client"
```

---

### Task 3.3: Create Entitlements Context

**Files:**
- Create: `packages/frontend/lib/entitlements/EntitlementsContext.tsx`

**Step 1: Write the context**

```typescript
// packages/frontend/lib/entitlements/EntitlementsContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type {
  EntitlementsContextValue,
  EntitlementsState,
  UserTier,
  ResourceType,
  AccessInfo
} from './types';
import { fetchEntitlements, trackPaywallEvent } from './api';

const defaultState: EntitlementsState = {
  tier: 'free',
  access: {},
  trial: null,
  loading: true,
  error: null,
};

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

// Resources to pre-fetch on mount
const DEFAULT_RESOURCES = [
  'feature:analytics_assistant',
  'feature:export_csv',
  'feature:reports',
  'geo:zip',
  'geo:county',
];

interface EntitlementsProviderProps {
  children: React.ReactNode;
  initialResources?: string[];
}

export function EntitlementsProvider({
  children,
  initialResources = DEFAULT_RESOURCES
}: EntitlementsProviderProps) {
  const [state, setState] = useState<EntitlementsState>(defaultState);
  const [simulatedTier, setSimulatedTier] = useState<UserTier | null>(null);

  // Check URL for tier override (dev mode)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tierParam = params.get('tier') as UserTier | null;
      if (tierParam && ['free', 'pro', 'enterprise', 'admin'].includes(tierParam)) {
        setSimulatedTier(tierParam);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetchEntitlements(initialResources, simulatedTier);
      setState(data);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [initialResources, simulatedTier]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canAccess = useCallback((type: ResourceType, id: string): boolean => {
    const key = `${type}:${id}`;
    const accessInfo = state.access[key];
    return accessInfo?.level === 'full' || accessInfo?.level === 'preview';
  }, [state.access]);

  const getAccess = useCallback((type: ResourceType, id: string): AccessInfo => {
    const key = `${type}:${id}`;
    return state.access[key] || { level: 'none', tierRequired: 'pro' };
  }, [state.access]);

  const getPreviewLimit = useCallback((type: ResourceType, id: string): number | null => {
    const key = `${type}:${id}`;
    const accessInfo = state.access[key];
    return accessInfo?.level === 'preview' ? (accessInfo.limit ?? null) : null;
  }, [state.access]);

  const getTierRequired = useCallback((type: ResourceType, id: string): UserTier | null => {
    const key = `${type}:${id}`;
    const accessInfo = state.access[key];
    return accessInfo?.tierRequired ?? null;
  }, [state.access]);

  const trackPaywallView = useCallback((type: ResourceType, id: string, pagePath?: string) => {
    trackPaywallEvent(type, id, 'view', pagePath || window.location.pathname);
  }, []);

  const trackUpgradeClick = useCallback((type: ResourceType, id: string, pagePath?: string) => {
    trackPaywallEvent(type, id, 'click_upgrade', pagePath || window.location.pathname);
  }, []);

  const trackDismiss = useCallback((type: ResourceType, id: string) => {
    trackPaywallEvent(type, id, 'dismiss', window.location.pathname);
  }, []);

  const value = useMemo<EntitlementsContextValue>(() => ({
    ...state,
    canAccess,
    getAccess,
    getPreviewLimit,
    getTierRequired,
    trackPaywallView,
    trackUpgradeClick,
    trackDismiss,
    simulatedTier,
    setSimulatedTier,
    refresh,
  }), [
    state,
    canAccess,
    getAccess,
    getPreviewLimit,
    getTierRequired,
    trackPaywallView,
    trackUpgradeClick,
    trackDismiss,
    simulatedTier,
    refresh,
  ]);

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlements(): EntitlementsContextValue {
  const context = useContext(EntitlementsContext);
  if (!context) {
    throw new Error('useEntitlements must be used within an EntitlementsProvider');
  }
  return context;
}
```

**Step 2: Create index export**

```typescript
// packages/frontend/lib/entitlements/index.ts
export * from './types';
export * from './api';
export { EntitlementsProvider, useEntitlements } from './EntitlementsContext';
```

**Step 3: Commit**

```bash
git add packages/frontend/lib/entitlements/
git commit -m "feat(entitlements): add React context and hook"
```

---

## Phase 4: Gating Components

### Task 4.1: Create EntitlementGate Component

**Files:**
- Create: `packages/frontend/components/entitlements/EntitlementGate.tsx`

**Step 1: Write the component**

```typescript
// packages/frontend/components/entitlements/EntitlementGate.tsx
'use client';

import React, { useEffect } from 'react';
import { useEntitlements, ResourceType } from '@/lib/entitlements';

interface EntitlementGateProps {
  type: ResourceType;
  id: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showTeaser?: boolean;
}

export function EntitlementGate({
  type,
  id,
  children,
  fallback,
  showTeaser = false,
}: EntitlementGateProps) {
  const { getAccess, trackPaywallView } = useEntitlements();
  const access = getAccess(type, id);

  useEffect(() => {
    if (access.level === 'none' || (access.level === 'preview' && !showTeaser)) {
      trackPaywallView(type, id);
    }
  }, [access.level, type, id, showTeaser, trackPaywallView]);

  if (access.level === 'full') {
    return <>{children}</>;
  }

  if (access.level === 'preview' && showTeaser) {
    return <>{children}</>;
  }

  return <>{fallback}</> || null;
}
```

**Step 2: Commit**

```bash
git add packages/frontend/components/entitlements/EntitlementGate.tsx
git commit -m "feat(entitlements): add EntitlementGate component"
```

---

### Task 4.2: Create PaywallCard Component

**Files:**
- Create: `packages/frontend/components/entitlements/PaywallCard.tsx`

**Step 1: Write the component**

```typescript
// packages/frontend/components/entitlements/PaywallCard.tsx
'use client';

import React from 'react';
import { Lock } from 'lucide-react';
import { useEntitlements, ResourceType, UserTier } from '@/lib/entitlements';
import Link from 'next/link';

interface PaywallCardProps {
  type: ResourceType;
  id: string;
  title?: string;
  description?: string;
  className?: string;
}

const TIER_LABELS: Record<UserTier, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
  admin: 'Admin',
};

export function PaywallCard({
  type,
  id,
  title,
  description,
  className = '',
}: PaywallCardProps) {
  const { getTierRequired, trackUpgradeClick } = useEntitlements();
  const tierRequired = getTierRequired(type, id) || 'pro';

  const handleUpgradeClick = () => {
    trackUpgradeClick(type, id);
  };

  return (
    <div
      className={`
        bg-surface-container rounded-xl p-6 border border-outline-variant
        flex flex-col items-center text-center gap-4
        ${className}
      `}
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="w-6 h-6 text-primary" />
      </div>

      <div>
        <h3 className="text-lg font-medium text-on-surface">
          {title || 'Upgrade to Unlock'}
        </h3>
        <p className="text-sm text-on-surface-variant mt-1">
          {description || `This feature requires a ${TIER_LABELS[tierRequired]} subscription`}
        </p>
      </div>

      <Link
        href="/pricing"
        onClick={handleUpgradeClick}
        className="
          inline-flex items-center gap-2 px-6 py-2.5
          bg-primary text-on-primary rounded-full
          font-medium text-sm
          hover:bg-primary/90 transition-colors
        "
      >
        View Plans
      </Link>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/components/entitlements/PaywallCard.tsx
git commit -m "feat(entitlements): add PaywallCard component"
```

---

### Task 4.3: Create PaywallOverlay Component

**Files:**
- Create: `packages/frontend/components/entitlements/PaywallOverlay.tsx`

**Step 1: Write the component**

```typescript
// packages/frontend/components/entitlements/PaywallOverlay.tsx
'use client';

import React, { useEffect } from 'react';
import { Lock } from 'lucide-react';
import { useEntitlements, ResourceType } from '@/lib/entitlements';
import Link from 'next/link';

interface PaywallOverlayProps {
  type: ResourceType;
  id: string;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function PaywallOverlay({
  type,
  id,
  children,
  title,
  className = '',
}: PaywallOverlayProps) {
  const { getAccess, trackPaywallView, trackUpgradeClick } = useEntitlements();
  const access = getAccess(type, id);
  const isBlocked = access.level === 'none';

  useEffect(() => {
    if (isBlocked) {
      trackPaywallView(type, id);
    }
  }, [isBlocked, type, id, trackPaywallView]);

  if (!isBlocked) {
    return <>{children}</>;
  }

  const handleUpgradeClick = () => {
    trackUpgradeClick(type, id);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Blurred content */}
      <div className="blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-sm rounded-xl">
        <div className="text-center p-6 max-w-xs">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-on-surface mb-2">
            {title || 'Upgrade to Unlock'}
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">
            This feature requires a {access.tierRequired || 'Pro'} subscription
          </p>
          <Link
            href="/pricing"
            onClick={handleUpgradeClick}
            className="
              inline-flex items-center gap-2 px-6 py-2.5
              bg-primary text-on-primary rounded-full
              font-medium text-sm
              hover:bg-primary/90 transition-colors
            "
          >
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create index export**

```typescript
// packages/frontend/components/entitlements/index.ts
export { EntitlementGate } from './EntitlementGate';
export { PaywallCard } from './PaywallCard';
export { PaywallOverlay } from './PaywallOverlay';
```

**Step 3: Commit**

```bash
git add packages/frontend/components/entitlements/
git commit -m "feat(entitlements): add PaywallOverlay component"
```

---

## Phase 5: Admin UI

### Task 5.1: Create Admin Layout

**Files:**
- Create: `packages/frontend/app/_dev/admin/entitlements/layout.tsx`
- Create: `packages/frontend/app/_dev/admin/entitlements/components/AdminSidebar.tsx`

**Step 1: Write the sidebar component**

```typescript
// packages/frontend/app/_dev/admin/entitlements/components/AdminSidebar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  Clock,
  Users,
  BarChart3,
  Zap,
  BookOpen,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    label: 'Overview',
    href: '/_dev/admin/entitlements',
    icon: LayoutDashboard,
  },
  {
    label: 'Configure',
    items: [
      { label: 'Tiers', href: '/_dev/admin/entitlements/tiers', icon: Layers },
      { label: 'Trial', href: '/_dev/admin/entitlements/trial', icon: Clock },
      { label: 'Users', href: '/_dev/admin/entitlements/users', icon: Users },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', href: '/_dev/admin/entitlements/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Automate',
    items: [
      { label: 'Rules', href: '/_dev/admin/entitlements/automations', icon: Zap },
    ],
  },
  {
    label: 'Learn',
    items: [
      { label: 'Playbook', href: '/_dev/admin/entitlements/playbook', icon: BookOpen },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-surface-container-low border-r border-outline-variant h-screen sticky top-0 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-outline-variant">
        <h1 className="text-lg font-semibold text-on-surface">Entitlements</h1>
        <p className="text-xs text-on-surface-variant">Admin Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((section, idx) => (
          <div key={idx} className="mb-4">
            {'href' in section ? (
              <Link
                href={section.href}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  ${pathname === section.href
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                  }
                `}
              >
                <section.icon className="w-5 h-5" />
                {section.label}
              </Link>
            ) : (
              <>
                <div className="px-3 py-2 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                  {section.label}
                </div>
                <div className="space-y-1">
                  {section.items?.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                        ${pathname === item.href
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-on-surface-variant hover:bg-surface-container-high'
                        }
                      `}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </nav>

      {/* Tier Switcher */}
      <div className="p-4 border-t border-outline-variant">
        <label className="text-xs font-medium text-on-surface-variant block mb-2">
          Simulate Tier
        </label>
        <select className="w-full px-3 py-2 bg-surface-container rounded-lg text-sm border border-outline-variant">
          <option value="">Current Tier</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>
    </aside>
  );
}
```

**Step 2: Write the layout**

```typescript
// packages/frontend/app/_dev/admin/entitlements/layout.tsx
import { AdminSidebar } from './components/AdminSidebar';

export default function EntitlementsAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add packages/frontend/app/_dev/admin/entitlements/
git commit -m "feat(entitlements): add admin layout and sidebar"
```

---

### Task 5.2: Create Overview Page

**Files:**
- Create: `packages/frontend/app/_dev/admin/entitlements/page.tsx`

**Step 1: Write the overview page**

```typescript
// packages/frontend/app/_dev/admin/entitlements/page.tsx
'use client';

import React from 'react';
import { ArrowUpRight, Users, DollarSign, TrendingUp } from 'lucide-react';

function StatCard({
  label,
  value,
  change,
  icon: Icon,
}: {
  label: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {change && (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
            {change}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold text-on-surface">{value}</div>
      <div className="text-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

export default function EntitlementsOverviewPage() {
  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-on-surface">Overview</h1>
        <p className="text-on-surface-variant">
          Monitor entitlements, conversions, and user behavior
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Paywall Hits"
          value="4,231"
          change="+18%"
          icon={TrendingUp}
        />
        <StatCard
          label="Conversions"
          value="187"
          change="+4.4%"
          icon={DollarSign}
        />
        <StatCard
          label="Active Users"
          value="892"
          change="+12%"
          icon={Users}
        />
      </div>

      {/* Action Items */}
      <div className="bg-surface-container rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-on-surface">Action Items</h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            3 new
          </span>
        </div>
        <div className="space-y-3">
          {[
            'High-intent user needs attention',
            '3 Pro users at churn risk',
            '"rental_yield" should be teaser',
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg"
            >
              <span className="text-sm text-on-surface">{item}</span>
              <div className="flex gap-2">
                <button className="text-xs text-primary hover:underline">View</button>
                <button className="text-xs text-on-surface-variant hover:underline">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Configure Tiers', href: '/_dev/admin/entitlements/tiers' },
          { label: 'View Analytics', href: '/_dev/admin/entitlements/analytics' },
          { label: 'Manage Users', href: '/_dev/admin/entitlements/users' },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="
              flex items-center justify-between p-4
              bg-surface-container rounded-xl
              hover:bg-surface-container-high transition-colors
            "
          >
            <span className="text-sm font-medium text-on-surface">{link.label}</span>
            <ArrowUpRight className="w-4 h-4 text-on-surface-variant" />
          </a>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/_dev/admin/entitlements/page.tsx
git commit -m "feat(entitlements): add admin overview page"
```

---

## Remaining Tasks (Deferred)

The following tasks are outlined but implementation is deferred for future phases:

### Phase 5 Continued
- Task 5.3: Tiers Configuration Page (drag-and-drop)
- Task 5.4: Analytics Dashboard Page
- Task 5.5: User Overrides Page
- Task 5.6: Trial Settings Page
- Task 5.7: Automations Page
- Task 5.8: Playbook Page

### Phase 6: Integration
- Task 6.1: Add EntitlementsProvider to app layout
- Task 6.2: Integrate gating in map page
- Task 6.3: Integrate gating in market page
- Task 6.4: Update pricing page to use entitlements

### Phase 7: Polish
- Task 7.1: Add tier simulation persistence
- Task 7.2: Add loading states
- Task 7.3: Add error boundaries
- Task 7.4: Add E2E tests

---

## Summary

This plan provides a foundation for the entitlements system:

1. **Database migrations** for resource gating, paywall events, and trials
2. **Backend service** for checking access and tracking events
3. **Frontend context** for managing entitlements state
4. **Gating components** for blocking and blurring content
5. **Admin UI** with sidebar navigation and overview page

The drag-and-drop tier configuration, analytics dashboard, and automation system are deferred for implementation in subsequent phases.
