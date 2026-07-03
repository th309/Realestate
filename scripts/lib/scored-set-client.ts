// scripts/lib/scored-set-client.ts
import { REDIRECT_LOOKBACK_MONTHS } from "./published-set";

type Geo = "metro" | "county" | "zip";

// Retry transient server-side failures. The scores/ids/zip endpoint is 100%
// reliable in isolation but throws a brief 500 in the second or two right after
// the scoring pipeline finishes writing (DB still settling); it recovers on the
// very next call. Without this, the SEO slug rebuild fail-closed on that one-shot
// and cascaded the whole post-import refresh to failure. Retry 5xx + network
// errors with backoff (recovery is sub-second, so the first retry almost always
// wins; the longer waits cover a slower settle). 4xx is a real error — don't retry.
async function getJson<T>(url: string): Promise<T> {
  const backoffMs = [2000, 5000, 10000, 15000];
  let lastError = "";
  for (let attempt = 0; attempt <= backoffMs.length; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as T;
      lastError = `${res.status}: ${await res.text()}`;
      if (res.status < 500) break; // client error — not transient
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (attempt < backoffMs.length) {
      console.warn(
        `  transient failure on ${url} (${lastError.slice(0, 120)}) — retry ${attempt + 1}/${backoffMs.length} in ${backoffMs[attempt] / 1000}s`,
      );
      await new Promise((r) => setTimeout(r, backoffMs[attempt]));
    }
  }
  throw new Error(
    `GET ${url} → ${lastError} (after ${backoffMs.length + 1} attempts)`,
  );
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
