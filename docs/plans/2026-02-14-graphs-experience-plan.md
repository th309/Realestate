# Graphs Experience V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve the graphs page to 5 chart types with context-aware controls, scope mini-map, and Pro-gated save/share/templates.

**Architecture:** Extend existing GraphsPageV2 layout (sidebar + chart area). Build 3 new D3 components (Waterfall, Radar, HorizontalBar). Add context-aware sidebar that morphs controls per chart type. Scope mini-map replaces text labels. All data through `@/lib/data`.

**Tech Stack:** D3.js v7.9.0, React 19.2, Next.js 16.1, Framer Motion, TanStack React Query, TypeScript.

**Design Doc:** `docs/plans/2026-02-14-graphs-experience-design.md`

---

## Dependency Graph

```
Task 1 (State) ──┐
Task 2 (Pills)  ─┤
                  ├──► Task 11 (Sidebar) ──► Task 12 (Integration) ──► Task 13 (Templates) ──► Task 14 (Save/Share)
Task 3 (Waterfall D3) ─┐                         ▲
Task 4 (Radar D3) ─────┤                         │
Task 5 (Bar D3) ───────┤                         │
Task 6 (Waterfall Hook)┤                         │
Task 7 (Radar Hook) ───┤─────────────────────────┘
Task 8 (Bar Hook) ─────┤
Task 9 (MiniMap) ──────┤
Task 10 (MarketSlots) ─┘
```

**Parallelizable groups:**
- Group A (Foundation): Tasks 1, 2
- Group B (D3 Components): Tasks 3, 4, 5 — all independent
- Group C (Data Hooks): Tasks 6, 7, 8 — all independent
- Group D (UI Components): Tasks 9, 10 — independent
- Group E (Integration): Tasks 11, 12 — sequential, depends on A-D
- Group F (Features): Tasks 13, 14 — sequential, depends on E

---

## Task 1: Extend useGraphsState for 5 Chart Types

**Files:**
- Modify: `packages/frontend/app/graphs/hooks/useGraphsState.ts`
- Modify: `packages/frontend/app/graphs/types.ts`

**Step 1: Update types**

In `packages/frontend/app/graphs/hooks/useGraphsState.ts`, replace the type definitions (lines 7-15):

```typescript
// Chart types
export type ChartType = 'timeseries' | 'scatter' | 'waterfall' | 'radar' | 'bar';
export type TimeFrame = '1Y' | '3Y' | '5Y' | '10Y' | 'Max';
export type UserType = 'homebuyer' | 'investor';
export type BaselineType = 'none' | 'state' | 'national';
export type ScatterScope = 'state' | 'region' | 'national';
export type WaterfallPreset = 'investment' | 'affordability' | 'momentum' | 'benchmark' | 'score';
export type RadarPreset = 'homebuyer' | 'investor' | 'market_health' | 'custom';
export type BarSort = 'asc' | 'desc';
export type BarCount = 10 | 25;
export type ScoreType = 'homeready' | 'investoredge' | 'markethealth';
```

**Step 2: Extend GraphsState interface**

Replace `GraphsState` interface (lines 17-27):

```typescript
export interface GraphsState {
  // Markets — up to 3
  markets: MyMarket[];

  // Chart type
  chartType: ChartType;

  // Time Series
  timeFrame: TimeFrame;
  activeMetric: string;

  // Scatter
  scatterXMetric: string;
  scatterYMetric: string;
  showRegression: boolean;
  showQuadrants: boolean;

  // Waterfall
  waterfallPreset: WaterfallPreset;
  scoreType: ScoreType;

  // Radar
  radarPreset: RadarPreset;
  radarMetrics: string[];

  // Bar
  barMetric: string;
  barSort: BarSort;
  barCount: BarCount;

  // Shared
  scope: ScatterScope;
  userType: UserType;
}
```

**Step 3: Update DEFAULT_STATE**

Replace defaults (lines 44-54):

```typescript
const DEFAULT_STATE: GraphsState = {
  markets: [],
  chartType: 'timeseries',
  timeFrame: '5Y',
  activeMetric: 'home_value',
  scatterXMetric: 'cap_rate',
  scatterYMetric: 'home_value_5yr',
  showRegression: true,
  showQuadrants: true,
  waterfallPreset: 'investment',
  scoreType: 'homeready',
  radarPreset: 'homebuyer',
  radarMetrics: [],
  barMetric: 'home_value',
  barSort: 'desc',
  barCount: 10,
  scope: 'state',
  userType: 'homebuyer',
};
```

**Step 4: Add setters for all new state fields**

Add setters for: `setMarkets`, `addMarket`, `removeMarket`, `setWaterfallPreset`, `setScoreType`, `setRadarPreset`, `setRadarMetrics`, `setBarMetric`, `setBarSort`, `setBarCount`, `setScope`, `setShowRegression`, `setShowQuadrants`.

Keep backward-compat aliases: `primaryMarket` → `markets[0]`, `comparisonMarket` → `markets[1]`.

**Step 5: Update URL sync**

Add new URL params: `wf` (waterfall preset), `st` (score type), `rp` (radar preset), `bm` (bar metric), `bs` (bar sort), `bc` (bar count), `scope`, `xm` (scatter x metric), `ym` (scatter y metric).

**Step 6: Commit**

```bash
git add packages/frontend/app/graphs/hooks/useGraphsState.ts
git commit -m "feat(graphs): extend state hook for 5 chart types"
```

---

## Task 2: Update ChartTypePills for 5 Types

**Files:**
- Modify: `packages/frontend/app/graphs/components/ChartTypePills.tsx`

**Step 1: Update CHART_TYPES array**

Replace the chart types array (lines 14-19):

```typescript
import { TrendingUp, ScatterChart, BarChart3, Radar, AlignLeft } from 'lucide-react';

const CHART_TYPES: { type: ChartType; icon: React.ElementType; label: string }[] = [
  { type: 'timeseries', icon: TrendingUp, label: 'Timeline' },
  { type: 'scatter', icon: ScatterChart, label: 'Scatter' },
  { type: 'waterfall', icon: BarChart3, label: 'Waterfall' },
  { type: 'radar', icon: Radar, label: 'Radar' },
  { type: 'bar', icon: AlignLeft, label: 'Rankings' },
];
```

**Step 2: Update ChartType import**

Ensure ChartType import comes from the updated useGraphsState.

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/components/ChartTypePills.tsx
git commit -m "feat(graphs): add 5 chart type pills"
```

---

## Task 3: Build WaterfallChart D3 Component

**Files:**
- Create: `packages/frontend/lib/visualizations/d3/WaterfallChart.tsx`

**Step 1: Define the component interface**

```typescript
export interface WaterfallBar {
  label: string;
  value: number;          // contribution amount (positive or negative)
  rawValue?: number;      // original metric value for tooltip
  formattedRaw?: string;  // formatted original value
  category?: string;      // grouping label
}

export interface WaterfallChartProps {
  bars: WaterfallBar[];
  totalLabel?: string;        // label for the total bar (default: "Total")
  totalValue?: number;        // override total (otherwise sum of bars)
  height?: number;
  className?: string;
  formatValue?: (v: number) => string;
  title?: string;
}
```

**Step 2: Implement the D3 waterfall**

Build a React component using D3 scales + JSX SVG (same pattern as ScatterPlot.tsx):

- **Layout:** Horizontal bars, sorted by absolute contribution (largest first)
- **Color:** Green (`#22c55e`) for positive contributions, red (`#ef4444`) for negative
- **Connector lines:** Gray dashed lines connecting the end of one bar to the start of the next
- **Running total bar:** Final bar in primary color (`#6750a4`) showing the total
- **Tooltips:** On hover, show label, contribution value, raw metric value
- **Responsive:** Use `useRef` + `ResizeObserver` for container width
- **Margins:** `{ top: 32, right: 80, bottom: 40, left: 160 }` (left margin for labels)

Key D3 usage:
- `d3.scaleLinear()` for x-axis (value scale)
- `d3.scaleBand()` for y-axis (bar positions)
- Bars render with running cumulative baseline

**Step 3: Export from index**

Add to `packages/frontend/lib/visualizations/d3/index.ts`:

```typescript
export { WaterfallChart } from './WaterfallChart';
export type { WaterfallBar, WaterfallChartProps } from './WaterfallChart';
```

**Step 4: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/WaterfallChart.tsx packages/frontend/lib/visualizations/d3/index.ts
git commit -m "feat(graphs): add D3 waterfall chart component"
```

---

## Task 4: Build RadarChart D3 Component

**Files:**
- Create: `packages/frontend/lib/visualizations/d3/RadarChart.tsx`

**Step 1: Define the component interface**

```typescript
export interface RadarDataSet {
  label: string;
  color: string;
  values: Record<string, number>;  // dimension key → 0-100 percentile value
}

export interface RadarDimension {
  key: string;
  label: string;
  description?: string;
}

export interface RadarChartProps {
  datasets: RadarDataSet[];        // 1-3 overlaid datasets
  dimensions: RadarDimension[];    // 4-8 axes
  height?: number;
  className?: string;
  showLabels?: boolean;
  showValues?: boolean;
}
```

**Step 2: Implement the D3 radar**

Build using D3 math + JSX SVG:

- **Grid:** 5 concentric rings at 20, 40, 60, 80, 100 (light gray strokes)
- **Axes:** Lines from center to each dimension vertex. Labels at vertices.
- **Polygons:** Each dataset is a colored polygon with 0.2 fill opacity and 2px stroke
- **Points:** Small circles at each vertex value
- **Hover:** Highlight one dataset's polygon on hover, dim others
- **Tooltips:** On dimension label hover, show all datasets' values for that dimension
- **Responsive:** Container-width based
- **Colors:** Use array: `['#6750a4', '#0891b2', '#ea580c']` for up to 3 datasets

Key D3 usage:
- Angle calculation: `(2 * Math.PI * i) / dimensions.length`
- Point positioning: `x = cx + r * Math.sin(angle)`, `y = cy - r * Math.cos(angle)`
- `d3.lineRadial()` for polygon paths

**Step 3: Export from index**

Add to `packages/frontend/lib/visualizations/d3/index.ts`:

```typescript
export { RadarChart } from './RadarChart';
export type { RadarDataSet, RadarDimension, RadarChartProps } from './RadarChart';
```

**Step 4: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/RadarChart.tsx packages/frontend/lib/visualizations/d3/index.ts
git commit -m "feat(graphs): add D3 radar chart component"
```

---

## Task 5: Build HorizontalBarChart D3 Component

**Files:**
- Create: `packages/frontend/lib/visualizations/d3/HorizontalBarChart.tsx`

**Step 1: Define the component interface**

```typescript
export interface BarEntry {
  id: string;
  label: string;
  value: number;
  highlighted?: boolean;  // user's selected market
}

export interface HorizontalBarChartProps {
  data: BarEntry[];
  benchmarkValue?: number;       // vertical dashed line
  benchmarkLabel?: string;
  formatValue?: (v: number) => string;
  height?: number;
  className?: string;
  onBarClick?: (entry: BarEntry) => void;
  highlightColor?: string;       // default: '#6750a4'
  barColor?: string;             // default: '#c4b5fd'
}
```

**Step 2: Implement the D3 horizontal bar chart**

Build using D3 scales + JSX SVG:

- **Layout:** Horizontal bars, sorted by value (desc or asc per data order)
- **Highlight:** User's market bar in `highlightColor`, all others in `barColor`
- **Benchmark line:** Vertical dashed line at `benchmarkValue` with label
- **Labels:** Market name on the left, formatted value on the right of each bar
- **Hover:** Tooltip with exact value + percentile rank if available
- **Click:** `onBarClick` handler for navigation
- **Responsive:** Container-width based
- **Margins:** `{ top: 24, right: 80, bottom: 40, left: 160 }`

Key D3 usage:
- `d3.scaleLinear()` for x-axis
- `d3.scaleBand()` for y-axis with padding 0.2
- Bars with rounded right corners (rx: 4)

**Step 3: Export from index**

Add to `packages/frontend/lib/visualizations/d3/index.ts`:

```typescript
export { HorizontalBarChart } from './HorizontalBarChart';
export type { BarEntry, HorizontalBarChartProps } from './HorizontalBarChart';
```

**Step 4: Commit**

```bash
git add packages/frontend/lib/visualizations/d3/HorizontalBarChart.tsx packages/frontend/lib/visualizations/d3/index.ts
git commit -m "feat(graphs): add D3 horizontal bar chart component"
```

---

## Task 6: Build useWaterfallData Hook

**Files:**
- Create: `packages/frontend/app/graphs/hooks/useWaterfallData.ts`
- Create: `packages/frontend/app/graphs/constants/waterfallConfigs.ts`

**Step 1: Create waterfall preset configurations**

In `packages/frontend/app/graphs/constants/waterfallConfigs.ts`:

```typescript
import type { WaterfallPreset } from '../hooks/useGraphsState';
import type { MetricFormat } from '@/lib/data';

export interface WaterfallStepConfig {
  metricId: string;
  label: string;
  operation: 'add' | 'subtract';  // how it contributes
  format: MetricFormat;
}

export interface WaterfallPresetConfig {
  id: WaterfallPreset;
  title: string;
  description: string;
  steps: WaterfallStepConfig[];
  totalLabel: string;
  proOnly: boolean;
}

export const WATERFALL_PRESETS: Record<WaterfallPreset, WaterfallPresetConfig> = {
  investment: {
    id: 'investment',
    title: 'Investment Return Breakdown',
    description: 'See what drives the cap rate in this market',
    totalLabel: 'Cap Rate',
    proOnly: false,
    steps: [
      { metricId: 'rent_index', label: 'Annual Rent (ZORI×12)', operation: 'add', format: 'currency' },
      { metricId: '_expenses', label: 'Est. Expenses (40%)', operation: 'subtract', format: 'currency' },
      { metricId: '_noi', label: 'Net Operating Income', operation: 'add', format: 'currency' },
      { metricId: 'home_value', label: '÷ Home Value', operation: 'subtract', format: 'currency' },
    ],
  },
  affordability: {
    id: 'affordability',
    title: 'Affordability Breakdown',
    description: 'What it takes to buy in this market',
    totalLabel: 'Gap to Affordable',
    proOnly: false,
    steps: [
      { metricId: 'median_income', label: 'Median Income', operation: 'add', format: 'currency' },
      { metricId: '_annual_savings', label: 'Saveable (10%/yr)', operation: 'add', format: 'currency' },
      { metricId: 'years_to_save', label: 'Years to Save 20% Down', operation: 'add', format: 'number' },
      { metricId: 'affordable_home_price', label: 'Affordable Price (3.5× Income)', operation: 'add', format: 'currency' },
      { metricId: 'home_value', label: 'Actual Median Price', operation: 'subtract', format: 'currency' },
    ],
  },
  momentum: {
    id: 'momentum',
    title: 'Market Momentum',
    description: 'What is pushing or dragging this market',
    totalLabel: 'Net Momentum',
    proOnly: false,
    steps: [
      { metricId: 'home_value_yoy', label: 'Home Value YoY', operation: 'add', format: 'percent' },
      { metricId: 'inventory_yoy', label: 'Inventory YoY', operation: 'add', format: 'percent' },
      { metricId: 'new_listings_yoy', label: 'New Listings YoY', operation: 'add', format: 'percent' },
      { metricId: 'home_sales_yoy', label: 'Home Sales YoY', operation: 'add', format: 'percent' },
      { metricId: 'population_growth', label: 'Population Growth', operation: 'add', format: 'percent' },
      { metricId: 'job_growth', label: 'Job Growth', operation: 'add', format: 'percent' },
    ],
  },
  benchmark: {
    id: 'benchmark',
    title: 'Location vs National Average',
    description: 'How this market compares to the national baseline',
    totalLabel: 'Net Difference',
    proOnly: false,
    steps: [
      { metricId: 'home_value', label: 'Home Value vs National', operation: 'add', format: 'currency' },
      { metricId: 'rent_index', label: 'Rent vs National', operation: 'add', format: 'currency' },
      { metricId: 'cap_rate', label: 'Cap Rate vs National', operation: 'add', format: 'percent_abs' },
      { metricId: 'days_on_market', label: 'DOM vs National', operation: 'add', format: 'days' },
      { metricId: 'population_growth', label: 'Pop Growth vs National', operation: 'add', format: 'percent' },
    ],
  },
  score: {
    id: 'score',
    title: 'PropertyIQ Score Breakdown',
    description: 'What contributes to this score',
    totalLabel: 'Final Score',
    proOnly: true,
    steps: [], // Dynamically populated from score z_scores + formula weights
  },
};
```

**Step 2: Create the useWaterfallData hook**

In `packages/frontend/app/graphs/hooks/useWaterfallData.ts`:

```typescript
import { useSnapshotData, useScoreData, formatMetricValue, getMetricFormat } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';
import type { WaterfallPreset, ScoreType } from './useGraphsState';
import type { WaterfallBar } from '@/lib/visualizations/d3/WaterfallChart';
import { WATERFALL_PRESETS } from '../constants/waterfallConfigs';

export interface UseWaterfallDataResult {
  bars: WaterfallBar[];
  title: string;
  totalValue: number;
  totalLabel: string;
  isLoading: boolean;
  error: Error | null;
  proGated: boolean;
}

export function useWaterfallData(
  preset: WaterfallPreset,
  geoLevel: GeoLevel,
  regionId: string | null,
  scoreType?: ScoreType,
): UseWaterfallDataResult {
  // Implementation:
  // 1. For 'score' preset: use useScoreData with expanded=true to get z_scores
  //    Then look up FORMULA_WEIGHTS for the scoreType+geoLevel combo
  //    Build bars: direction × weight × z_score for each metric
  //
  // 2. For 'investment' preset: fetch rent_index + home_value snapshots
  //    Calculate: annual_rent = ZORI × 12
  //    expenses = annual_rent × 0.4
  //    NOI = annual_rent - expenses
  //    cap_rate = NOI / home_value × 100
  //    Build bars showing each step
  //
  // 3. For 'momentum' preset: fetch each YoY metric for the location
  //    Each bar = that metric's YoY change value
  //    Green if positive, red if negative
  //
  // 4. For 'benchmark' preset: fetch each metric for location AND national
  //    Each bar = location_value - national_value
  //
  // 5. For 'affordability': fetch median_income, home_value, years_to_save, affordable_home_price
  //    Build step-by-step affordability waterfall
  //
  // Return { bars, title, totalValue, totalLabel, isLoading, error, proGated }
}
```

The hook fetches data using multiple `useSnapshotData` calls (one per metric in the preset) and transforms into `WaterfallBar[]`.

For the `score` preset, fetch z_scores from the score endpoint. The backend already returns `z_scores: Record<string, number>` in the score response. Import `FORMULA_WEIGHTS` from a frontend-side copy of the weights (or fetch from an API endpoint).

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/hooks/useWaterfallData.ts packages/frontend/app/graphs/constants/waterfallConfigs.ts
git commit -m "feat(graphs): add waterfall data hook and preset configs"
```

---

## Task 7: Build useRadarData Hook

**Files:**
- Create: `packages/frontend/app/graphs/hooks/useRadarData.ts`
- Create: `packages/frontend/app/graphs/constants/radarProfiles.ts`

**Step 1: Create radar profile presets**

In `packages/frontend/app/graphs/constants/radarProfiles.ts`:

```typescript
import type { RadarPreset } from '../hooks/useGraphsState';
import type { RadarDimension } from '@/lib/visualizations/d3/RadarChart';

export interface RadarProfileConfig {
  id: RadarPreset;
  title: string;
  dimensions: (RadarDimension & { metricId: string; invert?: boolean })[];
}

export const RADAR_PROFILES: Record<Exclude<RadarPreset, 'custom'>, RadarProfileConfig> = {
  homebuyer: {
    id: 'homebuyer',
    title: 'Homebuyer Profile',
    dimensions: [
      { key: 'affordability', label: 'Affordability', metricId: 'years_to_save', invert: true },
      { key: 'appreciation', label: 'Price Growth', metricId: 'home_value_5yr' },
      { key: 'inventory', label: 'Inventory', metricId: 'for_sale_inventory' },
      { key: 'jobs', label: 'Job Growth', metricId: 'job_growth' },
      { key: 'population', label: 'Pop. Growth', metricId: 'population_growth' },
      { key: 'dom', label: 'Speed (DOM)', metricId: 'days_on_market', invert: true },
    ],
  },
  investor: {
    id: 'investor',
    title: 'Investor Profile',
    dimensions: [
      { key: 'cap_rate', label: 'Cap Rate', metricId: 'cap_rate' },
      { key: 'rent_growth', label: 'Rent Growth', metricId: 'rent_index' },
      { key: 'appreciation', label: 'Appreciation', metricId: 'home_value_5yr' },
      { key: 'demand', label: 'Demand', metricId: 'demand_score' },
      { key: 'supply', label: 'Supply', metricId: 'supply_score', invert: true },
      { key: 'population', label: 'Pop. Growth', metricId: 'population_growth' },
    ],
  },
  market_health: {
    id: 'market_health',
    title: 'Market Health',
    dimensions: [
      { key: 'dom', label: 'Speed', metricId: 'days_on_market', invert: true },
      { key: 'demand', label: 'Demand', metricId: 'demand_score' },
      { key: 'hotness', label: 'Hotness', metricId: 'hotness_score' },
      { key: 'price_cuts', label: 'Price Stability', metricId: 'price_cut_pct', invert: true },
      { key: 'pending', label: 'Pending Ratio', metricId: 'pending_ratio' },
      { key: 'inventory', label: 'Inventory', metricId: 'for_sale_inventory' },
      { key: 'sales', label: 'Sales Volume', metricId: 'home_sales' },
      { key: 'appreciation', label: 'Appreciation', metricId: 'home_value_yoy' },
    ],
  },
};
```

**Step 2: Create the useRadarData hook**

In `packages/frontend/app/graphs/hooks/useRadarData.ts`:

```typescript
import { useSnapshotData } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';
import type { RadarDataSet, RadarDimension } from '@/lib/visualizations/d3/RadarChart';
import type { RadarPreset } from './useGraphsState';
import type { MyMarket } from '../types';
import { RADAR_PROFILES } from '../constants/radarProfiles';

const COLORS = ['#6750a4', '#0891b2', '#ea580c'];

export interface UseRadarDataResult {
  datasets: RadarDataSet[];
  dimensions: RadarDimension[];
  isLoading: boolean;
  error: Error | null;
}

export function useRadarData(
  preset: RadarPreset,
  geoLevel: GeoLevel,
  markets: MyMarket[],     // up to 3
  customMetrics?: string[], // for 'custom' preset
): UseRadarDataResult {
  // Implementation:
  // 1. Get dimension config from RADAR_PROFILES[preset] (or customMetrics)
  // 2. For each dimension's metricId, call useSnapshotData to get ALL values at that geoLevel
  // 3. For each market, look up its value in the snapshot data
  // 4. Convert raw values to 0-100 percentile rank across all locations
  //    (invert: true means lower raw value = higher percentile)
  // 5. Build RadarDataSet[] — one per market, each with color from COLORS array
  //
  // Return { datasets, dimensions, isLoading, error }
}
```

The key insight: radar values must be normalized to 0-100 percentile scale so all dimensions are comparable. Fetch the full snapshot for each metric, rank the market among all locations, convert to percentile.

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/hooks/useRadarData.ts packages/frontend/app/graphs/constants/radarProfiles.ts
git commit -m "feat(graphs): add radar data hook and profile presets"
```

---

## Task 8: Build useBarRankingData Hook

**Files:**
- Create: `packages/frontend/app/graphs/hooks/useBarRankingData.ts`

**Step 1: Create the hook**

```typescript
import { useSnapshotData, formatMetricValue, getMetricFormat, getMetricTitle } from '@/lib/data';
import type { GeoLevel } from '@/lib/data';
import type { BarEntry } from '@/lib/visualizations/d3/HorizontalBarChart';
import type { ScatterScope, BarSort, BarCount } from './useGraphsState';
import type { MyMarket } from '../types';

export interface UseBarRankingDataResult {
  data: BarEntry[];
  benchmarkValue: number | null;
  benchmarkLabel: string;
  metricTitle: string;
  formatValue: (v: number) => string;
  isLoading: boolean;
  error: Error | null;
}

export function useBarRankingData(
  metricId: string,
  geoLevel: GeoLevel,
  primaryMarket: MyMarket | null,
  scope: ScatterScope,
  sort: BarSort,
  count: BarCount,
): UseBarRankingDataResult {
  // Implementation:
  // 1. useSnapshotData(metricId, geoLevel) to get all data
  // 2. Filter by scope (same state, same region, or national) — reuse logic from useScatterData
  // 3. Sort by value (asc or desc)
  // 4. Slice to top N (count)
  // 5. If primaryMarket is not in top N, append it (so user always sees their market)
  // 6. Mark primaryMarket entry as highlighted: true
  // 7. Calculate benchmark: median value of all locations (before slicing)
  // 8. Return formatted BarEntry[] and benchmark
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/graphs/hooks/useBarRankingData.ts
git commit -m "feat(graphs): add bar ranking data hook"
```

---

## Task 9: Build ScopeMiniMap Component

**Files:**
- Create: `packages/frontend/app/graphs/components/ScopeMiniMap.tsx`
- Create: `packages/frontend/app/graphs/constants/geoRegions.ts`

**Step 1: Create geographic region data**

In `packages/frontend/app/graphs/constants/geoRegions.ts`:

```typescript
// Census region → states mapping
export const CENSUS_REGIONS: Record<string, { label: string; states: string[] }> = {
  northeast: { label: 'Northeast', states: ['CT','ME','MA','NH','RI','VT','NJ','NY','PA'] },
  midwest: { label: 'Midwest', states: ['IL','IN','MI','OH','WI','IA','KS','MN','MO','NE','ND','SD'] },
  south: { label: 'South', states: ['DE','FL','GA','MD','NC','SC','VA','DC','WV','AL','KY','MS','TN','AR','LA','OK','TX'] },
  west: { label: 'West', states: ['AZ','CO','ID','MT','NV','NM','UT','WY','AK','CA','HI','OR','WA'] },
};

export function getRegionForState(stateAbbr: string): string | null {
  for (const [region, { states }] of Object.entries(CENSUS_REGIONS)) {
    if (states.includes(stateAbbr)) return region;
  }
  return null;
}

export function getRegionLabel(stateAbbr: string): string {
  const region = getRegionForState(stateAbbr);
  return region ? CENSUS_REGIONS[region].label : 'Region';
}

// Simplified US state boundary paths for the mini-map SVG
// Each state is a simplified polygon path (low-detail for 120x80 display)
export const STATE_PATHS: Record<string, string> = {
  // Simplified SVG path data for each state
  // These are low-resolution outlines sufficient for a small mini-map
  // Source: Derived from US Census cartographic boundaries, simplified
  // ... (50 state paths + DC)
};
```

Note: For `STATE_PATHS`, use a simplified US state SVG. The component can alternatively use a pre-built SVG of the US imported as a React component, with each state as a `<path>` element that can be individually colored.

**Step 2: Build the ScopeMiniMap component**

In `packages/frontend/app/graphs/components/ScopeMiniMap.tsx`:

```typescript
import type { ScatterScope } from '../hooks/useGraphsState';
import { CENSUS_REGIONS, getRegionForState, getRegionLabel } from '../constants/geoRegions';

interface ScopeMiniMapProps {
  scope: ScatterScope;
  onScopeChange: (scope: ScatterScope) => void;
  primaryState?: string;  // e.g., 'TX'
  className?: string;
}

export function ScopeMiniMap({ scope, onScopeChange, primaryState, className }: ScopeMiniMapProps) {
  // Implementation:
  // 1. Render a small SVG US map (120×80px)
  // 2. Each state is a <path> element
  // 3. Highlight logic:
  //    - scope='state': highlight only primaryState
  //    - scope='region': highlight all states in the same census region
  //    - scope='national': highlight all states
  // 4. Below the map, 3 clickable labels with dynamic text:
  //    - State name (e.g., "Texas")
  //    - Region name (e.g., "South")
  //    - "Nationwide"
  // 5. Active label gets primary color underline
  // 6. Click label → onScopeChange
}
```

Colors:
- Highlighted state: `var(--md-primary)` / `#6750a4`
- Unhighlighted: `var(--md-surface-container)` / `#f3edf7`
- Active label: `var(--md-primary)` with underline
- Inactive label: `var(--md-on-surface-variant)`

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/components/ScopeMiniMap.tsx packages/frontend/app/graphs/constants/geoRegions.ts
git commit -m "feat(graphs): add scope mini-map with dynamic labels"
```

---

## Task 10: Build MarketSlots Component

**Files:**
- Create: `packages/frontend/app/graphs/components/MarketSlots.tsx`

**Step 1: Build multi-market selector**

```typescript
import type { MyMarket } from '../types';

interface MarketSlotsProps {
  markets: MyMarket[];
  maxSlots: number;         // 1 or 3 depending on chart type
  onAdd: (market: MyMarket) => void;
  onRemove: (index: number) => void;
  className?: string;
}

export function MarketSlots({ markets, maxSlots, onAdd, onRemove, className }: MarketSlotsProps) {
  // Implementation:
  // 1. Render filled slots as chips: market name + color dot + X button
  //    Color dots use the same palette as chart lines: ['#6750a4', '#0891b2', '#ea580c']
  // 2. Render empty slots as "+ Add Market" buttons (up to maxSlots)
  // 3. Clicking "+ Add Market" opens the existing MarketSearchBar as a popover/modal
  // 4. On market selected → onAdd(market)
  // 5. On X click → onRemove(index)
  //
  // Reuse existing MarketSearchBar component for search functionality.
  // Wrap each slot in a small card with the market's color indicator.
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/graphs/components/MarketSlots.tsx
git commit -m "feat(graphs): add multi-market slot selector"
```

---

## Task 11: Build Context-Aware Sidebar

**Files:**
- Create: `packages/frontend/app/graphs/components/Sidebar/Sidebar.tsx`

**Step 1: Build the sidebar container**

The sidebar renders different control sets based on `chartType`. It wraps existing and new components.

```typescript
import type { ChartType } from '../../hooks/useGraphsState';
import { ChartTypePills } from '../ChartTypePills';
import { MarketSlots } from '../MarketSlots';
import { ScopeMiniMap } from '../ScopeMiniMap';
import { MetricPicker } from '../MetricPicker';

interface SidebarProps {
  state: GraphsState;
  actions: GraphsStateActions;  // all setters
}

export function Sidebar({ state, actions }: SidebarProps) {
  const maxMarketSlots = ['timeseries', 'radar'].includes(state.chartType) ? 3 : 1;
  const showMiniMap = ['timeseries', 'scatter', 'bar'].includes(state.chartType);
  const showTimeFrame = state.chartType === 'timeseries';
  const showScatterControls = state.chartType === 'scatter';
  const showWaterfallPresets = state.chartType === 'waterfall';
  const showRadarPresets = state.chartType === 'radar';
  const showBarControls = state.chartType === 'bar';

  return (
    <aside className="w-[200px] flex flex-col gap-3 p-3">
      {/* Always visible */}
      <MarketSlots markets={state.markets} maxSlots={maxMarketSlots} ... />
      <ChartTypePills activeType={state.chartType} onChange={actions.setChartType} vertical />

      {/* Context-dependent sections */}
      {showMiniMap && (
        <ScopeMiniMap scope={state.scope} onScopeChange={actions.setScope} primaryState={...} />
      )}

      {/* Time Series controls */}
      {showTimeFrame && (
        <>
          <MetricPicker value={state.activeMetric} onChange={actions.setActiveMetric} />
          <TimeFrameButtons value={state.timeFrame} onChange={actions.setTimeFrame} />
        </>
      )}

      {/* Scatter controls */}
      {showScatterControls && (
        <>
          <MetricPicker label="X Metric" value={state.scatterXMetric} onChange={actions.setScatterXMetric} />
          <MetricPicker label="Y Metric" value={state.scatterYMetric} onChange={actions.setScatterYMetric} />
          <ToggleRow label="Regression" value={state.showRegression} onChange={actions.setShowRegression} />
          <ToggleRow label="Quadrants" value={state.showQuadrants} onChange={actions.setShowQuadrants} />
        </>
      )}

      {/* Waterfall controls */}
      {showWaterfallPresets && <WaterfallPresets value={state.waterfallPreset} onChange={actions.setWaterfallPreset} />}

      {/* Radar controls */}
      {showRadarPresets && <RadarPresets value={state.radarPreset} onChange={actions.setRadarPreset} />}

      {/* Bar controls */}
      {showBarControls && (
        <>
          <MetricPicker value={state.barMetric} onChange={actions.setBarMetric} />
          <SortToggle value={state.barSort} onChange={actions.setBarSort} />
          <CountPicker value={state.barCount} onChange={actions.setBarCount} />
        </>
      )}
    </aside>
  );
}
```

**Step 2: Build small sub-components**

Create within the same file or as tiny siblings:
- `WaterfallPresets` — pill group for waterfall preset selection
- `RadarPresets` — pill group for radar preset selection
- `SortToggle` — asc/desc toggle
- `CountPicker` — 10/25 pill selector
- `ToggleRow` — labeled on/off toggle

**Step 3: Commit**

```bash
git add packages/frontend/app/graphs/components/Sidebar/
git commit -m "feat(graphs): add context-aware sidebar with chart-specific controls"
```

---

## Task 12: Wire Everything into GraphsPageV2

**Files:**
- Modify: `packages/frontend/app/graphs/components/GraphsPageV2/GraphsPageV2.tsx`

This is the main integration task. Replace the current chart rendering section with all 5 chart types.

**Step 1: Update imports**

Add imports for all new components and hooks:
- `WaterfallChart` from `@/lib/visualizations/d3/WaterfallChart`
- `RadarChart` from `@/lib/visualizations/d3/RadarChart`
- `HorizontalBarChart` from `@/lib/visualizations/d3/HorizontalBarChart`
- `useWaterfallData` from hooks
- `useRadarData` from hooks
- `useBarRankingData` from hooks
- `Sidebar` from `../Sidebar/Sidebar`

**Step 2: Replace sidebar section**

Remove the inline sidebar (lines 161-276) and replace with:
```tsx
<Sidebar state={graphsState} actions={graphsActions} />
```

**Step 3: Add data hooks for new chart types**

After existing scatter data hook (line ~140), add:

```typescript
// Waterfall data
const waterfallData = useWaterfallData(
  waterfallPreset, geoLevel, primaryMarketId, scoreType
);

// Radar data
const radarData = useRadarData(
  radarPreset, geoLevel, markets, radarMetrics
);

// Bar ranking data
const barData = useBarRankingData(
  barMetric, geoLevel, markets[0], scope, barSort, barCount
);
```

**Step 4: Replace chart area rendering**

Replace the chart area section (lines 279-397) with an `AnimatePresence` block covering all 5 types:

```tsx
<AnimatePresence mode="wait">
  {chartType === 'timeseries' && (
    <motion.div key="timeseries" ...>
      <AnimatedTimeSeriesChart ... />
    </motion.div>
  )}
  {chartType === 'scatter' && (
    <motion.div key="scatter" ...>
      <ScatterPlot ... />
    </motion.div>
  )}
  {chartType === 'waterfall' && (
    <motion.div key="waterfall" ...>
      <WaterfallChart
        bars={waterfallData.bars}
        totalLabel={waterfallData.totalLabel}
        totalValue={waterfallData.totalValue}
        title={waterfallData.title}
      />
    </motion.div>
  )}
  {chartType === 'radar' && (
    <motion.div key="radar" ...>
      <RadarChart
        datasets={radarData.datasets}
        dimensions={radarData.dimensions}
      />
    </motion.div>
  )}
  {chartType === 'bar' && (
    <motion.div key="bar" ...>
      <HorizontalBarChart
        data={barData.data}
        benchmarkValue={barData.benchmarkValue}
        benchmarkLabel={barData.benchmarkLabel}
        formatValue={barData.formatValue}
      />
    </motion.div>
  )}
</AnimatePresence>
```

**Step 5: Update mobile bottom controls**

Update the mobile controls section (lines 402-430) to show chart-type-appropriate controls on mobile.

**Step 6: Test all 5 chart types render**

Navigate to `http://localhost:3000/graphs` and verify:
- Timeline loads with existing data
- Scatter loads with existing data
- Waterfall shows bars for investment preset
- Radar shows polygon for selected market
- Bar shows ranked horizontal bars

**Step 7: Commit**

```bash
git add packages/frontend/app/graphs/components/GraphsPageV2/GraphsPageV2.tsx
git commit -m "feat(graphs): integrate all 5 chart types into GraphsPageV2"
```

---

## Task 13: Template System

**Files:**
- Create: `packages/frontend/app/graphs/constants/templates.ts`
- Create: `packages/frontend/app/graphs/components/TemplatePicker.tsx`
- Create: `packages/frontend/app/graphs/components/SaveTemplateModal.tsx`

**Step 1: Define platform templates**

In `packages/frontend/app/graphs/constants/templates.ts`:

```typescript
import type { GraphsState } from '../hooks/useGraphsState';

export interface GraphTemplate {
  id: string;
  name: string;
  description: string;
  category: 'platform' | 'user';
  config: Partial<GraphsState>;   // state overrides to apply
  icon?: string;
}

export const PLATFORM_TEMPLATES: GraphTemplate[] = [
  {
    id: 'market-comparison',
    name: 'Market Comparison',
    description: 'Compare up to 3 markets over time',
    category: 'platform',
    config: { chartType: 'timeseries', activeMetric: 'home_value', timeFrame: '5Y', scope: 'national' },
  },
  {
    id: 'investment-scatter',
    name: 'Investment Scatter',
    description: 'Cap rate vs growth across markets',
    category: 'platform',
    config: { chartType: 'scatter', scatterXMetric: 'cap_rate', scatterYMetric: 'home_value_5yr', scope: 'national' },
  },
  {
    id: 'score-breakdown',
    name: 'Score Breakdown',
    description: 'See what drives your PropertyIQ score',
    category: 'platform',
    config: { chartType: 'waterfall', waterfallPreset: 'score', scoreType: 'homeready' },
  },
  {
    id: 'market-profile',
    name: 'Market Profile',
    description: 'Radar view of market strengths',
    category: 'platform',
    config: { chartType: 'radar', radarPreset: 'homebuyer' },
  },
  {
    id: 'top-markets',
    name: 'Top Markets',
    description: 'Ranked markets by any metric',
    category: 'platform',
    config: { chartType: 'bar', barMetric: 'cap_rate', barSort: 'desc', barCount: 10 },
  },
  {
    id: 'affordability-breakdown',
    name: 'Affordability Breakdown',
    description: 'What it takes to buy here',
    category: 'platform',
    config: { chartType: 'waterfall', waterfallPreset: 'affordability' },
  },
  {
    id: 'momentum-check',
    name: 'Momentum Check',
    description: 'What is pushing or dragging this market',
    category: 'platform',
    config: { chartType: 'waterfall', waterfallPreset: 'momentum' },
  },
];
```

**Step 2: Build TemplatePicker component**

Shows platform templates + user-saved templates (Pro). Clicking a template applies its `config` as partial state overrides via `applyTemplate(config)` action in useGraphsState.

**Step 3: Build SaveTemplateModal (Pro-gated)**

Modal with:
- Template name input
- Optional tags
- Saves current `GraphsState` (minus market selections) as a user template
- Stored in user profile / localStorage initially (DB later)

**Step 4: Add `applyTemplate` action to useGraphsState**

```typescript
applyTemplate: (config: Partial<GraphsState>) => void;
// Merges config into current state, preserving market selections
```

**Step 5: Commit**

```bash
git add packages/frontend/app/graphs/constants/templates.ts packages/frontend/app/graphs/components/TemplatePicker.tsx packages/frontend/app/graphs/components/SaveTemplateModal.tsx packages/frontend/app/graphs/hooks/useGraphsState.ts
git commit -m "feat(graphs): add template system with platform presets and user templates"
```

---

## Task 14: Pro-Gated Save & Share

**Files:**
- Create: `packages/frontend/app/graphs/components/ShareButton.tsx`
- Create: `packages/frontend/app/graphs/components/SaveGraphButton.tsx`

**Step 1: Build ShareButton**

```typescript
interface ShareButtonProps {
  graphState: GraphsState;
  isPro: boolean;
}

export function ShareButton({ graphState, isPro }: ShareButtonProps) {
  // If not Pro: render button that opens upgrade modal
  // If Pro: render button that:
  //   1. Encodes graphState into URL params
  //   2. Copies shareable URL to clipboard
  //   3. Shows "Link copied!" toast
}
```

**Step 2: Build SaveGraphButton**

```typescript
interface SaveGraphButtonProps {
  graphState: GraphsState;
  isPro: boolean;
}

export function SaveGraphButton({ graphState, isPro }: SaveGraphButtonProps) {
  // If not Pro: render button that opens upgrade modal
  // If Pro: render dropdown with:
  //   1. "Save Graph" — saves full state (including markets) to user library
  //   2. "Save as Template" — opens SaveTemplateModal (saves config without markets)
}
```

**Step 3: Add buttons to GraphsPageV2 header area**

Place Share and Save buttons in the header bar next to the market search.

**Step 4: Commit**

```bash
git add packages/frontend/app/graphs/components/ShareButton.tsx packages/frontend/app/graphs/components/SaveGraphButton.tsx packages/frontend/app/graphs/components/GraphsPageV2/GraphsPageV2.tsx
git commit -m "feat(graphs): add Pro-gated save and share buttons"
```

---

## Execution Summary

| Task | Description | Depends On | Est. Complexity |
|------|-------------|-----------|-----------------|
| 1 | Extend useGraphsState | — | Medium |
| 2 | Update ChartTypePills | — | Small |
| 3 | WaterfallChart D3 | — | Large |
| 4 | RadarChart D3 | — | Large |
| 5 | HorizontalBarChart D3 | — | Medium |
| 6 | useWaterfallData hook | — | Medium |
| 7 | useRadarData hook | — | Medium |
| 8 | useBarRankingData hook | — | Small |
| 9 | ScopeMiniMap | — | Medium |
| 10 | MarketSlots | — | Small |
| 11 | Context-Aware Sidebar | 1, 2, 9, 10 | Medium |
| 12 | Wire into GraphsPageV2 | All above | Large |
| 13 | Template System | 1, 12 | Medium |
| 14 | Save/Share (Pro) | 12, 13 | Small |
