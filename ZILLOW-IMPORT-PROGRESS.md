# Zillow Data Import Progress

## Current Status: COMPLETE - All 20 Tables Populated

Last verified: 2026-01-11

## Database Record Counts

| Table | Records | Status |
|-------|---------|--------|
| `zillow_zhvi` | 9,140,311 | OK |
| `zillow_zhvf` | 21,042 | OK |
| `zillow_zori` | 839,846 | OK |
| `zillow_zordi` | 48,047 | OK |
| `zillow_inventory` | 448,945 | OK |
| `zillow_sales_count` | 20,107 | OK |
| `zillow_sales_price` | 127,161 | OK |
| `zillow_days_to_pending` | 46,520 | OK |
| `zillow_market_heat_index` | 85,773 | OK |
| `zillow_new_construction_sales_count` | 28,965 | OK |
| `zillow_new_construction_sale_price` | 15,303 | OK |
| `zillow_affordability` | 105,269 | OK |
| `zillow_new_listings` | 82,277 | OK |
| `zillow_pending_listings` | 68,860 | OK |
| `zillow_median_list_price` | 84,211 | OK |
| `zillow_sale_to_list` | 40,780 | OK |
| `zillow_days_to_close` | 40,689 | OK |
| `zillow_price_cut_share` | 84,658 | OK |
| `zillow_price_cut_amt` | 41,245 | OK |
| `zillow_price_cut_pct` | 41,842 | OK |

**Total: 11.4+ million records across 20 tables**

---

## Implementation Overview

The Zillow data pipeline is fully operational with:
- **20 database tables** with real data
- **28+ API endpoints** in NestJS backend
- **40+ dataset configurations** in frontend
- **Monthly automated import** via GitHub Actions

---

## Database Tables (20 Total)

### Core Data Tables (12)
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `zillow_zhvi` | Home Value Index | value, tier, property_type |
| `zillow_zhvf` | Home Value Forecast | forecast_1m, forecast_3m, forecast_12m |
| `zillow_zori` | Observed Rent Index | value, property_type |
| `zillow_zordi` | Renter Demand Index | value, property_type |
| `zillow_inventory` | For-Sale Inventory | inventory_count |
| `zillow_sales_count` | Sales Count | sales_count |
| `zillow_sales_price` | Median Sale Price | median_price |
| `zillow_days_to_pending` | Days to Pending | days |
| `zillow_market_heat_index` | Market Heat | heat_index |
| `zillow_new_construction_sales_count` | New Construction Sales | sales_count |
| `zillow_new_construction_sale_price` | New Construction Price | median_price, price_per_sqft |
| `zillow_affordability` | Affordability Metrics | homeowner_income_needed, years_to_save, etc. |

### Market Indicator Tables (8 - Added 2026-01-11)
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `zillow_new_listings` | New Listings Count | value |
| `zillow_pending_listings` | Pending Listings Count | value |
| `zillow_median_list_price` | Median List Price | value |
| `zillow_sale_to_list` | Sale-to-List Ratio | value |
| `zillow_days_to_close` | Days to Close | value |
| `zillow_price_cut_share` | % Listings with Price Cut | value |
| `zillow_price_cut_amt` | Median Price Cut Amount | value |
| `zillow_price_cut_pct` | Median Price Cut Percent | value |

---

## API Endpoints (28+)

### Home Values & Forecasts
- `GET /api/zillow/metros` - Metro home values
- `GET /api/zillow/states` - State home values
- `GET /api/zillow/counties` - County home values
- `GET /api/zillow/cities` - City home values
- `GET /api/zillow/zips` - ZIP code home values
- `GET /api/zillow/forecasts/metros` - Metro forecasts
- `GET /api/zillow/forecasts/zips` - ZIP forecasts

### Rental Data
- `GET /api/zillow/rents/metros` - Metro rent index
- `GET /api/zillow/rents/counties` - County rent index
- `GET /api/zillow/rents/cities` - City rent index
- `GET /api/zillow/rents/zips` - ZIP rent index
- `GET /api/zillow/demand/metros` - Metro renter demand

### Market Indicators
- `GET /api/zillow/inventory/metros` - For-sale inventory
- `GET /api/zillow/new-listings/metros` - New listings
- `GET /api/zillow/pending-listings/metros` - Pending listings
- `GET /api/zillow/list-price/metros` - Median list price
- `GET /api/zillow/sales-count/metros` - Sales count
- `GET /api/zillow/sale-price/metros` - Median sale price
- `GET /api/zillow/sale-to-list/metros` - Sale-to-list ratio
- `GET /api/zillow/days-to-pending/metros` - Days to pending
- `GET /api/zillow/days-to-close/metros` - Days to close
- `GET /api/zillow/market-heat/metros` - Market heat index
- `GET /api/zillow/price-cuts/metros` - Price cuts (combined metrics)
- `GET /api/zillow/new-construction/metros` - New construction
- `GET /api/zillow/affordability/metros` - Affordability metrics

---

## Dataset Configurations (40+)

### By Category:
| Category | Count | Examples |
|----------|-------|----------|
| ZHVI (Home Values) | 9 | Metro, State, County, City, ZIP + tiers |
| ZHVF (Forecasts) | 2 | Metro, ZIP |
| ZORI (Rent Index) | 6 | Metro, County, City, ZIP |
| ZORDI (Renter Demand) | 1 | Metro |
| For-Sale Listings | 6 | Inventory, New Listings, Pending, List Price |
| Sales | 4 | Count, Price, Sale-to-List |
| Days on Market | 2 | Days to Pending, Days to Close |
| Price Cuts | 3 | Share, Amount, Percent |
| Market Heat | 1 | Market Temperature Index |
| New Construction | 3 | Sales Count, Sale Price, Price/SqFt |
| Affordability | 6 | Income Needed, Affordable Price, Years to Save |

---

## Key Files

### Import Scripts
- `scripts/import-all-zillow-datasets.ts` - Main import script (runs all datasets)
- `scripts/import-missing-zillow-datasets.ts` - Import only empty tables
- `scripts/verify-and-import-zillow.ts` - Verify table status

### Database
- `scripts/migrations/026-create-additional-zillow-market-tables.sql` - Table definitions
- `scripts/fix-zillow-tables.sql` - Fix script for table schema issues
- `scripts/zillow-all-import/db-client.ts` - Table routing & conflict columns
- `scripts/zillow-all-import/csv-processor.ts` - CSV parsing & record building

### Backend API
- `packages/backend/src/zillow/zillow.controller.ts` - 28 API endpoints
- `packages/backend/src/zillow/zillow.service.ts` - Business logic
- `packages/backend/src/zillow/helpers/queries.ts` - Database queries

### Configuration
- `packages/frontend/lib/data-ingestion/sources/zillow-datasets/config.ts` - Dataset URLs

### Automation
- `.github/workflows/zillow-monthly-import.yml` - Monthly cron job

---

## Running Imports

### Verify Current Status
```bash
npx tsx scripts/verify-and-import-zillow.ts --check-only
```

### Import All Datasets
```bash
npx tsx scripts/import-all-zillow-datasets.ts
```

### Import Missing Tables Only
```bash
npx tsx scripts/import-missing-zillow-datasets.ts
```

---

## Monthly Automation

GitHub Actions workflow runs on the **18th of each month at 6:00 AM UTC**.

### Schedule
- Zillow publishes new data around the 15th-16th of each month
- Import runs on the 18th to ensure data is available
- Cron: `0 6 18 * *`

### Failure Notifications
On failure or partial failure:
- Creates a GitHub Issue automatically
- Labels: `bug`, `data-import`, `automated`
- Includes workflow run link and list of tables to check
- Avoids duplicate issues for same day

### Manual Trigger
Go to Actions > Zillow Data Monthly Import > Run workflow

---

## Architecture

```
Zillow CSV Files (zillowstatic.com)
       |
       v
[Download] scripts/zillow-all-import/download.ts
       |
       v
[Parse CSV] scripts/zillow-all-import/csv-processor.ts
       |
       v
[Route to Table] scripts/zillow-all-import/db-client.ts
       |
       v
[Batch Upsert] Supabase Client (10,000 records/batch)
       |
       v
[20 Zillow Tables] in Supabase (11.4M+ records)
       |
       v
[NestJS API] packages/backend/src/zillow/
       |
       v
[Frontend] Map, Graph, Reports, LLM
```

---

## Troubleshooting

### Import Fails
1. Run `npx tsx scripts/verify-and-import-zillow.ts --check-only` to see table status
2. Check Supabase credentials in `packages/backend/.env`
3. Check if Zillow CSV URLs have changed (they update URLs occasionally)

### Table Schema Issues
If tables exist but inserts fail with "column not found":
1. Run `scripts/fix-zillow-tables.sql` in Supabase SQL Editor
2. This drops and recreates the affected tables with correct schema

### Missing Data
1. Check table counts match expected (see Record Counts section)
2. Re-run specific import: `npx tsx scripts/import-missing-zillow-datasets.ts`

### API Returns Empty
1. Verify data exists: check table in Supabase dashboard
2. Check date parameter - data may not exist for requested date
3. Try `?date=2025-11-30` (or latest available date)
