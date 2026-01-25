# Reliable Rent Data for County and ZIP

We have **value** (home price) from Zillow (ZHVI) and Realtor (median listing price). Cap rate and yield metrics need **reliable rent** at county and ZIP. This doc lists available sources and the priority used in calculations.

## Available Rent Sources

| Source | County | ZIP | Update | Notes |
|--------|--------|-----|--------|--------|
| **Zillow ZORI** | `zillow_county` (metric_name='zori') | `zillow_zip` (metric_name='zori') | Monthly | Best currency; coverage can be sparse outside major markets. |
| **HUD FMR** | `hud_fmr.fmr_2br` | — | Annual (Oct) | **100% county coverage.** Fair Market Rent = 40th percentile monthly rent; same units as ZORI. |
| **Redfin Rental** | `redfin_rental_county.median_asking_rent` | `redfin_rental_zip.median_asking_rent` | Manual import | Median asking rent from listings; county and ZIP. |
| **Census ACS** | `census_county.median_gross_rent` | — | Annual | Median gross rent (incl. utilities); slower release. |

## Priority Order (Used for Cap Rate / Yield)

### County

1. **Zillow ZORI** – same period as ZHVI when both exist.
2. **HUD FMR** – when ZORI is missing for a county, use latest `hud_fmr.fmr_2br` (monthly $). Gives full US county coverage.
3. **Census median_gross_rent** – optional fallback if HUD FMR missing for a county.

### ZIP

1. **Zillow ZORI** – when available for that ZIP.
2. **Redfin median_asking_rent** – when Redfin rental data is imported for that ZIP.
3. **County inherited** – use parent county rent (ZORI or HUD FMR) with ZIP ZHVI for an *estimated* cap rate. (ZIP–county link from `zillow_zip.county_fips` or geography crosswalk.)

## Implementation

- **Calculated metrics** (`calculated_metrics.service.ts`):  
  County investment metrics use ZORI first; counties with ZHVI but no ZORI use HUD FMR so every county with ZHVI can get a cap rate.  
  ZIP investment metrics use ZORI first; ZIPs with ZHVI but no ZORI can use Redfin rent or county-inherited rent when we add that path.
- **Scoring**: PropertyIQ already documents HUD FMR as ZORI fallback; the same priority is used wherever rent is required (e.g. cap_rate, gross_yield).

## Value (Price) Sources (Reference)

- **Zillow ZHVI** – county: `zillow_county` (zhvi), zip: `zillow_zip` (zhvi).
- **Realtor** – median listing price at metro/county/zip from `realtor_*` tables (used for some metrics; cap rate map uses ZHVI for consistency with ZORI geography).
