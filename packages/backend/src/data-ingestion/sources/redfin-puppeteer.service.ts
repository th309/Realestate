import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';

const REDFIN_DATA_CENTER_URL = 'https://www.redfin.com/news/data-center/';

export interface RedfinDataset {
    description: string;
    category: string;
    keywords: string[];
}

export const REDFIN_DATASETS: Record<string, RedfinDataset> = {
    median_sale_price: { description: 'Median Sale Price', category: 'sales', keywords: ['median', 'sale', 'price'] },
    homes_sold: { description: 'Homes Sold', category: 'sales', keywords: ['homes', 'sold'] },
    median_rent: { description: 'Median Rent', category: 'rental', keywords: ['median', 'rent'] },
    rental_inventory: { description: 'Rental Inventory', category: 'rental', keywords: ['rental', 'inventory'] },
    inventory: { description: 'Active Inventory', category: 'inventory', keywords: ['inventory', 'active'] },
    new_listings: { description: 'New Listings', category: 'inventory', keywords: ['new', 'listings'] },
    median_days_on_market: { description: 'Median Days on Market', category: 'activity', keywords: ['days', 'market', 'dom'] },
    price_cuts: { description: 'Price Cuts', category: 'activity', keywords: ['price', 'cuts', 'reduction'] },
    price_per_square_foot: { description: 'Price per Square Foot', category: 'price', keywords: ['price', 'square', 'foot', 'sqft'] }
};

@Injectable()
export class RedfinPuppeteerService {
    private readonly logger = new Logger(RedfinPuppeteerService.name);

    async downloadRedfinCSV(metricName: string, downloadUrl?: string): Promise<string> {
        const dataset = REDFIN_DATASETS[metricName];
        if (!dataset && !downloadUrl) {
            throw new Error(`Unknown metric: ${metricName}. Available: ${Object.keys(REDFIN_DATASETS).join(', ')}`);
        }

        this.logger.log(`Navigating to Redfin Data Center...`);

        // Launch puppeteer
        // Note: In production (e.g. Railway), might need specific args/executablePath depending on docker container.
        // For now assuming standard environment.
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            let downloadContent = '';

            // Intercept network responses
            page.on('response', async (response) => {
                const url = response.url();
                const headers = response.headers();
                const contentType = headers['content-type'] || '';

                if (url.includes('.csv') || url.includes('.tsv') ||
                    contentType.includes('text/csv') ||
                    contentType.includes('text/tab-separated-values') ||
                    (url.includes('redfin') && (url.includes('download') || url.includes('export')))) {
                    try {
                        // Only try to read text if it's likely the CSV we want
                        // To avoid memory issues with other assets, we generally hope this is the one.
                        // A more robust check might be needed if multiple CSVs load.
                        const text = await response.text();
                        if (text && text.length > 100) { // arbitrary small check
                            downloadContent = text;
                            this.logger.log(`Intercepted download from: ${url}`);
                        }
                    } catch (error) {
                        // Ignore response reading errors (redirects, etc)
                    }
                }
            });

            await page.goto(REDFIN_DATA_CENTER_URL, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Find and click the link
            let linkFound: string | null = null;

            if (downloadUrl) {
                linkFound = downloadUrl;
            } else if (dataset) {
                linkFound = await page.evaluate((keywords) => {
                    const links = Array.from(document.querySelectorAll('a'));
                    for (const link of links) {
                        const text = link.textContent?.toLowerCase() || '';
                        const href = link.getAttribute('href') || '';
                        const matchesAll = keywords.every(k => text.includes(k.toLowerCase()));
                        if (matchesAll && (href.includes('.csv') || href.includes('.tsv') || href.includes('download'))) {
                            return href;
                        }
                    }
                    return null;
                }, dataset.keywords);
            }

            if (linkFound) {
                this.logger.log(`Found download link: ${linkFound}`);

                if (linkFound.startsWith('http')) {
                    await page.goto(linkFound, { waitUntil: 'networkidle2', timeout: 30000 });
                } else {
                    // Try clicking
                    try {
                        await page.evaluate((href) => {
                            const el = document.querySelector(`a[href="${href}"]`) as HTMLElement;
                            if (el) el.click();
                        }, linkFound);
                    } catch (e) {
                        // fallback to navigation if possible
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                // Fallback strategy: find ANY csv link
                this.logger.warn('Specific link not found, looking for any CSV link...');
            }

            if (!downloadContent) {
                throw new Error('Download triggered but no content captured.');
            }

            return downloadContent;

        } catch (error: any) {
            this.logger.error(`Puppeteer error: ${error.message}`);
            throw error;
        } finally {
            await browser.close();
        }
    }
}
