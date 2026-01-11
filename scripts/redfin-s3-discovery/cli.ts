/**
 * CLI Entry Point for Redfin S3 Discovery
 */

import { discoverRedfinS3Datasets } from './discoverer';
import { verifyS3Urls } from './verifier';
import { saveManifest } from './manifest-writer';

/**
 * Main CLI function
 */
export async function main(): Promise<void> {
  try {
    // Discover datasets
    const datasets = await discoverRedfinS3Datasets();

    console.log(`\nDiscovery Summary:`);
    console.log(`   Total datasets found: ${datasets.length}`);
    console.log(`   Categories: ${[...new Set(datasets.map(d => d.category))].join(', ')}`);
    console.log(`   Geographic levels: ${[...new Set(datasets.map(d => d.geographicLevel))].join(', ')}`);

    // Verify URLs
    await verifyS3Urls(datasets);

    // Save manifest
    saveManifest(datasets);

  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}
