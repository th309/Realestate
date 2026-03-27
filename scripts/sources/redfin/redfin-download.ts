/**
 * Download helpers for Redfin TSV files from S3.
 *
 * Provides two strategies:
 * - In-memory: for small files (national, state) - decompresses to string
 * - Disk-based: for large files (metro, county, zip) - streams to temp file,
 *   decompresses on disk to avoid Node.js string length limits
 */

import { createWriteStream, createReadStream, statSync } from "fs";
import { unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { gunzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import axios from "axios";

const gunzipAsync = promisify(gunzip);

/** Max download size for in-memory files (50MB compressed). */
const IN_MEMORY_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Download a gzipped TSV into memory and return decompressed content as a string.
 * Used for small files (national, state).
 */
export async function downloadToMemory(url: string): Promise<string> {
  console.log(`  Downloading from: ${url.substring(0, 80)}...`);

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 300_000,
    maxContentLength: IN_MEMORY_MAX_BYTES,
    headers: { "User-Agent": "PropertyIQ-DataPipeline/1.0" },
  });

  const buffer = Buffer.from(response.data);
  console.log(
    `  Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB (compressed)`,
  );

  const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
  if (isGzip) {
    const decompressed = await gunzipAsync(buffer);
    console.log(
      `  Decompressed to ${(decompressed.length / 1024 / 1024).toFixed(2)} MB`,
    );
    return decompressed.toString("utf-8");
  }
  return buffer.toString("utf-8");
}

/**
 * Download a gzipped TSV to a temp file on disk, decompress, and return
 * the path to the decompressed TSV file. Used for large files (metro,
 * county, zip, etc.) that exceed Node.js string limits.
 */
export async function downloadToDisk(url: string): Promise<string> {
  console.log(`  Downloading to disk from: ${url.substring(0, 80)}...`);

  const ts = Date.now();
  const gzPath = join(tmpdir(), `redfin-${ts}.tsv.gz`);
  const tsvPath = join(tmpdir(), `redfin-${ts}.tsv`);

  // Stream download to disk
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 600_000,
    headers: { "User-Agent": "PropertyIQ-DataPipeline/1.0" },
  });

  const writer = createWriteStream(gzPath);
  await pipeline(response.data, writer);

  const stats = statSync(gzPath);
  console.log(
    `  Downloaded ${(stats.size / 1024 / 1024).toFixed(1)} MB compressed to disk`,
  );

  // Decompress to disk
  const gzReader = createReadStream(gzPath);
  const gunzipStream = createGunzip();
  const tsvWriter = createWriteStream(tsvPath);
  await pipeline(gzReader, gunzipStream, tsvWriter);

  // Clean up compressed file
  await unlink(gzPath).catch(() => {});

  return tsvPath;
}
