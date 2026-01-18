# Map Card to Time-Series API Mapping

## How It Works

**Map Card (Latest Value Only):**
```typescript
// Queries: realtor_state table
// Filter: .eq('period_date', latestDate) 
// Returns: SINGLE row with latest_period_date value
await this.supabase
  .from('realtor_state')
  .select('*')
  .eq('period_date', latestDate)
  .limit(1);
```

**Time-Series API (All Historical Data):**
```typescript
// Queries: SAME TABLE (realtor_state)
// Filter: .gte('period_date', startDate).lte('period_date', endDate)
// Returns: ALL rows between start/end dates  
await this.supabase
  .from('realtor_state')
  .select('period_date, median_listing_price')
  .gte('period_date', startDate)  
  .lte('period_date', endDate)
  .order('period_date', { ascending: true });
```

## Metric to Table & Column Mapping

Based on `useMapData.ts` and `realtor.service.ts`:

| Frontend Metric ID | Map Page Uses | Table | Column Name | Geographies |
|--------------------|---------------|-------|-------------|-------------|
| **Realtor Metrics** |
| listing_price | `api.getRealtorStateHomeValues()` | realtor_state,realtor_metro | median_listing_price | National,State,Metro,County,Zip |
| home_value_yoy | `api.getRealtorStateHomeValueYoy()` | realtor_state,realtor_metro | median_listing_price_yy | National,State,Metro,County,Zip |
| home_value_mom | `api.getRealtorStateHomeValueMom()` | realtor_state,realtor_metro | median_listing_price_mm | National,State,Metro,County,Zip |
| for_sale_inventory | `api.getRealtorStateInventory()` | realtor_state,realtor_metro | active_listing_count | National,State,Metro,County,Zip |
| inventory_yoy | `api.getRealtorStateInventoryYoy()` | realtor_state,realtor_metro | active_listing_count_yy | National,State,Metro,County,Zip |
| days_on_market | `api.getRealtorStateDom()` | realtor_state,realtor_metro | median_days_on_market | National,State,Metro,County,Zip |
| new_listings | `api.getRealtorStateNewListings()` | realtor_state,realtor_metro | new_listing_count | National,State,Metro,County,Zip |
| pending_listings | `api.getRealtorStatePendingListings()` | realtor_state,real tor_metro | pending_listing_count | National,State,Metro,County,Zip |
| price_cut_pct | `api.getRealtorStatePriceReduced()` | realtor_state,realtor_metro | price_reduced_share | National,State,Metro,County,Zip |
| price_per_sqft | `api.getRealtorStatePricePerSqft()` | realtor_state,realtor_metro | median_listing_price_per_square_foot | National,State,Metro,County,Zip |
| pending_ratio | `api.getRealtorStatePendingRatio()` | realtor_state,realtor_metro | pending_ratio | National,State,Metro,County,Zip |
| hotness_score | `api.getRealtorMetroHotness()` | realtor_metro,realtor_county,realtor_zip | hotness_score | Metro,County,Zip |
| supply_score | `api.getRealtorMetroSupplyScore()` | realtor_metro,realtor_county,realtor_zip | supply_score | Metro,County,Zip |
| demand_score | `api.getRealtorMetroDemandScore()` | realtor_metro,realtor_county,realtor_zip | demand_score | Metro,County,Zip |
| price_increase_pct | `api.getStatePriceIncreased()` | realtor_state,realtor_metro | price_increased_share | National,State,Metro,County,Zip |
| new_listings_yoy | `api.getStateNewListingsYoy()` | realtor_state,realtor_metro | new_listing_count_yy | National,State,Metro,County,Zip |
| **Zillow Metrics** |
| home_value | `api.getStateHomeValues()` (from Zillow) | zillow_state,zillow_metro | value WHERE metric_name='zhvi' | State,Metro,County,Zip,City |
| rent_index | `api.getMetroRent()` | zillow_metro,zillow_county,zillow_zip | value WHERE metric_name='zori' | Metro,County,Zip |
| rent_for_houses | `api.getMetroRenterDemand()` | zillow_metro,zillow_zip | value WHERE metric_name='zordi_sfr' | Metro,Zip |
| home_price_forecast | `api.getMetroForecast()` | zillow_metro,zillow_zip | value WHERE metric_name='zhvf_12m' | Metro,Zip |
| income_to_buy | `api.getMetroIncomeToBuy()` | zillow_metro | homeowner_income_needed | Metro only |
| income_to_rent | `api.getMetroIncomeToRent()` | zillow_metro | renter_income_needed | Metro only |
| sale_price | `api.getMetroSalePrice()` | zillow_metro | value WHERE metric_name='sale_price' | Metro only |
| sale_to_list | `api.getMetroSaleToList()` | zillow_metro | value WHERE metric_name='sale_to_list' | Metro only |
| market_heat | `api.getMetroMarketHeat()` | zillow_metro | value WHERE metric_name='market_heat_index' | Metro only|
| new_construction_sales | `api.getMetroNewConstructionSales()` | zillow_metro | value WHERE metric_name='new_con_sales' | Metro only |
| new_construction_price | `api.getMetroNewConstructionPrice()` | zillow_metro | value WHERE metric_name='new_con_median_price' | Metro only |

## Region ID Filtering By Geography

| Geography | Table | Filter Field | Example Value |
|-----------|-------|--------------|---------------|
| National | realtor_national, zillow_national | region_name | 'United States' |
| State | realtor_state, zillow_state | state_id | 'FL' (abbrev) OR region_name='Florida' |
| Metro | realtor_metro, zillow_metro | cbsa_code | '31080' (Miami) |
| County | realtor_county, zillow_county | county_fips | '12086' (Miami-Dade) |
| Zip | realtor_zip, zillow_zip | postal_code | '33101' |
| City | zillow_city | region_name | 'Miami' |

## Next Step

Rewrite `TimeSeriesService.getMetricMapping()` to return the EXACT table and column names used by the map page services, so the time-series API queries the same data.
