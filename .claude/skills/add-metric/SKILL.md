---
name: add-metric
description: Scaffold a new metric in the PropertyIQ data layer (registry, fetcher, types)
arguments:
  - name: metricId
    description: "The metric identifier in snake_case (e.g., rent_growth, vacancy_rate)"
    required: true
  - name: dataSource
    description: "Data source: zillow, realtor, census, calculated, fred, propertyiq"
    required: true
  - name: title
    description: "Human-readable title (e.g., 'Rent Growth')"
    required: true
  - name: format
    description: "Display format: currency, percent, percent_abs, number, index"
    required: true
  - name: geos
    description: "Comma-separated supported geos (e.g., 'state,metro,county,zip')"
    required: true
---

# Add Metric Skill

Scaffolds a new metric following PropertyIQ's data layer patterns.

## Steps

1. **Add to Registry** (`packages/frontend/lib/data/registry.ts`):

```typescript
${metricId}: {
  id: '${metricId}',
  title: '${title}',
  format: '${format}',
  dataSource: '${dataSource}',
  apiEndpoint: '/api/${dataSource}/{geo}',  // Adjust based on actual endpoint
  keyField: 'auto',
  supportedGeos: [${geos.split(',').map(g => `'${g.trim()}'`).join(', ')}],
},
```

2. **Verify API Endpoint Exists**:
   - Check `packages/backend/src/${dataSource}/` for the controller
   - Endpoint should return data with proper key fields:
     - State: `region_name`
     - Metro: `cbsa_code`
     - County: `county_fips`
     - ZIP: `postal_code`

3. **Test the Metric**:
```typescript
import { useSnapshotData } from '@/lib/data';
const { value, isLoading } = useSnapshotData('${metricId}', 'metro', '35620');
```

## Key Field Reference

| Geo Level | Key Field | Example |
|-----------|-----------|---------|
| state | region_name | "California" |
| metro | cbsa_code | "35620" |
| county | county_fips | "06001" |
| zip | postal_code | "90210" |

## Common Pitfalls

- Always set `supportedGeos` - metrics without it won't render
- For percent metrics stored as decimals (0.05 = 5%), set `asPercent: true`
- Metro-only metrics should also be added to `METRO_ONLY_METRICS` set
