/**
 * Typed wrappers for content-pipeline ranking endpoints.
 * All calls go through the canonical fetch layer.
 */
import { fetchAPIRaw } from "@/lib/data/fetchers/base";

/**
 * Ranking resolution request payload.
 */
export interface ResolveRankingArgs {
  format: "top_10_ranking" | "bottom_10_ranking";
  metric_id: string;
  geo_level: "metro" | "county" | "zip";
  scope_type: "national" | "state" | "metro";
  scope_id: string | null;
  limit?: number;
}

/**
 * Single ranked entry in a ranking result.
 */
export interface RankingEntry {
  rank: number;
  region_id: string;
  region_name: string;
  state: string;
  value: number;
  value_formatted: string;
}

/**
 * Ranking resolution response from the backend.
 */
export interface ResolveRankingResponse {
  metric: { id: string; label: string; unit: string; format: string };
  scope: { type: string; id: string | null; label: string };
  geo_level: string;
  direction: "top" | "bottom";
  as_of: string;
  eligible_count: number;
  excluded_count: number;
  rankings: RankingEntry[];
  insufficient_data: boolean;
}

/**
 * Resolve a ranking (top 10 or bottom 10) for a given metric,
 * geography level, and scope.
 */
export async function resolveRanking(
  args: ResolveRankingArgs,
): Promise<ResolveRankingResponse> {
  const res = await fetchAPIRaw("/api/admin/content-pipeline/ranking/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resolveRanking failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { data: ResolveRankingResponse };
  return json.data;
}
