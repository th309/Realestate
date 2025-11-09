# FRED API Setup

## Get Your Free API Key

1. Go to https://fred.stlouisfed.org/docs/api/api_key.html
2. Sign up for a free account
3. Get your API key
4. Add it to your `.env.local` file:

```
FRED_API_KEY=your_api_key_here
```

## Verify United States Region Exists

FRED data is stored at the national level using region_id `102001` (United States).

Make sure this region exists in your `markets` table. If not, you can insert it:

```sql
INSERT INTO markets (region_id, region_name, region_type)
VALUES ('102001', 'United States', 'country')
ON CONFLICT (region_id) DO NOTHING;
```

## Test the Import

1. Go to http://localhost:3000/test
2. Click "Import 30-Year Mortgage Rates"
3. This will import historical mortgage rate data from 2000 to present

## Available Series

- `mortgage_rate_30yr` - 30-Year Fixed Rate Mortgage Average (MORTGAGE30US)
- `mortgage_rate_15yr` - 15-Year Fixed Rate Mortgage Average (MORTGAGE15US)
- `unemployment_rate` - Unemployment Rate (UNRATE)

## API Endpoint

```
GET /api/import-fred?series=mortgage_rate_30yr
GET /api/import-fred?series=mortgage_rate_30yr,mortgage_rate_15yr
```

