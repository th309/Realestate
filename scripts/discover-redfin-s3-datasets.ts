/**
 * Discover Redfin datasets from S3 URLs on the Data Center page
 * This script finds all direct S3 download links and creates a manifest
 *
 * Refactored to use modular components from ./redfin-s3-discovery/
 */

import { discoverRedfinS3Datasets } from './redfin-s3-discovery/discoverer';
import { verifyS3Urls } from './redfin-s3-discovery/verifier';
import { main } from './redfin-s3-discovery/cli';

// Run if executed directly
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { discoverRedfinS3Datasets, verifyS3Urls };
