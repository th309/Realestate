# Zillow Data Automation Guide

This guide explains how to automate downloading and importing Zillow Research Data.

## Overview

Zillow provides publicly available CSV downloads of their research data at https://www.zillow.com/research/data/. The data is updated monthly on the 16th of each month.

**Important Notes:**
- ✅ **Direct CSV downloads are allowed** - The CSV files are publicly accessible
- ❌ **No official API** - Zillow doesn't provide a public API for bulk data downloads
- ⚠️ **Bridge Interactive API** - Available but has limitations (1,000 calls/day, no local storage allowed)

## Available Data Types

### 1. Home Values (ZHVI)
- All Homes, Single-Family, Condo/Co-op
- Top Tier, Middle Tier, Bottom Tier
- By Bedroom Count (1-5+)
- Smoothed/Raw, Seasonally Adjusted
- Available at: Metro, State, County, City, ZIP, Neighborhood levels

### 2. Rentals (ZORI)
- All Homes Plus Multifamily
- Single Family Residence
- Multi Family Residence
- Smoothed, Seasonally Adjusted
- Available at: Metro, ZIP, County, City levels

### 3. For-Sale Listings
- Inventory counts
- New listings
- Newly pending listings
- Median list price
- Available at: Metro level

### 4. Sales
- Sales count (nowcast)
- Median/Mean sale price
- Total transaction value
- Sale-to-list ratio
- Available at: Metro level

### 5. Days on Market & Price Cuts
- Days to pending
- Days to close
- Share of listings with price cuts
- Mean/Median price cuts
- Available at: Metro level

### 6. Market Heat Index
- Market temperature index
- Available at: Metro level

### 7. New Construction
- Sales count
- Median/Mean sale price
- Price per square foot
- Available at: Metro level

### 8. Affordability
- New homeowner income needed
- New renter income needed
- Affordable home price
- Years to save
- Affordability percentages
- Available at: Metro level

## Usage

### 1. List Available Datasets

```bash
npx tsx scripts/download-zillow-data.ts --list
```

This will show all available datasets with their IDs, descriptions, and download URLs.

### 2. Download a Specific Dataset

```bash
# Download by dataset ID
npx tsx scripts/download-zillow-data.ts --dataset zhvi-metro-all-homes-sm-sa

# Download to custom directory
npx tsx scripts/download-zillow-data.ts --dataset zhvi-metro-all-homes-sm-sa --output ./data/zillow
```

### 3. Download by Category

```bash
# Download all HOME VALUES datasets
npx tsx scripts/download-zillow-data.ts --category "HOME VALUES"

# Download all RENTALS datasets
npx tsx scripts/download-zillow-data.ts --category "RENTALS"
```

### 4. Download by Geography

```bash
# Download all Metro datasets
npx tsx scripts/download-zillow-data.ts --geography Metro

# Download all State datasets
npx tsx scripts/download-zillow-data.ts --geography State
```

### 5. Download by Dataset Type

```bash
# Download all ZHVI datasets
npx tsx scripts/download-zillow-data.ts --type zhvi

# Download all ZORI datasets
npx tsx scripts/download-zillow-data.ts --type zori
```

### 6. Combine Filters

```bash
# Download all Metro HOME VALUES datasets
npx tsx scripts/download-zillow-data.ts --category "HOME VALUES" --geography Metro

# Download all Metro ZHVI datasets
npx tsx scripts/download-zillow-data.ts --type zhvi --geography Metro
```

### 7. Download All Datasets

```bash
# Download all available datasets (use with caution - this will download many files)
npx tsx scripts/download-zillow-data.ts --all

# Download first 5 datasets (for testing)
npx tsx scripts/download-zillow-data.ts --all --limit 5
```

## URL Pattern

Zillow CSV URLs follow this pattern:

```
https://files.zillowstatic.com/research/public_csvs/{dataset_type}/{Geography}_{dataset_type}_uc_{property_type}_tier_{tier}_{smoothing}_{seasonal_adj}_{frequency}.csv
```

Example:
```
https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv
```

Components:
- `dataset_type`: zhvi, zori, invt_fs, sales_count_now, etc.
- `Geography`: Metro, State, County, City, Zip, National
- `property_type`: sfrcondo, sfr, condo, mfr, 1bedroom, 2bedroom, etc.
- `tier`: 0.33_0.67 (middle), 0.67_0.95 (top), 0.05_0.33 (bottom)
- `smoothing`: sm (smoothed) or omitted (raw)
- `seasonal_adj`: sa (seasonally adjusted) or omitted
- `frequency`: month or week

## Programmatic Usage

### Using the Dataset Configuration

```typescript
import {
  ZILLOW_DATASETS,
  getDatasetsByCategory,
  getDatasetsByGeography,
  buildZillowUrl
} from '@/lib/data-ingestion/sources/zillow-datasets';

// Get all HOME VALUES datasets
const homeValueDatasets = getDatasetsByCategory('HOME VALUES');

// Get all Metro datasets
const metroDatasets = getDatasetsByGeography('Metro');

// Build a custom URL
const customUrl = buildZillowUrl('zhvi', 'State', {
  propertyType: 'sfr',
  tier: '0.33_0.67',
  smoothing: 'sm',
  seasonalAdjustment: true
});
```

### Downloading Programmatically

```typescript
import axios from 'axios';
import { getDatasetById } from '@/lib/data-ingestion/sources/zillow-datasets';

async function downloadZillowData(datasetId: string) {
  const config = getDatasetById(datasetId);
  if (!config) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }
  
  const response = await axios.get(config.downloadUrl);
  return response.data; // CSV content as string
}
```

### Importing into Database

Use the existing `importZillowData` function from `zillow-v2.ts`:

```typescript
import { importZillowData } from '@/lib/data-ingestion/sources/zillow-v2';

// Import ZHVI data
await importZillowData('zhvi');
```

## Integration with Existing System

The existing Zillow import system (`zillow-v2.ts`) currently has hardcoded URLs for a few datasets. The new system:

1. **Extends the existing system** - Adds comprehensive dataset discovery
2. **Maintains compatibility** - Existing imports continue to work
3. **Adds flexibility** - Can download any available dataset
4. **Provides automation** - Scripts for bulk downloads

## Data Update Schedule

- **Update Frequency**: Monthly
- **Update Date**: 16th of each month
- **Example**: On July 16th, June data becomes available

## File Structure

```
scripts/
  download-zillow-data.ts          # Main download script
  discover-zillow-datasets.ts      # Dataset discovery (optional)

web/lib/data-ingestion/sources/
  zillow-datasets.ts               # Dataset configuration
  zillow-v2.ts                     # Existing import function

data/zillow/                       # Downloaded CSV files (created automatically)
  zhvi-metro-all-homes-sm-sa.csv
  zori-metro-all-homes-sm.csv
  ...
```

## Troubleshooting

### 404 Errors

If you get a 404 error, the URL pattern may have changed or the dataset may not be available for that geography/type combination. Check the Zillow research data page to verify the URL.

### Rate Limiting

The script includes a 1-second delay between downloads. If you encounter rate limiting, increase the delay in the script.

### Large Files

Some datasets (especially ZIP code level) can be very large (100MB+). Make sure you have sufficient disk space and bandwidth.

## Next Steps

1. **Test Downloads**: Start with a few specific datasets to verify the URLs work
2. **Verify Data**: Check the downloaded CSV files to ensure they contain expected data
3. **Integrate Imports**: Connect the download script to the existing import system
4. **Schedule Updates**: Set up a monthly cron job to download updated data on the 16th

## References

- [Zillow Research Data Page](https://www.zillow.com/research/data/)
- [Bridge Interactive API](https://www.bridgeinteractive.com/developers/zillow-group-data/) (Alternative, but limited)
- Existing import code: `web/lib/data-ingestion/sources/zillow-v2.ts`

