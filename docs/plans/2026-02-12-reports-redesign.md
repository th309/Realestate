# Reports Redesign - Premium Market Analysis

**Date:** 2026-02-12
**Status:** Approved for Implementation
**Goal:** Transform reports from "data dumps" into premium, personalized analysis worth $30/month

---

## Problem Statement

Current reports are insufficient:
- Missing PropertyIQ scores in comparison reports
- No AI-generated analysis or narrative
- No market overview section
- Data inconsistency between markets
- No personalization based on user priorities
- Score credibility not demonstrated

---

## Solution Overview

### Report Structure: Hybrid Approach

```
PART 1: THE VERDICT (Comparison)
├── Hero Score Showdown (side-by-side scores with winner)
├── Why The Winner Won (3 reasons tied to user priorities)
├── Score Credibility Block (backtesting proof)
└── Quick Metrics Comparison Table

PART 2: MARKET DEEP-DIVES (Full analysis per market)
├── Market Overview (population, income, growth story)
├── Score Breakdown (transparent - what drives the score)
├── 6 Key Metrics with Trends (local benchmarks)
├── Affordability/Cash Flow Analysis (personalized)
└── Risks & Opportunities (AI-generated)

PART 3: FINAL RECOMMENDATION
└── AI-synthesized personalized recommendation with next steps
```

---

## Priority Selection System

Users select their top 3 priorities which influence winner determination and AI analysis.

### Homebuyer Priorities (pick 3)

| Priority | Metrics Influenced |
|----------|-------------------|
| Affordability | Income-to-price ratio, monthly payment, down payment needed |
| Appreciation | HomeReady score weight, price forecast, 5-year CAGR |
| Job Market | Employment rate, job growth YoY, income growth, remote work % |
| Market Timing | Days on market, inventory, price cuts %, buyer vs seller |
| Lifestyle | Population density, median age, growth trends |

### Investor Priorities (pick 3)

| Priority | Metrics Influenced |
|----------|-------------------|
| Cash Flow | Cap rate, gross yield, rent-to-price ratio, GRM |
| Appreciation | InvestorEdge score, price forecast, historical CAGR |
| Tenant Demand | Rental demand index, vacancy indicators, rent growth |
| Entry Price | Median price, price per sq ft, vs local benchmark |
| Stability | Price volatility, months of supply, market health consistency |

---

## Part 1: The Verdict

### 1A. Hero Score Showdown

```
┌─────────────────────────────────────────────────────────────┐
│                    AUSTIN, TX  vs  DENVER, CO               │
├─────────────────────────────────────────────────────────────┤
│     [Gauge: 78]          VS          [Gauge: 84]           │
│     HomeReady: B+                    HomeReady: A-     ★    │
│                                                             │
│     🏆 DENVER WINS for your priorities                      │
│     Based on: 1) Affordability  2) Appreciation  3) Jobs   │
└─────────────────────────────────────────────────────────────┘
```

- Both scores displayed with visual gauges
- Winner badge on winning market
- Winner determined by priority-weighted scoring, not raw score
- References user's selected priorities

### 1B. Why The Winner Won

```
┌─────────────────────────────────────────────────────────────┐
│  WHY DENVER WINS FOR YOU                                    │
├─────────────────────────────────────────────────────────────┤
│  1. 💰 More Affordable (Your #1 Priority)                   │
│     Home prices are 12% lower relative to local incomes.    │
│     You'd need $89K income in Denver vs $102K in Austin.    │
│                                                             │
│  2. 📈 Stronger Appreciation Outlook (Your #2 Priority)     │
│     Zillow forecasts +4.2% growth vs Austin's +2.8%.        │
│                                                             │
│  3. 💼 Austin Edges on Jobs (Your #3 Priority)              │
│     Austin's job growth is 3.2% vs Denver's 2.4%.           │
│     But Denver's unemployment is lower (3.1% vs 3.8%).      │
└─────────────────────────────────────────────────────────────┘
```

- Exactly 3 reasons tied to user's 3 priorities
- Real metric values, not placeholders
- Honest when loser wins on a specific priority

### 1C. Score Credibility Block

```
┌─────────────────────────────────────────────────────────────┐
│  WHAT THESE SCORES MEAN                                     │
├─────────────────────────────────────────────────────────────┤
│  Denver's HomeReady Score: 84 (A-)                          │
│                                                             │
│  📊 HISTORICAL PERFORMANCE OF A-RATED MARKETS               │
│                                                             │
│  Markets scoring 80-89 have historically delivered:         │
│     +34% appreciation over 3 years                          │
│     vs +18% for median markets                              │
│     vs +7% for markets scoring 30-39                        │
│                                                             │
│  💵 ON A $500K HOME, THAT'S:                                │
│     A-rated: +$170,000 equity gain                          │
│     Median:  +$90,000 equity gain                           │
│                                                             │
│  Based on PropertyIQ backtesting across 384 metros,         │
│  2018-2024. Past performance ≠ future results.              │
└─────────────────────────────────────────────────────────────┘
```

Data source: `ValidationService.getQuintilePerformance()` - uses real backtesting data

### 1D. Quick Metrics Comparison Table

8-10 key metrics with winner indicator per row:
- HomeReady/InvestorEdge Score
- Median Home Price
- Price YoY Change
- Price Forecast (1yr)
- Affordability Index
- Days on Market
- Inventory Level
- Market Heat

---

## Part 2: Market Deep-Dives

Full analysis for each market in the comparison.

### 2A. Market Overview

Population, median income, growth rates, unemployment - the "vibe" of the market.

### 2B. Score Breakdown

Transparent view of what's driving the score up/down:
- ↑ Strong appreciation history (+8.2% 5yr CAGR)
- ↑ Robust job market (3.2% growth)
- ↓ Affordability stretched (5.8x income-to-price)
- ↓ Low inventory pressure (1.8 months supply)

### 2C. 6 Key Metrics with Trends

**Homebuyer Metrics:**
1. Median Home Price (12-month sparkline)
2. Price YoY Change (% with arrow)
3. HomeReady Score (gauge)
4. Affordability Index (vs local benchmark)
5. Days on Market (12-month sparkline)
6. Price Forecast 1yr (Zillow forecast %)

**Investor Metrics:**
1. Median Home Price (12-month sparkline)
2. Cap Rate / Gross Yield (vs local benchmark)
3. InvestorEdge Score (gauge)
4. Rent Growth YoY (% with arrow)
5. Price Forecast 1yr (Zillow forecast %)
6. Rent-to-Price Ratio (vs local benchmark)

### 2D. Local Benchmark Logic

**Never use national averages.** Real estate is local.

| Geography Analyzed | Primary Benchmark | Secondary Benchmark |
|-------------------|-------------------|---------------------|
| ZIP Code | Parent County | Parent Metro |
| City | Parent Metro | State |
| County | Parent Metro | State |
| Metro | State | Region |

### 2E. Affordability/Cash Flow Analysis

Personalized to user's inputs (income, down payment).

### 2F. Risks & Opportunities

AI-generated honest assessment of each market.

---

## Part 3: Final Recommendation

AI-synthesized recommendation personalized to user's inputs and priorities.

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 PROPERTYIQ RECOMMENDATION                               │
├─────────────────────────────────────────────────────────────┤
│  Based on your priorities (Affordability → Appreciation     │
│  → Job Market) and financial profile ($95K income,          │
│  $60K down payment):                                        │
│                                                             │
│  DENVER is the stronger choice for you.                     │
│                                                             │
│  You can comfortably afford a median-priced home in Denver  │
│  with a monthly payment of $2,340 (28% of income). Austin   │
│  would stretch you to 34% of income.                        │
│                                                             │
│  The one trade-off: Austin's job market is growing faster.  │
│  If your career depends on a specific industry concentrated │
│  in Austin, that may outweigh the affordability advantage.  │
│                                                             │
│  NEXT STEPS:                                                │
│  • Get pre-approved with a Denver lender                    │
│  • Explore neighborhoods in your budget                     │
│  • Ask Quinn any follow-up questions                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Data Sources

- **Scores:** `ScoringService` - HomeReady, InvestorEdge, MarketHealth
- **Backtesting:** `ValidationService.getQuintilePerformance()` - score credibility data
- **Metrics:** `METRICS` registry in `lib/data/registry.ts` - 50+ metrics
- **Time Series:** `TimeSeriesService` - sparklines and trends
- **AI Narratives:** `ClaudeService` - analysis and recommendations

### Template Updates

Update `REPORT_TEMPLATES` in `/reports/[id]/components/templates/index.ts`:

```typescript
comparison: {
  name: 'Market Comparison',
  description: 'Premium side-by-side market comparison',
  sections: [
    // Part 1: The Verdict
    { component: ComparisonHeroShowdown, id: 'hero-showdown' },
    { component: WhyWinnerWon, id: 'why-winner-won' },
    { component: ScoreCredibility, id: 'score-credibility' },
    { component: ComparisonMetricsTable, id: 'metrics-table' },

    // Part 2: Deep-Dives (rendered per market)
    { component: MarketDeepDive, id: 'market-deep-dive' },

    // Part 3: Final Recommendation
    { component: AIRecommendation, id: 'ai-recommendation' },
  ],
}
```

### New Components Needed

1. `ComparisonHeroShowdown` - Side-by-side score gauges with winner
2. `WhyWinnerWon` - 3 reasons based on priorities
3. `ScoreCredibility` - Backtesting proof block
4. `MarketDeepDive` - Full market analysis (reusable per market)
5. `AIRecommendation` - Claude-generated final recommendation
6. `PrioritySelector` - UI for selecting top 3 priorities

### API Changes

1. Add `priorities` field to report generation request
2. Add endpoint for quintile/backtesting data
3. Update Claude prompts to include priority context

---

## Success Criteria

1. Comparison reports include PropertyIQ scores for ALL markets
2. AI-generated analysis personalized to user priorities
3. Score credibility block with real backtesting data
4. Local benchmarks (not national) for all comparisons
5. Clear winner declaration with data-backed reasoning
6. User feedback: "This was worth $30"
