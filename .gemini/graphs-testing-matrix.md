# Graph Page Testing Matrix

## Backend Deployment Status
- **Module Registered:** ✅ TimeSeriesModule added to app.module.ts
- **Code Pushed:** ✅ Pushed to main branch
-  **Railway Deployment:** 🟡 In progress (check Railway dashboard)

## Metric to Database Table Mapping

The frontend metric IDs map to these database sources:

### Zillow Metrics (zillow_metro, zillow_state, zillow_county, zillow_zip)
| Metric ID | metric_name in DB | Available Geographies |
|-----------|-------------------|----------------------|
| home_value | zhvi | State, Metro, County, Zip, City |
| home_price_forecast | zhvf_12m | Metro, Zip |
| rent_index | zori | Metro, County, Zip |
| for_sale_inventory | inventory | Metro |
| new_listings | new_listings | Metro |
| pending_listings | pending_listings | Metro |
| home_sales | sales_count | Metro |
| days_on_market | days_to_pending | Metro |
| sale_to_list | sale_to_list | Metro |
| market_heat | market_heat_index | Metro |
| price_cut_pct | price_cut_share | Metro |
| new_construction_sales | new_con_sales | Metro |
| new_construction_price | new_con_median_price | Metro |
| new_construction_ppsf | new_con_median_price_per_sqft | Metro |

### Realtor Metrics (realtor_national, realtor_metro, realtor_state, realtor_county, realtor_zip)
| Metric ID | metric_name in DB | Available Geographies |
|-----------|-------------------|----------------------|
| listing_price | median_listing_price | National, State, Metro, County, Zip |
| price_per_sqft | median_listing_price_per_square_foot | National, State, Metro, County, Zip |
| home_value_yoy | median_listing_price_yy | National, State, Metro, County, Zip |
| home_value_mom | median_listing_price_mm | National, State, Metro, County, Zip |
| inventory_yoy | active_listing_count_yy | National, State, Metro, County, Zip |
| new_listings_yoy | new_listing_count_yy | National, State, Metro, County, Zip |
| pending_ratio | pending_ratio | National, State, Metro, County, Zip |
| price_increase_pct | price_increased_share | National, State, Metro, County, Zip |

## Testing Combinations (Once Deployed)

### ✅ **Should Work - High Confidence**
1. **State + Listing Price** (Realtor)
   - Example API: `/api/timeseries/listing_price/state/Florida`
   - Data source: `realtor_state` table

2. **Metro + Home Value** (Zillow)
   - Example API: `/api/timeseries/home_value/metro/31080`
   - Data source: `zillow_metro` table (CBSA code 31080 = Miami-Fort Lauderdale)

3. **Metro + Listing Price** (Realtor)
   - Example API: `/api/timeseries/listing_price/metro/31080`
   - Data source: `realtor_metro` table

4. **State + Home Value** (Zillow)
   - Example API: `/api/timeseries/home_value/state/Florida`
   - Data source: `zillow_state` table

### ⚠️ **May Not Have Data**
1. **County + Any Metric** - Depends on if county data exists in your tables
2. **Zip + Any Metric** - Requires state filter, may have limited data
3. **City + Home Value** - Zillow city data may be sparse

### ❌ **Won't Work (Need Additional Mapping)**
These metrics are in the frontend dropdown but not yet mapped in the service:
- HomeReady Score
- InvestorEdge Score  
- Demographic metrics (population, median_income, etc.)
- Economic metrics (unemployment_rate, job_growth, etc.)

## How to Verify Deployment

1. **Check Railway Dashboard:**
   - Go to https://railway.app
   - Check deployment status for your backend service
   - Look for "Deployed" status with the latest commit

2. **Test API Directly:**
   ```bash
   curl https://backend-production-ee4d.up.railway.app/api/timeseries/listing_price/state/Florida?startDate=2020-01-01&endDate=2026-01-18
   ```
   Should return JSON with time-series data, not 4frontend04

3. **Test in Browser:**
   - Reload http://localhost:3000/graphs (or your Vercel URL)
   - Select: State + Florida + Listing Price
   - Should see chart populate with line graph

## Current Error Analysis

**404 Errors indicate:** The TimeSeriesModule is not yet loaded on Railway's deployed backend.

**To fix:**
- Wait for Railway deployment to complete (~2-5 minutes)
- If deployment fails, check Railway logs
- Verify build completed successfully
