// Data-layer fetcher over the public rankings endpoint
// (GET /api/v1/rankings/:scoreType/:geoLevel). Used to rank same-state markets
// by PropertyIQ score for SEO related-market links and state-page top-10 tables.
import { fetchAPIWithParams } from "./base";

export interface RankingRow {
  rank: number;
  id: string;
  name: string;
  score: number;
  grade: string;
}

interface RankingsApiResponse {
  rankings: {
    rank: number;
    geography: { id: string; name: string };
    score: number;
    grade: string;
  }[];
}

export async function fetchRankings(
  scoreType: "propertyiq",
  geoLevel: "metro" | "county" | "zip",
  opts?: { state?: string; limit?: number; order?: "asc" | "desc" },
): Promise<RankingRow[]> {
  try {
    const params: Record<string, string | number | undefined> = {};
    if (opts?.state) params.state = opts.state;
    if (opts?.limit) params.limit = opts.limit;
    if (opts?.order) params.order = opts.order;
    const res = await fetchAPIWithParams<RankingsApiResponse>(
      `/api/v1/rankings/${scoreType}/${geoLevel}`,
      Object.keys(params).length ? params : undefined,
    );
    return (res.rankings ?? []).map((r) => ({
      rank: r.rank,
      id: r.geography.id,
      name: r.geography.name,
      score: r.score,
      grade: r.grade,
    }));
  } catch {
    return [];
  }
}
