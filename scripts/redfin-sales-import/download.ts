/**
 * Download gzipped TSV files from Redfin's S3 bucket.
 * Two modes:
 *   - Small files (national, state): decompress to string in memory
 *   - Large files (metro+): download compressed to disk, then stream-decompress
 */

import { gunzipSync, createGunzip } from 'zlib';
import { createWriteStream, createReadStream, mkdirSync, existsSync, unlinkSync, statSync } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as path from 'path';
import * as os from 'os';
import type { RedfinS3Dataset } from './types';

const TEMP_DIR = path.join(os.tmpdir(), 'redfin-import');

/**
 * Download + decompress a small TSV file entirely into memory.
 * Used for national, state (< 100 MB compressed).
 */
export async function downloadAndDecompress(dataset: RedfinS3Dataset): Promise<string> {
  console.log(`  Downloading ${dataset.geoLevel} data from S3...`);
  console.log(`    URL: ${dataset.url}`);

  const response = await fetch(dataset.url, {
    signal: AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${dataset.url}: ${response.status} ${response.statusText}`);
  }

  let buffer = Buffer.from(await response.arrayBuffer());
  console.log(`    Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB compressed`);

  let decompressed = gunzipSync(buffer);
  buffer = Buffer.alloc(0);
  const tsv = decompressed.toString('utf-8');
  console.log(`    Decompressed to ${(decompressed.length / 1024 / 1024).toFixed(1)} MB`);
  decompressed = Buffer.alloc(0);

  return tsv;
}

/**
 * Download compressed file to disk first, then return a decompressed readable stream.
 * Fully decouples the S3 download from the CSV parse, preventing S3 idle timeouts.
 */
export async function downloadToDiskThenStream(dataset: RedfinS3Dataset): Promise<{ stream: Readable; cleanup: () => void }> {
  console.log(`  Downloading ${dataset.geoLevel} data from S3 to disk...`);
  console.log(`    URL: ${dataset.url}`);

  // Create temp directory
  if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });
  const tempFile = path.join(TEMP_DIR, `${dataset.geoLevel}.tsv.gz`);

  // Download compressed file to disk
  const response = await fetch(dataset.url);
  if (!response.ok) {
    throw new Error(`Failed to download ${dataset.url}: ${response.status} ${response.statusText}`);
  }

  const webStream = response.body;
  if (!webStream) throw new Error('Response body is null');

  const nodeStream = Readable.fromWeb(webStream as any);
  const writeStream = createWriteStream(tempFile);
  await pipeline(nodeStream, writeStream);

  const fileSize = statSync(tempFile).size;
  console.log(`    Downloaded ${(fileSize / 1024 / 1024).toFixed(1)} MB compressed to disk`);

  // Now stream-decompress from disk (S3 connection is closed)
  const fileStream = createReadStream(tempFile);
  const gunzip = createGunzip();
  const decompressedStream = fileStream.pipe(gunzip);

  const cleanup = () => {
    try { unlinkSync(tempFile); } catch {}
  };

  return { stream: decompressedStream, cleanup };
}

/**
 * Check if a dataset should use disk-based streaming.
 */
export function needsStreaming(geoLevel: string): boolean {
  return ['metro', 'county', 'city', 'zip', 'neighborhood'].includes(geoLevel);
}
