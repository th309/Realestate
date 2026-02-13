# PropertyIQ Graphs Page Redesign

**Date:** 2026-02-12
**Status:** Approved
**Prototype:** `packages/frontend/app/graphs/prototype.html`

---

## Executive Summary

Transform the graphs page from a powerful-but-confusing analytics tool into a **question-driven comparison experience** that instantly delivers value to users. The redesign focuses on three primary use cases in priority order:

1. **Active Buyers/Investors** comparing 2-3 markets
2. **Market Watchers** monitoring saved markets
3. **Analysts** doing deep metric exploration

The goal: Make this page worth $30/month by delivering an instant "aha moment" when users land.

---

## Design Decisions

### User Research Insights

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary user | Active buyer/investor | Most likely to convert to paid |
| "Aha moment" | My markets instantly loaded | Reduce time to value |
| Secondary moment | Pre-built comparison templates | Answer real questions fast |
| Tertiary moment | AI insights (Quinn) | Conversational guidance |
| Graphs ↔ Reports | Symbiotic but independent | Users can explore OR generate reports |
| D3 Advanced Mode | Question-driven (not toggle) | D3 appears in context, not as separate mode |
| Market context | Smart blend + fallback | Pinned favorites → recent activity → onboarding |
| Comparison templates | Hero templates + metric categories | Mix of curated and flexible |
| AI tone | Conversational (Quinn) | Friendly, specific, actionable |

---

## Page Architecture

### Three-Zone Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  MY MARKETS BAR                                                 │
│  [Austin, TX 78] [Denver, CO 72] [Nashville, TN 75] [+ Add]    │
└─────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────┐ ┌───────────────────┐
│                                           │ │ EXPLORATION       │
│  HERO COMPARISON                          │ │ SIDEBAR           │
│                                           │ │                   │
│  • Template tabs (Affordability, etc.)    │ │ • Questions       │
│  • Score showdown (gauges + winner)       │ │ • AI Insight      │
│  • Priority breakdown                     │ │ • Metric chips    │
│  • D3 visualization                       │ │ • Report CTA      │
│                                           │ │                   │
└───────────────────────────────────────────┘ └───────────────────┘
```

### Zone 1: My Markets Bar (Top)

**Purpose:** Instant context - show user's markets with scores at a glance

**Components:**
- Market chips with PropertyIQ score badge
- Active state for markets being compared
- "+ Add Market" button (opens search modal)
- Horizontal scroll on mobile

**Data Source:**
1. Pinned/favorite markets from user profile
2. Recent report/search activity
3. Onboarding flow for new users (empty state)

**Behavior:**
- Click chip → add to comparison (max 2 in hero)
- Click active chip → remove from comparison
- Scores update in real-time

### Zone 2: Hero Comparison (Center)

**Purpose:** Answer the user's core question with visual clarity

**Sub-sections:**

#### 2a. Template Header
- Title: "Affordability Showdown" (or active template)
- Subtitle: "Which market fits your budget better?"
- Tab row: Affordability | Investment | Momentum | Custom

#### 2b. Score Showdown
- Two market cards side-by-side
- Winner badge on higher-scoring market
- Circular score gauges (reuse `ScoreDisplay` component)
- Score type label (HomeReady/InvestorEdge based on user_type)

#### 2c. Priority Breakdown ("Why X Wins For You")
- 3 priority rows, numbered 1-2-3
- Each row: icon + label + metric comparison + winner chip
- Primary color (purple) for overall winner's rows
- Tertiary color (rose) for other market's winning rows

#### 2d. D3 Visualization
- Appears **in context** of the active template
- Scatter plot: Affordability vs Appreciation (for Affordability template)
- Highlighted points for compared markets
- Toggle: Scatter | Heatmap | Trend
- Full D3 interactivity (zoom, pan, tooltips)

### Zone 3: Exploration Sidebar (Right)

**Purpose:** Progressive disclosure - questions, insights, deeper exploration

**Sub-sections:**

#### 3a. Explore Questions
- 3 curated questions relevant to current comparison
- Click → updates hero visualization to answer
- Examples:
  - "Can I afford to buy in Austin with $85K income?"
  - "Which market appreciated faster in the last 5 years?"
  - "What's the rent vs buy breakeven in Denver?"

#### 3b. Quinn's Insight (AI)
- Gradient card (primary → tertiary containers)
- Conversational summary of comparison
- Highlights key differentiators
- Specific numbers, not vague statements

#### 3c. Compare Metrics
- Categorized chip grid
- Categories: Affordability, Growth, Investment, Demographics
- Click chip → updates D3 visualization
- Active chip = currently displayed metric

#### 3d. Generate Full Report (CTA)
- Primary button at bottom
- Opens report wizard with markets pre-filled
- Links graphs exploration to reports system

---

## Hero Templates

### Affordability Showdown (Homebuyer)
**Question:** "Which market fits my budget better?"

| Metric | Display |
|--------|---------|
| Price-to-Income Ratio | Lower = better |
| Median Home Price | Current value |
| Rent-to-Income Ratio | Lower = better |
| Inventory/Supply | Higher = better |

**D3 Visualization:** Scatter plot (X: Price-to-Income, Y: 5Y Appreciation)

### Investment Face-off (Investor)
**Question:** "Which market offers better returns?"

| Metric | Display |
|--------|---------|
| Cap Rate | Higher = better |
| Cash-on-Cash Return | Calculated |
| 5Y Appreciation CAGR | Historical |
| Rent Growth | YoY % |

**D3 Visualization:** Scatter plot (X: Cap Rate, Y: Appreciation)

### Market Momentum
**Question:** "Which market is heating up faster?"

| Metric | Display |
|--------|---------|
| Days on Market | Lower = hotter |
| Inventory Change | YoY % |
| Price Growth | 1Y % |
| Sale-to-List Ratio | Higher = hotter |

**D3 Visualization:** Trend lines (multi-metric time series)

### Cash Flow Face-off (Investor)
**Question:** "Which market cash flows better?"

| Metric | Display |
|--------|---------|
| Gross Rent Yield | % |
| Price-to-Rent Ratio | Lower = better |
| Vacancy Rate | Lower = better |
| Property Tax Rate | Lower = better |

**D3 Visualization:** Heatmap (metrics × markets)

---

## Technical Implementation

### State Management

```typescript
interface GraphsPageState {
  // User's markets
  myMarkets: Market[];

  // Current comparison
  primaryMarket: Market | null;
  comparisonMarket: Market | null;

  // Active template
  activeTemplate: 'affordability' | 'investment' | 'momentum' | 'cashflow' | 'custom';

  // D3 visualization
  vizType: 'scatter' | 'heatmap' | 'trend';
  activeMetrics: string[];

  // User type (affects score display)
  userType: 'homebuyer' | 'investor';
}
```

### URL State Sync

All state syncs to URL for shareability:
```
/graphs?primary=austin-tx&compare=denver-co&template=affordability&viz=scatter
```

### Data Fetching

Uses existing `@/lib/data` layer:
- `fetchSnapshotData()` for current metrics
- `fetchTimeSeriesData()` for trends
- `fetchScore()` for PropertyIQ scores

New hooks needed:
- `useMarketComparison(primaryId, comparisonId, template)`
- `useMyMarkets()` - fetches user's saved/recent markets

### D3 Integration

Reuse existing D3 components from `lib/visualizations/d3/`:
- `ScatterPlot.tsx` (with zoom, regression)
- `Heatmap.tsx` (for multi-metric comparison)
- Add new: `TrendComparison.tsx` (multi-line time series)

### Component Structure

```
app/graphs/
├── Dashboard.tsx (current - to be replaced)
├── GraphsPage.tsx (new main component)
├── components/
│   ├── MyMarketsBar/
│   │   ├── MyMarketsBar.tsx
│   │   ├── MarketChip.tsx
│   │   └── AddMarketModal.tsx
│   ├── HeroComparison/
│   │   ├── HeroComparison.tsx
│   │   ├── TemplateTabs.tsx
│   │   ├── ScoreShowdown.tsx
│   │   ├── PriorityBreakdown.tsx
│   │   └── TemplateVisualization.tsx
│   ├── ExplorationSidebar/
│   │   ├── ExplorationSidebar.tsx
│   │   ├── QuestionCards.tsx
│   │   ├── QuinnInsight.tsx
│   │   ├── MetricExplorer.tsx
│   │   └── ReportCTA.tsx
│   └── templates/
│       ├── AffordabilityTemplate.tsx
│       ├── InvestmentTemplate.tsx
│       ├── MomentumTemplate.tsx
│       └── CashFlowTemplate.tsx
├── hooks/
│   ├── useGraphsState.ts
│   ├── useMarketComparison.ts
│   ├── useMyMarkets.ts
│   └── useTemplateData.ts
└── constants/
    └── templates.ts
```

---

## Migration Strategy

### Phase 1: New Page (Parallel)
- Build new `GraphsPage.tsx` alongside existing `Dashboard.tsx`
- Route: `/graphs/new` for testing
- Feature flag: `graphs_redesign`

### Phase 2: A/B Test
- 50% of users see new design
- Track metrics: time on page, report generation, return visits

### Phase 3: Full Rollout
- Replace `Dashboard.tsx` with `GraphsPage.tsx`
- Deprecate old components

### Backward Compatibility
- Keep `D3VisualizationSection.tsx` for "Custom" template
- Preserve all existing D3 visualizations as options

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to first insight | ~60s | <10s |
| Report generation rate | ~5% | 15% |
| Return visit rate | ~20% | 40% |
| Pro conversion from graphs | ~2% | 5% |

---

## Design Tokens

Uses existing M3 theme from `globals.css`:

| Token | Value | Usage |
|-------|-------|-------|
| `--md-primary` | #6750a4 | Winner badges, active states |
| `--md-tertiary` | #7d5260 | Secondary market, losing priorities |
| `--md-primary-container` | #eaddff | Winner card background |
| `--md-surface-container` | #f3edf7 | Section backgrounds |

---

## Open Questions (Resolved)

1. ~~What happens with "Advanced Mode" toggle?~~ → Removed. D3 appears in context.
2. ~~How do we handle new users with no markets?~~ → Onboarding flow prompts market selection.
3. ~~Should AI insight auto-generate?~~ → Yes, on comparison load.

---

## Appendix: Prototype

Static HTML prototype: `packages/frontend/app/graphs/prototype.html`

To view:
```bash
cd packages/frontend/app/graphs
python -m http.server 8888
# Open http://localhost:8888/prototype.html
```

Screenshot: `packages/frontend/app/graphs/prototype-screenshot.png`
