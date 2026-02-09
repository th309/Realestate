# PropertyIQ Data Inventory

**Date:** 2026-02-09 (Week 1, Day 2)
**Database:** Supabase (PostgreSQL 17.6)
**Project:** pysflbhpnqwoczyuaaif

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tables | 100+ |
| Tables with Data | ~50 |
| Empty Tables | ~70 |
| Total Rows (top 50) | ~45M+ |

---

## 1. Core Data Tables (Well Populated)

### Zillow Data
| Table | Row Count | Latest Date | Status |
|-------|-----------|-------------|--------|
| `zillow_zip` | 6,744,945 | 2026-12-31 | OK (includes forecast) |
| `zillow_city` | 4,990,803 | - | OK |
| `zillow_metro` | 1,823,055 | 2026-12-31 | OK |
| `zillow_county` | 769,699 | 2025-12-31 | OK |
| `zillow_state` | 15,684 | 2025-12-31 | OK |

### Realtor Data
| Table | Row Count | Latest Date | Status |
|-------|-----------|-------------|--------|
| `realtor_zip` | 3,221,681 | - | OK |
| `realtor_county` | 353,831 | 2025-12-01 | OK |
| `realtor_metro` | 105,450 | 2025-12-01 | OK |
| `realtor_state` | 5,814 | - | OK |
| `realtor_national` | 114 | - | OK |

### Economic Data
| Table | Row Count | Latest Date | Status |
|-------|-----------|-------------|--------|
| `economic_county` | 961,420 | 2025-11-01 | STALE |
| `economic_metro` | 58,698 | - | OK |
| `economic_state` | 16,043 | - | OK |
| `economic_national` | 312 | - | OK |

### Census Data
| Table | Row Count | Status |
|-------|-----------|--------|
| `census_data` | 947,606 | OK |
| `census_zip` | 432,520 | OK |
| `census_county` | 43,998 | OK |
| `census_city` | 168,434 | OK |
| `census_metro` | 13,177 | OK |
| `census_state` | 728 | OK |
| `census_demographics` | 176,705 | OK |
| `census_housing` | 176,435 | OK |
| `census_economics` | 176,435 | OK |

### PropertyIQ Scores
| Table | Row Count | Latest Date | Status |
|-------|-----------|-------------|--------|
| `propertyiq_scores` | 2,396,556 | 2025-12-01 | OK |
| `propertyiq_scores_history` | 3,624,070 | - | OK |
| `calculated_metrics` | 3,339,289 | - | OK |

### Geographic Coverage (PropertyIQ Scores)
| Geography | Unique Locations | Total Scores |
|-----------|------------------|--------------|
| Zip | 32,775 | 1,675,893 |
| County | 3,139 | 556,245 |
| Metro | 925 | 169,275 |

### Other Key Tables
| Table | Row Count | Purpose |
|-------|-----------|---------|
| `market_time_series` | 12,573,819 | Historical time series |
| `markets` | 142,450 | Market definitions |
| `geographies` | 43,721 | Geographic entities |
| `geographic_units` | 35,739 | Geography mapping |
| `hud_fmr` | 3,228 | Fair market rents |
| `permits_county` | 201,360 | Building permits |
| `permits_state` | 6,461 | State permits |

---

## 2. Empty Tables (Need Data or Unused)

### User/Subscription Tables (Expected Empty - No Users Yet)
- `admin_users` - 0 rows
- `user_profiles` - 1 row
- `subscriptions` - 0 rows
- `subscriber_profiles` - 0 rows
- `organizations` - 0 rows
- `organization_members` - 0 rows

### Analytics/Tracking (Expected Empty - No Usage Yet)
- `analytics_conversations` - 0 rows
- `analytics_alerts` - 0 rows
- `analytics_watchlist` - 0 rows
- `paywall_events` - 0 rows
- `usage_tracking` - 0 rows
- `ui_sessions` - 0 rows

### Backtesting (Need Population)
- `backtest_peer_benchmarks` - 0 rows
- `backtest_peer_groups` - 0 rows
- `backtest_regional_benchmarks` - 0 rows
- `propertyiq_backtest_runs` - 0 rows
- `propertyiq_backtest_samples` - 0 rows

### Reports (Need Setup)
- `report_conversations` - 0 rows
- `report_folders` - 0 rows
- `report_news_cache` - 0 rows
- `saved_insights` - 0 rows
- `news_cache` - 0 rows

### Geographic (Missing Data)
- `permits_metro` - 0 rows (BLOCKING - need permits at metro level)
- `tiger_places` - 0 rows
- `tiger_urban_areas` - 0 rows
- `tiger_csa` - 0 rows

---

## 3. Configuration Tables

| Table | Row Count | Status |
|-------|-----------|--------|
| `subscription_tiers` | 4 | OK |
| `tier_features` | 169 | OK |
| `feature_definitions` | 51 | OK |
| `metric_definitions` | 32 | OK |
| `report_templates` | 5 | OK |
| `formula_versions` | 9 | OK |
| `trial_config` | 1 | OK |
| `backtest_benchmarks` | 1,299 | OK |

---

## 4. Data Freshness Analysis

### Current vs Expected
| Source | Latest Data | Expected | Gap | Status |
|--------|-------------|----------|-----|--------|
| Zillow | Dec 2026 | Monthly | None | OK |
| Realtor | Dec 2025 | Monthly | 40 days | STALE |
| Economic | Nov 2025 | Monthly | 71 days | STALE |
| Census | 2024 | Annual | OK | OK |
| PropertyIQ Scores | Dec 2025 | Monthly | 40 days | STALE |

### Actions Required
1. **Run Realtor pipeline** - Update to Jan/Feb 2026 data
2. **Run Economic pipeline** - Update BLS/FRED data
3. **Recalculate PropertyIQ scores** - After data refresh

---

## 5. Geographic Coverage Analysis

### Zillow Coverage by Geography
| Level | Has Data | Expected | Coverage |
|-------|----------|----------|----------|
| Metro | Yes (881+) | ~930 | 95%+ |
| County | Yes (3,073+) | ~3,143 | 98% |
| Zip | Yes* | ~33,000 | API shows 0** |
| State | Yes (51) | 51 | 100% |
| City | Yes* | ~30,000 | API shows 0** |

*Data exists in database but API returns empty
**BLOCKING: Need to investigate why zip/city APIs return 0 rows

### PropertyIQ Score Coverage
| Level | Locations | Status |
|-------|-----------|--------|
| Metro | 925 | Excellent |
| County | 3,139 | Excellent |
| Zip | 32,775 | Excellent |

---

## 6. Blocking Issues

### Critical (Must Fix Before Launch)
1. **Zip-level API returns 0 rows** - Data exists (6.7M rows) but `/api/zillow/zips` returns empty
2. **City-level API returns 0 rows** - Data exists (5.0M rows) but `/api/zillow/cities` returns empty
3. **permits_metro is empty** - Need metro-level building permit data

### High Priority
1. Data staleness across Realtor, Economic sources
2. PropertyIQ scores need recalculation after data refresh

### Medium Priority
1. Backtest tables need population for score validation
2. Report/news cache tables empty

---

## 7. Database Health

### Storage
- Primary tables are well-indexed
- Time series data is partitioned appropriately

### Recommendations
1. Add composite indexes on frequently queried columns
2. Consider partitioning `zillow_zip` by state for faster queries
3. Archive old `propertyiq_scores_history` data if needed

---

## Verification Queries

```sql
-- Check total row counts
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC LIMIT 20;

-- Check geographic coverage for scores
SELECT geography, COUNT(DISTINCT location_id)
FROM propertyiq_scores
GROUP BY geography;

-- Check latest dates
SELECT 'zillow_metro', MAX(period_date) FROM zillow_metro;
```
