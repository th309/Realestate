# ZIP Matrix Test Design

**Created:** 2026-02-09
**Status:** Approved
**Goal:** Test all 40 sidebar metrics across all ~30,000 US ZIP codes, parallelized by state.

---

## Overview

Comprehensive integration tests that validate every metric displayed in the PropertyIQ maps sidebar works for every ZIP code in the United States.

**Scale:**
- 50 states
- ~30,000 ZIPs total (~600 avg per state)
- 40 metrics per ZIP
- ~1.2 million total test assertions
- ~10-15 min runtime (parallelized)

---

## Architecture

```
packages/frontend/__tests__/zip-matrix/
├── metrics.ts              # 40 metrics config + endpoint mappings
├── types.ts                # TypeScript interfaces
├── test-utils.ts           # Shared fetch helpers, result writers
├── reporter.ts             # Aggregates 50 state files → summary
├── state-tests/
│   ├── _template.ts        # Template used to generate state files
│   ├── AL.test.ts
│   ├── AK.test.ts
│   ├── ... (50 files)
│   └── WY.test.ts
└── results/                # Generated at runtime
    ├── AL-results.json
    ├── ...
    └── aggregate-report.json
```

---

## Metrics Tested (40)

### Affordability
- `listing_price`
- `income_to_buy`
- `affordable_home_price`
- `price_per_sqft`
- `years_to_save`
- `home_value_yoy`
- `home_value_5yr`

### Competition
- `days_on_market`
- `for_sale_inventory`
- `inventory_yoy`
- `pending_ratio`
- `new_listings_yoy`
- `hotness_score`
- `sale_to_list`

### Pricing
- `home_value_mom`
- `price_cut_pct`
- `price_increase_pct`
- `new_listings`
- `inventory_surplus`

### Cash Flow
- `cap_rate`
- `rent_index`
- `rent_for_houses`

### Appreciation
- `home_value`
- `overvalued_pct`

### Area Profile
- `population`
- `population_growth`
- `median_income`
- `income_growth`
- `median_age`
- `homeownership_rate`

### Local Economy
- `unemployment_rate`
- `job_growth`
- `gdp_growth`
- `cost_of_living`

### New Construction
- `sf_permits`
- `mf_permits`
- `total_permits`
- `permits_yoy`
- `sf_mf_ratio`
- `permit_value_per_unit`
- `new_construction_sales`
- `new_construction_price`
- `new_construction_ppsf`

### PropertyIQ Scores
- `homeready_score`
- `investoredge_score`
- `market_health_score`

---

## Test Implementation

Each state test file follows this pattern:

```typescript
// AL.test.ts
const STATE = 'AL';

describe(`ZIP Matrix: ${STATE}`, () => {
  let zips: string[] = [];

  beforeAll(async () => {
    // Fetch all ZIPs for this state from API
    const res = await fetch(`${API_URL}/api/zillow/zips?state=${STATE}`);
    const data = await res.json();
    zips = data.data.map(z => z.zip_code);
  });

  it.each(zips)('ZIP %s has valid data', async (zip) => {
    const results = {};

    for (const metric of METRICS) {
      const res = await fetchMetric(metric, 'zip', zip);
      results[metric] = categorizeResult(res);
    }

    writeResultsForZip(STATE, zip, results);

    // Fail only on critical metrics
    const criticalPassing = CRITICAL_METRICS.every(m => results[m]?.status === 'pass');
    expect(criticalPassing).toBe(true);
  });
});
```

---

## Result Categories

Each metric check results in one of:

| Status | Meaning |
|--------|---------|
| `pass` | API returned 200 with valid data |
| `empty` | API returned 200 but no data for this ZIP |
| `fail` | API returned error (4xx/5xx) |
| `n/a` | Metric not available at ZIP level (metro-only) |

---

## Results Format

### Per-State Results

```json
{
  "state": "CA",
  "run_date": "2026-02-09T12:00:00Z",
  "total_zips": 1543,
  "summary": {
    "home_value": { "pass": 1520, "fail": 0, "empty": 23, "n/a": 0 },
    "rent_index": { "pass": 1100, "fail": 0, "empty": 443, "n/a": 0 },
    "gdp_growth": { "pass": 0, "fail": 0, "empty": 0, "n/a": 1543 }
  },
  "zips": {
    "90210": { "home_value": "pass", "rent_index": "pass", ... },
    "90211": { "home_value": "pass", "rent_index": "empty", ... }
  }
}
```

### Aggregate Report

```
ZIP MATRIX TEST RESULTS
=======================
Total ZIPs tested: 30,247
Total metric checks: 1,209,880

METRIC COVERAGE:
┌─────────────────────┬────────┬────────┬────────┬────────┐
│ Metric              │ Pass   │ Empty  │ Fail   │ N/A    │
├─────────────────────┼────────┼────────┼────────┼────────┤
│ home_value          │ 98.2%  │ 1.8%   │ 0%     │ 0%     │
│ rent_index          │ 72.1%  │ 27.9%  │ 0%     │ 0%     │
│ population          │ 99.9%  │ 0.1%   │ 0%     │ 0%     │
│ gdp_growth          │ 0%     │ 0%     │ 0%     │ 100%   │
└─────────────────────┴────────┴────────┴────────┴────────┘
```

---

## Pass Criteria

- **Critical metrics** (home_value, population): ≥ 95% pass rate
- **Other metrics**: ≥ 80% pass rate (excluding N/A)

---

## Running the Tests

```bash
# Run all 50 states in parallel
npm run test:zip-matrix

# Run single state (for debugging)
STATE=CA npm run test:zip-matrix:state

# Generate aggregate report
npm run test:zip-matrix:report
```

---

## CI Integration

Weekly scheduled run (not on every PR - too slow):

```yaml
name: ZIP Matrix Tests
on:
  schedule:
    - cron: '0 6 * * 0'  # Weekly on Sunday 6am
  workflow_dispatch:      # Manual trigger
```

---

## Metro-Only Metrics

These metrics are marked `n/a` for ZIP tests (only available at metro level):

- `gdp_growth`
- `job_growth`
- `new_construction_sales`
- `new_construction_price`
- `new_construction_ppsf`

The test tracks these separately to document coverage gaps.
