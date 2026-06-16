/**
 * Streaming, filtered CSV/TSV loader for multi-GB history files.
 *
 * loadDataFile() (csv-loader.ts) buffers the whole file and parses it at once —
 * fine for small files, but the Realtor Zip core-History is ~770MB / ~3M rows and
 * OOMs the JS heap when parsed whole. This loader pipes the download (or local
 * file) through a STREAMING csv parser and applies `rowFilter` per row, so only
 * the rows that pass (e.g. the last 12 months) are ever materialized. Memory is
 * bounded by the filtered subset, not the file size. CSV/TSV only (no XLSX).
 */

import { existsSync, createReadStream } from "fs";
import { join } from "path";
import type { Readable } from "stream";
import { parse as csvParseStream } from "csv-parse";
import { downloadStream } from "./csv-loader";
import type { DataFileLoadOptions, DataFileLoadResult } from "./types";

const DATA_DIR = join(__dirname, "../../data");

export async function loadDataFileFiltered(
  options: DataFileLoadOptions,
  rowFilter: (row: Record<string, string>) => boolean,
): Promise<DataFileLoadResult> {
  const format = options.format || "csv";
  if (format === "xlsx") {
    throw new Error(
      "loadDataFileFiltered supports streaming CSV/TSV only, not xlsx",
    );
  }
  const delimiter = options.delimiter || (format === "tsv" ? "\t" : ",");

  let source: Readable;
  let sourceKind: "file" | "url";
  const localFull = options.localPath
    ? join(DATA_DIR, options.localPath)
    : null;
  if (localFull && existsSync(localFull)) {
    console.log(`  Streaming local file: ${options.localPath}`);
    source = createReadStream(localFull);
    sourceKind = "file";
  } else if (options.url) {
    source = await downloadStream(options.url, {
      headers: options.headers,
      timeoutMs: options.timeoutMs,
      maxRetries: options.maxRetries,
    });
    sourceKind = "url";
  } else {
    throw new Error(
      "No data source: neither localPath exists nor url is provided",
    );
  }

  const parser = source.pipe(
    csvParseStream({
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      delimiter,
      trim: true,
    }),
  );
  // .pipe() does NOT forward source errors to the destination, so a mid-download
  // network error (TCP reset, server close) would otherwise surface as an
  // unhandled 'error' event and crash the process. Forward it into the parser so
  // the `for await` below throws and the caller's try/catch can handle it.
  source.on("error", (err) => parser.destroy(err as Error));

  const rows: Record<string, string>[] = [];
  let total = 0;
  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    total++;
    if (rowFilter(record)) rows.push(record);
  }

  console.log(
    `  Streamed ${total} rows, kept ${rows.length} after window filter`,
  );
  return { rows, rowCount: total, source: sourceKind };
}
