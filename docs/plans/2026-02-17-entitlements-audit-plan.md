# Entitlements Audit & Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the admin tiers page the single source of truth for entitlements — fix DB inconsistencies, plug frontend enforcement gaps, and auto-generate pricing page from DB.

**Architecture:** Database-first cleanup (remove duplicates, add `is_enforced` column, fix values), then backend endpoint additions, then frontend enforcement fixes, then pricing page sync, then tiers admin page improvements.

**Tech Stack:** Supabase (PostgreSQL), NestJS backend, Next.js 14 App Router, React Context, @dnd-kit

---

## Task 1: Database Migration — Add `is_enforced` Column

**Files:**
- Create: Supabase migration (via MCP `apply_migration`)

**Step 1: Apply the migration**

Run via Supabase MCP `apply_migration`:

```sql
ALTER TABLE feature_definitions
  ADD COLUMN is_enforced BOOLEAN DEFAULT true;
```

Migration name: `add_is_enforced_to_feature_definitions`

**Step 2: Verify the column exists**

Run via Supabase MCP `execute_sql`:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'feature_definitions' AND column_name = 'is_enforced';
```

Expected: One row with `boolean` type, default `true`.

**Step 3: Set `is_enforced = false` on unbuilt features**

Run via Supabase MCP `execute_sql`:

```sql
UPDATE feature_definitions
SET is_enforced = false, updated_at = now()
WHERE slug IN (
  'export_sheets_enabled', 'export_api_enabled', 'scheduled_exports_enabled',
  'share_links_enabled', 'share_links_branded',
  'watchlist_enabled', 'watchlist_limit', 'notes_enabled',
  'saved_queries_enabled', 'saved_queries_limit',
  'alerts_enabled', 'alerts_limit', 'scheduled_queries_enabled',
  'team_enabled', 'team_members_limit', 'shared_watchlists'
);
```

**Step 4: Verify**

```sql
SELECT slug, is_enforced FROM feature_definitions WHERE is_enforced = false ORDER BY slug;
```

Expected: 16 rows (the unbuilt features listed above). Quinn features should NOT appear here.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat(db): add is_enforced column to feature_definitions"
```

---

## Task 2: Database Cleanup — Remove Duplicates & Fix Values

**Files:**
- Supabase MCP queries (no code files)

**Step 1: Deactivate duplicate features**

```sql
-- Remove from tier_features first
DELETE FROM tier_features
WHERE feature_id IN (
  SELECT id FROM feature_definitions
  WHERE slug IN (
    'analytics_assistant_enabled',
    'export_csv_enabled',
    'analytics_allowed_geographies',
    'time_history_months',
    'metric_custom_analytics'
  )
);

-- Deactivate in feature_definitions
UPDATE feature_definitions
SET is_active = false, updated_at = now()
WHERE slug IN (
  'analytics_assistant_enabled',
  'export_csv_enabled',
  'analytics_allowed_geographies',
  'time_history_months',
  'metric_custom_analytics'
);
```

**Step 2: Verify duplicates are gone from active features**

```sql
SELECT slug, is_active FROM feature_definitions
WHERE slug IN (
  'analytics_assistant_enabled', 'export_csv_enabled',
  'analytics_allowed_geographies', 'time_history_months',
  'metric_custom_analytics'
);
```

Expected: All 5 rows show `is_active = false`.

**Step 3: Fix `feature_analytics_assistant` — Pro should be `true`**

```sql
UPDATE tier_features
SET value = 'true', updated_at = now()
WHERE feature_id = (SELECT id FROM feature_definitions WHERE slug = 'feature_analytics_assistant')
  AND tier_id = (SELECT id FROM subscription_tiers WHERE slug = 'pro');
```

**Step 4: Verify the fix**

```sql
SELECT st.slug AS tier, fd.slug AS feature, tf.value
FROM tier_features tf
JOIN subscription_tiers st ON tf.tier_id = st.id
JOIN feature_definitions fd ON tf.feature_id = fd.id
WHERE fd.slug = 'feature_analytics_assistant'
ORDER BY st.display_order;
```

Expected: free=false, pro=true, enterprise=true.

**Step 5: Commit**

```bash
git add -A && git commit -m "fix(db): remove duplicate features, fix analytics_assistant pro value"
```

---

## Task 3: Database — Add `preview_reports_limit` Feature

**Files:**
- Supabase MCP queries

**Step 1: Create the feature definition**

```sql
INSERT INTO feature_definitions (slug, name, description, category, value_type, default_value, is_active, is_enforced)
VALUES (
  'preview_reports_limit',
  'Report Generation Limit',
  'Number of reports a free user can generate. -1 = unlimited.',
  'preview',
  'integer',
  '0',
  true,
  true
);
```

**Step 2: Set tier values**

```sql
-- Free: 2 reports
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT st.id, fd.id, '2'
FROM subscription_tiers st, feature_definitions fd
WHERE st.slug = 'free' AND fd.slug = 'preview_reports_limit';

-- Pro: unlimited (-1)
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT st.id, fd.id, '-1'
FROM subscription_tiers st, feature_definitions fd
WHERE st.slug = 'pro' AND fd.slug = 'preview_reports_limit';

-- Enterprise: unlimited (-1)
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT st.id, fd.id, '-1'
FROM subscription_tiers st, feature_definitions fd
WHERE st.slug = 'enterprise' AND fd.slug = 'preview_reports_limit';

-- Admin: unlimited (-1)
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT st.id, fd.id, '-1'
FROM subscription_tiers st, feature_definitions fd
WHERE st.slug = 'admin' AND fd.slug = 'preview_reports_limit';
```

**Step 3: Verify**

```sql
SELECT st.slug AS tier, tf.value
FROM tier_features tf
JOIN subscription_tiers st ON tf.tier_id = st.id
JOIN feature_definitions fd ON tf.feature_id = fd.id
WHERE fd.slug = 'preview_reports_limit'
ORDER BY st.display_order;
```

Expected: free=2, pro=-1, enterprise=-1, admin=-1.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(db): add preview_reports_limit feature (2 free, unlimited paid)"
```

---

## Task 4: Database — Clean Up Feature Display Names

**Files:**
- Supabase MCP queries

**Step 1: Update confusing feature names**

```sql
UPDATE feature_definitions SET name = 'Gross Rent Multiplier', updated_at = now() WHERE slug = 'metric_grm' AND name ILIKE '%grm%';
UPDATE feature_definitions SET name = 'Multi-Family Permits', updated_at = now() WHERE slug = 'metric_mf_permits' AND name ILIKE '%mf permits%';
UPDATE feature_definitions SET name = 'SF/MF Permit Ratio', updated_at = now() WHERE slug = 'metric_sf_mf_ratio' AND name ILIKE '%sf mf ratio%';
UPDATE feature_definitions SET name = 'PropertyIQ Composite Score', updated_at = now() WHERE slug = 'metric_piq_score' AND name ILIKE '%piq%';
UPDATE feature_definitions SET name = 'Home Value MoM Change', updated_at = now() WHERE slug = 'metric_home_value_mom' AND name ILIKE '%mom%';
```

**Step 2: Check for other unclear names**

```sql
SELECT slug, name FROM feature_definitions
WHERE is_active = true
  AND (name ILIKE '%metric%' OR LENGTH(name) < 15)
ORDER BY category, name;
```

Review output and update any remaining confusing names.

**Step 3: Commit**

```bash
git add -A && git commit -m "fix(db): clean up feature display names for clarity"
```

---

## Task 5: Database — Create `user_feature_usage` Table

**Files:**
- Supabase migration (via MCP `apply_migration`)

**Step 1: Apply the migration**

Migration name: `create_user_feature_usage_table`

```sql
CREATE TABLE user_feature_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature_slug TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  period TEXT DEFAULT 'lifetime',
  period_start TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, feature_slug, period, period_start)
);

-- Index for fast lookups
CREATE INDEX idx_user_feature_usage_lookup
  ON user_feature_usage (user_id, feature_slug, period);

-- RLS: users can only see their own usage
ALTER TABLE user_feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON user_feature_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON user_feature_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON user_feature_usage FOR UPDATE
  USING (auth.uid() = user_id);
```

**Step 2: Verify table exists**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_feature_usage'
ORDER BY ordinal_position;
```

Expected: 7 columns (id, user_id, feature_slug, usage_count, period, period_start, created_at, updated_at).

**Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): create user_feature_usage table for preview limit tracking"
```

---

## Task 6: Backend — Add `is_enforced` to Feature Matrix & Definitions

**Files:**
- Modify: `packages/backend/src/admin/features/features.service.ts:10-20` (FeatureDefinition interface)
- Modify: `packages/backend/src/admin/features/features.service.ts:88-143` (getFeatureMatrix method)

**Step 1: Update the `FeatureDefinition` interface**

In `packages/backend/src/admin/features/features.service.ts`, add `is_enforced` to the interface:

```typescript
export interface FeatureDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  value_type: 'boolean' | 'integer' | 'string' | 'json';
  default_value: unknown;
  is_active: boolean;
  is_enforced: boolean;  // <-- ADD THIS
  created_at: string;
  updated_at: string;
}
```

No other backend changes needed — the `SELECT *` queries already return `is_enforced` from the DB. The interface just needs to declare it so TypeScript consumers are aware.

**Step 2: Verify the matrix endpoint returns `is_enforced`**

Start the dev server if not running and hit:

```bash
curl http://localhost:3001/api/admin/features/matrix | jq '.data.features[0]'
```

Expected: The first feature object should include `"is_enforced": true` or `"is_enforced": false`.

**Step 3: Commit**

```bash
git add packages/backend/src/admin/features/features.service.ts
git commit -m "feat(backend): add is_enforced to FeatureDefinition interface"
```

---

## Task 7: Backend — Add Pricing Summary Endpoint

**Files:**
- Modify: `packages/backend/src/admin/features/features.service.ts` (add method)
- Modify: `packages/backend/src/admin/features/features.controller.ts` (add route)

**Step 1: Add `getPricingSummary()` to `FeaturesService`**

Add this method at the end of the `FeaturesService` class in `packages/backend/src/admin/features/features.service.ts` (before the `private async logAudit` method):

```typescript
  /**
   * Get pricing summary for the public pricing page.
   * Returns tier info + feature bullets grouped by category.
   */
  async getPricingSummary(): Promise<{
    tiers: Array<{
      slug: string;
      name: string;
      price_monthly: string | null;
      price_yearly: string | null;
      description: string | null;
      features: Array<{
        slug: string;
        name: string;
        category: string;
        value: unknown;
        value_type: string;
      }>;
    }>;
  }> {
    const client = this.supabase.getClient();

    // Get active tiers (exclude admin)
    const { data: tiers, error: tiersError } = await client
      .from('subscription_tiers')
      .select('id, slug, name, description, price_monthly, price_yearly, display_order')
      .eq('is_active', true)
      .neq('slug', 'admin')
      .order('display_order');

    if (tiersError) throw new Error(tiersError.message);

    // Get enforced, active features
    const { data: features, error: featuresError } = await client
      .from('feature_definitions')
      .select('id, slug, name, category, value_type')
      .eq('is_active', true)
      .eq('is_enforced', true)
      .order('category')
      .order('name');

    if (featuresError) throw new Error(featuresError.message);

    // Get tier_features values
    const { data: tierFeatures, error: tfError } = await client
      .from('tier_features')
      .select('tier_id, feature_id, value');

    if (tfError) throw new Error(tfError.message);

    // Build lookup: tier_id -> feature_id -> value
    const tfLookup: Record<string, Record<string, unknown>> = {};
    for (const tf of tierFeatures || []) {
      if (!tfLookup[tf.tier_id]) tfLookup[tf.tier_id] = {};
      tfLookup[tf.tier_id][tf.feature_id] = tf.value;
    }

    return {
      tiers: (tiers || []).map(tier => ({
        slug: tier.slug,
        name: tier.name,
        price_monthly: tier.price_monthly,
        price_yearly: tier.price_yearly,
        description: tier.description,
        features: (features || [])
          .map(f => ({
            slug: f.slug,
            name: f.name,
            category: f.category,
            value: tfLookup[tier.id]?.[f.id] ?? null,
            value_type: f.value_type,
          }))
          .filter(f => f.value === true || (typeof f.value === 'number' && f.value !== 0) || f.value === 'true'),
      })),
    };
  }
```

**Step 2: Add the route to `FeaturesController`**

In `packages/backend/src/admin/features/features.controller.ts`, add this method after `getFeaturesByCategory()` and **before** `getFeatureMatrix()` (route ordering matters — `pricing-summary` must come before `:slug`):

```typescript
  /**
   * Get pricing summary for public pricing page
   * GET /api/admin/features/pricing-summary
   */
  @Get('pricing-summary')
  async getPricingSummary() {
    this.logger.log('GET /admin/features/pricing-summary');

    try {
      const summary = await this.featuresService.getPricingSummary();
      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
```

**Step 3: Verify the endpoint works**

```bash
curl http://localhost:3001/api/admin/features/pricing-summary | jq '.data.tiers | length'
```

Expected: `3` (free, pro, enterprise).

```bash
curl http://localhost:3001/api/admin/features/pricing-summary | jq '.data.tiers[0].slug'
```

Expected: `"free"`

**Step 4: Commit**

```bash
git add packages/backend/src/admin/features/features.service.ts packages/backend/src/admin/features/features.controller.ts
git commit -m "feat(backend): add pricing-summary endpoint for dynamic pricing page"
```

---

## Task 8: Frontend — Fix StepTemplate Hardcoded Tier

**Files:**
- Modify: `packages/frontend/app/reports/components/wizard/StepTemplate.tsx:196`

**Step 1: Add the `useEntitlements` import**

In `packages/frontend/app/reports/components/wizard/StepTemplate.tsx`, add to the imports at the top:

```typescript
import { useEntitlements } from '@/lib/entitlements';
```

**Step 2: Replace the hardcoded tier**

Replace lines 195-196:

```typescript
  // TODO: Get from user authentication context
  const currentTier: SubscriptionTier = 'pro';
```

With:

```typescript
  const { tier, simulatedTier } = useEntitlements();
  const currentTier: SubscriptionTier = (simulatedTier || tier || 'free') as SubscriptionTier;
```

**Step 3: Verify in the browser**

1. Navigate to `http://localhost:3000/reports`
2. Open dev toolbar, set simulated tier to "free"
3. Templates with `tier_required: 'basic'` or higher should show lock icons
4. Switch to "pro" — locks should clear for basic/pro templates
5. Switch back to no simulation — should use actual tier

**Step 4: Commit**

```bash
git add packages/frontend/app/reports/components/wizard/StepTemplate.tsx
git commit -m "fix(reports): use actual tier instead of hardcoded 'pro' in StepTemplate"
```

---

## Task 9: Frontend — Add EntitlementGate to Report Viewer

**Files:**
- Modify: `packages/frontend/app/reports/[id]/page.tsx`

**Step 1: Read and update the report viewer page**

Replace the entire content of `packages/frontend/app/reports/[id]/page.tsx`:

```typescript
'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { ReportViewer } from './ReportViewer';
import { EntitlementGate } from '@/components/entitlements/EntitlementGate';
import { PaywallCard } from '@/components/entitlements/PaywallCard';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-on-surface-variant">Loading report...</p>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const params = useParams();
  const reportId = params.id as string;

  return (
    <Suspense fallback={<LoadingFallback />}>
      <EntitlementGate
        type="feature"
        id="reports"
        fallback={
          <div className="min-h-screen bg-surface flex items-center justify-center p-6">
            <PaywallCard
              title="Market Reports"
              description="Generate AI-powered market reports with executive summaries, investment theses, and risk assessments."
              featureType="feature"
              featureId="reports"
            />
          </div>
        }
      >
        <ReportViewer reportId={reportId} />
      </EntitlementGate>
    </Suspense>
  );
}
```

**Step 2: Verify the PaywallCard import path exists**

Check that `@/components/entitlements/PaywallCard` exports correctly. If the file uses a default export instead of named, adjust the import.

**Step 3: Verify in the browser**

1. Set simulated tier to "free" via dev toolbar
2. Navigate to a report URL like `http://localhost:3000/reports/some-report-id`
3. Should see the PaywallCard instead of the report
4. Set tier to "pro" — should see the full report

**Step 4: Commit**

```bash
git add "packages/frontend/app/reports/[id]/page.tsx"
git commit -m "feat(reports): add EntitlementGate to report viewer page"
```

---

## Task 10: Frontend — Add Usage Tracking to EntitlementsContext

**Files:**
- Modify: `packages/frontend/lib/entitlements/types.ts`
- Modify: `packages/frontend/lib/entitlements/EntitlementsContext.tsx`
- Modify: `packages/frontend/lib/entitlements/api.ts`

**Step 1: Add usage types to `types.ts`**

In `packages/frontend/lib/entitlements/types.ts`, add at the end:

```typescript
export interface FeatureUsage {
  feature_slug: string;
  usage_count: number;
  limit: number; // -1 = unlimited
  remaining: number; // -1 = unlimited, 0 = at limit
}
```

Add to the `EntitlementsContextValue` interface, after the `refresh` line:

```typescript
  // Usage tracking (for preview limits)
  getUsage: (featureSlug: string) => FeatureUsage | null;
  incrementUsage: (featureSlug: string) => Promise<boolean>;
```

**Step 2: Add API functions to `api.ts`**

In `packages/frontend/lib/entitlements/api.ts`, add:

```typescript
/** Fetch usage count for a feature */
export async function fetchFeatureUsage(
  featureSlug: string,
  userId: string,
): Promise<{ usage_count: number }> {
  // TODO: Wire to real endpoint when user auth is in place
  // For now, return 0 to not block any usage
  return { usage_count: 0 };
}

/** Increment usage count for a feature */
export async function incrementFeatureUsage(
  featureSlug: string,
  userId: string,
): Promise<{ success: boolean; new_count: number }> {
  // TODO: Wire to real endpoint when user auth is in place
  return { success: true, new_count: 0 };
}
```

**Step 3: Wire into `EntitlementsContext.tsx`**

In `packages/frontend/lib/entitlements/EntitlementsContext.tsx`:

1. Import the new type:
```typescript
import type {
  EntitlementsContextValue,
  EntitlementsState,
  UserTier,
  ResourceType,
  AccessInfo,
  FeatureUsage,
} from './types';
```

2. Add state for usage tracking inside `EntitlementsProvider`, after the `simulatedAuth` state:
```typescript
  const [usageCache, setUsageCache] = useState<Record<string, number>>({});
```

3. Add the two methods before the `value` useMemo:
```typescript
  const getUsage = useCallback((featureSlug: string): FeatureUsage | null => {
    const previewLimit = getPreviewLimit('feature', featureSlug.replace('preview_', '').replace('_limit', ''));
    // Also check direct feature slug in access map
    const key = `feature:${featureSlug}`;
    const accessInfo = state.access[key];
    const limit = accessInfo?.limit ?? previewLimit ?? null;

    if (limit === null) return null;
    if (limit === -1) return { feature_slug: featureSlug, usage_count: 0, limit: -1, remaining: -1 };

    const count = usageCache[featureSlug] || 0;
    return {
      feature_slug: featureSlug,
      usage_count: count,
      limit,
      remaining: Math.max(0, limit - count),
    };
  }, [state.access, getPreviewLimit, usageCache]);

  const incrementUsage = useCallback(async (featureSlug: string): Promise<boolean> => {
    const usage = getUsage(featureSlug);
    if (!usage) return true; // No limit configured
    if (usage.limit === -1) return true; // Unlimited
    if (usage.remaining <= 0) return false; // At limit

    setUsageCache(prev => ({
      ...prev,
      [featureSlug]: (prev[featureSlug] || 0) + 1,
    }));
    return true;
  }, [getUsage]);
```

4. Add `getUsage` and `incrementUsage` to the `value` useMemo object and its dependency array.

**Step 4: Verify TypeScript compiles**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors related to entitlements.

**Step 5: Commit**

```bash
git add packages/frontend/lib/entitlements/types.ts packages/frontend/lib/entitlements/api.ts packages/frontend/lib/entitlements/EntitlementsContext.tsx
git commit -m "feat(entitlements): add usage tracking methods to context"
```

---

## Task 11: Frontend — Tiers Admin Page: Add `is_enforced` Support & Planned Section

**Files:**
- Modify: `packages/frontend/app/dev/admin/entitlements/tiers/page.tsx`

This is the largest frontend change. The tiers page needs:
1. Read `is_enforced` from the matrix response
2. Split features into "active" (is_enforced=true) and "planned" (is_enforced=false)
3. Show planned features in a separate section below the three columns
4. Add tooltips showing slug + description on hover

**Step 1: Update the `FeatureDefinition` interface**

In the tiers page, update the `FeatureDefinition` interface (around line 60):

```typescript
interface FeatureDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category: string;
  value_type: string;
  is_active: boolean;
  is_enforced: boolean;  // <-- ADD
}
```

**Step 2: Update FeatureChip to show tooltip with slug and description**

Replace the `title` prop on the chip `div` (line 124):

```typescript
      title={`${feature.slug}${feature.description ? '\n' + feature.description : ''}`}
```

Also, for integer-type features, show the value next to the name. Update the chip content (line 126):

```typescript
      {feature.name}
      {feature.value_type === 'integer' && (
        <span className="ml-1 text-[10px] opacity-60">
          (int)
        </span>
      )}
```

**Step 3: Split features into active and planned**

In the `TiersConfigurationPage` component, after the `filteredFeatures` useMemo (around line 309-317), add:

```typescript
  const activeFeatures = useMemo(() =>
    filteredFeatures.filter(f => f.is_enforced !== false),
    [filteredFeatures]
  );

  const plannedFeatures = useMemo(() =>
    filteredFeatures.filter(f => f.is_enforced === false),
    [filteredFeatures]
  );
```

**Step 4: Update `featuresByTier` to use `activeFeatures`**

Change the `featuresByTier` useMemo to use `activeFeatures` instead of `filteredFeatures`:

```typescript
  const featuresByTier = useMemo(() => {
    const result: Record<string, FeatureDefinition[]> = { free: [], pro: [], enterprise: [] };
    for (const feature of activeFeatures) {  // <-- CHANGED from filteredFeatures
      const tier = assignments[feature.id] || 'enterprise';
      if (result[tier]) result[tier].push(feature);
    }
    return result;
  }, [activeFeatures, assignments]);  // <-- CHANGED dep
```

**Step 5: Add a `plannedByTier` memo**

```typescript
  const plannedByTier = useMemo(() => {
    const result: Record<string, FeatureDefinition[]> = { free: [], pro: [], enterprise: [] };
    for (const feature of plannedFeatures) {
      const tier = assignments[feature.id] || 'enterprise';
      if (result[tier]) result[tier].push(feature);
    }
    return result;
  }, [plannedFeatures, assignments]);
```

**Step 6: Update the feature count display**

Change line 514-516 to show both counts:

```typescript
      <div className="text-xs text-on-surface-variant mb-4">
        {activeFeatures.length} active features
        {plannedFeatures.length > 0 && ` · ${plannedFeatures.length} planned`}
      </div>
```

**Step 7: Add the Planned Features section**

After the `</DndContext>` closing tag (line 544) and before the empty-state check (line 546), add:

```typescript
      {/* Planned Features Section */}
      {plannedFeatures.length > 0 && (
        <div className="mt-8">
          <div className="border-t-2 border-dashed border-outline-variant pt-6">
            <h2 className="text-lg font-semibold text-on-surface-variant mb-1">
              Planned Features
              <span className="text-xs font-normal ml-2 text-on-surface-variant/60">
                (not yet enforced — pre-assign to tiers for when they&apos;re built)
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {['free', 'pro', 'enterprise'].map(tierSlug => {
                const tierFeatures = plannedByTier[tierSlug] || [];
                const style = TIER_STYLES[tierSlug] || TIER_STYLES.free;
                const byCategory: Record<string, FeatureDefinition[]> = {};
                tierFeatures.forEach(f => {
                  if (!byCategory[f.category]) byCategory[f.category] = [];
                  byCategory[f.category].push(f);
                });

                return (
                  <div key={tierSlug} className={`rounded-xl border ${style.border} ${style.bg} p-3 opacity-70`}>
                    <div className={`text-xs font-semibold ${style.text} mb-2`}>
                      {tierSlug.charAt(0).toUpperCase() + tierSlug.slice(1)}
                      <span className="ml-2 font-normal">({tierFeatures.length})</span>
                    </div>
                    {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, features]) => (
                      <div key={cat} className="mb-2">
                        <div className="text-[10px] uppercase tracking-wider text-on-surface-variant/50 mb-1">{cat}</div>
                        <div className="flex flex-wrap gap-1">
                          {features.map(f => (
                            <span
                              key={f.id}
                              className={`px-2 py-0.5 text-[11px] rounded border ${style.chip} opacity-60`}
                              title={`${f.slug}\n${f.description || 'No description'}`}
                            >
                              {f.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {tierFeatures.length === 0 && (
                      <div className="text-xs text-on-surface-variant/40 italic">None</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
```

**Step 8: Verify in the browser**

1. Navigate to `http://localhost:3000/dev/admin/entitlements/tiers`
2. The three active columns should no longer show the 16 unbuilt features (export_sheets_enabled, watchlist_enabled, etc.)
3. Below the columns, a "Planned Features" section should appear with those 16 features pre-assigned to their tiers
4. Hovering over any chip should show its slug and description

**Step 9: Commit**

```bash
git add "packages/frontend/app/dev/admin/entitlements/tiers/page.tsx"
git commit -m "feat(tiers): add Planned Features section, tooltips, is_enforced support"
```

---

## Task 12: Frontend — Pricing Page: Auto-Generate Plan Cards from DB

**Files:**
- Modify: `packages/frontend/app/pricing/page.tsx`
- Modify: `packages/frontend/lib/data/fetchers/` (add pricing fetcher)

**Step 1: Add pricing fetcher to the data layer**

Check which fetcher file is appropriate (or create one). Add to `packages/frontend/lib/data/fetchers/` — find the most relevant existing file (likely a general or admin fetcher). Add:

```typescript
export async function fetchPricingSummary(): Promise<{
  tiers: Array<{
    slug: string;
    name: string;
    price_monthly: string | null;
    price_yearly: string | null;
    description: string | null;
    features: Array<{
      slug: string;
      name: string;
      category: string;
      value: unknown;
      value_type: string;
    }>;
  }>;
}> {
  const response = await fetchAPIRaw('/api/admin/features/pricing-summary');
  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Failed to fetch pricing summary');
  return result.data;
}
```

Export it from `packages/frontend/lib/data/index.ts`.

**Step 2: Update the pricing page**

In `packages/frontend/app/pricing/page.tsx`:

1. Remove the hardcoded `PLANS` array (lines 14-64) and `PLAN_TO_TIER` (lines 67-71).

2. Add imports:
```typescript
import { useState, useEffect } from 'react';  // add useState to existing import
import { fetchPricingSummary } from '@/lib/data';
```

3. Inside `PricingContent()`, add data fetching state:
```typescript
  const [plans, setPlans] = useState<Array<{
    slug: string;
    name: string;
    price_monthly: string | null;
    price_yearly: string | null;
    description: string | null;
    features: Array<{ slug: string; name: string; category: string }>;
  }>>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    fetchPricingSummary()
      .then(data => setPlans(data.tiers))
      .catch(err => {
        console.warn('Using fallback plans:', err.message);
        // Fallback to minimal static data
        setPlans([
          { slug: 'free', name: 'Free', price_monthly: '0', price_yearly: '0', description: 'Explore the platform', features: [] },
          { slug: 'pro', name: 'Pro', price_monthly: '29', price_yearly: '290', description: 'The unfair advantage', features: [] },
          { slug: 'enterprise', name: 'Enterprise', price_monthly: '99', price_yearly: '990', description: 'For brokerages', features: [] },
        ]);
      })
      .finally(() => setPlansLoading(false));
  }, []);

  const effectiveTier = trial?.active ? trial.tier : tier;
```

4. Update the pricing cards grid to map over `plans` instead of `PLANS`. For each plan card:
   - Use `plan.slug` instead of `PLAN_TO_TIER[plan.name]` for tier matching
   - Use `plan.price_monthly` for price display (format as `$${plan.price_monthly}`)
   - Use `plan.features.map(f => f.name)` for feature bullets
   - Keep CTA logic (Start Free Trial for pro, Contact Sales for enterprise, Get Started for free)

5. Fix the free tier metro claim: since features come from DB now, the feature list will accurately reflect what's available — no more "400+ metro-level dashboards" for free unless `geo_metro` is actually enabled.

**Step 3: Keep the editorial showcase sections unchanged**

The sections from line 216 onward (AI Market Analysis, PropertyIQ Scores, Market Reports, Geographic Data Depth) stay as manual marketing copy. Do not modify them.

**Step 4: Verify in the browser**

1. Navigate to `http://localhost:3000/pricing`
2. Plan cards should show feature bullets pulled from the DB
3. Prices should match `subscription_tiers` table ($0, $29, $99)
4. "Current Plan" badge should still work
5. Editorial showcase sections below should be unchanged

**Step 5: Commit**

```bash
git add packages/frontend/lib/data/ packages/frontend/app/pricing/page.tsx
git commit -m "feat(pricing): auto-generate plan cards from DB instead of hardcoded array"
```

---

## Task 13: Verify End-to-End Flow

**Files:** None (manual testing)

**Step 1: Test the tiers admin page as source of truth**

1. Go to `http://localhost:3000/dev/admin/entitlements/tiers`
2. Drag a feature (e.g., `feature_export_csv`) from Pro to Enterprise
3. Click Save
4. Go to Pricing page — the feature bullet should no longer appear in Pro column, only Enterprise

**Step 2: Test report viewer gate**

1. Set simulated tier to "free"
2. Navigate to `/reports/[any-report-id]`
3. Should see PaywallCard
4. Switch to "pro" — should see the report

**Step 3: Test StepTemplate tier check**

1. Set simulated tier to "free"
2. Go to `/reports`, start the wizard
3. Templates requiring "basic" or "pro" should show lock icons
4. Free templates should be selectable

**Step 4: Test planned features section**

1. Go to tiers page
2. Verify the 16 unbuilt features appear in the Planned section, NOT in the active columns
3. Verify Quinn features (analytics_queries_per_day, charts_enabled, etc.) appear in the ACTIVE columns

**Step 5: Verify duplicate features are gone**

1. Tiers page should not show: `analytics_assistant_enabled`, `export_csv_enabled`, `analytics_allowed_geographies`, `time_history_months`, `metric_custom_analytics`
2. Only their canonical counterparts remain

**Step 6: Commit any final adjustments**

```bash
git add -A && git commit -m "chore: final verification and cleanup"
```

---

## Summary of All Commits

| # | Message |
|---|---------|
| 1 | `feat(db): add is_enforced column to feature_definitions` |
| 2 | `fix(db): remove duplicate features, fix analytics_assistant pro value` |
| 3 | `feat(db): add preview_reports_limit feature (2 free, unlimited paid)` |
| 4 | `fix(db): clean up feature display names for clarity` |
| 5 | `feat(db): create user_feature_usage table for preview limit tracking` |
| 6 | `feat(backend): add is_enforced to FeatureDefinition interface` |
| 7 | `feat(backend): add pricing-summary endpoint for dynamic pricing page` |
| 8 | `fix(reports): use actual tier instead of hardcoded 'pro' in StepTemplate` |
| 9 | `feat(reports): add EntitlementGate to report viewer page` |
| 10 | `feat(entitlements): add usage tracking methods to context` |
| 11 | `feat(tiers): add Planned Features section, tooltips, is_enforced support` |
| 12 | `feat(pricing): auto-generate plan cards from DB instead of hardcoded array` |
| 13 | `chore: final verification and cleanup` |

## Out of Scope (deferred)

- Stripe integration for real subscription management
- Auth context for real user IDs (currently hardcoded)
- Quinn rate limiting enforcement (DB features exist but not wired)
- Building the actual unbuilt features (exports, watchlist, notes, alerts, teams)
- Preview limit enforcement for markets/metrics/timeseries (table is created but enforcement not wired)
