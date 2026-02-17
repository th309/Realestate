"""
Comprehensive metric audit script.
Tests every metric in the registry across ALL geo levels.
Checks: API returns data, valueField matches response, keys are correct.
"""
import json
import subprocess
import sys

API = "http://localhost:3001"

# All metrics from registry.ts with their config
METRICS = {
    "home_value": {"endpoint": "/api/zillow/{geo}", "valueField": "value", "geos": ["state","metro","county","city","zip"]},
    "home_price_forecast": {"endpoint": "/api/zillow/forecast/{geo}", "valueField": "value", "geos": ["metro","zip"]},
    "home_value_yoy": {"endpoint": "/api/realtor/home-value-yoy/{geo}", "valueField": "value", "geos": ["state","metro","county","zip"]},
    "home_value_mom": {"endpoint": "/api/realtor/home-value-mom/{geo}", "valueField": "value", "geos": ["state","metro","county","zip"]},
    "home_value_5yr": {"endpoint": "/api/metrics/home-value-5yr/{geo}", "valueField": "cagr_5yr", "geos": ["national","state","metro","county","zip"]},
    "rent_index": {"endpoint": "/api/zillow/rent/{geo}", "valueField": "value", "geos": ["metro","county","zip"]},
    "rent_for_houses": {"endpoint": "/api/zillow/demand/{geo}", "valueField": "value", "geos": ["metro"]},
    "for_sale_inventory": {"endpoint": "/api/realtor/inventory/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "inventory_yoy": {"endpoint": "/api/realtor/inventory-yoy/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "new_listings": {"endpoint": "/api/realtor/new-listings/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "pending_listings": {"endpoint": "/api/realtor/pending-listings/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "home_sales": {"endpoint": "/api/realtor/home-sales/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "home_sales_yoy": {"endpoint": "/api/realtor/home-sales-yoy/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "pending_ratio": {"endpoint": "/api/realtor/pending-ratio/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "days_on_market": {"endpoint": "/api/realtor/dom/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "market_heat": {"endpoint": "/api/zillow/market-heat/{geo}", "valueField": "value", "geos": ["metro"]},
    "price_cut_pct": {"endpoint": "/api/realtor/price-reduced/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "sale_to_list": {"endpoint": "/api/zillow/sale-to-list/{geo}", "valueField": "value", "geos": ["metro"]},
    "years_to_save": {"endpoint": "/api/metrics/years-to-save/{geo}", "valueField": "years_to_save", "geos": ["national","state","metro","county","zip"]},
    "income_to_buy": {"endpoint": "/api/metrics/income-to-buy/{geo}", "valueField": "income_to_buy", "geos": ["national","state","metro","county","zip"]},
    "income_to_rent": {"endpoint": "/api/zillow/affordability/{geo}", "valueField": "renter_income_needed", "geos": ["metro"]},
    "affordable_home_price": {"endpoint": "/api/metrics/affordable-home-price/{geo}", "valueField": "affordable_home_price", "geos": ["national","state","metro","county","zip"]},
    "listing_price": {"endpoint": "/api/realtor/listing-price/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "price_per_sqft": {"endpoint": "/api/realtor/price-per-sqft/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "price_increase_pct": {"endpoint": "/api/realtor/price-increased/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "new_listings_yoy": {"endpoint": "/api/realtor/new-listings-yoy/{geo}", "valueField": "value", "geos": ["national","state","metro","county","zip"]},
    "hotness_score": {"endpoint": "/api/realtor/hotness/{geo}", "valueField": "value", "geos": ["metro","county","zip"]},
    "supply_score": {"endpoint": "/api/realtor/supply-score/{geo}", "valueField": "value", "geos": ["metro","county","zip"]},
    "demand_score": {"endpoint": "/api/realtor/demand-score/{geo}", "valueField": "value", "geos": ["metro","county","zip"]},
    "cap_rate": {"endpoint": "/api/metrics/cap-rate/{geo}", "valueField": "cap_rate", "geos": ["metro","county","zip"]},
    "gross_yield": {"endpoint": "/api/metrics/gross-yield/{geo}", "valueField": "gross_yield", "geos": ["metro","county","zip"]},
    "grm": {"endpoint": "/api/metrics/grm/{geo}", "valueField": "grm", "geos": ["metro","county","zip"]},
    "rent_to_price_ratio": {"endpoint": "/api/metrics/rent-to-price/{geo}", "valueField": "rent_to_price_ratio", "geos": ["metro","county","zip"]},
    "overvalued_pct": {"endpoint": "/api/metrics/overvalued/{geo}", "valueField": "overvalued_pct", "geos": ["metro"]},
    "inventory_surplus": {"endpoint": "/api/metrics/inventory-surplus/{geo}", "valueField": "inventory_surplus", "geos": ["national","state","metro","county","zip"]},
    "new_construction_sales": {"endpoint": "/api/zillow/new-construction/{geo}", "valueField": "sales_count", "geos": ["metro"]},
    "new_construction_price": {"endpoint": "/api/zillow/new-construction/{geo}", "valueField": "median_sale_price", "geos": ["metro"]},
    "new_construction_ppsf": {"endpoint": "/api/zillow/new-construction/{geo}", "valueField": "price_per_sqft", "geos": ["metro"]},
    "sf_permits": {"endpoint": "/api/permits/{geo}", "valueField": "sf_units", "geos": ["national","state","county"]},
    "mf_permits": {"endpoint": "/api/permits/{geo}", "valueField": "large_multi_units", "geos": ["national","state","county"]},
    "total_permits": {"endpoint": "/api/permits/{geo}", "valueField": "total_units", "geos": ["national","state","county"]},
    "permits_yoy": {"endpoint": "/api/permits/{geo}", "valueField": "total_units_yoy", "geos": ["national","state","county"]},
    "sf_mf_ratio": {"endpoint": "/api/permits/sf-ratio/{geo}", "valueField": "sf_ratio", "geos": ["national","state","county"]},
    "permit_value_per_unit": {"endpoint": "/api/permits/value-per-unit/{geo}", "valueField": "value_per_unit", "geos": ["national","state","county"]},
    "population": {"endpoint": "/api/census/population/{geo}", "valueField": "value", "geos": ["national","state","metro","county","city","zip"]},
    "population_growth": {"endpoint": "/api/census/population-growth/{geo}", "valueField": "value", "geos": ["national","state","metro","county","city","zip"]},
    "median_income": {"endpoint": "/api/census/median-income/{geo}", "valueField": "value", "geos": ["national","state","metro","county","city","zip"]},
    "income_growth": {"endpoint": "/api/census/income-growth/{geo}", "valueField": "value", "geos": ["national","state","metro","county","city","zip"]},
    "median_age": {"endpoint": "/api/census/median-age/{geo}", "valueField": "value", "geos": ["national","state","metro","county","city","zip"]},
    "homeownership_rate": {"endpoint": "/api/census/homeownership-rate/{geo}", "valueField": "value", "geos": ["national","state","metro","county","city","zip"]},
    "unemployment_rate": {"endpoint": "/api/economic/unemployment/{geo}", "valueField": "value", "geos": ["national","state","metro","county"]},
    "job_growth": {"endpoint": "/api/economic/job-growth/{geo}", "valueField": "value", "geos": ["national","state","metro","county"]},
    "gdp_growth": {"endpoint": "/api/economic/gdp-growth/{geo}", "valueField": "value", "geos": ["national","state","metro","county"]},
    "cost_of_living": {"endpoint": "/api/economic/cost-of-living/{geo}", "valueField": "value", "geos": ["state","metro"]},
}

GEO_PATHS = {
    "national": "national",
    "state": "states",
    "metro": "metros",
    "county": "counties",
    "city": "cities",
    "zip": "zips",
}

# Test all geo levels used on Markets page
TEST_GEOS = ["national", "state", "metro", "county", "zip"]
TEST_STATE = "TX"

issues = []
ok_count = 0
skip_count = 0

for metric_id, config in METRICS.items():
    for geo in TEST_GEOS:
        if geo not in config["geos"]:
            skip_count += 1
            continue

        geo_path = GEO_PATHS[geo]
        url = config["endpoint"].replace("{geo}", geo_path)
        # Add state filter for county/zip
        if geo in ("county", "zip"):
            url += "?state=" + TEST_STATE

        full_url = API + url
        try:
            result = subprocess.run(
                ["curl", "-s", "-m", "15", full_url],
                capture_output=True, text=True, timeout=20
            )

            if result.returncode != 0:
                issues.append("CURL_ERR  %-30s %-8s curl failed" % (metric_id, geo))
                continue

            data = json.loads(result.stdout)

            # Handle different response formats
            if isinstance(data, dict) and "data" in data:
                items = data["data"]
            elif isinstance(data, list):
                items = data
            elif isinstance(data, dict) and "statusCode" in data:
                issues.append("HTTP_%-4s %-30s %-8s %s" % (data["statusCode"], metric_id, geo, url))
                continue
            else:
                items = [data] if data else []

            if not isinstance(items, list):
                issues.append("BAD_FMT   %-30s %-8s response not array" % (metric_id, geo))
                continue

            total = len(items)
            if total == 0:
                issues.append("NO_DATA   %-30s %-8s 0 records returned" % (metric_id, geo))
                continue

            # Check valueField exists in response
            vf = config["valueField"]
            has_field = sum(1 for x in items if vf in x)
            if has_field == 0:
                available = list(items[0].keys()) if items else []
                issues.append("NO_FIELD  %-30s %-8s '%s' not in response. Available: %s" % (metric_id, geo, vf, available[:8]))
                continue

            # Check non-null values
            non_null = sum(1 for x in items if x.get(vf) is not None)
            pct = (non_null / total * 100) if total > 0 else 0

            if non_null == 0:
                issues.append("ALL_NULL  %-30s %-8s 0/%d non-null for '%s'" % (metric_id, geo, total, vf))
            elif pct < 50:
                issues.append("LOW_DATA  %-30s %-8s %d/%d (%d%%) for '%s'" % (metric_id, geo, non_null, total, pct, vf))
            else:
                ok_count += 1
                # Print OK with coverage for visibility
                sys.stdout.write(".")
                sys.stdout.flush()

        except subprocess.TimeoutExpired:
            issues.append("TIMEOUT   %-30s %-8s %s" % (metric_id, geo, url))
        except json.JSONDecodeError:
            issues.append("BAD_JSON  %-30s %-8s %s" % (metric_id, geo, url))
        except Exception as e:
            issues.append("ERROR     %-30s %-8s %s" % (metric_id, geo, str(e)))

print("\n")
print("=" * 80)
print("COMPREHENSIVE METRIC AUDIT (national/state/metro/county/zip)")
print("=" * 80)
print("OK: %d | Issues: %d | Skipped (unsupported geo): %d" % (ok_count, len(issues), skip_count))
print("=" * 80)

if issues:
    print("\nISSUES FOUND:")
    for issue in sorted(issues):
        print("  " + issue)
else:
    print("\nNo issues found!")
