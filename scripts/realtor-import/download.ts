/**
 * Download utilities for Realtor.com datasets
 */

import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DownloadResult, RealtorDatasetConfig } from './types';

const DATA_DIR = join(__dirname, '../../data/realtor');

/**
 * Download a Realtor.com dataset from URL
 */
export async function downloadDataset(url: string): Promise<DownloadResult> {
  try {
    console.log(`  📥 Downloading from: ${url}`);
    const response = await axios.get(url, {
      timeout: 120000,
      maxContentLength: 500 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const csvContent = response.data;
    const sizeKB = (csvContent.length / 1024).toFixed(1);
    console.log(`  ✅ Downloaded ${sizeKB} KB`);

    return { success: true, csvContent };
  } catch (error: any) {
    console.error(`  ❌ Download failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Load a dataset from local file (for historical data)
 */
export function loadFromFile(filename: string): DownloadResult {
  const filePath = join(DATA_DIR, filename);

  if (!existsSync(filePath)) {
    return { success: false, error: `File not found: ${filePath}` };
  }

  try {
    console.log(`  📂 Loading from: ${filePath}`);
    const csvContent = readFileSync(filePath, 'utf-8');
    const sizeKB = (csvContent.length / 1024).toFixed(1);
    console.log(`  ✅ Loaded ${sizeKB} KB`);

    return { success: true, csvContent };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get dataset content - from file if available, otherwise download
 */
export async function getDatasetContent(
  config: RealtorDatasetConfig,
  useHistoryFile: boolean = false
): Promise<DownloadResult> {
  if (useHistoryFile && config.historyFile) {
    return loadFromFile(config.historyFile);
  }

  return downloadDataset(config.downloadUrl);
}
