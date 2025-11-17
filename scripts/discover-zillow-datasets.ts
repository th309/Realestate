/**
 * Discover Zillow Research Data Datasets
 * 
 * This script analyzes the Zillow research data page to discover all available
 * CSV download URLs and their metadata.
 * 
 * Usage:
 *   npx tsx scripts/discover-zillow-datasets.ts
 */

/**
 * NOTE: This script requires jsdom which is not currently installed.
 * For now, use the URL builder in zillow-datasets.ts instead.
 * 
 * To use this script, install jsdom:
 *   npm install --save-dev jsdom @types/jsdom
 */

import axios from 'axios';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Uncomment if jsdom is installed:
// import { JSDOM } from 'jsdom';

const ZILLOW_DATA_URL = 'https://www.zillow.com/research/data/';

interface ZillowDataset {
  category: string;
  dataType: string;
  geography: string;
  downloadUrl: string;
  description?: string;
}

/**
 * Discover all available Zillow datasets from the research data page
 */
async function discoverZillowDatasets(): Promise<ZillowDataset[]> {
  console.log('🔍 Discovering Zillow datasets...');
  console.log(`📥 Fetching: ${ZILLOW_DATA_URL}`);
  console.log('⚠️  Note: This script requires jsdom. Using known patterns instead.');
  
  // For now, return empty array and use known patterns
  return [];
  
  /* Uncomment if jsdom is installed:
  try {
    // Fetch the page
    const response = await axios.get(ZILLOW_DATA_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.data;
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const datasets: ZillowDataset[] = [];
    
    // Find all download links
    const downloadLinks = document.querySelectorAll('a[href*="files.zillowstatic.com/research/public_csvs"]');
    
    console.log(`\n📊 Found ${downloadLinks.length} download links`);
    
    // Extract metadata from the page structure
    // The page has sections for different categories
    const categories = [
      'HOME VALUES',
      'HOME VALUES FORECASTS',
      'RENTALS',
      'RENTAL FORECASTS',
      'FOR-SALE LISTINGS',
      'SALES',
      'DAYS ON MARKET AND PRICE CUTS',
      'MARKET HEAT INDEX',
      'NEW CONSTRUCTION',
      'AFFORDABILITY'
    ];
    
    // Find all sections
    const sections = document.querySelectorAll('h2, h3, h4');
    
    let currentCategory = 'UNKNOWN';
    let currentSection: Element | null = null;
    
    sections.forEach((section) => {
      const text = section.textContent?.trim() || '';
      
      // Check if this is a category header
      const categoryMatch = categories.find(cat => 
        text.toUpperCase().includes(cat) || cat.includes(text.toUpperCase())
      );
      
      if (categoryMatch) {
        currentCategory = categoryMatch;
        currentSection = section;
        console.log(`\n📁 Category: ${currentCategory}`);
      }
    });
    
    // Process each download link
    downloadLinks.forEach((link, index) => {
      const url = link.getAttribute('href');
      if (!url) return;
      
      // Extract metadata from URL
      // Pattern: https://files.zillowstatic.com/research/public_csvs/{dataset}/{Geography}_{dataset}_...csv?t={timestamp}
      const urlMatch = url.match(/public_csvs\/([^\/]+)\/([^\/]+)\.csv/);
      
      if (urlMatch) {
        const datasetType = urlMatch[1]; // e.g., 'zhvi', 'zori', 'invt_fs'
        const filename = urlMatch[2]; // e.g., 'Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month'
        
        // Parse filename to extract geography and other attributes
        const parts = filename.split('_');
        const geography = parts[0]; // Metro, State, County, City, ZIP, National, etc.
        
        // Find the parent section to get data type
        let dataType = 'Unknown';
        let parent = link.parentElement;
        let depth = 0;
        
        while (parent && depth < 10) {
          // Look for combobox or select with data type
          const combobox = parent.querySelector('select, combobox');
          if (combobox) {
            const selectedOption = combobox.querySelector('option[selected]');
            if (selectedOption) {
              dataType = selectedOption.textContent?.trim() || 'Unknown';
              break;
            }
          }
          parent = parent.parentElement;
          depth++;
        }
        
        // Clean up URL (remove timestamp parameter for consistency)
        const cleanUrl = url.split('?')[0];
        
        datasets.push({
          category: currentCategory,
          dataType: dataType,
          geography: geography,
          downloadUrl: cleanUrl,
          description: `${datasetType} - ${geography}`
        });
        
        console.log(`  ${index + 1}. ${geography} - ${datasetType} - ${dataType.substring(0, 50)}...`);
      }
    });
    
    return datasets;
    
  } catch (error: any) {
    console.error('❌ Error discovering datasets:', error.message);
    throw error;
  }
  */
}

/**
 * Generate URL patterns based on known Zillow dataset structure
 */
function generateKnownUrlPatterns(): ZillowDataset[] {
  console.log('\n📋 Generating known URL patterns...');
  
  const datasets: ZillowDataset[] = [];
  
  // Define known patterns based on the page structure
  const patterns = {
    'HOME VALUES': {
      dataset: 'zhvi',
      geographies: ['Metro', 'State', 'County', 'City', 'ZIP', 'Neighborhood'],
      types: [
        { suffix: 'uc_sfrcondo_tier_0.33_0.67_sm_sa_month', name: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Smoothed, Seasonally Adjusted($)' },
        { suffix: 'uc_sfrcondo_tier_0.33_0.67_month', name: 'ZHVI All Homes (SFR, Condo/Co-op) Time Series, Raw, Mid-Tier ($)' },
        { suffix: 'uc_sfrcondo_tier_0.67_0.95_month', name: 'ZHVI All Homes- Top Tier Time Series ($)' },
        { suffix: 'uc_sfrcondo_tier_0.05_0.33_month', name: 'ZHVI All Homes- Bottom Tier Time Series ($)' },
        { suffix: 'uc_sfr_month', name: 'ZHVI Single-Family Homes Time Series ($)' },
        { suffix: 'uc_condo_month', name: 'ZHVI Condo/Co-op Time Series ($)' },
        { suffix: 'uc_1bedroom_month', name: 'ZHVI 1-Bedroom Time Series ($)' },
        { suffix: 'uc_2bedroom_month', name: 'ZHVI 2-Bedroom Time Series ($)' },
        { suffix: 'uc_3bedroom_month', name: 'ZHVI 3-Bedroom Time Series ($)' },
        { suffix: 'uc_4bedroom_month', name: 'ZHVI 4-Bedroom Time Series ($)' },
        { suffix: 'uc_5bedroom_month', name: 'ZHVI 5+ Bedroom Time Series ($)' }
      ]
    },
    'HOME VALUES FORECASTS': {
      dataset: 'zhvf_growth',
      geographies: ['Metro', 'ZIP'],
      types: [
        { suffix: 'uc_sfrcondo_tier_0.33_0.67_sm_sa_month', name: 'ZHVF (Forecast), All Homes (SFR, Condo/Co-op), Smoothed, Seasonally Adjusted, Mid-Tier (MoM%, QoQ%, YoY%)' },
        { suffix: 'uc_sfrcondo_tier_0.33_0.67_month', name: 'ZHVF (Forecast), All Homes (SFR, Condo/Co-op), Raw, Mid-Tier (MoM%, QoQ%, YoY%)' }
      ]
    },
    'RENTALS': {
      dataset: 'zori',
      geographies: ['Metro', 'ZIP', 'County', 'City'],
      types: [
        { suffix: 'uc_sfrcondomfr_sm_month', name: 'ZORI (Smoothed): All Homes Plus Multifamily Time Series ($)' },
        { suffix: 'uc_sfrcondomfr_sm_sa_month', name: 'ZORI (Smoothed, Seasonally Adjusted): All Homes Plus Multifamily Time Series ($)' },
        { suffix: 'uc_sfr_sm_month', name: 'ZORI (Smoothed): Single Family Residence Time Series ($)' },
        { suffix: 'uc_sfr_sm_sa_month', name: 'ZORI (Smoothed, Seasonally Adjusted): Single Family Residence Time Series ($)' },
        { suffix: 'uc_mfr_sm_month', name: 'ZORI (Smoothed): Multi Family Residence Time Series ($)' },
        { suffix: 'uc_mfr_sm_sa_month', name: 'ZORI (Smoothed, Seasonally Adjusted): Multi Family Residence Time Series ($)' }
      ]
    },
    'FOR-SALE LISTINGS': {
      dataset: 'invt_fs',
      geographies: ['Metro'],
      types: [
        { suffix: 'uc_sfrcondo_sm_month', name: 'For-Sale Inventory (Smooth, All Homes, Monthly)' },
        { suffix: 'uc_sfrcondo_sm_week', name: 'For-Sale Inventory (Smooth, All Homes, Weekly)' },
        { suffix: 'uc_sfr_sm_month', name: 'For-Sale Inventory (Smooth, SFR Only, Monthly)' },
        { suffix: 'uc_sfr_sm_week', name: 'For-Sale Inventory (Smooth, SFR Only, Weekly)' }
      ]
    },
    'SALES': {
      dataset: 'sales_count_now',
      geographies: ['Metro'],
      types: [
        { suffix: 'uc_sfrcondo_month', name: 'Sales Count (Nowcast, All Homes, Monthly)' }
      ]
    }
  };
  
  // Generate URLs for each pattern
  Object.entries(patterns).forEach(([category, config]) => {
    config.geographies.forEach(geo => {
      config.types.forEach(type => {
        const filename = `${geo}_${config.dataset}_${type.suffix}`;
        const url = `https://files.zillowstatic.com/research/public_csvs/${config.dataset}/${filename}.csv`;
        
        datasets.push({
          category,
          dataType: type.name,
          geography: geo,
          downloadUrl: url,
          description: `${config.dataset} - ${geo} - ${type.name}`
        });
      });
    });
  });
  
  console.log(`✅ Generated ${datasets.length} URL patterns`);
  
  return datasets;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Zillow Dataset Discovery Tool');
  console.log('================================\n');
  
  try {
    // Try to discover from the page
    let discoveredDatasets: ZillowDataset[] = [];
    
    try {
      discoveredDatasets = await discoverZillowDatasets();
    } catch (error) {
      console.warn('⚠️ Could not discover from page, using known patterns instead');
    }
    
    // Also generate known patterns
    const knownPatterns = generateKnownUrlPatterns();
    
    // Combine and deduplicate
    const allDatasets = [...discoveredDatasets, ...knownPatterns];
    const uniqueDatasets = Array.from(
      new Map(allDatasets.map(d => [d.downloadUrl, d])).values()
    );
    
    console.log(`\n📊 Total unique datasets: ${uniqueDatasets.length}`);
    
    // Save to JSON file
    const outputPath = join(__dirname, 'zillow-datasets.json');
    writeFileSync(outputPath, JSON.stringify(uniqueDatasets, null, 2));
    console.log(`\n💾 Saved to: ${outputPath}`);
    
    // Generate TypeScript configuration
    const tsConfig = `/**
 * Zillow Dataset Configuration
 * Auto-generated from discovery script
 */

export interface ZillowDatasetConfig {
  category: string;
  dataType: string;
  geography: string;
  downloadUrl: string;
  description?: string;
}

export const ZILLOW_DATASETS: ZillowDatasetConfig[] = ${JSON.stringify(uniqueDatasets, null, 2)};

// Helper to get datasets by category
export function getDatasetsByCategory(category: string): ZillowDatasetConfig[] {
  return ZILLOW_DATASETS.filter(d => d.category === category);
}

// Helper to get datasets by geography
export function getDatasetsByGeography(geography: string): ZillowDatasetConfig[] {
  return ZILLOW_DATASETS.filter(d => d.geography === geography);
}

// Helper to get datasets by dataset type
export function getDatasetsByType(datasetType: string): ZillowDatasetConfig[] {
  return ZILLOW_DATASETS.filter(d => d.downloadUrl.includes(datasetType));
}
`;
    
    const tsConfigPath = join(__dirname, '../web/lib/data-ingestion/sources/zillow-datasets.ts');
    writeFileSync(tsConfigPath, tsConfig);
    console.log(`💾 Saved TypeScript config to: ${tsConfigPath}`);
    
    // Print summary by category
    console.log('\n📋 Summary by Category:');
    console.log('======================');
    const byCategory = new Map<string, number>();
    uniqueDatasets.forEach(d => {
      byCategory.set(d.category, (byCategory.get(d.category) || 0) + 1);
    });
    Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count} datasets`);
      });
    
    console.log('\n✅ Discovery complete!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

