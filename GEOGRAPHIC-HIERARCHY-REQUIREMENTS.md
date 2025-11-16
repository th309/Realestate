# Geographic Hierarchy Requirements

## Hierarchy Structure

The US geographic hierarchy is nested as follows:

```
National (US)
  └── State (e.g., CA, TX, NY)
      ├── Metro (e.g., Los Angeles Metro)
      │   ├── County (e.g., Los Angeles County)
      │   │   ├── City (e.g., Los Angeles)
      │   │   │   └── Zip Code (e.g., 90001)
      │   │   └── Zip Code (can belong directly to county)
      │   └── City (can belong directly to metro)
      │       └── Zip Code
      ├── County (not in metro)
      │   ├── City
      │   │   └── Zip Code
      │   └── Zip Code
      └── City (not in metro/county)
          └── Zip Code
```

## Key Requirements

1. **Data Ingestion**: Data is labeled as applying to ONE geographic level:
   - National
   - State
   - Metro
   - County
   - City
   - Zip Code

2. **Hierarchy Relationships**:
   - Zip codes belong to: cities (sometimes), counties, metros, states, national
   - Cities belong to: counties (usually), metros (sometimes), states, national
   - Metros belong to: counties (usually), states, national
   - Counties belong to: states, national
   - States belong to: national

3. **Many-to-Many Relationships**:
   - A zip code can span multiple counties
   - A city can span multiple counties
   - A metro can span multiple states
   - A zip code can belong to multiple cities

4. **Database Must Support**:
   - Query all children of a geographic entity (e.g., all zip codes in a state)
   - Query all parents of a geographic entity (e.g., what state/county/metro is this zip in)
   - Query data at a specific level (e.g., all metro-level data)
   - Query data with hierarchy context (e.g., metro data with its state)

## Current Problem

The `markets` table has:
- `state_code`, `metro_id`, `county_fips` - but these are flat, not hierarchical
- No way to query "all zip codes in California"
- No way to query "what metro is this zip code in"
- No proper hierarchy relationships

## Solution Needed

We need to:
1. Link `markets` records to the geographic hierarchy
2. Store parent-child relationships properly
3. Support queries up and down the hierarchy
4. Handle many-to-many relationships (zip codes in multiple counties)

