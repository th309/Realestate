/**
 * Redfin Data Center - Dataset Discovery
 * Uses Puppeteer to discover available datasets from Redfin Data Center
 */

import puppeteer from 'puppeteer'
import { REDFIN_DATA_CENTER_URL } from './constants'
import type { DiscoveredDataset } from './types'

/**
 * Categorize dataset based on text content
 */
function categorizeDataset(text: string): string {
    const lowerText = text.toLowerCase()

    if (lowerText.includes('rent') || lowerText.includes('rental')) {
        return 'rental'
    } else if (lowerText.includes('investor') || lowerText.includes('flip') || lowerText.includes('cash') || lowerText.includes('institutional')) {
        return 'investor'
    } else if (lowerText.includes('sale') || lowerText.includes('sold')) {
        return 'sales'
    } else if (lowerText.includes('inventory') || lowerText.includes('listing')) {
        return 'inventory'
    } else if (lowerText.includes('days') || lowerText.includes('market') || lowerText.includes('price cut') || lowerText.includes('dom')) {
        return 'activity'
    } else if (lowerText.includes('price') || lowerText.includes('square') || lowerText.includes('foot') || lowerText.includes('sqft')) {
        return 'price'
    } else if (lowerText.includes('afford') || lowerText.includes('income')) {
        return 'affordability'
    }
    return 'other'
}

/**
 * Discover all available datasets on Redfin Data Center page
 */
export async function discoverRedfinDatasets(): Promise<DiscoveredDataset[]> {
    console.log('🔍 Discovering all Redfin datasets...')

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
        const page = await browser.newPage()
        page.setDefaultTimeout(60000)

        console.log('📥 Navigating to Redfin Data Center...')
        await page.goto(REDFIN_DATA_CENTER_URL, {
            waitUntil: 'networkidle2',
            timeout: 60000
        })

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

        // Find tabs
        console.log('🔍 Looking for tabbed structure...')
        const tabs = await page.evaluate(() => {
            const tabSelectors = [
                'button[role="tab"]', '[role="tab"]', '.tab',
                '[class*="tab"]', '[class*="Tab"]', 'nav a', 'nav button'
            ]

            const foundTabs: Array<{ text: string }> = []

            for (const selector of tabSelectors) {
                const elements = document.querySelectorAll(selector)
                elements.forEach((el) => {
                    const text = el.textContent?.trim() || ''
                    if (text && text.length > 0 && text.length < 50) {
                        foundTabs.push({ text })
                    }
                })
            }

            const uniqueTabs = foundTabs.filter((tab, index, self) =>
                index === self.findIndex(t => t.text === tab.text)
            )

            return uniqueTabs.map(t => t.text)
        })

        console.log(`📑 Found ${tabs.length} tabs: ${tabs.join(', ')}`)

        const allDatasets: DiscoveredDataset[] = []

        // Click through each tab and collect datasets
        for (const tabText of tabs) {
            try {
                console.log(`\n📑 Clicking tab: ${tabText}`)

                const tabClicked = await page.evaluate((tabName) => {
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
                    await new Promise(resolve => setTimeout(resolve, 3000))

                    const tabDatasets = await page.evaluate((tabName) => {
                        const links: DiscoveredDataset[] = []
                        const anchorTags = document.querySelectorAll('a')

                        anchorTags.forEach((link) => {
                            const href = (link as HTMLAnchorElement).href || ''
                            const text = link.textContent?.trim() || ''
                            const ariaLabel = link.getAttribute('aria-label') || ''
                            const title = link.getAttribute('title') || ''
                            const className = link.className || ''
                            const lowerText = (text + ' ' + ariaLabel + ' ' + title + ' ' + className).toLowerCase()

                            if (lowerText.includes('download') || lowerText.includes('csv') || lowerText.includes('export') ||
                                href.includes('.csv') || href.includes('.tsv') || href.includes('download')) {

                                let category = tabName.toLowerCase()
                                if (category.includes('rental')) category = 'rental'
                                else if (category.includes('investor')) category = 'investor'
                                else if (category.includes('sale')) category = 'sales'
                                else if (category.includes('inventory')) category = 'inventory'

                                links.push({
                                    name: text || ariaLabel || title || `${tabName} Data`,
                                    description: `${tabName}: ${text || ariaLabel || title || 'Download'}`,
                                    url: href,
                                    category
                                })
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

        // Search default tab for any remaining links
        console.log('\n🔍 Searching default tab for any remaining links...')
        const defaultTabDatasets = await page.evaluate(() => {
            const links: DiscoveredDataset[] = []
            const anchorTags = document.querySelectorAll('a')

            anchorTags.forEach((link) => {
                const href = (link as HTMLAnchorElement).href || ''
                const text = link.textContent?.trim() || ''
                const ariaLabel = link.getAttribute('aria-label') || ''
                const title = link.getAttribute('title') || ''
                const className = link.className || ''
                const lowerText = (text + ' ' + ariaLabel + ' ' + title + ' ' + className).toLowerCase()

                const isDownloadLink = href && (
                    href.includes('.csv') || href.includes('.tsv') || href.includes('download') ||
                    lowerText.includes('download') || lowerText.includes('csv') || lowerText.includes('export')
                )

                if (isDownloadLink) {
                    let category = 'other'
                    if (lowerText.includes('rent')) category = 'rental'
                    else if (lowerText.includes('investor')) category = 'investor'
                    else if (lowerText.includes('sale')) category = 'sales'
                    else if (lowerText.includes('inventory')) category = 'inventory'
                    else if (lowerText.includes('days') || lowerText.includes('market')) category = 'activity'
                    else if (lowerText.includes('price')) category = 'price'

                    links.push({
                        name: text || ariaLabel || title || 'Redfin Data',
                        description: text || ariaLabel || title || 'Redfin Data',
                        url: href,
                        category
                    })
                }
            })

            return links
        })

        const allDatasetsCombined = [...allDatasets, ...defaultTabDatasets]
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
