/**
 * Download Zillow Research Data
 * 
 * Downloads CSV files from Zillow's research data repository and optionally imports them.
 * 
 * Usage:
 *   npx tsx scripts/download-zillow-data.ts --dataset zhvi-metro-all-homes-sm-sa
 *   npx tsx scripts/download-zillow-data.ts --category "HOME VALUES" --geography Metro
 *   npx tsx scripts/download-zillow-data.ts --list
 *   npx tsx scripts/download-zillow-data.ts --all
 */

import axios from 'axios';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

// Import from web directory - adjust path if needed
let ZILLOW_DATASETS: any[];
let getDatasetsByCategory: any;
let getDatasetsByGeography: any;
let getDatasetsByType: any;
let getDatasetById: any;
let getCategories: any;
let getGeographies: any;
let getDatasetTypes: any;
let buildZillowUrl: any;

try {
  // Try to import from web directory
  const zillowDatasets = require('../web/lib/data-ingestion/sources/zillow-datasets');
  ZILLOW_DATASETS = zillowDatasets.ZILLOW_DATASETS;
  getDatasetsByCategory = zillowDatasets.getDatasetsByCategory;
  getDatasetsByGeography = zillowDatasets.getDatasetsByGeography;
  getDatasetsByType = zillowDatasets.getDatasetsByType;
  getDatasetById = zillowDatasets.getDatasetById;
  getCategories = zillowDatasets.getCategories;
  getGeographies = zillowDatasets.getGeographies;
  getDatasetTypes = zillowDatasets.getDatasetTypes;
  buildZillowUrl = zillowDatasets.buildZillowUrl;
} catch (error) {
  console.error('❌ Could not import zillow-datasets. Make sure you are running from the project root.');
  console.error('   Error:', error);
  process.exit(1);
}

const DATA_DIR = join(__dirname, '../data/zillow');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

interface DownloadOptions {
  datasetId?: string;
  category?: string;
  geography?: string;
  datasetType?: string;
  list?: boolean;
  all?: boolean;
  outputDir?: string;
  import?: boolean;
  limit?: number;
}

interface ZillowDatasetConfig {
  id: string;
  category: string;
  dataType: string;
  geography: string;
  downloadUrl: string;
  description: string;
}

/**
 * Download a single Zillow dataset
 */
async function downloadDataset(
  config: ZillowDatasetConfig,
  outputDir: string = DATA_DIR
): Promise<{ success: boolean; filePath?: string; error?: string; rowCount?: number }> {
  console.log(`\n📥 Downloading: ${config.id}`);
  console.log(`   URL: ${config.downloadUrl}`);
  console.log(`   Description: ${config.description}`);
  
  try {
    // Download the CSV
    const response = await axios.get(config.downloadUrl, {
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024, // 100MB max
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const csvContent = response.data;
    const sizeKB = (csvContent.length / 1024).toFixed(1);
    console.log(`   ✅ Downloaded ${sizeKB} KB`);
    
    // Parse CSV to count rows
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    console.log(`   📊 Found ${records.length} rows`);
    
    // Save to file
    const filename = `${config.id}.csv`;
    const filePath = join(outputDir, filename);
    writeFileSync(filePath, csvContent, 'utf-8');
    console.log(`   💾 Saved to: ${filePath}`);
    
    return {
      success: true,
      filePath,
      rowCount: records.length
    };
    
  } catch (error: any) {
    const errorMsg = error.response?.status === 404
      ? 'File not found (404) - URL may be incorrect or data not available'
      : error.message;
    
    console.error(`   ❌ Error: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg
    };
  }
}

/**
 * List all available datasets
 */
function listDatasets() {
  console.log('\n📋 Available Zillow Datasets');
  console.log('================================\n');
  
  const categories = getCategories();
  
  categories.forEach(category => {
    console.log(`\n📁 ${category}`);
    console.log('─'.repeat(50));
    
    const datasets = getDatasetsByCategory(category);
    datasets.forEach((dataset, index) => {
      console.log(`  ${index + 1}. ${dataset.id}`);
      console.log(`     Geography: ${dataset.geography}`);
      console.log(`     Type: ${dataset.dataType.substring(0, 60)}...`);
      console.log(`     URL: ${dataset.downloadUrl}`);
      console.log('');
    });
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total datasets: ${ZILLOW_DATASETS.length}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Geographies: ${getGeographies().join(', ')}`);
  console.log(`   Dataset types: ${getDatasetTypes().join(', ')}`);
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  const options: DownloadOptions = {
    outputDir: DATA_DIR
  };
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--list' || arg === '-l') {
      options.list = true;
    } else if (arg === '--all' || arg === '-a') {
      options.all = true;
    } else if (arg === '--dataset' || arg === '-d') {
      options.datasetId = args[++i];
    } else if (arg === '--category' || arg === '-c') {
      options.category = args[++i];
    } else if (arg === '--geography' || arg === '-g') {
      options.geography = args[++i];
    } else if (arg === '--type' || arg === '-t') {
      options.datasetType = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.outputDir = args[++i];
    } else if (arg === '--import' || arg === '-i') {
      options.import = true;
    } else if (arg === '--limit') {
      options.limit = parseInt(args[++i]);
    }
  }
  
  // List datasets if requested
  if (options.list) {
    listDatasets();
    return;
  }
  
  // Determine which datasets to download
  let datasetsToDownload: ZillowDatasetConfig[] = [];
  
  if (options.all) {
    datasetsToDownload = ZILLOW_DATASETS;
  } else if (options.datasetId) {
    const dataset = getDatasetById(options.datasetId);
    if (!dataset) {
      console.error(`❌ Dataset not found: ${options.datasetId}`);
      console.log('\nUse --list to see available datasets');
      process.exit(1);
    }
    datasetsToDownload = [dataset];
  } else if (options.category || options.geography || options.datasetType) {
    let filtered = ZILLOW_DATASETS;
    
    if (options.category) {
      filtered = filtered.filter(d => d.category === options.category);
    }
    if (options.geography) {
      filtered = filtered.filter(d => d.geography === options.geography);
    }
    if (options.datasetType) {
      filtered = filtered.filter(d => d.datasetType === options.datasetType);
    }
    
    datasetsToDownload = filtered;
    
    if (datasetsToDownload.length === 0) {
      console.error('❌ No datasets match the specified criteria');
      process.exit(1);
    }
  } else {
    console.error('❌ Please specify a dataset to download');
    console.log('\nUsage:');
    console.log('  --list                    List all available datasets');
    console.log('  --all                     Download all datasets');
    console.log('  --dataset <id>            Download specific dataset by ID');
    console.log('  --category <name>         Download all datasets in category');
    console.log('  --geography <name>        Download all datasets for geography');
    console.log('  --type <name>             Download all datasets of type');
    console.log('  --output <dir>            Output directory (default: data/zillow)');
    console.log('\nExamples:');
    console.log('  npx tsx scripts/download-zillow-data.ts --list');
    console.log('  npx tsx scripts/download-zillow-data.ts --dataset zhvi-metro-all-homes-sm-sa');
    console.log('  npx tsx scripts/download-zillow-data.ts --category "HOME VALUES" --geography Metro');
    process.exit(1);
  }
  
  console.log(`\n🚀 Downloading ${datasetsToDownload.length} dataset(s)...`);
  console.log('='.repeat(60));
  
  const results = [];
  let successCount = 0;
  let errorCount = 0;
  let totalRows = 0;
  
  // Limit if specified
  const datasets = options.limit
    ? datasetsToDownload.slice(0, options.limit)
    : datasetsToDownload;
  
  for (const dataset of datasets) {
    const result = await downloadDataset(dataset, options.outputDir);
    results.push({ dataset: dataset.id, ...result });
    
    if (result.success) {
      successCount++;
      totalRows += result.rowCount || 0;
    } else {
      errorCount++;
    }
    
    // Add delay between downloads to be respectful
    if (datasets.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Download Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📊 Total rows downloaded: ${totalRows.toLocaleString()}`);
  
  if (errorCount > 0) {
    console.log('\n❌ Failed downloads:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   ${r.dataset}: ${r.error}`);
      });
  }
  
  // Import if requested
  if (options.import && successCount > 0) {
    console.log('\n🔄 Import functionality would be called here');
    console.log('   (Use the existing importZillowData function from zillow-v2.ts)');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

