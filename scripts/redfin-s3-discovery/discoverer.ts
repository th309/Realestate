/**
 * Main Redfin S3 Dataset Discovery
 */

import type { RedfinDataset } from './types';
import {
  loadPuppeteer,
  getKnownDatasets,
  extractLinksFromPage,
  filterS3Links,
  scrapeAdditionalPages
} from './scraper';
import { processS3Links } from './parser';
import { inspectTableauDashboard } from './tableau-inspector';

/**
 * Discover all S3 download links from the Redfin Data Center page
 */
export async function discoverRedfinS3Datasets(): Promise<RedfinDataset[]> {
  console.log('Discovering Redfin S3 datasets...\n');

  // Start with known datasets
  const datasets: RedfinDataset[] = getKnownDatasets();

  // Load Puppeteer for web scraping
  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Navigate to Redfin Data Center
    console.log('Navigating to Redfin Data Center...');
    await page.goto('https://www.redfin.com/news/data-center/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 10000));

    // Scroll to load lazy-loaded content
    await scrollPage(page);

    // Extract all links from page
    const allLinks = await extractLinksFromPage(page);
    console.log(`\nFound ${allLinks.length} potential data links (S3, downloads, data files)\n`);

    // Filter to S3 links
    const s3Links = filterS3Links(allLinks);

    // Log non-S3 links for debugging
    if (allLinks.length > s3Links.length) {
      console.log(`\nNon-S3 data links found (may need manual inspection):`);
      allLinks
        .filter(link => !s3Links.some(s3 => s3.href === link.href))
        .forEach(link => {
          console.log(`  - ${link.text || 'No text'}: ${link.href.substring(0, 100)}`);
        });
    }

    console.log(`\nFound ${s3Links.length} additional S3 download links from page scraping\n`);

    // Process S3 links into datasets
    const newDatasets = processS3Links(s3Links, datasets);
    datasets.push(...newDatasets);

    // Check Tableau dashboard
    await inspectTableauDashboard(page);

    // Check other data pages
    const additionalDatasets = await scrapeAdditionalPages(page, datasets);
    datasets.push(...additionalDatasets);

  } finally {
    await browser.close();
  }

  return datasets;
}

/**
 * Scroll page to load lazy content
 */
async function scrollPage(page: any): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await new Promise(resolve => setTimeout(resolve, 3000));
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
}
