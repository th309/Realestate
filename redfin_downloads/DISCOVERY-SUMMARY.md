# Redfin Data Discovery Summary

## What We Found

### Direct S3 Downloads (8 datasets)

All files are TSV format, gzipped, and contain comprehensive market data:

1. **National Market Tracker** - 0.45 MB
2. **Metro Market Tracker** - 101.34 MB  
3. **State Market Tracker** - 8.20 MB
4. **County Market Tracker** - 218.98 MB
5. **City Market Tracker** - 923.30 MB
6. **Zip Code Market Tracker** - 1,413.23 MB (1.4 GB)
7. **Neighborhood Market Tracker** - 2,149.09 MB (2.1 GB)
8. **Weekly Housing Market Data** - 749.93 MB

**Total: ~5.5 GB compressed**

## Metrics Available (Based on Tableau Visualization)

The market tracker files are **cross-tab format** files that likely contain ALL of these metrics as columns:

### Core Metrics (from Tableau dashboard):
- **New Listings**
- **Pending Sales**
- **Off Market in Two Weeks**
- **Homes Sold**
- **New Listing Median Price**
- **Median Sale Price**
- **Days to Close**
- **New Listing Median PPSF** (Price Per Square Foot)

### Additional Metrics (likely in files):
- Inventory
- Months of Supply
- Median Days on Market
- Average Sale-to-List Ratio
- Price Drops Percentage
- Year-over-Year (YoY) changes for all metrics
- Month-over-Month (MoM) changes for all metrics

## Geographic Levels Available

- National
- Metro (MSA/CBSA)
- State
- County
- City
- Zip Code
- Neighborhood

## Property Types (may vary by file)

- All Residential
- Single Family Home
- Condo/Co-op
- Townhouse
- Multi-Family (2-4 Unit)

## File Structure

The market tracker files use a **cross-tab format** where:
- **Rows**: Geographic regions (e.g., metro areas, cities, zip codes)
- **Columns**: 
  - Region identifier
  - Date/Period
  - Multiple metrics (each with current value, MoM change, YoY change)
- **Format**: TSV (Tab-Separated Values)
- **Compression**: Gzip

## Tableau Dashboard

The Redfin Data Center uses a Tableau Public dashboard that allows:
- Interactive filtering by metric, geographic level, property type
- Visualization of trends over time
- Download functionality (via download icon in bottom right)

**Note**: The Tableau dashboard likely pulls from the same underlying data as the S3 files, but provides an interactive interface. The S3 files contain the complete raw data.

## Next Steps

1. **Download a small sample** (National or State) to inspect the actual column structure
2. **Map the columns** to understand all available metrics
3. **Create import logic** to parse the cross-tab format
4. **Import data** into the database with proper metric identification

## Recommendation

Start with the **National** or **State** market tracker files (smallest) to:
- Understand the exact column structure
- Identify all available metrics
- Test the import process
- Then scale up to larger files (Metro, County, City, etc.)

