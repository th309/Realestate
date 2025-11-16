# Geographic Hierarchy Database Design

## Problem

The current `markets` table doesn't properly represent the nested geographic hierarchy:
- National → State → Metro/County → City → Zip Code
- Many-to-many relationships (zip codes in multiple counties, metros in multiple states)
- Need to query up and down the hierarchy

## Solution: Three-Tier System

### Tier 1: Markets Table (Data Ingestion)
- Stores market data from Zillow, Redfin, Census, FRED
- Each record has a `region_type` (national, state, metro, county, city, zip)
- Links to hierarchy via `geoid` or `external_ids`

### Tier 2: TIGER Tables (Official Boundaries)
- `tiger_states`, `tiger_counties`, `tiger_cbsa`, `tiger_places`, `tiger_zcta`
- Source of truth for official Census boundaries
- Used for spatial queries

### Tier 3: Hierarchy Relationships (Many-to-Many)
- Junction tables for relationships
- `geo_hierarchy` table for fast lookups
- Links markets to TIGER entities

## Database Schema

### 1. Markets Table (Enhanced)
```sql
CREATE TABLE markets (
    region_id VARCHAR(50) PRIMARY KEY,
    region_name VARCHAR(255) NOT NULL,
    region_type VARCHAR(50) NOT NULL, -- 'national', 'state', 'metro', 'county', 'city', 'zip'
    
    -- Link to TIGER hierarchy via GEOID
    geoid VARCHAR(20), -- Links to TIGER tables
    
    -- External IDs (Zillow, Redfin, Census, etc.)
    external_ids JSONB DEFAULT '{}',
    
    -- Geographic data
    geometry GEOMETRY(MultiPolygon, 4326),
    bounds JSONB,
    
    -- Metadata
    population BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Markets Hierarchy Table (NEW - Links markets to hierarchy)
```sql
CREATE TABLE markets_hierarchy (
    market_region_id VARCHAR(50) REFERENCES markets(region_id),
    parent_market_region_id VARCHAR(50) REFERENCES markets(region_id),
    relationship_type VARCHAR(20), -- 'contains', 'belongs_to'
    hierarchy_level INTEGER, -- 1=state, 2=metro/county, 3=city, 4=zip
    is_primary BOOLEAN DEFAULT false, -- True for primary relationship
    overlap_percentage DECIMAL(5,2), -- For partial overlaps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (market_region_id, parent_market_region_id)
);

-- Indexes
CREATE INDEX idx_markets_hierarchy_parent ON markets_hierarchy(parent_market_region_id);
CREATE INDEX idx_markets_hierarchy_child ON markets_hierarchy(market_region_id);
CREATE INDEX idx_markets_hierarchy_type ON markets_hierarchy(relationship_type);
```

### 3. Markets to TIGER Mapping (Links markets to official boundaries)
```sql
CREATE TABLE markets_tiger_mapping (
    market_region_id VARCHAR(50) REFERENCES markets(region_id),
    tiger_geoid VARCHAR(20) NOT NULL,
    tiger_type VARCHAR(20) NOT NULL, -- 'state', 'county', 'cbsa', 'place', 'zcta'
    is_primary BOOLEAN DEFAULT false,
    overlap_percentage DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (market_region_id, tiger_geoid, tiger_type)
);

-- Indexes
CREATE INDEX idx_markets_tiger_market ON markets_tiger_mapping(market_region_id);
CREATE INDEX idx_markets_tiger_geoid ON markets_tiger_mapping(tiger_geoid, tiger_type);
```

### 4. Hierarchy Path View (Fast queries)
```sql
CREATE OR REPLACE VIEW markets_hierarchy_path AS
WITH RECURSIVE hierarchy AS (
    -- Base case: national level
    SELECT 
        m.region_id,
        m.region_name,
        m.region_type,
        m.region_id as root_id,
        ARRAY[m.region_id] as path,
        0 as depth
    FROM markets m
    WHERE m.region_type = 'national'
    
    UNION ALL
    
    -- Recursive case: children
    SELECT 
        m.region_id,
        m.region_name,
        m.region_type,
        h.root_id,
        h.path || m.region_id,
        h.depth + 1
    FROM markets m
    JOIN markets_hierarchy mh ON m.region_id = mh.market_region_id
    JOIN hierarchy h ON mh.parent_market_region_id = h.region_id
)
SELECT * FROM hierarchy;
```

## Query Examples

### Get all zip codes in a state
```sql
SELECT m.* 
FROM markets m
JOIN markets_hierarchy_path h ON m.region_id = h.region_id
WHERE h.path @> ARRAY['US-CA']::VARCHAR[]
AND m.region_type = 'zip';
```

### Get all parents of a zip code
```sql
SELECT parent.*
FROM markets child
JOIN markets_hierarchy mh ON child.region_id = mh.market_region_id
JOIN markets parent ON mh.parent_market_region_id = parent.region_id
WHERE child.region_id = 'US-ZIP-90001'
ORDER BY mh.hierarchy_level;
```

### Get metro data with its state
```sql
SELECT 
    metro.*,
    state.region_name as state_name,
    state.region_id as state_id
FROM markets metro
JOIN markets_hierarchy mh ON metro.region_id = mh.market_region_id
JOIN markets state ON mh.parent_market_region_id = state.region_id
WHERE metro.region_type = 'metro'
AND state.region_type = 'state';
```

## Implementation Steps

1. Create `markets_hierarchy` table
2. Create `markets_tiger_mapping` table
3. Create hierarchy path view
4. Populate hierarchy relationships from TIGER data
5. Update data ingestion to maintain hierarchy

