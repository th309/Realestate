/**
 * Economic data import logic (BEA + FRED + BLS).
 *
 * Fetches unemployment, employment, GDP, and RPP data across
 * national/state/metro/county geographies and upserts to economic_* tables.
 */

import { ECONOMIC_TABLES } from "./census-economic-config";
import {
  fetchBeaStateGdp,
  fetchBeaStateRealGdp,
  fetchBeaStateRpp,
  fetchBeaMetroGdp,
  fetchBeaMetroRpp,
  fetchBeaCountyGdp,
} from "./bea-api-client";
import {
  fetchFredNationalUnemployment,
  fetchFredNationalEmployment,
  fetchFredStateUnemployment,
  fetchFredStateEmployment,
  fetchFredMetroUnemployment,
  fetchFredMetroEmployment,
} from "./fred-api-client";
import { fetchBlsCountyUnemployment } from "./bls-api-client";
import { upsertWithLogging, mergeByKey } from "./census-economic-upsert";

/** Filter records to only those with period_date >= cutoff. */
function applyDateCutoff(
  records: Record<string, unknown>[],
  dateCutoff?: string,
): Record<string, unknown>[] {
  if (!dateCutoff) return records;
  const before = records.length;
  const filtered = records.filter(
    (r) => !r.period_date || String(r.period_date) >= dateCutoff,
  );
  if (filtered.length < before)
    console.log(
      `  Date filter: ${before} -> ${filtered.length} records (cutoff ${dateCutoff})`,
    );
  return filtered;
}

export async function importAllEconomicData(
  fredStartYear: number,
  dateCutoff?: string,
): Promise<{ inserted: number; failed: number }> {
  console.log("\n" + "=".repeat(60));
  console.log(
    `Importing Economic Data (BEA + FRED + BLS) from ${fredStartYear}`,
  );
  if (dateCutoff) console.log(`  Date cutoff: ${dateCutoff}`);
  console.log("=".repeat(60));

  let totalInserted = 0;
  let totalFailed = 0;

  // National: FRED unemployment + employment merged by date
  const nationalMerged = applyDateCutoff(
    mergeByKey(
      [
        ...(await fetchFredNationalUnemployment(fredStartYear)),
        ...(await fetchFredNationalEmployment(fredStartYear)),
      ],
      "period_date",
    ),
    dateCutoff,
  );
  const natResult = await upsertWithLogging({
    source: "fred",
    tableName: ECONOMIC_TABLES.national.tableName,
    conflictKeys: ECONOMIC_TABLES.national.conflictKeys,
    datasetId: "economic-national",
    records: nationalMerged,
  });
  totalInserted += natResult.inserted;
  totalFailed += natResult.failed;

  // State: FRED unemployment + employment + BEA GDP + real GDP + RPP
  const stateAll = [
    ...(await fetchFredStateUnemployment(fredStartYear)),
    ...(await fetchFredStateEmployment(fredStartYear)),
    ...(await fetchBeaStateGdp()),
    ...(await fetchBeaStateRealGdp()),
    ...(await fetchBeaStateRpp()),
  ];
  const stateResult = await upsertWithLogging({
    source: "census",
    tableName: ECONOMIC_TABLES.state.tableName,
    conflictKeys: ECONOMIC_TABLES.state.conflictKeys,
    datasetId: "economic-state",
    records: applyDateCutoff(
      mergeByKey(stateAll, "period_date", "state_fips"),
      dateCutoff,
    ),
  });
  totalInserted += stateResult.inserted;
  totalFailed += stateResult.failed;

  // Metro: FRED unemployment + employment + BEA GDP + RPP
  const metroAll = [
    ...(await fetchFredMetroUnemployment(fredStartYear)),
    ...(await fetchFredMetroEmployment(fredStartYear)),
    ...(await fetchBeaMetroGdp()),
    ...(await fetchBeaMetroRpp()),
  ];
  const metroResult = await upsertWithLogging({
    source: "census",
    tableName: ECONOMIC_TABLES.metro.tableName,
    conflictKeys: ECONOMIC_TABLES.metro.conflictKeys,
    datasetId: "economic-metro",
    records: applyDateCutoff(
      mergeByKey(metroAll, "period_date", "cbsa_code"),
      dateCutoff,
    ),
  });
  totalInserted += metroResult.inserted;
  totalFailed += metroResult.failed;

  // County: BEA GDP + BLS unemployment
  const countyGdp = await fetchBeaCountyGdp();
  const countyFipsList = [
    ...new Set(countyGdp.map((r) => String(r.fips_code)).filter(Boolean)),
  ];
  console.log(
    `  Found ${countyFipsList.length} counties from BEA GDP for BLS fetch`,
  );
  const countyUnemployment = await fetchBlsCountyUnemployment(
    countyFipsList,
    fredStartYear,
  );
  const countyResult = await upsertWithLogging({
    source: "census",
    tableName: ECONOMIC_TABLES.county.tableName,
    conflictKeys: ECONOMIC_TABLES.county.conflictKeys,
    datasetId: "economic-county",
    records: applyDateCutoff(
      mergeByKey(
        [...countyGdp, ...countyUnemployment],
        "period_date",
        "fips_code",
      ),
      dateCutoff,
    ),
  });
  totalInserted += countyResult.inserted;
  totalFailed += countyResult.failed;

  return { inserted: totalInserted, failed: totalFailed };
}
