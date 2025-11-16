# Complete Setup Script for Geographic Relationship System
# This script orchestrates the entire process

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectRef = "pysflbhpnqwoczyuaaif"
)

$ErrorActionPreference = "Continue"

# Colors
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info "================================================"
Write-Info "   Geographic Relationship System Setup"
Write-Info "================================================"
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Step 1: Load shapefiles
Write-Info "STEP 1: Loading TIGER shapefiles..."
Write-Host "  Run: .\load-tiger-shapefiles.ps1 -ProjectRef $ProjectRef"
Write-Warning "  This requires ogr2ogr and database password"
Write-Host ""

$continue = Read-Host "Have you loaded the shapefiles? (y/n)"
if ($continue -ne 'y') {
    Write-Info "Please run load-tiger-shapefiles.ps1 first, then run this script again."
    exit 0
}

# Step 2: Update GEOID fields and extract names
Write-Info "STEP 2: Updating GEOID fields and extracting names..."
Write-Host "  This will be done via SQL..."
Write-Host ""

# Step 3: Create junction tables
Write-Info "STEP 3: Creating junction tables..."
Write-Host "  Running: build-geographic-relationships.sql (Step 1)"
Write-Host ""

# Step 4: Calculate relationships
Write-Info "STEP 4: Calculating spatial relationships..."
Write-Warning "  This will take a LONG time (hours for full dataset)"
Write-Host "  Running: build-geographic-relationships.sql (Steps 2-8)"
Write-Host ""

# Step 5: Build hierarchy table
Write-Info "STEP 5: Building hierarchy table..."
Write-Host "  Running: build-geo-hierarchy-table.sql"
Write-Host ""

Write-Info "Ready to proceed with SQL execution."
Write-Host ""

