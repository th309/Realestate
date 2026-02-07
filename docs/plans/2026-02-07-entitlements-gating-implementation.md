# Entitlements Gating Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate entitlements gating into the data layer, selectors, and feature blocks so that metrics, geo levels, and features are gated consistently across all pages.

**Design doc:** `docs/plans/2026-02-07-entitlements-gating-integration-design.md`

**Constraints:**
- 300-line file limit (project_instructions.md)
- Modular/colocation pattern - related utils stay in same feature folder
- All data fetching through `@/lib/data` (CLAUDE.md)
- Material Design 3 styling (project_instructions.md)
- No hardcoded values - use registry as source of truth

---

## Phase 1: Entitlements Context Upgrades

### Task 1.1: Auto-generate resource list from registry

**Files:**
- Modify: `packages/frontend/lib/entitlements/EntitlementsContext.tsx`

**What to do:**
1. Import `getAllMetricIds` from `@/lib/data`
2. Replace hardcoded `DEFAULT_RESOURCES` array with auto-generated list
3. Build resource list from registry metrics + geo levels + features

```typescript
import { getAllMetricIds } from '@/lib/data';

const GEO_LEVELS = ['national', 'state', 'metro', 'county', 'city', 'zip', 'tract'];
const FEATURES = ['analytics_assistant', 'export_csv', 'reports', 'ai_insights'];

function buildResourceList(): string[] {
  return [
    ...getAllMetricIds().map(id => `metric:${id}`),
    ...GEO_LEVELS.map(g => `geo:${g}`),
    ...FEATURES.map(f => `feature:${f}`),
  ];
}
```

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): auto-generate resource list from metric registry"
```

---

### Task 1.2: Add isMetricGated helper and 30-minute TTL

**Files:**
- Modify: `packages/frontend/lib/entitlements/EntitlementsContext.tsx`
- Modify: `packages/frontend/lib/entitlements/types.ts`

**What to do:**
1. Add `isMetricGated` to `EntitlementsContextValue` in types.ts:
   ```typescript
   isMetricGated: (metricId: string) => boolean;
   ```
2. Implement in context:
   ```typescript
   const isMetricGated = useCallback((metricId: string): boolean => {
     const access = getAccess('metric', metricId);
     return access.level === 'none';
   }, [getAccess]);
   ```
3. Add 30-minute TTL refresh:
   ```typescript
   const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

   useEffect(() => {
     const interval = setInterval(() => {
       refresh();
     }, REFRESH_INTERVAL_MS);
     return () => clearInterval(interval);
   }, [refresh]);
   ```
4. Export `isMetricGated` in the context value

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add isMetricGated helper and 30-min TTL refresh"
```

---

## Phase 2: Data Hook Gating

### Task 2.1: Create shared gating utility

**Files:**
- Create: `packages/frontend/lib/data/hooks/useMetricAccess.ts`

**Why a separate file:** Keeps gating logic in one place. All hooks call this instead of duplicating the entitlements check. Follows 300-line rule and colocation pattern.

**What to do:**
```typescript
// packages/frontend/lib/data/hooks/useMetricAccess.ts
'use client';

import { useEntitlements, type AccessInfo, type UserTier } from '@/lib/entitlements';

export interface MetricAccessResult {
  /** Whether this metric is fully gated (no access) */
  gated: boolean;
  /** Whether this metric is in preview mode */
  preview: boolean;
  /** Preview limit (e.g., months of history, row count) */
  previewLimit: number | null;
  /** Tier required to unlock */
  tierRequired: UserTier | null;
  /** Raw access info */
  accessInfo: AccessInfo;
}

/**
 * Check entitlement access for a metric.
 * Used internally by data hooks to gate API calls.
 */
export function useMetricAccess(metricId: string): MetricAccessResult {
  const { getAccess } = useEntitlements();
  const accessInfo = getAccess('metric', metricId);

  return {
    gated: accessInfo.level === 'none',
    preview: accessInfo.level === 'preview',
    previewLimit: accessInfo.level === 'preview' ? (accessInfo.limit ?? null) : null,
    tierRequired: accessInfo.tierRequired ?? null,
    accessInfo,
  };
}
```

**Step 2: Export from hooks index (if one exists) or from `lib/data/index.ts`**

**Step 3: Commit**
```bash
git commit -m "feat(entitlements): add shared useMetricAccess utility for data hooks"
```

---

### Task 2.2: Add gating to useSnapshotData

**Files:**
- Modify: `packages/frontend/lib/data/hooks/useSnapshotData.ts`

**What to do:**
1. Import `useMetricAccess` and `MetricAccessResult`
2. Add gating fields to `UseSnapshotDataResult`:
   ```typescript
   export interface UseSnapshotDataResult {
     // ... existing fields
     /** Whether metric is gated */
     gated: boolean;
     /** Tier required to unlock */
     tierRequired?: UserTier;
     /** Whether in preview mode */
     preview?: boolean;
     /** Preview limit */
     previewLimit?: number | null;
   }
   ```
3. Call `useMetricAccess(metricId)` at top of hook
4. If `gated`, skip the query and return early:
   ```typescript
   const access = useMetricAccess(metricId);

   // ... existing useQuery code, but modify enabled:
   enabled: enabled && !!metricId && !!geoLevel && !access.gated,

   // If gated, override return values
   if (access.gated) {
     return {
       allData: {},
       entry: null,
       value: null,
       formattedValue: '--',
       date: undefined,
       isLoading: false,
       error: null,
       refetch: () => {},
       gated: true,
       tierRequired: access.tierRequired ?? undefined,
     };
   }
   ```
5. For non-gated results, include `gated: false, preview: access.preview, previewLimit: access.previewLimit`

**Line count check:** Currently 153 lines. Adding ~20 lines of gating = ~173. Under 300.

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add gating to useSnapshotData hook"
```

---

### Task 2.3: Add gating to useTimeSeriesData

**Files:**
- Modify: `packages/frontend/lib/data/hooks/useTimeSeriesData.ts`

**Same pattern as Task 2.2:**
1. Import `useMetricAccess`
2. Add gating fields to result interface
3. Call `useMetricAccess(metricId)` at top
4. If gated, disable query and return early with `gated: true`
5. For preview mode, pass `previewLimit` so components can truncate time range

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add gating to useTimeSeriesData hook"
```

---

### Task 2.4: Add gating to useTrendData

**Files:**
- Modify: `packages/frontend/lib/data/hooks/useTrendData.ts`

**Same pattern as Task 2.2:**
1. Import `useMetricAccess`
2. Add gating fields to result interface
3. If gated, return early with null trend data and `gated: true`

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add gating to useTrendData hook"
```

---

### Task 2.5: Add gating to useDataCard (composite hook)

**Files:**
- Modify: `packages/frontend/lib/data/hooks/useDataCard.ts`

**What to do:**
1. Import `useMetricAccess`
2. Add gating fields to `UseDataCardResult`:
   ```typescript
   export interface UseDataCardResult {
     // ... existing fields
     gated: boolean;
     tierRequired?: UserTier;
     preview?: boolean;
     previewLimit?: number | null;
   }
   ```
3. Since `useDataCard` calls `useSnapshotData` and `useTrendData`, and those now handle gating internally, `useDataCard` just needs to surface the gating info:
   ```typescript
   const access = useMetricAccess(metricId);

   return {
     // ... existing return values from snapshot + trend
     gated: access.gated,
     tierRequired: access.tierRequired ?? undefined,
     preview: access.preview,
     previewLimit: access.previewLimit,
   };
   ```
4. Update `useDataCardBatch` to surface gating info per card

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add gating to useDataCard hook"
```

---

### Task 2.6: Add gating to useScoreData

**Files:**
- Modify: `packages/frontend/lib/data/hooks/useScoreData.ts`

**What to do:**
1. Scores gate on `feature:scores` (not `metric:*`)
2. Import `useEntitlements` directly (not useMetricAccess, since scores aren't metrics)
3. Add gating fields to `UseScoreDataResult`
4. If gated, skip query and return `gated: true`

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add gating to useScoreData hook"
```

---

### Task 2.7: Export gating types from lib/data

**Files:**
- Modify: `packages/frontend/lib/data/index.ts`

**What to do:**
1. Export `useMetricAccess` and `MetricAccessResult` from index
2. Re-export relevant entitlement types (`UserTier`) so consumers don't need to import from two places

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): export gating utilities from data layer"
```

---

## Phase 3: Selector Gating (Pattern 1)

### Task 3.1: Update useMetricOptions to use entitlements

**Files:**
- Modify: `packages/frontend/app/map/hooks/useMetricOptions.ts`

**What to do:**
1. Import `useEntitlements` from `@/lib/entitlements`
2. Replace the hardcoded `PREMIUM_METRICS` set with entitlements checks:
   ```typescript
   const { isMetricGated } = useEntitlements();

   // Replace: const isPremium = PREMIUM_METRICS.has(id);
   // With: const isPremium = isMetricGated(id);
   ```
3. Add `locked` field to metric options alongside existing `disabled`:
   ```typescript
   result.push({
     label: metricConfig.title,
     value: id,
     disabled: !isAvailable,  // geo availability
     locked: isMetricGated(id),  // entitlement gating
   });
   ```
4. Remove or deprecate the hardcoded `PREMIUM_METRICS` set - entitlements system is now the source of truth

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): replace hardcoded PREMIUM_METRICS with entitlements checks"
```

---

### Task 3.2: Add lock icons to MetricSelector component

**Files:**
- Modify: `packages/frontend/app/map/components/MetricSelector.tsx`

**What to do:**
1. Import `Lock` from `lucide-react`
2. Update metric button rendering to show lock icon when `locked`:
   ```typescript
   <button
     key={m.id}
     onClick={() => m.locked ? setShowPaywall(m) : toggleMetric(m.id)}
     disabled={m.disabled}
     className={m.locked ? 'opacity-60' : ''}
   >
     {m.name}
     {m.locked && <Lock className="w-3.5 h-3.5" />}
   </button>
   ```
3. Add paywall modal state and render `PaywallCard` in a modal when a locked metric is clicked

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add lock icons and paywall to MetricSelector"
```

---

### Task 3.3: Add lock icons to map sidebar metric categories

**Files:**
- Modify: `packages/frontend/app/map/components/sidebar-components/MetricCategoryItem.tsx` (or wherever sidebar metric items are rendered)

**What to do:**
1. Same pattern as MetricSelector - show lock icon on premium metrics
2. Click locked metric opens paywall modal instead of selecting
3. Use `isMetricGated` from entitlements context

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add gating to map sidebar metric items"
```

---

### Task 3.4: Add lock icons to graphs page metric pickers

**Files:**
- Modify: `packages/frontend/app/graphs/Dashboard.tsx` (or its metric picker sub-component)

**What to do:**
1. Same lock icon pattern in metric dropdowns/pickers
2. Locked metrics show lock icon, click opens paywall
3. Check file size - if Dashboard.tsx is close to 300 lines, extract the picker into a sub-component

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add gating to graphs page metric pickers"
```

---

## Phase 4: Feature Block Gating (Pattern 3)

### Task 4.1: Gate reports page

**Files:**
- Modify: `packages/frontend/app/reports/page.tsx` (or `Dashboard.tsx`)

**What to do:**
1. Wrap the reports content with `EntitlementGate`:
   ```typescript
   <EntitlementGate
     type="feature"
     id="reports"
     fallback={<PaywallCard type="feature" id="reports" title="Unlock Reports" />}
   >
     <Dashboard />
   </EntitlementGate>
   ```

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): gate reports page"
```

---

### Task 4.2: Gate CSV export buttons

**Files:**
- Find and modify all export/download buttons across the app (graphs, market, map)

**What to do:**
1. Wrap export buttons with entitlements check:
   ```typescript
   const { canAccess } = useEntitlements();
   const canExport = canAccess('feature', 'export_csv');

   <button
     onClick={canExport ? handleExport : () => setShowPaywall(true)}
     className={!canExport ? 'opacity-60' : ''}
   >
     {!canExport && <Lock className="w-4 h-4" />}
     Export CSV
   </button>
   ```

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): gate CSV export buttons"
```

---

### Task 4.3: Gate analytics assistant

**Files:**
- Find analytics assistant component(s) and wrap with EntitlementGate

**What to do:**
1. Same pattern as AI insights (already done on market page)
2. Use `EntitlementGate` with `feature:analytics_assistant`

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): gate analytics assistant feature"
```

---

## Phase 5: Custom Paywalls

### Task 5.1: Create ScorePaywall component

**Files:**
- Create: `packages/frontend/components/entitlements/ScorePaywall.tsx`

**What to do:**
1. Build a custom paywall component that sells PropertyIQ score value
2. Include:
   - Headline stat about excess returns (e.g., "Markets scoring 80+ outperformed by 12%")
   - Predictive angle (e.g., "Predicted 7 of top 10 performing markets")
   - Simple comparison visual (high-score vs low-score bar)
   - CTA: "Unlock Predictive Scores"
3. Follow M3 design system - elevated card, semantic colors, rounded-xl
4. Keep under 300 lines

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add ScorePaywall component"
```

---

### Task 5.2: Create InsightsPaywall component

**Files:**
- Create: `packages/frontend/components/entitlements/InsightsPaywall.tsx`

**What to do:**
1. Build a custom paywall that sells AI insights value
2. Include:
   - Hard data + soft signals pitch
   - News-aware analysis angle (national and local market impact)
   - Nuanced assessment value prop
   - CTA: "Unlock AI Market Intelligence"
3. Follow M3 design system
4. Keep under 300 lines

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): add InsightsPaywall component"
```

---

### Task 5.3: Update generic PaywallCard messaging

**Files:**
- Modify: `packages/frontend/components/entitlements/PaywallCard.tsx`

**What to do:**
1. Update default description from generic "requires a Pro subscription" to:
   "Get the data edge. Access 60+ metrics, ZIP-level detail, and full market history - analytics typically reserved for institutional investors."
2. Keep the component generic but make the default message sell the value

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): update PaywallCard with value-focused messaging"
```

---

### Task 5.4: Wire custom paywalls to score and AI insight sections

**Files:**
- Modify: `packages/frontend/app/market/[id]/MarketDashboard.tsx` (AI insights section)
- Modify: score display sections across the app

**What to do:**
1. Replace generic `PaywallCard`/`PaywallOverlay` with `ScorePaywall` where scores are displayed
2. Replace generic paywall with `InsightsPaywall` where AI insights are displayed
3. Check file sizes after changes - split if over 300 lines

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): wire custom paywalls to scores and AI insights"
```

---

## Phase 6: Edge Case Handling

### Task 6.1: Refresh entitlements on Stripe checkout return

**Files:**
- Modify: `packages/frontend/app/pricing/page.tsx`

**What to do:**
1. Check for `?success=true` search param on mount
2. Call `refresh()` from entitlements context when present:
   ```typescript
   const searchParams = useSearchParams();
   const { refresh } = useEntitlements();

   useEffect(() => {
     if (searchParams.get('success')) {
       refresh();
     }
   }, [searchParams, refresh]);
   ```

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): refresh entitlements on checkout return"
```

---

### Task 6.2: Handle saved metric selections that become gated

**Files:**
- Modify: wherever the active metric is initialized from saved state (map page state initialization)

**What to do:**
1. After loading saved metric from URL/localStorage, check `isMetricGated`
2. If gated, fall back to `home_value` and show toast:
   ```typescript
   const savedMetric = getSavedMetric();
   const { isMetricGated } = useEntitlements();

   if (isMetricGated(savedMetric)) {
     setActiveMetric('home_value');
     toast('Your selected metric requires a Pro plan. Showing Home Value instead.');
   }
   ```
3. Don't overwrite the saved preference

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): handle gated saved metric selections with fallback"
```

---

### Task 6.3: Fail open on entitlements API failure

**Files:**
- Modify: `packages/frontend/lib/entitlements/EntitlementsContext.tsx`

**What to do:**
1. On API failure, set `loading: false` and keep default free-tier state
2. Don't show error UI - app renders normally as free experience
3. Already mostly works since default state is free tier - just ensure error doesn't block rendering:
   ```typescript
   } catch (error) {
     setState(prev => ({
       ...prev,
       loading: false,
       error: null, // Don't surface error to UI
     }));
   }
   ```

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): fail open to free tier on API failure"
```

---

### Task 6.4: Anonymous user CTA text

**Files:**
- Modify: `packages/frontend/components/entitlements/PaywallCard.tsx`
- Modify: `packages/frontend/components/entitlements/PaywallOverlay.tsx`
- Modify: `packages/frontend/components/entitlements/ScorePaywall.tsx`
- Modify: `packages/frontend/components/entitlements/InsightsPaywall.tsx`

**What to do:**
1. Check authentication state (from auth context or entitlements context)
2. Change CTA text based on auth:
   - Authenticated: "Upgrade to Pro" / "View Plans"
   - Anonymous: "Sign Up to Unlock" / "Create Free Account"
3. Change CTA link:
   - Authenticated: `/pricing`
   - Anonymous: `/signup` or `/auth`

**Step 2: Commit**
```bash
git commit -m "feat(entitlements): adjust paywall CTA for anonymous vs authenticated users"
```

---

## Phase 7: Cleanup

### Task 7.1: Remove hardcoded premium metric lists

**Files:**
- Modify: `packages/frontend/app/map/hooks/useMetricOptions.ts`
- Modify: `packages/frontend/app/map/config/metric-categories.tsx`

**What to do:**
1. Remove `PREMIUM_METRICS` set from `useMetricOptions.ts` (replaced by entitlements in Task 3.1)
2. Remove `isPremium` flags from `metric-categories.tsx` metric definitions (entitlements system is now source of truth)
3. Verify no other files reference these hardcoded lists

**Step 2: Commit**
```bash
git commit -m "refactor(entitlements): remove hardcoded premium metric lists"
```

---

### Task 7.2: Update entitlements component exports

**Files:**
- Modify: `packages/frontend/components/entitlements/index.ts`

**What to do:**
1. Export new components: `ScorePaywall`, `InsightsPaywall`
2. Verify all entitlement components are exported from index

**Step 2: Commit**
```bash
git commit -m "chore(entitlements): update component exports"
```

---

## Summary

| Phase | Tasks | What it does |
|-------|-------|-------------|
| 1 | 1.1-1.2 | Context upgrades: auto resource list, isMetricGated, TTL |
| 2 | 2.1-2.7 | Data hook gating: all hooks return gated/preview info |
| 3 | 3.1-3.4 | Selector gating: lock icons in metric pickers |
| 4 | 4.1-4.3 | Feature blocks: gate reports, CSV, analytics assistant |
| 5 | 5.1-5.4 | Custom paywalls: ScorePaywall, InsightsPaywall, updated messaging |
| 6 | 6.1-6.4 | Edge cases: checkout refresh, saved selections, fail-open, anon CTA |
| 7 | 7.1-7.2 | Cleanup: remove hardcoded lists, update exports |

**Total: 21 tasks across 7 phases**
