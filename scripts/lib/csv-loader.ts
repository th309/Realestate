/**
 * Data file loader for import scripts.
 *
 * Loads CSV, TSV, or XLSX files from a local path or remote URL.
 * Local files are resolved relative to the project `data/` directory.
 * Remote files are downloaded via axios with timeout and size limits.
 */

import { readFileSync, existsSync } from "fs";
import type { Readable } from "stream";
import { join } from "path";
import axios, { AxiosError } from "axios";
import { parse as csvParse } from "csv-parse/sync";
import type { DataFileLoadOptions, DataFileLoadResult } from "./types";

const PROJECT_ROOT = join(__dirname, "../..");
const DATA_DIR = join(PROJECT_ROOT, "data");

const DEFAULT_TIMEOUT_MS = 300_000; // 5 min per attempt — accommodates large files (200MB+) on slow links
// Realtor Zip core-History is ~770MB (10yr of monthly zip rows) and grows; the
// in-memory download path must accommodate it. Windowing happens after parse.
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const DEFAULT_MAX_RETRIES = 3;
// Browser-like UA: government / vendor WAFs (e.g. HUD) reject generic SDK UAs with 202+empty.
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export interface DownloadOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError;
    // Network-layer failures: socket hang up, reset, timeout, DNS, EAI.
    if (!ax.response) return true;
    // 5xx and 429 are transient.
    const status = ax.response.status;
    return status >= 500 || status === 429;
  }
  // Non-axios errors (e.g. our own empty-body throw) are also retryable.
  return true;
}

/**
 * Open a streaming HTTP connection to a remote URL and return the response
 * body as a Node Readable stream. The caller is responsible for consuming
 * the stream (and handling any mid-stream errors via the stream's "error"
 * event or stream/promises pipeline).
 *
 * Use this instead of downloadFromUrl when the file is too large to buffer
 * entirely in memory (e.g. 400MB+ CSVs). Retry logic covers connection
 * failures only — once the stream is handed back, mid-stream errors are the
 * caller's responsibility.
 *
 * Defaults match downloadFromUrl: 5min timeout, 3 retries, browser UA.
 */
export async function downloadStream(
  url: string,
  options: DownloadOptions = {},
): Promise<Readable> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const headers = {
    "User-Agent": DEFAULT_USER_AGENT,
    Accept: "*/*",
    ...(options.headers ?? {}),
  };

  console.log(`  Streaming from: ${url.substring(0, 80)}...`);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        responseType: "stream",
        timeout: timeoutMs,
        headers,
      });
      return response.data as Readable;
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableError(err);
      const attemptsLeft = maxRetries - attempt;
      if (!retryable || attemptsLeft <= 0) {
        throw err;
      }
      const backoffMs = 30_000 * Math.pow(2, attempt);
      const reason = err instanceof Error ? err.message : String(err);
      console.log(
        `  Stream attempt ${attempt + 1}/${maxRetries + 1} failed (${reason}). Retrying in ${backoffMs / 1000}s...`,
      );
      await sleep(backoffMs);
    }
  }

  throw lastErr;
}

/**
 * Download file content from a remote URL with retry + exponential backoff.
 * Returns the raw data as a Buffer.
 *
 * Defaults: 5min per-attempt timeout, 3 retries (30s/60s/120s backoff),
 * realistic browser UA. Override per-caller for picky endpoints (e.g. HUD
 * requires a Referer header on top of a browser UA).
 */
export async function downloadFromUrl(
  url: string,
  options: DownloadOptions = {},
): Promise<Buffer> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const headers = {
    "User-Agent": DEFAULT_USER_AGENT,
    Accept: "*/*",
    ...(options.headers ?? {}),
  };

  console.log(`  Downloading from: ${url.substring(0, 80)}...`);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: timeoutMs,
        maxContentLength: MAX_DOWNLOAD_BYTES,
        maxBodyLength: MAX_DOWNLOAD_BYTES,
        headers,
        // 202 + empty body (WAF challenge) is success at HTTP level but useless
        // for us; we treat empty buffers as failures below to trigger retry.
      });

      const buffer = Buffer.from(response.data);
      if (buffer.length === 0) {
        throw new Error(
          `Empty response body (HTTP ${response.status}). Likely a WAF challenge — check Referer/UA headers.`,
        );
      }

      console.log(
        `  Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
      );
      return buffer;
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableError(err);
      const attemptsLeft = maxRetries - attempt;
      if (!retryable || attemptsLeft <= 0) {
        throw err;
      }
      const backoffMs = 30_000 * Math.pow(2, attempt); // 30s, 60s, 120s
      const reason = err instanceof Error ? err.message : String(err);
      console.log(
        `  Download attempt ${attempt + 1}/${maxRetries + 1} failed (${reason}). Retrying in ${backoffMs / 1000}s...`,
      );
      await sleep(backoffMs);
    }
  }

  throw lastErr;
}

/**
 * Parse CSV or TSV content into rows.
 */
function parseCsvContent(
  content: string | Buffer,
  delimiter: string,
): Record<string, string>[] {
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
async function parseXlsxContent(
  buffer: Buffer,
): Promise<Record<string, string>[]> {
  // Dynamic import to avoid loading xlsx when not needed
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    raw: false,
  });
}

/**
 * Load and parse a data file from a local path or remote URL.
 *
 * Tries localPath first (relative to `data/` directory), falls back to URL.
 * Returns parsed rows as string key-value records.
 */
export async function loadDataFile(
  options: DataFileLoadOptions,
): Promise<DataFileLoadResult> {
  const format = options.format || "csv";
  const delimiter = options.delimiter || (format === "tsv" ? "\t" : ",");

  // Try local file first
  if (options.localPath) {
    const fullPath = join(DATA_DIR, options.localPath);
    if (existsSync(fullPath)) {
      console.log(`  Loading local file: ${options.localPath}`);
      const content = readFileSync(fullPath);

      const rows =
        format === "xlsx"
          ? await parseXlsxContent(content)
          : parseCsvContent(content, delimiter);

      console.log(`  Parsed ${rows.length} rows from local file`);
      return { rows, rowCount: rows.length, source: "file" };
    } else {
      console.log(
        `  Local file not found: ${options.localPath}, trying URL...`,
      );
    }
  }

  // Download from URL
  if (!options.url) {
    throw new Error(
      "No data source: neither localPath exists nor url is provided",
    );
  }

  const buffer = await downloadFromUrl(options.url, {
    headers: options.headers,
    timeoutMs: options.timeoutMs,
    maxRetries: options.maxRetries,
  });
  const rows =
    format === "xlsx"
      ? await parseXlsxContent(buffer)
      : parseCsvContent(buffer, delimiter);

  console.log(`  Parsed ${rows.length} rows from downloaded file`);
  return { rows, rowCount: rows.length, source: "url" };
}
