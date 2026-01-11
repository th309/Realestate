/**
 * Zillow Dataset Downloader
 */

import axios from 'axios';
import type { DownloadResult } from './types';

/**
 * Download dataset from URL
 */
export async function downloadDataset(url: string): Promise<DownloadResult> {
  try {
    const response = await axios.get(url, {
      timeout: 120000,
      maxContentLength: 200 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    return { success: true, csvContent: response.data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
