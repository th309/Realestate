# PropertyIQ UI Enhancement - Implementation Plan

**Version**: 1.0
**Date**: 2026-01-17
**Status**: Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Gap Analysis - Missing Data](#gap-analysis---missing-data)
3. [Change 1: Left Sidebar Restructure](#change-1-left-sidebar-restructure)
4. [Change 2: Map Integration](#change-2-map-integration)
5. [Change 3: Right Detail Panel](#change-3-right-detail-panel)
6. [Backend Changes Required](#backend-changes-required)
7. [Database Verification](#database-verification)
8. [Testing Plan](#testing-plan)
9. [Implementation Order](#implementation-order)
10. [File Change Summary](#file-change-summary)

---

## Executive Summary

This plan covers three major UI changes to the PropertyIQ dashboard:

| Change | Description | Complexity |
|--------|-------------|------------|
| **1. Left Sidebar** | Restructure metrics into user-question-based categories | Medium |
| **2. Map** | No changes - add integration point for right panel | Low |
| **3. Right Panel** | New collapsible detail panel with scores and metrics | High |

### Key Decisions Made

| Decision | Answer |
|----------|--------|
| Score Dots Data Source | Cached PropertyIQ scores with client-side fallback for responsiveness |
| "View Full Report" Button | Internal navigation to `/report/:geoType/:geoId` + modal breakdown |
| "Compare Markets" Button | Visible but disabled, labeled as "Pro" feature |
| Mobile Behavior | Full-screen panel (not bottom sheet) |

---

## Gap Analysis - Missing Data

### Metrics Referenced but NOT in `config/metrics.ts`

These metrics are referenced in the UI spec but don't exist in the frontend configuration:

| Metric ID | Required For | Backend Status | Frontend Status | Action |
|-----------|--------------|----------------|-----------------|--------|
| `income_to_buy` | Affordability section | ✅ EXISTS (`/api/zillow/affordability/metros` → `homeowner_income_needed`) | ❌ No config | Add to METRICS config with valueField |
| `income_to_rent` | Affordability section | ✅ EXISTS (`/api/zillow/affordability/metros` → `renter_income_needed`) | ❌ No config | Add to METRICS config with valueField |
| `affordable_home_price` | Affordability section | ✅ EXISTS (`/api/zillow/affordability/metros` → `affordable_home_price`) | ❌ No config | Add to METRICS config with valueField |
| `rent_yoy` | Investor Cash Flow | ⚠️ Needs calculation from ZORI history | ❌ No config | Add backend calculation + frontend config |
| `vacancy_rate` | Investor Demand & Risk | ❌ Needs Census data import | ❌ No config | Future: Census data pipeline |
| `hotness_score` | Market Competition | ✅ EXISTS in realtor tables | ❌ No controller/config | Add controller endpoint + frontend config |

### Verified Backend Data Sources

**Affordability Data (CONFIRMED)**:
- **API**: `GET /api/zillow/affordability/metros`
- **Source**: `zillow_metro` table with metric_names: `homeowner_income`, `renter_income`, `affordable_price`, `years_to_save`
- **Response Fields**:
  - `homeowner_income_needed` → Use for `income_to_buy`
  - `renter_income_needed` → Use for `income_to_rent`
  - `affordable_home_price` → Use for `affordable_home_price`
  - `years_to_save` → Already configured
  - `homeowner_affordability_percent` → Already configured
  - `renter_affordability_percent` → Already configured

**Realtor Hotness Data (CONFIRMED)**:
- **Backend Service Methods** (realtor.service.ts lines 890-927):
  - `getMetroHotness()` - returns `hotness_score` column
  - `getCountyHotness()` - returns `hotness_score` column
  - `getZipHotness()` - returns `hotness_score` column
  - `getMetroSupplyScore()` - returns `supply_score` column
  - `getMetroDemandScore()` - returns `demand_score` column
- **Status**: Methods exist but NO controller endpoints expose them

### Backend Gaps to Fill

**1. Realtor Hotness Controller Endpoints** (realtor.controller.ts):
```typescript
// Need to add these routes:
@Get('hotness/:geo')      // → getMetro/County/ZipHotness
@Get('supply-score/:geo') // → getMetroSupplyScore, etc.
@Get('demand-score/:geo') // → getMetroDemandScore, etc.
```

**2. Scoring Controller** (scoring.controller.ts - may not exist):
```typescript
// Need to create:
@Get(':geoType/:geoId') // → scoringService.getScore()
```

**3. ZORI YoY Calculation**:
- Calculate from ZORI data 12 months apart
- Or add `zori_yoy` metric to import pipeline

---

## Change 1: Left Sidebar Restructure

### Current Structure (Data-Centric)

```
├── Popular Data
├── Home Price & Affordability
├── Market Trends
│   ├── Supply
│   ├── Velocity
│   ├── Pricing Dynamics
│   └── New Construction
├── Demographic
├── Economic Context
└── PropertyIQ Scores
```

### UX Principles to Implement

**These principles MUST be reflected throughout the UI:**

1. **Lead with scores** — PropertyIQ scores are the product differentiator
2. **Contextual labels** — "Seller's Market" / "Buyer's Market" / "Balanced Market" badges
3. **Trend arrows everywhere** — ↑↓ with percentages on sections, metrics, and cards
4. **Data-driven summaries** — "Homes sell in 8 days here, 40% faster than average"

### New Structure (User-Question-Based)

#### SidebarScoreCard Component (NEW - Lead With Scores)

**This component MUST appear at the top of the sidebar, above all metric categories.**

```
┌─────────────────────────────────────────────────────────────┐
│  🏆 YOUR MARKET SCORE                                       │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│    ┌──────────┐   HomeReady Score         ┌─────────────┐  │
│    │          │   ──────────────────      │ Buyer's     │  │
│    │    78    │   78 / 100  ↑ 3.2 pts     │ Market 🏠   │  │
│    │          │                           └─────────────┘  │
│    └──────────┘   "Good Time to Buy"                       │
│                                                             │
│    ─────────────────────────────────────────────────────── │
│    Homes sell in 8 days here, 40% faster than average.     │
│    Inventory up 15% — buyers gaining leverage.             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**SidebarScoreCard Props:**
```typescript
interface SidebarScoreCardProps {
  viewMode: ViewMode;
  selectedGeography: SelectedGeography | null;  // null = national view
  geoLevel: GeoLevel;
}
```

**Design Specs:**
- Background: Gradient from `bg-purple-900/20` to `bg-purple-900/5` (homebuyer) or emerald (investor)
- Border: `border-purple-500/30` with subtle glow
- Score number: Large (32-40px), bold, white
- Trend arrow: Colored (green ↑ / red ↓) with value
- Market badge: Pill with icon (🏠/⚖️/🔥) and colored background
- Summary: 2 lines max, text-sm, text-gray-400

**When to show:**
- Always visible at top of sidebar
- If no region selected: Show national/state average based on geoLevel
- If region selected: Show that region's score

---

#### Homebuyer/Renter Tab

```
├── [SidebarScoreCard - Always First]
│
├── Affordability
│   ├── Label: "Affordability"
│   ├── Subtext: "Can I afford to live here?"
│   ├── Score Dots: ●●●●○ (from HomeReady affordability component)
│   ├── Trend: ↑ Improving (if affordability metrics trending better)
│   └── Metrics:
│       ├── Home Value
│       ├── Income to Buy [NEW badge]
│       ├── Income to Rent [NEW badge]
│       ├── Affordable Home Price [NEW badge]
│       └── Years to Save [PRO badge]
│
├── Market Competition
│   ├── Label: "Market Competition"
│   ├── Subtext: "Should I act fast?"
│   ├── Score Dots: ●●●○○ (from market velocity metrics)
│   └── Metrics:
│       ├── Market Heat Index
│       ├── Days on Market
│       ├── Pending Ratio
│       └── Inventory
│
├── Pricing & Deals
│   ├── Label: "Pricing & Deals"
│   ├── Subtext: "Are prices going up or down?"
│   ├── Score Dots: ●●●●● (from price trend metrics)
│   └── Metrics:
│       ├── Home Value YoY
│       ├── Price Cut %
│       ├── Sale-to-List Ratio [PRO badge]
│       └── 5-Year Growth [PRO badge]
│
├── ─────────────── (divider) ───────────────
│
├── Area Profile
│   ├── Label: "Area Profile"
│   ├── Subtext: (none)
│   └── Metrics: (same as current Demographic)
│
├── Local Economy
│   ├── Label: "Local Economy"
│   ├── Subtext: (none)
│   └── Metrics: (same as current Economic Context)
│
└── New Construction
    └── (keep as-is)
```

#### Investor Tab

```
├── Cash Flow
│   ├── Label: "Cash Flow"
│   ├── Subtext: "Will this make money monthly?"
│   ├── Score Dots: ●●●○○ (from InvestorEdge cashflow component)
│   └── Metrics:
│       ├── Cap Rate
│       ├── Rent Index (ZORI)
│       ├── ZORI YoY [NEW - add to config]
│       └── Vacancy Rate [PRO badge]
│
├── Appreciation
│   ├── Label: "Appreciation"
│   ├── Subtext: "Will the value grow?"
│   ├── Score Dots: ●●●●○ (from InvestorEdge growth component)
│   └── Metrics:
│       ├── Home Value YoY
│       ├── 5-Year Growth [PRO badge]
│       └── Home Price Forecast [PRO badge]
│
├── Demand & Risk
│   ├── Label: "Demand & Risk"
│   ├── Subtext: "Can I rent it? Can I sell it?"
│   ├── Score Dots: ●●●●○ (from InvestorEdge demand component)
│   └── Metrics:
│       ├── Rental Demand (ZORDI)
│       ├── Days on Market
│       ├── Pending Ratio
│       └── Inventory YoY (as "Inventory Trend")
│
├── ─────────────── (divider) ───────────────
│
├── Area Profile
├── Local Economy
└── New Construction
```

### Category Rename Mapping

| Old Name | New Name |
|----------|----------|
| Market Trends > Supply | (merged into Market Competition) |
| Market Trends > Velocity | (merged into Market Competition) |
| Market Trends > Pricing Dynamics | Pricing & Deals |
| Demographic | Area Profile |
| Economic Context | Local Economy |
| Renter Demand Index | Rental Demand |

### Type Updates Required

**File**: `packages/frontend/app/map/types.ts`

```typescript
// Update MetricCategory interface
export interface MetricCategory {
  id: string;
  name: string;
  subtext?: string;           // NEW: Helper question
  icon?: React.ReactNode;
  metrics?: Metric[];
  subSections?: MetricSubSection[];
  viewMode?: ViewMode;
  isNew?: boolean;
  isDivider?: boolean;        // NEW: Visual separator
  scoreComponent?: string;    // NEW: Which score component for dots
}
```

### Score Dots Mapping

| Section | Score Source | Component |
|---------|--------------|-----------|
| Affordability | HomeReady | `affordability` |
| Market Competition | HomeReady | `stability` (market metrics) |
| Pricing & Deals | HomeReady | `value` |
| Cash Flow | InvestorEdge | `cashflow` |
| Appreciation | InvestorEdge | `growth` |
| Demand & Risk | InvestorEdge | `demand` |

---

## Change 2: Map Integration

### No Changes Required

The map component stays exactly as-is. The integration point already exists:

**File**: `packages/frontend/app/map/page.tsx` (line 73)

```typescript
const { updateMapLayers } = useMapLayers({
  // ...
  onFeatureClick: setSelectedGeography  // This already exists!
});
```

### Connection to Right Panel

When a region is clicked:
1. `useMapLayers` calls `onFeatureClick(SelectedGeography)`
2. `page.tsx` updates `selectedGeography` state
3. This triggers the new `RightDetailPanel` to open

```typescript
// In page.tsx, add:
const [rightPanelOpen, setRightPanelOpen] = useState(false);

// Update feature click handler:
const handleFeatureClick = useCallback((geography: SelectedGeography) => {
  setSelectedGeography(geography);
  setRightPanelOpen(true);  // NEW: Open right panel
}, []);
```

---

## Change 3: Right Detail Panel

### Component Structure

```
packages/frontend/app/map/components/
├── RightDetailPanel/
│   ├── index.tsx              # Main container with slide animation
│   ├── ScoreRing.tsx          # Circular progress score display
│   ├── MetricCard.tsx         # Individual metric card
│   ├── MetricCardGrid.tsx     # 2x2 grid of metric cards
│   ├── ScoreBadge.tsx         # "Good Time to Buy" label badge
│   └── PanelActions.tsx       # Action buttons at bottom
```

### Main Panel Component

**File**: `packages/frontend/app/map/components/RightDetailPanel/index.tsx`

```typescript
interface RightDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGeography: SelectedGeography | null;
  viewMode: ViewMode;
  geoLevel: GeoLevel;
}

interface PanelData {
  score: number;              // 0-100
  scoreLabel: string;         // "Good Time to Buy"
  summaryText: string;        // Dynamic summary
  metrics: MetricCardData[];  // 4 cards
  trend?: 'up' | 'down' | 'stable';
  trendChange?: number;
}
```

### Panel Layout

```
┌─────────────────────────────────────┐
│ [X close]                   top-right│
├─────────────────────────────────────┤
│                                     │
│   ┌─────────┐                       │
│   │  Score  │  Virginia Beach, VA   │
│   │   Ring  │  ───────────────────  │
│   │   78    │  "Good Time to Buy"   │
│   └─────────┘        ↑ +3.2         │
│                                     │
│   Affordable with moderate          │
│   competition — good window to buy  │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  ┌────────────┐  ┌────────────┐    │
│  │ $385K      │  │ 18 days    │    │
│  │ Median Home│  │ Days on Mkt│    │
│  │ ●●●●○      │  │ ●●●○○      │    │
│  └────────────┘  └────────────┘    │
│                                     │
│  ┌────────────┐  ┌────────────┐    │
│  │ +3.8%      │  │ 1,247      │    │
│  │ Price YoY  │  │ Inventory  │    │
│  │ ●●●●●      │  │ ●●●○○      │    │
│  └────────────┘  └────────────┘    │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  [  View Full Report  ] ← primary   │
│                                     │
│  [ + Compare Markets  ] ← PRO       │
│      (disabled, "Pro" label)        │
│                                     │
└─────────────────────────────────────┘
```

### Metric Cards by Tab

**Homebuyer Tab**:

| Position | Metric ID | Label | Source |
|----------|-----------|-------|--------|
| Top-left | `home_value` | Median Home | ZHVI via Realtor |
| Top-right | `days_on_market` | Days on Mkt | Realtor |
| Bottom-left | `home_value_yoy` | Price YoY | Realtor |
| Bottom-right | `for_sale_inventory` | Inventory | Realtor |

**Investor Tab**:

| Position | Metric ID | Label | Source |
|----------|-----------|-------|--------|
| Top-left | `cap_rate` | Cap Rate | Calculated |
| Top-right | `rent_for_houses` | Rental Demand | ZORDI |
| Bottom-left | `home_value_yoy` | Value Growth | Realtor |
| Bottom-right | `days_on_market` | Days on Mkt | Realtor |

### Score Label Logic

```typescript
function getScoreLabel(score: number, viewMode: ViewMode): string {
  const labels = {
    homebuyer: {
      excellent: "Great Time to Buy",
      good: "Good Time to Buy",
      moderate: "Moderate Market",
      poor: "Challenging Market"
    },
    investor: {
      excellent: "Strong Investment",
      good: "Solid Investment",
      moderate: "Mixed Signals",
      poor: "Proceed with Caution"
    }
  };

  const mode = labels[viewMode];
  if (score >= 80) return mode.excellent;
  if (score >= 60) return mode.good;
  if (score >= 40) return mode.moderate;
  return mode.poor;
}
```

### Market Condition Badge Logic (NEW)

```typescript
interface MarketCondition {
  label: string;
  color: 'green' | 'yellow' | 'red';
  icon: '🏠' | '⚖️' | '🔥';
}

function getMarketConditionBadge(
  monthsOfSupply: number,
  daysOnMarket: number,
  inventoryYoy: number
): MarketCondition {
  // Buyer's Market: High inventory, slow sales
  if (monthsOfSupply > 6 || (daysOnMarket > 45 && inventoryYoy > 10)) {
    return { label: "Buyer's Market", color: 'green', icon: '🏠' };
  }

  // Seller's Market: Low inventory, fast sales
  if (monthsOfSupply < 3 || (daysOnMarket < 21 && inventoryYoy < -5)) {
    return { label: "Seller's Market", color: 'red', icon: '🔥' };
  }

  // Balanced Market
  return { label: "Balanced Market", color: 'yellow', icon: '⚖️' };
}
```

### Trend Arrow Component (NEW - Use Everywhere)

```typescript
interface TrendArrowProps {
  current: number;
  previous: number;
  format: 'percent' | 'value' | 'days';
  invertColors?: boolean; // For metrics where lower is better (e.g., DOM, price)
}

function TrendArrow({ current, previous, format, invertColors }: TrendArrowProps) {
  const change = current - previous;
  const percentChange = previous !== 0 ? ((change / previous) * 100) : 0;
  const isPositive = change > 0;

  // Determine color: green = good, red = bad
  // invertColors: true for metrics like DOM, price where lower is better for buyers
  const isGood = invertColors ? !isPositive : isPositive;
  const color = isGood ? 'text-emerald-500' : 'text-rose-500';
  const arrow = isPositive ? '↑' : '↓';

  const displayValue = format === 'percent'
    ? `${percentChange.toFixed(1)}%`
    : format === 'days'
    ? `${Math.abs(change)} days`
    : formatCurrency(Math.abs(change));

  return (
    <span className={`${color} font-medium`}>
      {arrow} {displayValue}
    </span>
  );
}

// Usage examples:
// <TrendArrow current={385000} previous={370000} format="percent" /> → ↑ 4.1%
// <TrendArrow current={18} previous={25} format="days" invertColors /> → ↓ 7 days (green, lower is better)
// <TrendArrow current={1247} previous={1100} format="percent" invertColors /> → ↑ 13.4% (green for buyers, more inventory)
```

### Where to Show Trend Arrows

| Location | What to Show |
|----------|--------------|
| **Score Card (Sidebar Top)** | Score change vs 6 months ago: `78 ↑3.2` |
| **Section Headers** | Section trend: `Affordability ●●●●○ ↑ Improving` |
| **Individual Metrics** | Metric YoY change: `$385K ↓2.1%` |
| **Right Panel Score Ring** | Score + trend: `78 ↑3.2 pts` |
| **Right Panel Metric Cards** | Each card shows trend arrow |
```

### Summary Text Generation (Data-Driven)

```typescript
interface SummaryContext {
  score: number;
  viewMode: ViewMode;
  dom: number;
  domAvg: number;        // National or state average for comparison
  inventoryYoy: number;
  priceYoy: number;
  monthsSupply: number;
  capRate?: number;
  capRateAvg?: number;
}

function generateSummaryText(ctx: SummaryContext): string {
  const { score, viewMode, dom, domAvg, inventoryYoy, priceYoy, monthsSupply } = ctx;

  // Calculate comparisons
  const domDiff = Math.round(((domAvg - dom) / domAvg) * 100);
  const domComparison = dom < domAvg
    ? `${domDiff}% faster than average`
    : `${Math.abs(domDiff)}% slower than average`;

  // HOMEBUYER SUMMARIES - Data-driven, comparative
  if (viewMode === 'homebuyer') {
    // Hot market, seller's advantage
    if (dom < 14 && monthsSupply < 2) {
      return `Homes sell in ${dom} days here, ${domComparison}. Move fast or miss out.`;
    }

    // Cooling market, buyer opportunity
    if (inventoryYoy > 15 && priceYoy < 2) {
      return `Inventory up ${inventoryYoy.toFixed(0)}% with prices flat — buyers gaining leverage.`;
    }

    // Balanced market
    if (monthsSupply >= 4 && monthsSupply <= 6) {
      return `Balanced market with ${monthsSupply.toFixed(1)} months of supply. Room to negotiate.`;
    }

    // Affordability improving
    if (priceYoy < 0) {
      return `Prices down ${Math.abs(priceYoy).toFixed(1)}% year-over-year. Affordability improving.`;
    }

    // Generic but still data-driven
    return `Homes sell in ${dom} days here, ${domComparison}.`;
  }

  // INVESTOR SUMMARIES - Data-driven, ROI focused
  if (viewMode === 'investor') {
    const { capRate, capRateAvg } = ctx;

    if (capRate && capRateAvg) {
      const capDiff = ((capRate - capRateAvg) / capRateAvg * 100).toFixed(0);
      if (capRate > capRateAvg) {
        return `${capRate.toFixed(1)}% cap rate, ${capDiff}% above average. Strong cash flow.`;
      }
    }

    if (inventoryYoy > 20) {
      return `Inventory up ${inventoryYoy.toFixed(0)}% — more deals entering the market.`;
    }

    if (priceYoy > 8) {
      return `Values up ${priceYoy.toFixed(1)}% YoY. Appreciation play, not cash flow.`;
    }

    return `${dom} days on market, properties moving ${domComparison}.`;
  }

  return '';
}

// EXAMPLE OUTPUTS:
// "Homes sell in 8 days here, 40% faster than average. Move fast or miss out."
// "Inventory up 23% with prices flat — buyers gaining leverage."
// "5.2% cap rate, 15% above average. Strong cash flow."
// "Balanced market with 4.8 months of supply. Room to negotiate."
```

### Summary Templates Library

| Condition | Homebuyer Summary | Investor Summary |
|-----------|-------------------|------------------|
| DOM < 14, Supply < 2 | "Homes sell in X days, Y% faster than avg" | "Properties moving fast, act quickly" |
| Inventory ↑ > 15% | "Inventory up X% — buyers gaining leverage" | "More deals entering the market" |
| Price ↓ YoY | "Prices down X% YoY — affordability improving" | "Entry prices declining, watch for bottom" |
| Cap Rate > Avg | — | "X% cap rate, Y% above average" |
| Supply 4-6 mo | "Balanced market, room to negotiate" | "Stable market, predictable returns" |
| Price ↑ > 8% | "Prices rising X% — act soon" | "Appreciation play, not cash flow" |
```

### Animation CSS

```css
/* Tailwind classes for the panel */
.right-detail-panel {
  @apply fixed top-14 right-0 bottom-0 w-[380px]
         bg-surface-container-low/95 backdrop-blur-xl
         border-l border-outline-variant
         transform transition-transform duration-300 ease-out z-50;
}

.right-detail-panel.closed {
  @apply translate-x-full;
}

.right-detail-panel.open {
  @apply translate-x-0;
}

/* Mobile: Full screen */
@media (max-width: 640px) {
  .right-detail-panel {
    @apply w-full top-0;
  }
}
```

### Color Theming by ViewMode

| Element | Homebuyer | Investor |
|---------|-----------|----------|
| Score Ring | `#a855f7` (purple-500) | `#10b981` (emerald-500) |
| Score Badge BG | `bg-purple-100` | `bg-emerald-100` |
| Score Badge Text | `text-purple-700` | `text-emerald-700` |
| Primary Button | `bg-purple-600` | `bg-emerald-600` |

### Action Buttons

**View Full Report**:
- Primary action button
- Navigates to `/report/:geoType/:geoId`
- Also opens modal with detailed score breakdown

**Compare Markets**:
- Secondary button, outlined style
- Disabled (grayed out)
- Shows "PRO" badge
- Tooltip: "Upgrade to Pro to compare markets"

---

## Backend Changes Required

### 1. Scoring Controller Endpoint

**File**: `packages/backend/src/scoring/scoring.controller.ts` (create if not exists)

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { GeographyType } from './scoring.types';

@Controller('api/scores')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get(':geoType/:geoId')
  async getScore(
    @Param('geoType') geoType: GeographyType,
    @Param('geoId') geoId: string,
    @Query('date') date?: string,
  ) {
    // Try to get cached score first
    let score = await this.scoringService.getScore(geoId, geoType, date);

    // If no cached score, calculate on-demand
    if (!score) {
      score = await this.scoringService.calculateScore(geoId, geoType, date);
    }

    if (!score) {
      return { success: false, error: 'Score not available for this geography' };
    }

    return {
      success: true,
      data: {
        geographyId: score.geographyId,
        geographyName: score.geographyName,
        homereadyScore: score.homereadyScore,
        homereadyComponents: score.homereadyComponents,
        homereadyTrend: score.homereadyTrend,
        homereadyTrendChange: score.homereadyTrendChange,
        investoredgeScore: score.investoredgeScore,
        investoredgeComponents: score.investoredgeComponents,
        investoredgeTrend: score.investoredgeTrend,
        investoredgeTrendChange: score.investoredgeTrendChange,
        confidenceLevel: score.confidenceLevel,
        periodDate: score.periodDate,
      }
    };
  }

  @Get(':geoType/:geoId/metrics')
  async getScoreWithMetrics(
    @Param('geoType') geoType: GeographyType,
    @Param('geoId') geoId: string,
  ) {
    // Returns score + the 4 panel metrics
    // Combines score API + realtor benchmarks
  }
}
```

### 2. Realtor Hotness Endpoints

**File**: `packages/backend/src/realtor/realtor.controller.ts`

Add these routes:

```typescript
@Get('hotness/:geo')
async getHotness(
  @Param('geo') geo: string,
  @Query('state') state?: string,
  @Query('date') date?: string,
) {
  switch (geo) {
    case 'metros':
      return this.realtorService.getMetroHotness(date);
    case 'counties':
      return this.realtorService.getCountyHotness(date);
    case 'zips':
      return this.realtorService.getZipHotness(state, date);
    default:
      throw new BadRequestException('Invalid geography type');
  }
}

@Get('supply-score/:geo')
async getSupplyScore(@Param('geo') geo: string, @Query('date') date?: string) {
  // Similar routing
}

@Get('demand-score/:geo')
async getDemandScore(@Param('geo') geo: string, @Query('date') date?: string) {
  // Similar routing
}
```

### 3. Affordability Metrics Verification

**File**: `packages/backend/src/zillow/zillow.controller.ts`

Verify the `/api/zillow/affordability/:geo` endpoint returns all required fields:

```typescript
// Expected response shape:
{
  success: true,
  count: 400,
  data: [
    {
      region_id: "12345",
      cbsa_code: "12420",
      region_name: "Austin-Round Rock, TX",
      homeowner_affordability_percent: 35.2,
      renter_affordability_percent: 48.7,
      income_to_buy: 125000,        // NEW - verify exists
      income_to_rent: 68000,         // NEW - verify exists
      affordable_home_price: 320000, // NEW - verify exists
      years_to_save: 8.5,
      date: "2025-11-30"
    }
  ]
}
```

### 4. ZORI YoY Endpoint

Check if ZORI YoY data exists in `zillow_metro` table. If not, calculate from historical ZORI:

```typescript
@Get('rent-yoy/:geo')
async getRentYoy(@Param('geo') geo: string) {
  // Option 1: Direct from table if column exists
  // Option 2: Calculate from ZORI 12 months apart
}
```

---

## Database Verification

### Tables to Check

Run these queries to verify data availability:

```sql
-- Check zillow_metro affordability columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'zillow_metro'
AND column_name IN (
  'income_to_buy',
  'income_to_rent',
  'affordable_home_price',
  'years_to_save'
);

-- Check realtor tables for hotness
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'realtor_metro'
AND column_name IN ('hotness_score', 'demand_score', 'supply_score');

-- Check propertyiq_scores table exists
SELECT COUNT(*) FROM propertyiq_scores;

-- Sample score data
SELECT geography_id, geography_name, homeready_score, investoredge_score
FROM propertyiq_scores
WHERE geography_type = 'metro'
LIMIT 5;
```

### Migration if Columns Missing

If affordability columns don't exist:

```sql
-- Migration: Add affordability columns to zillow_metro
ALTER TABLE zillow_metro
ADD COLUMN IF NOT EXISTS income_to_buy DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS income_to_rent DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS affordable_home_price DECIMAL(12,2);

-- These may need to be populated from Zillow affordability data imports
```

---

## Testing Plan

### Unit Tests

#### Sidebar Tests

| ID | Test | Expected Result |
|----|------|-----------------|
| S1 | Homebuyer categories render correctly | Shows Affordability, Market Competition, Pricing & Deals, divider, Area Profile, Local Economy, New Construction |
| S2 | Investor categories render correctly | Shows Cash Flow, Appreciation, Demand & Risk, divider, Area Profile, Local Economy, New Construction |
| S3 | Subtext displays under category headers | Each main category shows helper question |
| S4 | Score dots render 1-5 filled circles | Dots reflect component score (e.g., 72/100 = 4 dots) |
| S5 | Divider renders between sections | Visual separator between main and secondary categories |
| S6 | ViewMode toggle updates categories | Switching tabs rebuilds category list |

#### Right Panel Tests

| ID | Test | Expected Result |
|----|------|-----------------|
| P1 | Panel opens on map region click | Click region → panel slides in from right |
| P2 | Panel closes on X button | Click X → panel slides out |
| P3 | Panel closes on outside click | Click map → panel closes |
| P4 | Score ring shows correct value | Ring fills to match score percentage |
| P5 | Score ring color matches viewMode | Purple for homebuyer, green for investor |
| P6 | Score badge shows correct label | "Good Time to Buy" for score 60-79 |
| P7 | 4 metric cards render | 2x2 grid with correct metrics per viewMode |
| P8 | Metric card dots match percentile | Score dots (1-5) reflect metric's relative standing |
| P9 | View Full Report navigates correctly | Opens modal + can navigate to /report/:geo/:id |
| P10 | Compare Markets shows PRO badge | Button disabled with "PRO" label |
| P11 | Mobile shows full-screen panel | Panel takes 100% width on screens < 640px |

#### API Tests

| ID | Test | Expected Result |
|----|------|-----------------|
| A1 | `GET /api/scores/metro/12420` | Returns homereadyScore, investoredgeScore, components |
| A2 | `GET /api/realtor/hotness/metros` | Returns hotness_score for all metros |
| A3 | `GET /api/zillow/affordability/metros` | Returns income_to_buy, income_to_rent, affordable_home_price |
| A4 | Score API handles missing data | Returns null/error gracefully for unsupported geos |

### Integration Tests

| ID | Test | Expected Result |
|----|------|-----------------|
| I1 | End-to-end: Click metro → panel shows data | Full flow from map click to populated panel |
| I2 | ViewMode switch updates both sidebar and panel | Changing tabs updates categories and panel metrics |
| I3 | Geographic level change refreshes panel | Switch to county → panel fetches county score |
| I4 | State filter affects panel data | Filter to CA → panel shows CA region scores |
| I5 | Cached scores load instantly | Second click on same region loads from cache |

### Visual/Manual Tests

| ID | Test | Expected Result |
|----|------|-----------------|
| V1 | Animation timing feels smooth | 300ms slide-in, no jank |
| V2 | Score ring animation | Ring fills progressively on open |
| V3 | Panel backdrop blur | Semi-transparent with blur effect |
| V4 | Responsive breakpoints | Mobile full-screen, tablet/desktop 380px width |
| V5 | Dark theme compatibility | All elements readable in dark mode |

---

## Implementation Order

### Phase 1: Data Layer Setup (Backend)
**Estimated effort: 2-3 days**

1. **Verify database columns**
   - Run verification queries
   - Create migration if columns missing
   - Verify data is populated

2. **Add Scoring Controller**
   - Create `scoring.controller.ts`
   - Add `GET /api/scores/:geoType/:geoId` endpoint
   - Register in `scoring.module.ts`
   - Test endpoint returns correct data

3. **Add Realtor Hotness Endpoints**
   - Add routes in `realtor.controller.ts`
   - Test hotness data returns

4. **Verify Affordability Endpoint**
   - Test `/api/zillow/affordability/metros`
   - Ensure all fields present

### Phase 2: Frontend Metrics Config
**Estimated effort: 1 day**

1. **Add missing metrics to `config/metrics.ts`**
   ```typescript
   income_to_buy: {
     id: 'income_to_buy',
     title: 'Income to Buy',
     format: 'currency',
     dataSource: 'zillow',
     apiEndpoint: '/api/zillow/affordability/{geo}',
     keyField: 'auto',
     supportedGeos: ['metro'],
     valueField: 'income_to_buy',
   },
   // ... income_to_rent, affordable_home_price, rent_yoy, vacancy_rate, hotness_score
   ```

2. **Update types.ts with new MetricCategory fields**

3. **Test metrics appear in map layer**

### Phase 3: Sidebar Restructure
**Estimated effort: 2-3 days**

1. **Rewrite `metric-categories.tsx`**
   - Create `getHomebuyerCategories()` function
   - Create `getInvestorCategories()` function
   - Update `getMetricCategories()` to use new structure

2. **Create SectionScoreDots component**
   - Accepts score 0-100, renders 1-5 dots
   - Fetches from cached scores or calculates client-side

3. **Update MetricCategoryItem.tsx**
   - Add subtext rendering
   - Add score dots rendering
   - Add divider support

4. **Test sidebar renders correctly for both tabs**

### Phase 4: Right Detail Panel
**Estimated effort: 3-4 days**

1. **Create component structure**
   - `RightDetailPanel/index.tsx`
   - `ScoreRing.tsx`
   - `MetricCard.tsx`
   - `MetricCardGrid.tsx`
   - `ScoreBadge.tsx`
   - `PanelActions.tsx`

2. **Implement ScoreRing**
   - SVG-based circular progress
   - Animated fill on open
   - Color theming by viewMode

3. **Implement MetricCard**
   - Value display with formatting
   - Label
   - Score dots (1-5)
   - Optional trend arrow

4. **Implement main panel**
   - Slide animation
   - Mobile full-screen
   - Backdrop blur

5. **Add panel state to page.tsx**
   - `rightPanelOpen` state
   - Connect to map click handler
   - Close handlers

### Phase 5: Data Integration
**Estimated effort: 2 days**

1. **Create useRightPanelData hook**
   - Fetches score from `/api/scores/:geoType/:geoId`
   - Fetches metrics from existing realtor/zillow APIs
   - Combines into PanelData shape

2. **Connect panel to data**
   - Loading states
   - Error handling
   - Caching

3. **Implement summary text generation**
   - Logic based on score + metrics

### Phase 6: Action Buttons & Navigation
**Estimated effort: 1 day**

1. **View Full Report button**
   - Navigate to `/report/:geoType/:geoId`
   - Create basic report page (or modal)

2. **Compare Markets button**
   - Disabled state with PRO badge
   - Tooltip explaining upgrade

### Phase 7: Testing & Polish
**Estimated effort: 2-3 days**

1. **Run all unit tests**
2. **Run integration tests**
3. **Visual testing on multiple viewports**
4. **Performance testing (caching effectiveness)**
5. **Accessibility review**
6. **Bug fixes and polish**

---

## File Change Summary

### Files to Create

| File | Purpose |
|------|---------|
| `components/RightDetailPanel/index.tsx` | Main panel container |
| `components/RightDetailPanel/ScoreRing.tsx` | Circular score display |
| `components/RightDetailPanel/MetricCard.tsx` | Individual metric card |
| `components/RightDetailPanel/MetricCardGrid.tsx` | 2x2 card grid |
| `components/RightDetailPanel/ScoreBadge.tsx` | Score label badge |
| `components/RightDetailPanel/MarketConditionBadge.tsx` | "Seller's/Buyer's Market" badge |
| `components/RightDetailPanel/PanelActions.tsx` | Action buttons |
| `components/sidebar-components/SidebarScoreCard.tsx` | **NEW: Lead score card at top of sidebar** |
| `components/sidebar-components/SectionScoreDots.tsx` | 1-5 dot indicator |
| `components/sidebar-components/SectionDivider.tsx` | Visual divider |
| `components/sidebar-components/TrendArrow.tsx` | Reusable ↑↓ trend component |
| `hooks/useRightPanelData.ts` | Data fetching for panel |
| `hooks/useSectionScores.ts` | Score dots data fetching |
| `hooks/useMarketAverages.ts` | Fetch national/state averages for comparisons |
| `backend/src/scoring/scoring.controller.ts` | Score API controller |

### Files to Modify

| File | Changes |
|------|---------|
| `config/metrics.ts` | Add 6 new metric definitions |
| `config/metric-categories.tsx` | Complete restructure for both tabs |
| `types.ts` | Add `subtext`, `isDivider`, `scoreComponent` to MetricCategory |
| `components/sidebar-components/MetricCategoryItem.tsx` | Add subtext, score dots, divider rendering |
| `components/index.ts` | Export new components |
| `page.tsx` | Add RightDetailPanel, state management |
| `backend/src/realtor/realtor.controller.ts` | Add hotness endpoints |
| `backend/src/scoring/scoring.module.ts` | Register controller |

### Files Unchanged

| File | Reason |
|------|--------|
| `hooks/useMapLayers.ts` | Already has onFeatureClick callback |
| `components/Legend.tsx` | No changes needed |
| `components/BenchmarkPanel.tsx` | Keep existing (different purpose) |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missing database columns | Medium | High | Verify early in Phase 1, create migrations |
| Score calculation performance | Medium | Medium | Use caching, calculate on-demand only if needed |
| Mobile panel UX issues | Low | Medium | Test early on real devices |
| Metric data inconsistency | Medium | Medium | Validate API responses, graceful fallbacks |

---

## Success Criteria

1. ✅ Sidebar displays new category structure based on viewMode
2. ✅ Each category shows subtext and score dots
3. ✅ Divider separates main and secondary sections
4. ✅ Right panel opens on map region click
5. ✅ Panel displays correct score and label
6. ✅ 4 metric cards show correct data per viewMode
7. ✅ Panel colors match viewMode (purple/green)
8. ✅ View Full Report button works
9. ✅ Compare Markets shows PRO badge (disabled)
10. ✅ Mobile displays full-screen panel
11. ✅ All tests pass
12. ✅ Performance acceptable (<500ms panel load)
