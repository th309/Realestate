/**
 * S3 URL Verification
 */

import axios from 'axios';
import type { RedfinDataset } from './types';

/**
 * Verify that S3 URLs are accessible
 */
export async function verifyS3Urls(datasets: RedfinDataset[]): Promise<void> {
  console.log('\nVerifying S3 URLs are accessible...\n');

  for (const dataset of datasets) {
    try {
      const response = await axios.head(dataset.url, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });

      if (response.status === 200) {
        const size = response.headers['content-length'];
        const sizeMB = size ? (parseInt(size) / 1024 / 1024).toFixed(2) : 'unknown';
        console.log(`  ${dataset.description}: ${sizeMB} MB`);
      } else {
        console.log(`  ${dataset.description}: HTTP ${response.status}`);
      }
    } catch (error: any) {
      console.log(`  ${dataset.description}: ${error.message}`);
    }
  }
}
