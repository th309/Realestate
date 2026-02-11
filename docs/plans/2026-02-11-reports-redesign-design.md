# PropertyIQ Reports Redesign

## Overview

Redesign the reports system to only display data we actually collect (60 metrics in registry.ts) while providing deep AI analysis that contextualizes data with news, trends, and actionable insights.

**Core Principle:** The value isn't in raw data display—it's in AI-powered analysis that makes complex data consumable and actionable.

---

## Problem Statement

Current issues:
1. **39 section components** exist but many reference data we don't collect (migration patterns, detailed demographics, etc.)
2. **Shallow analysis** - AI summaries restate data rather than providing insight
3. **Missing context** - No integration with news, economic signals, or trend momentum
4. **Score opacity** - Scores shown without explaining "so what does this mean?"

---

## Available Data (Source of Truth: registry.ts)

### 60 Metrics by Category

**Home Values (8 metrics)**
- home_value, zhvi, median_listing_price, median_sale_price
- price_per_sqft, home_value_forecast, appreciation_rate, overvalued_pct

**Rent (5 metrics)**
- rent_index, rent_zhvi, gross_yield, rent_growth, rent_to_income

**Market Activity (8 metrics)**
- days_on_market, inventory, active_listings, new_listings
- pending_sales, sold_above_list, price_cuts, months_of_supply

**Affordability (4 metrics)**
- affordability_index, mortgage_rate, median_income, price_to_income

**Investor Metrics (5 metrics)**
- cap_rate, cash_on_cash, noi, expense_ratio, vacancy_rate

**Economy (6 metrics)**
- unemployment_rate, job_growth, gdp_growth, population_growth
- cost_of_living, median_household_income

**Construction (3 metrics)**
- building_permits, housing_starts, construction_costs

**Scores (PropertyIQ proprietary)**
- homeready_score, investor_score, market_timing_score

---

## AI Analysis Framework

### The Analysis Layer

Each section combines:
1. **Data Layer** - Metrics from registry.ts with 6-month trends
2. **News Layer** - Local news via GeminiNewsService (already built)
3. **Context Layer** - Economic indicators, market signals, national context
4. **Interpretation Layer** - Claude-generated analysis with actionable insights

### Score Contextualization

Scores must answer "so what?" with:

```
Score: 82 (Excellent)

What this means: If you had bought here 3 years ago, you would have
earned 47% above the state average return. Current conditions suggest
similar outperformance potential.

Dollar impact: On a $400K home, this score historically correlates
with $28,000 more equity vs. state average after 3 years.

Peer comparison: Top 15% of metros in your price range.
```

### Trend Analysis Integration

Existing infrastructure (`historyMonths` param, `trendUtils.ts`) provides:
- 6-month sparkline data for each metric
- Percent change and direction
- Batch fetching for efficiency

AI uses trends for:
- **Momentum signals** - "Accelerating from 2.8% to 4.2%"
- **Divergence detection** - "Rent growth outpacing wages"
- **Inflection points** - "Days on market reversed trend"
- **Seasonal context** - "Strong given typical Q4 slowdown"

---

## Report Templates

### 1. HomeReady Report (Homebuyers)

**Audience:** First-time and move-up buyers evaluating locations

**Sections:**
1. Executive Summary (1 page)
2. HomeReady Score Deep Dive (2 pages)
3. Affordability Reality Check (2 pages)
4. Market Conditions & Timing (1 page)
5. Neighborhood Quality Signals (1 page)
6. What Could Go Wrong (1 page)
7. Recommended Next Steps (1 page)

**Unique AI Focus:**
- Monthly payment scenarios at current rates
- "Can you afford to wait?" analysis
- School district and amenity proximity
- Commute time trade-offs

### 2. InvestorEdge Report (Investors)

**Audience:** Buy-and-hold and BRRRR investors

**Sections:**
1. Investment Thesis (1 page)
2. Cash Flow Analysis (2 pages)
3. Appreciation Outlook (2 pages)
4. Growth Catalysts & News (1 page)
5. Risk Assessment (1 page)
6. Comparable Markets (1 page)
7. Deal Criteria Summary (1 page)

**Unique AI Focus:**
- Cap rate decomposition and trends
- Cash-on-cash at various leverage levels
- News-driven catalyst identification
- Exit strategy considerations

### 3. Market Snapshot (Agents/Professionals)

**Audience:** Real estate agents, appraisers, lenders

**Sections:**
1. Market Pulse (1 page)
2. Price Trends & Forecast (1 page)
3. Supply & Demand Dynamics (1 page)
4. Days on Market Analysis (1 page)
5. Buyer/Seller Balance (1 page)
6. Economic Backdrop (1 page)
7. Competitive Landscape (1 page)
8. Talking Points (1 page)

**Unique AI Focus:**
- Listing price strategy recommendations
- Negotiation leverage indicators
- Client communication talking points
- Market timing signals

---

## Section-to-Metric Mapping

| Section | Required Metrics | AI Analysis Focus |
|---------|-----------------|-------------------|
| Market Overview | home_value, median_listing_price, days_on_market | Price trajectory, market tempo |
| Affordability | home_value, median_income, mortgage_rate, affordability_index | Buying power, monthly cost reality |
| Rental Analysis | rent_index, rent_zhvi, gross_yield, rent_to_income | Rent vs buy math, yield trends |
| Investment Metrics | cap_rate, cash_on_cash, noi, appreciation_rate | Return decomposition, risk-adjusted |
| Supply/Demand | active_listings, new_listings, pending_sales, months_of_supply | Inventory dynamics, competition |
| Economic Context | unemployment_rate, job_growth, gdp_growth, population_growth | Employment stability, growth catalysts |
| Construction | building_permits, housing_starts | Future supply pipeline |

---

## Technical Implementation

### Phase 1: Data Layer Cleanup

1. **Audit existing sections** - Map 39 components to registry metrics
2. **Remove unsupported** - Delete sections for uncollected data
3. **Wire historical** - Populate `historical: {}` in reports.service.ts

### Phase 2: AI Enhancement

1. **Integrate GeminiNewsService** - Already built, needs wiring
2. **Add trend interpretation** - Pass 6-month data to prompts
3. **Score contextualization** - Historical validation + dollar impact

### Phase 3: Template Implementation

1. **Shared primitives** - SectionCard, MetricDisplay, TrendSparkline, AIAnalysisBlock
2. **Template-specific sections** - Organized by audience
3. **Conditional rendering** - Only show sections with available data

### File Structure

```
packages/frontend/app/reports/[id]/components/sections/
  ├── core/           # Shared section primitives
  │   ├── SectionCard.tsx
  │   ├── MetricDisplay.tsx
  │   ├── TrendSparkline.tsx
  │   └── AIAnalysisBlock.tsx
  ├── homebuyer/      # HomeReady sections
  ├── investor/       # InvestorEdge sections
  └── shared/         # Used by multiple templates
```

### Data Flow

```
Report Request
    ↓
┌─────────────────────────────────────────────────┐
│  reports.service.ts                              │
│  1. Fetch metrics from registry                  │
│  2. Fetch 6-month trends (historyMonths=6)       │
│  3. Fetch news via GeminiNewsService             │
│  4. Generate AI analysis via ClaudeService       │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│  Report Data Structure                           │
│  {                                               │
│    metrics: { [id]: { current, trend } },        │
│    news: { local: [], economic: [] },            │
│    scores: { homeready, investor, timing },      │
│    analysis: { sections: [...] }                 │
│  }                                               │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│  ReportViewer.tsx                                │
│  - Selects template based on report type         │
│  - Renders only sections with data               │
│  - Displays AI analysis blocks                   │
└─────────────────────────────────────────────────┘
```

---

## Sections to Remove

Components referencing data we don't collect:
- Migration patterns (no migration data)
- Detailed demographics beyond population
- Crime statistics
- School ratings (beyond proximity)
- Walkability scores
- Transit scores
- Environmental risk details
- HOA analysis
- Property tax projections

---

## Development Principles

**Real Data Only** - No mock data, no hardcoded fallbacks, no placeholder values. If data isn't available, the section doesn't render. This ensures:
- Reports are always accurate
- We never mislead users with fabricated numbers
- Development uses real API calls, not fixtures

## Success Criteria

1. **Every section** maps to metrics in registry.ts
2. **AI analysis** provides insight beyond data summary
3. **Trends** shown with sparklines and momentum context
4. **Scores** explain real-world dollar impact
5. **News integration** surfaces relevant local context
6. **No fake data** - sections hide gracefully when data unavailable
7. **Real data development** - All dev/test uses live API, no mocks

---

## Next Steps

1. [ ] Audit and remove unsupported section components
2. [ ] Wire historical data into reports.service.ts
3. [ ] Create shared section primitives
4. [ ] Implement HomeReady template first
5. [ ] Add news integration to AI prompts
6. [ ] Build score contextualization logic
7. [ ] Implement InvestorEdge and Market Snapshot templates
