# Reports Redesign - Implementation Plan

## Phase 1: Backend Foundation

### Task 1.1: Add Priorities to Report Generation
**Files:** `packages/backend/src/reports/dto/generate-report.dto.ts`, `packages/backend/src/reports/reports.service.ts`

- Add `priorities` field to `GenerateReportDto` (array of 3 strings)
- Store priorities in report record
- Pass priorities to Claude context for narrative generation

### Task 1.2: Create Backtesting Data Endpoint
**Files:** `packages/backend/src/scoring/validation/validation.controller.ts`

- Expose `GET /api/scoring/validation/quintile-performance`
- Returns average returns by score quintile (Q1-Q5)
- Data already exists in `ValidationService.getQuintilePerformance()`

### Task 1.3: Add Priority-Weighted Winner Logic
**Files:** `packages/backend/src/reports/reports.service.ts`

- Create function `calculatePriorityWeightedWinner(markets, priorities, userType)`
- Map each priority to relevant metrics
- Score each market per priority, weight by position (1st = 3pts, 2nd = 2pts, 3rd = 1pt)
- Return winner with reasons

### Task 1.4: Update Claude Prompts
**Files:** `packages/backend/src/reports/claude.service.ts`

- Add new narrative sections for comparison reports:
  - `why_winner_won` - 3 reasons based on priorities
  - `market_overview` - per-market narrative
  - `final_recommendation` - personalized recommendation
- Include priority context in all prompts

---

## Phase 2: Frontend - Report Creation UI

### Task 2.1: Create PrioritySelector Component
**Files:** `packages/frontend/app/reports/components/PrioritySelector.tsx`

- Display 5 priority options based on user type (homebuyer/investor)
- Allow selecting and ordering top 3
- Visual feedback for selection order (1, 2, 3 badges)
- Export selected priorities

### Task 2.2: Integrate PrioritySelector into Reports Page
**Files:** `packages/frontend/app/reports/page.tsx`

- Add PrioritySelector to PersonalizationPanel
- Store priorities in state
- Pass priorities to report generation API

---

## Phase 3: Frontend - Comparison Template Sections

### Task 3.1: ComparisonHeroShowdown Component
**Files:** `packages/frontend/app/reports/[id]/components/sections/ComparisonHeroShowdown.tsx`

- Side-by-side score gauges for each market
- Winner badge on winning market
- Display user's priorities below
- Use existing ScoreGauge component for visuals

### Task 3.2: WhyWinnerWon Component
**Files:** `packages/frontend/app/reports/[id]/components/sections/WhyWinnerWon.tsx`

- Display 3 cards, one per priority
- Each card shows: priority name, winner for that priority, key metric comparison
- Icon and color coding per priority type
- Data from `report.data.why_winner_won` (AI-generated)

### Task 3.3: ScoreCredibility Component
**Files:** `packages/frontend/app/reports/[id]/components/sections/ScoreCredibility.tsx`

- Fetch quintile performance data
- Display historical returns by score bucket
- Calculate dollar impact based on market's median price
- Include disclaimer

### Task 3.4: MarketDeepDive Component
**Files:** `packages/frontend/app/reports/[id]/components/sections/MarketDeepDive.tsx`

- Reusable component rendered once per market
- Sections:
  - Market Overview (population, income, growth)
  - Score Breakdown (factors driving score)
  - 6 Key Metrics with sparklines
  - Risks & Opportunities (AI-generated)
- Use local benchmarks (parent county/metro/state)

### Task 3.5: AIRecommendation Component
**Files:** `packages/frontend/app/reports/[id]/components/sections/AIRecommendation.tsx`

- Display Claude-generated final recommendation
- Personalized to user inputs and priorities
- Next steps section with actionable items
- Styled as premium "money shot" section

### Task 3.6: Update Comparison Template
**Files:** `packages/frontend/app/reports/[id]/components/templates/index.ts`

- Replace current 3-section comparison template
- New section order:
  1. ComparisonHeroShowdown
  2. WhyWinnerWon
  3. ScoreCredibility
  4. ComparisonMetricsTable (existing, enhanced)
  5. MarketDeepDive (rendered per market)
  6. AIRecommendation

---

## Phase 4: Data Integration

### Task 4.1: Ensure Scores for All Markets
**Files:** `packages/backend/src/reports/reports.service.ts`

- Fetch scores for primary AND all comparison markets
- Include in report data payload

### Task 4.2: Add Local Benchmark Logic
**Files:** `packages/backend/src/reports/reports.service.ts`, `packages/frontend/app/reports/[id]/components/utils/benchmarks.ts`

- Create `getLocalBenchmark(geoType, geoId)` function
- Returns parent geography for comparison
- ZIP → County → Metro; County → Metro → State; Metro → State

### Task 4.3: Time Series for Sparklines
**Files:** `packages/backend/src/reports/reports.service.ts`

- Fetch 12-month time series for key metrics
- Include in report data for sparkline rendering
- Metrics: home_value, days_on_market, inventory

---

## Execution Order

1. **Backend first** (Tasks 1.1-1.4) - Foundation for everything else
2. **Report creation UI** (Tasks 2.1-2.2) - Users can select priorities
3. **Section components** (Tasks 3.1-3.6) - Build the visual sections
4. **Data integration** (Tasks 4.1-4.3) - Wire up all data sources

---

## Testing Checkpoints

After Phase 1:
- Generate a comparison report via API
- Verify priorities stored in report record
- Verify winner calculation logic

After Phase 2:
- UI allows priority selection
- Priorities sent to API

After Phase 3:
- View comparison report with all new sections
- Verify scores displayed for both markets
- Verify AI narratives reference priorities

After Phase 4:
- Verify local benchmarks (not national)
- Verify sparklines render with real data
