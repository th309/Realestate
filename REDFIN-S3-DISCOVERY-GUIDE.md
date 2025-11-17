# Redfin S3 Data Discovery and Import Guide

## Overview

Redfin doesn't provide a public REST API, but they do host their data files directly on AWS S3. This guide explains how to discover and download Redfin data programmatically using the direct S3 URLs.

## What We Found

From the Redfin Data Center page (https://www.redfin.com/news/data-center/), we discovered direct S3 download URLs for:

1. **Weekly Housing Market Data** - Updated every Wednesday
2. **Monthly Market Trackers** by geographic level:
   - National
   - Metro
   - State
   - County
   - City
   - Zip Code
   - Neighborhood

All files are hosted at: `https://redfin-public-data.s3.us-west-2.amazonaws.com/`

## Scripts Created

### 1. `scripts/discover-redfin-s3-datasets.ts`

Discovers all available Redfin datasets by scraping the Data Center page for S3 download links.

**Features:**
- Scrapes the main Data Center page
- Checks additional pages (Investor Data, Rental Data, Buyer vs Seller Dynamics)
- Verifies S3 URLs are accessible
- Creates a manifest file with all discovered datasets
- Generates both JSON and TypeScript manifest files

**Usage:**
```bash
npm run discover-redfin-s3
```

**Output:**
- `redfin_downloads/s3-manifest.json` - JSON manifest
- `redfin_downloads/s3-manifest.ts` - TypeScript manifest

### 2. `scripts/download-and-import-redfin-s3.ts`

Downloads and imports Redfin data directly from S3 URLs.

**Features:**
- Downloads files directly from S3 (no browser automation needed)
- Handles gzipped files automatically
- Imports data into the database using existing import functions
- Supports filtering by category and geographic level
- Progress tracking and error reporting

**Usage:**
```bash
# Import all datasets
npm run import-redfin-s3

# Import specific category
npm run import-redfin-s3 -- --category housing_market

# Import specific geographic level
npm run import-redfin-s3 -- --geographic-level metro

# Limit number of datasets
npm run import-redfin-s3 -- --limit 3
```

## Known S3 URLs

Based on our discovery, here are the known S3 URLs:

### Weekly Data
- `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_covid19/weekly_housing_market_data_most_recent.tsv000.gz`

### Monthly Market Trackers
- National: `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/us_national_market_tracker.tsv000.gz`
- Metro: `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/redfin_metro_market_tracker.tsv000.gz`
- State: `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/state_market_tracker.tsv000.gz`
- County: `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/county_market_tracker.tsv000.gz`
- City: `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/city_market_tracker.tsv000.gz`
- Zip Code: `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz`
- Neighborhood: `https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/neighborhood_market_tracker.tsv000.gz`

## Advantages Over Previous Approach

### Previous Approach (Puppeteer)
- ❌ Required browser automation
- ❌ Slower (page loading, JavaScript execution)
- ❌ More fragile (page structure changes break it)
- ❌ Resource intensive

### New Approach (Direct S3 URLs)
- ✅ Direct HTTP downloads (fast)
- ✅ No browser automation needed
- ✅ More reliable (S3 URLs are stable)
- ✅ Handles gzipped files automatically
- ✅ Can be run in any environment (no headless browser needed)

## File Format

All Redfin files are:
- **Format**: TSV (Tab-Separated Values)
- **Compression**: Gzip (.gz)
- **Encoding**: UTF-8 (after decompression)

The files use a cross-tab format where:
- Column A: Region name
- Column B: Month/Period End date
- Columns C+: Multiple metrics with MoM and YoY change columns

## Integration with Existing Code

The scripts integrate with the existing Redfin import infrastructure:

- Uses `importRedfinData()` from `web/lib/data-ingestion/sources/redfin.ts`
- Creates market records following the same pattern as other data sources
- Stores data in `market_time_series` table with `data_source = 'redfin'`
- Supports the same metric auto-detection as manual uploads

## Next Steps

1. **Run Discovery**: 
   ```bash
   npm run discover-redfin-s3
   ```
   This will create/update the manifest with all available datasets.

2. **Review Manifest**:
   Check `redfin_downloads/s3-manifest.json` to see what datasets are available.

3. **Import Data**:
   ```bash
   # Start with a small test
   npm run import-redfin-s3 -- --limit 1
   
   # Then import all
   npm run import-redfin-s3
   ```

4. **Verify Import**:
   ```sql
   SELECT 
     COUNT(*) as total_records,
     COUNT(DISTINCT region_id) as unique_regions,
     COUNT(DISTINCT metric_name) as unique_metrics,
     MIN(date) as earliest_date,
     MAX(date) as latest_date
   FROM market_time_series
   WHERE data_source = 'redfin';
   ```

## Troubleshooting

### Puppeteer Not Found
If you get an error about Puppeteer not being found:
```bash
npm install puppeteer
```

### Module Import Errors
Make sure you're running scripts from the project root:
```bash
cd /path/to/project/root
npm run discover-redfin-s3
```

### Large File Downloads
Some files can be large (100MB+). The script has a 5-minute timeout and 500MB max size limit. If downloads fail:
- Check your internet connection
- Verify the S3 URL is still accessible
- Try downloading a single dataset first

### Gzip Decompression Errors
If you see gzip errors, the file might not be compressed. The script should handle this automatically, but if issues persist, check the file format.

## API Endpoint

You can also use the existing API endpoint with direct S3 URLs:

```bash
curl -X GET "http://localhost:3000/api/import-redfin?url=https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/redfin_metro_market_tracker.tsv000.gz"
```

## References

- Redfin Data Center: https://www.redfin.com/news/data-center/
- Redfin S3 Bucket: `redfin-public-data.s3.us-west-2.amazonaws.com`
- Existing Redfin Import Guide: `REDFIN-MANUAL-UPLOAD-GUIDE.md`

