/**
 * Download utilities for Zillow datasets
 */

import axios from 'axios';
import type { DownloadResult, DatasetConfig } from './types';

/**
 * Download a Zillow dataset
 */
export async function downloadDataset(config: DatasetConfig): Promise<DownloadResult> {
  try {
    console.log(`  📥 Downloading from: ${config.downloadUrl}`);
    const response = await axios.get(config.downloadUrl, {
      timeout: 120000,
      maxContentLength: 200 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const csvContent = response.data;
    const sizeKB = (csvContent.length / 1024).toFixed(1);
    console.log(`  ✅ Downloaded ${sizeKB} KB`);

    return { success: true, csvContent };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
