# Time-Animated Charts + Color Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add race/time-animation mode to bar, scatter, and radar charts with geo-aware peer selection, extract shared playback controls, and refresh the chart color palette from purple-dominant to teal-blue primary with warm accents.

**Architecture:** Rewrite `useBarRaceData` with geo-aware peer selection (metro: dynamic top N in scope, county: dynamic top N in state, ZIP: cascade metro→county→state with rank neighbors). Create `useScatterRaceData` and `useRadarRaceData` hooks. Extract `PlaybackControls` from HorizontalBarChart for reuse. Update `CHART_COLORS` in scales.ts and propagate to all five chart components.

**Tech Stack:** D3.js v7.9, React 18, React Query (TanStack Query), TypeScript, Tailwind CSS, Next.js App Router

---

### Task 1: Update Color Palette in scales.ts

**Files:**
- Modify: `packages/frontend/lib/visualizations/d3/utils/scales.ts:4-42`

**Step 1: Update CHART_COLORS**

Replace the CHART_COLORS object at lines 4-42:

```typescript
export const CHART_COLORS = {
  // Primary series (teal)
  primary: '#0891b2',
  onPrimary: '#ffffff',
  primaryContainer: '#cffafe',

  // Comparison series (blue)
  comparison: '#3b82f6',
  comparisonLight: '#93c5fd',

  // Baseline series (orange — unchanged)
  baseline: '#ea580c',
  baselineLight: '#fdba74',

  // User's market highlight (amber)
  highlight: '#f59e0b',
  highlightLight: '#fde68a',

  // Additional series for multi-series charts
  series: [
    '#0891b2', // Teal (primary)
    '#3b82f6', // Blue
    '#ea580c', // Orange
    '#16a34a', // Green
    '#f59e0b', // Amber
    '#7c3aed', // Violet
    '#0d9488', // Teal-dark
    '#dc2626', // Red
  ],

  // Semantic colors (unchanged)
  positive: '#16a34a',
  negative: '#dc2626',
  neutral: '#6b7280',

  // Surface colors (unchanged)
  surface: '#fef7ff',
  surfaceContainer: '#f3edf7',
  outline: '#79747e',
  outlineVariant: '#cac4d0',
  onSurface: '#1d1b20',
  onSurfaceVariant: '#49454f',
};
```

Key changes: `primary` → teal, `comparison` → blue, new `highlight`/`highlightLight` for user's market, `series[0]` → teal, `series[1]` → blue, `series[4]` → amber.

**Step 2: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`
Expected: Clean build (no new errors — `highlight` is a new key, won't break existing references)

**Step 3: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/utils/scales.ts
git commit -m "feat: update chart color palette to teal-blue primary with warm accents"
```

---

### Task 2: Propagate Colors to Timeline Chart

**Files:**
- Modify: `packages/frontend/app/graphs/components/AnimatedTimeSeriesChart.tsx:55-70`

**Step 1: Update default color props**

Find the component's default props (around lines 55-70) where:
```typescript
primaryColor = CHART_COLORS.primary
comparisonColor = CHART_COLORS.comparison
baselineColor = CHART_COLORS.baseline
```

These already reference `CHART_COLORS`, so after Task 1 they'll automatically pick up the new teal/blue/orange colors. **No code change needed** — just verify visually.

**Step 2: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 3: Commit** (skip if no changes)

---

### Task 3: Propagate Colors to Waterfall Chart

**Files:**
- Modify: `packages/frontend/lib/visualizations/d3/WaterfallChart.tsx:26-30`

**Step 1: Update BAR_COLORS.total**

Change line 29 from:
```typescript
total: '#6750a4',
```
to:
```typescript
total: '#4f46e5',
```

This changes the total bar from purple to indigo. The positive (#22c55e) and negative (#ef4444) colors are already correct and stay unchanged.

**Step 2: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 3: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/WaterfallChart.tsx
git commit -m "feat: update waterfall total bar color to indigo"
```

---

### Task 4: Update ScatterPlot with Quartile Coloring

**Files:**
- Modify: `packages/frontend/lib/visualizations/d3/ScatterPlot.tsx`

**Step 1: Add quartile color constants**

Near the top of the file (after existing imports/constants), add:

```typescript
const QUARTILE_COLORS = ['#0891b2', '#3b82f6', '#f59e0b', '#f97316'] as const;
// Q1 (top 25%): teal, Q2: blue, Q3: amber, Q4 (bottom 25%): coral
```

**Step 2: Update the color logic in the D3 data join**

Find the two places where fill color is set (lines ~416 and ~464):

```typescript
.attr('fill', d => colorByCategory ? colorScale(d.category || 'default') : CHART_COLORS.primary)
```

Replace with a quartile-based color function. Before the data join (inside the render function), compute quartile thresholds:

```typescript
// Compute quartile thresholds for coloring
const yValues = processedData.map(d => d.y).sort((a, b) => a - b);
const q1 = d3.quantile(yValues, 0.25) ?? 0;
const q2 = d3.quantile(yValues, 0.5) ?? 0;
const q3 = d3.quantile(yValues, 0.75) ?? 0;

function getQuartileColor(d: ScatterDataPoint): string {
  if (colorByCategory) return colorScale(d.category || 'default');
  if (d.y >= q3) return QUARTILE_COLORS[0]; // Top 25% — teal
  if (d.y >= q2) return QUARTILE_COLORS[1]; // Q2 — blue
  if (d.y >= q1) return QUARTILE_COLORS[2]; // Q3 — amber
  return QUARTILE_COLORS[3];                 // Bottom 25% — coral
}
```

Then replace both `.attr('fill', ...)` lines with:
```typescript
.attr('fill', d => getQuartileColor(d))
```

**Step 3: Highlight user's market**

In the data join where highlighted points are handled (look for references to `primaryId` or `highlighted`), ensure the user's market dot gets:
- Larger radius (+2px)
- Amber stroke: `.attr('stroke', CHART_COLORS.highlight).attr('stroke-width', 2)`

**Step 4: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 5: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/ScatterPlot.tsx
git commit -m "feat: add quartile-based coloring to scatter plot"
```

---

### Task 5: Update RadarChart Default Colors

**Files:**
- Modify: `packages/frontend/lib/visualizations/d3/RadarChart.tsx:37`

**Step 1: Update DEFAULT_COLORS**

Change line 37 from:
```typescript
const DEFAULT_COLORS = ['#6750a4', '#0891b2', '#ea580c'];
```
to:
```typescript
const DEFAULT_COLORS = ['#0891b2', '#3b82f6', '#ea580c'];
```

Dataset 1 → teal, Dataset 2 → blue, Dataset 3 → orange.

**Step 2: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 3: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/RadarChart.tsx
git commit -m "feat: update radar chart default colors to teal/blue/orange"
```

---

### Task 6: Update HorizontalBarChart with Rank Gradient

**Files:**
- Modify: `packages/frontend/lib/visualizations/d3/HorizontalBarChart.tsx`

**Step 1: Replace default prop colors**

Change the default props (line 69-70):
```typescript
highlightColor = '#6750a4',
barColor = '#c4b5fd',
```
to:
```typescript
highlightColor = CHART_COLORS.highlight, // Amber for user's market
barColor = CHART_COLORS.primary,         // Teal base (will be overridden by gradient)
```

**Step 2: Add rank gradient color function**

Near the top of the component (after refs setup), add a gradient helper:

```typescript
// Rank-based color gradient: teal (#0891b2) → indigo (#4f46e5)
const rankColorScale = useMemo(() => {
  return d3.scaleLinear<string>()
    .domain([0, Math.max(data.length - 1, 1)])
    .range([CHART_COLORS.primary, '#4f46e5'])
    .interpolate(d3.interpolateHcl);
}, [data.length]);
```

Store in a ref for D3 access:
```typescript
const rankColorRef = useRef(rankColorScale);
rankColorRef.current = rankColorScale;
```

**Step 3: Apply gradient in static mode bars**

In the static mode D3 effect (~line 199), change the bar fill from:
```typescript
.attr('fill', (d) => (d.highlighted ? highlightColor : barColor))
```
to:
```typescript
.attr('fill', (d, i) => d.highlighted ? highlightColorRef.current : rankColorRef.current(i))
```

**Step 4: Apply gradient in race mode bars**

In the race mode D3 effect, the enter section (~line 433) and update section (~line 497), change:
```typescript
d.highlighted ? highlightColorRef.current : barColorRef.current
```
to:
```typescript
(d, i) => d.highlighted ? highlightColorRef.current : rankColorRef.current(i)
```

Note: In race mode, `i` is the sorted index within the current frame, which maps to rank position — exactly what we want.

**Step 5: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 6: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/HorizontalBarChart.tsx
git commit -m "feat: add rank gradient coloring and amber highlight to bar chart"
```

---

### Task 7: Extract Shared PlaybackControls Component

**Files:**
- Create: `packages/frontend/lib/visualizations/d3/PlaybackControls.tsx`
- Modify: `packages/frontend/lib/visualizations/d3/HorizontalBarChart.tsx:666-710`
- Modify: `packages/frontend/lib/visualizations/d3/index.ts`

**Step 1: Create PlaybackControls.tsx**

```typescript
'use client';

import React from 'react';
import { Play, Pause } from 'lucide-react';

export interface PlaybackControlsProps {
  /** Total number of frames */
  frameCount: number;
  /** Current frame index (0-based) */
  currentFrame: number;
  /** Display date for current frame */
  currentDate: string;
  /** Whether animation is playing */
  isPlaying: boolean;
  /** Current speed in ms per frame */
  speed: number;
  /** Toggle play/pause */
  onTogglePlay: () => void;
  /** Seek to a specific frame */
  onSeek: (frameIndex: number) => void;
  /** Change playback speed */
  onSpeedChange: (speed: number) => void;
  /** Optional className */
  className?: string;
}

export function PlaybackControls({
  frameCount,
  currentFrame,
  currentDate,
  isPlaying,
  speed,
  onTogglePlay,
  onSeek,
  onSpeedChange,
  className = '',
}: PlaybackControlsProps) {
  if (frameCount <= 0) return null;

  return (
    <div className={`flex items-center gap-3 mt-2 px-4 ${className}`}>
      {/* Play / Pause */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary hover:bg-primary/90 transition-colors"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      {/* Speed selector */}
      <select
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        className="text-sm bg-surface-container border border-outline-variant rounded-md px-2 py-1 text-on-surface"
      >
        <option value={1600}>0.5x</option>
        <option value={800}>1x</option>
        <option value={400}>2x</option>
        <option value={200}>4x</option>
      </select>

      {/* Date label */}
      <span className="text-sm font-semibold text-on-surface min-w-[80px]">
        {currentDate}
      </span>

      {/* Progress scrubber */}
      <input
        type="range"
        min={0}
        max={frameCount - 1}
        value={currentFrame}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="flex-1 accent-primary"
      />
    </div>
  );
}
```

**Step 2: Replace inline controls in HorizontalBarChart**

In `HorizontalBarChart.tsx`, replace the playback controls JSX (lines ~666-710):

```tsx
{/* Race mode playback controls */}
{isRaceMode && raceFrames && (
  <div className="flex items-center gap-3 mt-2 px-4">
    ...entire block...
  </div>
)}
```

With:

```tsx
{isRaceMode && raceFrames && (
  <PlaybackControls
    frameCount={raceFrames.length}
    currentFrame={currentFrame}
    currentDate={currentDate}
    isPlaying={isPlaying}
    speed={speed}
    onTogglePlay={togglePlay}
    onSeek={seekToFrame}
    onSpeedChange={setSpeed}
  />
)}
```

Add import at top:
```typescript
import { PlaybackControls } from './PlaybackControls';
```

Remove the `Play, Pause` lucide import from HorizontalBarChart since it's now in PlaybackControls.

**Step 3: Export from barrel**

In `packages/frontend/lib/visualizations/d3/index.ts`, add:
```typescript
export { PlaybackControls, type PlaybackControlsProps } from './PlaybackControls';
```

**Step 4: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 5: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/PlaybackControls.tsx packages/frontend/lib/visualizations/d3/HorizontalBarChart.tsx packages/frontend/lib/visualizations/d3/index.ts
git commit -m "refactor: extract shared PlaybackControls from HorizontalBarChart"
```

---

### Task 8: Rename barRaceMode → raceMode in State

**Files:**
- Modify: `packages/frontend/app/graphs/hooks/useGraphsState.ts`
- Modify: `packages/frontend/app/graphs/components/Sidebar/Sidebar.tsx`
- Modify: `packages/frontend/app/graphs/components/GraphsPageV2/GraphsPageV2.tsx`

**Step 1: Rename in useGraphsState.ts**

Use find-and-replace across the file:
- `barRaceMode` → `raceMode` (in GraphsState interface, default state, URL sync, setter)
- `setBarRaceMode` → `setRaceMode` (setter name and return)
- URL param stays `br` (no URL change needed)

Specifically:
- Line ~74: `barRaceMode: boolean;` → `raceMode: boolean;`
- Line ~121: `setBarRaceMode: (race: boolean) => void;` → `setRaceMode: (race: boolean) => void;`
- Line ~150: `barRaceMode: false,` → `raceMode: false,`
- Line ~205: `barRaceMode: br === '1',` → `raceMode: br === '1',`
- Line ~280: `state.barRaceMode` → `state.raceMode` (two occurrences in URL sync)
- Line ~487: `const setBarRaceMode` → `const setRaceMode`
- Line ~488: `barRaceMode: race` → `raceMode: race`
- Return: `setBarRaceMode,` → `setRaceMode,`

**Step 2: Update Sidebar.tsx**

In the destructuring (~line 57):
```typescript
barRaceMode, setBarRaceMode,
```
→
```typescript
raceMode, setRaceMode,
```

In the toggle (~line 193):
```typescript
<ToggleRow label="Race" checked={barRaceMode} onChange={setBarRaceMode} />
```
→
```typescript
<ToggleRow label="Race" checked={raceMode} onChange={setRaceMode} />
```

Also move the toggle from `showBarControls` section to be visible for bar, scatter, and radar. Change the visibility condition:

```typescript
const showRaceToggle = ['bar', 'scatter', 'radar'].includes(chartType);
```

Move the ToggleRow before the bar-specific controls and wrap in the new condition:

```typescript
{/* Race/Animate toggle (bar, scatter, radar) */}
{showRaceToggle && (
  <ToggleRow label="Animate" checked={raceMode} onChange={setRaceMode} />
)}
```

Remove the old `<ToggleRow label="Race" ...>` from the bar controls section.

**Step 3: Update GraphsPageV2.tsx**

In the destructuring (~line 157):
```typescript
barRaceMode,
```
→
```typescript
raceMode,
```

In all references throughout the file, replace `barRaceMode` with `raceMode` (approximately 8 occurrences in the bar chart section).

**Step 4: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 5: Commit**

```bash
git add packages/frontend/app/graphs/hooks/useGraphsState.ts packages/frontend/app/graphs/components/Sidebar/Sidebar.tsx packages/frontend/app/graphs/components/GraphsPageV2/GraphsPageV2.tsx
git commit -m "refactor: rename barRaceMode to raceMode, show toggle for bar/scatter/radar"
```

---

### Task 9: Rewrite useBarRaceData with Geo-Aware Peer Selection

**Files:**
- Modify: `packages/frontend/app/graphs/hooks/useBarRaceData.ts`

**Step 1: Rewrite the hook**

Replace the entire file with geo-aware logic:

```typescript
'use client';

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSnapshotData, fetchTimeSeriesData, formatMetricValue, getMetricFormat } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';
import type { BarRaceFrame, BarEntry } from '@/lib/visualizations/d3/HorizontalBarChart';
import { getRegionStates } from '../constants';
import type { ScatterScope, BarSort, BarCount } from './useGraphsState';

/** Extract state abbreviation from metro name */
function parseStateFromName(name: string): string | null {
  const match = name.match(/,\s*([A-Z]{2})(?:\s*-\s*[A-Z]{2})*\s*$/);
  return match ? match[1] : null;
}

export interface UseBarRaceDataResult {
  raceFrames: BarRaceFrame[];
  formatValue: (v: number) => string;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Geo-aware bar chart race data hook.
 *
 * Peer selection strategy:
 * - Metro: Dynamic top N within scope (state/region/national)
 * - County: Dynamic top N within same state
 * - ZIP: Cascade metro → county → state, rank neighbors
 *
 * Fetches time series for a 3×N wider pool so markets can
 * enter/exit the top N dynamically across frames.
 * User's market is always pinned.
 */
export function useBarRaceData(
  metricId: string,
  geoLevel: GeoLevel,
  primaryMarket: { id: string; name: string; state?: string } | null,
  scope: ScatterScope,
  sort: BarSort,
  count: BarCount,
  enabled: boolean = false,
): UseBarRaceDataResult {
  const { allData, isLoading: snapshotLoading } = useSnapshotData(metricId, geoLevel);

  const formatValue = useCallback(
    (v: number) => formatMetricValue(v, getMetricFormat(metricId)),
    [metricId],
  );

  // Wider pool: 3× the display count for dynamic top N
  const poolSize = count * 3;

  // Identify the wider pool of markets to fetch time series for
  const poolMarkets = useMemo(() => {
    if (snapshotLoading || !allData || Object.keys(allData).length === 0) return [];

    const entries: { id: string; name: string; value: number }[] = [];
    for (const [id, entry] of Object.entries(allData)) {
      if (!entry) continue;
      const val = typeof entry === 'number' ? entry : entry.value;
      const name = (typeof entry === 'object' && entry.name) || id;
      if (val == null || Number.isNaN(val)) continue;
      entries.push({ id, name, value: val });
    }

    // --- Geo-aware pool filtering ---
    let filtered: typeof entries;
    const primaryState = primaryMarket?.state ?? null;

    if (geoLevel === 'zip') {
      // ZIP: cascade metro → county → state
      // For now, use state-level filtering (metro/county lookup requires additional data)
      // TODO: Add metro/county lookup when ZIP metadata is available
      if (primaryState) {
        filtered = entries.filter((e) => {
          const st = parseStateFromName(e.name);
          return st === primaryState;
        });
      } else {
        filtered = entries;
      }
    } else if (geoLevel === 'county') {
      // County: always same state, ignore scope selector
      if (primaryState) {
        filtered = entries.filter((e) => {
          const st = parseStateFromName(e.name);
          return st === primaryState;
        });
      } else {
        filtered = entries;
      }
    } else {
      // Metro: respect scope selector
      let allowedStates: Set<string> | null = null;
      if (scope === 'state' && primaryState) {
        allowedStates = new Set([primaryState]);
      } else if (scope === 'region' && primaryState) {
        allowedStates = new Set(getRegionStates(primaryState));
      }
      filtered = allowedStates
        ? entries.filter((e) => {
            const st = parseStateFromName(e.name);
            return st !== null && allowedStates!.has(st);
          })
        : entries;
    }

    // Sort by value (desc) and take wider pool
    const sorted = [...filtered].sort((a, b) => b.value - a.value);
    const pool = sorted.slice(0, poolSize);

    // Always include primary market
    const primaryId = primaryMarket?.id ?? null;
    if (primaryId && !pool.some((e) => e.id === primaryId)) {
      const primaryEntry = sorted.find((e) => e.id === primaryId);
      if (primaryEntry) pool.push(primaryEntry);
    }

    return pool;
  }, [allData, snapshotLoading, primaryMarket, scope, geoLevel, poolSize]);

  const poolIds = useMemo(() => poolMarkets.map((m) => m.id).join(','), [poolMarkets]);

  // Fetch time series for entire pool, then build dynamic-top-N frames
  const {
    data: raceFrames,
    isLoading: tsLoading,
    error,
  } = useQuery({
    queryKey: ['bar-race', metricId, geoLevel, poolIds],
    queryFn: async () => {
      const results = await Promise.all(
        poolMarkets.map(async (market) => {
          try {
            const res = await fetchTimeSeriesData(metricId, geoLevel, market.id);
            return { market, data: res.data || [] };
          } catch {
            return { market, data: [] };
          }
        }),
      );

      // Build date → market → value map (normalized to YYYY-MM)
      const dateMap = new Map<string, Map<string, { market: typeof poolMarkets[0]; value: number }>>();

      for (const { market, data } of results) {
        for (const point of data) {
          const month = point.date.slice(0, 7);
          if (!dateMap.has(month)) dateMap.set(month, new Map());
          dateMap.get(month)!.set(market.id, { market, value: point.value });
        }
      }

      // Only keep months with at least half the pool reporting
      const minMarkets = Math.max(1, Math.floor(poolMarkets.length / 2));
      const dates = [...dateMap.keys()]
        .filter((d) => dateMap.get(d)!.size >= minMarkets)
        .sort();

      const primaryId = primaryMarket?.id ?? null;

      // Build frames with dynamic top N per frame
      const frames: BarRaceFrame[] = dates.map((date) => {
        const marketData = dateMap.get(date)!;

        // Sort ALL markets in this frame by value
        const allEntries = [...marketData.values()]
          .sort((a, b) => b.value - a.value);

        // Take top N
        const topN = allEntries.slice(0, count);

        // Pin user's market if not in top N
        if (primaryId && !topN.some((e) => e.market.id === primaryId)) {
          const pinned = allEntries.find((e) => e.market.id === primaryId);
          if (pinned) topN.push(pinned);
        }

        const entries: BarEntry[] = topN.map((e) => ({
          id: e.market.id,
          label: e.market.name,
          value: e.value,
          highlighted: e.market.id === primaryId,
        }));

        return { date, entries };
      });

      return frames;
    },
    enabled: enabled && poolMarkets.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    raceFrames: raceFrames ?? [],
    formatValue,
    isLoading: snapshotLoading || tsLoading,
    error: error as Error | null,
  };
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/hooks/useBarRaceData.ts
git commit -m "feat: rewrite useBarRaceData with geo-aware peer selection and dynamic top N"
```

---

### Task 10: Create useScatterRaceData Hook

**Files:**
- Create: `packages/frontend/app/graphs/hooks/useScatterRaceData.ts`

**Step 1: Create the hook**

```typescript
'use client';

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSnapshotData, fetchTimeSeriesData, formatMetricValue, getMetricFormat } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';
import type { ScatterDataPoint } from '@/lib/visualizations/d3/ScatterPlot';
import { getRegionStates } from '../constants';
import type { ScatterScope } from './useGraphsState';

/** Extract state abbreviation from metro name */
function parseStateFromName(name: string): string | null {
  const match = name.match(/,\s*([A-Z]{2})(?:\s*-\s*[A-Z]{2})*\s*$/);
  return match ? match[1] : null;
}

export interface ScatterRaceFrame {
  date: string;
  points: ScatterDataPoint[];
}

export interface UseScatterRaceDataResult {
  frames: ScatterRaceFrame[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches time series for X and Y metrics for all markets in scope,
 * then builds frames for Gapminder-style scatter race animation.
 *
 * Each frame positions markets at their (x, y) values for that month.
 * Uses a 3× wider pool to keep animation responsive.
 */
export function useScatterRaceData(
  xMetricId: string,
  yMetricId: string,
  geoLevel: GeoLevel,
  primaryMarket: { id: string; name: string; state?: string } | null,
  scope: ScatterScope,
  enabled: boolean = false,
): UseScatterRaceDataResult {
  // Get snapshot for X metric to identify markets in scope
  const { allData, isLoading: snapshotLoading } = useSnapshotData(xMetricId, geoLevel);

  const POOL_SIZE = 75; // 3× a reasonable display count

  // Identify markets in scope
  const poolMarkets = useMemo(() => {
    if (snapshotLoading || !allData || Object.keys(allData).length === 0) return [];

    const entries: { id: string; name: string; value: number }[] = [];
    for (const [id, entry] of Object.entries(allData)) {
      if (!entry) continue;
      const val = typeof entry === 'number' ? entry : entry.value;
      const name = (typeof entry === 'object' && entry.name) || id;
      if (val == null || Number.isNaN(val)) continue;
      entries.push({ id, name, value: val });
    }

    // Filter by scope
    let allowedStates: Set<string> | null = null;
    const primaryState = primaryMarket?.state ?? null;
    if (scope === 'state' && primaryState) {
      allowedStates = new Set([primaryState]);
    } else if (scope === 'region' && primaryState) {
      allowedStates = new Set(getRegionStates(primaryState));
    }

    const filtered = allowedStates
      ? entries.filter((e) => {
          const st = parseStateFromName(e.name);
          return st !== null && allowedStates!.has(st);
        })
      : entries;

    // Take top POOL_SIZE by value
    const sorted = [...filtered].sort((a, b) => b.value - a.value);
    const pool = sorted.slice(0, POOL_SIZE);

    // Always include primary market
    const primaryId = primaryMarket?.id ?? null;
    if (primaryId && !pool.some((e) => e.id === primaryId)) {
      const primaryEntry = sorted.find((e) => e.id === primaryId);
      if (primaryEntry) pool.push(primaryEntry);
    }

    return pool;
  }, [allData, snapshotLoading, primaryMarket, scope]);

  const poolIds = useMemo(() => poolMarkets.map((m) => m.id).join(','), [poolMarkets]);

  // Fetch X and Y time series for all pool markets
  const {
    data: frames,
    isLoading: tsLoading,
    error,
  } = useQuery({
    queryKey: ['scatter-race', xMetricId, yMetricId, geoLevel, poolIds],
    queryFn: async () => {
      // Fetch both metrics for all markets in parallel
      const [xResults, yResults] = await Promise.all([
        Promise.all(
          poolMarkets.map(async (market) => {
            try {
              const res = await fetchTimeSeriesData(xMetricId, geoLevel, market.id);
              return { id: market.id, data: res.data || [] };
            } catch {
              return { id: market.id, data: [] };
            }
          }),
        ),
        Promise.all(
          poolMarkets.map(async (market) => {
            try {
              const res = await fetchTimeSeriesData(yMetricId, geoLevel, market.id);
              return { id: market.id, data: res.data || [] };
            } catch {
              return { id: market.id, data: [] };
            }
          }),
        ),
      ]);

      // Build per-market lookup: id → { month → value }
      const xByMarket = new Map<string, Map<string, number>>();
      const yByMarket = new Map<string, Map<string, number>>();

      for (const { id, data } of xResults) {
        const monthMap = new Map<string, number>();
        for (const pt of data) monthMap.set(pt.date.slice(0, 7), pt.value);
        xByMarket.set(id, monthMap);
      }

      for (const { id, data } of yResults) {
        const monthMap = new Map<string, number>();
        for (const pt of data) monthMap.set(pt.date.slice(0, 7), pt.value);
        yByMarket.set(id, monthMap);
      }

      // Collect all months where at least some markets have both X and Y
      const allMonths = new Set<string>();
      for (const [id, xMap] of xByMarket) {
        const yMap = yByMarket.get(id);
        if (!yMap) continue;
        for (const month of xMap.keys()) {
          if (yMap.has(month)) allMonths.add(month);
        }
      }

      const months = [...allMonths].sort();
      const primaryId = primaryMarket?.id ?? null;
      const marketLookup = new Map(poolMarkets.map((m) => [m.id, m]));

      // Build frames
      const frames: ScatterRaceFrame[] = months.map((month) => {
        const points: ScatterDataPoint[] = [];

        for (const market of poolMarkets) {
          const xVal = xByMarket.get(market.id)?.get(month);
          const yVal = yByMarket.get(market.id)?.get(month);
          if (xVal == null || yVal == null) continue;

          points.push({
            id: market.id,
            label: market.name,
            x: xVal,
            y: yVal,
            size: market.id === primaryId ? 1.5 : 1,
          });
        }

        return { date: month, points };
      });

      // Filter out empty frames
      return frames.filter((f) => f.points.length >= 3);
    },
    enabled: enabled && poolMarkets.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    frames: frames ?? [],
    isLoading: snapshotLoading || tsLoading,
    error: error as Error | null,
  };
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/hooks/useScatterRaceData.ts
git commit -m "feat: create useScatterRaceData hook for Gapminder-style animation"
```

---

### Task 11: Create useRadarRaceData Hook

**Files:**
- Create: `packages/frontend/app/graphs/hooks/useRadarRaceData.ts`

**Step 1: Create the hook**

```typescript
'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTimeSeriesData } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';
import type { RadarDataSet, RadarDimension } from '@/lib/visualizations/d3/RadarChart';

export interface RadarRaceFrame {
  date: string;
  datasets: RadarDataSet[];
}

export interface UseRadarRaceDataResult {
  frames: RadarRaceFrame[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches time series for each radar dimension for selected markets,
 * then builds frames showing how radar profiles evolve over time.
 *
 * Data volume is small: dimensions × markets (e.g. 6 × 3 = 18 fetches).
 */
export function useRadarRaceData(
  dimensions: RadarDimension[],
  geoLevel: GeoLevel,
  markets: { id: string; name: string; state?: string }[],
  datasetColors: string[],
  enabled: boolean = false,
): UseRadarRaceDataResult {
  const marketIds = useMemo(() => markets.map((m) => m.id).join(','), [markets]);
  const dimKeys = useMemo(() => dimensions.map((d) => d.key).join(','), [dimensions]);

  const {
    data: frames,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['radar-race', dimKeys, geoLevel, marketIds],
    queryFn: async () => {
      // Fetch time series for each (market, dimension) pair
      const allResults: {
        marketIdx: number;
        dimKey: string;
        months: Map<string, number>;
      }[] = [];

      await Promise.all(
        markets.flatMap((market, marketIdx) =>
          dimensions.map(async (dim) => {
            try {
              const res = await fetchTimeSeriesData(dim.key, geoLevel, market.id);
              const months = new Map<string, number>();
              for (const pt of res.data || []) {
                months.set(pt.date.slice(0, 7), pt.value);
              }
              allResults.push({ marketIdx, dimKey: dim.key, months });
            } catch {
              allResults.push({ marketIdx, dimKey: dim.key, months: new Map() });
            }
          }),
        ),
      );

      // Organize: marketIdx → dimKey → month → value
      const dataByMarket = new Map<number, Map<string, Map<string, number>>>();
      for (const { marketIdx, dimKey, months } of allResults) {
        if (!dataByMarket.has(marketIdx)) dataByMarket.set(marketIdx, new Map());
        dataByMarket.get(marketIdx)!.set(dimKey, months);
      }

      // Collect all months where at least one market has data for all dimensions
      const allMonths = new Set<string>();
      for (const [, dimMap] of dataByMarket) {
        for (const [, months] of dimMap) {
          for (const month of months.keys()) allMonths.add(month);
        }
      }

      const sortedMonths = [...allMonths].sort();

      // Build frames
      const frames: RadarRaceFrame[] = [];
      for (const month of sortedMonths) {
        const datasets: RadarDataSet[] = [];

        for (let i = 0; i < markets.length; i++) {
          const dimMap = dataByMarket.get(i);
          if (!dimMap) continue;

          const values: Record<string, number> = {};
          let hasAllDims = true;

          for (const dim of dimensions) {
            const val = dimMap.get(dim.key)?.get(month);
            if (val == null) {
              hasAllDims = false;
              break;
            }
            values[dim.key] = val;
          }

          if (!hasAllDims) continue;

          datasets.push({
            label: markets[i].name,
            color: datasetColors[i] || '#0891b2',
            values,
          });
        }

        // Only include frames where at least one market has full data
        if (datasets.length > 0) {
          frames.push({ date: month, datasets });
        }
      }

      return frames;
    },
    enabled: enabled && markets.length > 0 && dimensions.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  return {
    frames: frames ?? [],
    isLoading,
    error: error as Error | null,
  };
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/hooks/useRadarRaceData.ts
git commit -m "feat: create useRadarRaceData hook for radar evolution animation"
```

---

### Task 12: Add Race Mode to ScatterPlot

**Files:**
- Modify: `packages/frontend/lib/visualizations/d3/ScatterPlot.tsx`

**Step 1: Add race mode props**

Add to the `ScatterPlotProps` interface:

```typescript
/** Race mode frames — if provided, enables time animation */
raceFrames?: { date: string; points: ScatterDataPoint[] }[];
/** Auto-play on mount (default false) */
autoPlay?: boolean;
/** Ms per frame (default 800) */
playbackSpeed?: number;
/** Called when frame changes */
onFrameChange?: (frameIndex: number, date: string) => void;
```

**Step 2: Add race mode state and playback logic**

Inside the component, add (following the same pattern as HorizontalBarChart):

```typescript
const isRaceMode = Boolean(raceFrames && raceFrames.length > 0);
const [isPlaying, setIsPlaying] = useState(autoPlay ?? false);
const [currentFrame, setCurrentFrame] = useState(0);
const [speed, setSpeed] = useState(playbackSpeed ?? 800);
const [currentDate, setCurrentDate] = useState(
  raceFrames?.[0]?.date ?? '',
);
const frameRef = useRef(0);
const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
const renderFrameRef = useRef<(idx: number) => void>(undefined);
```

**Step 3: Add race mode D3 effect**

Add a new `useEffect` that handles race mode rendering. When `isRaceMode` is true:

1. On each frame call, update the data source to `raceFrames[idx].points`
2. Use D3 data join with key `d => d.id` so dots transition position
3. Animate `.attr('cx', ...)` and `.attr('cy', ...)` with D3 transitions
4. Update regression line and quadrant lines per frame
5. Update axes with animated transitions

The render function should reuse the existing scale/axis setup but feed in frame-specific data instead of `props.data`.

**Step 4: Add playback loop effect**

```typescript
useEffect(() => {
  if (!isPlaying || !isRaceMode || !raceFrames?.length) return;
  timerRef.current = setInterval(() => {
    frameRef.current = (frameRef.current + 1) % raceFrames.length;
    setCurrentFrame(frameRef.current);
    renderFrameRef.current?.(frameRef.current);
    onFrameChangeRef.current?.(frameRef.current, raceFrames[frameRef.current].date);
  }, speed);
  return () => { if (timerRef.current) clearInterval(timerRef.current); };
}, [isPlaying, speed, raceFrames, isRaceMode]);
```

**Step 5: Add PlaybackControls to render**

Import `PlaybackControls` and render below the SVG:

```tsx
{isRaceMode && raceFrames && (
  <PlaybackControls
    frameCount={raceFrames.length}
    currentFrame={currentFrame}
    currentDate={currentDate}
    isPlaying={isPlaying}
    speed={speed}
    onTogglePlay={() => setIsPlaying(p => !p)}
    onSeek={(idx) => { frameRef.current = idx; setCurrentFrame(idx); renderFrameRef.current?.(idx); }}
    onSpeedChange={setSpeed}
  />
)}
```

**Step 6: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 7: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/ScatterPlot.tsx
git commit -m "feat: add race mode to ScatterPlot for Gapminder-style time animation"
```

---

### Task 13: Add Race Mode to RadarChart

**Files:**
- Modify: `packages/frontend/lib/visualizations/d3/RadarChart.tsx`

**Step 1: Add race mode props**

Add to the `RadarChartProps` interface:

```typescript
/** Race mode frames — if provided, enables time animation */
raceFrames?: { date: string; datasets: RadarDataSet[] }[];
/** Auto-play on mount (default false) */
autoPlay?: boolean;
/** Ms per frame (default 800) */
playbackSpeed?: number;
/** Called when frame changes */
onFrameChange?: (frameIndex: number, date: string) => void;
```

**Step 2: Add race mode state and playback logic**

Same pattern as ScatterPlot (Step 2 from Task 12).

**Step 3: Add race mode D3 effect**

On each frame:
1. Update dataset values from `raceFrames[idx].datasets`
2. Recompute polygon paths from new values
3. Animate polygon paths with D3 path interpolation (`attrTween('d', ...)`)
4. Animate vertex dot positions
5. Update `currentDate` for display

Key D3 pattern for polygon morphing:
```typescript
polygon.transition()
  .duration(speed * 0.8)
  .attrTween('d', function() {
    const previous = d3.select(this).attr('d');
    const next = computePath(newValues);
    return d3.interpolatePath(previous, next);
  });
```

Note: `d3.interpolatePath` may need the `d3-interpolate-path` package. Alternative: use `d3.interpolateString` or manually interpolate vertex coordinates and rebuild the path.

Simpler approach — interpolate vertex coordinates directly:
```typescript
// For each vertex, tween its position
vertices.transition()
  .duration(speed * 0.8)
  .attr('cx', (d, i) => xFromAngle(angles[i], newValues[dimensions[i].key]))
  .attr('cy', (d, i) => yFromAngle(angles[i], newValues[dimensions[i].key]));
```

Then rebuild the polygon path from the new vertex positions after transition.

**Step 4: Add PlaybackControls to render**

Same pattern as ScatterPlot (Step 5 from Task 12).

**Step 5: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 6: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/RadarChart.tsx
git commit -m "feat: add race mode to RadarChart for polygon evolution animation"
```

---

### Task 14: Wire Scatter and Radar Race into GraphsPageV2

**Files:**
- Modify: `packages/frontend/app/graphs/components/GraphsPageV2/GraphsPageV2.tsx`

**Step 1: Import new hooks**

```typescript
import { useScatterRaceData } from '../../hooks/useScatterRaceData';
import { useRadarRaceData } from '../../hooks/useRadarRaceData';
```

**Step 2: Add scatter race hook call**

After the existing `scatterData` hook call (~line 308), add:

```typescript
const scatterRaceData = useScatterRaceData(
  scatterXMetric,
  scatterYMetric,
  geoLevel,
  markets[0] || null,
  scope,
  chartType === 'scatter' && raceMode,
);
```

**Step 3: Add radar race hook call**

After the existing `radarData` hook call (~line 336), add:

```typescript
const RADAR_RACE_COLORS = ['#0891b2', '#3b82f6', '#ea580c'];

const radarRaceData = useRadarRaceData(
  radarData.dimensions,
  geoLevel,
  radarMarkets,
  RADAR_RACE_COLORS,
  chartType === 'radar' && raceMode,
);
```

**Step 4: Pass race frames to ScatterPlot**

Update the ScatterPlot render section to pass race props when `raceMode` is on:

```tsx
<ScatterPlot
  data={scatterData.data}
  xLabel={xLabel}
  yLabel={yLabel}
  xFormat={xFormat}
  yFormat={yFormat}
  xScaleType={scatterXScaleType}
  yScaleType={scatterYScaleType}
  showRegression={showRegression}
  showQuadrants={showQuadrants}
  colorByCategory={false}
  sizeByValue
  raceFrames={raceMode ? scatterRaceData.frames : undefined}
  autoPlay={raceMode}
  onPointClick={(point) => {
    selectMarket({
      id: point.id,
      name: point.label,
      type: geoLevel as 'metro' | 'county' | 'zip',
      score: null,
    });
  }}
/>
```

Also update the loading check for scatter to include race data loading:
```typescript
{(raceMode ? scatterRaceData.isLoading : scatterData.isLoading) ? (
  <LoadingSpinner label={raceMode ? 'Building scatter animation...' : 'Loading scatter data...'} />
) : ...
```

**Step 5: Pass race frames to RadarChart**

Update the RadarChart render section:

```tsx
<RadarChart
  datasets={radarData.datasets}
  dimensions={radarData.dimensions}
  raceFrames={raceMode ? radarRaceData.frames : undefined}
  autoPlay={raceMode}
/>
```

Also update loading check:
```typescript
{(raceMode ? radarRaceData.isLoading : radarData.isLoading) ? (
  <LoadingSpinner label={raceMode ? 'Building radar animation...' : 'Building radar profile...'} />
) : ...
```

**Step 6: Verify build**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`

**Step 7: Commit**

```bash
git add packages/frontend/app/graphs/components/GraphsPageV2/GraphsPageV2.tsx
git commit -m "feat: wire scatter and radar race data into GraphsPageV2"
```

---

### Task 15: Final Build Verification and Visual Test

**Step 1: Full TypeScript check**

Run: `npx tsc --noEmit --project packages/frontend/tsconfig.json`
Expected: Clean build, no errors.

**Step 2: Start dev server**

Run: `npm run dev` (frontend on port 3000)

**Step 3: Visual verification checklist**

Open http://localhost:3000/graphs and verify:

1. **Timeline chart**: Primary line is teal, comparison is blue, baseline is orange
2. **Scatter chart**: Dots colored by quartile (teal/blue/amber/coral), not all purple
3. **Waterfall chart**: Positive green, negative red, total bar indigo (not purple)
4. **Radar chart**: First dataset teal, second blue, third orange
5. **Bar chart**: Gradient from teal→indigo across ranks, user's market amber
6. **Bar race**: Toggle "Animate" in sidebar → race starts with dynamic top N, playback controls visible
7. **Scatter race**: Toggle "Animate" → dots move through space over time, playback controls visible
8. **Radar race**: Toggle "Animate" → polygons morph over time, playback controls visible
9. **Animate toggle**: Visible in sidebar for bar, scatter, radar chart types. Hidden for timeseries and waterfall.

**Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete race mode for bar/scatter/radar + color palette refresh"
```
