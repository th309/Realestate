# Data Lineage: Source → DB → API → UI

Traces every external data source through ingestion, storage, API, and frontend for all 7 core data pipelines.

**Quick reference:** Find a metric in the table below, then jump to its section for full details.

---

## Summary Table

| Source | Provider | DB Tables | Update Frequency | Ingestion Service |
|---|---|---|---|---|
| Zillow | Zillow Research (S3 CSV) | `zillow_state/metro/county/zip/city` | Monthly | `zillow.service.ts` |
| Realtor.com | Realtor.com (S3 CSV) | `realtor_national/state/metro/county/zip` | Monthly | `realtor.service.ts` |
| Redfin | Redfin Data Center (S3 CSV) | `redfin_metro`, `redfin_rental_metro` | Weekly | `redfin.service.ts` |
| Census ACS | U.S. Census Bureau (API) | `census_state/metro/county/city/zip` | Annual (5-yr estimates) | `census.service.ts` |
| BLS | Bureau of Labor Statistics (API) | `economic_county` | Monthly (2–3 month lag) | `bls.service.ts` |
| FRED | St. Louis Fed (API) | `economic_national` | Monthly | `fred.service.ts` |
| HUD FMR | HUD (API) | `hud_fmr` | Annual | `hud.service.ts` |
| Building Permits | U.S. Census (API) | `permits_county` | Monthly (~2 month lag) | `permits.service.ts` |

---

## 1. Zillow

**Provider:** Zillow Research — public S3 CSVs  
**Update frequency:** Monthly  
**Ingestion service:** `packages/backend/src/data-ingestion/sources/zillow.service.ts`  
**Config:** `packages/backend/src/data-ingestion/config/zillow-urls.ts`

### Download URLs

| Dataset | URL |
|---|---|
| ZHVI (home value index, metro) | `files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` |
| ZORI (rent index, metro) | `files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv` |
| ZORI (county) | `files.zillowstatic.com/research/public_csvs/zori/County_zori_uc_sfrcondomfr_sm_sa_month.csv` |
| ZORI (ZIP) | `files.zillowstatic.com/research/public_csvs/zori/Zip_zori_uc_sfrcondomfr_sm_sa_month.csv` |
| ZORDI (rent demand index) | `files.zillowstatic.com/research/public_csvs/zordi/Metro_zordi_uc_sfrcondomfr_month.csv` |
| Inventory | `files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` |
| Days on Market | `files.zillowstatic.com/research/public_csvs/dom/Metro_dom_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` |
| Price Cuts | `files.zillowstatic.com/research/public_csvs/price_cuts/Metro_price_cuts_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` |
| New Construction Median Price | `files.zillowstatic.com/research/public_csvs/new_con_median_sale_price/Metro_new_con_median_sale_price_uc_sfrcondo_month.csv` |

### Database Tables

| Table | Region type | Key columns |
|---|---|---|
| `zillow_state` | State | `region_id`, `region_name`, `period_date`, `metric_name`, `value` |
| `zillow_metro` | Metro/MSA | `region_id`, `region_name`, `period_date`, `metric_name`, `value` |
| `zillow_county` | County | `region_id`, `region_name`, `period_date`, `metric_name`, `value` |
| `zillow_zip` | ZIP code | `region_id`, `region_name`, `period_date`, `metric_name`, `value` |
| `zillow_city` | City | `region_id`, `region_name`, `period_date`, `metric_name`, `value` |

`metric_name` values: `zhvi`, `zori`, `zordi`, `inventory`, `daysOnMarket`, `priceCuts`, `new_con_median_price`  
Conflict key: `(region_id, period_date, metric_name)`

### API Endpoints

- `GET /api/markets/metros` — list metros with latest ZHVI
- `GET /api/markets/metros/home-values` — ZHVI by metro
- `GET /api/markets/counties/home-values` — ZHVI by county
- `GET /api/markets/zips/home-values` — ZHVI by ZIP
- `GET /api/analytics-persistence/export/timeseries` — time-series export (Pro/Enterprise)

### Frontend Components

- Market detail page — home value time-series chart
- Market rankings — sorted by ZHVI or ZORI
- PropertyIQ Score calculation — ZHVI and ZORI feed the scoring model

### Data flow diagram

```
Zillow S3 CSV → axios download → csv-parse → ZillowService.importZillowData()
  → validateTimeSeriesValue() [range check]
  → markets table (upsert region)
  → zillow_{state|metro|county|zip|city} (upsert time series)
  → data_ingestion_logs (status record)
  → reportPipelineStatus() → /api/health/pipeline-status
```

---

## 2. Realtor.com

**Provider:** Realtor.com — public S3 CSVs  
**Update frequency:** Monthly  
**Ingestion service:** `packages/backend/src/data-ingestion/sources/realtor.service.ts`  
**Config:** `packages/backend/src/data-ingestion/config/realtor.config.ts`

### Download URLs

| Dataset | URL |
|---|---|
| National | `econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Country.csv` |
| State (core) | `econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_State.csv` |
| Metro (core + hotness) | `econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Metro.csv` |
| County (core + hotness) | `econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_County.csv` |
| ZIP (core + hotness) | `econdata.s3-us-west-2.amazonaws.com/Reports/Core/RDC_Inventory_Core_Metrics_Zip.csv` |

### Database Tables

| Table | Region type | Key columns |
|---|---|---|
| `realtor_national` | National | `period_date`, inventory/listing metrics |
| `realtor_state` | State | `state_id`, `period_date`, inventory/listing metrics |
| `realtor_metro` | Metro | `cbsa_code`, `period_date`, core + hotness metrics |
| `realtor_county` | County | `county_fips`, `period_date`, core + hotness metrics |
| `realtor_zip` | ZIP | `postal_code`, `period_date`, core + hotness metrics |

### API Endpoints

- Market snapshot endpoints pull from Realtor tables alongside Zillow for inventory signals

### Frontend Components

- Market detail page — active listing counts, days on market, price reductions
- PropertyIQ Score — inventory and hotness signals contribute to market score

---

## 3. Redfin

**Provider:** Redfin Data Center — S3 CSVs  
**Update frequency:** Weekly  
**Ingestion service:** `packages/backend/src/data-ingestion/sources/redfin.service.ts`  
**Download helper:** `redfin-puppeteer.service.ts` (handles anti-bot headers)

### Database Tables

| Table | Key columns |
|---|---|
| `redfin_metro` | `region_id`, `period_end`, `metric_name`, `metric_value` |
| `redfin_rental_metro` | `region_id`, `period_date`, `metric_name`, `metric_value` |

Key metrics: `median_sale_price`, `homes_sold`, `inventory`, rental rates

### API Endpoints

- Redfin data surfaces in market snapshot and time-series export endpoints

### Frontend Components

- Market detail page — sales activity, homes sold trend
- Rent vs. Own analysis tool

### Notes

- Currently ingesting metro-level only; county/ZIP tables not yet populated
- `period_end` (not `period_date`) is the date column in `redfin_metro`

---

## 4. Census ACS

**Provider:** U.S. Census Bureau API  
**Update frequency:** Annual (5-year ACS estimates; ~2 year publication lag)  
**Ingestion service:** `packages/backend/src/data-ingestion/sources/census.service.ts`  
**Data source:** Census API `/data/{year}/acs/acs5` endpoints

### Database Tables

| Table | Region type | Key columns |
|---|---|---|
| `census_state` | State | `state_fips`, `year`, population, income, demographics |
| `census_metro` | Metro/MSA | `cbsa_code`, `year`, population, income, demographics |
| `census_county` | County | `county_fips`, `year`, population, income, demographics |
| `census_city` | City/Place | `place_fips`, `year`, population, income, demographics |
| `census_zip` | ZIP (ZCTA) | `postal_code`, `year`, population, income, demographics |

Key columns: `population`, `median_household_income`, `median_age`, demographic breakdowns  
Conflict key: `(region_id, year)`

### API Endpoints

- `GET /api/census/population/{national|states|metros|counties|cities|zips}`
- `GET /api/census/population-growth/{level}`
- `GET /api/census/median-income/{level}`
- `GET /api/census/income-growth/{level}`

### Frontend Components

- Market detail page — demographics panel (population, income, age)
- PropertyIQ Score — population growth and income level feed scoring model

---

## 5. BLS (Bureau of Labor Statistics)

**Provider:** BLS Public API  
**Update frequency:** Monthly (county data lags national by 2–3 months)  
**Table:** `economic_county`

### Database Table

| Table | Key columns |
|---|---|
| `economic_county` | `region_id`, `period_date`, `unemployment_rate`, `employment_level` |

### API Endpoints

- Unemployment data surfaces in the economic indicators section of market pages

### Frontend Components

- Market detail page — unemployment rate time series
- PropertyIQ Score — unemployment rate is a scoring input

---

## 6. FRED (Federal Reserve Bank of St. Louis)

**Provider:** FRED API — `api.stlouisfed.org/fred/series/observations`  
**Update frequency:** Monthly  
**Ingestion service:** `packages/backend/src/data-ingestion/sources/fred.service.ts`

### Series Imported

| FRED Series ID | Metric name | Description |
|---|---|---|
| `MORTGAGE30US` | `mortgage_rate_30yr` | 30-Year Fixed Rate Mortgage Average |
| `MORTGAGE15US` | `mortgage_rate_15yr` | 15-Year Fixed Rate Mortgage Average |
| `UNRATE` | `unemployment_rate` | National Unemployment Rate |

### Database Table

| Table | Key columns |
|---|---|
| `economic_national` | `region_id` (fixed: `102001` = United States), `period_date`, `mortgage_rate_30yr`, `mortgage_rate_15yr`, `unemployment_rate` |

Conflict key: `(region_id, period_date)`  
Auth: `FRED_API_KEY` environment variable required

### API Endpoints

- National economic indicators surface in market context panels
- Mortgage rate is used in rent vs. own calculations and affordability scoring

### Frontend Components

- Market detail page — national economic context (mortgage rates)
- Affordability calculator — uses current mortgage rate
- PropertyIQ Score — mortgage rate environment feeds national macro scoring signal

---

## 7. HUD Fair Market Rents

**Provider:** HUD API  
**Update frequency:** Annual  
**Table:** `hud_fmr`

### Database Table

| Table | Key columns |
|---|---|
| `hud_fmr` | `region_id`, `year`, `fmr_0br`, `fmr_1br`, `fmr_2br`, `fmr_3br`, `fmr_4br` |

FMR = Fair Market Rent for 0–4 bedroom units at the county/metro level

### API Endpoints

- HUD FMR data surfaces in rent affordability and rent pricing analysis

### Frontend Components

- Market detail page — rent affordability panel
- Quinn tool: `rent_pricing_analysis` — uses HUD FMR as a benchmark

---

## 8. Building Permits

**Provider:** U.S. Census Bureau (new residential construction API)  
**Update frequency:** Monthly (~2 month lag)  
**Table:** `permits_county`

### Database Table

| Table | Key columns |
|---|---|
| `permits_county` | `region_id`, `period_date`, `total_units`, `single_family_units`, `multi_family_units` |

### API Endpoints

- Permit data contributes to supply-side analysis in market scoring

### Frontend Components

- PropertyIQ Score — permit activity is a housing supply signal in the scoring model

---

## Ingestion Log

All imports write a status record to `data_ingestion_log` (migration 026):

```
source → table_name → metric_name → records_processed → records_success → records_error
status: 'running' | 'success' | 'partial' | 'failed'
```

Real-time pipeline status is also POSTed to `/api/health/pipeline-status` (protected by `PIPELINE_API_KEY`), which powers the health dashboard at `GET /api/health/data-sources`.

---

## Data Freshness Thresholds

| Source | Expected freshness | Stale after |
|---|---|---|
| Zillow | 60 days | 75 days |
| Realtor.com | 60 days | 75 days |
| Redfin (sales) | 60 days | 75 days |
| BLS | 95 days | ~119 days |
| FRED | 60 days | 75 days |
| HUD FMR | 438 days | ~548 days |
| Building Permits | 60 days | 75 days |
| Census ACS | 900 days | ~1125 days |

Thresholds are enforced by `DataSourcesHealthService.checkAllSources()` — the health dashboard will flag `degraded` status if more than one source exceeds its stale threshold.
