/**
 * Analyze Zillow CSV Structure
 * This script downloads a sample Zillow CSV to understand its exact structure
 */

import axios from 'axios'
import { parse as parseSync } from 'csv-parse/sync'

export async function analyzeZillowStructure() {
  console.log('=== ANALYZING ZILLOW DATA STRUCTURE ===\n')
  
  // Download a sample CSV
  const url = 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv'
  
  console.log('Downloading sample from:', url)
  const response = await axios.get(url, {
    timeout: 30000,
    maxContentLength: 50 * 1024 * 1024
  })
  
  // Parse CSV
  const records = parseSync(response.data, {
    columns: true,
    skip_empty_lines: true
  })
  
  console.log(`\nTotal Records: ${records.length}`)
  console.log('\n=== FIRST RECORD STRUCTURE ===')
  
  const firstRecord = records[0]
  console.log('\nMETADATA COLUMNS:')
  const metadataColumns: string[] = []
  const dateColumns: string[] = []
  
  for (const [key, value] of Object.entries(firstRecord)) {
    // Check if it's a date column (YYYY-MM-DD format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      dateColumns.push(key)
    } else {
      metadataColumns.push(key)
      console.log(`  ${key}: ${value} (type: ${typeof value})`)
    }
  }
  
  console.log(`\nDATE COLUMNS: ${dateColumns.length} columns`)
  console.log(`  First date: ${dateColumns[0]}`)
  console.log(`  Last date: ${dateColumns[dateColumns.length - 1]}`)
  console.log(`  Sample values: ${dateColumns.slice(0, 3).map(d => `${d}: ${firstRecord[d]}`).join(', ')}`)
  
  console.log('\n=== SAMPLE RECORDS ===')
  for (let i = 0; i < Math.min(5, records.length); i++) {
    const record = records[i]
    console.log(`\nRecord ${i + 1}:`)
    for (const col of metadataColumns) {
      console.log(`  ${col}: ${record[col]}`)
    }
    // Show last 3 months of data
    const recentDates = dateColumns.slice(-3)
    console.log(`  Recent values: ${recentDates.map(d => `${d}: ${record[d]}`).join(', ')}`)
  }
  
  console.log('\n=== UNIQUE VALUES IN KEY COLUMNS ===')
  
  // Analyze RegionType values
  const regionTypes = new Set(records.map((r: any) => r.RegionType))
  console.log(`\nRegionType values: ${Array.from(regionTypes).join(', ')}`)
  
  // Analyze StateName values (sample)
  const stateNames = new Set(records.slice(0, 50).map((r: any) => r.StateName))
  console.log(`\nStateName samples: ${Array.from(stateNames).slice(0, 10).join(', ')}`)
  
  // Analyze RegionName format
  console.log('\nRegionName format samples:')
  for (let i = 0; i < 5; i++) {
    console.log(`  ${records[i].RegionName}`)
  }
  
  return {
    metadataColumns,
    dateColumns,
    sampleRecords: records.slice(0, 5),
    regionTypes: Array.from(regionTypes),
    totalRecords: records.length
  }
}

// Run if called directly
if (require.main === module) {
  analyzeZillowStructure().then(result => {
    console.log('\n=== ANALYSIS COMPLETE ===')
    console.log(JSON.stringify(result, null, 2))
  }).catch(console.error)
}
