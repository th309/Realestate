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

  const idSets = await Promise.all(
    periods.map((date) =>
      getJson<{ ids: string[] }>(
        `${apiBase}/api/scores/ids/${geo}?score_type=propertyiq&date=${date}`,
      ).then(({ ids }) => ({ date, ids })),
    ),
  );
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
