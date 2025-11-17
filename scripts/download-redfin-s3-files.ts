/**
 * Download Redfin S3 files without importing
 * Just downloads and saves them locally for inspection
 */

import axios from 'axios'
import * as zlib from 'zlib'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

const gunzip = promisify(zlib.gunzip)

interface RedfinDataset {
  name: string
  description: string
  url: string
  category: string
  geographic_level: string
  format: string
  compressed: boolean
}

/**
 * Download and save a file from S3
 */
async function downloadFile(dataset: RedfinDataset, outputDir: string): Promise<void> {
  const outputPath = path.join(outputDir, `${dataset.name}.${dataset.format}`)
  
  console.log(`\n📥 Downloading: ${dataset.description}`)
  console.log(`   URL: ${dataset.url}`)
  console.log(`   Size: ${dataset.compressed ? 'Compressed' : 'Uncompressed'}`)
  
  try {
    const response = await axios.get(dataset.url, {
      timeout: 600000, // 10 minutes for large files
      maxContentLength: 3000 * 1024 * 1024, // 3GB max
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RealEstateDataImporter/1.0)',
        'Accept-Encoding': 'gzip, deflate'
      },
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = ((progressEvent.loaded / progressEvent.total) * 100).toFixed(1)
          const loadedMB = (progressEvent.loaded / 1024 / 1024).toFixed(2)
          const totalMB = (progressEvent.total / 1024 / 1024).toFixed(2)
          process.stdout.write(`\r   Progress: ${percent}% (${loadedMB} MB / ${totalMB} MB)`)
        }
      }
    })

    const buffer = Buffer.from(response.data)
    console.log(`\n   ✅ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
    
    // Decompress if needed
    let finalContent: Buffer
    if (dataset.compressed || dataset.url.endsWith('.gz') || (buffer[0] === 0x1f && buffer[1] === 0x8b)) {
      console.log(`   🔓 Decompressing...`)
      finalContent = await gunzip(buffer)
      console.log(`   ✅ Decompressed to ${(finalContent.length / 1024 / 1024).toFixed(2)} MB`)
    } else {
      finalContent = buffer
    }
    
    // Save to file
    fs.writeFileSync(outputPath, finalContent)
    console.log(`   💾 Saved to: ${outputPath}`)
    
    // Also save a sample (first 1000 lines) for quick inspection
    const samplePath = path.join(outputDir, `${dataset.name}.sample.txt`)
    const contentStr = finalContent.toString('utf-8')
    const lines = contentStr.split('\n').slice(0, 1000)
    fs.writeFileSync(samplePath, lines.join('\n'))
    console.log(`   📄 Sample saved to: ${samplePath}`)
    
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`)
    throw error
  }
}

/**
 * Main function
 */
async function main() {
  const manifestPath = path.join(process.cwd(), 'redfin_downloads', 's3-manifest.json')
  const outputDir = path.join(process.cwd(), 'redfin_downloads', 'raw_files')
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Load manifest
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ Manifest not found: ${manifestPath}`)
    console.error('   Run "npm run discover-redfin-s3" first')
    process.exit(1)
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const datasets: RedfinDataset[] = manifest.datasets || []
  
  console.log(`\n📦 Downloading ${datasets.length} Redfin datasets`)
  console.log(`   Output directory: ${outputDir}`)
  console.log('='.repeat(60))
  
  const results = {
    total: datasets.length,
    successful: 0,
    failed: 0,
    errors: [] as Array<{ dataset: string; error: string }>
  }
  
  for (const [index, dataset] of datasets.entries()) {
    console.log(`\n[${index + 1}/${datasets.length}]`)
    
    try {
      await downloadFile(dataset, outputDir)
      results.successful++
    } catch (error: any) {
      results.failed++
      results.errors.push({
        dataset: dataset.description,
        error: error.message
      })
    }
    
    // Small delay between downloads
    if (index < datasets.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 Download Summary:')
  console.log(`   Total: ${results.total}`)
  console.log(`   ✅ Successful: ${results.successful}`)
  console.log(`   ❌ Failed: ${results.failed}`)
  
  if (results.errors.length > 0) {
    console.log('\n   Errors:')
    results.errors.forEach(({ dataset, error }) => {
      console.log(`     - ${dataset}: ${error}`)
    })
  }
  
  console.log(`\n📁 Files saved to: ${outputDir}`)
  console.log(`📄 Sample files saved for quick inspection`)
}

main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

