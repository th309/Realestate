# Time-Animated Charts + Color Refresh Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add race/animation-over-time mode to bar, scatter, and radar charts with geo-aware peer selection, and refresh the chart color palette from monotone purple to teal-blue primary with warm accents.

**Architecture:** Rewrite `useBarRaceData` with geo-aware peer selection and dynamic top N per frame. Add new `useScatterRaceData` and `useRadarRaceData` hooks. Extract shared `PlaybackControls` React component. Update `CHART_COLORS` in scales.ts and propagate to all chart components.

**Tech Stack:** D3.js v7.9, React Query, TypeScript, Tailwind CSS

---

## 1. Race Mode — Geo-Aware Peer Selection

### Strategy by Geography Level

| Geo Level | Pool Source | Selection Method | Scope Selector |
|---|---|---|---|
| **Metro** | All metros in scope (state/region/national) | Dynamic top N per frame | Respects existing scope selector |
| **County** | All counties in same state | Dynamic top N per frame | Scope locked to state |
| **ZIP** | Cascade: metro → county → state | Rank neighbors (N nearest by value) | Auto-detected from ZIP |

### ZIP Cascade Logic

1. If ZIP belongs to a metro → use all ZIPs in that metro as pool
2. Else if ZIP has a county → use all ZIPs in that county
3. Else → use all ZIPs in the state

### Pinning

User's selected market is **always pinned** — highlighted and visible even when it drops out of the top N in a given frame.

### Data Fetching

- Fetch snapshot to rank all markets in the pool
- Fetch time series for a **3×N wider pool** (e.g., top 75 for count=25)
- At each frame, rank from available data, show top N + pinned market
- React Query caches with 10-min stale time (repeat activations are instant)
- Supabase cost is negligible (~$0.001 per activation); latency is the constraint
- State scope: <1s. Region: ~2s. National: ~5s.

---

## 2. Per-Chart Animation

### Bar Race — Rankings animate over time

- Each frame: top N markets by value, bars reorder with D3 transitions
- Markets enter/exit as they rise/fall in rank (D3 data join enter/exit)
- Pinned market always visible with highlight color
- Value labels use `d3.interpolateNumber` tween for smooth counting

### Scatter Race — Gapminder-style dots moving through X/Y space

- Each frame: all markets positioned at (xMetric, yMetric) for that month
- Dots glide to new positions with D3 transitions
- Size/color stays consistent per market (quartile-based coloring)
- Regression line and quadrant lines update per frame
- Requires time series for BOTH X and Y metrics per market

### Radar Evolution — Polygons morph over time

- Each frame: polygon vertices reflect dimension values for that month
- Polygon smoothly morphs shape via D3 path interpolation
- Up to 3 markets animate simultaneously
- Requires time series for each radar dimension per market

---

## 3. Shared PlaybackControls Component

New file: `lib/visualizations/d3/PlaybackControls.tsx`

Extracted React component used by all three charts:

```typescript
interface PlaybackControlsProps {
  frameCount: number;
  currentFrame: number;
  currentDate: string;
  isPlaying: boolean;
  speed: number;
  onTogglePlay: () => void;
  onSeek: (frameIndex: number) => void;
  onSpeedChange: (speed: number) => void;
}
```

Contains: Play/Pause button, speed selector (0.5×/1×/2×/4×), date label, range scrubber.

---

## 4. Data Hooks

| Hook | Source | Fetches | Used By |
|---|---|---|---|
| `useBarRaceData` (rewrite) | Snapshot + time series | 3×N markets, geo-aware selection | HorizontalBarChart |
| `useScatterRaceData` (new) | Time series × 2 metrics | X + Y time series for all scope markets | ScatterPlot |
| `useRadarRaceData` (new) | Time series × dimensions | Per-dimension time series for selected markets | RadarChart |

All hooks return `frames: { date: string; ... }[]` and use React Query caching.

### Frame Format

**Bar:** `{ date: string; entries: BarEntry[] }` — entries sorted by value per frame

**Scatter:** `{ date: string; points: ScatterPoint[] }` — each point has x, y, id, label

**Radar:** `{ date: string; datasets: RadarDataset[] }` — each dataset has values per dimension

---

## 5. State Changes

- Rename `barRaceMode` → `raceMode: boolean` in `useGraphsState`
- Single "Animate" toggle in sidebar, applies to active chart type
- URL sync: `?race=1`
- Available for chart types: bar, scatter, radar (not timeseries, not waterfall)

---

## 6. Color Palette Refresh

### New Primary Palette

| Role | Old | New | Hex |
|---|---|---|---|
| Data primary | Purple #6750a4 | Teal | #0891b2 |
| User's market highlight | Purple #6750a4 | Amber | #f59e0b |
| Data gradient end | Light purple #c4b5fd | Indigo | #4f46e5 |

### Per-Chart Color Application

**Bar Chart:**
- Non-highlighted bars: gradient from teal (#0891b2) → indigo (#4f46e5) across rank positions
- User's highlighted market: amber (#f59e0b)
- Benchmark line: gray (unchanged)

**Scatter Plot:**
- Dots colored by performance quartile:
  - Q1 (top 25%): Teal #0891b2
  - Q2: Blue #3b82f6
  - Q3: Amber #f59e0b
  - Q4 (bottom 25%): Coral #f97316
- User's market: larger dot + amber stroke + white fill or amber fill

**Radar Chart:**
- Dataset 1: Teal #0891b2 (was purple)
- Dataset 2: Blue #3b82f6 (was cyan)
- Dataset 3: Orange #ea580c (unchanged)

**Waterfall Chart:**
- Positive bars: Green #22c55e (unchanged)
- Negative bars: Red #ef4444 (unchanged)
- Total bar: Indigo #4f46e5 (was purple)

**Timeline Chart:**
- Primary line: Teal #0891b2 (was purple)
- Comparison line: Blue #3b82f6 (was cyan)
- Baseline line: Orange #ea580c (unchanged)

### Updated CHART_COLORS.series Array

```typescript
series: [
  '#0891b2', // Teal (primary)
  '#3b82f6', // Blue
  '#ea580c', // Orange
  '#16a34a', // Green
  '#f59e0b', // Amber
  '#7c3aed', // Violet
  '#0d9488', // Teal-dark
  '#dc2626', // Red
]
```

### What Stays the Same

- Semantic colors: green positive (#16a34a), red negative (#dc2626), gray neutral (#6b7280)
- Surface/text colors (M3 design system tokens)
- Outline/grid colors

---

## 7. Files Touched

### New Files
- `lib/visualizations/d3/PlaybackControls.tsx` — shared playback UI
- `hooks/useScatterRaceData.ts` — scatter time animation data
- `hooks/useRadarRaceData.ts` — radar time animation data

### Rewritten
- `hooks/useBarRaceData.ts` — geo-aware peer selection, dynamic top N per frame

### Modified
- `lib/visualizations/d3/utils/scales.ts` — updated CHART_COLORS palette
- `lib/visualizations/d3/HorizontalBarChart.tsx` — extract playback to shared, rank gradient colors
- `lib/visualizations/d3/ScatterPlot.tsx` — add race mode, quartile coloring
- `lib/visualizations/d3/RadarChart.tsx` — add race mode, updated dataset colors
- `lib/visualizations/d3/WaterfallChart.tsx` — total bar color update
- `app/graphs/components/AnimatedTimeSeriesChart.tsx` — updated line colors
- `app/graphs/hooks/useGraphsState.ts` — rename barRaceMode → raceMode
- `app/graphs/components/Sidebar/Sidebar.tsx` — move toggle to shared section
- `app/graphs/components/GraphsPageV2/GraphsPageV2.tsx` — wire scatter/radar race hooks
