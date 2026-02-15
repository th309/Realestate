# PropertyIQ Graphs Experience — V2 Design

**Date:** 2026-02-14
**Status:** Draft
**Supersedes:** 2026-02-12-graphs-redesign-design.md

---

## Executive Summary

Evolve the existing graphs page into a best-in-class charting experience with 5 purpose-built graph types, context-aware controls, and a 3-tier interaction model (smart defaults → preset templates → full builder). Sharing, saving, and user templates are Pro-gated.

The existing sidebar + chart area layout is preserved. The core change is replacing the current 4 chart tabs (Timeline, Scatter, Heatmap placeholder, Distribution placeholder) with 5 fully implemented, data-optimized chart types.

---

## Audience

Both homebuyers and investors equally. The page must serve trend-watchers ("how is my market doing?") and deal-hunters ("where are the best cap rates?") without forcing users into a persona.

---

## The 5 Chart Types

### 1. Multi-Line Time Series

**Purpose:** Core trend analysis. Show how metrics evolve over time, compare locations, benchmark against averages.

**Data fit:** Nearly every metric has time series data. 10+ years of Zillow data, 20+ years of FRED data, 3–5 years of Realtor data.

**User controls:**
- Up to 3 market lines (each a distinct color)
- Single metric selector
- Time frame: 1Y | 3Y | 5Y | 10Y | Max
- Baseline toggle via scope mini-map (state avg | region avg | national avg as dashed line)

**Rendering:** D3 animated line chart (existing `AnimatedTimeSeriesChart.tsx`). Crosshair tooltip, inline value labels, area fills with gradients.

**Example use case:** "Show me home value trends for Austin, Denver, and Raleigh over 5 years with the national average as a baseline."

---

### 2. Scatter Plot with Quadrants

**Purpose:** Market comparison and opportunity discovery. Plot any two metrics against each other across hundreds of markets. Instantly find "high yield + high growth" opportunities.

**Data fit:** 112 metrics across 900+ metros, counties, and ZIPs. Every cross-metric combination is a potential scatter plot.

**User controls:**
- X metric picker
- Y metric picker
- 1 highlighted market (your selected market, shown as larger dot)
- Scope mini-map with dynamic labels (controls which markets fill the cloud)
- Regression line toggle
- Quadrant toggle (draws crosshairs at median values)

**Rendering:** D3 scatter plot (existing `ScatterPlot.tsx`). Zoom/pan, rich tooltips, click-to-navigate.

**Example use case:** "Show me cap rate vs 5-year growth for all metros in the South. Where does Austin land?"

---

### 3. Waterfall Chart

**Purpose:** Decompose a value into its contributing components. Show what's helping and what's hurting. Tells a story that a single number cannot.

**Data fit:** Multiple decomposition use cases across free and Pro tiers.

**Waterfall presets:**

| Preset | Tier | Description |
|--------|------|-------------|
| **Investment Return** | Free | Gross rent → expenses → NOI → cap rate. Shows why a cap rate is what it is. |
| **Affordability** | Free | Median income → savings rate → years to save → down payment → affordable price vs actual price. |
| **Market Momentum** | Free | Stack YoY changes: home value, inventory, new listings, DOM. Each bar shows whether a factor pushes the market up or drags it down. |
| **Location vs Benchmark** | Free | Start at national/state median, show deltas for each factor to arrive at the location's actual value. |
| **PropertyIQ Score** | Pro | Decompose HomeReady, InvestorEdge, or Market Health score into weighted component contributions. "Your score is 82 — demand adds +12, affordability adds +8, unemployment drags -5." |

**User controls:**
- Single market selector
- Waterfall preset picker (investment, affordability, momentum, benchmark, score)
- Score type selector (HomeReady | InvestorEdge | Market Health) — only visible on Score preset, Pro-gated

**Rendering:** New D3 waterfall component. Bars grow up (positive/green) or down (negative/red) from a running baseline. Connector lines between bars. Final bar shows the total.

**Example use case:** "Why is the cap rate in Phoenix only 4.2%? Show me what's eating into the return."

---

### 4. Radar (Spider) Chart

**Purpose:** Location profiling and side-by-side comparison. See a market's strengths and weaknesses across multiple dimensions at a glance.

**Data fit:** PropertyIQ score components (8 weighted dimensions per score type), or any custom set of metrics normalized to a common scale.

**Radar presets:**

| Preset | Dimensions |
|--------|-----------|
| **Homebuyer Profile** | Affordability, Price Growth, Inventory, Job Growth, Population Growth, Days on Market |
| **Investor Profile** | Cap Rate, Rent Growth, Appreciation, Demand Score, Supply Score, Vacancy Proxy |
| **Market Health** | All 8 Market Health score components |
| **Custom** | User picks 4–8 metrics from catalog |

**User controls:**
- Up to 3 markets overlaid (each a distinct colored polygon)
- Radar preset picker
- Custom metric selector (when Custom is selected)

**Rendering:** New D3 radar component. Concentric grid rings (0–100 percentile scale). Each market is a colored polygon with labeled vertices. Hover highlights one market's polygon.

**Example use case:** "Overlay Austin, Denver, and Nashville on the Investor Profile radar. Which one is strongest overall?"

---

### 5. Horizontal Bar with Benchmark

**Purpose:** Rankings, leaderboards, and relative positioning. "Where does my market rank?" and "What are the top markets for X?"

**Data fit:** National and state percentile rankings for every location. Any metric can be ranked.

**User controls:**
- Single metric selector
- Scope mini-map with dynamic labels (controls which markets appear: state | region | national)
- Display mode: Top 10 | Top 25 | Custom selection
- Sort: descending (default) or ascending
- Benchmark line: national or state median (vertical dashed line)

**Rendering:** New D3 horizontal bar component. Bars sorted by value. User's selected market highlighted in primary color. Vertical dashed line at benchmark value. Hover shows exact value + percentile rank.

**Example use case:** "Show me the top 10 metros in Texas by cap rate, with the national median marked."

---

## 3-Tier Interaction Model

### Tier 1: Smart Defaults

User lands on the page and immediately sees a useful chart based on context:
- If they have a saved/recent market → Time series of home value for that market
- If they arrived from a report → Chart relevant to the report's focus
- New user → Guided prompt to pick a market

Zero configuration needed.

### Tier 2: Preset Templates

Curated starting points the user selects from a template picker:

| Template | Chart Type | Config |
|----------|-----------|--------|
| Market Comparison | Time Series | 3 markets + national baseline, home value, 5Y |
| Investment Scatter | Scatter | Cap rate vs 5yr growth, national scope |
| Score Breakdown | Waterfall | PropertyIQ score decomposition (Pro) |
| Market Profile | Radar | Investor or Homebuyer profile, 1–3 markets |
| Top Markets | Horizontal Bar | Top 10 by selected metric, state scope |
| Affordability Breakdown | Waterfall | Affordability decomposition |
| Momentum Dashboard | Waterfall | Market momentum YoY changes |

User picks a template → chart and controls pre-configure → user can then swap metrics, locations, date ranges.

### Tier 3: Full Builder

Power users can configure everything from scratch:
- Pick chart type
- Pick all axes, metrics, locations, scopes, toggles
- No guardrails — any valid combination is allowed

---

## Context-Aware Controls

The sidebar controls morph based on the active chart type. The user never sees irrelevant options.

### Control Matrix

| Control | Time Series | Scatter | Waterfall | Radar | Horiz. Bar |
|---------|:-----------:|:-------:|:---------:|:-----:|:----------:|
| Market slots | Up to 3 | 1 (highlighted) | 1 | Up to 3 | 1 (highlighted) |
| Scope mini-map | Baseline mode | Cloud filter mode | Hidden | Hidden | Ranking filter mode |
| Metric picker | Single | X + Y | Hidden (preset-driven) | Preset or custom multi | Single |
| Time frame | 1Y/3Y/5Y/10Y/Max | Hidden | Hidden | Hidden | Hidden |
| Waterfall preset | Hidden | Hidden | Visible | Hidden | Hidden |
| Radar preset | Hidden | Hidden | Hidden | Visible | Hidden |
| Regression toggle | Hidden | Visible | Hidden | Hidden | Hidden |
| Quadrant toggle | Hidden | Visible | Hidden | Hidden | Hidden |
| Sort order | Hidden | Hidden | Hidden | Hidden | Asc/Desc |
| Display count | Hidden | Hidden | Hidden | Hidden | Top 10/25/Custom |

### Market Selection Behavior

- **Time Series:** Up to 3 market search slots. Each adds a colored line.
- **Scatter:** Single market search. That market is highlighted as a larger dot in the cloud. All other dots come from the scope filter.
- **Waterfall:** Single market search. The decomposition is for that market.
- **Radar:** Up to 3 market search slots. Each adds a colored polygon overlay.
- **Horizontal Bar:** Single market search. That market's bar is highlighted in the ranking. Other bars come from scope filter.

---

## Scope Mini-Map

A small US outline map (~120x80px) in the sidebar that visually shows the comparison scope. Replaces the confusing "state / region / national" text labels.

### Behavior

- Displays a highlighted region on the US map corresponding to the active scope
- Below the map: 3 clickable labels with **dynamic names** based on the selected market
- Labels update when the user changes their primary market

### Example (Austin, TX selected)

| Click | Map Highlights | Label |
|-------|---------------|-------|
| First option | Texas | **Texas** |
| Second option | South census region | **South** |
| Third option | Full US | **Nationwide** |

### Example (Denver, CO selected)

| Click | Map Highlights | Label |
|-------|---------------|-------|
| First option | Colorado | **Colorado** |
| Second option | West census region | **West** |
| Third option | Full US | **Nationwide** |

### Per-Chart-Type Role

| Chart Type | Mini-Map Role |
|-----------|---------------|
| Time Series | Selects baseline average (dashed line) |
| Scatter | Filters which data points appear in the cloud |
| Horizontal Bar | Filters which markets appear in the ranking |
| Waterfall | Hidden |
| Radar | Hidden |

---

## Sharing & Templates (Pro-Gated)

### Save Graph

Pro users can save a specific graph instance (fixed chart type, metrics, locations, date range) to their personal library for quick access later.

### Save as Template

Pro users can save a graph **configuration** (chart type, metric selections, layout) as a reusable template. Unlike a saved graph, a template can be applied to **any location** — the metrics and chart type are preserved, but the location is a variable.

User-created templates appear alongside platform templates in the template picker.

### Share via Link

Pro users can generate a shareable URL that encodes the full graph state. Anyone with the link can view the graph (no account required). Free users see an "Upgrade to share" prompt.

### Embed in Report

Pro users can insert any saved graph into a PropertyIQ report. The graph renders live with current data — not a static screenshot.

### URL State

All graph state syncs to URL parameters for deep linking and sharing:

```
/graphs?chart=scatter&xMetric=cap_rate&yMetric=home_value_5yr&scope=region&market=austin-tx
/graphs?chart=timeseries&metric=home_value&tf=5Y&m1=austin-tx&m2=denver-co&m3=raleigh-nc&baseline=national
/graphs?chart=waterfall&preset=investment&market=phoenix-az
```

---

## Technical Approach

### Charting Library

**D3.js** (already installed, v7.9.0) for all custom visualizations. No new library dependencies.

Existing D3 components to reuse:
- `AnimatedTimeSeriesChart.tsx` — Time series (fully working)
- `ScatterPlot.tsx` — Scatter plot (fully working, needs reconnection)

New D3 components to build:
- `WaterfallChart.tsx` — Waterfall with positive/negative bars and connectors
- `RadarChart.tsx` — Spider chart with polygon overlays
- `HorizontalBarChart.tsx` — Ranked bars with benchmark line
- `ScopeMiniMap.tsx` — Small US map with region highlighting

### Data Flow

All data fetching through `@/lib/data` per architecture rules:

```
useGraphsState (URL-synced state)
  ↓
Chart-specific data hooks:
  useTimeSeriesData()     → Time series charts
  useSnapshotData()       → Scatter, Bar (multi-location current values)
  useScatterData()        → Scatter (joins X + Y metrics)
  useScoreData()          → Radar, Waterfall (score components)
  ↓
D3 rendering components (SVG)
```

### State Management

Extend existing `useGraphsState` hook:

```typescript
interface GraphsPageState {
  // Markets
  markets: Market[];               // up to 3 selected markets

  // Chart
  chartType: 'timeseries' | 'scatter' | 'waterfall' | 'radar' | 'bar';

  // Time Series specific
  timeFrame: '1Y' | '3Y' | '5Y' | '10Y' | 'Max';
  activeMetric: string;

  // Scatter specific
  scatterXMetric: string;
  scatterYMetric: string;
  showRegression: boolean;
  showQuadrants: boolean;

  // Waterfall specific
  waterfallPreset: 'investment' | 'affordability' | 'momentum' | 'benchmark' | 'score';
  scoreType: 'homeready' | 'investoredge' | 'market_health';

  // Radar specific
  radarPreset: 'homebuyer' | 'investor' | 'market_health' | 'custom';
  radarMetrics: string[];          // for custom mode

  // Bar specific
  barMetric: string;
  barSort: 'asc' | 'desc';
  barCount: 10 | 25 | 'custom';

  // Shared
  scope: 'state' | 'region' | 'national';

  // User
  userType: 'homebuyer' | 'investor';
}
```

### Component Structure

```
app/graphs/
├── page.tsx                          # Entry point (existing)
├── components/
│   ├── GraphsPageV2/
│   │   └── GraphsPageV2.tsx          # Main layout (existing, evolve)
│   ├── Sidebar/
│   │   ├── Sidebar.tsx               # Context-aware sidebar container
│   │   ├── MarketSlots.tsx           # 1–3 market search inputs
│   │   ├── ScopeMiniMap.tsx          # US map with region highlighting
│   │   ├── ChartTypePills.tsx        # 5 chart type selector (existing, extend)
│   │   ├── MetricPicker.tsx          # Single or X/Y metric selector (existing)
│   │   ├── TimeFrameButtons.tsx      # 1Y/3Y/5Y/10Y/Max (existing)
│   │   ├── WaterfallPresets.tsx      # Waterfall preset picker
│   │   ├── RadarPresets.tsx          # Radar preset picker
│   │   └── BarControls.tsx           # Sort + count controls
│   ├── Charts/
│   │   ├── TimeSeriesChart.tsx       # Wrapper around AnimatedTimeSeriesChart
│   │   ├── ScatterChart.tsx          # Wrapper around ScatterPlot
│   │   ├── WaterfallChart.tsx        # New D3 waterfall
│   │   ├── RadarChart.tsx            # New D3 radar
│   │   └── HorizontalBarChart.tsx    # New D3 horizontal bar
│   ├── Templates/
│   │   ├── TemplatePicker.tsx        # Platform + user templates
│   │   └── SaveTemplateModal.tsx     # Save as template (Pro)
│   └── Sharing/
│       ├── ShareButton.tsx           # Share via link (Pro)
│       └── SaveGraphButton.tsx       # Save to library (Pro)
├── hooks/
│   ├── useGraphsState.ts            # URL-synced state (existing, extend)
│   ├── useScatterData.ts            # Scatter data hook (existing, uncommitted)
│   ├── useWaterfallData.ts          # Waterfall decomposition data
│   ├── useRadarData.ts              # Radar profile data
│   └── useBarRankingData.ts         # Ranked bar data
└── constants/
    ├── templates.ts                  # Platform template definitions
    ├── radarProfiles.ts              # Radar dimension presets
    └── waterfallConfigs.ts           # Waterfall decomposition configs
```

---

## Existing Layout Preserved

The current GraphsPageV2 layout is kept:
- **Desktop:** Left sidebar (200px) + main chart area (16:9 aspect ratio)
- **Mobile:** Full-width chart + bottom controls
- **Header:** Market search bar with market selection
- **Transitions:** Framer Motion `AnimatePresence` between chart types

What changes:
- Sidebar controls become context-aware (morph per chart type)
- 4 chart tabs → 5 chart tabs
- "Coming soon" placeholders → fully implemented charts
- Scope selector → mini-map with dynamic labels
- Market comparison → flexible 1–3 market slots
- New: Template picker, save/share buttons (Pro)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| All 5 chart types functional | 100% |
| Chart type switch < 300ms | Performance |
| Data load < 1s per chart | Performance |
| Pro conversion from graphs page | 5%+ |
| Template reuse rate (Pro users) | 30%+ |
| Share link generation (Pro users) | 20%+ |
