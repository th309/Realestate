/**
 * Web Scraping Utilities for Redfin Discovery
 */

import { createRequire } from 'module';
import type { PageLink, RedfinDataset } from './types';
import { REDFIN_S3_BASE, GEOGRAPHIC_LEVELS, OTHER_DATA_PAGES } from './types';
import { parseDatasetFromUrl } from './parser';

const require = createRequire(import.meta.url);

/**
 * Load Puppeteer from available locations
 */
export function loadPuppeteer(): any {
  try {
    return require('puppeteer');
  } catch {
    try {
      return require('../web/node_modules/puppeteer');
    } catch {
      throw new Error('Puppeteer not found. Please install it: npm install puppeteer');
    }
  }
}

/**
 * Get known S3 datasets from predefined list
 */
export function getKnownDatasets(): RedfinDataset[] {
  console.log('Adding known S3 URLs...\n');
  const datasets: RedfinDataset[] = [];

  for (const geo of GEOGRAPHIC_LEVELS) {
    const fullUrl = `${REDFIN_S3_BASE}/${geo.url}`;
    const category = geo.level === 'weekly' ? 'weekly' : 'housing_market';
    const geographicLevel = geo.level === 'weekly' ? 'multiple' : geo.level;

    const dataset: RedfinDataset = {
      name: `${category}_${geographicLevel}`,
      description: `${geo.name} Market Tracker`,
      url: fullUrl,
      category,
      geographicLevel,
      format: 'tsv',
      compressed: true
    };

    datasets.push(dataset);
    console.log(`  Added ${dataset.description} (${geographicLevel})`);
    console.log(`     URL: ${fullUrl}`);
  }

  console.log(`\nAdded ${datasets.length} known datasets\n`);
  return datasets;
}

/**
 * Extract links from page content
 */
export async function extractLinksFromPage(page: any): Promise<PageLink[]> {
  return page.evaluate(() => {
    const links: PageLink[] = [];

    const anchorTags = document.querySelectorAll(
      'a, button, [data-download], [href*="download"], [href*=".tsv"], [href*=".csv"], [href*=".gz"]'
    );

    anchorTags.forEach((element: Element) => {
      const href = (element as HTMLAnchorElement).href ||
        (element as HTMLElement).getAttribute('data-url') || '';
      const text = element.textContent?.trim() ||
        (element as HTMLElement).getAttribute('aria-label') || '';
      const tagName = element.tagName.toLowerCase();

      if (isRelevantLink(href, text, element)) {
        let context = '';
        let parent = element.parentElement;
        for (let i = 0; i < 3 && parent; i++) {
          context = parent.textContent?.trim().substring(0, 300) || '';
          if (context.length > 50) break;
          parent = parent.parentElement;
        }

        links.push({ href, text, context, tagName });
      }
    });

    // Check for S3 URLs in page text
    const pageText = document.body.innerText;
    const s3UrlPattern = /https?:\/\/[^\s]*redfin[^\s]*s3[^\s]*(?:tsv|csv|gz)[^\s]*/gi;
    const urlMatches = pageText.match(s3UrlPattern);
    if (urlMatches) {
      urlMatches.forEach((url: string) => {
        if (!links.find(l => l.href === url)) {
          links.push({ href: url, text: 'Found in page text', context: '', tagName: 'text' });
        }
      });
    }

    return links;

    function isRelevantLink(href: string, text: string, element: Element): boolean {
      return href.includes('redfin-public-data.s3') ||
        href.includes('s3.us-west-2.amazonaws.com/redfin') ||
        (href.includes('redfin') && (href.includes('.tsv') || href.includes('.csv') || href.includes('.gz'))) ||
        text.toLowerCase().includes('download') ||
        text.toLowerCase().includes('data') ||
        !!element.getAttribute('data-download');
    }
  });
}

/**
 * Filter to S3 links only
 */
export function filterS3Links(links: PageLink[]): PageLink[] {
  return links.filter(link =>
    link.href.includes('redfin-public-data.s3') ||
    link.href.includes('s3.us-west-2.amazonaws.com/redfin')
  );
}

/**
 * Scrape additional data pages for S3 links
 */
export async function scrapeAdditionalPages(
  page: any,
  existingDatasets: RedfinDataset[]
): Promise<RedfinDataset[]> {
  const newDatasets: RedfinDataset[] = [];

  for (const pageUrl of OTHER_DATA_PAGES) {
    try {
      console.log(`\nChecking ${pageUrl}...`);
      await page.goto(pageUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const additionalLinks = await page.evaluate(() => {
        const links: Array<{ href: string; text: string }> = [];
        const anchorTags = document.querySelectorAll('a');

        anchorTags.forEach((link: HTMLAnchorElement) => {
          const href = link.href || '';
          if (href.includes('redfin-public-data.s3') ||
            href.includes('s3.us-west-2.amazonaws.com/redfin')) {
            links.push({
              href,
              text: link.textContent?.trim() || ''
            });
          }
        });

        return links;
      });

      for (const link of additionalLinks) {
        if (!existingDatasets.find(d => d.url === link.href) &&
          !newDatasets.find(d => d.url === link.href)) {

          let category = 'other';
          if (pageUrl.includes('investor')) category = 'investor';
          else if (pageUrl.includes('rental')) category = 'rental';
          else if (pageUrl.includes('buyers-vs-sellers')) category = 'market_dynamics';

          const dataset = parseDatasetFromUrl(link.href, link.text, category);
          newDatasets.push(dataset);
          console.log(`  Found: ${link.text || link.href}`);
        }
      }
    } catch (error: any) {
      console.warn(`  Could not check ${pageUrl}: ${error.message}`);
    }
  }

  return newDatasets;
}
