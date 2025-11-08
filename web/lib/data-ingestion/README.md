# Data Ingestion Module

## Overview

This module handles fetching, parsing, validating, and storing data from various real estate data sources.

## Structure

```
data-ingestion/
├── sources/          # Data source fetchers
│   ├── zillow.ts     # Zillow CSV downloader with Puppeteer
│   ├── census.ts     # Census API client (to be built)
│   ├── fred.ts       # FRED API client (to be built)
│   └── ...
├── utils/            # Utility functions
│   └── geo-mapping.ts # Map region names to geo_codes
├── validators/       # Data quality validation
│   └── data-quality.ts
└── processors/       # Data normalization (to be built)
```

## Zillow Data Fetcher

### Features

- **Puppeteer Integration**: Automatically finds current CSV URLs from Zillow Research page
- **Fallback URLs**: Uses known URLs if Puppeteer fails
- **CSV Parsing**: Parses Zillow CSV format with date columns
- **Geo Mapping**: Maps Zillow region names to our geo_code format
- **Data Validation**: Validates data quality before storing
- **Batch Storage**: Efficiently stores data in database

### Supported Datasets

- `zhvi` - Home values (ZHVI)
- `zori` - Rent prices (ZORI)
- `inventory` - Active inventory
- `daysOnMarket` - Days on market
- `priceCuts` - Price cuts

### Usage

```typescript
import { fetchZillowData, storeZillowData } from '@/lib/data-ingestion/sources/zillow'

// Fetch data
const dataPoints = await fetchZillowData(['zhvi', 'inventory'])

// Store in database
await storeZillowData(dataPoints)
```

### Testing

Test via API:
```
GET /api/test-zillow?datasets=zhvi&store=false
```

Parameters:
- `datasets`: Comma-separated list (default: `zhvi`)
- `store`: Set to `true` to store in database (default: `false`)

## Data Quality Validation

All data is validated before storage:
- Required fields present
- Date format correct
- Numeric values valid
- Outlier detection
- Quality reports logged to database

## Next Steps

- Build Census API client
- Build FRED API client
- Add data normalization layer
- Implement scoring engine

