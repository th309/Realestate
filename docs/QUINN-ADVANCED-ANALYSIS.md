# Quinn Advanced Analysis Capabilities

Quinn now has complete statistical analysis capabilities including quintile validation, backtest analysis, and formula discovery tools.

## New Features Added

### 1. Quintile Validation Analysis

**Tool:** `run_quintile_analysis`

Generates the exact summary table format you requested:
- ✅ Top Quintile Excess Return
- ✅ Bottom Quintile Excess Return
- ✅ SPREAD (top - bottom)
- ✅ T-test p-value
- ✅ Spearman Correlation
- ✅ Beat rates for top and bottom quintiles

**Example Quinn Query:**
```
"Run quintile analysis for InvestorEdge scores at the metro level with 3-year outcomes"
```

**What it returns:**
```json
{
  "validation_summary": {
    "top_quintile_excess": 0.0845,
    "bottom_quintile_excess": -0.0621,
    "spread": 0.1466,
    "top_quintile_beat_rate": 67.5,
    "bottom_quintile_beat_rate": 32.8,
    "t_test_pvalue": 0.0003,
    "spearman_correlation": 0.412,
    "validated": true
  },
  "quintile_details": [...],
  "confidence_grade": "A"
}
```

---

### 2. Full Backtest Analysis

**Tool:** `run_backtest`

Comprehensive validation across multiple time horizons (1y, 3y, 5y, 10y).

**Example Quinn Query:**
```
"Run a full backtest on HomeReady scores for counties, testing 1-year, 3-year, and 5-year outcomes"
```

**What it returns:**
- Complete quintile validation for each horizon
- Decile-by-decile breakdown
- Confidence grade (A-F)
- Validation status (passed/failed)
- Dollar impact calculations

---

### 3. Formula Comparison (3 vs 9)

**Tool:** `compare_formulas`

Helps decide whether to use:
- **3 formulas:** One per score type (InvestorEdge, HomeReady, MarketHealth)
- **9 formulas:** One per score type × geography level (metro, county, zip)

**Example Quinn Query:**
```
"Should I use 3 or 9 formulas? Compare predictive power across metro, county, and zip levels"
```

**What it returns:**
```json
{
  "recommendation": "3_formulas",
  "reasoning": "Spreads are consistent across geography levels (CV=22.4%). One formula per score type is sufficient.",
  "spread_consistency": {
    "coefficient_of_variation": 22.4,
    "mean_spread": 0.1423,
    "std_spread": 0.0318
  },
  "results_by_geography": {
    "metro": {...},
    "county": {...},
    "zip": {...}
  }
}
```

**Decision Logic:**
- CV < 30% → Use 3 formulas (consistent across geographies)
- CV > 30% → Use 9 formulas (geographies need different weights)

---

## Complete Analysis Workflow

### Step 1: Explore Raw Metrics
```
"What raw metrics are available from Zillow and Realtor?"
```
Uses: `get_raw_metric_summary`

### Step 2: Find Correlations
```
"Analyze raw Zillow and Realtor metrics to find what predicts 3-year appreciation"
```
Uses: `analyze_raw_metrics`
- Returns top 15 correlated metrics
- Regression coefficients
- Feature importance rankings

### Step 3: Validate with Quintiles
```
"Run quintile validation on InvestorEdge scores for metros"
```
Uses: `run_quintile_analysis`
- Returns exact validation table
- Beat rates
- Statistical significance

### Step 4: Full Backtest
```
"Run full backtest validation for all three scores"
```
Uses: `run_backtest`
- Tests multiple horizons
- Confidence grades
- Dollar impact

### Step 5: Formula Decision
```
"Should I use different formulas for different geography levels?"
```
Uses: `compare_formulas`
- Analyzes consistency
- Recommends 3 or 9 formulas
- Provides reasoning

---

## API Endpoints Added

### Backend (NestJS)
- Tool definitions in: `packages/backend/src/analytics-chat/analytics-tools.service.ts`
- Endpoints mapped to Python analytics service

### Python Analytics Service
- Endpoints in: `packages/propertyiq-analytics/app/api/routes/advanced.py`
- Service: `packages/propertyiq-analytics/app/services/backtest_service.py`

New endpoints:
- `POST /api/v1/advanced/backtest`
- `POST /api/v1/advanced/quintile-analysis`
- `POST /api/v1/advanced/formula-comparison`

---

## Example Conversation with Quinn

**User:** "I want to validate our InvestorEdge scoring formula. Show me the quintile performance."

**Quinn:** *[Calls run_quintile_analysis tool]*

```
Quintile Validation Results for InvestorEdge (Metro, 3-year outcomes):

📊 Summary Table:
┌────────────┬────────────┬────────────┬─────────┐
│ Metric     │ Value      │ Meaning    │ Status  │
├────────────┼────────────┼────────────┼─────────┤
│ Top Q      │ +8.45%     │ Excess     │ ✓       │
│ Bottom Q   │ -6.21%     │ Excess     │ ✓       │
│ SPREAD     │ 14.66%     │ Separation │ Excellent│
│ T-test     │ p=0.0003   │ Significant│ ✓       │
│ Spearman   │ r=0.412    │ Correlation│ Strong  │
│ Top Beat   │ 67.5%      │ Win rate   │ Good    │
│ Bottom Beat│ 32.8%      │ Avoid rate │ Good    │
└────────────┴────────────┴────────────┴─────────┘

✅ VALIDATED - Confidence Grade: A

Key Findings:
• High-scoring markets beat benchmark by 8.45%
• Low-scoring markets trail by 6.21%
• Total spread of 14.66% shows strong predictive power
• Top quintile wins 67.5% of the time
```

**User:** "Should I use different formulas for metros vs counties?"

**Quinn:** *[Calls compare_formulas tool]*

```
Formula Comparison Analysis:

🎯 Recommendation: USE 3 FORMULAS

Reasoning:
Spreads are highly consistent across geography levels (CV=22.4%).
One formula per score type is sufficient - no need for separate
metro/county/zip formulas.

Consistency Metrics:
• Mean Spread: 14.23%
• Std Dev: 3.18%
• Coefficient of Variation: 22.4% (Low = Consistent)

Results by Geography:
├─ Metro:   Spread=14.5%, Spearman=0.41, Validated ✓
├─ County:  Spread=13.8%, Spearman=0.39, Validated ✓
└─ Zip:     Spread=14.3%, Spearman=0.38, Validated ✓

All three geography levels show similar predictive power,
suggesting the same underlying factors drive performance.
```

---

## Technical Notes

### Data Sources
- Pulls RAW metrics from Supabase (Zillow, Realtor, Census, Economic)
- Does NOT use existing scores - goes back to raw data
- Calculates forward outcomes (1y, 3y, 5y, 10y appreciation)

### Statistical Methods
- **Correlations:** Spearman (rank-based, robust to outliers)
- **Regression:** Ridge with λ=0.1 (prevents overfitting)
- **Normalization:** Z-score for fair metric comparison
- **Validation:** T-tests with p<0.05 threshold

### Performance
- `run_quintile_analysis`: ~2-3 seconds (cached data)
- `run_backtest`: ~5-10 seconds (multiple horizons)
- `compare_formulas`: ~15-30 seconds (multiple geo × score combinations)
- `analyze_raw_metrics`: ~3-5 seconds (queries Supabase directly)

### Minimum Requirements
- At least 100 data points for analysis
- Historical data with outcomes calculated
- Valid score ranges (0-100)

---

## Comparison with Formula Discovery Scripts

| Feature | Quinn | Scripts (`scripts/formula-discovery/`) |
|---------|-------|----------------------------------------|
| Interactive queries | ✅ | ❌ |
| Natural language | ✅ | ❌ |
| Quintile validation | ✅ | ✅ |
| Beat rates | ✅ | ✅ |
| 3 vs 9 comparison | ✅ | ✅ |
| Ridge regression | ✅ | ✅ |
| Raw metric analysis | ✅ | ✅ |
| Batch processing | ❌ | ✅ |
| Full report PDF | ❌ | ✅ |
| Command line | ❌ | ✅ |

**Recommendation:** Use Quinn for interactive exploration and validation. Use scripts for batch analysis and reporting.

---

## Next Steps

### Try it out
1. Start your analytics service: `cd packages/propertyiq-analytics && uvicorn app.main:app`
2. Start your backend: `cd packages/backend && npm run start:dev`
3. Open Quinn in your frontend
4. Ask: "Run quintile validation on InvestorEdge scores for metro markets"

### Extend it further
- Add dollar impact calculations to Quinn responses
- Create visualization components for quintile charts
- Export validation reports to PDF
- Add automated validation alerts when spreads drop below thresholds

---

## Support

For questions or issues:
- Quinn implementation: `packages/frontend/components/analytics-assistant/`
- Backend tools: `packages/backend/src/analytics-chat/analytics-tools.service.ts`
- Python analytics: `packages/propertyiq-analytics/app/`
- Backtest service: `packages/propertyiq-analytics/app/services/backtest_service.py`
