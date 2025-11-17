/**
 * Discover Redfin datasets from S3 URLs on the Data Center page
 * This script finds all direct S3 download links and creates a manifest
 */

import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

interface RedfinDataset {
  name: string
  description: string
  url: string
  category: string
  geographicLevel: string
  format: 'tsv' | 'csv'
  compressed: boolean
}

// Known S3 base URLs for Redfin data
const REDFIN_S3_BASE = 'https://redfin-public-data.s3.us-west-2.amazonaws.com'

// Geographic levels we found
const GEOGRAPHIC_LEVELS = [
  { level: 'national', url: 'redfin_market_tracker/us_national_market_tracker.tsv000.gz', name: 'National' },
  { level: 'metro', url: 'redfin_market_tracker/redfin_metro_market_tracker.tsv000.gz', name: 'Metro' },
  { level: 'state', url: 'redfin_market_tracker/state_market_tracker.tsv000.gz', name: 'State' },
  { level: 'county', url: 'redfin_market_tracker/county_market_tracker.tsv000.gz', name: 'County' },
  { level: 'city', url: 'redfin_market_tracker/city_market_tracker.tsv000.gz', name: 'City' },
  { level: 'zip', url: 'redfin_market_tracker/zip_code_market_tracker.tsv000.gz', name: 'Zip Code' },
  { level: 'neighborhood', url: 'redfin_market_tracker/neighborhood_market_tracker.tsv000.gz', name: 'Neighborhood' },
  { level: 'weekly', url: 'redfin_covid19/weekly_housing_market_data_most_recent.tsv000.gz', name: 'Weekly Housing Market Data' },
]

/**
 * Discover all S3 download links from the Redfin Data Center page
 */
async function discoverRedfinS3Datasets(): Promise<RedfinDataset[]> {
  console.log('🔍 Discovering Redfin S3 datasets...\n')
  
  const datasets: RedfinDataset[] = []
  
  // First, add known S3 URLs
  console.log('📋 Adding known S3 URLs...\n')
  for (const geo of GEOGRAPHIC_LEVELS) {
    const fullUrl = `${REDFIN_S3_BASE}/${geo.url}`
    const category = geo.level === 'weekly' ? 'weekly' : 'housing_market'
    const geographicLevel = geo.level === 'weekly' ? 'multiple' : geo.level
    
    const dataset: RedfinDataset = {
      name: `${category}_${geographicLevel}`,
      description: `${geo.name} Market Tracker`,
      url: fullUrl,
      category,
      geographicLevel,
      format: 'tsv',
      compressed: true
    }
    
    datasets.push(dataset)
    console.log(`  ✅ ${dataset.description} (${geographicLevel})`)
    console.log(`     URL: ${fullUrl}`)
  }
  
  console.log(`\n✅ Added ${datasets.length} known datasets\n`)
  
  // Use Puppeteer to scrape the page for additional S3 links
  let puppeteer
  try {
    puppeteer = require('puppeteer')
  } catch (error) {
    // Try to load from web directory if not in root
    try {
      puppeteer = require('../web/node_modules/puppeteer')
    } catch (e) {
      throw new Error('Puppeteer not found. Please install it: npm install puppeteer')
    }
  }
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    
    console.log('📥 Navigating to Redfin Data Center...')
    await page.goto('https://www.redfin.com/news/data-center/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    })

    // Wait for page to load and let JavaScript execute
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Scroll to load lazy-loaded content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await new Promise(resolve => setTimeout(resolve, 3000))
    await page.evaluate(() => {
      window.scrollTo(0, 0)
    })
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Extract all links - both S3 and potential download links
    const allLinks = await page.evaluate(() => {
      const links: Array<{ href: string; text: string; context: string; tagName: string }> = []
      
      // Find all anchor tags and buttons
      const anchorTags = document.querySelectorAll('a, button, [data-download], [href*="download"], [href*=".tsv"], [href*=".csv"], [href*=".gz"]')
      
      anchorTags.forEach((element) => {
        const href = (element as HTMLAnchorElement).href || (element as HTMLElement).getAttribute('data-url') || ''
        const text = element.textContent?.trim() || (element as HTMLElement).getAttribute('aria-label') || ''
        const tagName = element.tagName.toLowerCase()
        
        // Check if it's an S3 link, download link, or data file
        if (href.includes('redfin-public-data.s3') || 
            href.includes('s3.us-west-2.amazonaws.com/redfin') ||
            href.includes('redfin') && (href.includes('.tsv') || href.includes('.csv') || href.includes('.gz')) ||
            text.toLowerCase().includes('download') ||
            text.toLowerCase().includes('data') ||
            element.getAttribute('data-download')) {
          
          // Get context from parent elements
          let context = ''
          let parent = element.parentElement
          for (let i = 0; i < 3 && parent; i++) {
            context = parent.textContent?.trim().substring(0, 300) || ''
            if (context.length > 50) break
            parent = parent.parentElement
          }
          
          links.push({ href, text, context, tagName })
        }
      })
      
      // Also check for any text that looks like S3 URLs
      const pageText = document.body.innerText
      const s3UrlPattern = /https?:\/\/[^\s]*redfin[^\s]*s3[^\s]*(?:tsv|csv|gz)[^\s]*/gi
      const urlMatches = pageText.match(s3UrlPattern)
      if (urlMatches) {
        urlMatches.forEach(url => {
          if (!links.find(l => l.href === url)) {
            links.push({ href: url, text: 'Found in page text', context: '', tagName: 'text' })
          }
        })
      }
      
      return links
    })
    
    console.log(`\n📋 Found ${allLinks.length} potential data links (S3, downloads, data files)\n`)
    
    // Filter to S3 links
    const s3Links = allLinks.filter(link => 
      link.href.includes('redfin-public-data.s3') || 
      link.href.includes('s3.us-west-2.amazonaws.com/redfin')
    )
    
    // Log all links for debugging
    if (allLinks.length > s3Links.length) {
      console.log(`\n📋 Non-S3 data links found (may need manual inspection):`)
      allLinks.filter(link => !s3Links.includes(link)).forEach(link => {
        console.log(`  - ${link.text || 'No text'}: ${link.href.substring(0, 100)}`)
      })
    }

    console.log(`\n✅ Found ${s3Links.length} additional S3 download links from page scraping\n`)

    // Process each link (only add if not already in datasets)
    for (const link of s3Links) {
      const url = link.href
      
      // Skip if we already have this URL
      if (datasets.find(d => d.url === url)) {
        continue
      }
      
      // Determine category and geographic level
      let category = 'housing_market'
      let geographicLevel = 'unknown'
      let description = link.text || 'Redfin Market Data'
      
      if (url.includes('covid19') || url.includes('weekly')) {
        category = 'weekly'
        geographicLevel = 'multiple'
        description = 'Weekly Housing Market Data'
      } else if (url.includes('national')) {
        geographicLevel = 'national'
        description = 'National Market Tracker'
      } else if (url.includes('metro')) {
        geographicLevel = 'metro'
        description = 'Metro Market Tracker'
      } else if (url.includes('state')) {
        geographicLevel = 'state'
        description = 'State Market Tracker'
      } else if (url.includes('county')) {
        geographicLevel = 'county'
        description = 'County Market Tracker'
      } else if (url.includes('city')) {
        geographicLevel = 'city'
        description = 'City Market Tracker'
      } else if (url.includes('zip')) {
        geographicLevel = 'zip'
        description = 'Zip Code Market Tracker'
      } else if (url.includes('neighborhood')) {
        geographicLevel = 'neighborhood'
        description = 'Neighborhood Market Tracker'
      }

      // Determine format
      const format = url.includes('.tsv') ? 'tsv' : 'csv'
      const compressed = url.includes('.gz') || url.includes('.zip')

      // Create dataset entry
      const dataset: RedfinDataset = {
        name: `${category}_${geographicLevel}`,
        description,
        url,
        category,
        geographicLevel,
        format,
        compressed
      }

      datasets.push(dataset)
      console.log(`  ✅ ${description} (${geographicLevel})`)
      console.log(`     URL: ${url}`)
    }

    // Check the main Redfin Data Center page for Tableau dashboard
    console.log('\n📊 Checking Redfin Data Center for Tableau dashboard download options...\n')
    
    try {
      // Navigate back to main data center page
      await page.goto('https://www.redfin.com/news/data-center/', {
        waitUntil: 'networkidle2',
        timeout: 60000
      })
      
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Look for Tableau iframe or embedded content
      const iframes = await page.$$('iframe')
      let tableauFrame = null
      
      for (const iframe of iframes) {
        const src = await iframe.evaluate(el => (el as HTMLIFrameElement).src)
        if (src && (src.includes('tableau') || src.includes('public.tableau.com'))) {
          console.log(`  ✅ Found Tableau iframe: ${src}`)
          tableauFrame = iframe
          break
        }
      }
      
      const tableauInfo = await (tableauFrame ? 
        tableauFrame.contentFrame()?.evaluate(() => {
          const info: {
            hasTableau: boolean
            downloadButtons: Array<{ text: string; selector: string; position: string; classList: string }>
            metrics: string[]
            geographicLevels: string[]
            allButtons: Array<{ text: string; position: string }>
          } = {
            hasTableau: true,
            downloadButtons: [],
            metrics: [],
            geographicLevels: [],
            allButtons: []
          }
          
          // Get ALL buttons to see what's available
          const allButtons = document.querySelectorAll('button, a, [role="button"], [class*="icon"], svg, [class*="toolbar"]')
          allButtons.forEach((btn, index) => {
            const text = btn.textContent?.trim() || ''
            const ariaLabel = (btn as HTMLElement).getAttribute('aria-label') || ''
            const title = (btn as HTMLElement).getAttribute('title') || ''
            const className = btn.className || ''
            const classList = Array.from(btn.classList || []).join(' ')
            
            const rect = btn.getBoundingClientRect()
            const position = `x:${Math.round(rect.left)}, y:${Math.round(rect.top)}, width:${Math.round(rect.width)}, height:${Math.round(rect.height)}`
            
            // Log all buttons for debugging
            if (rect.width > 0 && rect.height > 0) {
              info.allButtons.push({
                text: text || ariaLabel || title || `Button ${index}`,
                position
              })
            }
            
            // Check for download-related buttons
            const downloadKeywords = ['download', 'export', 'data', 'csv', 'excel', 'tsv', 'save']
            const hasDownloadKeyword = 
              downloadKeywords.some(kw => 
                text.toLowerCase().includes(kw) || 
                ariaLabel.toLowerCase().includes(kw) ||
                title.toLowerCase().includes(kw) ||
                className.toLowerCase().includes(kw) ||
                classList.toLowerCase().includes(kw)
              )
            
            // Also check if it's in bottom right area (common for download icons)
            const isBottomRight = rect.top > window.innerHeight * 0.7 && rect.left > window.innerWidth * 0.7
            
            if (hasDownloadKeyword || isBottomRight) {
              info.downloadButtons.push({
                text: text || ariaLabel || title || `Button ${index}`,
                selector: `${btn.tagName.toLowerCase()}${classList ? '.' + classList.split(' ').join('.') : ''}`,
                position,
                classList
              })
            }
          })
          
          // Look for metric dropdowns/selects
          const selects = document.querySelectorAll('select, [role="combobox"], [class*="metric"], [class*="dropdown"]')
          selects.forEach(select => {
            const options = select.querySelectorAll('option')
            options.forEach(option => {
              const text = option.textContent?.trim()
              if (text && text.length > 0 && text.length < 100) {
                if (select.getAttribute('name')?.toLowerCase().includes('metric') ||
                    select.className.toLowerCase().includes('metric')) {
                  info.metrics.push(text)
                }
                if (select.getAttribute('name')?.toLowerCase().includes('geographic') ||
                    select.className.toLowerCase().includes('geographic') ||
                    select.className.toLowerCase().includes('region')) {
                  info.geographicLevels.push(text)
                }
              }
            })
          })
          
          return info
        }) :
        page.evaluate(() => {
          return {
            hasTableau: false,
            downloadButtons: [],
            metrics: [],
            geographicLevels: [],
            allButtons: []
          }
        }))
      
      if (!tableauInfo) {
        tableauInfo = {
          hasTableau: false,
          downloadButtons: [],
          metrics: [],
          geographicLevels: [],
          allButtons: []
        }
      }
      
      if (tableauInfo.hasTableau) {
        console.log(`  ✅ Found Tableau dashboard content`)
      }
      
      if (tableauInfo.allButtons && tableauInfo.allButtons.length > 0) {
        console.log(`  📋 Found ${tableauInfo.allButtons.length} total interactive elements in Tableau`)
        // Show buttons in bottom right area
        const bottomRightButtons = tableauInfo.allButtons.filter(btn => {
          const y = parseInt(btn.position.split('y:')[1].split(',')[0])
          const x = parseInt(btn.position.split('x:')[1].split(',')[0])
          return y > 400 && x > 800
        })
        if (bottomRightButtons.length > 0) {
          console.log(`     Bottom-right area buttons (likely download icon):`)
          bottomRightButtons.forEach(btn => {
            console.log(`       - "${btn.text}" at ${btn.position}`)
          })
        }
      }
      
      if (tableauInfo.downloadButtons && tableauInfo.downloadButtons.length > 0) {
        console.log(`  ✅ Found ${tableauInfo.downloadButtons.length} potential download button(s):`)
        tableauInfo.downloadButtons.forEach(btn => {
          console.log(`     - "${btn.text}" at position ${btn.position}`)
          console.log(`       Classes: ${btn.classList}`)
        })
      }
      
      if (tableauInfo.metrics.length > 0) {
        console.log(`  ✅ Found ${tableauInfo.metrics.length} available metrics:`)
        tableauInfo.metrics.forEach(metric => {
          console.log(`     - ${metric}`)
        })
      }
      
      if (tableauInfo.geographicLevels.length > 0) {
        console.log(`  ✅ Found ${tableauInfo.geographicLevels.length} geographic levels:`)
        tableauInfo.geographicLevels.forEach(level => {
          console.log(`     - ${level}`)
        })
      }
      
      // Try to click the download button and see what options appear
      if (tableauFrame && tableauInfo.downloadButtons && tableauInfo.downloadButtons.length > 0) {
        console.log(`\n  🔍 Attempting to interact with download button in iframe...`)
        
        const frame = await tableauFrame.contentFrame()
        if (frame) {
          // Find the button in bottom right (usually the download icon)
          const bottomRightButton = tableauInfo.downloadButtons.find(btn => {
            const y = parseInt(btn.position.split('y:')[1].split(',')[0])
            const x = parseInt(btn.position.split('x:')[1].split(',')[0])
            // Bottom right would be high y and high x values
            return y > 400 && x > 800
          })
          
          if (bottomRightButton) {
            try {
              // Try to click it in the iframe
              await frame.evaluate((selector) => {
                const btn = document.querySelector(selector)
                if (btn) {
                  (btn as HTMLElement).click()
                }
              }, bottomRightButton.selector)
              
              await new Promise(resolve => setTimeout(resolve, 3000))
              
              // Check for download menu/options that appeared in iframe
              const downloadOptions = await frame.evaluate(() => {
                const options: Array<{ text: string; href?: string }> = []
                const menus = document.querySelectorAll('[role="menu"], [class*="menu"], [class*="dropdown"], [class*="popup"], [class*="dialog"]')
                menus.forEach(menu => {
                  const items = menu.querySelectorAll('a, button, [role="menuitem"], [role="option"]')
                  items.forEach(item => {
                    const text = item.textContent?.trim()
                    const href = (item as HTMLAnchorElement).href || ''
                    if (text) {
                      options.push({ text, href })
                    }
                  })
                })
                return options
              })
              
              if (downloadOptions.length > 0) {
                console.log(`     ✅ Found ${downloadOptions.length} download format options:`)
                downloadOptions.forEach(opt => {
                  console.log(`        - ${opt.text}${opt.href ? ` (${opt.href.substring(0, 80)})` : ''}`)
                })
              } else {
                console.log(`     ℹ️  Clicked button but no menu appeared (may need different approach)`)
              }
            } catch (error: any) {
              console.log(`     ⚠️  Could not interact with button: ${error.message}`)
            }
          }
        }
      }
      
    } catch (error: any) {
      console.warn(`  ⚠️  Error checking Tableau dashboard: ${error.message}`)
    }
    
    // Also check for other data center pages
    const otherPages = [
      'https://www.redfin.com/news/data-center/investor-data/',
      'https://www.redfin.com/news/data-center/rental-market-data/',
      'https://www.redfin.com/news/data-center/buyers-vs-sellers-dynamics/',
    ]

    for (const pageUrl of otherPages) {
      try {
        console.log(`\n📥 Checking ${pageUrl}...`)
        await page.goto(pageUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        })
        
        await new Promise(resolve => setTimeout(resolve, 3000))

        const additionalLinks = await page.evaluate(() => {
          const links: Array<{ href: string; text: string }> = []
          const anchorTags = document.querySelectorAll('a')
          
          anchorTags.forEach((link) => {
            const href = (link as HTMLAnchorElement).href || ''
            if (href.includes('redfin-public-data.s3') || 
                href.includes('s3.us-west-2.amazonaws.com/redfin')) {
              links.push({
                href,
                text: link.textContent?.trim() || ''
              })
            }
          })
          
          return links
        })

        for (const link of additionalLinks) {
          // Check if we already have this URL
          if (!datasets.find(d => d.url === link.href)) {
            let category = 'other'
            if (pageUrl.includes('investor')) category = 'investor'
            else if (pageUrl.includes('rental')) category = 'rental'
            else if (pageUrl.includes('buyers-vs-sellers')) category = 'market_dynamics'

            const format = link.href.includes('.tsv') ? 'tsv' : 'csv'
            const compressed = link.href.includes('.gz') || link.href.includes('.zip')

            datasets.push({
              name: `${category}_${datasets.length}`,
              description: link.text || `${category} data`,
              url: link.href,
              category,
              geographicLevel: 'unknown',
              format,
              compressed
            })
            
            console.log(`  ✅ Found: ${link.text || link.href}`)
          }
        }
      } catch (error: any) {
        console.warn(`  ⚠️  Could not check ${pageUrl}: ${error.message}`)
      }
    }

  } finally {
    await browser.close()
  }

  return datasets
}

/**
 * Verify that S3 URLs are accessible
 */
async function verifyS3Urls(datasets: RedfinDataset[]): Promise<void> {
  console.log('\n🔍 Verifying S3 URLs are accessible...\n')
  
  for (const dataset of datasets) {
    try {
      const response = await axios.head(dataset.url, {
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 200-499
      })
      
      if (response.status === 200) {
        const size = response.headers['content-length']
        const sizeMB = size ? (parseInt(size) / 1024 / 1024).toFixed(2) : 'unknown'
        console.log(`  ✅ ${dataset.description}: ${sizeMB} MB`)
      } else {
        console.log(`  ⚠️  ${dataset.description}: HTTP ${response.status}`)
      }
    } catch (error: any) {
      console.log(`  ❌ ${dataset.description}: ${error.message}`)
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Discover datasets
    const datasets = await discoverRedfinS3Datasets()
    
    console.log(`\n📊 Discovery Summary:`)
    console.log(`   Total datasets found: ${datasets.length}`)
    console.log(`   Categories: ${[...new Set(datasets.map(d => d.category))].join(', ')}`)
    console.log(`   Geographic levels: ${[...new Set(datasets.map(d => d.geographicLevel))].join(', ')}`)

    // Verify URLs
    await verifyS3Urls(datasets)

    // Save manifest
    const manifestPath = path.join(process.cwd(), 'redfin_downloads', 's3-manifest.json')
    const manifestDir = path.dirname(manifestPath)
    
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true })
    }

    const manifest = {
      version: '2.0',
      discovered_at: new Date().toISOString(),
      total_datasets: datasets.length,
      datasets: datasets.map(d => ({
        name: d.name,
        description: d.description,
        url: d.url,
        category: d.category,
        geographic_level: d.geographicLevel,
        format: d.format,
        compressed: d.compressed
      }))
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    console.log(`\n✅ Manifest saved to: ${manifestPath}`)

    // Also create a TypeScript-friendly version
    const tsManifestPath = path.join(process.cwd(), 'redfin_downloads', 's3-manifest.ts')
    const tsContent = `// Auto-generated Redfin S3 Dataset Manifest
// Generated at: ${new Date().toISOString()}

export interface RedfinS3Dataset {
  name: string
  description: string
  url: string
  category: string
  geographic_level: string
  format: 'tsv' | 'csv'
  compressed: boolean
}

export const REDFIN_S3_DATASETS: RedfinS3Dataset[] = ${JSON.stringify(manifest.datasets, null, 2)} as RedfinS3Dataset[]

export const REDFIN_S3_MANIFEST = {
  version: '${manifest.version}',
  discovered_at: '${manifest.discovered_at}',
  total_datasets: ${manifest.total_datasets},
  datasets: REDFIN_S3_DATASETS
}
`
    fs.writeFileSync(tsManifestPath, tsContent)
    console.log(`✅ TypeScript manifest saved to: ${tsManifestPath}`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

export { discoverRedfinS3Datasets, verifyS3Urls }

