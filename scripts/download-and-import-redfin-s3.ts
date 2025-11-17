/**
 * Download and import Redfin data from S3 URLs
 * Handles gzipped files and imports directly into the database
 */

import axios from 'axios'
import * as zlib from 'zlib'
import * as util from 'util'
import { promisify } from 'util'
// Import from web directory using dynamic imports
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Dynamic imports - will be loaded at runtime
let importRedfinData: any
let discoverRedfinS3Datasets: any

const gunzip = promisify(zlib.gunzip)

interface ImportOptions {
  category?: string
  geographicLevel?: string
  limit?: number
  skipExisting?: boolean
}

/**
 * Download and decompress a file from S3
 */
async function downloadAndDecompress(url: string): Promise<string> {
  console.log(`  📥 Downloading from: ${url}`)
  
  const response = await axios.get(url, {
    timeout: 300000, // 5 minutes for large files
    maxContentLength: 500 * 1024 * 1024, // 500MB max
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RealEstateDataImporter/1.0)',
      'Accept-Encoding': 'gzip, deflate'
    }
  })

  const buffer = Buffer.from(response.data)
  
  // Check if file is gzipped
  if (url.endsWith('.gz') || buffer[0] === 0x1f && buffer[1] === 0x8b) {
    console.log(`  🔓 Decompressing gzip file...`)
    const decompressed = await gunzip(buffer)
    return decompressed.toString('utf-8')
  } else {
    // Try to decode as UTF-8
    return buffer.toString('utf-8')
  }
}

/**
 * Determine metric name from dataset
 */
function getMetricName(dataset: { category: string; geographicLevel: string; description: string }): string {
  // For market tracker files, they contain multiple metrics
  // We'll use auto-detection by passing empty string
  if (dataset.category === 'housing_market' || dataset.category === 'weekly') {
    return '' // Auto-detect all metrics
  }
  
  // For specific categories, use category name
  return dataset.category
}

/**
 * Import a single dataset from S3
 */
async function importDataset(
  dataset: { url: string; description: string; category: string; geographicLevel: string },
  options?: { limitRows?: number }
): Promise<{ success: boolean; message: string; details?: any }> {
  // Ensure modules are loaded
  if (!importRedfinData) {
    const redfinModule = await import('../web/lib/data-ingestion/sources/redfin.js')
    importRedfinData = redfinModule.importRedfinData
  }
  
  try {
    console.log(`\n📊 Importing: ${dataset.description}`)
    console.log(`   Category: ${dataset.category}`)
    console.log(`   Geographic Level: ${dataset.geographicLevel}`)
    
    // Download and decompress
    const csvContent = await downloadAndDecompress(dataset.url)
    console.log(`   ✅ Downloaded ${(csvContent.length / 1024 / 1024).toFixed(2)} MB`)
    
    // Determine metric name
    const metricName = getMetricName(dataset)
    
    // Import using existing function
    const result = await importRedfinData(
      metricName,
      options?.limitRows,
      csvContent,
      dataset.url
    )
    
    if (result.success) {
      console.log(`   ✅ Import successful:`)
      console.log(`      - Markets created: ${result.details?.marketsCreated || 0}`)
      console.log(`      - Time series records: ${result.details?.timeSeriesInserted || 0}`)
    } else {
      console.log(`   ❌ Import failed: ${result.message}`)
    }
    
    return result
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error'
    console.error(`   ❌ Error: ${errorMsg}`)
    return {
      success: false,
      message: errorMsg
    }
  }
}

/**
 * Import all datasets from S3 manifest
 */
async function importAllFromS3(options?: ImportOptions) {
  // Load modules dynamically
  if (!importRedfinData || !discoverRedfinS3Datasets) {
    try {
      const redfinModule = await import('../web/lib/data-ingestion/sources/redfin.js')
      importRedfinData = redfinModule.importRedfinData
      
      const discoverModule = await import('./discover-redfin-s3-datasets.js')
      discoverRedfinS3Datasets = discoverModule.discoverRedfinS3Datasets
    } catch (error: any) {
      console.error('Failed to import modules:', error.message)
      throw new Error('Failed to load required modules. Make sure you are running from the project root.')
    }
  }
  
  console.log('🔍 Discovering Redfin S3 datasets...\n')
  
  // Discover datasets
  const datasets = await discoverRedfinS3Datasets()
  
  // Filter datasets
  let datasetsToImport = datasets
  
  if (options?.category) {
    datasetsToImport = datasetsToImport.filter(d => d.category === options.category)
    console.log(`📋 Filtering by category: ${options.category}`)
  }
  
  if (options?.geographicLevel) {
    datasetsToImport = datasetsToImport.filter(d => d.geographicLevel === options.geographicLevel)
    console.log(`📋 Filtering by geographic level: ${options.geographicLevel}`)
  }
  
  if (options?.limit) {
    datasetsToImport = datasetsToImport.slice(0, options.limit)
    console.log(`📋 Limiting to ${options.limit} datasets`)
  }
  
  console.log(`\n📦 Importing ${datasetsToImport.length} datasets\n`)
  console.log('='.repeat(60))
  
  const results = {
    total: datasetsToImport.length,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ dataset: string; error: string }>
  }
  
  for (const [index, dataset] of datasetsToImport.entries()) {
    console.log(`\n[${index + 1}/${datasetsToImport.length}]`)
    
    const result = await importDataset(dataset, {
      limitRows: options?.limit
    })
    
    if (result.success) {
      results.successful++
    } else {
      results.failed++
      results.errors.push({
        dataset: dataset.description,
        error: result.message
      })
    }
    
    // Small delay between imports
    if (index < datasetsToImport.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 Import Summary:')
  console.log(`   Total: ${results.total}`)
  console.log(`   ✅ Successful: ${results.successful}`)
  console.log(`   ❌ Failed: ${results.failed}`)
  
  if (results.errors.length > 0) {
    console.log('\n   Errors:')
    results.errors.forEach(({ dataset, error }) => {
      console.log(`     - ${dataset}: ${error}`)
    })
  }
  
  return results
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  
  const options: ImportOptions = {}
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--category' && args[i + 1]) {
      options.category = args[i + 1]
      i++
    } else if (args[i] === '--geographic-level' && args[i + 1]) {
      options.geographicLevel = args[i + 1]
      i++
    } else if (args[i] === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1])
      i++
    }
  }
  
  try {
    await importAllFromS3(options)
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

export { importAllFromS3, importDataset, downloadAndDecompress }

