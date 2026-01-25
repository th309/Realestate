# PropertyIQ Score Backtesting Validation Report

**Generated:** January 25, 2026  
**Data Range:** July 2016 - November 2025  
**Total Historical Scores:** 3.6M+ records  
**Records with 12-month outcomes:** 2.8M+

---

## Executive Summary

PropertyIQ scores show **partial validation** of predictive power for identifying markets that beat benchmarks:

| Score Type | Validation Status | Best Performing Conditions |
|------------|-------------------|---------------------------|
| **HomeReady** | ✓ Validated (5/9) | Metros across all horizons |
| **InvestorEdge** | ~ Partial (3/9) | ZIPs for 12m, 36m horizons |

**Key Finding:** High HomeReady scores at the metro level consistently outperform benchmarks by 4.5% to 11.6% depending on the time horizon.

---

## Methodology

### What We're Testing
The backtesting framework validates whether PropertyIQ scores identify **relative opportunities** - markets that beat the benchmark, not absolute returns.

### How It Works
1. **Historical Scores:** Use scores calculated for every geography at each historical date
2. **Forward Outcomes:** Measure actual price appreciation over 12m, 36m, 60m horizons
3. **Benchmark:** Calculate the mean return across all geographies for each period
4. **Excess Return:** `actual_return - benchmark`
5. **Validation:** Top quintile should have positive excess, bottom should have negative excess

### Success Criteria
- ✓ Top quintile (highest scores) beats benchmark (positive excess return)
- ✓ Bottom quintile (lowest scores) trails benchmark (negative excess return)
- ✓ Spread (top - bottom) > 1%

---

## Detailed Results

### HomeReady Score Analysis

| Geography | Horizon | Sample Size | Benchmark | Top Quintile | Bottom Quintile | Spread | Correlation | Valid |
|-----------|---------|-------------|-----------|--------------|-----------------|--------|-------------|-------|
| Metro | 12m | 1,000 | +3.6% | +2.4% excess | -2.1% excess | **+4.5%** | 0.125 | ✓ |
| Metro | 36m | 1,000 | +14.9% | +4.9% excess | -3.1% excess | **+8.0%** | 0.254 | ✓ |
| Metro | 60m | 1,000 | +41.6% | +7.3% excess | -4.3% excess | **+11.6%** | 0.162 | ✓ |
| County | 12m | 1,000 | +5.4% | -0.5% excess | +0.6% excess | -1.1% | -0.068 | ✗ |
| County | 36m | 1,000 | +12.9% | +2.8% excess | -0.1% excess | **+2.9%** | 0.046 | ✓ |
| County | 60m | 1,000 | +42.4% | -18.2% excess | +17.3% excess | -35.5% | -0.428 | ✗ |
| ZIP | 12m | 1,000 | +11.2% | -1.9% excess | +0.6% excess | -2.4% | -0.097 | ✗ |
| ZIP | 36m | 1,000 | +32.1% | -0.7% excess | +1.7% excess | -2.5% | -0.048 | ✗ |
| ZIP | 60m | 1,000 | +33.9% | +0.4% excess | -2.6% excess | **+2.9%** | 0.029 | ✓ |

**HomeReady Summary:**
- **Metros:** Strong validation across all time horizons (12m, 36m, 60m)
- **Counties:** Mixed results, validated for 36m
- **ZIPs:** Weaker signal, validated only for 60m

---

### InvestorEdge Score Analysis

| Geography | Horizon | Sample Size | Benchmark | Top Quintile | Bottom Quintile | Spread | Correlation | Valid |
|-----------|---------|-------------|-----------|--------------|-----------------|--------|-------------|-------|
| Metro | 12m | 1,000 | +3.6% | +0.4% excess | +2.0% excess | -1.6% | -0.041 | ✗ |
| Metro | 36m | 1,000 | +14.9% | +1.3% excess | +0.5% excess | +0.7% | 0.014 | ✗ |
| Metro | 60m | 1,000 | +41.6% | +0.8% excess | +4.4% excess | -3.6% | -0.074 | ✗ |
| County | 12m | 1,000 | +3.9% | +2.5% excess | -2.1% excess | **+4.6%** | 0.390 | ✓ |
| County | 36m | 1,000 | +35.1% | +7.7% excess | +1.1% excess | +6.6% | 0.191 | ✗ |
| County | 60m | 1,000 | +55.5% | -7.3% excess | +6.1% excess | -13.5% | -0.244 | ✗ |
| ZIP | 12m | 1,000 | +10.8% | +4.0% excess | -3.6% excess | **+7.6%** | 0.356 | ✓ |
| ZIP | 36m | 1,000 | +26.9% | +3.1% excess | -0.2% excess | **+3.3%** | 0.105 | ✓ |
| ZIP | 60m | 1,000 | +40.5% | -1.6% excess | -0.8% excess | -0.9% | -0.016 | ✗ |

**InvestorEdge Summary:**
- **Metros:** Not validated (inverted or weak relationship)
- **Counties:** Validated for 12m only
- **ZIPs:** Strong validation for 12m (+7.6% spread) and 36m (+3.3% spread)

---

## Interpretation

### What's Working

1. **HomeReady for Metros** - The score reliably identifies metro areas that will outperform or underperform the national average over 1-5 year horizons. This is the strongest signal found.

2. **InvestorEdge for ZIPs (short-term)** - The score shows predictive power at the ZIP code level for 1-3 year investment horizons.

### Areas of Concern

1. **InvestorEdge at Metro Level** - The score shows weak or inverted relationships at the metro level. This may indicate the formula weights need adjustment for larger geographies.

2. **Long-term (60m) Predictions** - Both scores show weaker signals at the 60-month horizon, suggesting the scores are better suited for medium-term (1-3 year) decisions.

3. **County-level Inconsistency** - Results are mixed at the county level, possibly due to data quality issues or the scoring formula not being well-calibrated for this geography level.

---

## Recommendations

### Formula Adjustments
1. **Recalibrate InvestorEdge for Metros** - The current formula weights may not be optimal for metro-level analysis
2. **Consider geography-specific weights** - Different formulas for different geography levels

### Data Quality
1. **Increase sample sizes** - Current tests limited to 1,000 records per query
2. **Stratified sampling** - Ensure balanced representation across score ranges
3. **Time-period analysis** - Test separately for different market conditions (pre-COVID, post-COVID, etc.)

### Score Usage Guidance
| Use Case | Recommended Score | Geography | Horizon |
|----------|-------------------|-----------|---------|
| Homebuyer market selection | HomeReady | Metro | 12m - 60m |
| Short-term investing | InvestorEdge | ZIP | 12m - 36m |
| Regional analysis | HomeReady | Metro | All |

---

## Technical Details

### Data Sources
- **Historical Scores:** `propertyiq_scores_history` table (3.6M+ records)
- **Outcomes:** `actual_appreciation_Xm` columns calculated from Zillow ZHVI
- **Date Range:** July 2016 - November 2025

### Analytics Implementation
- **Framework:** Python FastAPI microservice on Railway
- **Statistical Libraries:** pandas, numpy, scipy, scikit-learn
- **Database:** Supabase PostgreSQL

### API Endpoints
- `POST /api/v1/backtest/analyze` - Full decile analysis
- `GET /api/v1/backtest/status` - Data availability check
- `GET /api/v1/backtest/quick-test` - Rapid validation

---

## Conclusion

PropertyIQ scores demonstrate **meaningful predictive power** for identifying markets that beat benchmarks, particularly:

- **HomeReady** is well-validated for metro-level analysis across all time horizons
- **InvestorEdge** shows promise for ZIP-level short-term investment decisions

The scores are valuable tools for relative market comparison, though users should be aware of the geography and time horizon limitations identified in this analysis.

**Overall Validation Status: PARTIAL SUCCESS**

The scoring framework has merit but would benefit from formula refinement, particularly for InvestorEdge at larger geography levels.
