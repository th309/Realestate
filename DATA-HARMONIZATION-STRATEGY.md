# Data Harmonization Strategy for Multi-Source Real Estate Data

## The Problem

You have multiple data sources with different formats and structures:

### 1. **Zillow Data**
- **Format**: Wide format (one row per region, dates as columns)
- **Geographic ID**: RegionID (proprietary Zillow IDs like "394913")
- **Geographic Levels**: country, state, msa (metro), city, zip
- **Metrics**: ZHVI (home values), ZORI (rent), inventory, days on market
- **Frequency**: Monthly (end-of-month dates)
- **Time Range**: 2000 to present

### 2. **Redfin Data**
- **Format**: Cross-tab (one row per region per time period)
- **Geographic ID**: Region names (e.g., "Boston, MA metro area")
- **Geographic Levels**: National, metro areas, cities
- **Metrics**: Median sale price, homes sold, inventory, days on market
- **Frequency**: Monthly or Quarterly
- **Time Range**: 2012 to present
- **Special**: Includes MoM and YoY change columns

### 3. **FRED Data (Federal Reserve)**
- **Format**: Time series API
- **Geographic ID**: National only (region_id: "102001")
- **Geographic Levels**: National (some series have state/metro)
- **Metrics**: Mortgage rates, unemployment, economic indicators
- **Frequency**: Daily, Weekly, Monthly (varies by series)
- **Time Range**: Varies by series (often decades)

### 4. **Census Data**
- **Format**: API with annual snapshots
- **Geographic ID**: FIPS codes, Census place codes
- **Geographic Levels**: state, metro (MSA), place (city), zip
- **Metrics**: Demographics (population, income, poverty)
- **Frequency**: Annual (5-year ACS estimates)
- **Time Range**: 2010 to present

## The Solution: Unified Data Model

### 1. Master Geographic Registry

Create a `markets` table that serves as the single source of truth for all geographic entities:

```sql
CREATE TABLE markets (
    -- Primary identifier (can be Zillow ID, FIPS code, or generated)
    region_id VARCHAR(50) PRIMARY KEY,
    
    -- Human-readable identification
    region_name VARCHAR(255) NOT NULL,
    region_type VARCHAR(50) NOT NULL, -- 'country', 'state', 'msa', 'city', 'zip'
    
    -- Geographic hierarchy
    state_code VARCHAR(2),
    state_name VARCHAR(100),
    metro_id VARCHAR(50),      -- Parent metro area if applicable
    metro_name VARCHAR(255),
    county_fips VARCHAR(5),
    
    -- External system mappings (JSONB for flexibility)
    external_ids JSONB DEFAULT '{}',
    /* Example:
    {
        "zillow_id": "394913",
        "redfin_name": "New York, NY metro area",
        "census_msa": "35620",
        "fips_code": "36061",
        "geonames_id": "5128581"
    }
    */
    
    -- Geographic data for mapping
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    geometry GEOMETRY(MultiPolygon, 4326),
    bounds JSONB, -- {"north": 40.9, "south": 40.4, "east": -73.7, "west": -74.3}
    
    -- Metadata
    population BIGINT,
    households INTEGER,
    size_rank INTEGER,
    
    -- System fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX idx_markets_external_zillow ON markets ((external_ids->>'zillow_id'));
CREATE INDEX idx_markets_external_census ON markets ((external_ids->>'census_msa'));
CREATE INDEX idx_markets_external_fips ON markets ((external_ids->>'fips_code'));
CREATE INDEX idx_markets_name_type ON markets (region_name, region_type);
CREATE SPATIAL INDEX idx_markets_geometry ON markets USING GIST (geometry);
```

### 2. Unified Time Series Storage

Store all metrics in a single, flexible structure:

```sql
CREATE TABLE market_time_series (
    id BIGSERIAL,
    region_id VARCHAR(50) REFERENCES markets(region_id),
    date DATE NOT NULL,
    
    -- Core fields
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20, 4),
    data_source VARCHAR(50) NOT NULL,
    
    -- Flexible attributes for source-specific metadata
    attributes JSONB DEFAULT '{}',
    /* Examples:
    Zillow: {"property_type": "sfrcondo", "tier": "middle"}
    Redfin: {"metric_type": "value", "change_type": "mom"}
    FRED: {"series_id": "MORTGAGE30US", "units": "percent"}
    Census: {"survey": "acs5", "margin_of_error": 1250}
    */
    
    -- Data quality
    confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
    is_estimated BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (id, date)
) PARTITION BY RANGE (date);
```

### 3. Standardized Metric Naming

Create a consistent metric taxonomy across all sources:

```yaml
# Housing Market Metrics
home_value_median        # Zillow: zhvi, Redfin: median_sale_price
home_value_per_sqft      # Price per square foot
rental_value_median      # Zillow: zori, Census: median_gross_rent

# Market Activity
homes_sold_count         # Transaction volume
homes_listed_count       # New listings
inventory_active         # Current inventory
days_on_market_median    # Time to sell

# Price Dynamics
price_change_mom         # Month-over-month change
price_change_yoy         # Year-over-year change
price_cuts_percent       # Percentage with reductions
sale_to_list_ratio       # Sold vs asking price

# Demographics
population_total         # Census: population
income_median_household  # Census: median_household_income
poverty_rate            # Census: poverty percentage
unemployment_rate       # FRED/Census: unemployment

# Economic Indicators
mortgage_rate_30yr      # FRED: 30-year fixed rate
mortgage_rate_15yr      # FRED: 15-year fixed rate
affordability_index     # Calculated metric
```

### 4. Geographic Mapping Strategy

#### A. Region Identification Pipeline

```typescript
class RegionMatcher {
    // Step 1: Try exact ID match
    async findByExternalId(source: string, externalId: string) {
        // Query: external_ids->>'zillow_id' = ? 
    }
    
    // Step 2: Try name + type match
    async findByNameAndType(name: string, type: string, state?: string) {
        // Normalize name (remove "metro area", "MSA", etc.)
        // Match on normalized name + type + state
    }
    
    // Step 3: Try fuzzy matching
    async findByFuzzyMatch(name: string, type: string) {
        // Use PostgreSQL similarity functions
        // Consider Levenshtein distance
    }
    
    // Step 4: Try geographic proximity
    async findByCoordinates(lat: number, lng: number, type: string) {
        // Find nearest region of same type
    }
    
    // Step 5: Create new region if needed
    async createRegion(data: RegionData) {
        // Insert new market record
        // Log for manual review
    }
}
```

#### B. Name Normalization Rules

```typescript
const normalizeRegionName = (name: string, source: string) => {
    let normalized = name;
    
    // Remove source-specific suffixes
    normalized = normalized.replace(/ metro area$/i, '');
    normalized = normalized.replace(/ MSA$/i, '');
    normalized = normalized.replace(/, [A-Z]{2}-[A-Z]{2}.*$/i, ''); // Remove multi-state
    
    // Standardize common variations
    normalized = normalized.replace(/^St\. /i, 'Saint ');
    normalized = normalized.replace(/-/g, ' ');
    
    // Extract state if present
    const stateMatch = normalized.match(/, ([A-Z]{2})$/);
    const state = stateMatch ? stateMatch[1] : null;
    
    return { name: normalized, state };
};
```

### 5. Data Import Pipeline

```typescript
interface DataImportPipeline {
    // 1. Extract & Transform
    extract(): AsyncIterator<RawRecord>;
    
    // 2. Map to unified region
    async mapRegion(record: RawRecord): Promise<string> {
        // Use RegionMatcher to find/create region_id
    }
    
    // 3. Transform metrics
    transformMetrics(record: RawRecord): MetricRecord[] {
        // Map source metrics to standard names
        // Handle unit conversions
        // Calculate derived metrics
    }
    
    // 4. Validate & enrich
    async validate(metrics: MetricRecord[]): Promise<ValidatedMetrics> {
        // Check data quality
        // Flag outliers
        // Add confidence scores
    }
    
    // 5. Load to database
    async load(metrics: ValidatedMetrics): Promise<void> {
        // Batch insert with conflict handling
        // Update aggregations
        // Trigger downstream processes
    }
}
```

### 6. Map Visualization Requirements

For effective map visualization, ensure:

#### A. Geographic Data
```sql
-- Add missing coordinates/boundaries
UPDATE markets m
SET 
    latitude = g.latitude,
    longitude = g.longitude,
    geometry = g.geometry
FROM geographic_lookups g
WHERE m.region_id = g.region_id
AND m.geometry IS NULL;
```

#### B. Aggregation Levels
```sql
-- Create view for map data at different zoom levels
CREATE MATERIALIZED VIEW map_data_summary AS
SELECT 
    m.region_id,
    m.region_type,
    m.region_name,
    m.latitude,
    m.longitude,
    m.bounds,
    ST_SimplifyPreserveTopology(m.geometry, 
        CASE 
            WHEN region_type = 'state' THEN 0.01
            WHEN region_type = 'msa' THEN 0.005
            ELSE 0.001
        END
    ) as simplified_geometry,
    
    -- Latest metrics
    (SELECT metric_value FROM market_time_series 
     WHERE region_id = m.region_id 
     AND metric_name = 'home_value_median'
     ORDER BY date DESC LIMIT 1) as current_home_value,
    
    (SELECT metric_value FROM market_time_series 
     WHERE region_id = m.region_id 
     AND metric_name = 'price_change_yoy'
     ORDER BY date DESC LIMIT 1) as price_change_yoy

FROM markets m;
```

### 7. Data Quality & Validation

#### A. Cross-Source Validation
```sql
-- Compare overlapping metrics between sources
CREATE VIEW data_quality_checks AS
SELECT 
    m.region_name,
    z.metric_value as zillow_value,
    r.metric_value as redfin_value,
    ABS(z.metric_value - r.metric_value) / z.metric_value as difference_pct
FROM markets m
JOIN market_time_series z ON m.region_id = z.region_id
JOIN market_time_series r ON m.region_id = r.region_id
WHERE z.metric_name = 'home_value_median'
AND r.metric_name = 'home_value_median'
AND z.data_source = 'zillow'
AND r.data_source = 'redfin'
AND z.date = r.date
AND ABS(z.metric_value - r.metric_value) / z.metric_value > 0.1;
```

#### B. Completeness Monitoring
```sql
-- Track data coverage by source and region
CREATE VIEW data_coverage AS
SELECT 
    m.region_type,
    mts.data_source,
    COUNT(DISTINCT m.region_id) as regions_with_data,
    COUNT(DISTINCT mts.date) as dates_available,
    MIN(mts.date) as earliest_date,
    MAX(mts.date) as latest_date
FROM markets m
LEFT JOIN market_time_series mts ON m.region_id = mts.region_id
GROUP BY m.region_type, mts.data_source;
```

### 8. Implementation Priority

1. **Phase 1: Foundation**
   - Create unified `markets` table with external ID mappings
   - Implement region matching logic
   - Set up geographic data (coordinates, boundaries)

2. **Phase 2: Data Import**
   - Update Zillow importer to use new structure
   - Update Redfin importer for cross-tab format
   - Implement FRED national data import
   - Add Census demographic import

3. **Phase 3: Harmonization**
   - Build metric name mapping
   - Create data validation rules
   - Implement cross-source reconciliation

4. **Phase 4: Visualization**
   - Create map data views
   - Build aggregation queries
   - Optimize for performance

## Benefits of This Approach

1. **Single Source of Truth**: One region can have data from multiple sources
2. **Flexible Mapping**: JSONB external_ids allows any source to be mapped
3. **Consistent Metrics**: Standard naming across all sources
4. **Data Quality**: Built-in validation and confidence scoring
5. **Map Ready**: Geographic data properly structured for visualization
6. **Scalable**: Partitioned tables, proper indexes, materialized views
7. **Maintainable**: Clear separation of concerns, extensible design

## Next Steps

1. Review and approve this strategy
2. Create migration scripts for existing data
3. Update importers to use new structure
4. Build geographic data enrichment pipeline
5. Create map visualization queries
