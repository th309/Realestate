// Run with: npx tsx scripts/generate-metro-slugs.ts
//
// Fetches all metros from the backend API and generates
// packages/frontend/lib/data/metro-slug-data.json with the raw data array.
// The TypeScript wrapper (metro-slug-data.ts) imports this JSON and exports typed maps.
//
// Score-gate: only metros that appear in the published scoring window are written.
// Fail-closed: throws before any file write if the published set is empty.

import {
  pickWindows,
  computePublishedIds,
  assertNonEmpty,
} from "./lib/published-set";
import { fetchScoredByPeriod } from "./lib/scored-set-client";

const API_URL = process.env.API_URL || "http://localhost:3001";

interface MetroEntry {
  regionId: number;
  name: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.'()/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getShortName(fullName: string): string {
  const commaIndex = fullName.indexOf(",");
  if (commaIndex === -1) return fullName;

  const city = fullName.substring(0, commaIndex).split("-")[0].trim();
  const state = fullName
    .substring(commaIndex + 1)
    .trim()
    .split("-")[0]
    .trim();
  return `${city}, ${state}`;
}

function getState(fullName: string): string {
  const commaIndex = fullName.indexOf(",");
  if (commaIndex === -1) return "";
  return fullName
    .substring(commaIndex + 1)
    .trim()
    .split("-")[0]
    .trim();
}

async function main() {
  const endpoint = `${API_URL}/api/markets/metros`;
  console.log(`Fetching metros from ${endpoint}...`);

  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`API returned ${res.status}: ${await res.text()}`);
  }

  const metros: MetroEntry[] = await res.json();
  console.log(`Fetched ${metros.length} metros.`);

  // Fetch the published scoring window and gate entries to scored metros only.
  const { periods, scoredByPeriod } = await fetchScoredByPeriod(
    API_URL,
    "metro",
  );
  const { publish } = pickWindows(periods);
  const publishedCbsa = computePublishedIds(scoredByPeriod, publish);
  assertNonEmpty("metro", publishedCbsa); // fail-closed before any write

  const entries = metros
    .map((m) => ({
      cbsaCode: String(m.regionId),
      slug: generateSlug(m.name),
      name: m.name,
      shortName: getShortName(m.name),
      state: getState(m.name),
    }))
    .filter((e) => publishedCbsa.has(e.cbsaCode));

  console.log(
    `Published metros: ${entries.length} / ${metros.length} tracked (window: ${publish.join(", ")})`,
  );

  // Check for duplicate slugs
  const slugMap = new Map<string, string>();
  let duplicateCount = 0;
  for (const entry of entries) {
    if (slugMap.has(entry.slug)) {
      console.warn(
        `WARNING: Duplicate slug "${entry.slug}" -- ${entry.name} vs ${slugMap.get(entry.slug)}`,
      );
      duplicateCount++;
    }
    slugMap.set(entry.slug, entry.name);
  }

  if (duplicateCount > 0) {
    console.warn(
      `\nFound ${duplicateCount} duplicate slug(s). Review the output for conflicts.`,
    );
  }

  if (entries.length === 0) {
    throw new Error(
      "fail-closed: 0 published metro entries after filtering — not overwriting JSON",
    );
  }

  const fs = await import("fs");
  const path = await import("path");
  const jsonPath = path.join(
    "packages",
    "frontend",
    "lib",
    "data",
    "metro-slug-data.json",
  );
  fs.writeFileSync(jsonPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`\nWritten to ${jsonPath}`);
  console.log(`Total entries: ${entries.length}`);
  console.log(`Unique slugs: ${slugMap.size}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
