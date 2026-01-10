/**
 * Download Redfin S3 files without importing
 * Just downloads and saves them locally for inspection
 */

import axios from 'axios'
import * as zlib from 'zlib'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import { pipeline } from 'stream/promises'

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
 * Download and save a file from S3 using streaming for large files
 */
async function downloadFile(dataset: RedfinDataset, outputDir: string): Promise<void> {
  const outputPath = path.join(outputDir, `${dataset.name}.${dataset.format}`)
  const tempGzPath = dataset.compressed ? path.join(outputDir, `${dataset.name}.tmp.gz`) : null
  
  console.log(`\n📥 Downloading: ${dataset.description}`)
  console.log(`   URL: ${dataset.url}`)
  console.log(`   Size: ${dataset.compressed ? 'Compressed' : 'Uncompressed'}`)
  
  try {
    // For large files, use streaming to avoid memory issues
    const response = await axios.get(dataset.url, {
      timeout: 1800000, // 30 minutes for very large files
      maxContentLength: Infinity,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RealEstateDataImporter/1.0)',
        'Accept-Encoding': 'gzip, deflate'
      }
    })

    const totalSize = parseInt(response.headers['content-length'] || '0')
    let downloadedSize = 0
    
    // Track download progress
    response.data.on('data', (chunk: Buffer) => {
      downloadedSize += chunk.length
      if (totalSize > 0) {
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1)
        const loadedMB = (downloadedSize / 1024 / 1024).toFixed(2)
        const totalMB = (totalSize / 1024 / 1024).toFixed(2)
        process.stdout.write(`\r   Progress: ${percent}% (${loadedMB} MB / ${totalMB} MB)`)
      }
    })

    // Stream to file
    if (dataset.compressed || dataset.url.endsWith('.gz')) {
      // Save compressed file first, then decompress
      const writeStream = fs.createWriteStream(tempGzPath!)
      await pipeline(response.data, writeStream)
      console.log(`\n   ✅ Downloaded ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`)
      
      // Now decompress using streaming
      console.log(`   🔓 Decompressing...`)
      const readStream = fs.createReadStream(tempGzPath!)
      const gunzipStream = zlib.createGunzip()
      const writeDecompressed = fs.createWriteStream(outputPath)
      
      let decompressedSize = 0
      gunzipStream.on('data', (chunk: Buffer) => {
        decompressedSize += chunk.length
        if (decompressedSize % (100 * 1024 * 1024) === 0) { // Log every 100MB
          process.stdout.write(`\r   Decompressing: ${(decompressedSize / 1024 / 1024).toFixed(2)} MB`)
        }
      })
      
      await pipeline(readStream, gunzipStream, writeDecompressed)
      console.log(`\n   ✅ Decompressed to ${(decompressedSize / 1024 / 1024).toFixed(2)} MB`)
      
      // Clean up temp file
      fs.unlinkSync(tempGzPath!)
    } else {
      // Not compressed, write directly
      const writeStream = fs.createWriteStream(outputPath)
      await pipeline(response.data, writeStream)
      console.log(`\n   ✅ Downloaded ${(downloadedSize / 1024 / 1024).toFixed(2)} MB`)
    }
    
    console.log(`   💾 Saved to: ${outputPath}`)
    
    // Create a sample file (first 1000 lines) for quick inspection
    console.log(`   📄 Creating sample file...`)
    const samplePath = path.join(outputDir, `${dataset.name}.sample.txt`)
    const readStream = fs.createReadStream(outputPath, { encoding: 'utf-8' })
    const writeSample = fs.createWriteStream(samplePath, { encoding: 'utf-8' })
    
    let lineCount = 0
    let buffer = ''
    
    readStream.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (lineCount < 1000) {
          writeSample.write(line + '\n')
          lineCount++
        } else {
          readStream.destroy()
          writeSample.end()
          return
        }
      }
    })
    
    readStream.on('end', () => {
      if (lineCount < 1000 && buffer) {
        writeSample.write(buffer)
      }
      writeSample.end()
    })
    
    await new Promise<void>((resolve, reject) => {
      writeSample.on('finish', () => {
        console.log(`   ✅ Sample saved to: ${samplePath}`)
        resolve()
      })
      writeSample.on('error', reject)
    })
    
  } catch (error: any) {
    // Clean up temp file if it exists
    if (tempGzPath && fs.existsSync(tempGzPath)) {
      fs.unlinkSync(tempGzPath)
    }
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
  let datasets: RedfinDataset[] = manifest.datasets || []
  
  // Filter: Only monthly data (exclude weekly), and only county, city, zip code
  datasets = datasets.filter(d => {
    const isMonthly = d.category === 'housing_market' // Exclude 'weekly' category
    const isTargetLevel = ['county', 'city', 'zip'].includes(d.geographic_level)
    return isMonthly && isTargetLevel
  })
  
  console.log(`\n📦 Downloading ${datasets.length} Redfin monthly datasets (county, city, zip code only)`)
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

