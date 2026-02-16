# Data Page & System-Wide Metric Tooltips — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `/data` page acknowledging all data providers and a `<MetricTitle>` component that adds hover tooltips to metric names across the entire platform.

**Architecture:** Move `metricDefinitions.ts` to `lib/data/definitions.ts` as the single source of metric metadata. Build a `<MetricTitle>` component using `createPortal` with viewport-aware positioning. Integrate into ~19 component files. Build a static `/data` page organized by provider with anchor IDs for deep-linking.

**Tech Stack:** Next.js, React (createPortal), Tailwind CSS (M3 design tokens), TypeScript

---

### Task 1: Move metric definitions to shared location

**Files:**
- Move: `packages/frontend/app/map/data/metricDefinitions.ts` → `packages/frontend/lib/data/definitions.ts`
- Modify: `packages/frontend/lib/data/index.ts`
- Modify: `packages/frontend/app/map/components/sidebar-components/MetricItem.tsx` (update import)
- Modify: `packages/frontend/components/ui/MetricLink.tsx` (update import)

**Step 1: Copy the file to its new location**

Copy `packages/frontend/app/map/data/metricDefinitions.ts` to `packages/frontend/lib/data/definitions.ts`. No changes to the file content yet.

**Step 2: Add a `DATA_SOURCE_ANCHORS` mapping to the new file**

At the bottom of `packages/frontend/lib/data/definitions.ts`, add:

```typescript
/**
 * Maps dataSource strings to their anchor slug on the /data page.
 * Used by MetricTitle tooltip to deep-link to provider sections.
 */
export const DATA_SOURCE_ANCHORS: Record<string, string> = {
  'Realtor.com': 'realtor-com',
  'Zillow': 'zillow',
  'Zillow ZORI': 'zillow',
  'Zillow ZHVF': 'zillow',
  'U.S. Census Bureau': 'census',
  'U.S. Census Bureau ACS': 'census',
  'Bureau of Labor Statistics (BLS LAUMT for metros, FRED for national/state/county)': 'bls',
  'BLS QCEW (Quarterly Census of Employment and Wages) for metros/counties, FRED for national/state': 'bls',
  'Bureau of Economic Analysis (BEA)': 'bea',
  'Bureau of Economic Analysis (BEA) Regional Price Parities': 'bea',
  'FRED': 'fred',
  'Calculated': 'propertyiq',
  'Calculated from Zillow ZORI (rent), HUD FMR (county fallback), Census ACS (rent fallback), and Zillow ZHVI (home value)': 'propertyiq',
  'Calculated from Realtor.com': 'realtor-com',
  'Calculated from Census + Realtor.com': 'propertyiq',
  'Calculated from Realtor.com (listing prices) and FRED/Freddie Mac (mortgage rates)': 'propertyiq',
  'Calculated from Census ACS (median household income) and FRED/Freddie Mac (mortgage rates)': 'propertyiq',
  'PropertyIQ Calculated': 'propertyiq',
};

/**
 * Get the /data page anchor for a given metric's data source.
 * Returns undefined if no anchor mapping exists.
 */
export function getDataSourceAnchor(metricId: string): string | undefined {
  const def = METRIC_DEFINITIONS[metricId];
  if (!def) return undefined;
  return DATA_SOURCE_ANCHORS[def.dataSource];
}
```

**Step 3: Export from `lib/data/index.ts`**

Add to the REGISTRY section of `packages/frontend/lib/data/index.ts`:

```typescript
// ============================================================================
// METRIC DEFINITIONS (descriptions, sources, formulas)
// ============================================================================
export {
  type MetricDefinition,
  METRIC_DEFINITIONS,
  getMetricDefinition,
  DATA_SOURCE_ANCHORS,
  getDataSourceAnchor,
} from './definitions';
```

**Step 4: Update imports in MetricItem.tsx**

In `packages/frontend/app/map/components/sidebar-components/MetricItem.tsx`, change line 10:

```typescript
// OLD
import { getMetricDefinition } from '../../data/metricDefinitions';
// NEW
import { getMetricDefinition } from '@/lib/data';
```

**Step 5: Update imports in MetricLink.tsx**

In `packages/frontend/components/ui/MetricLink.tsx`, change line 6:

```typescript
// OLD
import { getMetricDefinition } from '@/app/map/data/metricDefinitions';
// NEW
import { getMetricDefinition } from '@/lib/data';
```

**Step 6: Verify the build compiles**

Run: `cd packages/frontend && npx next build --no-lint 2>&1 | head -30`

If compilation succeeds, the old file at `app/map/data/metricDefinitions.ts` can be deleted (but leave a re-export for safety during migration).

**Step 7: Add re-export at old location**

Create `packages/frontend/app/map/data/metricDefinitions.ts` with just:

```typescript
// Re-export from shared location — all metric definitions now live in lib/data
export { type MetricDefinition, METRIC_DEFINITIONS, getMetricDefinition } from '@/lib/data';
```

**Step 8: Commit**

```bash
git add packages/frontend/lib/data/definitions.ts packages/frontend/lib/data/index.ts packages/frontend/app/map/data/metricDefinitions.ts packages/frontend/app/map/components/sidebar-components/MetricItem.tsx packages/frontend/components/ui/MetricLink.tsx
git commit -m "refactor: move metricDefinitions to lib/data for system-wide access"
```

---

### Task 2: Build the `<MetricTitle>` component

**Files:**
- Create: `packages/frontend/app/components/MetricTitle.tsx`

**Step 1: Create the MetricTitle component**

Create `packages/frontend/app/components/MetricTitle.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  getMetricDefinition,
  getDataSourceAnchor,
  getMetricTitle,
  getMetricDataDate,
  formatDataDateForDisplay,
} from '@/lib/data';

interface MetricTitleProps {
  metricId: string;
  className?: string;
  as?: 'span' | 'h3' | 'h4' | 'div';
  showTooltip?: boolean;
}

// Global singleton: only one tooltip at a time
let globalCloseTooltip: (() => void) | null = null;

export function MetricTitle({
  metricId,
  className = '',
  as: Tag = 'span',
  showTooltip = true,
}: MetricTitleProps) {
  const metricDef = getMetricDefinition(metricId);
  const title = metricDef?.name || getMetricTitle(metricId) || metricId;

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeout = useRef<NodeJS.Timeout | null>(null);
  const hideTimeout = useRef<NodeJS.Timeout | null>(null);
  const isTouchDevice = useRef(false);

  // Detect touch
  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const closeTooltip = useCallback(() => {
    setIsOpen(false);
    if (globalCloseTooltip === closeTooltip) {
      globalCloseTooltip = null;
    }
  }, []);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 288; // w-72 = 18rem = 288px
    const tooltipHeight = 240; // estimated max height
    const margin = 8;

    let top = rect.bottom + 4; // prefer below
    let left = rect.left;

    // Flip above if not enough room below
    if (top + tooltipHeight + margin > window.innerHeight) {
      top = rect.top - tooltipHeight - 4;
    }

    // Clamp to viewport bottom (if still below)
    if (top + tooltipHeight + margin > window.innerHeight) {
      top = window.innerHeight - tooltipHeight - margin;
    }

    // Clamp to viewport top
    if (top < margin) {
      top = margin;
    }

    // Clamp horizontal
    if (left + tooltipWidth + margin > window.innerWidth) {
      left = window.innerWidth - tooltipWidth - margin;
    }
    if (left < margin) {
      left = margin;
    }

    setPosition({ top, left });
  }, []);

  const openTooltip = useCallback(() => {
    // Close any other open tooltip
    if (globalCloseTooltip && globalCloseTooltip !== closeTooltip) {
      globalCloseTooltip();
    }
    globalCloseTooltip = closeTooltip;

    calculatePosition();
    setIsOpen(true);
  }, [closeTooltip, calculatePosition]);

  const handleMouseEnter = () => {
    if (isTouchDevice.current || !showTooltip || !metricDef) return;
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
    showTimeout.current = setTimeout(openTooltip, 200);
  };

  const handleMouseLeave = () => {
    if (showTimeout.current) {
      clearTimeout(showTimeout.current);
      showTimeout.current = null;
    }
    // Small delay so user can move cursor into tooltip
    hideTimeout.current = setTimeout(closeTooltip, 150);
  };

  const handleTooltipMouseEnter = () => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    hideTimeout.current = setTimeout(closeTooltip, 150);
  };

  const handleTouchStart = () => {
    if (!showTooltip || !metricDef) return;
    if (isOpen) {
      closeTooltip();
    } else {
      openTooltip();
    }
  };

  // Close on outside click (touch devices)
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        closeTooltip();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeTooltip]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (showTimeout.current) clearTimeout(showTimeout.current);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, []);

  const hasTooltip = showTooltip && !!metricDef;
  const dataSourceAnchor = metricDef ? getDataSourceAnchor(metricId) : undefined;
  const dataDate = formatDataDateForDisplay(getMetricDataDate(metricId));

  return (
    <>
      <Tag
        ref={triggerRef as React.Ref<HTMLElement>}
        className={`${hasTooltip ? 'decoration-dotted underline underline-offset-2 decoration-on-surface-variant/30 cursor-help' : ''} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
      >
        {title}
      </Tag>

      {isOpen && metricDef && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className="fixed w-72 bg-surface-container-lowest rounded-[28px] elevation-3 border border-outline-variant p-3 text-xs animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: position.top,
            left: position.left,
            zIndex: 99999,
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-on-surface">{metricDef.name}</h4>
            <button
              onClick={closeTooltip}
              className="text-on-surface-variant hover:text-on-surface text-lg leading-none transition-colors duration-200"
            >
              &times;
            </button>
          </div>

          <p className="text-on-surface-variant mb-3">{metricDef.description}</p>

          {metricDef.formula && (
            <div className="mb-2">
              <span className="font-medium text-on-surface">Formula: </span>
              <span className="text-on-surface-variant font-mono text-[11px] bg-surface-container px-1 py-0.5 rounded">
                {metricDef.formula}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant border-t border-outline-variant pt-2 mt-2">
            <span><span className="font-medium">Source:</span> {metricDef.dataSource}</span>
            <span><span className="font-medium">Updates:</span> {metricDef.updateFrequency}</span>
            <span><span className="font-medium">As of:</span> {dataDate}</span>
          </div>

          {metricDef.notes && (
            <p className="text-[11px] text-on-surface-variant/70 italic mt-2">{metricDef.notes}</p>
          )}

          {dataSourceAnchor && (
            <Link
              href={`/data#${dataSourceAnchor}`}
              className="mt-3 flex items-center justify-center gap-1 w-full py-1.5 text-[11px] font-medium text-primary hover:text-primary/80 hover:bg-primary-container/30 rounded-lg transition-colors duration-200"
              onClick={closeTooltip}
            >
              View data source
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export default MetricTitle;
```

**Step 2: Commit**

```bash
git add packages/frontend/app/components/MetricTitle.tsx
git commit -m "feat: add MetricTitle component with hover tooltip and viewport-aware positioning"
```

---

### Task 3: Build the `/data` page

**Files:**
- Create: `packages/frontend/app/data/page.tsx`
- Create: `packages/frontend/app/data/layout.tsx`

**Step 1: Create the layout**

Create `packages/frontend/app/data/layout.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Sources',
  description: 'Learn about the data sources powering PropertyIQ market analytics, including Zillow, Realtor.com, U.S. Census Bureau, and more.',
};

export default function DataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Create the data page**

Create `packages/frontend/app/data/page.tsx`. This is a static page, so it uses no client-side data fetching. Content comes from the `METRIC_DEFINITIONS` and `DATA_SOURCE_ANCHORS` constants.

```tsx
import { Database, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { PageHeaderWithBreadcrumbs } from '@/components/navigation';
import { METRIC_DEFINITIONS, DATA_SOURCE_ANCHORS } from '@/lib/data';

interface DataProvider {
  id: string;
  name: string;
  description: string;
  url: string;
  updateFrequency: string;
}

const DATA_PROVIDERS: DataProvider[] = [
  {
    id: 'realtor-com',
    name: 'Realtor.com',
    description:
      'Realtor.com is operated by Move, Inc. and provides comprehensive real estate listing data. As one of the largest real estate marketplaces in the United States, their research division publishes monthly housing market data covering listing prices, inventory levels, days on market, and market competitiveness indicators across metropolitan and county areas.',
    url: 'https://www.realtor.com/research/data/',
    updateFrequency: 'Monthly',
  },
  {
    id: 'zillow',
    name: 'Zillow',
    description:
      'Zillow Group publishes a suite of housing market indices through their research division. The Zillow Home Value Index (ZHVI) tracks typical home values using a repeat-sales methodology. The Zillow Observed Rent Index (ZORI) measures typical market rents. Zillow also provides home price forecasts (ZHVF), sale-to-list ratios, and affordability metrics covering hundreds of metropolitan areas and thousands of ZIP codes.',
    url: 'https://www.zillow.com/research/data/',
    updateFrequency: 'Monthly',
  },
  {
    id: 'census',
    name: 'U.S. Census Bureau',
    description:
      'The U.S. Census Bureau conducts the American Community Survey (ACS) annually, providing detailed demographic and economic data at the national, state, county, and ZIP code level. We use Census data for population estimates, median household income, median age, homeownership rates, and vacancy rates — key inputs for affordability and demographic analysis.',
    url: 'https://data.census.gov/',
    updateFrequency: 'Annual',
  },
  {
    id: 'fred',
    name: 'FRED (Federal Reserve Economic Data)',
    description:
      'FRED is maintained by the Federal Reserve Bank of St. Louis and aggregates economic data from dozens of government agencies. We source mortgage interest rates (Freddie Mac Primary Mortgage Market Survey) and unemployment rates at the national, state, and county level. These economic indicators drive our affordability calculations and market health assessments.',
    url: 'https://fred.stlouisfed.org/',
    updateFrequency: 'Monthly',
  },
  {
    id: 'bls',
    name: 'Bureau of Labor Statistics (BLS)',
    description:
      'The Bureau of Labor Statistics publishes the Quarterly Census of Employment and Wages (QCEW), which provides comprehensive employment data at the metro and county level. We use BLS data for job growth calculations and metro-level unemployment rates — key indicators of local economic health and housing demand.',
    url: 'https://www.bls.gov/data/',
    updateFrequency: 'Quarterly (QCEW) / Monthly (LAUS)',
  },
  {
    id: 'bea',
    name: 'Bureau of Economic Analysis (BEA)',
    description:
      'The Bureau of Economic Analysis provides GDP estimates at the state, metro, and county level, along with Regional Price Parities (RPPs) that measure cost-of-living differences across geographies. We use BEA data for GDP growth metrics and cost-of-living indices that contextualize housing costs relative to local economic output.',
    url: 'https://www.bea.gov/data',
    updateFrequency: 'Annual',
  },
  {
    id: 'propertyiq',
    name: 'PropertyIQ (Calculated)',
    description:
      'PropertyIQ generates proprietary calculated metrics and scores by combining data from multiple sources. Our scoring engine produces HomeReady, InvestorEdge, and MarketHealth scores validated across 1.1M+ observations. We also calculate derived metrics like cap rates, gross yields, affordability indices, inventory surplus/deficit, and months of supply by combining inputs from Zillow, Realtor.com, Census, and FRED data.',
    url: '/scores/methodology',
    updateFrequency: 'Monthly',
  },
];

function getMetricsForProvider(providerId: string): string[] {
  return Object.entries(METRIC_DEFINITIONS)
    .filter(([_, def]) => {
      const anchor = DATA_SOURCE_ANCHORS[def.dataSource];
      return anchor === providerId;
    })
    .map(([_, def]) => def.name);
}

export default function DataPage() {
  return (
    <>
      <PageHeaderWithBreadcrumbs
        title="Data Sources"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Data Sources' }]}
      />

      <p className="text-on-surface-variant mb-8 max-w-3xl">
        PropertyIQ aggregates data from trusted federal agencies and leading real estate
        data providers. Below are the sources powering our analytics, the metrics we derive
        from each, and links to their original data portals.
      </p>

      <div className="space-y-10">
        {DATA_PROVIDERS.map((provider) => {
          const metrics = getMetricsForProvider(provider.id);
          const isExternal = provider.url.startsWith('http');

          return (
            <section
              key={provider.id}
              id={provider.id}
              className="scroll-mt-24 bg-surface-container-low rounded-2xl p-6 md:p-8 elevation-1"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-container rounded-xl">
                    <Database className="w-5 h-5 text-on-primary-container" />
                  </div>
                  <h2 className="text-xl font-semibold text-on-surface">
                    {provider.name}
                  </h2>
                </div>

                {isExternal ? (
                  <a
                    href={provider.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors shrink-0"
                  >
                    Visit portal
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <Link
                    href={provider.url}
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors shrink-0"
                  >
                    View methodology
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              <p className="text-sm text-on-surface-variant mb-4 leading-relaxed">
                {provider.description}
              </p>

              <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-3">
                <span className="font-medium">Update frequency:</span>
                <span className="bg-surface-container px-2 py-0.5 rounded-full">
                  {provider.updateFrequency}
                </span>
              </div>

              {metrics.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-2">
                    Metrics ({metrics.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {metrics.map((name) => (
                      <span
                        key={name}
                        className="text-xs bg-surface-container px-2.5 py-1 rounded-full text-on-surface-variant"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
```

**Step 3: Verify the page renders**

Run: `cd packages/frontend && npx next dev` and navigate to `http://localhost:3000/data`

Expected: Page renders with 7 provider sections, each with description, metrics, and external link.

**Step 4: Commit**

```bash
git add packages/frontend/app/data/
git commit -m "feat: add /data page with provider sections and metric listings"
```

---

### Task 4: Integrate MetricTitle into map sidebar (MetricItem.tsx)

This is the highest-impact integration — replaces the old i-icon popup with the new hover-on-title pattern.

**Files:**
- Modify: `packages/frontend/app/map/components/sidebar-components/MetricItem.tsx`

**Step 1: Replace metric name and remove info popup**

The current MetricItem shows `metric.name` in a button and has an i-icon with click popup. Replace the name with `<MetricTitle>` and remove the i-icon + popup entirely.

In `packages/frontend/app/map/components/sidebar-components/MetricItem.tsx`:

1. Remove imports: `useState` for `showInfo`, `useRef` for `infoRef`/`buttonRef`, `createPortal`, `Link`, `InfoSmallIcon`, `getMetricDefinition`, `getMetricDataDate`, `formatDataDateForDisplay`
2. Add import: `import { MetricTitle } from '@/app/components/MetricTitle';`
3. Remove state: `showInfo`, `popupPosition`, refs `infoRef`, `buttonRef`
4. Remove: `handleInfoClick` function, `useEffect` for click outside, `metricDef` variable
5. Remove: entire `{/* Metric Info Popup */}` portal block (lines 105-160)
6. Replace line 89 `<span className="truncate">{metric.name}</span>` with `<MetricTitle metricId={metric.id} className="truncate" />`
7. Remove the i-icon `<span>` block (lines 91-102) — keep only the lock icon

The resulting button JSX should be approximately:

```tsx
<button
  onClick={isLocked ? () => setShowPaywall(true) : onSelect}
  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors duration-200 ${
    isLocked
      ? 'text-on-surface-variant/60 hover:bg-surface-container cursor-pointer'
      : isSelected
        ? 'bg-primary-container text-on-primary-container font-medium'
        : 'text-on-surface-variant hover:bg-surface-container'
    }`}
>
  <span className="flex items-center gap-1.5 min-w-0">
    <MetricTitle metricId={metric.id} className="truncate" />
  </span>
  {isLocked && (
    <span className="flex-shrink-0 ml-1">
      <LockIcon className="w-3.5 h-3.5 text-on-surface-variant/60" />
    </span>
  )}
</button>
```

**Step 2: Verify on the map page**

Run dev server, go to map page, hover over a metric name in the sidebar. The tooltip should appear with full metadata and a "View data source" link.

**Step 3: Commit**

```bash
git add packages/frontend/app/map/components/sidebar-components/MetricItem.tsx
git commit -m "feat: replace map sidebar i-icon popup with MetricTitle hover tooltip"
```

---

### Task 5: Integrate MetricTitle into map Legend

**Files:**
- Modify: `packages/frontend/app/map/components/Legend.tsx`

**Step 1: Add MetricTitle import and replace legend title**

In `Legend.tsx`, the legend title is rendered at lines like 48, 62, 82, etc. as:
```tsx
<div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2">{legendTitle}</div>
```

This appears identically in every format branch. Replace **all** of these with:

```tsx
<div className="text-xs md:text-sm font-medium text-on-surface mb-1.5 md:mb-2">
  <MetricTitle metricId={selectedMetric} />
</div>
```

Add import at top:
```tsx
import { MetricTitle } from '@/app/components/MetricTitle';
```

Remove `getMetricTitle` from the imports on line 7 (it's imported from `'../utils'`). Remove `legendTitle` variable on line 27.

**Step 2: Commit**

```bash
git add packages/frontend/app/map/components/Legend.tsx
git commit -m "feat: add MetricTitle hover to map legend"
```

---

### Task 6: Integrate MetricTitle into graph components

**Files:**
- Modify: `packages/frontend/app/graphs/components/MetricQuickCards.tsx`
- Modify: `packages/frontend/app/graphs/components/AnimatedTimeSeriesChart.tsx`

**Step 1: MetricQuickCards.tsx**

In the `QuickCard` component, replace the title display at lines 93-95 (compact) and line 131-133 (normal):

Compact (line 93-95):
```tsx
// OLD
<div className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wider truncate">
  {title}
</div>
// NEW
<div className="text-[9px] font-medium text-on-surface-variant uppercase tracking-wider truncate">
  <MetricTitle metricId={metricId} />
</div>
```

Normal (line 131-133):
```tsx
// OLD
<div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider truncate">
  {title}
</div>
// NEW
<div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider truncate">
  <MetricTitle metricId={metricId} />
</div>
```

Add import: `import { MetricTitle } from '@/app/components/MetricTitle';`
Remove `getMetricTitle` from the imports on line 6. Remove `const title = getMetricTitle(metricId);` on line 67.

**Step 2: AnimatedTimeSeriesChart.tsx**

Replace the metric title display at line 778:
```tsx
// OLD
<div className="absolute top-0 left-14 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
  {metricTitle}
</div>
// NEW
<div className="absolute top-0 left-14 text-xs font-medium text-on-surface-variant uppercase tracking-wider">
  <MetricTitle metricId={metricId} />
</div>
```

Add import: `import { MetricTitle } from '@/app/components/MetricTitle';`
Remove `getMetricTitle` from imports on line 6 (if no other usages). Remove `const metricTitle = getMetricTitle(metricId);` on line 79 (if no other usages — check first).

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/components/MetricQuickCards.tsx packages/frontend/app/graphs/components/AnimatedTimeSeriesChart.tsx
git commit -m "feat: add MetricTitle hover to graph quick cards and time series chart"
```

---

### Task 7: Integrate MetricTitle into report sections

**Files:**
- Modify: `packages/frontend/app/reports/[id]/components/sections/MetricDetail.tsx`
- Modify: `packages/frontend/app/reports/[id]/components/sections/MetricGrid.tsx`
- Modify: `packages/frontend/app/reports/[id]/components/sections/MetricHighlight.tsx`
- Modify: `packages/frontend/app/reports/[id]/components/sections/MetricComparison.tsx`
- Modify: `packages/frontend/app/reports/[id]/components/sections/ChartSingle.tsx`

**Step 1: MetricDetail.tsx**

Replace the label rendering. Currently line 16-18 creates a label fallback and line 51 renders it:

```tsx
// OLD (line 51)
<p className="text-sm text-on-surface-variant">{label}</p>
// NEW
<p className="text-sm text-on-surface-variant">
  {metricId ? <MetricTitle metricId={metricId} /> : label}
</p>
```

Also update the "data not available" state (line 23):
```tsx
// OLD
<p className="text-sm text-on-surface-variant mb-2">{label}</p>
// NEW
<p className="text-sm text-on-surface-variant mb-2">
  {metricId ? <MetricTitle metricId={metricId} /> : label}
</p>
```

Add import: `import { MetricTitle } from '@/app/components/MetricTitle';`

Keep the `label` variable as fallback for when `section.config?.label` is explicitly set (overrides automatic metric title).

**Step 2: MetricGrid.tsx**

Replace label display at line 46:

```tsx
// OLD
<p className="text-sm text-on-surface-variant mb-1">{label}</p>
// NEW
<p className="text-sm text-on-surface-variant mb-1">
  <MetricTitle metricId={metricId} />
</p>
```

Add import: `import { MetricTitle } from '@/app/components/MetricTitle';`

**Step 3: MetricHighlight.tsx and MetricComparison.tsx**

Same pattern — replace the `{label}` render with `<MetricTitle metricId={metricId} />` where `metricId` is available. Add import.

**Step 4: ChartSingle.tsx**

Replace the chart title with MetricTitle. The title is rendered at lines 44/63:

```tsx
// OLD
{title}
// NEW
{metricId ? <MetricTitle metricId={metricId} /> : title}
```

Add import: `import { MetricTitle } from '@/app/components/MetricTitle';`

**Step 5: Commit**

```bash
git add packages/frontend/app/reports/[id]/components/sections/MetricDetail.tsx packages/frontend/app/reports/[id]/components/sections/MetricGrid.tsx packages/frontend/app/reports/[id]/components/sections/MetricHighlight.tsx packages/frontend/app/reports/[id]/components/sections/MetricComparison.tsx packages/frontend/app/reports/[id]/components/sections/ChartSingle.tsx
git commit -m "feat: add MetricTitle hover to all report section components"
```

---

### Task 8: Integrate MetricTitle into StatCard and MetricLink

**Files:**
- Modify: `packages/frontend/components/data-display/StatCard.tsx`
- Modify: `packages/frontend/components/ui/MetricLink.tsx`

**Step 1: StatCard.tsx**

The `renderLabel` function (line 46-55) already has a `metricId` prop. When `metricId` is present, replace with MetricTitle:

```tsx
const renderLabel = (labelClassName: string) => {
  if (metricId) {
    return (
      <MetricTitle metricId={metricId} className={labelClassName} />
    );
  }
  return <span className={labelClassName}>{label}</span>;
};
```

Remove `MetricLink` import (line 7). Add: `import { MetricTitle } from '@/app/components/MetricTitle';`

**Step 2: MetricLink.tsx**

Replace the simple `Tooltip` with the full MetricTitle tooltip. Since `MetricLink` wraps metric names with a link to `/metrics/{id}`, update it to use `MetricTitle` internally but still render as a link:

Actually, `MetricLink` currently links to `/metrics/${metricId}` which doesn't exist. Instead, replace its tooltip behavior with a note that it now defers to MetricTitle for rich tooltips. The simplest approach: if a caller passes `metricId` to StatCard, MetricTitle handles the tooltip — so MetricLink's tooltip becomes redundant. Set `showTooltip={false}` on MetricLink's internal Tooltip when MetricTitle will handle it externally.

For now, just remove the `MetricLink` usage from `StatCard` (step 1 already does this) and leave `MetricLink` as-is for any other callers.

**Step 3: Commit**

```bash
git add packages/frontend/components/data-display/StatCard.tsx
git commit -m "feat: add MetricTitle hover to StatCard labels"
```

---

### Task 9: Integrate MetricTitle into score components

**Files:**
- Modify: `packages/frontend/app/graphs/components/ScoreCards.tsx`
- Modify: `packages/frontend/app/map/components/RightDetailPanel/CompactScoreCard.tsx`

**Step 1: ScoreCards.tsx**

In the `SubScoreDisplay` component, the `label` prop currently receives a plain string. The calling code at `getIndicatorsForMetrics()` constructs these labels. Instead of changing the label string, add a `metricId` prop to `SubScoreDisplay` and render with MetricTitle when available.

Add to `SubScoreDisplayProps`:
```typescript
metricId?: string;
```

In the render, replace:
```tsx
// OLD
<span className="text-[10px] text-on-surface-variant truncate">{label}</span>
// NEW
<span className="text-[10px] text-on-surface-variant truncate">
  {metricId ? <MetricTitle metricId={metricId} /> : label}
</span>
```

Pass `metricId` from wherever indicators are constructed.

Add import: `import { MetricTitle } from '@/app/components/MetricTitle';`

**Step 2: CompactScoreCard.tsx**

Same pattern as ScoreCards — add `metricId` prop to sub-score display and use `MetricTitle`.

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/components/ScoreCards.tsx packages/frontend/app/map/components/RightDetailPanel/CompactScoreCard.tsx
git commit -m "feat: add MetricTitle hover to score card sub-indicators"
```

---

### Task 10: Integrate MetricTitle into admin pages

**Files:**
- Modify: `packages/frontend/app/admin/data/components/DataCardsTab.tsx`
- Modify: `packages/frontend/app/admin/propertyiq-scores/components/ScoreCardsTab.tsx`

**Step 1: DataCardsTab.tsx**

Find where `metric.name` or `metric.metric` is rendered in the health table. Add MetricTitle where a metricId is available.

**Step 2: ScoreCardsTab.tsx**

The score labels are hardcoded (`Market Health`, `HomeReady`, `InvestorEdge`). These map to `market_health_score`, `homeready_score`, `investoredge_score`. Replace with MetricTitle using those IDs.

**Step 3: Commit**

```bash
git add packages/frontend/app/admin/data/components/DataCardsTab.tsx packages/frontend/app/admin/propertyiq-scores/components/ScoreCardsTab.tsx
git commit -m "feat: add MetricTitle hover to admin metric tables"
```

---

### Task 11: Integrate MetricTitle into selectors and pickers

**Files:**
- Modify: `packages/frontend/app/graphs/components/MetricPicker.tsx`
- Modify: `packages/frontend/app/map/components/MetricSelector.tsx`

**Step 1: MetricPicker.tsx**

Replace `getMetricTitle(metricId)` calls (lines 70 and 124) with `<MetricTitle metricId={metricId} />`.

Add import: `import { MetricTitle } from '@/app/components/MetricTitle';`

**Step 2: MetricSelector.tsx**

Replace `{m.name}` (line 186) with `<MetricTitle metricId={m.id} />`.

Add import: `import { MetricTitle } from '@/app/components/MetricTitle';`

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/components/MetricPicker.tsx packages/frontend/app/map/components/MetricSelector.tsx
git commit -m "feat: add MetricTitle hover to metric selectors and pickers"
```

---

### Task 12: Add navigation link to /data page

**Files:**
- Modify: `packages/frontend/src/components/layout/Header.tsx` (or wherever nav links are defined)

**Step 1: Find nav configuration**

Look for where nav items like "Scores", "Map", "Graphs" are defined and add a "Data" link.

**Step 2: Add "Data" nav item**

Add `{ label: 'Data', href: '/data' }` to the navigation items, positioned after "Scores" or at the end.

**Step 3: Commit**

```bash
git add packages/frontend/src/components/layout/Header.tsx
git commit -m "feat: add Data Sources link to site navigation"
```

---

### Task 13: Final verification and cleanup

**Step 1: Run the build**

```bash
cd packages/frontend && npx next build --no-lint 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

**Step 2: Manually verify key surfaces**

- `/data` page renders all 7 providers with correct metrics
- Map sidebar: hover metric name → tooltip appears, stays in viewport, link goes to `/data#provider`
- Map legend: hover metric title → tooltip appears
- Graphs quick cards: hover metric name → tooltip
- Reports: metric labels show tooltip on hover
- Admin pages: metric names show tooltip on hover

**Step 3: Delete old re-export file if no other imports**

Check if anything still imports from `app/map/data/metricDefinitions`:
```bash
grep -r "map/data/metricDefinitions" packages/frontend/ --include="*.tsx" --include="*.ts"
```

If only the re-export file itself shows up, it can stay as a safety net or be removed.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cleanup after metric tooltip integration"
```
