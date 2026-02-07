# Entitlements Gating Integration Design

> How metrics, features, and geography levels get gated across live pages

**Date:** 2026-02-07
**Status:** Draft
**Author:** Troy

---

## 1. Overview

The entitlements system infrastructure is in place (provider, context, hooks, backend API, gating components). This document defines how gating integrates into the live app - the patterns, edge cases, and UX decisions that keep everything consistent as the app grows.

---

## 2. Three Gating Patterns

Every gated element in the app falls into one of three patterns.

### Pattern 1: Selectors

**What:** Lists of options where some are locked (map sidebar metrics, graph axis pickers, market factor chooser).

**Behavior:**
- Locked options are visible but not selectable
- Show lock icon + reduced opacity
- Clicking a locked option opens a paywall modal instead of selecting
- Follows the same UX as geography pills today

**Implementation:**
```typescript
const { isMetricGated } = useEntitlements();

{metrics.map((metric) => {
  const locked = isMetricGated(metric.id);

  return (
    <button
      key={metric.id}
      onClick={() => locked ? setShowPaywall(metric) : onSelect(metric)}
      className={locked ? 'opacity-60' : ''}
    >
      {metric.label}
      {locked && <Lock className="w-4 h-4" />}
    </button>
  );
})}
```

**Where this applies:**
| Component | Location | What's locked |
|-----------|----------|--------------|
| Map sidebar metric list | `app/map/` | Premium metrics (cap_rate, rental_yield, etc.) |
| Graph axis/metric pickers | `app/graphs/` | Premium metrics |
| Market factor chooser | `app/map/` | Premium metrics |

### Pattern 2: Data Hooks (Automatic)

**What:** Any component that fetches metric data through the data layer gets gating for free.

**Behavior:**
- Hooks check entitlements before making API calls
- Gated metrics never hit the API (saves bandwidth)
- Return `gated: true` and `tierRequired` alongside existing fields
- Existing components don't break - they already handle `value: null`

**Implementation:**
```typescript
// Inside useDataCard (and useSnapshotData, useTimeSeriesData, useScoreData)
const { getAccess } = useEntitlements();
const metricAccess = getAccess('metric', metricId);

if (metricAccess.level === 'none') {
  return {
    value: null,
    loading: false,
    error: null,
    gated: true,
    tierRequired: metricAccess.tierRequired,
  };
}

// Preview mode still fetches - component decides how to truncate
if (metricAccess.level === 'preview') {
  // Fetch normally, return preview info
  return { ...data, gated: false, preview: true, previewLimit: metricAccess.limit };
}

// Full access - fetch normally
return { ...data, gated: false };
```

**Return shape (extended):**
```typescript
interface DataHookResult {
  value: T | null;
  loading: boolean;
  error: string | null;
  // New fields
  gated: boolean;
  tierRequired?: UserTier;
  preview?: boolean;
  previewLimit?: number;
}
```

**Where this applies:** Every component using `useDataCard`, `useSnapshotData`, `useTimeSeriesData`, or `useScoreData`. No per-component work needed - gating is automatic.

### Pattern 3: Feature Blocks

**What:** Entire sections or pages that are on/off per tier.

**Behavior:**
- Wrap content in `EntitlementGate` or `PaywallOverlay`
- Gated content is blurred or replaced with a paywall
- Already built, just needs applying to remaining locations

**Where this applies:**
| Feature | Location | Gate on |
|---------|----------|--------|
| AI insights | market page, map | `feature:ai_insights` (done) |
| Reports page | `app/reports/` | `feature:reports` |
| CSV export buttons | graphs, market, map | `feature:export_csv` |
| Analytics assistant | wherever it appears | `feature:analytics_assistant` |

**Already done (no work needed):**
- Geography level gating on map pills
- Market dashboard geo blocking
- Pricing page tier display

---

## 3. Loading Strategy

### Batch all resources on mount

The entitlements context builds its resource list automatically from the metric registry:

```typescript
import { getAllMetricIds } from '@/lib/data';

const ALL_RESOURCES = [
  ...getAllMetricIds().map(id => `metric:${id}`),
  ...GEO_LEVELS.map(g => `geo:${g}`),
  ...FEATURES.map(f => `feature:${f}`),
];
```

Single API call on app load (~80-100 resources). Backend resolves them all in one query against `tier_features`. Payload is ~2-3KB. Everything resolves instantly after that - no loading flicker in selectors.

When a new metric is added to the registry, it's automatically included. No manual list to maintain.

### Cache with TTL

Entitlements are cached in the context with a **30-minute TTL**. After 30 minutes, the next access triggers a silent background re-fetch. This handles:
- Admin overrides taking effect
- Trial expirations
- Subscription changes that weren't caught by the checkout redirect

---

## 4. Edge Cases

### 4.1 Stale Entitlements After Upgrade

**Scenario:** User upgrades via Stripe, gets redirected back, but cached entitlements still say "free."

**Solution: Refresh on checkout return + 30-minute TTL.**

```typescript
// pricing/page.tsx
const searchParams = useSearchParams();
const { refresh } = useEntitlements();

useEffect(() => {
  if (searchParams.get('success')) {
    refresh(); // Re-fetch entitlements with new tier
  }
}, [searchParams]);
```

Three moments where tier can change:
| Trigger | How it refreshes |
|---------|-----------------|
| Stripe checkout success | Redirect to `?success=true`, page calls `refresh()` |
| Trial starts | Frontend calls `refresh()` after activation API call |
| Trial expires mid-session | 30-minute TTL catches it; if expiring today, set a client-side timer |
| Admin override | 30-minute TTL; worst case user refreshes the page |

### 4.2 Saved Selections That Become Gated

**Scenario:** User on Pro trial selects `cap_rate`. Trial expires. Next visit loads a metric they can't access.

**Solution: Detect and fall back silently with a toast.**

```typescript
const savedMetric = getSavedMetric(); // from URL, localStorage, etc.
const gated = isMetricGated(savedMetric);

if (gated) {
  const fallback = getDefaultFreeMetric(); // e.g. 'home_value'
  setActiveMetric(fallback);
  toast('Your selected metric requires a Pro plan. Showing Home Value instead.');
}
```

Key decisions:
- Always fall back to a known free metric (`home_value`)
- Show a toast, not a modal - non-blocking, informative, not aggressive
- Don't overwrite the saved preference - if they upgrade again, their selection comes back
- Shared links get the same treatment - free user sees toast and gets the fallback
- This guard runs in **one place** - wherever active metric is initialized from saved state

### 4.3 Entitlements API Failure

**Scenario:** App loads, `/api/entitlements/check` fails or times out.

**Solution: Fail open to free tier.**

- Most users are free tier, so they see no difference
- Pro users temporarily lose premium features but the core app works
- No one sees a wall of paywalls and thinks the app is broken
- The 30-minute TTL self-heals on the next successful fetch

```typescript
const defaultState: EntitlementsState = {
  tier: 'free',
  access: {},     // empty = getAccess returns 'none' for premium stuff
  trial: null,
  loading: false, // set to false even on error
  error: null,
};
```

When the API fails, set `loading: false` and keep free-tier defaults. App renders normally as a free experience.

### 4.4 Anonymous Users

**Decision: Anonymous users are treated as free tier.**

- They see everything a free user sees
- Premium metrics appear in selectors with lock icons
- Paywalls show "Sign up to unlock" instead of "Upgrade to Pro"
- Every lock icon is a conversion opportunity - they discover premium features exist

Treating anonymous as unrestricted and then gating on signup creates a "downgrade on signup" experience that kills conversion. Setting expectations from the start avoids this.

Technically this is the default behavior - no user ID means `tier: 'free'`. The only difference is CTA text changes based on authentication state.

---

## 5. Preview / Teaser Mode

When a metric has `level: 'preview'` with a `limit`, the behavior depends on the data type:

| Data type | Preview behavior | `limit` means |
|-----------|-----------------|---------------|
| Time series | Truncate time range | Months of history (e.g., 6) |
| Lists/rankings | Show first N rows, blur the rest | Row count (e.g., 3) |
| Map metrics | Not applicable - use full/none | N/A |
| Scores | Show headline number only | Detail depth |

The hook returns `{ gated: false, preview: true, previewLimit: 6 }` and each component type interprets the limit according to its data type.

**Time series example:**
- Free gets 6 months of chart data, Pro gets full history
- Chart renders 6 months normally, then a subtle divider with "Upgrade for full history"

**List example:**
- Free sees top 3 results as real data
- Remaining rows are blurred with a PaywallCard after row 3

**Score example:**
- Free gets the headline score number (maybe blurred)
- Pro gets the full breakdown: sub-scores, comparisons, trend analysis

---

## 6. Paywall Messaging

### Messaging Hierarchy

Every paywall reinforces the same core value: **institutional-grade analytics at accessible prices.** Two flagship features get custom paywalls with specific pitches. Everything else uses a generic paywall with the brand message.

| Level | Component | Pitch angle |
|-------|-----------|-------------|
| Generic | `PaywallCard` | Institutional-grade data at accessible prices |
| Scores | `ScorePaywall` | + predictive power, proven excess returns |
| AI Insights | `InsightsPaywall` | + hard data meets soft signals, news-aware intelligence |

### Generic PaywallCard

Used for: locked metrics, geo levels, exports, reports.

Message: "Get the data edge. Access 60+ metrics, ZIP-level detail, and full market history - analytics typically reserved for institutional investors."

### ScorePaywall (Custom)

Used for: PropertyIQ score sections.

Sells the predictive value:
- Headline stat: "Markets scoring 80+ have outperformed by 12% over 5 years"
- Predictive angle: "PropertyIQ scores predicted 7 of the top 10 performing markets in 2025"
- Comparison visual: simple bar showing high-score vs low-score excess returns
- Social proof if available
- CTA: "Unlock Predictive Scores"

### InsightsPaywall (Custom)

Used for: AI insights sections.

Sells the nuanced analysis:
- Hard data + soft signals: combines metrics with news, policy changes, local events
- National and local awareness: real-time information impacting markets
- Nuanced assessment: what the numbers alone don't tell you
- CTA: "Unlock AI Market Intelligence"

---

## 7. Data Layer Changes

### Hooks to modify

| Hook | File | Change |
|------|------|--------|
| `useDataCard` | `lib/data/hooks/` | Add gating check, return `gated`, `tierRequired`, `preview`, `previewLimit` |
| `useSnapshotData` | `lib/data/hooks/` | Same |
| `useTimeSeriesData` | `lib/data/hooks/` | Same |
| `useScoreData` | `lib/data/hooks/` | Same |

### Entitlements context additions

```typescript
// New helper on EntitlementsContextValue
isMetricGated: (metricId: string) => boolean;
```

### Resource list auto-generation

```typescript
// Built from registry on context mount
const ALL_RESOURCES = [
  ...getAllMetricIds().map(id => `metric:${id}`),
  ...['national', 'state', 'metro', 'county', 'zip', 'tract'].map(g => `geo:${g}`),
  ...['analytics_assistant', 'export_csv', 'reports', 'ai_insights'].map(f => `feature:${f}`),
];
```

---

## 8. Full Integration Inventory

### Data layer (automatic - Pattern 2)
- [ ] `useDataCard` - add gating check
- [ ] `useSnapshotData` - add gating check
- [ ] `useTimeSeriesData` - add gating check
- [ ] `useScoreData` - add gating check

### Selectors (manual - Pattern 1)
- [ ] Map sidebar metric list - lock icons, paywall modal
- [ ] Graph axis/metric pickers - lock icons, paywall modal
- [ ] Market factor chooser - lock icons, paywall modal

### Feature blocks (manual - Pattern 3)
- [ ] Reports page - gate with `feature:reports`
- [ ] CSV export buttons - gate with `feature:export_csv`
- [ ] Analytics assistant - gate with `feature:analytics_assistant`

### Custom paywalls
- [ ] `ScorePaywall` component - predictive value pitch
- [ ] `InsightsPaywall` component - hard + soft data pitch
- [ ] Update generic `PaywallCard` messaging - institutional-grade angle

### Edge case handling
- [ ] Refresh entitlements on Stripe checkout return
- [ ] 30-minute TTL on entitlements cache
- [ ] Saved selection fallback with toast
- [ ] Fail-open to free tier on API failure
- [ ] Anonymous user CTA text ("Sign up" vs "Upgrade")

### Entitlements context updates
- [ ] Auto-generate resource list from registry
- [ ] Add `isMetricGated()` helper
- [ ] Add TTL-based background refresh

---

## 9. What's Not In Scope

- Stripe subscription mapping (separate design needed)
- A/B testing different tier configurations
- Enterprise team management
- Email automations
- Playbook content
