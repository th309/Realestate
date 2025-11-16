# Geographic Hierarchy and Relationship Strategy

## Problem Statement

Geographic entities have complex many-to-many relationships:
- **ZIP code 60007** → belongs to Chicago metro (CBSA) → belongs to Illinois → belongs to National
- **ZIP code 60007** → also belongs to a specific Place (city) → belongs to a County → belongs to Illinois
- **A Place** can span multiple counties
- **A CBSA** can span multiple states
- **A ZIP code** can span multiple counties or places

## Solution: Spatial Relationship Tables

We need to:
1. Load all TIGER shapefiles into separate tables
2. Use PostGIS spatial functions to determine relationships
3. Create junction tables for many-to-many relationships
4. Store relationship confidence scores for partial overlaps
5. Build a hierarchy table for efficient queries

## Data Model

### Core Geographic Tables

```sql
-- States (already loaded)
CREATE TABLE tiger_states (
    geoid VARCHAR(2) PRIMARY KEY,  -- State FIPS code
    name VARCHAR(100),
    geometry GEOMETRY(MultiPolygon, 4326),
    -- other fields from TIGER
);

-- Counties
CREATE TABLE tiger_counties (
    geoid VARCHAR(5) PRIMARY KEY,  -- State + County FIPS (e.g., "17031")
    name VARCHAR(100),
    state_fips VARCHAR(2),
    geometry GEOMETRY(MultiPolygon, 4326),
    -- other fields
);

-- CBSA (Metropolitan and Micropolitan Statistical Areas)
CREATE TABLE tiger_cbsa (
    geoid VARCHAR(5) PRIMARY KEY,  -- CBSA code (e.g., "16980" for Chicago)
    name VARCHAR(255),
    lsad VARCHAR(50),  -- "M1" = Metro, "M2" = Micro
    geometry GEOMETRY(MultiPolygon, 4326),
    -- other fields
);

-- Places (Cities/Towns)
CREATE TABLE tiger_places (
    geoid VARCHAR(7) PRIMARY KEY,  -- State + Place FIPS (e.g., "1714000")
    name VARCHAR(255),
    state_fips VARCHAR(2),
    geometry GEOMETRY(MultiPolygon, 4326),
    -- other fields
);

-- ZCTA (ZIP Code Tabulation Areas)
CREATE TABLE tiger_zcta (
    geoid VARCHAR(5) PRIMARY KEY,  -- ZIP code (e.g., "60007")
    geometry GEOMETRY(MultiPolygon, 4326),
    -- other fields
);
```

### Relationship Junction Tables

```sql
-- ZIP to County relationships (many-to-many)
CREATE TABLE geo_zip_county (
    zip_geoid VARCHAR(5) REFERENCES tiger_zcta(geoid),
    county_geoid VARCHAR(5) REFERENCES tiger_counties(geoid),
    overlap_percentage DECIMAL(5,2),  -- % of ZIP in this county
    is_primary BOOLEAN DEFAULT false,  -- True if >50% overlap
    PRIMARY KEY (zip_geoid, county_geoid)
);

-- ZIP to Place relationships (many-to-many)
CREATE TABLE geo_zip_place (
    zip_geoid VARCHAR(5) REFERENCES tiger_zcta(geoid),
    place_geoid VARCHAR(7) REFERENCES tiger_places(geoid),
    overlap_percentage DECIMAL(5,2),
    is_primary BOOLEAN DEFAULT false,
    PRIMARY KEY (zip_geoid, place_geoid)
);

-- ZIP to CBSA relationships (many-to-many)
CREATE TABLE geo_zip_cbsa (
    zip_geoid VARCHAR(5) REFERENCES tiger_zcta(geoid),
    cbsa_geoid VARCHAR(5) REFERENCES tiger_cbsa(geoid),
    overlap_percentage DECIMAL(5,2),
    is_primary BOOLEAN DEFAULT false,
    PRIMARY KEY (zip_geoid, cbsa_geoid)
);

-- Place to County relationships (many-to-many)
CREATE TABLE geo_place_county (
    place_geoid VARCHAR(7) REFERENCES tiger_places(geoid),
    county_geoid VARCHAR(5) REFERENCES tiger_counties(geoid),
    overlap_percentage DECIMAL(5,2),
    is_primary BOOLEAN DEFAULT false,
    PRIMARY KEY (place_geoid, county_geoid)
);

-- County to CBSA relationships (many-to-many)
CREATE TABLE geo_county_cbsa (
    county_geoid VARCHAR(5) REFERENCES tiger_counties(geoid),
    cbsa_geoid VARCHAR(5) REFERENCES tiger_cbsa(geoid),
    overlap_percentage DECIMAL(5,2),
    is_primary BOOLEAN DEFAULT false,
    PRIMARY KEY (county_geoid, cbsa_geoid)
);

-- County to State (one-to-many, but stored for consistency)
CREATE TABLE geo_county_state (
    county_geoid VARCHAR(5) REFERENCES tiger_counties(geoid),
    state_geoid VARCHAR(2) REFERENCES tiger_states(geoid),
    PRIMARY KEY (county_geoid, state_geoid)
);
```

### Hierarchy Table (Denormalized for Fast Queries)

```sql
-- Fast lookup table for geographic hierarchy
CREATE TABLE geo_hierarchy (
    geoid VARCHAR(20) PRIMARY KEY,
    geo_type VARCHAR(20),  -- 'zip', 'place', 'county', 'cbsa', 'state'
    
    -- Direct parents (most common)
    primary_state_geoid VARCHAR(2),
    primary_county_geoid VARCHAR(5),
    primary_place_geoid VARCHAR(7),
    primary_cbsa_geoid VARCHAR(5),
    
    -- All relationships (JSONB for flexibility)
    all_states JSONB,  -- ["17"] or ["17", "18"] if spans states
    all_counties JSONB,  -- ["17031", "17097"] if spans counties
    all_places JSONB,
    all_cbsas JSONB,
    
    -- Hierarchy path (for easy traversal)
    hierarchy_path TEXT[],  -- ["US", "17", "16980", "1714000", "60007"]
    
    -- Metadata
    name VARCHAR(255),
    population BIGINT,
    area_sqkm DECIMAL(12,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_geo_hierarchy_type ON geo_hierarchy(geo_type);
CREATE INDEX idx_geo_hierarchy_state ON geo_hierarchy(primary_state_geoid);
CREATE INDEX idx_geo_hierarchy_county ON geo_hierarchy(primary_county_geoid);
CREATE INDEX idx_geo_hierarchy_cbsa ON geo_hierarchy(primary_cbsa_geoid);
CREATE INDEX idx_geo_hierarchy_path ON geo_hierarchy USING GIN(hierarchy_path);
```

## Spatial Relationship Logic

### Determining Relationships

Use PostGIS functions to calculate spatial relationships:

1. **ST_Intersects**: Check if geometries overlap
2. **ST_Area**: Calculate area of overlap
3. **ST_Within**: Check if one is completely within another
4. **ST_Contains**: Check if one completely contains another
5. **ST_Centroid**: Use centroid for point-in-polygon checks

### Overlap Percentage Calculation

```sql
-- Calculate what percentage of ZIP code is in a County
SELECT 
    z.geoid as zip_geoid,
    c.geoid as county_geoid,
    (ST_Area(ST_Intersection(z.geometry, c.geometry)) / 
     ST_Area(z.geometry) * 100) as overlap_percentage
FROM tiger_zcta z
CROSS JOIN tiger_counties c
WHERE ST_Intersects(z.geometry, c.geometry)
  AND ST_Area(ST_Intersection(z.geometry, c.geometry)) > 0;
```

### Primary Relationship Logic

- **Primary = True** if overlap_percentage > 50%
- For queries, use primary relationships by default
- For comprehensive queries, include all relationships

## Data Loading Strategy

1. **Load all TIGER shapefiles** into their respective tables
2. **Create spatial indexes** on all geometry columns
3. **Calculate relationships** using spatial joins
4. **Populate junction tables** with overlap percentages
5. **Build hierarchy table** from junction tables
6. **Validate relationships** (e.g., all ZIPs should have at least one county)

## Query Patterns

### Get all counties for a ZIP code
```sql
SELECT c.*, gzc.overlap_percentage, gzc.is_primary
FROM tiger_counties c
JOIN geo_zip_county gzc ON c.geoid = gzc.county_geoid
WHERE gzc.zip_geoid = '60007'
ORDER BY gzc.is_primary DESC, gzc.overlap_percentage DESC;
```

### Get full hierarchy for a ZIP code
```sql
SELECT 
    h.geoid,
    h.geo_type,
    h.hierarchy_path,
    s.name as state_name,
    c.name as county_name,
    p.name as place_name,
    cbsa.name as cbsa_name
FROM geo_hierarchy h
LEFT JOIN tiger_states s ON h.primary_state_geoid = s.geoid
LEFT JOIN tiger_counties c ON h.primary_county_geoid = c.geoid
LEFT JOIN tiger_places p ON h.primary_place_geoid = p.geoid
LEFT JOIN tiger_cbsa cbsa ON h.primary_cbsa_geoid = cbsa.geoid
WHERE h.geoid = '60007';
```

### Find all ZIPs in a CBSA
```sql
SELECT z.*, gzc.overlap_percentage
FROM tiger_zcta z
JOIN geo_zip_cbsa gzc ON z.geoid = gzc.zip_geoid
WHERE gzc.cbsa_geoid = '16980'  -- Chicago
  AND gzc.is_primary = true
ORDER BY z.geoid;
```

## Performance Considerations

1. **Spatial indexes** on all geometry columns (GIST)
2. **Bounding box pre-filtering** before expensive spatial operations
3. **Batch processing** relationships in chunks
4. **Cache hierarchy table** for fast lookups
5. **Materialized views** for common query patterns

## Validation Rules

1. Every ZIP should have at least one county relationship
2. Every ZIP should have at least one state relationship
3. Every county should have exactly one state relationship
4. Overlap percentages should sum to ~100% for each ZIP
5. Primary relationships should be unique per ZIP (one primary county, etc.)

## Edge Cases to Handle

1. **ZIP codes spanning state boundaries** (rare but possible)
2. **Places spanning multiple counties** (common)
3. **CBSAs spanning multiple states** (common, e.g., New York metro)
4. **ZIP codes with no place** (unincorporated areas)
5. **ZIP codes in multiple CBSAs** (shouldn't happen, but validate)
6. **Partial overlaps** (ZIP 80% in County A, 20% in County B)

