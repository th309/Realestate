# Agent 5: Graph/Chart Validation Report

**Generated:** 2026-02-09
**Agent:** Graph Validator
**Test Suite:** `npm run test:graph-matrix`
**Backend:** https://backend-production-ee4d.up.railway.app

---

## Executive Summary

This report documents the comprehensive validation of graph/chart functionality for the PropertyIQ platform. The analysis covers time series endpoints, snapshot data for charts, distribution data, and comparison capabilities.

**Status:** ANALYSIS COMPLETE - Manual test execution required for final validation

---

## 1. Test Suite Overview

### Test File: `__tests__/graph-matrix.test.ts`

The graph matrix test suite validates:
- Time series endpoints for 12 metrics across 3 geography levels
- Snapshot endpoints for 7 data categories
- Distribution data for score visualization
- Multi-metro comparison chart data

### Test Configuration
- **API Timeout:** 20,000ms per request
- **Backend URL:** Railway production deployment
- **Test Framework:** Vitest with verbose reporter

---

## 2. Time Series Coverage Analysis

### 2.1 Metrics with Time Series Support

The following 12 metrics are tested for time series data availability:

| Metric ID | Title | Expected Data |
|-----------|-------|---------------|
| `home_value` | Home Value | Primary Zillow ZHVI data |
| `home_value_yoy` | Home Value YoY | Year-over-year % change |
| `home_value_mom` | Home Value MoM | Month-over-month % change |
| `rent_index` | Rent Index | Zillow rent estimates |
| `days_on_market` | Days on Market | Realtor DOM data |
| `inventory` | Inventory | For-sale inventory count |
| `inventory_yoy` | Inventory YoY | Year-over-year inventory change |
| `pending_ratio` | Pending Ratio | Pending/Active listing ratio |
| `price_reduced` | Price Reduced % | Price cut percentage |
| `list_price` | Listing Price | Median listing price |
| `sale_price` | Sale Price | Median sale price |
| `cap_rate` | Cap Rate | Calculated capitalization rate |

### 2.2 Geography Level Coverage

**Metro Level (Full Coverage)**
- Sample metros tested: Dallas (19100), NYC (35620), LA (31080)
- Tests all 12 time series metrics
- Primary data source for most chart visualizations

**County Level (Subset Coverage)**
- Sample counties: Dallas County (48113), LA County (06037), Cook County (17031)
- Tests first 5 time series metrics
- Limited coverage due to data availability

**ZIP Level (Minimal Coverage)**
- Sample ZIPs: 75201 (Dallas), 90210 (Beverly Hills), 60601 (Chicago)
- Tests first 3 time series metrics
- Most limited data availability

### 2.3 Time Series Endpoint Pattern

```
GET /api/timeseries/{metric}/{geoLevel}/{regionId}?historyMonths=6
```

**Response Structure:**
```typescript
{
  success: boolean;
  metric: string;
  geoLevel: string;
  regionId: string;
  count: number;
  data: Array<{ date: string; value: number }>;
  historyMonths?: number;
  current?: number | null;
  prior?: number | null;
  trend_change?: number;
}
```

---

## 3. Snapshot Endpoints for Charts

### 3.1 Tested Snapshot Endpoints

| Endpoint | Purpose | Expected Records |
|----------|---------|------------------|
| `/api/zillow/metros` | Home values for metro chart | 300+ metros |
| `/api/zillow/counties` | Home values for county chart | 2,500+ counties |
| `/api/realtor/listing-price/metros` | Listing prices | 300+ metros |
| `/api/realtor/inventory/metros` | Inventory levels | 300+ metros |
| `/api/realtor/dom/metros` | Days on market | 300+ metros |
| `/api/census/metros` | Demographic data | 300+ metros |
| `/api/economic/metros` | Economic indicators | 300+ metros |

### 3.2 Expected Response Structure

```typescript
{
  success: boolean;
  count: number;
  data: Array<{
    region_id: string;
    region_name?: string;
    value: number;
    date?: string;
    [additionalFields]: unknown;
  }>;
}
```

---

## 4. Distribution Chart Data

### 4.1 Score Distribution Endpoint
- **Endpoint:** `/api/scores/distribution?geography=metro`
- **Purpose:** Histogram/bell curve visualization of scores
- **Status:** Optional endpoint - may not be implemented

### 4.2 Home Value Distribution
- **Endpoint:** `/api/zillow/metros`
- **Purpose:** Distribution analysis of home values
- **Expected:** 100+ metros for meaningful distribution

---

## 5. Comparison Chart Support

### 5.1 Multi-Metro Comparison
- **Test Case:** Fetch scores for 5 metros simultaneously
- **Sample Metros:** 19100, 35620, 31080, 26420, 12420
- **Endpoint Pattern:** `/api/scores/metro/{metroId}`

### 5.2 Expected Comparison Data
- PropertyIQ scores (HomeReady, InvestorEdge, MarketHealth)
- Median price data
- Return metrics (1-year, 3-year annualized)

---

## 6. Data Layer Integration

### 6.1 Time Series Fetcher (`lib/data/fetchers/timeseries.ts`)

**Key Functions:**
- `fetchTimeSeriesData(metricId, geoLevel, regionId, options)`
- `fetchAvailableDates(metricId, geoLevel)`
- `timeSeriesApi.getTimeSeries()` (legacy compatibility)

**Options Supported:**
- `startDate`: Filter start date
- `endDate`: Filter end date
- `limit`: Maximum data points
- `historyMonths`: Recent months (max 6)

### 6.2 Registry Configuration (`lib/data/registry.ts`)

**Metrics with `hasTimeSeries: true`:**
- `years_to_save`
- `income_to_buy`
- `affordable_home_price`
- `cap_rate`
- `gross_yield`
- `grm`
- `rent_to_price_ratio`
- `investment_score`
- `long_term_growth_score`
- `overvalued_pct`
- `inventory_surplus`

**Default Time Series (by data source):**
- Zillow: YES
- Realtor: YES
- Census: YES
- FRED: YES
- Calculated: YES
- PropertyIQ (scores): NO

---

## 7. Identified Data Gaps

### 7.1 Geography-Level Limitations

| Metric | Metro | County | ZIP | Notes |
|--------|-------|--------|-----|-------|
| rent_index | YES | YES | YES | Full coverage |
| market_heat | YES | NO | NO | Metro only |
| sale_to_list | YES | NO | NO | Metro only |
| homeowner_affordability | YES | NO | NO | Metro only |
| new_construction_* | YES | NO | NO | Metro only |
| cost_of_living | YES | NO | NO | Metro/State only |

### 7.2 Metro-Only Metrics (Cannot Chart at County/ZIP)
```typescript
const METRO_ONLY_METRICS = [
  'rent_index', 'rent_for_houses', 'income_to_rent',
  'homeowner_affordability', 'renter_affordability',
  'new_construction_sales', 'new_construction_price', 'new_construction_ppsf',
  'sale_price', 'sale_to_list', 'days_to_close',
  'market_health', 'market_heat', 'overvalued_pct'
];
```

### 7.3 Missing Historical Data Scenarios
- New metrics may lack historical depth
- Some ZIPs have insufficient transaction volume
- Census data updates annually (may lag)
- Economic data (FRED) has varying update frequencies

---

## 8. Recommendations

### 8.1 High Priority
1. **Run Full Test Suite:** Execute `npm run test:graph-matrix` to validate live endpoints
2. **Monitor API Latency:** Time series endpoints should respond within 20s
3. **Verify Data Freshness:** Check `DATA_DATES` configuration matches actual data

### 8.2 Medium Priority
1. **Add County Time Series Tests:** Expand coverage beyond first 5 metrics
2. **Implement Distribution Endpoint:** Add `/api/scores/distribution` if needed
3. **Cache Time Series Data:** Implement caching for frequently accessed charts

### 8.3 Low Priority
1. **Add More Sample Locations:** Include edge cases (rural areas, new developments)
2. **Document API Rate Limits:** Ensure charts don't exceed rate limits
3. **Add Error Boundary Tests:** Verify charts handle API failures gracefully

---

## 9. Test Execution Commands

```bash
# Run graph matrix tests only
npm run test:graph-matrix

# Run all matrix tests (includes data-cards and location-coverage)
npm run test:all-matrix

# Run with verbose output
npx vitest run __tests__/graph-matrix.test.ts --reporter=verbose
```

---

## 10. Appendix: Data Source Freshness

| Data Source | Last Update | Update Frequency |
|-------------|-------------|------------------|
| Zillow | 2025-11-30 | Monthly |
| Realtor | 2025-12-01 | Monthly |
| Census | 2024 | Annual |
| FRED | 2025-09-01 | Varies |
| PropertyIQ | 2025-12-01 | Monthly |

---

## Conclusion

The graph/chart validation framework is well-structured with comprehensive test coverage for:
- 12 time series metrics across 3 geography levels
- 7 snapshot endpoints for chart data
- Score distribution and comparison capabilities

**Next Steps:**
1. Execute `npm run test:graph-matrix` to get actual pass/fail results
2. Review any failing endpoints
3. Update this report with actual test results

---

*Report generated by Agent 5: Graph Validator*
