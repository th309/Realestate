/**
 * Data file loader for import scripts.
 *
 * Loads CSV, TSV, or XLSX files from a local path or remote URL.
 * Local files are resolved relative to the project `data/` directory.
 * Remote files are downloaded via axios with timeout and size limits.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { parse as csvParse } from 'csv-parse/sync';
import type { DataFileLoadOptions, DataFileLoadResult } from './types';

const PROJECT_ROOT = join(__dirname, '../..');
const DATA_DIR = join(PROJECT_ROOT, 'data');

const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024; // 500 MB
const USER_AGENT = 'PropertyIQ-DataPipeline/1.0';

/**
 * Download file content from a remote URL.
 * Returns the raw data as a Buffer.
 */
async function downloadFromUrl(url: string): Promise<Buffer> {
  console.log(`  Downloading from: ${url.substring(0, 80)}...`);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: DOWNLOAD_TIMEOUT_MS,
    maxContentLength: MAX_DOWNLOAD_BYTES,
    maxBodyLength: MAX_DOWNLOAD_BYTES,
    headers: { 'User-Agent': USER_AGENT },
  });

  const buffer = Buffer.from(response.data);
  console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  return buffer;
}

/**
 * Parse CSV or TSV content into rows.
 */
function parseCsvContent(content: string | Buffer, delimiter: string): Record<string, string>[] {
  return csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    delimiter,
    trim: true,
  });
}

/**
 * Parse XLSX content into rows (dynamically imports the xlsx package).
 * Reads the first sheet by default.
 */
async function parseXlsxContent(buffer: Buffer): Promise<Record<string, string>[]> {
  // Dynamic import to avoid loading xlsx when not needed
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false });
}

/**
 * Load and parse a data file from a local path or remote URL.
 *
 * Tries localPath first (relative to `data/` directory), falls back to URL.
 * Returns parsed rows as string key-value records.
 */
export async function loadDataFile(options: DataFileLoadOptions): Promise<DataFileLoadResult> {
  const format = options.format || 'csv';
  const delimiter = options.delimiter || (format === 'tsv' ? '\t' : ',');

  // Try local file first
  if (options.localPath) {
    const fullPath = join(DATA_DIR, options.localPath);
    if (existsSync(fullPath)) {
      console.log(`  Loading local file: ${options.localPath}`);
      const content = readFileSync(fullPath);

      const rows = format === 'xlsx'
        ? await parseXlsxContent(content)
        : parseCsvContent(content, delimiter);

      console.log(`  Parsed ${rows.length} rows from local file`);
      return { rows, rowCount: rows.length, source: 'file' };
    } else {
      console.log(`  Local file not found: ${options.localPath}, trying URL...`);
    }
  }

  // Download from URL
  if (!options.url) {
    throw new Error('No data source: neither localPath exists nor url is provided');
  }

  const buffer = await downloadFromUrl(options.url);
  const rows = format === 'xlsx'
    ? await parseXlsxContent(buffer)
    : parseCsvContent(buffer, delimiter);

  console.log(`  Parsed ${rows.length} rows from downloaded file`);
  return { rows, rowCount: rows.length, source: 'url' };
}
