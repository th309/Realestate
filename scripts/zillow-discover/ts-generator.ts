/**
 * TypeScript Configuration Generator
 */

import type { ZillowDataset } from './types';

/**
 * Generate TypeScript configuration file content
 */
export function generateTsConfig(datasets: ZillowDataset[]): string {
  return `/**
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

export const ZILLOW_DATASETS: ZillowDatasetConfig[] = ${JSON.stringify(datasets, null, 2)};

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
}

/**
 * Print summary of datasets by category
 */
export function printCategorySummary(datasets: ZillowDataset[]): void {
  console.log('\n📋 Summary by Category:');
  console.log('======================');

  const byCategory = new Map<string, number>();
  datasets.forEach(d => {
    byCategory.set(d.category, (byCategory.get(d.category) || 0) + 1);
  });

  Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count} datasets`);
    });
}

/**
 * Deduplicate datasets by URL
 */
export function deduplicateDatasets(datasets: ZillowDataset[]): ZillowDataset[] {
  return Array.from(
    new Map(datasets.map(d => [d.downloadUrl, d])).values()
  );
}
