/**
 * Redfin Data Center Importer
 * Imports housing market data from Redfin Data Center CSV files
 * Uses Puppeteer to intercept automatic downloads from Redfin's Data Center
 * Creates new market records if they don't exist (following Census pattern)
 */

import axios from 'axios'
import puppeteer from 'puppeteer'
import { parse as parseSync } from 'csv-parse/sync'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

// Redfin Data Center base URL
const REDFIN_DATA_CENTER_URL = 'https://www.redfin.com/news/data-center/'

// Redfin dataset categories and keywords for discovery
const REDFIN_DATASET_CATEGORIES = {
  // Sales/Market Data
  sales: {
    keywords: ['median sale price', 'sale price', 'homes sold', 'sales', 'sold'],
    metricPrefix: 'sales_'
  },
  // Rental Data
  rental: {
    keywords: ['rent', 'rental', 'median rent', 'rent price', 'rental price', 'zori'],
    metricPrefix: 'rental_'
  },
  // Investor Data
  investor: {
    keywords: ['investor', 'flip', 'flipping', 'cash buyer', 'institutional', 'buy-to-rent', 'btor'],
    metricPrefix: 'investor_'
  },
  // Inventory Data
  inventory: {
    keywords: ['inventory', 'active listings', 'new listings', 'supply'],
    metricPrefix: 'inventory_'
  },
  // Market Activity
  activity: {
    keywords: ['days on market', 'dom', 'price cuts', 'price reduction', 'pending sales', 'off market'],
    metricPrefix: 'activity_'
  },
  // Price Metrics
  price: {
    keywords: ['price per square foot', 'price/sqft', 'median price', 'average price', 'list price'],
    metricPrefix: 'price_'
  },
  // Affordability
  affordability: {
    keywords: ['affordability', 'affordable', 'price-to-income', 'mortgage payment'],
    metricPrefix: 'affordability_'
  }
}

// Known Redfin datasets (will be expanded by discovery)
const REDFIN_DATASETS: Record<string, { 
  description: string
  category: string
  keywords: string[]
}> = {
  // Sales Data
  median_sale_price: {
    description: 'Median Sale Price',
    category: 'sales',
    keywords: ['median', 'sale', 'price']
  },
  homes_sold: {
    description: 'Homes Sold',
    category: 'sales',
    keywords: ['homes', 'sold']
  },
  // Rental Data
  median_rent: {
    description: 'Median Rent',
    category: 'rental',
    keywords: ['median', 'rent']
  },
  rental_inventory: {
    description: 'Rental Inventory',
    category: 'rental',
    keywords: ['rental', 'inventory']
  },
  // Investor Data
  investor_share: {
    description: 'Investor Share of Sales',
    category: 'investor',
    keywords: ['investor', 'share']
  },
  cash_buyer_share: {
    description: 'Cash Buyer Share',
    category: 'investor',
    keywords: ['cash', 'buyer']
  },
  flipping_rate: {
    description: 'Home Flipping Rate',
    category: 'investor',
    keywords: ['flip', 'flipping']
  },
  // Inventory Data
  inventory: {
    description: 'Active Inventory',
    category: 'inventory',
    keywords: ['inventory', 'active']
  },
  new_listings: {
    description: 'New Listings',
    category: 'inventory',
    keywords: ['new', 'listings']
  },
  // Market Activity
  median_days_on_market: {
    description: 'Median Days on Market',
    category: 'activity',
    keywords: ['days', 'market', 'dom']
  },
  price_cuts: {
    description: 'Price Cuts',
    category: 'activity',
    keywords: ['price', 'cuts', 'reduction']
  },
  // Price Metrics
  price_per_square_foot: {
    description: 'Price per Square Foot',
    category: 'price',
    keywords: ['price', 'square', 'foot', 'sqft']
  }
}

interface MarketRecord {
  region_id: string
  region_name: string
  region_type: string
  state_name?: string
  state_code?: string
  metro_name?: string
}

interface TimeSeriesRecord {
  region_id: string
  date: string
  metric_name: string
  metric_value: number
  data_source: string
  attributes?: Record<string, any>
}

/**
 * Map Redfin region name to existing market region_id
 * Returns null if no match found (will create new market)
 */
async function mapRedfinRegionToRegionId(
  supabase: SupabaseClient,
  regionName: string,
  regionType: string,
  stateCode?: string
): Promise<string | null> {
  let query = supabase
    .from('markets')
    .select('region_id')
    .eq('region_type', regionType)
    .ilike('region_name', `%${regionName}%`)

  if (stateCode) {
    query = query.eq('state_code', stateCode)
  }

  const { data } = await query.limit(1).single()

  return data?.region_id || null
}

/**
 * Create a new market record from Redfin data
 * Returns the region_id of the created market
 */
async function createMarketFromRedfinData(
  supabase: SupabaseClient,
  regionName: string,
  regionType: string,
  stateName?: string,
  stateCode?: string
): Promise<string | null> {
  // Generate a Redfin-specific region_id
  // Format: REDFIN-{TYPE}-{sanitized-name}[-{STATE}]
  // IMPORTANT: region_id must be <= 50 characters (VARCHAR(50) constraint)
  const typeUpper = regionType.toUpperCase()
  const statePart = stateCode ? `-${stateCode.toUpperCase()}` : ''
  const prefix = `REDFIN-${typeUpper}-` // e.g., "REDFIN-METRO-" = 13 chars
  const prefixLength = prefix.length + statePart.length
  const maxNameLength = 50 - prefixLength
  
  const sanitizedName = regionName
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toUpperCase()
    .substring(0, Math.max(1, maxNameLength))
  
  let regionId = `${prefix}${sanitizedName}${statePart}`
  
  // Ensure region_id doesn't exceed 50 characters
  if (regionId.length > 50) {
    const excess = regionId.length - 50
    regionId = `${prefix}${sanitizedName.substring(0, sanitizedName.length - excess)}${statePart}`
  }

  const marketData: MarketRecord = {
    region_id: regionId,
    region_name: regionName,
    region_type: regionType,
    state_name: stateName || undefined,
    state_code: stateCode || undefined
  }

  if (regionType === 'msa') {
    marketData.metro_name = regionName.split(',')[0].trim()
  }

  // Upsert creates the market if it doesn't exist, updates if it does
  // This ensures all Redfin regions are in the database
  const { error } = await supabase
    .from('markets')
    .upsert(marketData, {
      onConflict: 'region_id',
      ignoreDuplicates: false  // Creates new market if region_id doesn't exist
    })

  if (error) {
    console.error(`❌ Error creating market for ${regionName}:`, error.message)
    return null
  }

  console.log(`✅ Created market: ${regionName} (${regionId})`)
  return regionId
}

/**
 * Discover all available datasets on Redfin Data Center page
 */
export async function discoverRedfinDatasets(): Promise<Array<{
  name: string
  description: string
  url: string
  category: string
}>> {
  console.log('🔍 Discovering all Redfin datasets...')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    
    // Set a longer timeout
    page.setDefaultTimeout(60000)
    
    console.log('📥 Navigating to Redfin Data Center...')
    await page.goto(REDFIN_DATA_CENTER_URL, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    })

    // Wait for page to fully load
    console.log('⏳ Waiting for page to load...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Scroll to bottom to trigger lazy loading
    console.log('📜 Scrolling page to load all content...')
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0
        const distance = 100
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight
          window.scrollBy(0, distance)
          totalHeight += distance

          if (totalHeight >= scrollHeight) {
            clearInterval(timer)
            resolve(null)
          }
        }, 100)
      })
    })

    await new Promise(resolve => setTimeout(resolve, 3000))

    // Find and click through all tabs to discover datasets
    console.log('🔍 Looking for tabbed structure...')
    const tabs = await page.evaluate(() => {
      // Look for tabs - could be buttons, divs, or links with tab-related classes
      const tabSelectors = [
        'button[role="tab"]',
        '[role="tab"]',
        '.tab',
        '[class*="tab"]',
        '[class*="Tab"]',
        'nav a',
        'nav button'
      ]
      
      const foundTabs: Array<{ text: string; element: any }> = []
      
      for (const selector of tabSelectors) {
        const elements = document.querySelectorAll(selector)
        elements.forEach((el) => {
          const text = el.textContent?.trim() || ''
          if (text && text.length > 0 && text.length < 50) {
            foundTabs.push({ text, element: el })
          }
        })
      }
      
      // Remove duplicates
      const uniqueTabs = foundTabs.filter((tab, index, self) => 
        index === self.findIndex(t => t.text === tab.text)
      )
      
      return uniqueTabs.map(t => t.text)
    })

    console.log(`📑 Found ${tabs.length} tabs: ${tabs.join(', ')}`)

    // Click through each tab and collect datasets
    const allDatasets: Array<{ name: string; description: string; url: string; category: string }> = []

    for (const tabText of tabs) {
      try {
        console.log(`\n📑 Clicking tab: ${tabText}`)
        
        // Find and click the tab
        const tabClicked = await page.evaluate((tabName) => {
          const selectors = [
            `button[role="tab"]:contains("${tabName}")`,
            `[role="tab"]:contains("${tabName}")`,
            `button:contains("${tabName}")`,
            `a:contains("${tabName}")`
          ]
          
          // Try to find tab by text content
          const allElements = document.querySelectorAll('button, a, [role="tab"], [class*="tab"]')
          for (const el of allElements) {
            if (el.textContent?.trim().toLowerCase() === tabName.toLowerCase()) {
              (el as HTMLElement).click()
              return true
            }
          }
          return false
        }, tabText)

        if (tabClicked) {
          // Wait for tab content to load
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          // Now search for download links in this tab
          const tabDatasets = await page.evaluate((tabName) => {
            const links: Array<{ name: string; description: string; url: string; category: string }> = []
            
            // Get all links and buttons in current tab
            const anchorTags = document.querySelectorAll('a')
            const buttons = document.querySelectorAll('button, [role="button"]')

            // Check links
            anchorTags.forEach((link) => {
              const href = (link as HTMLAnchorElement).href || ''
              const text = link.textContent?.trim() || ''
              const ariaLabel = link.getAttribute('aria-label') || ''
              const title = link.getAttribute('title') || ''
              const className = link.className || ''
              const lowerText = (text + ' ' + ariaLabel + ' ' + title + ' ' + className).toLowerCase()

              // Look for download/CSV buttons
              if (lowerText.includes('download') || lowerText.includes('csv') || lowerText.includes('export') || 
                  href.includes('.csv') || href.includes('.tsv') || href.includes('download')) {
                
                let category = tabName.toLowerCase()
                if (category.includes('rental')) category = 'rental'
                else if (category.includes('investor')) category = 'investor'
                else if (category.includes('sale')) category = 'sales'
                else if (category.includes('inventory')) category = 'inventory'
                else if (category.includes('price cut')) category = 'activity'
                else if (category.includes('days') || category.includes('market')) category = 'activity'
                else if (category.includes('price') || category.includes('square') || category.includes('foot')) category = 'price'
                else if (category.includes('afford')) category = 'affordability'

                links.push({
                  name: text || ariaLabel || title || `${tabName} Data`,
                  description: `${tabName}: ${text || ariaLabel || title || 'Download'}`,
                  url: href,
                  category
                })
              }
            })

            // Check buttons (especially "Download CSV" buttons)
            buttons.forEach((button) => {
              const text = button.textContent?.trim() || ''
              const ariaLabel = button.getAttribute('aria-label') || ''
              const className = button.className || ''
              const lowerText = (text + ' ' + ariaLabel + ' ' + className).toLowerCase()

              if (lowerText.includes('download') || lowerText.includes('csv') || lowerText.includes('export')) {
                // Try to find associated URL
                const parent = button.closest('a')
                const href = parent ? (parent as HTMLAnchorElement).href : ''
                const dataUrl = button.getAttribute('data-url') || button.getAttribute('data-href') || ''
                
                // Check if button has onclick that might contain URL
                const onClick = button.getAttribute('onclick') || ''
                let urlFromOnClick = ''
                if (onClick) {
                  const urlMatch = onClick.match(/['"](https?:\/\/[^'"]+)['"]/)
                  if (urlMatch) urlFromOnClick = urlMatch[1]
                }

                if (href || dataUrl || urlFromOnClick) {
                  let category = tabName.toLowerCase()
                  if (category.includes('rental')) category = 'rental'
                  else if (category.includes('investor')) category = 'investor'
                  else if (category.includes('sale')) category = 'sales'
                  else if (category.includes('inventory')) category = 'inventory'
                  else if (category.includes('price cut')) category = 'activity'
                  else if (category.includes('days') || category.includes('market')) category = 'activity'
                  else if (category.includes('price') || category.includes('square') || category.includes('foot')) category = 'price'
                  else if (category.includes('afford')) category = 'affordability'

                  links.push({
                    name: text || ariaLabel || `${tabName} Download`,
                    description: `${tabName}: ${text || ariaLabel || 'Download CSV'}`,
                    url: href || dataUrl || urlFromOnClick,
                    category
                  })
                }
              }
            })

            return links
          }, tabText)

          allDatasets.push(...tabDatasets)
          console.log(`  ✅ Found ${tabDatasets.length} datasets in "${tabText}" tab`)
        }
      } catch (e) {
        console.log(`  ⚠️ Error processing tab "${tabText}":`, e)
      }
    }

    // Also search the default/current tab (in case we missed anything)
    console.log('\n🔍 Searching default tab for any remaining links...')

    // Extract all download links with more comprehensive search (from current/default tab)
    const defaultTabDatasets = await page.evaluate(() => {
      const links: Array<{ name: string; description: string; url: string; category: string }> = []
      
      // Get all anchor tags
      const anchorTags = document.querySelectorAll('a')
      console.log(`Found ${anchorTags.length} total links on page`)

      // Also check buttons that might trigger downloads
      const buttons = document.querySelectorAll('button, [role="button"]')
      console.log(`Found ${buttons.length} buttons on page`)

      // Check all links
      anchorTags.forEach((link) => {
        const href = (link as HTMLAnchorElement).href || ''
        const text = link.textContent?.trim() || ''
        const parentText = link.parentElement?.textContent?.trim() || ''
        const ariaLabel = link.getAttribute('aria-label') || ''
        const title = link.getAttribute('title') || ''
        const className = link.className || ''
        const id = link.id || ''

        // More comprehensive check for download/data links
        const lowerText = (text + ' ' + ariaLabel + ' ' + title + ' ' + className + ' ' + id).toLowerCase()
        
        const isDownloadLink = href && (
          href.includes('.csv') || 
          href.includes('.tsv') || 
          href.includes('download') ||
          href.includes('export') ||
          href.includes('data') ||
          lowerText.includes('download') ||
          lowerText.includes('csv') ||
          lowerText.includes('export') ||
          lowerText.includes('data') ||
          lowerText.includes('spreadsheet')
        )

        if (isDownloadLink) {
          // Categorize based on text content
          let category = 'other'
          
          if (lowerText.includes('rent') || lowerText.includes('rental')) {
            category = 'rental'
          } else if (lowerText.includes('investor') || lowerText.includes('flip') || lowerText.includes('cash') || lowerText.includes('institutional')) {
            category = 'investor'
          } else if (lowerText.includes('sale') || lowerText.includes('sold')) {
            category = 'sales'
          } else if (lowerText.includes('inventory') || lowerText.includes('listing')) {
            category = 'inventory'
          } else if (lowerText.includes('days') || lowerText.includes('market') || lowerText.includes('price cut') || lowerText.includes('dom')) {
            category = 'activity'
          } else if (lowerText.includes('price') || lowerText.includes('square') || lowerText.includes('foot') || lowerText.includes('sqft')) {
            category = 'price'
          } else if (lowerText.includes('afford') || lowerText.includes('income')) {
            category = 'affordability'
          }

          const displayName = text || ariaLabel || title || href.split('/').pop() || 'Redfin Data'
          const description = text || parentText || ariaLabel || title || 'Redfin Data'

          links.push({
            name: displayName,
            description: description,
            url: href,
            category
          })
        }
      })

      // Also check buttons that might be download triggers
      buttons.forEach((button) => {
        const text = button.textContent?.trim() || ''
        const ariaLabel = button.getAttribute('aria-label') || ''
        const onClick = button.getAttribute('onclick') || ''
        const className = button.className || ''
        const lowerText = (text + ' ' + ariaLabel + ' ' + onClick + ' ' + className).toLowerCase()

        if (lowerText.includes('download') || lowerText.includes('csv') || lowerText.includes('export') || lowerText.includes('data')) {
          // Try to find associated link or data attribute
          const parent = button.closest('a') || button.parentElement?.closest('a')
          const href = parent ? (parent as HTMLAnchorElement).href : ''
          const dataUrl = button.getAttribute('data-url') || button.getAttribute('data-href') || ''

          if (href || dataUrl) {
            let category = 'other'
            if (lowerText.includes('rent') || lowerText.includes('rental')) {
              category = 'rental'
            } else if (lowerText.includes('investor') || lowerText.includes('flip') || lowerText.includes('cash')) {
              category = 'investor'
            } else if (lowerText.includes('sale') || lowerText.includes('sold')) {
              category = 'sales'
            }

            links.push({
              name: text || ariaLabel || 'Download',
              description: text || ariaLabel || 'Redfin Data',
              url: href || dataUrl,
              category
            })
          }
        }
      })

      return links
    })

    // Combine datasets from all tabs
    const allDatasetsCombined = [...allDatasets, ...defaultTabDatasets]

    // Remove duplicates
    const uniqueDatasets = allDatasetsCombined.filter((ds, index, self) => 
      index === self.findIndex(d => d.url === ds.url)
    )

    console.log(`✅ Discovered ${uniqueDatasets.length} unique datasets`)
    
    if (uniqueDatasets.length === 0) {
      console.log('⚠️ No datasets found. The page structure may have changed.')
      console.log('💡 Try manually downloading a CSV file and using the file upload option.')
    }

    return uniqueDatasets

  } catch (error: any) {
    console.error('❌ Error discovering datasets:', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * Download Redfin CSV using Puppeteer to intercept automatic downloads
 */
async function downloadRedfinCSV(metricName: string, downloadUrl?: string): Promise<string> {
  const dataset = REDFIN_DATASETS[metricName]
  if (!dataset && !downloadUrl) {
    throw new Error(`Unknown metric: ${metricName}. Available: ${Object.keys(REDFIN_DATASETS).join(', ')}`)
  }

  console.log(`🔍 Navigating to Redfin Data Center...`)
  if (dataset) {
    console.log(`📥 Looking for: ${dataset.description}`)
  } else if (downloadUrl) {
    console.log(`📥 Downloading from: ${downloadUrl}`)
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    
    // Set up download interception
    let downloadContent: string = ''
    let downloadUrl: string | null = null

    // Intercept network responses to capture the download
    page.on('response', async (response) => {
      const url = response.url()
      const contentType = response.headers()['content-type'] || ''
      
      // Check if this is a CSV/TSV download
      if (url.includes('.csv') || url.includes('.tsv') || 
          contentType.includes('text/csv') || 
          contentType.includes('text/tab-separated-values') ||
          url.includes('redfin') && (url.includes('download') || url.includes('export'))) {
        try {
          downloadContent = await response.text()
          downloadUrl = url
          console.log(`✅ Intercepted download from: ${url}`)
        } catch (error) {
          console.warn(`⚠️ Could not read response from ${url}:`, error)
        }
      }
    })

    // Navigate to Redfin Data Center
    await page.goto(REDFIN_DATA_CENTER_URL, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    })

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Try to find and click the download link
    // Redfin's structure may vary, so we'll try multiple approaches
    try {
      let linkFound: string | null = null

      // If we have a direct URL, use it
      if (downloadUrl) {
        linkFound = downloadUrl
      } else if (dataset) {
        // Method 1: Look for links containing the metric keywords
        linkFound = await page.evaluate((keywords) => {
          const links = Array.from(document.querySelectorAll('a'))
          for (const link of links) {
            const text = link.textContent?.toLowerCase() || ''
            const href = link.getAttribute('href') || ''
            
            // Check if all keywords are present in the link text
            const matchesAll = keywords.every(keyword => text.includes(keyword.toLowerCase()))
            if (matchesAll && (href.includes('.csv') || href.includes('.tsv') || href.includes('download'))) {
              return href
            }
          }
          return null
        }, dataset.keywords)
      }

      if (linkFound) {
        console.log(`🔗 Found download link: ${linkFound}`)
        
        // If it's a full URL, navigate directly
        if (linkFound.startsWith('http')) {
          await page.goto(linkFound, { waitUntil: 'networkidle2', timeout: 30000 })
        } else {
          // Otherwise, try to click the link
          try {
            await page.click(`a[href="${linkFound}"]`)
          } catch (e) {
            // If click fails, try navigating to the URL
            const fullUrl = linkFound.startsWith('/') 
              ? new URL(linkFound, REDFIN_DATA_CENTER_URL).href
              : linkFound
            await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 })
          }
        }
        
        // Wait for download to complete
        await new Promise(resolve => setTimeout(resolve, 5000))
      } else {
        // Method 2: Try to find any CSV/TSV download links
        const csvLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'))
          return links
            .map(link => link.getAttribute('href'))
            .filter(href => href && (href.includes('.csv') || href.includes('.tsv') || href.includes('download')))
        })

        if (csvLinks.length > 0) {
          console.log(`🔗 Found ${csvLinks.length} potential download links`)
          // Try the first one
          const firstLink = csvLinks[0]
          if (firstLink?.startsWith('http')) {
            await page.goto(firstLink, { waitUntil: 'networkidle2', timeout: 30000 })
          } else {
            await page.click(`a[href="${firstLink}"]`)
          }
          await new Promise(resolve => setTimeout(resolve, 5000))
        } else {
          throw new Error('Could not find download link on Redfin Data Center page')
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error clicking download link:`, error)
      // Try direct URL approach if available
      throw new Error('Could not automatically download from Redfin. Please provide the CSV file manually or update the download logic.')
    }

    if (!downloadContent || downloadContent.length === 0) {
      throw new Error('Download was triggered but content was not captured. The file may have downloaded to the default download location.')
    }

    console.log(`✅ Downloaded ${(downloadContent.length / 1024).toFixed(1)} KB`)
    return downloadContent

  } finally {
    await browser.close()
  }
}

/**
 * Import all available Redfin datasets
 */
export async function importAllRedfinData(limitRows?: number) {
  console.log('\n📊 Starting import of ALL Redfin datasets...')
  console.log('================================================')

  // Discover all available datasets
  const datasets = await discoverRedfinDatasets()
  
  if (datasets.length === 0) {
    throw new Error('No datasets found on Redfin Data Center page')
  }

  console.log(`\n✅ Found ${datasets.length} datasets to import:`)
  datasets.forEach((ds, idx) => {
    console.log(`  ${idx + 1}. [${ds.category}] ${ds.description}`)
  })

  const results: Array<{
    dataset: string
    success: boolean
    marketsCreated: number
    timeSeriesInserted: number
    errors: number
  }> = []

  // Import each dataset
  for (const dataset of datasets) {
    try {
      // Generate a metric name from the dataset
      const metricName = dataset.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')

      console.log(`\n📥 Importing: ${dataset.description} (${dataset.category})`)
      
      const result = await importRedfinData(
        metricName,
        limitRows,
        undefined,
        dataset.url
      )

      results.push({
        dataset: dataset.description,
        success: result.success,
        marketsCreated: result.details.marketsCreated,
        timeSeriesInserted: result.details.timeSeriesInserted,
        errors: result.details.errors
      })

      // Small delay between imports
      await new Promise(resolve => setTimeout(resolve, 2000))

    } catch (error: any) {
      console.error(`❌ Error importing ${dataset.description}:`, error.message)
      results.push({
        dataset: dataset.description,
        success: false,
        marketsCreated: 0,
        timeSeriesInserted: 0,
        errors: 1
      })
    }
  }

  // Summary
  const totalMarkets = results.reduce((sum, r) => sum + r.marketsCreated, 0)
  const totalRecords = results.reduce((sum, r) => sum + r.timeSeriesInserted, 0)
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
  const successful = results.filter(r => r.success).length

  console.log('\n📊 Import Summary')
  console.log('================')
  console.log(`✅ Successfully imported: ${successful}/${datasets.length} datasets`)
  console.log(`✅ Total markets created: ${totalMarkets}`)
  console.log(`✅ Total time series records: ${totalRecords}`)
  if (totalErrors > 0) {
    console.log(`❌ Total errors: ${totalErrors}`)
  }

  return {
    success: totalErrors === 0,
    message: `Imported ${successful}/${datasets.length} datasets: ${totalMarkets} markets, ${totalRecords} records`,
    details: {
      datasetsProcessed: datasets.length,
      datasetsSuccessful: successful,
      totalMarketsCreated: totalMarkets,
      totalTimeSeriesInserted: totalRecords,
      totalErrors,
      results
    }
  }
}

/**
 * Import Redfin data from CSV
 * 
 * @param metricName - The metric to import (e.g., 'median_sale_price')
 * @param limitRows - Optional limit for testing
 * @param csvContent - Optional: provide CSV content directly (for manual uploads)
 * @param downloadUrl - Optional: direct URL to download from
 */
export async function importRedfinData(
  metricName: string = 'median_sale_price',
  limitRows?: number,
  csvContent?: string,
  downloadUrl?: string,
  onProgress?: (message: string, progress?: { current: number; total: number; percent: number }) => void,
  sourceFileName?: string
) {
  let supabase
  try {
    supabase = createSupabaseAdminClient()
    console.log('✅ Supabase client created successfully')
    
    // Test connection with a simple query
    console.log('🔍 Testing database connection...')
    const { error: testError } = await supabase
      .from('markets')
      .select('region_id')
      .limit(1)
    
    if (testError) {
      console.error('❌ Database connection test failed:', testError.message)
      console.error('   Error code:', testError.code)
      console.error('   Error details:', testError.details)
      throw new Error(`Database connection test failed: ${testError.message}`)
    }
    console.log('✅ Database connection test passed')
  } catch (error: any) {
    console.error('❌ Failed to create/connect Supabase client:', error.message)
    if (error.cause) {
      console.error('   Cause:', error.cause)
    }
    throw new Error(`Database connection failed: ${error.message}`)
  }
  
  const regionCache = new Map<string, string>()

  const getRegionCacheKey = (name: string, type: string, stateCode?: string | null) => {
    return `${type}|${stateCode || ''}|${name.toLowerCase()}`
  }

  console.log(`\n📊 Starting Redfin import for: ${metricName}`)
  console.log('================================================')

  let csvData: string

  try {
    if (csvContent) {
      // Use provided CSV content (for manual uploads)
      console.log(`📋 Using provided CSV content`)
      csvData = csvContent
    } else {
      // Download using Puppeteer
      csvData = await downloadRedfinCSV(metricName)
    }

    // Detect and handle UTF-16 encoding (common in Excel exports)
    // UTF-16 files have a BOM (Byte Order Mark) and null bytes between characters
    if (csvData.charCodeAt(0) === 0xFFFE || csvData.charCodeAt(0) === 0xFEFF || csvData.includes('\u0000')) {
      console.log('🔧 Detected UTF-16 encoding, converting to UTF-8...')
      
      // If it's a Buffer or has BOM, handle it properly
      if (typeof csvData === 'string' && csvData.includes('\u0000')) {
        // Remove null bytes (UTF-16 LE encoding issue)
        // Convert by reading every other character (UTF-16 LE has null bytes)
        let cleaned = ''
        for (let i = 0; i < csvData.length; i++) {
          const char = csvData[i]
          // Skip null bytes and BOM characters
          if (char !== '\u0000' && char !== '\uFFFE' && char !== '\uFEFF') {
            cleaned += char
          }
        }
        csvData = cleaned
        
        // Also try to detect if it's actually UTF-16 by checking the first few bytes
        // If the file starts with BOM, we need to handle it differently
        if (csvData.length > 0 && (csvData.charCodeAt(0) === 0xFFFE || csvData.charCodeAt(0) === 0xFEFF)) {
          csvData = csvData.substring(1) // Remove BOM
        }
      }
      
      console.log(`   Converted ${csvData.length} characters`)
    }

    // Parse CSV/TSV
    // Redfin can be in two formats:
    // 1. "data" format: One row per region, date columns (YYYY-MM-DD) with values
    // 2. "cross tab" format: One row per region per month/quarter, region in column A, date in a column, value in another column
    const isTSV = csvData.includes('\t') || metricName.includes('tsv')
    
    let records: any[] = []
    try {
      records = parseSync(csvData, {
        columns: true,
        skip_empty_lines: true,
        skip_records_with_error: true, // Skip malformed rows instead of failing
        relax_column_count: true, // Allow rows with different column counts
        relax_quotes: true, // Handle unclosed quotes
        delimiter: isTSV ? '\t' : ',',
        trim: true,
        cast: false // Don't auto-cast, we'll handle parsing manually
      })
    } catch (parseError: any) {
      console.warn(`⚠️ CSV parsing encountered issues: ${parseError.message}`)
      console.warn('   Attempting to continue with valid rows only...')
      
      // If parsing completely fails, try to extract what we can
      if (parseError.message.includes('Invalid Record Length') || parseError.message.includes('columns length')) {
        console.log('   Using fallback parser to handle inconsistent row lengths...')
        // Try parsing line by line to skip bad rows
        // Use a simple CSV parser that handles quoted fields
        const lines = csvData.split(/\r?\n/).filter(line => line.trim())
        if (lines.length < 2) {
          throw new Error('CSV file appears to be empty or has no data rows')
        }
        
        const headerLine = lines[0]
        // Parse header with proper CSV handling (respect quotes)
        const headers: string[] = []
        let currentHeader = ''
        let inQuotes = false
        for (let i = 0; i < headerLine.length; i++) {
          const char = headerLine[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if ((char === ',' || char === '\t') && !inQuotes) {
            headers.push(currentHeader.trim().replace(/^"|"$/g, ''))
            currentHeader = ''
          } else {
            currentHeader += char
          }
        }
        if (currentHeader) {
          headers.push(currentHeader.trim().replace(/^"|"$/g, ''))
        }
        
        console.log(`   Found ${headers.length} columns: ${headers.join(', ')}`)
        
        records = []
        let skippedRows = 0
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue
          
          // Parse CSV line with proper quote handling
          const values: string[] = []
          let currentValue = ''
          inQuotes = false
          for (let j = 0; j < line.length; j++) {
            const char = line[j]
            if (char === '"') {
              inQuotes = !inQuotes
            } else if ((char === ',' || char === '\t') && !inQuotes) {
              values.push(currentValue.trim().replace(/^"|"$/g, ''))
              currentValue = ''
            } else {
              currentValue += char
            }
          }
          if (currentValue) {
            values.push(currentValue.trim().replace(/^"|"$/g, ''))
          }
          
          // Only process rows that have at least some data
          if (values.length > 0 && values.some(v => v && v.trim())) {
            const record: any = {}
            headers.forEach((header, idx) => {
              if (values[idx] !== undefined) {
                record[header] = values[idx]
              }
            })
            // Only add if we got at least one column of data
            if (Object.keys(record).length > 0) {
              records.push(record)
            } else {
              skippedRows++
            }
          } else {
            skippedRows++
          }
        }
        console.log(`   Recovered ${records.length} valid records from ${lines.length - 1} lines (skipped ${skippedRows} empty/invalid rows)`)
      } else {
        throw new Error(`Failed to parse CSV: ${parseError.message}`)
      }
    }
    
    // Filter out any records that are completely empty or have no valid data
    const validRecords = records.filter(record => {
      if (!record || typeof record !== 'object') return false
      const values = Object.values(record)
      // Keep record if it has at least one non-empty value
      return values.some(val => val !== null && val !== undefined && val !== '' && val !== '""')
    })
    
    if (validRecords.length < records.length) {
      console.log(`   Filtered out ${records.length - validRecords.length} empty/invalid records`)
    }
    
    records = validRecords
    
    console.log(`📋 Parsed ${records.length} records`)
    
    // Analyze CSV structure
    let firstRecord = records[0] || {}
    
    // Clean column names and values - remove null bytes (UTF-16 encoding issue)
    // This happens when Excel exports CSV in UTF-16 format
    const cleanedRecords = records.map(record => {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(record)) {
        // Remove null bytes and BOM characters from keys
        const cleanKey = key.replace(/\u0000/g, '').replace(/[\uFFFE\uFEFF]/g, '').trim()
        // Remove null bytes and BOM characters from string values
        const cleanValue = typeof value === 'string' 
          ? value.replace(/\u0000/g, '').replace(/[\uFFFE\uFEFF]/g, '').trim()
          : value
        cleaned[cleanKey] = cleanValue
      }
      return cleaned
    })
    
    // Replace records with cleaned versions (avoid spread operator to prevent stack overflow)
    records = cleanedRecords
    firstRecord = cleanedRecords[0] || {}
    
    const allColumns = Object.keys(firstRecord)
    const dateColumns = allColumns.filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key))
    const hasDateColumns = dateColumns.length > 0
    
    console.log(`📊 CSV Analysis:`)
    console.log(`   Total columns: ${allColumns.length}`)
    console.log(`   All columns: ${allColumns.join(', ')}`)
    console.log(`   Date columns found: ${dateColumns.length}`)
    
    // Check for cross tab format: region in any column, date in another column, value in another
    const firstColumn = allColumns[0] || ''
    
    // Look for region column - prioritize actual region name columns over type columns
    // First, try to find exact matches for common region name columns
    const regionColumn = allColumns.find(col => {
      const lowerCol = col.toLowerCase()
      // Prioritize exact matches that are likely to contain region names (not types)
      return (lowerCol === 'region' || lowerCol === 'state') && 
             !lowerCol.includes('_type') && 
             !lowerCol.includes('type_') &&
             !lowerCol.endsWith('type')
    }) || allColumns.find(col => {
      const lowerCol = col.toLowerCase()
      // Fallback: look for region/metro/city/area columns (but exclude type columns)
      return (lowerCol.includes('region') || 
              lowerCol.includes('area') ||
              lowerCol.includes('metro') ||
              lowerCol.includes('city') ||
              lowerCol.includes('state')) &&
             !lowerCol.includes('_type') && 
             !lowerCol.includes('type_') &&
             !lowerCol.endsWith('type')
    }) || firstColumn
    
    const hasRegionColumn = !!regionColumn && (
      regionColumn.toLowerCase().includes('region') || 
      regionColumn.toLowerCase().includes('area') ||
      regionColumn.toLowerCase().includes('metro') ||
      regionColumn.toLowerCase().includes('city') ||
      regionColumn.toLowerCase().includes('state')
    )
    
    // Look for date/period column (might be named "Date", "Month", "Period", "Quarter", etc.)
    const dateColumnName = allColumns.find(col => {
      const lowerCol = col.toLowerCase()
      return lowerCol.includes('date') || 
             lowerCol.includes('month') ||
             lowerCol.includes('period') ||
             lowerCol.includes('quarter') ||
             lowerCol.includes('time')
    })
    
    // Check if this is quarter-based format (e.g., "2025 Q2")
    const isQuarterFormat = dateColumnName && records.some(record => {
      const dateValue = record[dateColumnName] || ''
      return typeof dateValue === 'string' && /Q\d/.test(dateValue)
    })
    
    // Identify all metric columns (INCLUDE MoM/YoY columns, exclude only metadata)
    const metricColumns = allColumns.filter(col => {
      const lowerCol = col.toLowerCase()
      // Exclude metadata columns (region, date, quarter, state, type)
      // But include columns that have "date" or "month" in MoM/YoY metric names
      if (col === regionColumn) {
        return false // Exclude the region column
      }
      if (col === dateColumnName) {
        return false // Exclude the date/quarter column
      }
      if (lowerCol.includes('region') || 
          (lowerCol.includes('date') && !lowerCol.includes('mom') && !lowerCol.includes('yoy')) || 
          (lowerCol.includes('month') && !lowerCol.includes('mom') && !lowerCol.includes('yoy')) ||
          (lowerCol.includes('period') && !lowerCol.includes('mom') && !lowerCol.includes('yoy')) ||
          (lowerCol.includes('quarter') && !lowerCol.includes('mom') && !lowerCol.includes('yoy')) ||
          lowerCol.includes('state') ||
          lowerCol.includes('type')) {
        return false
      }
      return true
    })
    
    // Separate base metrics from MoM/YoY metrics for better organization
    const baseMetrics = metricColumns.filter(col => {
      const lowerCol = col.toLowerCase()
      return !lowerCol.includes('mom') && !lowerCol.includes('yoy') && 
             !lowerCol.includes('month-over-month') && !lowerCol.includes('year-over-year')
    })
    
    const changeMetrics = metricColumns.filter(col => {
      const lowerCol = col.toLowerCase()
      return lowerCol.includes('mom') || lowerCol.includes('yoy') ||
             lowerCol.includes('month-over-month') || lowerCol.includes('year-over-year')
    })
    
    console.log(`   Total metric columns found: ${metricColumns.length}`)
    console.log(`   Base metrics: ${baseMetrics.length} (${baseMetrics.join(', ')})`)
    console.log(`   Change metrics (MoM/YoY): ${changeMetrics.length} (${changeMetrics.join(', ')})`)
    
    const isCrossTabFormat = !hasDateColumns && hasRegionColumn && dateColumnName && metricColumns.length > 0
    
    console.log(`   Format detected: ${isCrossTabFormat ? 'Cross Tab (one row per region per month)' : hasDateColumns ? 'Data (date columns)' : 'Unknown'}`)
    if (isCrossTabFormat) {
      console.log(`   Region column: ${regionColumn}`)
      console.log(`   Date column: ${dateColumnName}`)
      console.log(`   Metric columns: ${metricColumns.length} metrics found`)
      // Debug: Show sample region values from the selected region column
      const sampleRegions = records.slice(0, 10).map(r => r[regionColumn]).filter(Boolean)
      if (sampleRegions.length > 0) {
        console.log(`   Sample region values (first 10): ${sampleRegions.join(', ')}`)
      }
      // Debug: Show sample date values from the date column
      if (dateColumnName) {
        const sampleDates = [...new Set(records.slice(0, 50).map(r => r[dateColumnName]).filter(Boolean))]
        console.log(`   Sample date values (first 50 unique): ${sampleDates.slice(0, 20).join(', ')}${sampleDates.length > 20 ? ` ... (${sampleDates.length} total unique in first 50 rows)` : ''}`)
        // Count total unique dates in all records
        const allUniqueDates = [...new Set(records.map(r => r[dateColumnName]).filter(Boolean))]
        console.log(`   Total unique date values in file: ${allUniqueDates.length}`)
        if (allUniqueDates.length <= 30) {
          console.log(`   All dates in file: ${allUniqueDates.join(', ')}`)
        } else {
          console.log(`   First 15 dates: ${allUniqueDates.slice(0, 15).join(', ')}`)
          console.log(`   Last 15 dates: ${allUniqueDates.slice(-15).join(', ')}`)
        }
      }
      // Debug: Check if REGION_TYPE column exists and show its values
      const regionTypeCol = allColumns.find(col => col.toLowerCase() === 'region_type')
      if (regionTypeCol) {
        const sampleTypes = [...new Set(records.slice(0, 20).map(r => r[regionTypeCol]).filter(Boolean))]
        console.log(`   REGION_TYPE column found. Sample values: ${sampleTypes.join(', ')}`)
      }
      // Debug: Check if REGION column exists separately
      const regionCol = allColumns.find(col => col.toLowerCase() === 'region' && !col.toLowerCase().includes('type'))
      if (regionCol && regionCol !== regionColumn) {
        const sampleRegionValues = [...new Set(records.slice(0, 10).map(r => r[regionCol]).filter(Boolean))]
        console.log(`   REGION column found separately. Sample values: ${sampleRegionValues.join(', ')}`)
      }
    } else {
      console.log(`   ⚠️ Format detection failed:`)
      console.log(`      - hasDateColumns: ${hasDateColumns}`)
      console.log(`      - hasRegionColumn: ${hasRegionColumn} (found: "${regionColumn}")`)
      console.log(`      - dateColumnName: ${dateColumnName || 'NOT FOUND'}`)
      console.log(`      - metricColumns.length: ${metricColumns.length}`)
    }

    if (records.length === 0) {
      throw new Error('No valid records found in CSV file. Please check the file format.')
    }

    console.log(`📋 Processing ${records.length} records`)

    // Limit rows if specified (for testing)
    const recordsToProcess = limitRows ? records.slice(0, limitRows) : records
    console.log(`🔄 Processing ${recordsToProcess.length} records`)
    
    // Store analysis results for debugging
    const analysisResults: any = {
      totalRecords: records.length,
      format: isCrossTabFormat ? 'cross_tab' : hasDateColumns ? 'data' : 'unknown',
      columns: allColumns,
      regionColumn: regionColumn,
      dateColumn: dateColumnName,
      metricColumns: metricColumns.length,
      metricColumnNames: metricColumns,
      sampleRecord: firstRecord,
      isCrossTabFormat,
      hasDateColumns
    }

    // Helper function to extract region info from a record
    const extractRegionInfo = (record: any): { regionName: string; regionType: string; stateName: string | null; stateCode: string | null } | null => {
      let regionName = ''
      let regionType = 'msa'
      let stateName = null
      let stateCode = null
      
      if (isCrossTabFormat) {
        // Cross tab format: region is in region column (found during analysis)
        regionName = (record[regionColumn] || '').toString().trim()
        
        // Handle "National" region
        if (regionName.toLowerCase() === 'national') {
          regionType = 'country'
          regionName = 'United States' // Normalize to standard name
        } else {
          // Get region type from REGION_TYPE column if it exists
          const typeColumn = allColumns.find(col => {
            const lowerCol = col.toLowerCase()
            return lowerCol === 'region_type' || 
                   (lowerCol.includes('type') && (lowerCol.includes('region') || lowerCol.includes('_type')))
          })
          
          if (typeColumn) {
            const typeValue = (record[typeColumn] || '').toString().trim().toLowerCase()
            if (typeValue === 'state') {
              regionType = 'state'
              // For state-level data, if regionName is "state" or empty, try to get from REGION or STATE column
              if (!regionName || regionName.toLowerCase() === 'state') {
                // Try REGION column first (exact match, not REGION_TYPE)
                const regionNameCol = allColumns.find(col => {
                  const lowerCol = col.toLowerCase()
                  return lowerCol === 'region' && !lowerCol.includes('type')
                })
                if (regionNameCol && record[regionNameCol]) {
                  regionName = (record[regionNameCol] || '').toString().trim()
                }
                // If still empty, try STATE column (but not STATE_CODE or REGION_TYPE)
                if (!regionName || regionName.toLowerCase() === 'state') {
                  const stateCol = allColumns.find(col => {
                    const lowerCol = col.toLowerCase()
                    return lowerCol === 'state' && 
                           !lowerCol.includes('code') && 
                           !lowerCol.includes('type')
                  })
                  if (stateCol && record[stateCol]) {
                    regionName = (record[stateCol] || '').toString().trim()
                  }
                }
              }
            } else if (typeValue) {
              regionType = typeValue
            }
          }
          
          // Try to extract state code from STATE_CODE column first
          const stateCodeCol = allColumns.find(col => {
            const lowerCol = col.toLowerCase()
            return lowerCol === 'state_code' || lowerCol === 'statecode'
          })
          if (stateCodeCol && record[stateCodeCol]) {
            stateCode = (record[stateCodeCol] || '').toString().trim().toUpperCase()
          }
          
          // If no state code yet, try to extract from region name
          if (!stateCode) {
            const stateMatch = regionName.match(/,\s*([A-Z]{2})(?:\s+metro\s+area)?$/i)
            if (stateMatch) {
              stateCode = stateMatch[1]
              regionName = regionName.replace(/\s+metro\s+area$/i, '').trim()
            }
          }
          
          // Get state name from STATE column if available (but not STATE_CODE or REGION_TYPE)
          const stateCol = allColumns.find(col => {
            const lowerCol = col.toLowerCase()
            return lowerCol === 'state' && 
                   !lowerCol.includes('code') && 
                   !lowerCol.includes('type')
          })
          if (stateCol && record[stateCol]) {
            const stateValue = (record[stateCol] || '').toString().trim()
            if (stateValue) {
              stateName = stateValue
              // If regionName is still "state" or empty, use stateName
              if ((!regionName || regionName.toLowerCase() === 'state') && stateName) {
                regionName = stateName
              }
              // If no state code yet, try to derive from state name
              if (!stateCode && stateName) {
                // This is a fallback - state names are full names, not codes
                // We'll need to map them properly, but for now just use first 2 chars as fallback
                stateCode = stateName.substring(0, 2).toUpperCase()
              }
            }
          }
          
          // Default region type if not found
          if (!regionType || regionType === 'msa') {
            regionType = 'msa' // Default to metro for backward compatibility
          }
        }
      } else {
        // Data format: try standard column names
        regionName = record['Region Name'] || record['region_name'] || record['Region'] || record[firstColumn] || ''
        regionType = record['Region Type'] || record['region_type'] || 'msa'
        stateName = record['State'] || record['state_name'] || null
        stateCode = record['State Code'] || record['state_code'] || null
      }

      if (!regionName) {
        return null
      }

      return { regionName, regionType, stateName, stateCode }
    }

    // ========================================================================
    // OPTIMIZATION: Pre-load markets and batch create missing ones
    // ========================================================================
    // Declare marketLookup outside try block so it's accessible throughout the function
    const marketLookup = new Map<string, string>()
    
    console.log('📦 Pre-loading existing markets into memory...')
    try {
      const { data: existingMarkets, error: loadError } = await supabase
        .from('markets')
        .select('region_id, region_name, region_type, state_code')
      
      if (loadError) {
        console.error('❌ Error loading existing markets:', loadError.message)
        console.error('   Error details:', JSON.stringify(loadError, null, 2))
        throw new Error(`Failed to load existing markets: ${loadError.message}`)
      }
      
      existingMarkets?.forEach(m => {
        const key = getRegionCacheKey(m.region_name || '', m.region_type || '', m.state_code)
        marketLookup.set(key, m.region_id)
      })
      console.log(`   Loaded ${marketLookup.size} existing markets into memory`)
    } catch (error: any) {
      console.error('❌ Fatal error in pre-loading markets:', error.message)
      console.error('   Stack:', error.stack)
      throw error
    }

    // First pass: Collect all unique regions
    console.log('🔍 Collecting unique regions from records...')
    const uniqueRegions = new Map<string, { name: string; type: string; stateCode?: string | null; stateName?: string | null }>()
    
    for (const record of recordsToProcess) {
      const regionInfo = extractRegionInfo(record)
      if (!regionInfo) {
        continue
      }
      
      const key = getRegionCacheKey(regionInfo.regionName, regionInfo.regionType, regionInfo.stateCode)
      if (!uniqueRegions.has(key)) {
        uniqueRegions.set(key, {
          name: regionInfo.regionName,
          type: regionInfo.regionType,
          stateCode: regionInfo.stateCode,
          stateName: regionInfo.stateName
        })
      }
    }
    console.log(`   Found ${uniqueRegions.size} unique regions`)
    // Debug: Show first 10 unique region names
    const regionNames = Array.from(uniqueRegions.values()).slice(0, 10).map(r => `${r.name} (${r.type}${r.stateCode ? `, ${r.stateCode}` : ''})`)
    if (regionNames.length > 0) {
      console.log(`   Sample unique regions: ${regionNames.join(', ')}`)
    }
    // Debug: Show breakdown by type
    const regionsByType = new Map<string, number>()
    uniqueRegions.forEach(r => {
      regionsByType.set(r.type, (regionsByType.get(r.type) || 0) + 1)
    })
    console.log(`   Regions by type: ${Array.from(regionsByType.entries()).map(([type, count]) => `${type}: ${count}`).join(', ')}`)
    // If state type, show all state names
    if (regionsByType.has('state')) {
      const stateRegions = Array.from(uniqueRegions.values()).filter(r => r.type === 'state').map(r => r.name).sort()
      console.log(`   All state names found (${stateRegions.length}): ${stateRegions.join(', ')}`)
    }

    // Batch create missing markets
    // Use a Map to ensure each unique region key gets exactly one region_id
    const regionIdMap = new Map<string, string>() // Maps unique key -> region_id
    const usedRegionIds = new Set<string>() // Track region_ids to prevent duplicates in batch
    const marketsToCreate: MarketRecord[] = []
    
    // Track regions that need truncation for reporting
    const truncationExamples: Array<{ originalName: string; regionId: string; length: number; type: string }> = []
    
    for (const [key, region] of uniqueRegions.entries()) {
      if (!marketLookup.has(key)) {
        // Generate a deterministic region_id based on the unique key
        // This ensures the same region always gets the same region_id
        // IMPORTANT: region_id must be <= 50 characters (VARCHAR(50) constraint)
        const typeUpper = region.type.toUpperCase()
        const statePart = region.stateCode ? `-${region.stateCode.toUpperCase()}` : ''
        const prefix = `REDFIN-${typeUpper}-` // e.g., "REDFIN-METRO-" = 13 chars
        const prefixLength = prefix.length + statePart.length // e.g., 13 + 3 = 16 chars
        const maxNameLength = 50 - prefixLength - 1 // Reserve 1 char for potential counter
        
        // Sanitize and truncate name to fit within the limit
        const originalSanitized = region.name.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()
        const sanitizedName = originalSanitized.substring(0, Math.max(1, maxNameLength))
        
        let regionId = `${prefix}${sanitizedName}${statePart}`
        const originalLength = regionId.length
        
        // Ensure region_id doesn't exceed 50 characters
        if (regionId.length > 50) {
          const excess = regionId.length - 50
          const truncatedName = sanitizedName.substring(0, sanitizedName.length - excess)
          regionId = `${prefix}${truncatedName}${statePart}`
        }
        
        // Track if truncation occurred
        if (originalSanitized.length > maxNameLength || originalLength > 50) {
          truncationExamples.push({
            originalName: region.name,
            regionId: regionId,
            length: regionId.length,
            type: region.type
          })
        }
        
        // If this region_id is already used in the batch, make it unique
        // But keep it under 50 chars by truncating the name further if needed
        let counter = 1
        const baseRegionId = regionId
        while (usedRegionIds.has(regionId) && counter < 1000) {
          const counterStr = counter.toString()
          const maxNameWithCounter = 50 - prefixLength - counterStr.length - 1 // -1 for the dash
          const truncatedName = sanitizedName.substring(0, Math.max(1, maxNameWithCounter))
          regionId = `${prefix}${truncatedName}${statePart}-${counterStr}`
          counter++
        }
        
        // Only add if we haven't already processed this unique key
        if (!regionIdMap.has(key)) {
          regionIdMap.set(key, regionId)
          usedRegionIds.add(regionId)
          marketsToCreate.push({
            region_id: regionId,
            region_name: region.name,
            region_type: region.type,
            state_code: region.stateCode || undefined,
            state_name: region.stateName || undefined,
            metro_name: region.type === 'msa' ? region.name.split(',')[0].trim() : undefined
          })
          marketLookup.set(key, regionId)
        }
      }
    }
    
    // Log examples of truncated region IDs
    if (truncationExamples.length > 0) {
      console.log(`\n⚠️ Found ${truncationExamples.length} regions that required truncation to fit 50-char limit:`)
      const examplesToShow = truncationExamples.slice(0, 20) // Show first 20 examples
      examplesToShow.forEach((ex, idx) => {
        console.log(`   ${idx + 1}. [${ex.type}] "${ex.originalName}" -> "${ex.regionId}" (${ex.length} chars)`)
      })
      if (truncationExamples.length > 20) {
        console.log(`   ... and ${truncationExamples.length - 20} more`)
      }
    }

    if (marketsToCreate.length > 0) {
      console.log(`📦 Batch creating ${marketsToCreate.length} missing markets...`)
      try {
        const { error: createError } = await supabase
          .from('markets')
          .upsert(marketsToCreate, { onConflict: 'region_id', ignoreDuplicates: false })
        
        if (createError) {
          console.error('❌ Error batch creating markets:', createError.message)
          console.error('   Error code:', createError.code)
          console.error('   Error details:', createError.details)
          console.error('   Error hint:', createError.hint)
          throw new Error(`Failed to create markets: ${createError.message}`)
        } else {
          console.log(`✅ Successfully created ${marketsToCreate.length} markets`)
        }
      } catch (error: any) {
        console.error('❌ Fatal error creating markets:', error.message)
        if (error.cause) {
          console.error('   Cause:', error.cause)
        }
        throw error
      }
    }

    // ========================================================================
    // Second pass: Process records in chunks and insert incrementally
    // This prevents stack overflow with very large files
    // ========================================================================
    console.log('📊 Processing records in chunks and inserting incrementally...')
    let marketsCreated = marketsToCreate.length
    let errors = 0
    const errorDetails: any[] = []
    let totalTimeSeriesInserted = 0
    
    // Track skipped rows for diagnostics
    let skippedNoRegion = 0
    let skippedNoDate = 0
    let skippedNoMetrics = 0

    // Process in chunks to avoid memory issues
    const chunkSize = 10000 // Process 10,000 records at a time
    const totalChunks = Math.ceil(recordsToProcess.length / chunkSize)
    
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const chunkStart = chunkIndex * chunkSize
      const chunkEnd = Math.min(chunkStart + chunkSize, recordsToProcess.length)
      const chunk = recordsToProcess.slice(chunkStart, chunkEnd)
      
      console.log(`📦 Processing chunk ${chunkIndex + 1}/${totalChunks} (rows ${chunkStart + 1}-${chunkEnd})...`)
      
      // Collect time series data for this chunk only
      const chunkTimeSeriesData: TimeSeriesRecord[] = []
      
      // Process each row in this chunk
      for (const [chunkRowIndex, record] of chunk.entries()) {
        const index = chunkStart + chunkRowIndex
      try {
        // Extract region information
        const regionInfo = extractRegionInfo(record)
        
        if (!regionInfo) {
          skippedNoRegion++
          if (index < 3) {
            console.warn(`⚠️ Skipping row ${index + 1}: missing region name`)
            if (index === 0) {
              console.warn(`   Available columns: ${allColumns.join(', ')}`)
              console.warn(`   First column value: ${record[firstColumn]}`)
            }
          }
          continue
        }

        const { regionName, regionType, stateName, stateCode } = regionInfo

        // Progress indicator (every 5000 rows for large datasets)
        if ((index + 1) % 5000 === 0) {
          console.log(`  Collected data from ${index + 1}/${recordsToProcess.length} rows (chunk ${chunkIndex + 1}: ${chunkTimeSeriesData.length} time series records so far)`)
        }

        // Use in-memory lookup (no DB query!)
        const cacheKey = getRegionCacheKey(regionName, regionType, stateCode)
        let regionId = regionCache.get(cacheKey) || marketLookup.get(cacheKey) || null

        if (!regionId) {
          // Fallback: try database lookup (shouldn't happen if pre-loading worked)
          console.warn(`⚠️ Region not found in memory cache, falling back to DB lookup: ${regionName}`)
          regionId = await mapRedfinRegionToRegionId(supabase, regionName, regionType, stateCode)
          if (regionId) {
            marketLookup.set(cacheKey, regionId)
          }
        }

        if (!regionId) {
          // Fallback: create market (shouldn't happen if batch creation worked)
          console.warn(`⚠️ Region not found, creating: ${regionName}`)
          regionId = await createMarketFromRedfinData(supabase, regionName, regionType, stateName, stateCode)
          if (regionId) {
            marketLookup.set(cacheKey, regionId)
            marketsCreated++
          }
        }

        if (!regionId) {
          console.warn(`⚠️ Could not create or map Redfin region: ${regionName}`)
          continue
        }

        if (regionId) {
          regionCache.set(cacheKey, regionId)
        }

        // Extract time series data - push directly to chunkTimeSeriesData to avoid stack overflow
        let timeSeriesCount = 0
        
        if (isCrossTabFormat) {
          // Cross tab format: one row per region per month/quarter
          // Region is in first column, date is in dateColumnName, multiple metrics in other columns
          const dateValue = record[dateColumnName!] || ''
          
          // Parse date - handle multiple formats
          let parsedDate = ''
          if (typeof dateValue === 'string') {
            // Try quarter format first (e.g., "2025 Q2" = Q2 2025 = April 1, 2025)
            const quarterMatch = dateValue.match(/(\d{4})\s*Q(\d)/i)
            if (quarterMatch) {
              const year = quarterMatch[1]
              const quarter = parseInt(quarterMatch[2])
              // Q1 = Jan (01), Q2 = Apr (04), Q3 = Jul (07), Q4 = Oct (10)
              const quarterMonths: Record<number, string> = {
                1: '01', 2: '04', 3: '07', 4: '10'
              }
              const month = quarterMonths[quarter]
              if (month) {
                parsedDate = `${year}-${month}-01`
              }
            } else {
              // Try numeric month/day/year format (e.g., "1/1/2012")
              const mdYMatch = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
              if (mdYMatch) {
                const month = mdYMatch[1].padStart(2, '0')
                const day = mdYMatch[2].padStart(2, '0')
                const year = mdYMatch[3]
                parsedDate = `${year}-${month}-${day}`
              } else {
                // Try full month name format (e.g., "January 2012")
                const fullMonthMatch = dateValue.match(/^([A-Za-z]+)\s+(\d{4})$/)
                if (fullMonthMatch) {
                  const fullMonthNames: Record<string, string> = {
                    'january': '01', 'february': '02', 'march': '03', 'april': '04',
                    'may': '05', 'june': '06', 'july': '07', 'august': '08',
                    'september': '09', 'october': '10', 'november': '11', 'december': '12'
                  }
                  const month = fullMonthNames[fullMonthMatch[1].toLowerCase()]
                  const year = fullMonthMatch[2]
                  if (month) {
                    parsedDate = `${year}-${month}-01`
                  }
                } else {
                  // Try "MMM-YY" format (e.g., "Jan-12" = January 2012)
                  const mmmYyMatch = dateValue.match(/^([A-Za-z]{3})-(\d{2})$/)
                  if (mmmYyMatch) {
                    const monthNames: Record<string, string> = {
                      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
                      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
                      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
                    }
                    const month = monthNames[mmmYyMatch[1].toLowerCase()]
                    const year = '20' + mmmYyMatch[2] // Convert "12" to "2012"
                    if (month) {
                      parsedDate = `${year}-${month}-01`
                    }
                  } else {
                    // Try other formats
                    const dateMatch = dateValue.match(/(\d{4})[-\/](\d{1,2})/)
                    if (dateMatch) {
                      const year = dateMatch[1]
                      const month = dateMatch[2].padStart(2, '0')
                      parsedDate = `${year}-${month}-01`
                    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                      parsedDate = dateValue
                    }
                  }
                }
              }
            }
          }
          
          if (!parsedDate) {
            skippedNoDate++
            if (index < 3) {
              console.warn(`⚠️ Row ${index + 1}: Could not parse date from "${dateValue}"`)
              console.warn(`   Date column: "${dateColumnName}"`)
              console.warn(`   Date value type: ${typeof dateValue}`)
            }
            continue
          }
          
          // parsedDate is valid, process metrics
          let hasValidMetrics = false
          // Process each metric column
          for (const metricCol of metricColumns) {
            const rawValue = record[metricCol] || ''
            
            // Skip empty values
            if (!rawValue || rawValue === '' || rawValue === '-' || rawValue === 'null' || rawValue === 'undefined') {
              continue
            }
            
            hasValidMetrics = true
            
            // Parse value - handle formats like "$159K", "159,000", percentages, etc.
            let value: number | null = null
            const lowerCol = metricCol.toLowerCase()
            const isPercentage = lowerCol.includes('mom') || lowerCol.includes('yoy') || 
                                lowerCol.includes('month-over-month') || lowerCol.includes('year-over-year') ||
                                lowerCol.includes('sale to list') || rawValue.toString().includes('%')
            
            if (typeof rawValue === 'string') {
              // Remove currency symbols, commas, percentage signs, and handle K/M suffixes
              let cleaned = rawValue.replace(/[$,\s%]/g, '').toUpperCase()
              const isK = cleaned.includes('K')
              const isM = cleaned.includes('M')
              cleaned = cleaned.replace(/[KM]/g, '')
              value = parseFloat(cleaned)
              if (!isNaN(value)) {
                if (isK) value = value * 1000
                if (isM) value = value * 1000000
                // For percentages, keep as-is (e.g., 13.70 means 13.70%)
                // For MoM/YoY, they're already percentages
              }
            } else {
              value = parseFloat(rawValue)
            }
            
            // For MoM/YoY and percentages, allow negative values and zero
            // For other metrics, require positive values
            const isValidValue = value !== null && !isNaN(value) && 
                                (isPercentage ? true : value > 0)
            
            if (isValidValue) {
              // Generate metric name from column name
              const cleanMetricName = metricCol
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
              
              // Push directly to chunkTimeSeriesData to avoid stack overflow from spread operator
              chunkTimeSeriesData.push({
                region_id: regionId,
                date: parsedDate,
                metric_name: cleanMetricName,
                metric_value: value,
                data_source: 'redfin',
                attributes: {
                  region_type: regionType,
                  state_code: stateCode || undefined,
                  format: 'cross_tab',
                  original_column: metricCol,
                  is_percentage: isPercentage,
                  metric_type: isPercentage ? 'change' : 'value',
                  source_file: sourceFileName || undefined
                }
              })
              timeSeriesCount++
            }
          }
          
          if (!hasValidMetrics) {
            skippedNoMetrics++
            if (index < 3) {
              console.warn(`⚠️ Row ${index + 1}: No valid metric values found`)
              console.warn(`   Metric columns: ${metricColumns.join(', ')}`)
              console.warn(`   Sample values: ${JSON.stringify(Object.fromEntries(metricColumns.slice(0, 3).map(col => [col, record[col]])))}`)
            }
          }
          
          // Log first few records for debugging
          if (index < 3) {
            console.log(`   Row ${index + 1}: Region="${regionName}", Date="${dateValue}" -> "${parsedDate}", Metrics found: ${timeSeriesCount}`)
          }
          
          // Log unique dates being parsed (first 20 unique dates)
          if (index < 100 || (index % 1000 === 0)) {
            // Track unique dates for debugging
            if (!(globalThis as any).redfinUniqueDates) {
              (globalThis as any).redfinUniqueDates = new Set<string>()
            }
            if (parsedDate) {
              (globalThis as any).redfinUniqueDates.add(parsedDate)
            }
            if (index === 99 || (index % 1000 === 0 && index > 0)) {
              const uniqueDates = Array.from((globalThis as any).redfinUniqueDates).sort()
              console.log(`   📅 Unique dates parsed so far (${uniqueDates.length}): ${uniqueDates.slice(0, 20).join(', ')}${uniqueDates.length > 20 ? '...' : ''}`)
            }
          }
        } else {
          // Data format: date columns (YYYY-MM-DD format)
          const dateColumns = Object.keys(record).filter(key => 
            /^\d{4}-\d{2}-\d{2}$/.test(key)
          )

          // Log first region's structure for debugging
          if (index === 0) {
            console.log(`\n🔍 First region structure (Data format):`)
            console.log(`   Region: ${regionName}`)
            console.log(`   Date columns found: ${dateColumns.length}`)
            if (dateColumns.length > 0) {
              console.log(`   Sample date columns: ${dateColumns.slice(0, 5).join(', ')}`)
            }
          }

          for (const dateCol of dateColumns) {
            const rawValue = record[dateCol]
            const value = typeof rawValue === 'string' 
              ? parseFloat(rawValue.replace(/[,$]/g, '')) // Remove commas and dollar signs
              : parseFloat(rawValue)
            
            if (!isNaN(value) && value > 0) {
              // Push directly to chunkTimeSeriesData to avoid stack overflow from spread operator
              chunkTimeSeriesData.push({
                region_id: regionId,
                date: dateCol,
                metric_name: metricName,
                metric_value: value,
                data_source: 'redfin',
                attributes: {
                  region_type: regionType,
                  state_code: stateCode || undefined,
                  source_file: sourceFileName || undefined
                }
              })
              timeSeriesCount++
            }
          }
        }

      } catch (error: any) {
        console.error(`❌ Error processing row ${index}:`, error.message)
        errors++
        errorDetails.push({
          region: `Row ${index}`,
          error: error.message
        })
      }
    }
    
    // Process this chunk: deduplicate and insert
    if (chunkTimeSeriesData.length > 0) {
      console.log(`   Collected ${chunkTimeSeriesData.length} time series records from chunk ${chunkIndex + 1}`)
      
      // Deduplicate this chunk
      // Create a deterministic key that matches the database constraint without using JSON.stringify
      // to avoid stack overflow with large attributes objects
      const uniqueTimeSeriesMap = new Map<string, TimeSeriesRecord>()
      for (const record of chunkTimeSeriesData) {
        // Build key from attributes fields without JSON.stringify
        // This matches the database constraint: region_id,date,metric_name,data_source,attributes
        const attrs = record.attributes || {}
        const attrParts: string[] = []
        if (attrs.region_type) attrParts.push(`rt:${attrs.region_type}`)
        if (attrs.state_code) attrParts.push(`sc:${attrs.state_code}`)
        if (attrs.format) attrParts.push(`fmt:${attrs.format}`)
        if (attrs.original_column) attrParts.push(`col:${attrs.original_column}`)
        if (attrs.is_percentage !== undefined) attrParts.push(`pct:${attrs.is_percentage}`)
        if (attrs.metric_type) attrParts.push(`mt:${attrs.metric_type}`)
        if (attrs.source_file) attrParts.push(`file:${attrs.source_file}`)
        const attrKey = attrParts.join('|')
        
        const uniqueKey = `${record.region_id}|${record.date}|${record.metric_name}|${record.data_source}|${attrKey}`
        uniqueTimeSeriesMap.set(uniqueKey, record)
      }
      
      const uniqueChunkData = Array.from(uniqueTimeSeriesMap.values())
      console.log(`   Deduplicated: ${chunkTimeSeriesData.length} -> ${uniqueChunkData.length} unique records`)
      
      // Insert this chunk in batches
      const batchSize = 2000
      const totalBatches = Math.ceil(uniqueChunkData.length / batchSize)
      
      for (let i = 0; i < uniqueChunkData.length; i += batchSize) {
        const batch = uniqueChunkData.slice(i, i + batchSize)
        const batchNum = Math.floor(i / batchSize) + 1
        const globalBatchNum = (chunkIndex * Math.ceil(uniqueChunkData.length / batchSize)) + batchNum
        
        // Calculate progress across all chunks
        const totalEstimatedBatches = totalChunks * Math.ceil((uniqueChunkData.length || 1) / batchSize)
        if (onProgress && (batchNum % 5 === 0 || batchNum === totalBatches)) {
          const percent = Math.round((globalBatchNum / Math.max(totalEstimatedBatches, 1)) * 100)
          const progressMessage = `Inserting batch ${globalBatchNum} (chunk ${chunkIndex + 1}/${totalChunks}, batch ${batchNum}/${totalBatches}, ${batch.length} records)...`
          onProgress(progressMessage, { current: globalBatchNum, total: totalEstimatedBatches, percent })
        }
        
        try {
          const { error: tsError } = await supabase
            .from('market_time_series')
            .upsert(batch, {
              onConflict: 'region_id,date,metric_name,data_source,attributes',
              ignoreDuplicates: false
            })

          if (tsError) {
            console.error(`❌ Error upserting batch ${globalBatchNum} (chunk ${chunkIndex + 1}, batch ${batchNum}):`, tsError.message)
            errorDetails.push({
              chunk: chunkIndex + 1,
              batch: batchNum,
              error: tsError.message,
              code: tsError.code
            })
            errors++
          } else {
            totalTimeSeriesInserted += batch.length
          }
        } catch (fetchError: any) {
          console.error(`❌ Fetch error upserting batch ${globalBatchNum}:`, fetchError.message)
          errorDetails.push({
            chunk: chunkIndex + 1,
            batch: batchNum,
            error: `Fetch failed: ${fetchError.message}`,
            code: 'FETCH_ERROR'
          })
          errors++
        }
      }
      
      console.log(`   ✅ Inserted ${uniqueChunkData.length} records from chunk ${chunkIndex + 1}`)
    }
    }

    const timeSeriesInserted = totalTimeSeriesInserted
    console.log(`✅ Successfully inserted ${timeSeriesInserted} time series records total`)

    // Show unique dates summary
    if ((globalThis as any).redfinUniqueDates) {
      const uniqueDates = Array.from((globalThis as any).redfinUniqueDates).sort()
      console.log(`\n📅 Unique dates parsed: ${uniqueDates.length}`)
      if (uniqueDates.length > 0) {
        console.log(`   Date range: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`)
        if (uniqueDates.length <= 20) {
          console.log(`   All dates: ${uniqueDates.join(', ')}`)
        } else {
          console.log(`   First 10: ${uniqueDates.slice(0, 10).join(', ')}`)
          console.log(`   Last 10: ${uniqueDates.slice(-10).join(', ')}`)
        }
      }
      // Clean up
      delete (globalThis as any).redfinUniqueDates
    }

    console.log('\n📊 Redfin Import Summary')
    console.log('================')
    console.log(`✅ Markets created: ${marketsCreated}`)
    console.log(`✅ Time series records inserted: ${timeSeriesInserted}`)
    if (errors > 0) {
      console.log(`❌ Errors: ${errors}`)
    }
    
    // If no time series records were imported, provide detailed diagnostics
    if (timeSeriesInserted === 0) {
      console.warn('\n⚠️ WARNING: No time series records were imported!')
      console.warn('   This could mean:')
      console.warn('   1. Date parsing failed for all rows')
      console.warn('   2. No valid metric values were found')
      console.warn('   3. CSV format detection failed')
      console.warn(`\n   Skipped rows breakdown:`)
      console.warn(`   - Missing region name: ${skippedNoRegion}`)
      console.warn(`   - Missing/invalid date: ${skippedNoDate}`)
      console.warn(`   - Missing/invalid metrics: ${skippedNoMetrics}`)
      console.warn(`\n   CSV Analysis: ${JSON.stringify(analysisResults, null, 2)}`)
      
      // Add skip counts to analysis
      analysisResults.skippedNoRegion = skippedNoRegion
      analysisResults.skippedNoDate = skippedNoDate
      analysisResults.skippedNoMetrics = skippedNoMetrics
    }

    return {
      success: errors === 0,
      message: `Imported Redfin data: ${marketsCreated} markets, ${timeSeriesInserted} time series records`,
      details: {
        marketsCreated,
        timeSeriesInserted,
        errors,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
        analysis: timeSeriesInserted === 0 ? analysisResults : undefined
      }
    }

  } catch (error: any) {
    console.error('❌ Error downloading or parsing Redfin data:', error.message)
    throw error
  }
}

/**
 * Import Redfin data from uploaded file
 * This is an alternative method when automatic download doesn't work
 */
export async function importRedfinDataFromFile(
  csvContent: string,
  metricName: string = 'median_sale_price',
  limitRows?: number,
  onProgress?: (message: string, progress?: { current: number; total: number; percent: number }) => void,
  sourceFileName?: string
) {
  console.log(`\n📁 importRedfinDataFromFile called`)
  console.log(`   CSV length: ${csvContent.length} chars`)
  console.log(`   Metric: ${metricName || '(auto-detect)'}`)
  console.log(`   Source file: ${sourceFileName || '(not specified)'}`)
  return importRedfinData(metricName, limitRows, csvContent, undefined, onProgress, sourceFileName)
}

