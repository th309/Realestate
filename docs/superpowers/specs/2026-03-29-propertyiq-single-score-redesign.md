# PropertyIQ Single Score Redesign — v4 Demand Signal

**Date:** 2026-03-29
**Status:** Approved
**Author:** Troy + Claude
**Scope:** Replace 3 scores (HomeReady, InvestorEdge, MarketHealth) with a single PropertyIQ Score across the entire platform

---

## 1. Executive Summary

PropertyIQ currently displays three separate scores (HomeReady, InvestorEdge, MarketHealth), each computed from ~10 ML-weighted metrics with audience-specific framing (homebuyers vs investors). This redesign consolidates everything into a **single PropertyIQ Score** based on the validated v4 Demand Signal formula — 3 Redfin metrics, one number, universal audience.

**Why:** The v4 formula outperforms the v3 multi-score system on every validation metric (IC 0.24 vs ~0.18, 100% year-over-year consistency, 75+ sigma from random). Simpler formula, stronger signal, less user confusion.

**Key decisions made:**

- Single score for everyone — no homebuyer/investor split
- Primary audience: realtors and investors
- Redfin-only coverage (746 metros, 2,983 counties, 19,880 ZIPs) — no proxy fallback
- ScoreCard shows 3 raw metrics + state-relative context (self-contained, no methodology page needed)
- Reports page: single report type, no toggle
- Scores page: marketing + methodology (leaderboard stays on /markets)
- Homepage: build both hero variants, A/B test later with PostHog
- Database: same `propertyiq_scores` table, `score_type = 'propertyiq'`
- Two hero stats everywhere: **Q5 vs Q1 dollar gap** and **alpha**

---

## 2. The Score

### 2.1 Formula

The PropertyIQ Score is computed from 3 Redfin market indicators measuring supply-demand imbalance:

| Metric                  | Source | Direction           | What It Captures             |
| ----------------------- | ------ | ------------------- | ---------------------------- |
| % Sold Above List Price | Redfin | + (higher = hotter) | Buyer competition intensity  |
| Median Days on Market   | Redfin | - (lower = hotter)  | Speed of absorption          |
| Months of Supply        | Redfin | - (lower = hotter)  | Inventory relative to demand |

**Signal computation (each month, cross-sectional):**

```
signal = z(sold_above_list) - z(median_dom) - z(months_of_supply)
```

Where `z()` = cross-sectional standardization (subtract national mean, divide by std dev) computed independently each month across all locations at the same geography level.

**Score construction:**

1. Percentile-rank the signal across all locations within the month (0-100)
2. Re-center so percentile 55.6 (the zero-crossing for excess return) maps to score 50
3. Below 50: raw percentile [0, 55.6] → score [1, 50] (linear)
4. Above 50: raw percentile [55.6, 100] → score [50, 99] (linear)

**Score semantics:**

- Score 50 = predicted to match state average
- Higher = predicted outperformance vs state
- Lower = predicted underperformance vs state
- The mapping is strictly monotonic at 10-point granularity

### 2.2 Validation Headline Stats

These two stats appear across the entire site:

| Stat                                | Value                                 | Source                                                             |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| **Q5 vs Q1 dollar gap (3Y, metro)** | **$18,100**                           | v4 report Section 2.3: Score 80+ vs Score 20, median home $245,361 |
| **Alpha (3Y quintile spread)**      | **+7.83pp**                           | v4 report Section 1: OOS quintile spread                           |
| Year hit rate (Q5 > Q1)             | 100% (14/14 years at 1Y, 12/12 at 3Y) | v4 report Section 8                                                |
| Information Ratio                   | 3.65 (1Y), 6.56 (3Y)                  | v4 report Section 4.3                                              |
| Permutation significance            | p = 0.000000 (75+ sigma)              | v4 report Section 5.1                                              |

### 2.3 Coverage

| Geography | Count      | Requirement          |
| --------- | ---------- | -------------------- |
| Metros    | 746        | Redfin data required |
| Counties  | 2,983      | Redfin data required |
| ZIP Codes | 19,880     | Redfin data required |
| **Total** | **23,609** |                      |

Markets without Redfin data show "Score unavailable — insufficient market data." No proxy fallback formula.

### 2.4 Confidence

Confidence (A/B/C/F letter grade) is driven by Redfin data completeness and freshness:

- All 3 metrics present and < 60 days old → A
- All 3 present, 60-120 days old → B
- 1-2 metrics missing or > 120 days old → C
- Cannot compute signal → F (no score displayed)

---

## 3. Backend Changes

### 3.1 Scoring Engine (`packages/backend/src/scoring/`)

**`formula-weights.ts`** — Full rewrite:

- `ScoreType` changes from `'homeready' | 'investoredge' | 'markethealth'` to `'propertyiq'`
- Remove all `GeographyFormulas` with per-type weight configs
- Replace with the v4 3-metric formula definition
- Remove `SCORE_CALIBRATION` per-type entries

**`scoring-engine.ts`** — Simplify:

- Remove iteration over `['homeready', 'investoredge', 'markethealth']`
- Replace ML-weighted z-score calculation with: `signal = z(sold_above_list) - z(median_dom) - z(months_of_supply)`
- Replace weighted normalization with percentile ranking + re-centering at 55.6
- Remove component breakdown calculation (no more Affordability, Cash Flow, etc.)

**`scoring-data-fetcher.ts`** — Simplify:

- Only need 3 Redfin columns: `sold_above_list`, `median_dom`, `months_of_supply`
- Remove supplementary fetches from Census, Economic, Zillow, Realtor tables
- Remove `scoring-supplementary-fetchers.ts` imports

**`scoring-persistence.ts`** — Minor change:

- Change iteration from 3 score types to single `'propertyiq'`
- Upsert logic stays the same

**`scoring-queries.ts`** — Simplify:

- `scoresByType: Record<ScoreType, SingleScoreResult>` collapses to single result
- Default `score_type` filter to `'propertyiq'`

**`scoring.controller.ts`** — Update:

- `validateScoreType()` accepts `'propertyiq'` (add backward-compat mapping: `homeready` → `propertyiq`, etc.)
- All endpoints default `score_type` to `'propertyiq'`
- Remove multi-score response assembly

**`scoring.types.ts`** — Update:

- Re-export new `ScoreType = 'propertyiq'`
- Remove component breakdown types (Affordability, Cash Flow, etc.)
- Add `InputMetricRow` type for the 3 Redfin metrics

**`scoring.guard.ts`** — Simplify:

- `RequireScoreAccess()` no longer needs per-type checking
- Single tier check for PropertyIQ Score access

### 3.2 Related Backend Services

These services reference old score types and need updating:

| Service                                     | Key Change                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `insights/insight-context-builder.ts`       | Collapse `homeready`/`investoredge`/`market_health` score extraction to single `propertyiq` |
| `insights/insight-prompts.ts`               | Replace 3-score prompt template with single PropertyIQ Score reference                      |
| `insights/blog-prompts.ts`                  | Rewrite "Top Markets for Homebuyers/Investors" to unified "Top PropertyIQ Markets"          |
| `analytics-chat/quinn-system-prompt.ts`     | Full rewrite: remove user-type-to-score-type routing, collapse to `propertyiq_score`        |
| `reports/report-ai-prompt-builders.ts`      | Remove `heroScore = userType === 'investor' ? 'InvestorEdge' : 'HomeReady'` conditional     |
| `reports/prompts-v2/comparison-sections.ts` | Replace `{{homeready_score}}`, `{{investoredge_score}}` with `{{propertyiq_score}}`         |
| `reports/prompts-v2/homeready-sections.ts`  | Rewrite for unified score                                                                   |
| `reports/prompts-v2/investor-sections.ts`   | Rewrite for unified score                                                                   |
| `alerts/threshold-alert.service.ts`         | Change score columns from `homeready_score`/`investoredge_score` to `propertyiq_score`      |
| `email/monthly-digest-data.service.ts`      | Change `.eq('score_type', 'homeready')` to `.eq('score_type', 'propertyiq')`                |
| `platform-api/v1/scores.controller.ts`      | Change `VALID_SCORE_TYPES` to `['propertyiq']` with backward-compat aliases                 |
| `platform-api/v1/rankings.controller.ts`    | Same as above                                                                               |
| `admin-metrics/services/`                   | Update default score type across all metric services                                        |

### 3.3 Database Migration

**No schema change needed.** Same `propertyiq_scores` table.

**Migration steps (in order):**

1. Deploy new scoring engine with v4 formula
2. Run v4 calculation: `POST /api/scores/calculate/metro`, then county, then ZIP
3. Verify new `propertyiq` rows exist with expected counts (746 + 2,983 + 19,880)
4. Spot-check: compare a sample of v4 scores against the Python validation output
5. `DELETE FROM propertyiq_scores WHERE score_type IN ('homeready', 'investoredge', 'markethealth')`
6. Verify no orphaned references

**Rollback:** If v4 scores are problematic, re-run v3 calculation (code preserved in git history). The delete in step 5 is the point of no return — take a backup first.

---

## 4. Frontend Changes

### 4.1 Type System

**`packages/frontend/app/map/hooks/score-data.types.ts`:**

```typescript
// NEW
export type ScoreType = "propertyiq";

/** @deprecated Kept for backward compat with cached responses */
export type LegacyScoreType = "market_health" | "homeready" | "investoredge";
export type AnyScoreType = ScoreType | LegacyScoreType;
```

**`AllScoresResponse`:** Add `propertyiq` key, mark old keys as `@deprecated` and optional.

**`packages/frontend/lib/data/types.ts`:** Same change — `ScoreType = 'propertyiq'`.

### 4.2 Score Components (`packages/frontend/app/components/scoring/`)

**ScoreCard — New breakdown design:**

Remove the `ComponentBar`-based breakdown (Affordability, Cash Flow, etc.). Replace with:

1. **Input Metrics Section** — 3 rows:

   ```
   % Sold Above List    62.3%     73rd percentile
   Median DOM           14 days   81st percentile
   Months of Supply     1.8       68th percentile
   ```

2. **Derived Context Section:**

   ```
   State Comparison: 12 pts above Texas average
   Percentile Rank: 74th of 746 metros
   Historical: Score 70-80 → +1.5% above state avg over 3Y
   ```

3. **One-Line Alpha Summary:**
   ```
   Score 78 → historically +1.5% above state avg over 3Y
   ```

New interface:

```typescript
interface ScoreCardProps {
  type: "propertyiq";
  inputMetrics?: InputMetricRow[]; // 3 Redfin metrics
  stateComparison?: { delta: number; stateName: string };
  percentileRank?: { rank: number; total: number };
  historicalAlpha?: { scoreRange: string; excessReturn: number; years: number };
  // Keep: label, score, trend, access, status, confidence, history
  // Remove: components, ComponentDetail[]
}

interface InputMetricRow {
  name: string; // "% Sold Above List"
  value: string; // "62.3%"
  percentile: number; // 73
}
```

**ScoreBadge — Remove type-specific colors:**

- `getTypeColor()` → always returns indigo (PropertyIQ brand)
- `getTypeLabelColor()` → always returns `"text-indigo-700"`

**ScoreWidget — Simplify:**

- Remove `scoreType` → `key` mapping (`market_health` → `marketHealth`, etc.)
- Always read `data.propertyiq`

**ScoreHistoryChart — Simplify:**

- Remove label map (`homeready: "HomeReady"`, etc.)
- Always label as "PropertyIQ Score"

### 4.3 Homepage (`packages/frontend/app/components/home/`)

**Build both hero variants:**

**Variant A: "Lead with Proof"**

- Headline: "Know which markets will outperform."
- Subheadline: "Our score predicted the winners in 100% of years tested — across 746 metros over 13 years."
- 3 stat cards: `+$18,100` (Q5-Q1 gap), `100%` (year hit rate), `7.83pp` (alpha)

**Variant B: "Cost of Inaction"**

- Headline: "The wrong market costs you $18,100 in 3 years."
- Subheadline: "PropertyIQ scores every metro, county, and ZIP in America — so you pick the markets that outperform."
- Side-by-side: Score 80+ (+$54,906 equity, +1.87% above state) vs Score 20 (+$36,829 equity, -3.34% below state)

**Ship Variant A as default.** Structure with a `HERO_VARIANT` constant for easy swap when PostHog A/B testing is wired up.

**Other homepage files:**

| File                    | Change                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `FeaturesSection.tsx`   | "Market & Investment Scores" → "PropertyIQ Score". Remove HomeReady/InvestorEdge descriptions.                                      |
| `FeatureCarousel.tsx`   | Floating card: "HomeReady" → "PropertyIQ"                                                                                           |
| `ValuePropsSection.tsx` | Remove all 3-score references. Update stats to v4 numbers ($18,100 gap, 7.83pp alpha).                                              |
| `JsonLd.tsx`            | `featureList`: Remove HomeReady/InvestorEdge entries. Add "PropertyIQ Score — predicts market performance with 100% year hit rate." |

### 4.4 Scores Page (`/scores`)

Full rewrite as marketing + methodology page:

1. **Hero** — "The PropertyIQ Score" / "One number that predicts market performance. Validated, not vibes." + stat pills (746 metros, 13 years, 100% year hit rate)
2. **Decile Tables** — 1Y and 3Y excess return by score decile (from v4 report)
3. **How It Works** — 3 steps: 3 Redfin Metrics → Z-Score Normalization → Percentile Mapping
4. **Dollar Impact** — Q5 vs Q1 gap per geography level
5. **FAQ** — Updated for single score. Remove "What's the difference between HomeReady and InvestorEdge?" Add "Why only 3 metrics?"

New data file: `packages/frontend/app/scores/decile-data.ts` with hardcoded decile rows from v4 report.

### 4.5 Reports Page (`/reports`)

**Remove the investor/homebuyer toggle entirely:**

- Delete `ReportCard` selection component (the two-card picker)
- Remove `selectedType` state and conditional rendering
- `template_slug` always = `"propertyiq"` (or `"comparison"` for multi-market)
- `user_type` always = `"universal"`
- Merge personalization fields into single optional panel
- Remove `?rtype=homebuyer|investor` URL param handling
- Report badge: single indigo badge for all reports

**Report viewer components** (`/reports/[id]/`):

- `ReportHeader.tsx`, `ReportCover.tsx`: Show "PropertyIQ Score" instead of conditional labels
- `ScoreBreakdown.tsx`: Show 3 Redfin metrics instead of old component breakdown
- Old reports with `homeready`/`investoredge` slugs continue rendering (backward compat)

### 4.6 Other Frontend Touchpoints

**Map panel:**

- `SidebarScoreCard.tsx`: Remove 3-score carousel (SCORE_ORDER, SCORE_CONFIG, prev/next nav). Single PropertyIQ Score card.
- `RightDetailPanel.tsx`: Remove `investorScore`/`homeReadyScore`/`marketHealthScore` props → single `score`
- `ScoreGaugeCard.tsx`: Remove 3-type config object → single "PropertyIQ Score" title

**Graphs:**

- `ScoreShowdown.tsx`: `scoreLabel = 'PropertyIQ'` (remove investor/homebuyer conditional)
- `HeroComparison.tsx`: Same
- `PriorityBreakdown.tsx`: `homeready_score` → `propertyiq_score`

**Dashboard:**

- Top markets lists: default to `score_type='propertyiq'`

**Admin:**

- Add `'propertyiq'` as default option in all score type dropdowns
- Keep legacy types accessible for historical data management

**Embeds:**

- `EmbedScoreWidget.tsx`: Add `propertyiq: "PropertyIQ"` to label map, make it default
- Demo site: default to `scoreType="propertyiq"`

### 4.7 Validation Claims (`packages/frontend/lib/data/validation-claims.ts`)

Add v4 constants:

```typescript
export const V4_CLAIMS = {
  metroGap3Y: 18_100, // Q5 vs Q1 dollar gap, 3Y metro
  cumulativeAlphaPp: 7.83, // Quintile spread, 3Y
  yearHitRate: 100, // % years Q5 > Q1
  metrosValidated: 746,
  countiesValidated: 2_983,
  zipsValidated: 19_880,
  backtestYears: 13,
  backtestObservations: 3_177_707,
  inputMetrics: ["pct_sold_above_list", "median_dom", "months_of_supply"],
} as const;
```

Deprecate old `OOS_QUINTILE_SPREAD`, `OOS_IC`, `OOS_HIT_RATE` constants.

---

## 5. Cleanup Inventory

### 5.1 Files to DELETE

**Backend:**

- `packages/backend/src/scoring/market-health.service.ts` — MarketHealth-specific component service
- `packages/backend/src/scoring/__tests__/unit/weight-validation.spec.ts` — Tests old per-type weights

**Scripts:**

- `scripts/calculate-10-zips.js` — Legacy ad-hoc calculator with 3 score types
- `scripts/calculate-all-zip-scores.js` — Legacy ZIP calculator with 3 score types
- `scripts/calculations/score-formula-weights.ts` — Standalone v2/v3 weights copy
- `scripts/calculations/score-zscore-engine.ts` — Old z-score engine
- `scripts/calculations/score-data-fetcher.ts` — Old data fetcher
- `scripts/calculate-excess-returns.ts` — Per-type excess return calculator
- `scripts/analysis/diagnose_scores.py` — v3 diagnostic tool
- `scripts/analysis/DIAGNOSTIC_REPORT.md` — v3 diagnostic output
- `scripts/analysis/output/diagnostic_report_*.json` — v3 diagnostic artifacts
- `scripts/analysis/scoring_pipeline/*.py` — Old scoring pipeline (config, export_weights, data_loader, report)
- `scripts/analysis/run_scoring_pipeline.py` — Old pipeline orchestrator
- `scripts/backfill-zip-pre2020-outcomes.py` — Old backfill with 3 score types
- `scripts/build-training-join.py` — Old training data builder
- `scripts/build-zip-backtest-parquet.py` — Old backtest builder
- `scripts/validate-v3-scoring-live.ts` — v3-specific validation
- `scripts/test-backtest-comprehensive.ts` — Old backtest tests
- `scripts/test-austin-scores.ts` — Old score test

**Frontend report sections (homebuyer/investor split):**

- `packages/frontend/app/reports/[id]/components/sections/homebuyer/*.tsx` — All 6 files (AffordabilityDeepDive, MarketTimingDeepDive, StabilityDeepDive, GrowthPotentialDeepDive, ScoreDeepDive, index)
- `packages/frontend/app/reports/[id]/components/sections/investor/*.tsx` — All 8 files (CashFlowDeepDive, RentDemandDeepDive, AppreciationDeepDive, EntryPointDeepDive, RiskDeepDive, InvestmentThesis, ProFormaSnapshot, index)

**Old docs/plans:**

- `docs/plans/2026-02-15-scores-section-design.md`
- `docs/plans/2026-03-01-scoring-optimizer-plan.md`
- `docs/plans/2026-03-01-scoring-optimizer-python-package-design.md`
- `docs/plans/2026-03-07-v3-calibration-and-ci-validation.md`
- `docs/BACKTEST-VALIDATION-REPORT.md`

### 5.2 Content & Copy Audit

Global search-replace across `packages/frontend/`:

- "HomeReady" → "PropertyIQ" (in UI text, not code identifiers)
- "InvestorEdge" → "PropertyIQ" (same)
- "MarketHealth" / "Market Health" → "PropertyIQ" (same)
- "homebuyer" → remove or generalize (in score selection context only)
- Old stat claims ($39,900, 5.55pp, $13.3K/year) → v4 numbers ($18,100, 7.83pp)

Includes: page `<Metadata>`, OpenGraph descriptions, JSON-LD structured data, image alt text, FAQ text, navigation labels.

---

## 6. Sitewide Messaging

### Two Hero Stats (appear on every marketing-facing page)

1. **Q5 vs Q1 Dollar Gap:** "$18,100 more on a typical home over 3 years" (metro level)
2. **Alpha / Hit Rate:** "100% year hit rate" or "7.83pp cumulative alpha"

### Pricing Framing (future)

Opportunity cost framing: "PropertyIQ Pro: $X/month. The opportunity cost of choosing a bottom-quintile market: ~$4,600/year in missed alpha." Data source: v4 report Q1 excess return of -3.34% at 1Y on $245K median home ≈ $8,200 gap vs Q5.

---

## 7. Follow-ups (Out of Scope)

| Item                                       | Priority | Notes                                                                      |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------- |
| PostHog A/B testing                        | High     | Wire up hero variant experiment after both are built                       |
| Proxy scores for ~178 missing metros       | Low      | Revisit if coverage requests come in; Realtor.com DOM is the best fallback |
| Pricing page with opportunity cost framing | Medium   | See Section 6                                                              |
| County/ZIP dollar gap stats                | Medium   | Need to compute from v4 report county/ZIP sections                         |

---

## 8. Risk Assessment

| Risk                                                   | Mitigation                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| v4 scores differ significantly from v3 for same market | Expected — different formula. Communicate as "updated methodology" not a bug. |
| Markets that had scores lose them (no Redfin)          | 178 metros affected. Show "Score unavailable" gracefully.                     |
| Old reports break after migration                      | Keep backward-compat: old `template_slug` values still render old templates.  |
| Admin needs historical v3 data                         | Keep legacy score types accessible in admin panel dropdowns.                  |
| Rollback needed                                        | Take DB backup before deleting v3 rows. Code preserved in git.                |
| Cached frontend responses with old shape               | `AllScoresResponse` keeps old keys as optional during transition.             |
