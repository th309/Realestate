/**
 * URL and Dataset Parsing Utilities
 */

import type { RedfinDataset, PageLink } from './types';

/**
 * Parse a dataset from URL and optional metadata
 */
export function parseDatasetFromUrl(
  url: string,
  text: string = '',
  defaultCategory: string = 'housing_market'
): RedfinDataset {
  let category = defaultCategory;
  let geographicLevel = 'unknown';
  let description = text || 'Redfin Market Data';

  if (url.includes('covid19') || url.includes('weekly')) {
    category = 'weekly';
    geographicLevel = 'multiple';
    description = 'Weekly Housing Market Data';
  } else if (url.includes('national')) {
    geographicLevel = 'national';
    description = 'National Market Tracker';
  } else if (url.includes('metro')) {
    geographicLevel = 'metro';
    description = 'Metro Market Tracker';
  } else if (url.includes('state')) {
    geographicLevel = 'state';
    description = 'State Market Tracker';
  } else if (url.includes('county')) {
    geographicLevel = 'county';
    description = 'County Market Tracker';
  } else if (url.includes('city')) {
    geographicLevel = 'city';
    description = 'City Market Tracker';
  } else if (url.includes('zip')) {
    geographicLevel = 'zip';
    description = 'Zip Code Market Tracker';
  } else if (url.includes('neighborhood')) {
    geographicLevel = 'neighborhood';
    description = 'Neighborhood Market Tracker';
  }

  const format: 'tsv' | 'csv' = url.includes('.tsv') ? 'tsv' : 'csv';
  const compressed = url.includes('.gz') || url.includes('.zip');

  return {
    name: `${category}_${geographicLevel}`,
    description,
    url,
    category,
    geographicLevel,
    format,
    compressed
  };
}

/**
 * Process scraped S3 links into datasets
 */
export function processS3Links(
  s3Links: PageLink[],
  existingDatasets: RedfinDataset[]
): RedfinDataset[] {
  const newDatasets: RedfinDataset[] = [];

  for (const link of s3Links) {
    const url = link.href;

    // Skip if we already have this URL
    if (existingDatasets.find(d => d.url === url)) {
      continue;
    }

    const dataset = parseDatasetFromUrl(url, link.text);
    newDatasets.push(dataset);
    console.log(`  Added ${dataset.description} (${dataset.geographicLevel})`);
    console.log(`     URL: ${url}`);
  }

  return newDatasets;
}
