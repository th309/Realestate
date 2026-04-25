// packages/frontend/app/admin/content-pipeline/lib/movers-api.ts
import { useQuery } from "@tanstack/react-query";
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

export type ScoreMoverGeo = "metro" | "county" | "zip";
export type ScoreMoverWindowDays = 30 | 90 | 180 | 365;

export interface ScoreMoverItem {
  id: string;
  canonical_name: string;
  geography: ScoreMoverGeo;
  current_score: number;
  previous_score: number;
  delta: number;
  population: number | null;
}

export interface TopMoversResponse {
  window: {
    latestDate: string;
    priorDate: string;
    windowDays: ScoreMoverWindowDays;
    requestedGeo: ScoreMoverGeo;
  } | null;
  qualifiedCount: number;
  up: ScoreMoverItem[];
  down: ScoreMoverItem[];
}

export async function fetchTopMovers(
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
): Promise<TopMoversResponse> {
  const url = `/api/admin/content-pipeline/movers/resolve?geo=${geo}&windowDays=${windowDays}`;
  const res = await fetchAPIRaw(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fetchTopMovers failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: TopMoversResponse };
  return json.data;
}

export function useTopMovers(
  geo: ScoreMoverGeo,
  windowDays: ScoreMoverWindowDays,
) {
  return useQuery({
    queryKey: ["top-movers", geo, windowDays],
    queryFn: () => fetchTopMovers(geo, windowDays),
    staleTime: 5 * 60 * 1000, // 5 min — score data refreshes infrequently
  });
}
