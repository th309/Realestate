# Complete Supabase Database Schema Summary

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

## Overview

This document provides a complete overview of the Supabase database schema.

## Tables with Data

The following tables contain data:

- **markets**: 70,059 rows
- **markets_tiger_mapping**: 70,058 rows  
- **tiger_zcta**: 33,791 rows

## Complete Schema Files

The complete detailed schema has been exported to:

1. **`scripts/schema-all-columns.txt`** - All columns for all tables
2. **`scripts/DATABASE-SCHEMA.md`** - Formatted markdown schema
3. **`scripts/complete-schema-*.txt`** - Complete schema with relationships

## Quick Access

To view the complete schema, run:

```powershell
# View all columns
Get-Content scripts/schema-all-columns.txt

# View formatted schema
Get-Content scripts/DATABASE-SCHEMA.md

# Query specific table structure
.\scripts\psql.ps1 "\d markets"
.\scripts\psql.ps1 "\d tiger_zcta"
```

## Key Tables

### Geographic Tables
- `markets` - Main geographic markets table (70,059 rows)
- `tiger_zcta` - ZIP Code Tabulation Areas (33,791 rows)
- `tiger_counties` - County boundaries
- `tiger_cbsa` - Core Based Statistical Areas
- `tiger_places` - Place boundaries
- `tiger_states` - State boundaries

### Junction Tables
- `geo_zip_county` - ZIP to County relationships
- `geo_zip_cbsa` - ZIP to CBSA relationships
- `geo_zip_place` - ZIP to Place relationships
- `geo_county_state` - County to State relationships
- `markets_hierarchy` - Market hierarchy relationships
- `markets_tiger_mapping` - Market to TIGER mapping (70,058 rows)

### Data Tables
- `census_demographics` - Census demographic data
- `census_economics` - Census economic data
- `census_housing` - Census housing data
- `fred_economic_data` - FRED economic indicators
- `redfin_metrics` - Redfin market metrics
- `zillow_metrics` - Zillow market metrics
- `market_signals` - Market signal data

### System Tables
- `admin_users` - Admin user accounts
- `organizations` - Organization management
- `subscriptions` - Subscription management
- `notifications` - Notification system
- `usage_tracking` - Usage tracking

## Schema Details

For complete column definitions, data types, constraints, and relationships, see the exported schema files listed above.

