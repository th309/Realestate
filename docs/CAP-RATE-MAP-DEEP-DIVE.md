# Cap Rate Map Deep Dive

## Summary

Cap rate maps appear **bare** despite abundant ZORI (Zillow Observed Rent Index) data at metro, county, city, and zip levels because:

1. **Map data comes only from `calculated_metrics`** for county and zip (no fallback).
2. **Metro has a fallback** that reads **wide-format `zillow_zori`**, which may be empty or keyed by `region_id` instead of CBSA code, so map keys do not match GeoJSON.
3. **Pre-calculated data** is populated by a **batch job** (`POST /api/metrics/calculate-investment-metrics`) that must be run after ZORI/ZHVI imports; if it is not run or fails, `calculated_metrics` has no cap_rate rows and the map stays empty.

---

## Data Flow

### Frontend (Map)

| Step | Location | Behavior |
|------|----------|----------|
| Metric config | `packages/frontend/app/map/config/metrics.ts` | `cap_rate`: `supportedGeos: ['metro', 'county', 'zip']`, `apiEndpoint: '/api/metrics/cap-rate/{geo}'`, `valueField: 'cap_rate'` |
| Fetch | `packages/frontend/app/map/hooks/useMapData.ts` | For `cap_rate`/`gross_yield`: calls `api.getMetroCapRate()`, `api.getCountyCapRate()`, `api.getZipCapRate(state)` (not unified `fetchMetricData`) |
| API client | `packages/frontend/lib/api/client.ts` | Builds `Record<key, number>`: metro key = `cbsa_code \|\| region_id`, county = `county_fips \|\| region_id`, zip = `postal_code \|\| region_id` |
| Map paint | `packages/frontend/app/map/hooks/useMapLayers.ts` | `addValuesToFeatures`: metro uses `feature.properties.CBSAFP \|\| GEOID` as key; county uses FIPS; zip uses `ZCTA5CE20 \|\| GEOID20` (normalized). Data is looked up as `mapData[key]`. |

So the **map expects**:

- **Metro**: key = CBSA code (e.g. `"31080"`).
- **County**: key = 5-digit FIPS (e.g. `"06037"`).
- **Zip**: key = normalized 5-digit ZIP (e.g. `"90210"`).

If the API returns rows keyed by Zillow `region_id` (numeric) or missing `cbsa_code`/`county_fips`/`postal_code`, the frontend builds the wrong keys and no features get a value → **bare map**.

---

## Backend: Where Cap Rate Comes From

### Primary path: `calculated_metrics`

- **Table**: `calculated_metrics` (columns include `geography_type`, `geography_id`, `geography_name`, `cap_rate`, `period_date`, …).
- **Population**: `CalculatedMetricsService.calculateInvestmentMetricsForMetros()`, `calculateInvestmentMetricsForCounties()`, `calculateInvestmentMetricsForZips()`.
- **Input**: Long-format Zillow tables:
  - **Metro**: `zillow_metro` with `metric_name IN ('zori','zhvi')`, joined by `region_id`/`period_date`, output key = `cbsa_code`.
  - **County**: `zillow_county` with `metric_name IN ('zori','zhvi')`, key = `fips_code` (normalized 5-digit).
  - **Zip**: `zillow_zip` with `metric_name IN ('zori','zhvi')`, key = `region_name` (ZIP string); stored in `calculated_metrics` as `geography_id` (postal_code).
- **Trigger**: `POST /api/metrics/calculate-investment-metrics` → `calculateAllInvestmentMetrics()` runs metros, then counties, then zips. Not automatic on ZORI import.

**Map endpoints** (metro/county/zip) first call `getInvestmentMetricsForMap('cap_rate', geo)`. If that returns rows, the response uses `geography_id` as `cbsa_code` / `county_fips` / `postal_code`, so keys match the map. If it returns **no rows**, behavior differs by geography below.

### Metro fallback (current)

- **Code**: `metrics.controller.ts` `getMetroCapRate()`.
- **When**: Pre-calculated metro data is empty.
- **Source**: Wide tables `zillow_zori` and `zillow_zhvi` with `geography = 'Metro'`.
- **Problems**:
  1. **Schema**: `zillow_zori` (migration 013) has `region_id`, `date`, `value`, `property_type`, `geography` — **no `cbsa_code` or `region_name`**. The controller does `.select('region_id, region_name, value, cbsa_code')`; the latter two are undefined/null.
  2. **Key**: Client uses `item.cbsa_code || item.region_id` → effectively `region_id` (Zillow numeric). Map expects **CBSA code**. So even if the fallback returns data, **keys do not match** → map stays bare.
  3. **Data location**: ZORI may exist only in **long-format** `zillow_metro` (metric_name = 'zori'); `zillow_zori` may be empty or legacy. Then fallback returns nothing.

### County and zip (current)

- **Code**: `getCountyCapRate()`, `getZipCapRate()`.
- **Behavior**: If `getInvestmentMetricsForMap('cap_rate', 'county'|'zip')` returns no rows, the API returns `success: false` and **empty data** — no on-the-fly calculation. So if `calculated_metrics` has no county/zip cap_rate, the map is bare.

---

## Why ZORI Exists But Cap Rate Maps Are Bare

| Factor | Explanation |
|--------|-------------|
| **ZORI in long-format only** | Imports (e.g. zillow-all-import, zillow-import) write to `zillow_metro`, `zillow_county`, `zillow_zip` with `metric_name = 'zori'`. Wide `zillow_zori` may not be populated. |
| **calculated_metrics not run** | Cap rate is not computed at request time for county/zip; it is only in `calculated_metrics`. If the batch job is not run (or fails), county and zip cap rate stay empty. |
| **Metro fallback wrong keys** | Metro fallback uses `zillow_zori`, which has no `cbsa_code`. Responses are keyed by `region_id`; map needs CBSA → no match. |
| **No county/zip fallback** | County and zip have no on-the-fly cap rate from `zillow_county`/`zillow_zip` when `calculated_metrics` is empty. |

So “massive ZORI at metro, zip, city, county” lives in the **long-format** tables and (for county/zip) is only reflected on the map **after** the investment-metrics batch has run and stored cap_rate in `calculated_metrics`. Metro additionally suffers from a fallback that does not emit the right keys.

---

## Recommendations

**Cap rate is a calculated metric.** It is not computed on-the-fly; it lives in `calculated_metrics` and is populated by the batch job. So the fix for bare maps is to ensure that job runs and has the right inputs, not to add request-time calculation.

### 1. Ensure the batch job runs

- Run **`POST /api/metrics/calculate-investment-metrics`** after ZORI (and ZHVI) are imported into the long-format tables (`zillow_metro`, `zillow_county`, `zillow_zip`). That populates `calculated_metrics` with `cap_rate` (and gross_yield, grm, etc.) for metro, county, and zip.
- Schedule this in your pipeline (e.g. after Zillow import steps) so the map always has data when ZORI exists.

### 2. Fix or remove the metro fallback (optional)

- The metro cap-rate endpoint has a **fallback** that reads wide-format `zillow_zori` + `zillow_zhvi`. That table may be empty (data only in long-format), and the fallback returns keys as `region_id` instead of CBSA code, so the map still shows nothing. Either remove this fallback so metro behaves like county/zip (pre-calculated only), or change it to use long-format `zillow_metro` and return **cbsa_code** so keys match the map. Prefer pre-calculated-only if cap rate is intended to be a calculated metric everywhere.

### 3. Optional: unify map fetch for cap rate

- Have the map use the unified `fetchMetricData('cap_rate', level, { state })` and the existing `apiEndpoint: '/api/metrics/cap-rate/{geo}'` so one code path handles all geos and value/date formatting. Currently `useMapData` branches on `cap_rate`/`gross_yield` and calls the three cap-rate API methods directly; unifying would reduce drift and ensure `valueField: 'cap_rate'` and date are applied consistently.

### 4. Verify ZORI coverage

- Use or extend scripts like `scripts/check-zori-unique-coverage.ts` to confirm ZORI exists in `zillow_metro`, `zillow_county`, and `zillow_zip` for the dates you care about. That confirms the fallbacks (and the batch) have input data.

---

## File Reference

| Area | File | Relevance |
|------|------|-----------|
| Frontend metric config | `packages/frontend/app/map/config/metrics.ts` | cap_rate supportedGeos, apiEndpoint, valueField |
| Map data fetch | `packages/frontend/app/map/hooks/useMapData.ts` | Calls getMetroCapRate / getCountyCapRate / getZipCapRate |
| API client | `packages/frontend/lib/api/client.ts` | Builds keyed Record from cbsa_code / county_fips / postal_code |
| Map paint / keys | `packages/frontend/app/map/hooks/useMapLayers.ts` | addValuesToFeatures: metro = CBSAFP/GEOID, county = FIPS, zip = ZCTA |
| Cap rate endpoints | `packages/backend/src/metrics/metrics.controller.ts` | getMetroCapRate (pre-calc + zillow_zori fallback), getCountyCapRate, getZipCapRate |
| Pre-calculated read | `packages/backend/src/metrics/calculated-metrics.service.ts` | getInvestmentMetricsForMap('cap_rate', geo) |
| Batch calculation | `packages/backend/src/metrics/calculated-metrics.service.ts` | calculateInvestmentMetricsForMetros/Counties/Zips from zillow_metro/county/zip |
| ZORI coverage check | `scripts/check-zori-unique-coverage.ts` | Counts unique metros/counties/zips with ZORI in long-format tables |

---

## Summary: Why maps are bare and what to do

- **Cap rate is a calculated metric.** It is stored in `calculated_metrics` and populated by the batch job that combines ZORI + ZHVI from the long-format Zillow tables.
- **Bare maps** occur when `calculated_metrics` has no (or few) cap_rate rows — usually because the investment-metrics batch has not been run after ZORI/ZHVI import, or ZORI is missing in those tables.
- **Fix:** Run `POST /api/metrics/calculate-investment-metrics` after ZORI (and ZHVI) are in `zillow_metro`, `zillow_county`, and `zillow_zip`. Optionally fix or remove the metro cap-rate fallback that uses `zillow_zori` so metro behaves consistently (pre-calculated only, correct keys).
