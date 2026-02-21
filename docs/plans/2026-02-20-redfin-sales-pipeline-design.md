# Redfin Sales Data Pipeline Design

**Date:** 2026-02-20
**Status:** Approved
**Author:** Claude (assisted)

## Overview

Integrate Redfin's publicly available market tracker data into the PropertyIQ platform. Redfin publishes weekly housing market data as gzipped TSV files on AWS S3, covering 14 core metrics across 7 geography levels.

## Data Source

**Redfin Data Center:** https://www.redfin.com/news/data-center/

**S3 Bucket:** `redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/`

| Geography | S3 File | Approx Size |
|-----------|---------|-------------|
| National | `us_national_market_tracker.tsv000.gz` | ~1 MB |
| State | `state_market_tracker.tsv000.gz` | ~50 MB |
| Metro | `redfin_metro_market_tracker.tsv000.gz` | ~100 MB |
| County | `county_market_tracker.tsv000.gz` | ~200 MB |
| City | `city_market_tracker.tsv000.gz` | ~500 MB |
| ZIP | `zip_code_market_tracker.tsv000.gz` | ~800 MB |
| Neighborhood | `neighborhood_market_tracker.tsv000.gz` | ~300 MB |

**Update Frequency:** Weekly (Wednesdays)

## Design Decisions

### 1. Schema Style: Wide-Format
Matches existing `redfin_rental_*` tables. One row per geography/date/property_type with 42 metric columns (14 core + 14 MoM + 14 YoY).

### 2. Property Types: All Stored
All 5 property types are stored: All Residential, Single Family Residential, Condo/Co-op, Townhouse, Multi-Family (2-4 Unit). Enables property-type comparisons.

### 3. Seasonal Adjustment: Non-Adjusted Only
Raw (non-seasonally-adjusted) data stored. Seasonal adjustment mainly matters at national/state level and can be applied in the application layer if needed.

### 4. No Scraping Required
Direct S3 downloads. No Puppeteer, no rate limiting, no API keys.

## Database Schema

### 7 Tables

| Table | Geography ID | Unique Constraint |
|-------|-------------|-------------------|
| `redfin_national` | — | `(period_end, property_type)` |
| `redfin_state` | `state_code` | `(period_end, state_code, property_type)` |
| `redfin_metro` | `region_name` | `(period_end, region_name, property_type)` |
| `redfin_county` | `county_name + state_code` | `(period_end, county_name, state_code, property_type)` |
| `redfin_city` | `city_name + state_code` | `(period_end, city_name, state_code, property_type)` |
| `redfin_zip` | `zip_code` | `(period_end, zip_code, property_type)` |
| `redfin_neighborhood` | `neighborhood_name + city + state_code` | `(period_end, neighborhood_name, city, state_code, property_type)` |

### 14 Core Metrics (each with _mom and _yoy variants = 42 columns)

| Metric | Description | Format |
|--------|-------------|--------|
| `median_sale_price` | Median final sale price | Currency |
| `median_list_price` | Median asking price | Currency |
| `median_ppsf` | Median sale price per sq ft | Currency |
| `median_list_ppsf` | Median list price per sq ft | Currency |
| `homes_sold` | Closed sales count | Integer |
| `pending_sales` | Homes going under contract | Integer |
| `new_listings` | Newly listed homes | Integer |
| `inventory` | Active listings at period end | Integer |
| `months_of_supply` | Inventory / sales rate | Decimal |
| `median_dom` | Median days on market | Integer |
| `avg_sale_to_list` | Mean sale-to-list ratio | Decimal |
| `sold_above_list` | % sold above asking | Decimal |
| `price_drops` | % with price reductions | Decimal |
| `off_market_in_two_weeks` | % under contract within 14 days | Decimal |

## Import Pipeline

```
S3 (.tsv000.gz)
  → fetch + gunzipSync
  → csv-parse (TSV mode)
  → filter: is_seasonally_adjusted = FALSE
  → map to RedfinSalesRecord
  → batch upsert (500 rows) to Supabase
  → repeat for each geo level
```

### CLI Usage
```bash
# Import all geography levels
npx tsx scripts/redfin-sales-import/import-redfin-sales.ts

# Import single geography
npx tsx scripts/redfin-sales-import/import-redfin-sales.ts --geo=metro

# Limit rows (testing)
npx tsx scripts/redfin-sales-import/import-redfin-sales.ts --geo=zip --limit=1000
```

## Automation

**GitHub Actions:** `.github/workflows/redfin-weekly-import.yml`
- **Schedule:** Every Thursday at 8:00 AM UTC
- **Manual trigger:** With geo_level filter option
- **Failure handling:** Creates GitHub issue with `data-import` label
- **Post-import:** Triggers `post-import-refresh.yml`

## Files Created

| File | Purpose |
|------|---------|
| `scripts/migrations/103-create-redfin-sales-tables.sql` | Database migration |
| `scripts/redfin-sales-import/types.ts` | Type definitions and S3 URLs |
| `scripts/redfin-sales-import/download.ts` | S3 download + gunzip |
| `scripts/redfin-sales-import/parser.ts` | TSV parsing and record mapping |
| `scripts/redfin-sales-import/import-redfin-sales.ts` | Main orchestrator |
| `.github/workflows/redfin-weekly-import.yml` | Weekly automation |

## Future Work

- Register Redfin metrics in frontend `lib/data/registry.ts`
- Add backend API endpoints for Redfin data
- Cross-reference with Zillow/Realtor data for validation
- Add data freshness tracking to `redfin_metadata` table
