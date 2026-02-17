"""
Multi-state metric audit.
Tests county/zip level metrics across multiple states to catch state-specific data gaps.
"""
import json
import subprocess
import sys

API = "http://localhost:3001"

# Metrics that need state filter (county/zip level)
COUNTY_ZIP_METRICS = {
    "home_value": {"endpoint": "/api/zillow/{geo}", "valueField": "value"},
    "home_value_yoy": {"endpoint": "/api/realtor/home-value-yoy/{geo}", "valueField": "value"},
    "home_value_mom": {"endpoint": "/api/realtor/home-value-mom/{geo}", "valueField": "value"},
    "home_value_5yr": {"endpoint": "/api/metrics/home-value-5yr/{geo}", "valueField": "cagr_5yr"},
    "rent_index": {"endpoint": "/api/zillow/rent/{geo}", "valueField": "value"},
    "for_sale_inventory": {"endpoint": "/api/realtor/inventory/{geo}", "valueField": "value"},
    "inventory_yoy": {"endpoint": "/api/realtor/inventory-yoy/{geo}", "valueField": "value"},
    "new_listings": {"endpoint": "/api/realtor/new-listings/{geo}", "valueField": "value"},
    "pending_listings": {"endpoint": "/api/realtor/pending-listings/{geo}", "valueField": "value"},
    "home_sales": {"endpoint": "/api/realtor/home-sales/{geo}", "valueField": "value"},
    "home_sales_yoy": {"endpoint": "/api/realtor/home-sales-yoy/{geo}", "valueField": "value"},
    "pending_ratio": {"endpoint": "/api/realtor/pending-ratio/{geo}", "valueField": "value"},
    "days_on_market": {"endpoint": "/api/realtor/dom/{geo}", "valueField": "value"},
    "price_cut_pct": {"endpoint": "/api/realtor/price-reduced/{geo}", "valueField": "value"},
    "listing_price": {"endpoint": "/api/realtor/listing-price/{geo}", "valueField": "value"},
    "price_per_sqft": {"endpoint": "/api/realtor/price-per-sqft/{geo}", "valueField": "value"},
    "price_increase_pct": {"endpoint": "/api/realtor/price-increased/{geo}", "valueField": "value"},
    "new_listings_yoy": {"endpoint": "/api/realtor/new-listings-yoy/{geo}", "valueField": "value"},
    "years_to_save": {"endpoint": "/api/metrics/years-to-save/{geo}", "valueField": "years_to_save"},
    "income_to_buy": {"endpoint": "/api/metrics/income-to-buy/{geo}", "valueField": "income_to_buy"},
    "affordable_home_price": {"endpoint": "/api/metrics/affordable-home-price/{geo}", "valueField": "affordable_home_price"},
    "inventory_surplus": {"endpoint": "/api/metrics/inventory-surplus/{geo}", "valueField": "inventory_surplus"},
    "hotness_score": {"endpoint": "/api/realtor/hotness/{geo}", "valueField": "value"},
    "supply_score": {"endpoint": "/api/realtor/supply-score/{geo}", "valueField": "value"},
    "demand_score": {"endpoint": "/api/realtor/demand-score/{geo}", "valueField": "value"},
    "cap_rate": {"endpoint": "/api/metrics/cap-rate/{geo}", "valueField": "cap_rate"},
    "gross_yield": {"endpoint": "/api/metrics/gross-yield/{geo}", "valueField": "gross_yield"},
    "grm": {"endpoint": "/api/metrics/grm/{geo}", "valueField": "grm"},
    "rent_to_price_ratio": {"endpoint": "/api/metrics/rent-to-price/{geo}", "valueField": "rent_to_price_ratio"},
    "population": {"endpoint": "/api/census/population/{geo}", "valueField": "value"},
    "population_growth": {"endpoint": "/api/census/population-growth/{geo}", "valueField": "value"},
    "median_income": {"endpoint": "/api/census/median-income/{geo}", "valueField": "value"},
    "income_growth": {"endpoint": "/api/census/income-growth/{geo}", "valueField": "value"},
    "median_age": {"endpoint": "/api/census/median-age/{geo}", "valueField": "value"},
    "homeownership_rate": {"endpoint": "/api/census/homeownership-rate/{geo}", "valueField": "value"},
    "unemployment_rate": {"endpoint": "/api/economic/unemployment/{geo}", "valueField": "value"},
    "job_growth": {"endpoint": "/api/economic/job-growth/{geo}", "valueField": "value"},
    "gdp_growth": {"endpoint": "/api/economic/gdp-growth/{geo}", "valueField": "value"},
}

# Permit metrics (county only)
PERMIT_METRICS = {
    "sf_permits": {"endpoint": "/api/permits/{geo}", "valueField": "sf_units"},
    "mf_permits": {"endpoint": "/api/permits/{geo}", "valueField": "large_multi_units"},
    "total_permits": {"endpoint": "/api/permits/{geo}", "valueField": "total_units"},
    "permits_yoy": {"endpoint": "/api/permits/{geo}", "valueField": "total_units_yoy"},
    "sf_mf_ratio": {"endpoint": "/api/permits/sf-ratio/{geo}", "valueField": "sf_ratio"},
    "permit_value_per_unit": {"endpoint": "/api/permits/value-per-unit/{geo}", "valueField": "value_per_unit"},
}

# Zip-only metrics (subset that support zip)
ZIP_UNSUPPORTED = {"unemployment_rate", "job_growth", "gdp_growth"}

# Test across diverse states
STATES = ["TX", "CA", "FL", "NY", "OH", "WA", "IL", "CO", "GA", "NC"]

issues = []
ok_count = 0

def test_endpoint(metric_id, geo, state, config):
    geo_path = "counties" if geo == "county" else "zips"
    url = config["endpoint"].replace("{geo}", geo_path) + "?state=" + state
    full_url = API + url

    try:
        result = subprocess.run(
            ["curl", "-s", "-m", "15", full_url],
            capture_output=True, text=True, timeout=20
        )
        if result.returncode != 0:
            return "CURL_ERR"

        data = json.loads(result.stdout)
        if isinstance(data, dict) and "data" in data:
            items = data["data"]
        elif isinstance(data, list):
            items = data
        elif isinstance(data, dict) and "statusCode" in data:
            return "HTTP_%s" % data["statusCode"]
        else:
            items = [data] if data else []

        if not isinstance(items, list):
            return "BAD_FMT"
        if len(items) == 0:
            return "NO_DATA"

        vf = config["valueField"]
        has_field = sum(1 for x in items if vf in x)
        if has_field == 0:
            return "NO_FIELD(%s)" % vf

        non_null = sum(1 for x in items if x.get(vf) is not None)
        pct = (non_null / len(items) * 100) if len(items) > 0 else 0
        if non_null == 0:
            return "ALL_NULL(%d)" % len(items)
        if pct < 50:
            return "LOW(%d/%d)" % (non_null, len(items))
        return "OK(%d/%d)" % (non_null, len(items))

    except subprocess.TimeoutExpired:
        return "TIMEOUT"
    except json.JSONDecodeError:
        return "BAD_JSON"
    except Exception as e:
        return "ERROR(%s)" % str(e)[:30]


# Test county level for 5 representative metrics across all states
print("MULTI-STATE COUNTY AUDIT")
print("=" * 80)
print("Testing %d metrics x %d states at county level..." % (len(COUNTY_ZIP_METRICS), len(STATES)))

county_issues = []
county_ok = 0
for state in STATES:
    sys.stdout.write("\n  %s: " % state)
    for metric_id, config in COUNTY_ZIP_METRICS.items():
        result = test_endpoint(metric_id, "county", state, config)
        if result.startswith("OK"):
            county_ok += 1
            sys.stdout.write(".")
        else:
            county_issues.append("%-30s county  %-4s %s" % (metric_id, state, result))
            sys.stdout.write("X")
        sys.stdout.flush()

# Test permit metrics at county level
for state in STATES:
    for metric_id, config in PERMIT_METRICS.items():
        result = test_endpoint(metric_id, "county", state, config)
        if result.startswith("OK"):
            county_ok += 1
        else:
            county_issues.append("%-30s county  %-4s %s" % (metric_id, state, result))

print("\n\nCounty: OK=%d Issues=%d" % (county_ok, len(county_issues)))

# Test zip level for key metrics across states
print("\n\nMULTI-STATE ZIP AUDIT")
print("=" * 80)
zip_metrics = {k: v for k, v in COUNTY_ZIP_METRICS.items() if k not in ZIP_UNSUPPORTED}
print("Testing %d metrics x %d states at zip level..." % (len(zip_metrics), len(STATES)))

zip_issues = []
zip_ok = 0
for state in STATES:
    sys.stdout.write("\n  %s: " % state)
    for metric_id, config in zip_metrics.items():
        result = test_endpoint(metric_id, "zip", state, config)
        if result.startswith("OK"):
            zip_ok += 1
            sys.stdout.write(".")
        else:
            zip_issues.append("%-30s zip     %-4s %s" % (metric_id, state, result))
            sys.stdout.write("X")
        sys.stdout.flush()

print("\n\nZip: OK=%d Issues=%d" % (zip_ok, len(zip_issues)))

# Summary
print("\n" + "=" * 80)
print("COMBINED RESULTS")
print("=" * 80)
all_issues = county_issues + zip_issues
total_ok = county_ok + zip_ok
print("Total OK: %d | Total Issues: %d" % (total_ok, len(all_issues)))

if all_issues:
    print("\nISSUES:")
    for issue in sorted(all_issues):
        print("  " + issue)
else:
    print("\nNo issues found across all states!")
