# Graphs Feature UX Audit

**Date:** 2026-02-12
**Feature:** `/graphs` page
**Status:** Analysis Complete

---

## Executive Summary

The graphs feature is a **powerful but complex analytics tool** with two modes:
1. **Time Series Mode** - Traditional charts with comparison and baseline capabilities
2. **Advanced Mode** - D3 visualizations (scatter plots, heatmaps, correlation matrices)

**Verdict:** High potential, but steep learning curve limits adoption.

---

## Current User Flow

```
Geography Level Selection (state/metro/county/zip)
    ↓
Location Search/Selection
    ↓
Metric Selection (100+ options in flat list)
    ↓
[Optional] Add Comparison Location
    ↓
[Optional] Add Baseline (national/state)
    ↓
View Chart
    ↓
[Optional] Switch to Advanced Mode
```

**File:** `packages/frontend/app/graphs/page.tsx`

---

## Strengths

### 1. Comprehensive Metric Coverage
- 100+ metrics across categories
- Good mix of pricing, inventory, affordability, demographics
- PropertyIQ scores integrated

### 2. Educational Helpers
- `VisualizationInsights` component explains chart interpretation
- Metric definitions in `lib/data/registry.ts`
- Contextual help available

### 3. Dual-Mode Flexibility
- Time series for trend analysis
- Advanced mode for cross-market comparison
- Appropriate tool for different questions

### 4. Data Architecture
- Follows `lib/data` patterns correctly
- Uses `useTimeSeriesData` hook
- Proper caching and error handling

---

## Pain Points

### 1. Steep Learning Curve
**Problem:** 5 sequential decisions before seeing any data
**Impact:** Users abandon before seeing value
**Evidence:** Blank slate on first load, no guidance

**Recommendation:** Smart defaults based on user's location or recent reports

### 2. Poor Discoverability
**Problem:** 100+ metrics in flat list
**Impact:** Users don't know what questions they can answer
**Location:** `app/graphs/MetricSelector.tsx`

**Recommendation:**
- Group by category (Pricing, Inventory, Affordability, etc.)
- Add search with fuzzy matching
- Quick-pick buttons for popular metrics

### 3. Context Loss
**Problem:** Changing geography level resets location selection
**Impact:** Frustrating workflow, lost context
**Location:** `app/graphs/page.tsx` useEffect dependencies

**Recommendation:** Attempt to preserve selection (e.g., switching from ZIP to county keeps the parent county selected)

### 4. Limited Shareability
**Problem:** URL params read but never updated
**Impact:** Can't share configured views with colleagues
**Evidence:** `useSearchParams` read-only usage

**Recommendation:** Sync all state to URL (geography, metric, comparison, baseline)

### 5. Advanced Mode Confusion
**Problem:** Advanced mode shows nationwide comparison, not focused view
**Impact:** Users expect "advanced" to mean deeper analysis of their selected area
**Location:** `components/advanced-mode/`

**Recommendation:**
- Rename to "Cross-Market Analysis" or "National Comparison"
- Add focused deep-dive mode for single market

### 6. Mobile Experience
**Problem:** Cramped filters, no touch gestures
**Impact:** Graphs page unusable on mobile
**Location:** `app/graphs/page.tsx` responsive classes

**Recommendation:**
- Collapsible filter panel
- Full-width charts
- Swipe to navigate time periods

---

## What Users CAN Answer

- "How has home value changed in Austin over time?"
- "How does Denver's inventory compare to Phoenix?"
- "Is this market above or below national average?"
- "What's the correlation between home values and rents across metros?"
- "Which metros have the highest cap rates?"

## What Users CANNOT Easily Answer

- "What's happening in my area right now?" (no quick summary)
- "What should I look at?" (no recommendations)
- "Why is this metric important?" (definitions exist but not contextual)
- "How does my market rank nationally?" (need advanced mode knowledge)

---

## Prioritized Recommendations

### Quick Wins (1-2 weeks)

| Item | Impact | Effort |
|------|--------|--------|
| Smart defaults (auto-select user's state/metro) | High | Low |
| Popular metrics quick-picks | High | Low |
| Sync state to URL | Medium | Low |
| Value proposition banner | Medium | Low |
| Rename comparison vs baseline | Low | Trivial |

### Core Improvements (3-4 weeks)

| Item | Impact | Effort |
|------|--------|--------|
| Metric category groups + search | High | Medium |
| Preserve geography context | Medium | Medium |
| Export features (PNG, CSV) | Medium | Medium |
| Mobile optimization | Medium | Medium |
| AI insights on load | High | Medium |

### Power Features (1-2 months)

| Item | Impact | Effort |
|------|--------|--------|
| Multi-metric overlays | High | High |
| Custom date range picker | Medium | Medium |
| Saved configurations | Medium | High |
| Annotation layer | Low | High |
| Advanced mode focus option | Medium | High |

---

## Essential Files

```
packages/frontend/app/graphs/
├── page.tsx              # Main page, state management
├── MetricSelector.tsx    # Metric dropdown
├── GeographySelector.tsx # Location picker
├── ChartContainer.tsx    # Time series rendering
├── components/
│   └── advanced-mode/    # D3 visualizations
│       ├── ScatterPlot.tsx
│       ├── Heatmap.tsx
│       └── CorrelationMatrix.tsx
└── hooks/
    └── useGraphsData.ts  # Data fetching
```

---

## Next Steps

1. Implement smart defaults using browser geolocation or user profile
2. Add metric categories to `lib/data/registry.ts`
3. Create URL state sync utility
4. Design mobile-first filter panel

---

## Appendix: Competitive Reference

- **Zillow:** Simple, single-metric focus, limited comparison
- **Redfin:** Good mobile experience, integrated with listings
- **FRED:** Power user oriented, excellent date ranges

PropertyIQ graphs can differentiate by:
- PropertyIQ score integration (unique)
- AI-powered insights (unique)
- Cross-market comparison tools (strong)
