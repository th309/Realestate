// scripts/lib/scored-set-client.ts
import { REDIRECT_LOOKBACK_MONTHS } from "./published-set";

type Geo = "metro" | "county" | "zip";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`GET ${url} → ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function fetchScoredByPeriod(
  apiBase: string,
  geo: Geo,
): Promise<{ periods: string[]; scoredByPeriod: Map<string, Set<string>> }> {
  const { periods } = await getJson<{ periods: string[] }>(
    `${apiBase}/api/scores/ids/${geo}/periods?score_type=propertyiq&limit=${REDIRECT_LOOKBACK_MONTHS}`,
  );
  if (!periods.length)
    throw new Error(`fail-closed: no score periods returned for ${geo}`);

  // Sequential, NOT Promise.all: for zip each period returns ~29k ids, and firing
  // all 6 periods concurrently made them contend on the DB pooler (~3.6s each);
  // right after scoring that tipped one past the statement timeout → 500 → the
  // whole refresh failed. One at a time keeps each call ~0.1s and never bursts.
  const idSets: Array<{ date: string; ids: string[] }> = [];
  for (const date of periods) {
    const { ids } = await getJson<{ ids: string[] }>(
      `${apiBase}/api/scores/ids/${geo}?score_type=propertyiq&date=${date}`,
    );
    idSets.push({ date, ids });
  }
  const scoredByPeriod = new Map<string, Set<string>>(
    idSets.map(({ date, ids }) => [date, new Set(ids)]),
  );
  const latest = scoredByPeriod.get(periods[0]);
  if (!latest || latest.size === 0) {
    throw new Error(
      `fail-closed: latest period ${periods[0]} had no scored ${geo} ids`,
    );
  }
  return { periods, scoredByPeriod };
}
