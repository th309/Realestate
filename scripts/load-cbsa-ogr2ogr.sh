#!/bin/bash
# Load CBSA shapefile into PostgreSQL using ogr2ogr
# Usage: ./load-cbsa-ogr2ogr.sh

# Load environment variables
if [ -f "../web/.env.local" ]; then
    export $(grep -v '^#' ../web/.env.local | xargs)
fi

# Get Supabase URL
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
if [ -z "$SUPABASE_URL" ]; then
    echo "Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local"
    exit 1
fi

# Extract project reference
PROJECT_REF=$(echo $SUPABASE_URL | sed -n 's|https://\([^.]*\)\.supabase\.co|\1|p')
if [ -z "$PROJECT_REF" ]; then
    echo "Error: Could not parse Supabase URL: $SUPABASE_URL"
    exit 1
fi

echo "Supabase Project: $PROJECT_REF"
echo ""
echo "Enter your Supabase database password:"
read -s DB_PASSWORD

# Connection parameters
HOST="db.${PROJECT_REF}.supabase.co"
DBNAME="postgres"
USER="postgres"
PORT="5432"
SHAPEFILE="shapefiles/tl_2024_us_cbsa.shp"
TABLE_NAME="dim_geography_geometry_staging"

# Construct connection string
CONNECTION_STRING="PG:host=${HOST} dbname=${DBNAME} user=${USER} password=${DB_PASSWORD} port=${PORT} sslmode=require"

# Check if shapefile exists
if [ ! -f "$SHAPEFILE" ]; then
    echo "Error: Shapefile not found: $SHAPEFILE"
    exit 1
fi

echo ""
echo "Loading CBSA shapefile into PostgreSQL..."
echo "  Shapefile: $SHAPEFILE"
echo "  Table: $TABLE_NAME"
echo ""

# Run ogr2ogr
ogr2ogr -f PostgreSQL \
  "$CONNECTION_STRING" \
  "$SHAPEFILE" \
  -nln "$TABLE_NAME" \
  -nlt PROMOTE_TO_MULTI \
  -lco GEOMETRY_NAME=geom \
  -t_srs EPSG:4326 \
  -overwrite

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully loaded CBSA shapefile into $TABLE_NAME"
    echo ""
    echo "Next steps:"
    echo "1. Verify: SELECT COUNT(*) FROM $TABLE_NAME;"
    echo "2. Map GEOID to dim_geography and copy geometries"
else
    echo ""
    echo "❌ ogr2ogr failed"
    exit 1
fi








