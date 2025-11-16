# Admin Upload Interface - Implementation Plan

## Overview

Build a GUI in the frontend for admins to upload shapefiles and GeoJSON files to update geographic data in Supabase.

---

## Features

### ✅ Core Functionality

1. **File Upload**
   - Drag & drop or file picker
   - Support for:
     - Shapefiles (as ZIP containing .shp, .shx, .dbf, etc.)
     - GeoJSON files (.geojson, .json)
   - File validation before upload

2. **Configuration Options**
   - Target table selection (dropdown)
   - Geometry column name (auto-detect or manual)
   - GEOID field name (auto-detect or manual)
   - Batch size configuration
   - Overwrite vs. append mode

3. **Progress Tracking**
   - Upload progress bar
   - Processing progress (features loaded, errors)
   - Real-time status updates
   - Estimated time remaining

4. **Error Handling**
   - Validation errors (missing files, invalid format)
   - Processing errors (database errors, geometry errors)
   - Detailed error messages with suggestions

5. **Preview & Validation**
   - Show file info (size, type, feature count)
   - Preview first few features
   - Validate required component files (for shapefiles)
   - Check for common issues

6. **History & Logs**
   - Upload history
   - Success/failure status
   - Timestamps
   - Download logs

---

## Technical Implementation

### API Route: `/api/admin/upload-geographic-data`

**Endpoint:** `POST /api/admin/upload-geographic-data`

**Request:**
- `multipart/form-data`
- Fields:
  - `file`: File (ZIP for shapefile, or GeoJSON file)
  - `fileType`: 'shapefile' | 'geojson'
  - `tableName`: string
  - `geometryColumn`: string (optional, auto-detect)
  - `geoidField`: string (optional, auto-detect)
  - `batchSize`: number (optional, default: 10)
  - `overwrite`: boolean (optional, default: false)

**Response:**
```json
{
  "success": boolean,
  "loaded": number,
  "errors": number,
  "totalFeatures": number,
  "geometryColumn": string,
  "geoidField": string,
  "errorMessages": string[],
  "warnings": string[]
}
```

**Processing:**
1. Receive uploaded file
2. If ZIP (shapefile):
   - Extract to temp directory
   - Validate all required files (.shp, .shx, .dbf) exist
   - Use shapefile library to read
3. If GeoJSON:
   - Parse JSON
   - Validate FeatureCollection format
4. Process in batches
5. Load to Supabase using PostGIS functions
6. Return results

---

### Frontend Component: Admin Upload Page

**Location:** `web/app/admin/geographic-upload/page.tsx`

**Features:**
- Material UI components (matches your stack)
- Drag & drop file upload area
- Configuration form
- Progress indicators
- Results display
- Upload history table

**State Management:**
- File selection
- Upload progress
- Processing status
- Results/errors
- Configuration options

---

## File Structure

```
web/
├── app/
│   ├── admin/
│   │   ├── geographic-upload/
│   │   │   └── page.tsx          # Main admin upload page
│   │   └── layout.tsx            # Admin layout (if needed)
│   └── api/
│       └── admin/
│           └── upload-geographic-data/
│               └── route.ts      # API endpoint
├── components/
│   └── admin/
│       ├── GeographicFileUpload.tsx    # Upload component
│       ├── UploadProgress.tsx          # Progress indicator
│       ├── UploadResults.tsx           # Results display
│       └── UploadHistory.tsx           # History table
└── lib/
    └── admin/
        └── geographic-upload.ts  # Upload logic (shared)
```

---

## UI/UX Design

### Layout

```
┌─────────────────────────────────────────────────┐
│  Admin - Geographic Data Upload                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  📁 File Upload Area                            │
│  ┌───────────────────────────────────────────┐ │
│  │                                           │ │
│  │     Drag & drop files here                │ │
│  │     or click to browse                    │ │
│  │                                           │ │
│  │     Supports: .zip (shapefile), .geojson  │ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ⚙️ Configuration                               │
│  ┌───────────────────────────────────────────┐ │
│  │ Target Table: [dropdown ▼]                │ │
│  │ Geometry Column: [auto-detect]            │ │
│  │ GEOID Field: [auto-detect]                │ │
│  │ Batch Size: [10]                          │ │
│  │ ☐ Overwrite existing data                 │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  📊 File Preview                                │
│  ┌───────────────────────────────────────────┐ │
│  │ File: tl_2024_us_cbsa.zip                 │ │
│  │ Type: Shapefile                           │ │
│  │ Size: 2.5 MB                              │ │
│  │ Features: ~935                            │ │
│  │ Status: ✅ Valid                          │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  [Upload & Process] button                      │
│                                                 │
│  📈 Progress                                    │
│  ┌───────────────────────────────────────────┐ │
│  │ ████████████░░░░░░░░ 60%                  │ │
│  │ Processing: 561/935 features              │ │
│  │ Loaded: 561 | Errors: 0                   │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ✅ Results                                     │
│  ┌───────────────────────────────────────────┐ │
│  │ Successfully loaded: 935 features         │ │
│  │ Errors: 0                                 │ │
│  │ Table: tiger_cbsa                         │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  📋 Upload History                              │
│  ┌───────────────────────────────────────────┐ │
│  │ Date       | File        | Status | Count │ │
│  │ 2024-01-15 | cbsa.zip    | ✅     | 935   │ │
│  │ 2024-01-14 | states.zip  | ✅     | 50    │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: API Endpoint (Backend)
1. ✅ Create `/api/admin/upload-geographic-data/route.ts`
2. ✅ Handle multipart/form-data file uploads
3. ✅ Support ZIP extraction for shapefiles
4. ✅ Validate file types and required components
5. ✅ Process files using existing logic from scripts
6. ✅ Return detailed results

### Phase 2: Frontend Components
1. ✅ Create admin layout/page structure
2. ✅ Build file upload component (drag & drop)
3. ✅ Build configuration form
4. ✅ Build progress indicator
5. ✅ Build results display
6. ✅ Build upload history

### Phase 3: Integration & Testing
1. ✅ Connect frontend to API
2. ✅ Test with various file types
3. ✅ Error handling and validation
4. ✅ Performance optimization
5. ✅ User feedback and polish

---

## Security Considerations

1. **Authentication**
   - Admin-only access (check user role)
   - Require authentication token

2. **File Validation**
   - File size limits
   - File type validation
   - Malicious file detection

3. **Rate Limiting**
   - Prevent abuse
   - Limit concurrent uploads

4. **Error Messages**
   - Don't expose sensitive database info
   - Sanitize error messages

---

## Next Steps

1. Create API endpoint for file upload
2. Create admin page component
3. Build upload UI components
4. Add authentication/authorization
5. Test with real shapefiles and GeoJSON files

---

## Dependencies

**Backend:**
- `shapefile` npm package (already installed)
- `adm-zip` or `yauzl` for ZIP extraction
- `@supabase/supabase-js` (already installed)

**Frontend:**
- Material UI components (already in stack)
- File upload library (or native HTML5)
- Progress indicators

---

## Notes

- Reuse logic from `scripts/load-shapefiles-to-supabase.ts`
- Follow existing patterns from `/api/import-redfin` route
- Use Material UI for consistent design
- Consider adding file size limits (e.g., 100MB max)
- Add ability to cancel uploads in progress

