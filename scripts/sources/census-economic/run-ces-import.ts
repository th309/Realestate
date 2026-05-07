/**
 * CLI wrapper for CES sector import.
 *
 * Usage:
 *   npx tsx scripts/sources/census-economic/run-ces-import.ts \
 *     --states NC --metros 39580 [--start 2023] [--end 2023]
 *
 *   # National rollout (all 50 states + DC):
 *   npx tsx scripts/sources/census-economic/run-ces-import.ts --all-states
 *
 * Builds the seriesId list for the requested states and metros (state
 * total + 11 supersectors per geography) and calls importCes.
 */

import { getSupabaseClient } from "../../lib";
import { STATE_ABBREV_TO_FIPS } from "./census-economic-config";
import { CES_SUPERSECTORS, importCes } from "./ces-importer";

interface CliArgs {
  states: string[];
  metros: string[];
  startYear: number;
  endYear: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    states: [],
    metros: [],
    startYear: new Date().getFullYear() - 1,
    endYear: new Date().getFullYear(),
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === "--states" && next) {
      args.states = next.split(",").map((s) => s.trim().toUpperCase());
      i++;
    } else if (flag === "--metros" && next) {
      args.metros = next.split(",").map((s) => s.trim());
      i++;
    } else if (flag === "--start" && next) {
      args.startYear = parseInt(next, 10);
      i++;
    } else if (flag === "--end" && next) {
      args.endYear = parseInt(next, 10);
      i++;
    } else if (flag === "--all-states") {
      // Expand to all 50 states + DC (excludes territories like PR by default).
      args.states = Object.keys(STATE_ABBREV_TO_FIPS).filter(
        (abbrev) => abbrev !== "PR",
      );
    }
  }
  return args;
}

function buildStateSeriesIds(stateFips: string): string[] {
  // SMS{state}{area=00000}{industry=00000000=total nonfarm}{datatype=01}
  // + one per supersector: SMS{state}00000{ss}000000{01}
  // SMS{state}{area=00000}{industry=00000000}{datatype=01} -> 20 chars total
  const ids: string[] = [`SMS${stateFips}000000000000001`];
  for (const ss of Object.keys(CES_SUPERSECTORS)) {
    ids.push(`SMS${stateFips}00000${ss}00000001`);
  }
  return ids;
}

function buildMetroSeriesIds(stateFips: string, cbsa: string): string[] {
  // SMU{state}{cbsa}{ss}000000{01}  (20 chars total)
  const ids: string[] = [];
  for (const ss of Object.keys(CES_SUPERSECTORS)) {
    ids.push(`SMU${stateFips}${cbsa}${ss}00000001`);
  }
  return ids;
}

async function lookupMetroState(
  supabase: ReturnType<typeof getSupabaseClient>,
  cbsa: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("economic_metro")
    .select("state_fips")
    .eq("cbsa_code", cbsa)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn(
      `  Could not look up state_fips for cbsa ${cbsa}: ${error.message}`,
    );
    return null;
  }
  return (data?.state_fips as string | undefined) ?? null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.states.length === 0 && args.metros.length === 0) {
    console.error(
      "Usage: run-ces-import.ts --states NC[,GA,...] [--metros 39580,...] [--start 2023] [--end 2023]",
    );
    process.exit(1);
  }
  const supabase = getSupabaseClient();

  const seriesIds: string[] = [];
  for (const abbrev of args.states) {
    const fips = STATE_ABBREV_TO_FIPS[abbrev];
    if (!fips) {
      console.warn(`  Skipping unknown state abbrev: ${abbrev}`);
      continue;
    }
    seriesIds.push(...buildStateSeriesIds(fips));
  }
  for (const cbsa of args.metros) {
    let metroState: string | null = null;
    for (const abbrev of args.states) {
      const fips = STATE_ABBREV_TO_FIPS[abbrev];
      if (fips) {
        metroState = fips;
        break;
      }
    }
    if (!metroState) {
      metroState = await lookupMetroState(supabase, cbsa);
    }
    if (!metroState) {
      console.warn(`  Skipping cbsa ${cbsa}: no state_fips known`);
      continue;
    }
    seriesIds.push(...buildMetroSeriesIds(metroState, cbsa));
  }

  console.log(
    `CES import: ${args.states.length} states, ${args.metros.length} metros, ${seriesIds.length} series, ${args.startYear}-${args.endYear}`,
  );
  const result = await importCes(
    supabase,
    seriesIds,
    args.startYear,
    args.endYear,
  );
  console.log(`  Inserted: ${result.inserted}  Skipped: ${result.skipped}`);
}

main().catch((err) => {
  console.error("CES import failed:", err);
  process.exit(1);
});
