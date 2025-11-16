# Dynamic Map Data API

## Overview

The map visualization system is now **fully dynamic** - no metrics are hardcoded. The map is purely a visualization layer that displays whatever data you query.

## API Endpoints

### 1. Get Map Data
**GET** `/api/map-data`

Returns geographic boundaries with metric values for map visualization.

**Query Parameters:**
- `metric` (required) - The metric name to display (e.g., `zhvi`, `zori`, `median_sale_price`)
- `region_type` (optional) - Filter by region type: `state`, `metro`, `city`, or `zip`
- `data_source` (optional) - Filter by data source: `zillow`, `redfin`, `census`, `fred`
- `date` (optional) - Specific date (YYYY-MM-DD). If omitted, returns latest available date

**Example Requests:**
```
GET /api/map-data?metric=zhvi&region_type=state
GET /api/map-data?metric=zori&region_type=metro
GET /api/map-data?metric=investor_market_share&region_type=city
GET /api/map-data?metric=median_sale_price&region_type=zip&data_source=redfin
GET /api/map-data?metric=zhvi&region_type=state&date=2024-01-01
```

**Response:**
```json
{
  "metric": "zhvi",
  "region_type": "state",
  "data_source": "all",
  "date": "latest",
  "count": 50,
  "data": [
    {
      "region_id": "state_ca",
      "region_name": "California",
      "region_type": "state",
      "state_code": "CA",
      "geometry": {...},
      "centroid_lat": 36.7783,
      "centroid_lon": -119.4179,
      "bounds": {...},
      "metric_value": 750000.00,
      "metric_name": "zhvi",
      "data_source": "zillow",
      "date": "2024-11-30"
    },
    ...
  ]
}
```

### 2. List Available Metrics
**GET** `/api/metrics`

Returns all available metrics with their data sources and region types.

**Example Request:**
```
GET /api/metrics
```

**Response:**
```json
{
  "count": 15,
  "metrics": [
    {
      "name": "zhvi",
      "sources": ["zillow"],
      "region_types": ["state", "metro", "city", "zip"]
    },
    {
      "name": "zori",
      "sources": ["zillow"],
      "region_types": ["metro", "city"]
    },
    {
      "name": "median_sale_price",
      "sources": ["redfin"],
      "region_types": ["metro", "city"]
    },
    ...
  ]
}
```

## Database Function

The API uses a PostgreSQL function `get_map_data()` that can be called directly:

```sql
-- Get home values by state
SELECT * FROM get_map_data('zhvi', 'state');

-- Get rental rates by metro
SELECT * FROM get_map_data('zori', 'metro');

-- Get investor data for cities
SELECT * FROM get_map_data('investor_market_share', 'city', 'redfin');
```

## Frontend Integration

### Step 1: Load Available Metrics
```typescript
const response = await fetch('/api/metrics');
const { metrics } = await response.json();

// Populate metric selector dropdown
metrics.forEach(metric => {
  // Add to dropdown: metric.name
});
```

### Step 2: User Selects Metric and Region Type
```typescript
const selectedMetric = 'zhvi';
const selectedRegionType = 'state';
```

### Step 3: Fetch Map Data
```typescript
const response = await fetch(
  `/api/map-data?metric=${selectedMetric}&region_type=${selectedRegionType}`
);
const { data } = await response.json();

// Pass data to map visualization
mapVisualization.render(data);
```

### Step 4: Map Displays Data
The map receives GeoJSON geometry with metric values and displays them using color coding, size, or other visual encodings.

## Benefits

1. **No Hardcoding** - Add new metrics without code changes
2. **Flexible Filtering** - Filter by region type, data source, or date
3. **Easy to Extend** - New metrics automatically appear in the API
4. **Performance** - Indexed queries for fast responses
5. **Separation of Concerns** - Map is pure visualization, data layer is separate

## Migration

If you have an existing database with the old `map_data` view, run:

```sql
-- Run this migration script
\i scripts/migrate-to-dynamic-map-data.sql
```

This will:
- Drop the old hardcoded `map_data` view
- Create the new `get_map_data()` function
- Add performance indexes

## Examples

### Housing Costs by State
```typescript
const data = await fetch('/api/map-data?metric=zhvi&region_type=state');
// Map displays home values colored by state
```

### Average Rental Rate by Metro
```typescript
const data = await fetch('/api/map-data?metric=zori&region_type=metro');
// Map displays rental rates colored by metro area
```

### Investor Percentage in Cities
```typescript
const data = await fetch('/api/map-data?metric=investor_market_share&region_type=city&data_source=redfin');
// Map displays investor market share colored by city
```

### Historical Data
```typescript
const data = await fetch('/api/map-data?metric=zhvi&region_type=state&date=2020-01-01');
// Map displays home values from January 2020
```

