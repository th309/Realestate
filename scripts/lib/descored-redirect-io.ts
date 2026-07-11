// scripts/lib/descored-redirect-io.ts
// Shared types and I/O helpers for the de-scored redirect generator
// (scripts/generate-descored-redirects.ts): gated-JSON entry shapes, the
// Next.js redirect record shape, and current/HEAD slug-data readers.

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

import { STATE_SLUG_DATA } from "../../packages/frontend/lib/data/state-slug-data";

// ---------------------------------------------------------------------------
// Entry type definitions matching each gated JSON's shape
// ---------------------------------------------------------------------------

export interface MetroEntry {
  cbsaCode: string;
  slug: string;
  name: string;
  shortName: string;
  state: string;
}

export interface CountyEntry {
  fips: string;
  slug: string;
  name: string;
  shortName: string;
  state: string;
  cbsaCode: string | null;
}

export interface ZipEntry {
  zip: string;
  slug: string;
  name: string;
  shortName: string;
  state: string;
  countyFips: string | null;
  cbsaCode: string | null;
}

// ---------------------------------------------------------------------------
// Output type matching Next.js redirects config shape
// ---------------------------------------------------------------------------

export interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
}

/** Push temporary (non-permanent) redirects from each source to one destination. */
export function pushTempRedirects(
  redirects: Redirect[],
  destination: string,
  ...sources: string[]
): void {
  for (const source of sources) {
    redirects.push({ source, destination, permanent: false });
  }
}

// ---------------------------------------------------------------------------
// Slug-data readers
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(__dirname, "../../packages/frontend/lib/data");

export function readCurrentJson<T>(filename: string): T[] {
  const fullPath = path.join(DATA_DIR, filename);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T[];
}

/**
 * Read the committed (HEAD) version of a slug JSON via `git show`.
 * Returns [] if the file didn't exist at HEAD (first ever run).
 */
export function readHeadJson<T>(relPath: string): T[] {
  // spawnSync with argument array — no shell, no injection surface.
  // maxBuffer MUST exceed the largest slug JSON (zip is ~8MB): the 1MB default
  // silently overflows (ENOBUFS) on `git show`, which would return a false-empty
  // old set and drop every ZIP redirect. 256MB is ample headroom.
  // Baseline defaults to HEAD (steady-state monthly: diff last month's committed
  // gated data vs this month's). The FIRST-ever gated run overrides this to the
  // pre-gating commit (REDIRECT_BASELINE_REF) so old-vs-new diffs the *ungated*
  // universe and the initial de-scored backlog redirects correctly.
  const baselineRef = process.env.REDIRECT_BASELINE_REF || "HEAD";
  const result = spawnSync("git", ["show", `${baselineRef}:${relPath}`], {
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) {
    // A real spawn failure (buffer overflow, git missing, …) must FAIL LOUD —
    // never be masked as "file absent" (that would silently drop redirects).
    throw result.error;
  }
  if (result.status !== 0) {
    // File absent at HEAD (first-ever run): git exits non-zero with a
    // "does not exist in HEAD" stderr and no spawn error. Treat as empty.
    return [];
  }
  return JSON.parse(result.stdout) as T[];
}

/** Build a code → slug map from STATE_SLUG_DATA (abbrev field). */
export function buildStateSlugMap(): Map<string, string> {
  return new Map(STATE_SLUG_DATA.map((e) => [e.abbrev, e.slug]));
}
