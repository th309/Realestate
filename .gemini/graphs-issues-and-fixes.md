# Graph Page Issues and Fixes

## Issues Found

### Issue 1: Backend 500 Errors ❌
**Affected Metrics:**
- `listing_price` (Realtor)
- `population` (Census)
- National level metrics

**Root Cause:**
The `TimeSeriesService` metric mappings may not match your actual Supabase table schema. The service is querying tables/fields that don't exist or have different column names.

### Issue 2: Chart Not Rendering Despite Successful API Response ❌
**Evidence:**
- API returned `{"success": true, "count": 311, "data": [...]}`  
- Console logged "FETCH SUCCESS: 311 data points"
- Chart remained blank with "Analyzing" state

**Root Cause:**
The frontend is converting monthly data (2024-01-01, 2024-02-01, etc.) into years, which causes:
1. Multiple data points collapsed into same year
2. Chart component may not handle duplicate keys properly

## Required Fixes

### Fix 1: Update Backend Metric Mappings

You need to verify that the metric_name values in `TimeSeriesService` match your actual Supabase tables.

**To check:**

```sql
-- Run in Supabase SQL Editor to see what metric_name values exist
SELECT DISTINCT metric_name 
FROM realtor_state 
ORDER BY metric_name;

SELECT DISTINCT metric_name 
FROM zillow_state 
ORDER BY metric_name;
```

**Then update the mappings in `timeseries.service.ts` (line 220+) to match.**

Example issues that might exist:
- `listing_price` might actually be `median_listing_price` in the DB
- Field names might be different (check if it's `value` or something else)

### Fix 2: Change Chart to Use Date Instead of Year

The chart should display monthly data points, not collapse them into years.

**Update `useChartData.ts` line 80-86:**

```typescript
// OLD (collapses to year):
const chartData: ChartDataItem[] = primaryResponse.data.map(point => {
  const year = new Date(point.date).getFullYear();
  return {
    year,
    [selectedArea]: point.value,
  };
});

// NEW (use full date):
const chartData: ChartDataItem[] = primaryResponse.data.map(point => {
  return {
    date: point.date, // Keep as YYYY-MM-DD for monthly precision
    [selectedArea]: point.value,
  };
});
```

**Also update the interface:**
```typescript
interface ChartDataItem {
  date: string;  // Changed from 'year: number'
  [key: string]: number | boolean | string | undefined;
}
```

**And update ChartSection to use date on X-axis instead of year.**

### Fix 3: Add Error Handling for Unknown Metrics

Add better error handling in the backend for metrics that aren't mapped yet:

```typescript
// In TimeSeriesService.getTimeSeries
const mapping = this.getMetricMapping(metricId);
if (!mapping) {
  // Return empty array instead of throwing error for unmapped metrics
  console.warn(`Metric ${metricId} not yet mapped in TimeSeriesService`);
  return [];
}
```

## Testing Matrix After Fixes

Once fixes are applied, test these combinations:

| Geography | Location | Metric | Expected Result |
|-----------|----------|--------|----------------|
| State | Florida | Listing Price | ✅ Data from realtor_state |
| State | Florida | Home Value | ✅ Data from zillow_state |
| Metro | Miami-Fort Lauderdale | Home Value | ✅ Data from zillow_metro |
| Metro | Miami-Fort Lauderdale | Listing Price | ✅ Data from realtor_metro |
| National | United States | Listing Price | ✅ Data from realtor_national |

## Immediate Action Items

1. **Check Supabase tables** - Verify metric_name values and column names
2. **Update backend mappings** - Fix TimeSeriesService getMetricMapping()
3. **Fix frontend date handling** - Change from year to date for better precision
4. **Deploy and test** - Push to Railway and verify on production

Let me know if you'd like me to implement any of these fixes!
