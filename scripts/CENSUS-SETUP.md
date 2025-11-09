# Census API Setup

## Get Your Free API Key

1. Go to https://api.census.gov/data/key_signup.html
2. Fill out the form (name, email, organization)
3. Get your API key via email
4. Add it to your `.env.local` file:

```
CENSUS_API_KEY=your_api_key_here
```

## Available Geographic Levels

- `state` - State-level data
- `metropolitan statistical area/micropolitan statistical area` - Metro areas
- `place` - Cities
- `zip code tabulation area` - Zip codes

## Available Variables

- `population` - Total Population (B01001_001E)
- `median_household_income` - Median Household Income (B19013_001E)
- `poverty_population` - Population Below Poverty Level (B17001_002E)
- `median_gross_rent` - Median Gross Rent (B25064_001E)

## Test the Import

1. Go to http://localhost:3000/test
2. Click "Import Metro Demographics (2022)"
3. This will import population and income data for all metro areas

## API Endpoint

```
GET /api/import-census?variables=population,median_household_income&year=2022&geo_level=metropolitan statistical area/micropolitan statistical area
```

## Geographic Mapping

The Census importer maps Census geographic codes to our `region_id` system by:
- Matching state FIPS codes to state regions
- Matching metro names to metro regions
- Matching city names to city regions
- Matching zip codes to zip code regions

If a match isn't found, the record is skipped (logged as warning).

