# MSA FRED Series ID Verification Process

## Overview

This document outlines the recommended process for populating and verifying MSA FRED series IDs to ensure data quality and accuracy.

## The Problem

Not all MSAs have all FRED data available. Some MSAs may have:
- Unemployment data but not employment data
- GDP data but not income data
- Some fields available for larger MSAs but not smaller ones
- Incorrect series IDs that don't match the MSA

## Recommended Process

### Step 1: Initial Population

Run the population script to discover and populate series IDs:

```bash
cd "C:\Projects\Real Estate\web"
npx tsx ../scripts/populate-all-msa-fred-ids.ts --all
```

This will:
- Search FRED API for each MSA
- Find series IDs for all 5 fields
- Verify series IDs exist
- Update database with valid series IDs

**Note**: This takes 10-15 minutes for ~365 MSAs.

### Step 2: Verification

After population, verify all series IDs are correct:

```bash
# Verify all fields
npx tsx ../scripts/verify-msa-fred-ids.ts --all

# Or verify specific field
npx tsx ../scripts/verify-msa-fred-ids.ts --field=unemployment_rate
npx tsx ../scripts/verify-msa-fred-ids.ts --field=employment_total
npx tsx ../scripts/verify-msa-fred-ids.ts --field=gdp
```

This will:
- Verify each series ID exists in FRED
- Check that series title matches MSA name
- Verify series has recent data (within 2 years)
- Export results to CSV files

### Step 3: Review Results

Review the verification CSV files:
- `msa-fred-ids-verification-{timestamp}.csv` - All results
- `msa-fred-ids-issues-{timestamp}.csv` - Only issues (invalid, no data, mismatches)

Check for:
- Series IDs that don't match the MSA name
- Series IDs that exist but have no recent data
- Invalid series IDs that don't exist in FRED

### Step 4: Cleanup Invalid IDs

Remove invalid or mismatched series IDs:

```bash
# Dry run first (see what would be removed)
npx tsx ../scripts/cleanup-invalid-msa-fred-ids.ts --file=msa-fred-ids-issues-*.csv --dry-run

# Actually remove them
npx tsx ../scripts/cleanup-invalid-msa-fred-ids.ts --file=msa-fred-ids-issues-*.csv --execute
```

### Step 5: Manual Review for High-Priority MSAs

For top 50-100 MSAs by population, manually verify:
1. Check FRED website directly
2. Verify series IDs match expected data
3. Update any incorrect series IDs manually

### Step 6: Re-run Verification

After cleanup, re-run verification to confirm:

```bash
npx tsx ../scripts/verify-msa-fred-ids.ts --all
```

## Expected Results

Based on FRED data availability:

- **GDP**: ~90-95% of MSAs (consistent NGMP{CBSA_CODE} pattern)
- **Unemployment Rate**: ~80-85% of MSAs (varies by MSA size)
- **Employment Total**: ~80-85% of MSAs (varies by MSA size)
- **Housing Permits**: ~60-70% of MSAs (more common for larger MSAs)
- **Median Household Income**: ~20-30% of MSAs (rarely available at MSA level)

## Quality Checks

Before considering the process complete:

1. ✅ All series IDs exist in FRED
2. ✅ Series titles match MSA names
3. ✅ Series have recent data (within 2 years)
4. ✅ No duplicate series IDs across different MSAs
5. ✅ Top 50 MSAs by population have complete data where available

## Maintenance

Periodically re-verify series IDs:
- FRED may add new series
- Series IDs may change
- Data availability may improve

Run verification quarterly or when new MSAs are added.

