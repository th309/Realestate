# Automated Hierarchy Builder

## Overview

The system automatically builds geographic hierarchy relationships for tens of thousands of markets using:
1. **TIGER Junction Tables** (primary method - fast and accurate)
2. **Spatial Queries** (fallback method - for markets without TIGER GEOIDs)

## How It Works

### Step 1: Link Markets to TIGER Entities

The `link_markets_to_tiger()` function automatically links markets to TIGER boundaries by:
- Matching GEOIDs in `external_ids` JSONB
- Matching `geoid` field
- Matching `state_code`, `county_fips` fields
- Name matching (for cities)

### Step 2: Build Hierarchy from TIGER Relationships

The `build_markets_hierarchy_from_tiger()` function uses existing TIGER junction tables:
- `geo_zip_county` → Creates zip → county relationships
- `geo_zip_place` → Creates zip → city relationships
- `geo_zip_cbsa` → Creates zip → metro relationships
- `geo_place_county` → Creates city → county relationships
- `geo_county_cbsa` → Creates county → metro relationships
- `geo_county_state` → Creates county → state relationships

Then it infers transitive relationships:
- Metro → State (via counties)
- City → Metro (via counties)
- State → National

### Step 3: Spatial Fallback

The `build_markets_hierarchy_spatial()` function uses PostGIS spatial queries for markets without TIGER links.

## Usage

### Build Complete Hierarchy

```sql
-- This runs both TIGER and spatial methods
SELECT * FROM build_markets_hierarchy_complete();
```

### Build from TIGER Only (Recommended)

```sql
-- Fast, uses existing TIGER relationships
SELECT * FROM build_markets_hierarchy_from_tiger();
```

### Build from Spatial Only

```sql
-- Slower, for markets without TIGER links
SELECT build_markets_hierarchy_spatial();
```

### Link Markets to TIGER (First Step)

```sql
-- Link markets to TIGER entities before building hierarchy
SELECT link_markets_to_tiger();
```

## When to Run

1. **After importing new markets** - Run to link them to TIGER and build hierarchy
2. **After bulk data import** - Run to establish all relationships
3. **Periodically** - To catch any new relationships or updates

## Performance

- **TIGER method**: Fast (uses pre-calculated relationships)
- **Spatial method**: Slower (calculates overlaps on-the-fly)
- **Combined**: Processes tens of thousands of records in minutes

## Example: Complete Workflow

```sql
-- 1. Import markets (via Zillow, Redfin, Census importers)

-- 2. Link markets to TIGER entities
SELECT link_markets_to_tiger();

-- 3. Build hierarchy relationships
SELECT * FROM build_markets_hierarchy_complete();

-- 4. Verify hierarchy
SELECT 
    m.region_name,
    m.region_type,
    COUNT(mh.market_region_id) as child_count
FROM markets m
LEFT JOIN markets_hierarchy mh ON m.region_id = mh.parent_market_region_id
GROUP BY m.region_id, m.region_name, m.region_type
ORDER BY m.region_type, m.region_name
LIMIT 20;
```

## Hierarchy Levels

- **Level 1**: State → National
- **Level 2**: Metro/County → State
- **Level 3**: City → County/Metro
- **Level 4**: Zip → City/County/Metro

## Many-to-Many Support

The system handles:
- Zip codes in multiple counties (with overlap percentages)
- Cities spanning multiple counties
- Metros spanning multiple states
- All relationships stored with `is_primary` flag and `overlap_percentage`

