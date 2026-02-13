# Graphs Redesign Implementation Plan

**Design Doc:** `docs/plans/2026-02-12-graphs-redesign-design.md`
**Prototype:** `packages/frontend/app/graphs/prototype.html`

---

## Overview

Implement the question-driven comparison experience for the graphs page. This plan follows the design document and breaks work into implementable phases.

---

## Phase 1: Foundation & Data Layer

### 1.1 Create new hooks for market comparison

**File:** `packages/frontend/app/graphs/hooks/useMyMarkets.ts`

```typescript
// Hook to fetch user's saved/recent markets
// Sources: pinned favorites, recent reports, recent searches
// Returns: Market[] with scores
```

**File:** `packages/frontend/app/graphs/hooks/useMarketComparison.ts`

```typescript
// Hook to fetch comparison data for two markets
// Accepts: primaryId, comparisonId, template
// Returns: metrics, scores, winner calculation
```

**File:** `packages/frontend/app/graphs/hooks/useGraphsState.ts`

```typescript
// Central state management with URL sync
// Manages: myMarkets, activeTemplate, vizType, selectedMetrics
```

### 1.2 Define template configurations

**File:** `packages/frontend/app/graphs/constants/templates.ts`

```typescript
// Template definitions with:
// - metrics to fetch
// - display configuration
// - winner logic per metric
// - D3 visualization type
```

### 1.3 Add backend endpoint for user's markets (if needed)

Check if existing endpoints can provide:
- User's pinned/favorite markets
- Recent report geographies
- Recent search history

---

## Phase 2: My Markets Bar

### 2.1 Create MyMarketsBar component

**File:** `packages/frontend/app/graphs/components/MyMarketsBar/MyMarketsBar.tsx`

- Horizontal bar with market chips
- Score badge on each chip
- Active state for compared markets
- Responsive (horizontal scroll on mobile)

### 2.2 Create MarketChip component

**File:** `packages/frontend/app/graphs/components/MyMarketsBar/MarketChip.tsx`

- Market name + score
- Click to toggle comparison
- Active/inactive states
- Uses M3 chip styling

### 2.3 Create AddMarketModal

**File:** `packages/frontend/app/graphs/components/MyMarketsBar/AddMarketModal.tsx`

- Search input with autocomplete
- Recent searches
- Reuse existing geography search component

---

## Phase 3: Hero Comparison Section

### 3.1 Create HeroComparison container

**File:** `packages/frontend/app/graphs/components/HeroComparison/HeroComparison.tsx`

- Main container with template header
- Orchestrates sub-components
- Handles template switching

### 3.2 Create TemplateTabs component

**File:** `packages/frontend/app/graphs/components/HeroComparison/TemplateTabs.tsx`

- Tab row: Affordability | Investment | Momentum | Custom
- Pill-style buttons (M3 segmented button pattern)
- Active state with primary-container background

### 3.3 Create ScoreShowdown component

**File:** `packages/frontend/app/graphs/components/HeroComparison/ScoreShowdown.tsx`

- Two-column grid with VS divider
- Reuse `ScoreDisplay` component for gauges
- Winner badge positioning
- Market name labels

### 3.4 Create PriorityBreakdown component

**File:** `packages/frontend/app/graphs/components/HeroComparison/PriorityBreakdown.tsx`

- List of 3 priority items
- Numbered circles (1, 2, 3)
- Icon + label + metric + winner chip
- Color coding: primary for winner, tertiary for other

### 3.5 Create TemplateVisualization component

**File:** `packages/frontend/app/graphs/components/HeroComparison/TemplateVisualization.tsx`

- Container for D3 visualizations
- Viz type toggle (Scatter | Heatmap | Trend)
- Passes data to appropriate D3 component
- Highlights compared markets

---

## Phase 4: Template Implementations

### 4.1 Affordability Template

**File:** `packages/frontend/app/graphs/components/templates/AffordabilityTemplate.tsx`

Metrics:
- Price-to-Income Ratio
- Median Home Price
- Rent-to-Income Ratio
- Inventory/Supply

Visualization: Scatter (X: Price-to-Income, Y: 5Y Appreciation)

### 4.2 Investment Template

**File:** `packages/frontend/app/graphs/components/templates/InvestmentTemplate.tsx`

Metrics:
- Cap Rate
- Cash-on-Cash Return (calculated)
- 5Y Appreciation CAGR
- Rent Growth YoY

Visualization: Scatter (X: Cap Rate, Y: Appreciation)

### 4.3 Momentum Template

**File:** `packages/frontend/app/graphs/components/templates/MomentumTemplate.tsx`

Metrics:
- Days on Market
- Inventory Change YoY
- Price Growth 1Y
- Sale-to-List Ratio

Visualization: Multi-line trend

### 4.4 Cash Flow Template

**File:** `packages/frontend/app/graphs/components/templates/CashFlowTemplate.tsx`

Metrics:
- Gross Rent Yield
- Price-to-Rent Ratio
- Vacancy Rate
- Property Tax Rate

Visualization: Heatmap

---

## Phase 5: Exploration Sidebar

### 5.1 Create ExplorationSidebar container

**File:** `packages/frontend/app/graphs/components/ExplorationSidebar/ExplorationSidebar.tsx`

- Right column layout
- Stacked cards
- Responsive (grid on tablet, stack on mobile)

### 5.2 Create QuestionCards component

**File:** `packages/frontend/app/graphs/components/ExplorationSidebar/QuestionCards.tsx`

- 3 curated questions based on template
- Click handler updates visualization
- Emoji icons + question text

### 5.3 Create QuinnInsight component

**File:** `packages/frontend/app/graphs/components/ExplorationSidebar/QuinnInsight.tsx`

- Gradient card (primary → tertiary)
- AI-generated comparison summary
- Integration with existing Gemini service
- Loading state

### 5.4 Create MetricExplorer component

**File:** `packages/frontend/app/graphs/components/ExplorationSidebar/MetricExplorer.tsx`

- Categorized metric chips
- Categories from template config
- Click updates D3 visualization
- Active chip highlighting

### 5.5 Create ReportCTA component

**File:** `packages/frontend/app/graphs/components/ExplorationSidebar/ReportCTA.tsx`

- Primary button with icon
- Links to report wizard
- Pre-fills compared markets

---

## Phase 6: New Main Page Component

### 6.1 Create GraphsPage

**File:** `packages/frontend/app/graphs/GraphsPage.tsx`

- Replaces Dashboard.tsx
- Three-zone layout
- URL state sync
- Loading/error states
- Empty state for new users

### 6.2 Update routing

**File:** `packages/frontend/app/graphs/page.tsx`

- Feature flag for A/B testing
- Route to GraphsPage or Dashboard based on flag

---

## Phase 7: D3 Enhancements

### 7.1 Create TrendComparison visualization

**File:** `packages/frontend/lib/visualizations/d3/TrendComparison.tsx`

- Multi-line time series
- Two markets highlighted
- National baseline (dashed)
- Time range selector integration

### 7.2 Enhance ScatterPlot for comparisons

**File:** `packages/frontend/lib/visualizations/d3/ScatterPlot.tsx`

- Add highlighted points for compared markets
- Larger, bordered circles for selected markets
- Tooltip shows market name and values

### 7.3 Enhance Heatmap for comparisons

**File:** `packages/frontend/lib/visualizations/d3/Heatmap.tsx`

- Row highlighting for compared markets
- Side-by-side comparison mode

---

## Phase 8: Integration & Polish

### 8.1 AI Insight Integration

- Connect QuinnInsight to Gemini service
- Create comparison-specific prompts
- Cache insights per comparison

### 8.2 Report Generation Link

- Wire ReportCTA to report wizard
- Pre-fill markets from comparison
- Track conversion analytics

### 8.3 Analytics Events

Add tracking for:
- Template switches
- Market selections
- Question clicks
- Visualization interactions
- Report CTA clicks

### 8.4 Accessibility

- Keyboard navigation for all interactive elements
- ARIA labels on charts
- Screen reader descriptions
- Focus management

### 8.5 Performance

- Lazy load D3 components
- Memoize expensive calculations
- Skeleton loading states

---

## Implementation Order

### Sprint 1: Foundation
1. [ ] 1.1 useMyMarkets hook
2. [ ] 1.2 useMarketComparison hook
3. [ ] 1.3 useGraphsState hook
4. [ ] 1.4 Template configurations

### Sprint 2: Core UI
5. [ ] 2.1-2.3 MyMarketsBar (all sub-components)
6. [ ] 3.1-3.2 HeroComparison + TemplateTabs
7. [ ] 3.3 ScoreShowdown

### Sprint 3: Priorities & Templates
8. [ ] 3.4 PriorityBreakdown
9. [ ] 4.1 AffordabilityTemplate
10. [ ] 4.2 InvestmentTemplate
11. [ ] 3.5 TemplateVisualization

### Sprint 4: Sidebar & Page
12. [ ] 5.1-5.5 ExplorationSidebar (all sub-components)
13. [ ] 6.1 GraphsPage
14. [ ] 6.2 Routing update

### Sprint 5: D3 & Polish
15. [ ] 7.1 TrendComparison
16. [ ] 7.2-7.3 D3 enhancements
17. [ ] 4.3-4.4 Momentum + CashFlow templates

### Sprint 6: Integration
18. [ ] 8.1 AI Insight integration
19. [ ] 8.2 Report generation link
20. [ ] 8.3-8.5 Analytics, accessibility, performance

---

## File Checklist

### New Files to Create

```
packages/frontend/app/graphs/
├── GraphsPage.tsx                           # NEW
├── components/
│   ├── MyMarketsBar/
│   │   ├── MyMarketsBar.tsx                 # NEW
│   │   ├── MarketChip.tsx                   # NEW
│   │   └── AddMarketModal.tsx               # NEW
│   ├── HeroComparison/
│   │   ├── HeroComparison.tsx               # NEW
│   │   ├── TemplateTabs.tsx                 # NEW
│   │   ├── ScoreShowdown.tsx                # NEW
│   │   ├── PriorityBreakdown.tsx            # NEW
│   │   └── TemplateVisualization.tsx        # NEW
│   ├── ExplorationSidebar/
│   │   ├── ExplorationSidebar.tsx           # NEW
│   │   ├── QuestionCards.tsx                # NEW
│   │   ├── QuinnInsight.tsx                 # NEW
│   │   ├── MetricExplorer.tsx               # NEW
│   │   └── ReportCTA.tsx                    # NEW
│   └── templates/
│       ├── AffordabilityTemplate.tsx        # NEW
│       ├── InvestmentTemplate.tsx           # NEW
│       ├── MomentumTemplate.tsx             # NEW
│       └── CashFlowTemplate.tsx             # NEW
├── hooks/
│   ├── useGraphsState.ts                    # NEW
│   ├── useMarketComparison.ts               # NEW
│   ├── useMyMarkets.ts                      # NEW
│   └── useTemplateData.ts                   # NEW
└── constants/
    └── templates.ts                         # NEW

packages/frontend/lib/visualizations/d3/
└── TrendComparison.tsx                      # NEW
```

### Files to Modify

```
packages/frontend/app/graphs/page.tsx        # Add feature flag routing
packages/frontend/lib/visualizations/d3/ScatterPlot.tsx    # Add highlighting
packages/frontend/lib/visualizations/d3/Heatmap.tsx        # Add comparison mode
```

### Files to Keep (Reference)

```
packages/frontend/app/graphs/Dashboard.tsx   # Keep for fallback
packages/frontend/app/graphs/components/D3VisualizationSection.tsx  # Reuse for Custom template
packages/frontend/app/components/scoring/ScoreDisplay.tsx  # Reuse for gauges
```

---

## Dependencies

### Existing Components to Reuse
- `ScoreDisplay` - Score gauges
- `GeographySearch` - Market search
- `D3VisualizationSection` - Custom template
- `ScatterPlot`, `Heatmap` - D3 visualizations

### Existing Hooks to Reuse
- `useDashboardState` - Reference for state patterns
- `useChartData` - Reference for data fetching

### Existing Services to Reuse
- `geminiService` - AI insights
- `@/lib/data` - All data fetching

---

## Testing Strategy

### Unit Tests
- Hook logic (winner calculation, URL sync)
- Template configurations
- Metric formatting

### Integration Tests
- Market comparison flow
- Template switching
- Report generation link

### Visual Regression
- Prototype comparison screenshots
- Responsive breakpoints
- D3 visualization rendering

---

## Rollout Plan

1. **Feature Flag:** `graphs_redesign`
2. **Internal Testing:** 1 week
3. **A/B Test:** 2 weeks (50/50 split)
4. **Full Rollout:** Based on metrics
5. **Cleanup:** Remove old Dashboard.tsx

---

## Notes

- Keep existing Dashboard.tsx functional during transition
- All data fetching through `@/lib/data` layer
- Follow M3 design tokens from globals.css
- Mobile-first responsive design
