# Data Page & System-Wide Metric Tooltips

**Date:** 2026-02-16
**Status:** Approved

## Goal

Two connected features:
1. A `/data` page that acknowledges all data providers with descriptions, metric lists, and links to their portals.
2. A `<MetricTitle>` component that replaces raw metric name rendering everywhere in the system, adding a hover tooltip with metric metadata and a link to the relevant provider on the `/data` page.

## 1. The `/data` Page

**Route:** `/data`

Organized by data provider. Each provider gets a section with an anchor ID for deep-linking from tooltips.

### Providers

| Provider | Anchor | Metrics |
|----------|--------|---------|
| Realtor.com | `#realtor-com` | Listing price, inventory, DOM, new listings, pending, price cuts, hotness/demand/supply scores |
| Zillow | `#zillow` | Home values (ZHVI), rent index (ZORI), forecasts (ZHVF), sale-to-list, days to close, sale price, construction, affordability metrics |
| U.S. Census Bureau | `#census` | Population, median income, median age, homeownership rate, vacancy rate |
| FRED / Federal Reserve | `#fred` | Mortgage rates, unemployment (national/state/county) |
| Bureau of Labor Statistics | `#bls` | Job growth (QCEW), unemployment (metro) |
| Bureau of Economic Analysis | `#bea` | GDP growth, cost of living (RPP) |
| PropertyIQ (Calculated) | `#propertyiq` | HomeReady, InvestorEdge, MarketHealth scores, cap rate, gross yield, affordability index, months of supply, inventory surplus |

### Each Section Contains

- Provider name and icon/logo
- 1-2 paragraph description of who they are and what data they provide
- List of metrics we source from them
- Update frequency
- External link to the provider's data portal

### Layout

Uses existing site layout/nav. Clean, readable, similar to the scores methodology page.

## 2. The `<MetricTitle>` Component

**Location:** `packages/frontend/app/components/MetricTitle.tsx`

### Props

```typescript
interface MetricTitleProps {
  metricId: string;
  className?: string;        // Custom styling for the title text
  as?: 'span' | 'h3' | 'h4' | 'div';  // HTML element (default: span)
  showTooltip?: boolean;     // Opt-out escape hatch (default: true)
}
```

### Behavior

- Renders metric display name from `METRIC_DEFINITIONS`
- Falls back to `getMetricTitle()` from the data layer if no definition exists
- On hover (mouseenter with ~200ms delay), shows floating tooltip via `createPortal`
- Tooltip dismisses on mouseleave (with small delay so user can move cursor into tooltip)
- Title text gets a subtle dotted underline to signal "hoverable"
- Only one tooltip visible at a time

### Tooltip Content

Matches the current info popup pattern:
- **Name** (bold header)
- **Description** (1-2 sentences)
- **Formula** (if applicable, monospace)
- **Source / Updates / As of** metadata row
- **Notes** (if applicable, italic)
- **Source link** to `/data#provider-anchor`

### Viewport-Aware Positioning

The tooltip must always be fully visible without scrolling:
- Calculate available space in all four directions from trigger element
- Prefer below-right, flip above if insufficient room below, flip left if insufficient room right
- Clamp to viewport bounds with 8px margin from edges
- Check against `window.innerHeight` / `window.innerWidth` before rendering

### Touch Devices

On mobile/touch: tap to show tooltip, tap outside to dismiss.

### SVG Chart Axes

Y-axis labels in Recharts/D3 are SVG text nodes. For these, wrap the axis label area where possible, or skip tooltip on axes where technically impractical and rely on the legend/card tooltip instead.

## 3. Data Layer Changes

### Move Metric Definitions

Move `app/map/data/metricDefinitions.ts` to `lib/data/definitions.ts` since it's now used system-wide.

### Add Provider Anchor Mapping

Add a `providerAnchor` field (or a mapping from `dataSource` string to anchor slug) so the tooltip source link resolves to `/data#realtor-com`, `/data#zillow`, etc.

## 4. Integration Scope

### High-Traffic Surfaces (Phase 1)

1. **Map sidebar** `MetricItem.tsx` - replace `metric.name` + remove i-icon popup
2. **Map legend** `Legend.tsx` - replace `getMetricTitle()`
3. **Graph cards** `MetricQuickCards.tsx` - replace `getMetricTitle()`
4. **Chart section** `ChartSection.tsx` - Y-axis labels, series names
5. **Stat cards** `StatCard.tsx` - replace label rendering

### Reports (Phase 2)

6. `MetricDetail.tsx` - label text
7. `MetricGrid.tsx` - label text
8. `MetricHighlight.tsx` - label text
9. `MetricComparison.tsx` - label text
10. `ChartSingle.tsx` - chart title

### Score Components (Phase 3)

11. `ScoreCards.tsx` - sub-score indicator labels
12. `CompactScoreCard.tsx` - indicator labels
13. `ComponentBar.tsx` - component metric names

### Remaining Surfaces (Phase 4)

14. `MetricGraph.tsx` (legacy)
15. `AnimatedTimeSeriesChart.tsx`
16. `RadarChart.tsx` / `ComparisonRadar.tsx` - axis labels
17. Metric selectors/pickers

### Admin Pages (Phase 5)

18. `DataCardsTab.tsx` - metric health table
19. `ScoreCardsTab.tsx` - score metrics dashboard

## 5. Edge Cases

- **Unknown metrics** (not in `METRIC_DEFINITIONS`): render name as plain text, no hover. Degrades gracefully.
- **Multiple tooltips**: only one visible at a time; opening new one dismisses previous.
- **Fallback for missing fields**: tooltip omits sections (formula, notes) when the definition doesn't include them.
