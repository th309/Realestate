/**
 * Redfin Data Center - CSV Downloader
 * Uses Puppeteer to download CSV files from Redfin Data Center
 */

import puppeteer from 'puppeteer'
import { REDFIN_DATA_CENTER_URL, REDFIN_DATASETS } from './constants'

/**
 * Download Redfin CSV using Puppeteer to intercept automatic downloads
 */
export async function downloadRedfinCSV(
    metricName: string,
    downloadUrl?: string
): Promise<string> {
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

        let downloadContent: string = ''
        let capturedUrl: string | null = null

        // Intercept network responses to capture the download
        page.on('response', async (response) => {
            const url = response.url()
            const contentType = response.headers()['content-type'] || ''

            if (url.includes('.csv') || url.includes('.tsv') ||
                contentType.includes('text/csv') ||
                contentType.includes('text/tab-separated-values') ||
                url.includes('redfin') && (url.includes('download') || url.includes('export'))) {
                try {
                    downloadContent = await response.text()
                    capturedUrl = url
                    console.log(`✅ Intercepted download from: ${url}`)
                } catch (error) {
                    console.warn(`⚠️ Could not read response from ${url}:`, error)
                }
            }
        })

        await page.goto(REDFIN_DATA_CENTER_URL, {
            waitUntil: 'networkidle2',
            timeout: 30000
        })

        await new Promise(resolve => setTimeout(resolve, 3000))

        try {
            let linkFound: string | null = null

            if (downloadUrl) {
                linkFound = downloadUrl
            } else if (dataset) {
                linkFound = await page.evaluate((keywords) => {
                    const links = Array.from(document.querySelectorAll('a'))
                    for (const link of links) {
                        const text = link.textContent?.toLowerCase() || ''
                        const href = link.getAttribute('href') || ''

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

                if (linkFound.startsWith('http')) {
                    await page.goto(linkFound, { waitUntil: 'networkidle2', timeout: 30000 })
                } else {
                    try {
                        await page.click(`a[href="${linkFound}"]`)
                    } catch (e) {
                        const fullUrl = linkFound.startsWith('/')
                            ? new URL(linkFound, REDFIN_DATA_CENTER_URL).href
                            : linkFound
                        await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 })
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 5000))
            } else {
                const csvLinks = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'))
                    return links
                        .map(link => link.getAttribute('href'))
                        .filter(href => href && (href.includes('.csv') || href.includes('.tsv') || href.includes('download')))
                })

                if (csvLinks.length > 0) {
                    console.log(`🔗 Found ${csvLinks.length} potential download links`)
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
            throw new Error('Could not automatically download from Redfin. Please provide the CSV file manually.')
        }

        if (!downloadContent || downloadContent.length === 0) {
            throw new Error('Download was triggered but content was not captured.')
        }

        console.log(`✅ Downloaded ${(downloadContent.length / 1024).toFixed(1)} KB`)
        return downloadContent

    } finally {
        await browser.close()
    }
}
