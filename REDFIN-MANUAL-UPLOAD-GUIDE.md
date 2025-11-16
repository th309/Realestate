# Redfin Data Manual Upload Guide

## Overview

Since automatic discovery isn't working, we'll manually download Redfin CSV files and upload them through the web interface.

## Step-by-Step Process

### Step 1: Download Redfin CSV Files

1. Go to [Redfin Data Center](https://www.redfin.com/news/data-center/)
2. Browse the available datasets:
   - **Housing Market Data**: Median sale price, homes sold, inventory, days on market
   - **Investor Data**: Investor purchases, cash buyers, flipping rates
   - **Rental Data**: Median rent, rental inventory
   - **Buyer vs. Seller Dynamics**: Market activity metrics
3. Click on any dataset to download the CSV/TSV file
4. Save the file to your computer (remember the filename and what data it contains)

### Step 2: Upload via Web Interface

1. Start your development server:
   ```bash
   cd web
   npm run dev
   ```

2. Navigate to the test page:
   ```
   http://localhost:3000/test
   ```

3. Scroll down to the **"Redfin Data Import"** section

4. Find the **"📁 Manual File Upload"** box (blue background)

5. **Optional**: Enter a metric name in the text field
   - Examples: `median_sale_price`, `homes_sold`, `inventory`, `investor_purchases_by_metro`
   - **Tip**: Leave it empty to let the importer auto-detect all metrics from the file

6. Click **"📤 Choose CSV File to Upload"**

7. Select the Redfin CSV/TSV file you downloaded

8. Wait for upload and import to complete
   - Progress bar will show upload progress
   - Results will appear below showing:
     - Number of markets created
     - Number of time series records inserted
     - Any errors encountered

### Step 3: Verify Import

After upload, verify the data was imported:

```sql
-- Check Redfin markets created
SELECT COUNT(*) as redfin_markets
FROM markets
WHERE region_id LIKE 'REDFIN-%';

-- Check time series records
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT region_id) as unique_regions,
  COUNT(DISTINCT metric_name) as unique_metrics,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM market_time_series
WHERE data_source = 'redfin';

-- List all Redfin metrics imported
SELECT DISTINCT metric_name 
FROM market_time_series 
WHERE data_source = 'redfin'
ORDER BY metric_name;
```

Or check via the API:
```
GET http://localhost:3000/api/metrics
```

## Supported File Formats

The importer supports:

1. **Cross Tab Format** ⭐ **PRIMARY FORMAT - Most Common**:
   - One row per region per time period (month/quarter)
   - **Column A: Region** - Contains ALL regions in the dataset:
     - Starts with "National" (multiple rows for different months)
     - Then changes to metro areas like "Boston, MA metro area" (multiple rows for different months)
     - Then other metros, cities, etc.
     - **The importer automatically detects when the region changes and processes each region separately**
   - **Column B: Month of Period End** (e.g., "Jan-12", "Feb-12", "2025 Q2")
   - **Columns C-T: Multiple metrics** in other columns, each with:
     - Base value (e.g., "Median Sale Price": $159K)
     - MoM (Month-over-Month) change column
     - YoY (Year-over-Year) change column
   - **Example structure** (from your image):
     - Column A: Region (changes: "National", then "Boston, MA metro area", then other metros)
     - Column B: Month of Period End
     - Column C: Median Sale Price
     - Column D: Median Sale Price MoM
     - Column E: Median Sale Price YoY
     - Column F: Homes Sold
     - Column G: Homes Sold MoM
     - Column H: Homes Sold YoY
     - ... and so on for all metrics
   - **This is the format used for the largest Redfin datasets!**
   - **The importer processes each row and automatically:**
     - Detects when Column A changes to a new region
     - Creates or maps to the correct market record
     - Imports all metrics for that region/month combination

2. **Data Format** (less common):
   - One row per region
   - Date columns (YYYY-MM-DD format) with metric values

## Common Metric Names

When entering a metric name, use these common names:

- `median_sale_price` - Median sale price
- `homes_sold` - Number of homes sold
- `inventory` - Active inventory count
- `median_days_on_market` - Average days on market
- `price_per_square_foot` - Price per square foot
- `investor_market_share` - Investor share of sales
- `cash_buyer_share` - Cash buyer percentage
- `flipping_rate` - Home flipping rate
- `median_rent` - Median rental price
- `new_listings` - New listings count

**Note**: If you leave the metric name empty, the importer will automatically detect and import ALL metrics found in the file. 

**For Cross-Tab Format Files** (like the one in your image):
- The importer automatically detects this format
- It extracts ALL metrics from the file (Median Sale Price, Homes Sold, New Listings, Inventory, Days on Market, Average Sale To List, etc.)
- It also imports the MoM and YoY change columns for each metric
- You don't need to specify metric names - just leave it empty and upload!

## Performance Optimization (Optional)

For large files (10,000+ rows), you can speed up the import significantly by running these SQL commands in Supabase **before** starting the upload:

### Quick Optimization (Recommended)
Run these in Supabase SQL Editor before importing:

```sql
-- Increase memory for bulk operations
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';
SET effective_cache_size = '2GB';
```

After the import completes, run:
```sql
-- Update statistics for better query performance
VACUUM ANALYZE market_time_series;
VACUUM ANALYZE markets;
```

### Advanced Optimization (For Very Large Files)
For maximum speed with very large files (100,000+ rows), you can temporarily drop indexes:

**Before import:**
```sql
-- Drop indexes temporarily (speeds up inserts significantly)
DROP INDEX IF EXISTS idx_ts_region_date;
DROP INDEX IF EXISTS idx_ts_metric;
DROP INDEX IF EXISTS idx_ts_source;
DROP INDEX IF EXISTS idx_ts_metric_region;
```

**After import:**
```sql
-- Rebuild indexes (this is faster than maintaining them during inserts)
CREATE INDEX idx_ts_region_date ON market_time_series (region_id, date DESC);
CREATE INDEX idx_ts_metric ON market_time_series (metric_name, date DESC);
CREATE INDEX idx_ts_source ON market_time_series (data_source);
CREATE INDEX idx_ts_metric_region ON market_time_series (metric_name, region_id, date DESC);

-- Update statistics
VACUUM ANALYZE market_time_series;
```

**Note**: Dropping indexes will make queries slower during the import, but the import itself will be much faster. The full optimization script is available in `scripts/optimize-redfin-import.sql`.

## Troubleshooting

### Upload Fails
- Check file size (should be under 100MB)
- Verify file is CSV or TSV format
- Check browser console for errors

### No Data Imported
- Check the result message for specific errors
- Verify the CSV format matches expected structure
- Try specifying a metric name manually

### Encoding Issues
- The importer handles UTF-16 encoding automatically
- If you see garbled text, the file might be in a different encoding

### Region Mapping Issues
- The importer creates new market records if regions don't match existing ones
- Check for `REDFIN-*` region IDs in the markets table

## Next Steps

After uploading Redfin data:

1. Verify data appears in `/api/metrics` endpoint
2. Test map visualization with Redfin metrics
3. Upload additional datasets as needed
4. Document which datasets have been imported

## Recommended Datasets to Import

Priority order:

1. **⭐ Monthly Housing Market Data (Cross-Tab Format)** - **START HERE!**
   - This is the largest and most comprehensive dataset
   - Contains: Median Sale Price, Homes Sold, New Listings, Inventory, Days on Market, Average Sale To List
   - Includes MoM and YoY changes for all metrics
   - Format matches the image you showed (Region + Month of Period End + multiple metrics)
   - **Just upload the file - leave metric name empty to import everything!**

2. **Investor Data** - Investor purchases by metro (quarterly, cross-tab format)
3. **Rental Data** - Median rent, rental inventory (cross-tab format)
4. **Market Activity** - Days on market, price cuts (cross-tab format)
5. **Price Metrics** - Price per square foot (cross-tab format)
6. **Buyer vs. Seller Dynamics** - Market balance metrics (cross-tab format)

**Note**: Most Redfin datasets use the cross-tab format shown in your image. The importer automatically detects and handles this format, extracting all metrics and their MoM/YoY columns.

