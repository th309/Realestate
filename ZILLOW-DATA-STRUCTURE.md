# Zillow Data Structure Analysis

## Overview
Zillow organizes their real estate data in a time-series format with metadata columns and date columns.

## Metadata Columns
1. **RegionID**: Unique identifier (e.g., "102001" for United States, "394913" for New York)
2. **SizeRank**: Ranking by size (0 = United States, 1 = New York, 2 = Los Angeles, etc.)
3. **RegionName**: Human-readable name (e.g., "New York, NY", "Los Angeles, CA")
4. **RegionType**: Type of region
   - `country`: National level
   - `msa`: Metropolitan Statistical Area (metro)
   - `state`: State level
   - `city`: City level
   - `zip`: ZIP code level
5. **StateName**: Full state name or state code

## Date Columns
- Format: `YYYY-MM-DD` (always end of month)
- Range: January 2000 to current month
- Example: "2024-10-31", "2024-11-30"
- Each date column contains the metric value for that month

## Data Files by Metric Type

### Home Values (ZHVI - Zillow Home Value Index)
- `Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
- Contains median home values

### Rental Prices (ZORI - Zillow Observed Rent Index)
- `Metro_zori_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
- Contains median rental prices

### Inventory
- `Metro_invt_fs_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
- Contains active listing counts

### Days on Market
- `Metro_dom_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
- Average days listings stay active

### Price Cuts
- `Metro_price_cuts_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
- Percentage of listings with price reductions

## File Naming Convention
`{GeographyLevel}_{MetricName}_{PropertyType}_{Tier}_{Smoothing}_{SeasonalAdjustment}_{Frequency}.csv`

- **GeographyLevel**: Metro, State, City, Zip, County
- **MetricName**: zhvi, zori, invt_fs, dom, price_cuts
- **PropertyType**: uc_sfrcondo (single family + condo), sfr (single family only)
- **Tier**: 0.33_0.67 (middle tier), bottom_tier, top_tier
- **Smoothing**: sm (smoothed), raw
- **SeasonalAdjustment**: sa (seasonally adjusted), nsa (not adjusted)
- **Frequency**: month, week

## Database Schema Alignment

### Our `markets` table maps to Zillow's structure:
- `region_id` = RegionID
- `region_name` = RegionName
- `region_type` = RegionType (with 'msa' for metros)
- `state_name` = StateName
- `size_rank` = SizeRank

### Our `market_time_series` table stores the date columns:
- `region_id` = RegionID (foreign key)
- `date` = Date column header
- `metric_name` = 'zhvi', 'zori', etc.
- `metric_value` = The value from that date column
- `data_source` = 'zillow'

## Import Process

1. **Download CSV** from Zillow Research Data
2. **Parse metadata columns** to identify/create market records
3. **Transform date columns** into time series records:
   - Each date column becomes a row in `market_time_series`
   - RegionID links to `markets` table
   - Metric name identifies what's being measured

## Example Data Point
```
RegionID: 394913
RegionName: "New York, NY"
RegionType: "msa"
StateName: "NY"
2024-10-31: 691859.495085681

Becomes:
- markets: {region_id: "394913", region_name: "New York, NY", ...}
- market_time_series: {
    region_id: "394913",
    date: "2024-10-31",
    metric_name: "zhvi",
    metric_value: 691859.50,
    data_source: "zillow"
  }
```
