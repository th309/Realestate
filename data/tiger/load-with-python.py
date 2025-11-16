#!/usr/bin/env python3
"""
Alternative loader using Python and GeoPandas
Supports both shapefiles (.shp) and GeoJSON files (.geojson, .json)
Requires: pip install geopandas psycopg2 sqlalchemy
"""

import os
import sys
from pathlib import Path
import geopandas as gpd
from sqlalchemy import create_engine
from sqlalchemy.types import Geometry
import getpass

# Configuration
PROJECT_REF = "pysflbhpnqwoczyuaaif"
DB_HOST = f"db.{PROJECT_REF}.supabase.co"
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PORT = "5432"

def get_connection_string():
    """Get database connection string"""
    password = getpass.getpass("Enter Supabase database password: ")
    return f"postgresql://{DB_USER}:{password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def load_geographic_file(engine, filepath, table_name, geoid_field="GEOID"):
    """Load a shapefile or GeoJSON file into PostgreSQL
    
    For shapefiles: GeoPandas automatically reads all component files (.shp, .shx, .dbf, .prj)
    Make sure all files from the unzipped shapefile are in the same directory.
    """
    file_ext = Path(filepath).suffix.lower()
    file_type = "GeoJSON" if file_ext in ['.geojson', '.json'] else "Shapefile"
    print(f"Loading {file_type}: {Path(filepath).name} → {table_name}...")
    
    # For shapefiles, verify required component files exist
    if file_ext == '.shp':
        base_path = Path(filepath).with_suffix('')
        required_files = {
            'shx': base_path.with_suffix('.shx'),  # Index file
            'dbf': base_path.with_suffix('.dbf')   # Attribute data
        }
        missing = [f"{ext.upper()}" for ext, path in required_files.items() if not path.exists()]
        if missing:
            print(f"  ⚠ Warning: Missing shapefile component files: {', '.join(missing)}")
            print(f"     Shapefiles require .shp, .shx, and .dbf files in the same directory.")
    
    try:
        # GeoPandas automatically reads all shapefile component files (.shp, .shx, .dbf, .prj)
        # Just point to the .shp file and it finds the others
        gdf = gpd.read_file(filepath)
        
        # Ensure geometry column is named 'geometry'
        if 'geometry' not in gdf.columns:
            gdf = gdf.rename_columns({gdf.geometry.name: 'geometry'})
        
        # Set CRS to WGS84 if not already
        if gdf.crs is None:
            gdf.set_crs('EPSG:4326', inplace=True)
        elif gdf.crs.to_string() != 'EPSG:4326':
            gdf.to_crs('EPSG:4326', inplace=True)
        
        # Load to database
        gdf.to_postgis(
            table_name,
            engine,
            if_exists='replace',
            index=False,
            dtype={'geometry': Geometry('GEOMETRY', srid=4326)}
        )
        
        print(f"  ✓ Loaded {len(gdf)} records")
        return True
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    """Main loading function"""
    print("=" * 60)
    print("  Load TIGER Shapefiles to Supabase (Python)")
    print("=" * 60)
    print()
    
    # Get connection
    conn_str = get_connection_string()
    engine = create_engine(conn_str)
    
    # Get directories
    script_dir = Path(__file__).parent
    tiger_dir = script_dir
    
    loaded = 0
    failed = 0
    
    # Load national files
    files_to_load = [
        ("tl_2024_us_state.shp", "tiger_states", "GEOID"),
        ("tl_2024_us_county.shp", "tiger_counties", "GEOID"),
        ("tl_2024_us_cbsa.shp", "tiger_cbsa", "GEOID"),
        ("tl_2024_us_zcta520.shp", "tiger_zcta", "GEOID20"),
    ]
    
    print("Loading national-level files...")
    print()
    
    for filename, table_name, geoid_field in files_to_load:
        filepath = tiger_dir / filename
        if filepath.exists():
            if load_geographic_file(engine, filepath, table_name, geoid_field):
                loaded += 1
            else:
                failed += 1
        else:
            # Try GeoJSON version if shapefile not found
            geojson_path = tiger_dir / filename.replace('.shp', '.geojson')
            if geojson_path.exists():
                print(f"  Shapefile not found, trying GeoJSON: {geojson_path.name}")
                if load_geographic_file(engine, geojson_path, table_name, geoid_field):
                    loaded += 1
                else:
                    failed += 1
            else:
                print(f"  ⚠ File not found: {filename} (tried .shp and .geojson)")
                failed += 1
    
    # Load places (merge all state files)
    print()
    print("Loading places (this may take a while)...")
    place_files = sorted(tiger_dir.glob("tl_2024_*_place.shp"))
    
    if place_files:
        print(f"  Found {len(place_files)} place files")
        
        # Load first file to create table
        if load_geographic_file(engine, place_files[0], "tiger_places", "GEOID"):
            loaded += 1
            
            # Append remaining files
            for place_file in place_files[1:]:
                print(f"  Appending {place_file.name}...")
                try:
                    # GeoPandas can read both shapefiles and GeoJSON
                    gdf = gpd.read_file(place_file)
                    if gdf.crs and gdf.crs.to_string() != 'EPSG:4326':
                        gdf.to_crs('EPSG:4326', inplace=True)
                    
                    gdf.to_postgis(
                        "tiger_places",
                        engine,
                        if_exists='append',
                        index=False,
                        dtype={'geometry': Geometry('GEOMETRY', srid=4326)}
                    )
                    print(f"    ✓ Appended {len(gdf)} records")
                    loaded += 1
                except Exception as e:
                    print(f"    ✗ Error: {e}")
                    failed += 1
        else:
            failed += 1
    
    # Summary
    print()
    print("=" * 60)
    print("  Summary")
    print("=" * 60)
    print(f"✓ Loaded: {loaded} file(s)")
    if failed > 0:
        print(f"✗ Failed: {failed} file(s)")
    print()
    print("Next: Run SQL to update GEOID fields and extract names")
    print()

if __name__ == "__main__":
    main()

