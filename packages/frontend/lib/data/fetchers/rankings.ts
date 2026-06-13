// Data-layer fetcher over the PUBLIC top-markets endpoint
// (GET /api/scores/top — anonymous, 6h-cached). Used to rank same-state markets
// by PropertyIQ score for SEO related-market links and state-page top-10 tables.
//
// NOTE: the /api/v1/rankings endpoint is Platform-API-key gated (401 for anon SSR),
// so it cannot be used from public server-rendered pages. /api/scores/top is public.
import { fetchAPIWithParams } from "./base";

export interface RankingRow {
  rank: number;
  id: string;
  name: string;
  score: number;
  grade: string;
}

interface TopMarketRow {
  location_id: string;
  location_name: string;
  score: number;
  grade: string;
}

export async function fetchRankings(
  scoreType: "propertyiq",
  geoLevel: "metro" | "county" | "zip",
  opts?: { state?: string; limit?: number; order?: "asc" | "desc" },
): Promise<RankingRow[]> {
  try {
    const params: Record<string, string | number | undefined> = {
      geography: geoLevel,
      score_type: scoreType,
      sort: opts?.order ?? "desc",
    };
    if (opts?.state) params.state = opts.state;
    if (opts?.limit) params.limit = opts.limit;
    const rows = await fetchAPIWithParams<TopMarketRow[]>(
      `/api/scores/top`,
      params,
    );
    return (Array.isArray(rows) ? rows : []).map((r, i) => ({
      rank: i + 1,
      id: r.location_id,
      name: r.location_name,
      score: r.score,
      grade: r.grade,
    }));
  } catch {
    return [];
  }
}
