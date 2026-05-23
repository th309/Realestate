/**
 * Pipeline definitions and timeout policy for the unified non-Zillow ingest
 * orchestrator. See `import-all-non-zillow.ts` for the runner.
 */

export interface ImportPipeline {
  id: string;
  name: string;
  command: string;
  /** Expected duration category for timeout calculation */
  size: "small" | "medium" | "large";
}

export const PIPELINES: ImportPipeline[] = [
  // Census + Economic (unified entrypoint, --census/--economic to scope)
  {
    id: "economic",
    name: "Economic Data (FRED/BLS/BEA)",
    command:
      "npx tsx scripts/sources/census-economic/import-census-economic.ts --economic",
    size: "medium",
  },
  {
    id: "census",
    name: "Census Data (ACS)",
    command:
      "npx tsx scripts/sources/census-economic/import-census-economic.ts --census",
    size: "medium",
  },
  {
    id: "permits",
    name: "Building Permits",
    command: "npx tsx scripts/sources/building-permits/import-permits.ts",
    size: "small",
  },
  {
    id: "hud",
    name: "HUD Fair Market Rent",
    command: "npx tsx scripts/sources/hud-fmr/import-hud-fmr.ts",
    size: "small",
  },
  // QCEW employment (BLS county-level employment by sector — fills FRED gaps)
  {
    id: "qcew-employment",
    name: "BLS QCEW Employment",
    command: "npx tsx scripts/download-qcew-employment.ts",
    size: "medium",
  },
  // IRS county-to-county migration flows (annual SOI release)
  {
    id: "irs-migration",
    name: "IRS County Migration Flows",
    command: "npx tsx scripts/download-irs-migration.ts",
    size: "medium",
  },
  // Redfin migration metro flows (monthly S3 release)
  {
    id: "redfin-migration",
    name: "Redfin Migration (metro)",
    command: "npx tsx scripts/sources/redfin/run-redfin-migration-import.ts",
    size: "small",
  },
  // Realtor (unified script — all geographies)
  {
    id: "realtor",
    name: "Realtor (all geographies)",
    command: "npx tsx scripts/sources/realtor/import-realtor.ts",
    size: "large",
  },
  // Redfin Market Tracker (large TSV files)
  {
    id: "redfin",
    name: "Redfin Market Tracker",
    command: "npx tsx scripts/sources/redfin/import-redfin.ts",
    size: "large",
  },
];

/** Timeout per size category (ms) */
export const TIMEOUTS: Record<string, number> = {
  small: 5 * 60 * 1000, // 5 minutes
  medium: 15 * 60 * 1000, // 15 minutes
  // Realtor + Redfin Market Tracker ingest hundreds of MB; on slow links the
  // multi-level (state/metro/county/zip/city) pipeline can run >60 min.
  large: 3 * 60 * 60 * 1000, // 3 hours
};
