/**
 * Redfin Manifest-Based Importer
 * 
 * Reads manifest.json created by redfin-discovery.py and imports files
 * directly from S3 URLs without needing browser automation.
 */

import axios from 'axios'
import * as fs from 'fs/promises'
import * as path from 'path'
import { importRedfinData } from './redfin'

export interface RedfinManifestFile {
  url: string
  filename: string
  category: string
  metric_name: string
  source_page: string
  discovered_at: string
}

export interface RedfinManifest {
  version: string
  scanned_at: string
  pages_scanned: string[]
  total_files: number
  files: RedfinManifestFile[]
}

/**
 * Read manifest.json file
 */
export async function readRedfinManifest(manifestPath?: string): Promise<RedfinManifest> {
  const defaultPath = path.join(process.cwd(), 'redfin_downloads', 'manifest.json')
  const filePath = manifestPath || defaultPath

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const manifest: RedfinManifest = JSON.parse(content)
    return manifest
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Manifest file not found at ${filePath}. ` +
        `Please run scripts/redfin-discovery.py first to generate the manifest.`
      )
    }
    throw new Error(`Failed to read manifest: ${error.message}`)
  }
}

/**
 * Import all files from manifest
 */
export async function importAllFromManifest(
  manifestPath?: string,
  options?: {
    category?: string
    limit?: number
    skipExisting?: boolean
  }
) {
  const manifest = await readRedfinManifest(manifestPath)
  
  let filesToImport = manifest.files

  // Filter by category if specified
  if (options?.category) {
    filesToImport = filesToImport.filter(f => f.category === options.category)
  }

  // Apply limit if specified
  if (options?.limit) {
    filesToImport = filesToImport.slice(0, options.limit)
  }

  console.log(`\n📦 Importing ${filesToImport.length} files from manifest`)
  console.log('=' .repeat(60))

  const results = {
    total: filesToImport.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ file: string; error: string }>
  }

  for (const [index, file] of filesToImport.entries()) {
    console.log(`\n[${index + 1}/${filesToImport.length}] Importing: ${file.filename}`)
    console.log(`   Category: ${file.category}`)
    console.log(`   URL: ${file.url}`)

    try {
      // Download file directly from S3
      const response = await axios.get(file.url, {
        timeout: 120000, // 2 minutes
        maxContentLength: 100 * 1024 * 1024, // 100MB max
        responseType: 'text',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RealEstateDataImporter/1.0)'
        }
      })

      const csvContent = response.data

      // Import using existing import function
      const result = await importRedfinData(
        file.metric_name,
        undefined, // no row limit
        csvContent, // provide CSV content directly
        file.url // original URL for reference
      )

      if (result.success) {
        results.successful++
        console.log(`   ✅ Success: ${result.details.marketsCreated} markets, ${result.details.timeSeriesInserted} time series records`)
      } else {
        results.failed++
        results.errors.push({
          file: file.filename,
          error: result.message
        })
        console.log(`   ❌ Failed: ${result.message}`)
      }
    } catch (error: any) {
      results.failed++
      const errorMsg = error.message || 'Unknown error'
      results.errors.push({
        file: file.filename,
        error: errorMsg
      })
      console.error(`   ❌ Error: ${errorMsg}`)
    }

    // Small delay between imports to avoid rate limiting
    if (index < filesToImport.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Import Summary:')
  console.log(`   Total: ${results.total}`)
  console.log(`   ✅ Successful: ${results.successful}`)
  console.log(`   ❌ Failed: ${results.failed}`)
  if (results.errors.length > 0) {
    console.log('\n   Errors:')
    results.errors.forEach(({ file, error }) => {
      console.log(`     - ${file}: ${error}`)
    })
  }

  return results
}

/**
 * Get manifest summary
 */
export async function getManifestSummary(manifestPath?: string) {
  const manifest = await readRedfinManifest(manifestPath)

  const byCategory: Record<string, number> = {}
  for (const file of manifest.files) {
    byCategory[file.category] = (byCategory[file.category] || 0) + 1
  }

  return {
    scanned_at: manifest.scanned_at,
    total_files: manifest.total_files,
    by_category: byCategory,
    categories: Object.keys(byCategory),
    files: manifest.files.map(f => ({
      filename: f.filename,
      category: f.category,
      metric_name: f.metric_name,
      url: f.url
    }))
  }
}

