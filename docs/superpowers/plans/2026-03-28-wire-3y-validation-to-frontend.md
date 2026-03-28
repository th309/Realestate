# Wire 1Y + 3Y Validation Metrics to Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface both 1-year (early signal) and 3-year (primary horizon) validation metrics across the public accuracy page and admin dashboard, fed dynamically from the validation API.

**Architecture:** The backend already returns both 1Y and 3Y data for most endpoints (summary, scatter, geography). Only the time-series endpoint is 1Y-only and needs extension. The frontend hooks/fetchers only pass `horizon` for quintiles — we add it everywhere. HeroStats is hardcoded and becomes dynamic. The public accuracy page gets a horizon toggle so users can switch between 1Y and 3Y views.

**Tech Stack:** React (client components), React Query hooks, NestJS backend, Supabase (propertyiq_backtest_outcomes table)

---

## File Map

| File                                                                       | Action  | Responsibility                                                |
| -------------------------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| `packages/backend/src/scoring/validation/validation.service.ts`            | Modify  | Add horizon param to `getTimeSeriesAccuracy()`                |
| `packages/backend/src/scoring/validation/validation.controller.ts`         | Modify  | Add horizon query param to time-series endpoint               |
| `packages/frontend/lib/data/fetchers/scoring.ts`                           | Modify  | Add horizon param to scatter, time-series, geography fetchers |
| `packages/frontend/lib/data/hooks/useValidationData.ts`                    | Modify  | Add horizon param to all hooks                                |
| `packages/frontend/app/scores/accuracy/components/HeroStats.tsx`           | Rewrite | Dynamic from validation summary API                           |
| `packages/frontend/app/scores/accuracy/components/HorizonToggle.tsx`       | Create  | Shared 1Y/3Y toggle component                                 |
| `packages/frontend/app/scores/accuracy/page.tsx`                           | Modify  | Add horizon state, pass to children                           |
| `packages/frontend/app/scores/accuracy/components/QuintilePerformance.tsx` | Modify  | Accept horizon prop instead of hardcoded "3y"                 |
| `packages/frontend/app/scores/accuracy/components/InteractiveScatter.tsx`  | Modify  | Use horizon-appropriate data fields                           |
| `packages/frontend/app/scores/accuracy/components/CorrelationTimeline.tsx` | Modify  | Accept and pass horizon prop                                  |

---

### Task 1: Backend — Add Horizon to Time-Series Service

**Files:**

- Modify: `packages/backend/src/scoring/validation/validation.service.ts` (getTimeSeriesAccuracy method)
- Modify: `packages/backend/src/scoring/validation/validation.controller.ts` (time-series endpoint)

- [ ] **Step 1: Update `getTimeSeriesAccuracy()` to accept horizon parameter**

In `validation.service.ts`, find the `getTimeSeriesAccuracy` method. It currently hardcodes `outcome_1y_value` in its query. Change the method signature to accept `horizon: '1y' | '3y' = '1y'` and switch the column selection:

```typescript
async getTimeSeriesAccuracy(
  geographyType?: string,
  scoreType?: string,
  horizon: '1y' | '3y' = '1y',
): Promise<TimeSeriesAccuracy[]> {
```

In the query, replace the hardcoded `outcome_1y_value` reference with a dynamic column based on horizon:

```typescript
const outcomeCol = horizon === "3y" ? "outcome_3y_value" : "outcome_1y_value";
const excessCol =
  horizon === "3y" ? "excess_vs_state_3y" : "excess_vs_state_1y";
```

Use these in the select/computation logic where `outcome_1y_value` was previously used.

- [ ] **Step 2: Update the time-series controller endpoint**

In `validation.controller.ts`, find the `GET /api/admin/scores/validation/time-series` endpoint. Add `horizon` as a query parameter:

```typescript
@Get('time-series')
async getTimeSeries(
  @Query('geography') geography?: string,
  @Query('score_type') scoreType?: string,
  @Query('horizon') horizon?: string,
) {
  const validHorizon = horizon === '3y' ? '3y' : '1y';
  return this.validationService.getTimeSeriesAccuracy(
    geography,
    scoreType,
    validHorizon,
  );
}
```

- [ ] **Step 3: Verify backend compiles**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```
feat(validation): add horizon parameter to time-series validation endpoint
```

---

### Task 2: Frontend Fetchers — Add Horizon to All Fetcher Functions

**Files:**

- Modify: `packages/frontend/lib/data/fetchers/scoring.ts`

The types (`ValidationSummary`, `ValidationScatterPoint`, etc.) already include both 1Y and 3Y fields, so no type changes needed. We just need to pass horizon to the API calls that accept it.

- [ ] **Step 1: Add horizon to `fetchValidationTimeSeries`**

Find `fetchValidationTimeSeries` and add the horizon parameter:

```typescript
export async function fetchValidationTimeSeries(params: {
  geography?: string;
  score_type?: string;
  horizon?: '1y' | '3y';
}): Promise<ValidationTimeSeriesPoint[]> {
```

Add `horizon` to the query params object passed to `fetchAPIWithParams`.

- [ ] **Step 2: Add horizon to `fetchValidationScatter`**

Find `fetchValidationScatter` and add horizon parameter. The backend already returns both 1Y and 3Y fields in each scatter point, so this is just for future API filtering. Pass it as a query param:

```typescript
export async function fetchValidationScatter(params: {
  geography?: string;
  score_type?: string;
  limit?: number;
  horizon?: '1y' | '3y';
}): Promise<ValidationScatterPoint[]> {
```

- [ ] **Step 3: Verify frontend compiles**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```
feat(validation): add horizon parameter to frontend validation fetchers
```

---

### Task 3: Frontend Hooks — Add Horizon to All Validation Hooks

**Files:**

- Modify: `packages/frontend/lib/data/hooks/useValidationData.ts`

- [ ] **Step 1: Add horizon to `useValidationTimeSeries`**

```typescript
export function useValidationTimeSeries(options?: {
  geography?: string;
  scoreType?: string;
  horizon?: "1y" | "3y";
}) {
  const { geography, scoreType, horizon = "1y" } = options ?? {};
  return useQuery({
    queryKey: ["validation", "time-series", geography, scoreType, horizon],
    queryFn: () =>
      fetchValidationTimeSeries({
        geography,
        score_type: scoreType,
        horizon,
      }),
    staleTime: 2 * 60 * 60 * 1000,
  });
}
```

Note: include `horizon` in the queryKey so React Query caches 1Y and 3Y separately.

- [ ] **Step 2: Add horizon to `useValidationScatter`**

Same pattern — add horizon to options, queryKey, and pass to fetcher.

- [ ] **Step 3: Verify frontend compiles**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```
feat(validation): add horizon parameter to frontend validation hooks
```

---

### Task 4: Create HorizonToggle Component

**Files:**

- Create: `packages/frontend/app/scores/accuracy/components/HorizonToggle.tsx`

- [ ] **Step 1: Create the toggle component**

A simple pill toggle for switching between 1Y and 3Y views. Follow the existing filter chip pattern used in the admin dashboard (`/admin/score-validation/page.tsx` lines 99-119).

```tsx
"use client";

interface HorizonToggleProps {
  value: "1y" | "3y";
  onChange: (horizon: "1y" | "3y") => void;
}

export function HorizonToggle({ value, onChange }: HorizonToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
      <button
        onClick={() => onChange("1y")}
        className={`px-4 py-1.5 text-sm font-medium transition-colors ${
          value === "1y"
            ? "bg-primary text-on-primary"
            : "bg-surface text-on-surface-variant hover:bg-surface-container-low"
        }`}
      >
        1-Year
      </button>
      <button
        onClick={() => onChange("3y")}
        className={`px-4 py-1.5 text-sm font-medium transition-colors ${
          value === "3y"
            ? "bg-primary text-on-primary"
            : "bg-surface text-on-surface-variant hover:bg-surface-container-low"
        }`}
      >
        3-Year
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
feat(validation): add HorizonToggle component for 1Y/3Y switching
```

---

### Task 5: Update Accuracy Page — Add Horizon State and Pass to Children

**Files:**

- Modify: `packages/frontend/app/scores/accuracy/page.tsx`

- [ ] **Step 1: Convert to client component and add horizon state**

The page needs `useState` for the horizon toggle. Add `'use client'` directive if not present, import `useState`, and add state:

```tsx
'use client';
import { useState } from 'react';
// ... existing imports
import { HorizonToggle } from './components/HorizonToggle';

export default function AccuracyPage() {
  const [horizon, setHorizon] = useState<'1y' | '3y'>('3y'); // Default to primary horizon
```

- [ ] **Step 2: Add the toggle to the page header area**

Place the `HorizonToggle` near the top of the page, below the title/description:

```tsx
<HorizonToggle value={horizon} onChange={setHorizon} />
```

- [ ] **Step 3: Pass horizon to child components**

Update component invocations to pass `horizon`:

```tsx
<HeroStats horizon={horizon} />
<QuintilePerformance horizon={horizon} />
<InteractiveScatter horizon={horizon} />
<CorrelationTimeline horizon={horizon} />
```

`GeographyCoverage` already shows both 1Y and 3Y — no prop needed.

- [ ] **Step 4: Verify page compiles**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: Errors about new props not accepted yet (expected — we'll fix in subsequent tasks)

- [ ] **Step 5: Commit**

```
feat(validation): add horizon toggle to public accuracy page
```

---

### Task 6: Make HeroStats Dynamic

**Files:**

- Modify: `packages/frontend/app/scores/accuracy/components/HeroStats.tsx`

- [ ] **Step 1: Convert from hardcoded to dynamic**

Replace the hardcoded stats array with `useValidationSummary` hook data. Accept `horizon` prop.

```tsx
'use client';

import { useValidationSummary, VALIDATION_SCOPE, OOS_IC, OOS_HIT_RATE, OOS_QUINTILE_SPREAD, MEDIAN_HOME_VALUE } from '@/lib/data';

interface HeroStatsProps {
  horizon: '1y' | '3y';
}

export function HeroStats({ horizon }: HeroStatsProps) {
  const { data: summary } = useValidationSummary({
    geography: 'metro',
    scoreType: 'investoredge',
  });
```

- [ ] **Step 2: Build stats from API data with OOS fallbacks**

Use the validation summary from the API when available, falling back to the static OOS constants from `validation-claims.ts`:

```tsx
const ic =
  horizon === "3y"
    ? (summary?.correlation3y ?? OOS_IC.metro_investoredge)
    : (summary?.correlation1y ?? OOS_IC.metro_investoredge);

const spread = OOS_QUINTILE_SPREAD.metro_investoredge;
const dollarImpact = Math.round((spread / 100) * MEDIAN_HOME_VALUE);

const hitRate =
  horizon === "3y"
    ? (summary?.hitRate3y ?? OOS_HIT_RATE.metro_investoredge)
    : (summary?.hitRate1y ?? OOS_HIT_RATE.metro_investoredge);

const stats = [
  {
    value: ic.toFixed(2),
    label: `OOS Correlation (${horizon.toUpperCase()})`,
    sublabel: "Score vs actual excess return",
  },
  {
    value: `$${dollarImpact.toLocaleString()}`,
    label: "Annual Alpha",
    sublabel: `Per property on $${MEDIAN_HOME_VALUE / 1000}K home`,
  },
  {
    value: String(VALIDATION_SCOPE.walkForwardWindows),
    label: "Walk-Forward Windows",
    sublabel: "2018-2023 non-overlapping",
  },
  {
    value: `${hitRate}%`,
    label: `Hit Rate (${horizon.toUpperCase()})`,
    sublabel: "Top quintile outperforms bottom",
  },
  {
    value: VALIDATION_SCOPE.metrosValidated.toLocaleString(),
    label: "Metros Validated",
    sublabel: "Plus counties and ZIPs",
  },
];
```

- [ ] **Step 3: Render stats using existing card layout**

Keep the existing grid layout, just map over the new dynamic stats array. Preserve the existing CSS classes and structure.

- [ ] **Step 4: Verify it compiles and renders**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```
feat(validation): make HeroStats dynamic from validation API with 1Y/3Y support
```

---

### Task 7: Update QuintilePerformance — Accept Horizon Prop

**Files:**

- Modify: `packages/frontend/app/scores/accuracy/components/QuintilePerformance.tsx`

- [ ] **Step 1: Accept horizon prop and remove hardcoded "3y"**

Add prop:

```tsx
interface QuintilePerformanceProps {
  horizon?: '1y' | '3y';
}

export function QuintilePerformance({ horizon: propHorizon }: QuintilePerformanceProps) {
```

Replace the hardcoded `horizon: "3y"` in the `useValidationQuintiles` call (line 69) with:

```tsx
const activeHorizon = propHorizon ?? "3y";

const {
  data: rawData,
  isLoading,
  error,
} = useValidationQuintiles({
  geography,
  scoreType,
  horizon: activeHorizon,
});
```

- [ ] **Step 2: Switch data field based on horizon**

In the `chartData` memo (line 72-86), switch the return field:

```tsx
const ret =
  activeHorizon === "3y"
    ? (q.avgExcessVsState3y ?? 0)
    : (q.avgExcessVsState1y ?? 0);
```

- [ ] **Step 3: Update the spread badge to reflect active horizon**

The spread badge currently shows the V3_OOS_SPREAD value. Update the label to indicate which horizon:

```tsx
<span className="text-xs text-on-surface-variant">
  OOS Quintile Spread ({activeHorizon.toUpperCase()})
</span>
```

- [ ] **Step 4: Commit**

```
feat(validation): QuintilePerformance accepts horizon prop for 1Y/3Y switching
```

---

### Task 8: Update InteractiveScatter — Use Horizon-Appropriate Fields

**Files:**

- Modify: `packages/frontend/app/scores/accuracy/components/InteractiveScatter.tsx`

- [ ] **Step 1: Accept horizon prop**

```tsx
interface InteractiveScatterProps {
  horizon?: '1y' | '3y';
}

export function InteractiveScatter({ horizon = '3y' }: InteractiveScatterProps) {
```

- [ ] **Step 2: Switch data fields based on horizon**

In the `chartData` memo, replace the hardcoded `excessVsState3y` references:

```tsx
const chartData = useMemo(() => {
  if (!rawData) return [];
  return rawData
    .filter((p) => {
      const val = horizon === "3y" ? p.excessVsState3y : p.excessVsState1y;
      return val !== null && val !== undefined;
    })
    .map((p) => {
      const excess = horizon === "3y" ? p.excessVsState3y! : p.excessVsState1y!;
      return {
        score: p.score,
        excess,
        // ... rest of mapping
      };
    });
}, [rawData, horizon]);
```

- [ ] **Step 3: Update axis labels to reflect horizon**

Change Y-axis label from hardcoded "3-Year Excess Return" to dynamic:

```tsx
label={{ value: `${horizon === '3y' ? '3-Year' : '1-Year'} Excess Return vs State (pp)`, ... }}
```

- [ ] **Step 4: Commit**

```
feat(validation): InteractiveScatter switches between 1Y and 3Y excess returns
```

---

### Task 9: Update CorrelationTimeline — Pass Horizon to API

**Files:**

- Modify: `packages/frontend/app/scores/accuracy/components/CorrelationTimeline.tsx`

- [ ] **Step 1: Accept horizon prop and pass to hook**

```tsx
interface CorrelationTimelineProps {
  horizon?: '1y' | '3y';
}

export function CorrelationTimeline({ horizon = '1y' }: CorrelationTimelineProps) {
```

Update the `useValidationTimeSeries` call to include horizon:

```tsx
const { data, isLoading } = useValidationTimeSeries({
  geography: "metro",
  scoreType: "homeready",
  horizon,
});
```

- [ ] **Step 2: Update chart title to reflect horizon**

```tsx
<h3>
  Correlation Over Time ({horizon === "3y" ? "3-Year" : "1-Year"} Horizon)
</h3>
```

- [ ] **Step 3: Commit**

```
feat(validation): CorrelationTimeline supports 1Y/3Y horizon switching
```

---

### Task 10: Type Check, Visual Verify, Final Commit

**Files:** All modified files

- [ ] **Step 1: Full type check**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Full type check backend**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Visual verify**

Start the frontend dev server and navigate to `/scores/accuracy`. Verify:

- Horizon toggle appears and defaults to "3-Year"
- Switching to "1-Year" updates all sections
- HeroStats shows dynamic values (IC, hit rate change with horizon)
- QuintilePerformance chart re-fetches and updates bars
- Scatter plot switches between 1Y and 3Y excess returns
- Correlation timeline re-fetches for the active horizon
- Geography coverage shows both 1Y and 3Y (unchanged — always dual)
- No console errors

- [ ] **Step 4: Final commit and push**

```
feat(validation): wire 1Y + 3Y validation metrics across public accuracy page

All validation components now support horizon switching via a toggle
on the accuracy page. HeroStats are dynamic from the validation API
instead of hardcoded. Default view is 3-Year (primary training horizon).
```
