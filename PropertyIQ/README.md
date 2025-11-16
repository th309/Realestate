# PropertyIQ Edge Functions

Production-ready Supabase Edge Functions for PropertyIQ real estate intelligence platform. These serverless functions handle file processing, location normalization, and report generation.

## 🚀 Features

### Three Core Edge Functions

1. **process-upload**: Handles file processing for GeoJSON, CSV, and Shapefile uploads
2. **normalize-location**: Batch processes location text to standardized GEOIDs
3. **generate-report**: Creates market intelligence reports with multiple format options

### Key Capabilities

- ✅ **Production-Ready**: Full error handling, logging, and idempotent operations
- 🔒 **Secure**: JWT authentication, rate limiting, and CORS support
- ⚡ **Performance**: Batch processing, caching, and concurrent operations
- 📊 **Flexible Reports**: JSON, PDF, and Excel export formats
- 🎯 **Type-Safe**: Complete TypeScript types for all operations
- 📝 **Well-Documented**: Comprehensive inline documentation

## 📋 Prerequisites

- Windows 10/11 with PowerShell 7+
- Node.js 18+ and npm
- Supabase project with:
  - PostgreSQL database
  - Required tables (see Database Schema section)
  - Storage buckets: `uploads` and `reports`

## 🛠️ Installation

### 1. Clone or Copy the PropertyIQ Directory

```powershell
# Navigate to your project
cd "C:\Projects\Real Estate"

# The PropertyIQ directory should already exist with all files
```

### 2. Install Dependencies

```powershell
cd PropertyIQ
cd web
npm install supabase --save-dev
cd ..
```

### 3. Configure Environment

```powershell
# Copy the example environment file
Copy-Item supabase\env.example supabase\.env

# Edit the .env file with your Supabase credentials
notepad supabase\.env
```

Required environment variables:
- `SUPABASE_URL`: Your project URL
- `SUPABASE_ANON_KEY`: Anonymous/Public key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key

Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api

## 🚀 Deployment

### Quick Deploy (All Functions)

```powershell
# Deploy all functions with automatic setup
.\deploy.ps1 -SetSecrets -Verify
```

### Deploy Specific Function

```powershell
# Deploy only the normalize-location function
.\deploy.ps1 -Function normalize-location
```

### Manual Deployment

```powershell
cd supabase

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
npx supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
npx supabase secrets set SUPABASE_ANON_KEY=your-anon-key
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Deploy functions
npx supabase functions deploy process-upload
npx supabase functions deploy normalize-location
npx supabase functions deploy generate-report
```

## 📊 Database Schema

Ensure your database has these tables:

### spatial_uploads
```sql
CREATE TABLE spatial_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_name TEXT NOT NULL,
    file_type TEXT CHECK (file_type IN ('geojson', 'csv', 'shapefile', 'kml', 'gpx')),
    files JSONB,
    processing_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### spatial_staging
```sql
CREATE TABLE spatial_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES spatial_uploads(id),
    geometry_wgs84 GEOMETRY,
    properties JSONB,
    extracted_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### staging_data
```sql
CREATE TABLE staging_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id TEXT NOT NULL,
    raw_data JSONB NOT NULL,
    normalization_results JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### subscriber_reports
```sql
CREATE TABLE subscriber_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    report_name TEXT NOT NULL,
    report_type TEXT NOT NULL,
    full_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### master_market_intelligence
```sql
-- This table should contain your market data with columns like:
-- geoid, geography_name, state_code, population, median_income, etc.
```

### normalize_location Function
```sql
CREATE OR REPLACE FUNCTION normalize_location(
    input_text TEXT,
    context_state TEXT DEFAULT NULL
)
RETURNS TABLE(geoid TEXT, confidence DECIMAL, match_type TEXT)
AS $$
    -- Your location normalization logic here
$$ LANGUAGE plpgsql;
```

## 🔧 API Reference

### process-upload

**Endpoint**: `POST /functions/v1/process-upload`

**Request Body**:
```json
{
  "file_id": "uuid-of-uploaded-file",
  "file_type": "geojson",
  "options": {
    "encoding": "utf-8",
    "delimiter": ",",
    "headers": true
  }
}
```

**Response**:
```json
{
  "success": true,
  "processed_count": 150,
  "errors": [],
  "upload_id": "uuid-of-upload"
}
```

### normalize-location

**Endpoint**: `POST /functions/v1/normalize-location`

**Request Body**:
```json
{
  "locations": [
    {
      "id": "loc1",
      "text": "San Francisco, CA",
      "state": "CA"
    },
    {
      "id": "loc2",
      "text": "Austin",
      "state": "TX"
    }
  ]
}
```

**Response**:
```json
{
  "results": [
    {
      "id": "loc1",
      "geoid": "06075",
      "confidence": 0.95,
      "match_type": "exact"
    },
    {
      "id": "loc2",
      "geoid": "48453",
      "confidence": 0.88,
      "match_type": "fuzzy"
    }
  ]
}
```

### generate-report

**Endpoint**: `POST /functions/v1/generate-report`

**Request Body**:
```json
{
  "report_type": "market_analysis",
  "geoids": ["06075", "48453"],
  "options": {
    "include_demographics": true,
    "include_housing": true,
    "include_economics": true,
    "include_trends": true,
    "format": "json"
  }
}
```

**Response**:
```json
{
  "report_id": "uuid-of-report",
  "preview": {
    "title": "Market Analysis Report",
    "summary": "Analysis of 2 markets...",
    "key_metrics": {
      "demographics": {...},
      "housing": {...}
    }
  },
  "download_url": "https://..."
}
```

## 🧪 Testing

### Test with cURL

```bash
# Test normalize-location
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/normalize-location \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"locations":[{"id":"1","text":"Los Angeles, CA"}]}'
```

### Test with PowerShell

```powershell
# Test process-upload
$headers = @{
    "Authorization" = "Bearer YOUR_ANON_KEY"
    "Content-Type" = "application/json"
}

$body = @{
    file_id = "your-file-id"
    file_type = "geojson"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://YOUR_PROJECT.supabase.co/functions/v1/process-upload" `
    -Method POST `
    -Headers $headers `
    -Body $body
```

### View Logs

```powershell
# View logs for a specific function
npx supabase functions logs normalize-location

# Follow logs in real-time
npx supabase functions logs generate-report --follow
```

## 🔍 Monitoring & Debugging

### Check Function Status

```powershell
# List deployed functions
npx supabase functions list

# Get function details
npx supabase functions get normalize-location
```

### Common Issues & Solutions

1. **CORS Errors**
   - Ensure CORS headers are properly set in the functions
   - Check that the client is sending proper headers

2. **Authentication Errors**
   - Verify JWT token is valid and not expired
   - Ensure service role key is set for admin operations

3. **Rate Limiting**
   - Default: 100 requests per minute per IP
   - Adjust in cors.ts if needed

4. **Large File Processing**
   - Files over 50MB should be uploaded to storage first
   - Use batch processing for large datasets

## 🏗️ Architecture

```
PropertyIQ/
├── supabase/
│   ├── functions/
│   │   ├── _shared/           # Shared utilities
│   │   │   ├── database-types.ts
│   │   │   ├── supabase-client.ts
│   │   │   └── cors.ts
│   │   ├── process-upload/    # File processing
│   │   ├── normalize-location/# Location normalization
│   │   └── generate-report/   # Report generation
│   ├── config.toml            # Supabase configuration
│   └── env.example            # Environment template
├── deploy.ps1                 # Deployment script
└── README.md                  # This file
```

## 🔐 Security Features

- **JWT Authentication**: All functions require valid Supabase JWT
- **Rate Limiting**: Configurable per-IP rate limits
- **Input Validation**: Strict validation of all inputs
- **Error Sanitization**: No sensitive data in error responses
- **CORS Protection**: Configurable CORS headers
- **Service Role Protection**: Service key never exposed to client

## 📈 Performance Optimizations

- **Caching**: In-memory cache for frequently accessed data
- **Batch Processing**: Process multiple items concurrently
- **Connection Pooling**: Reuse database connections
- **Lazy Loading**: Load resources only when needed
- **Stream Processing**: Handle large files without loading entirely

## 🤝 Contributing

1. Make changes to the functions
2. Test locally with Supabase CLI
3. Deploy to staging environment
4. Run integration tests
5. Deploy to production

## 📝 License

Copyright © 2024 PropertyIQ. All rights reserved.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Logs**: Use `npx supabase functions logs` for debugging
- **Dashboard**: Monitor functions in Supabase Dashboard
- **Issues**: Report issues in the project repository

## 🚦 Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing JWT |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## 🔄 Version History

- **1.0.0** - Initial release with three core functions
  - process-upload: GeoJSON and CSV support
  - normalize-location: Batch location processing
  - generate-report: Multi-format report generation

---

Built with ❤️ for PropertyIQ using Supabase Edge Functions and Deno runtime.
