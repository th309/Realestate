/**
 * Fetch and consult the Redfin Data Center index.json manifest.
 *
 * index.json is the authoritative list of published CSV paths. We use it to
 * resolve URLs at runtime so Redfin reshuffling filenames within a dashboard
 * doesn't break us. When the manifest is unreachable or lacks an expected
 * key, we fall back to the path baked into redfin-dc-config.ts.
 */

import { downloadFromUrl } from "../../lib/csv-loader";
import { S3_BASE } from "./redfin-dc-config";

export type RedfinIndex = Record<string, unknown>;

/** Fetch index.json. Returns {} on any failure (caller falls back to config). */
export async function fetchIndex(): Promise<RedfinIndex> {
  try {
    const buf = await downloadFromUrl(`${S3_BASE}/index.json`, {
      maxRetries: 2,
    });
    return JSON.parse(buf.toString("utf-8")) as RedfinIndex;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `  [redfin-dc] index.json unavailable (${msg}). Falling back to configured paths.`,
    );
    return {};
  }
}

/**
 * Resolve the full CSV URL for a (dashboard, geo). The index path overrides the
 * configured fallback path when present; both are joined to S3_BASE.
 */
export function resolveCsvUrl(
  index: RedfinIndex,
  indexKey: string,
  geoKey: string,
  fallbackPath: string,
): string {
  let path = fallbackPath;
  const dash = index[indexKey] as Record<string, any> | undefined;
  const geo = dash?.[geoKey] as Record<string, any> | undefined;
  if (geo && typeof geo.all === "string") {
    path = geo.all;
  }
  return `${S3_BASE}/${path}`;
}
