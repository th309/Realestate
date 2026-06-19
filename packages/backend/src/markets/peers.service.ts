import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SIZE_DISTANCE_WEIGHT } from './constants';

export interface PeerCandidate {
  geoLevel: string;
  geoId: string;
  name: string;
  score: number;
  householdCount: number;
}

export interface FindPeersInput {
  geoLevel: string;
  geoId: string;
  score: number;
  parentMetro: string | null;
  householdCount: number;
}

const SCORE_TYPE = 'propertyiq';
// PostgREST renders `.in()` into the query string, so a national metro pool
// (~935 ids) must be chunked to stay under URL-length limits.
const ID_CHUNK = 150;

@Injectable()
export class PeersService {
  private readonly logger = new Logger(PeersService.name);

  constructor(private supabase: SupabaseService) {}

  /**
   * Latest PropertyIQ score for a single market, or null if it isn't scored.
   * The peers controller seeds ranking with this — getMarketCore intentionally
   * returns identity only, so the score must be loaded here.
   */
  async getScore(geoLevel: string, geoId: string): Promise<number | null> {
    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('score')
      .eq('geography', geoLevel)
      .eq('location_id', geoId)
      .eq('score_type', SCORE_TYPE)
      .order('score_date', { ascending: false })
      .limit(1);
    const score = data?.[0]?.score;
    return typeof score === 'number' ? score : null;
  }

  private async getLatestScoreDate(geoLevel: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('propertyiq_scores')
      .select('score_date')
      .eq('geography', geoLevel)
      .eq('score_type', SCORE_TYPE)
      .order('score_date', { ascending: false })
      .limit(1);
    return data?.[0]?.score_date ?? null;
  }

  /**
   * Closest peer markets to `input`, ranked by PropertyIQ-score proximity plus
   * a size term (SIZE_DISTANCE_WEIGHT). Candidate pool by level:
   *   - metro       → all metros nationally (a metro's cbsa_code is its own, so
   *                   a same-CBSA filter would match nothing).
   *   - county/zip  → markets in the same parent metro (cbsa_code), the natural
   *                   local peer set.
   * Joins `geographies` (identity + population) to `propertyiq_scores` (score)
   * in memory — the old `geographies_with_scores` view was never created.
   */
  async findPeers(input: FindPeersInput, limit = 3): Promise<PeerCandidate[]> {
    const latestDate = await this.getLatestScoreDate(input.geoLevel);
    if (!latestDate) return [];

    let candidateQuery = this.supabase
      .from('geographies')
      .select('geography_id, name, population')
      .eq('geography_type', input.geoLevel)
      .neq('geography_id', input.geoId);
    if (input.geoLevel !== 'metro' && input.parentMetro) {
      candidateQuery = candidateQuery.eq('cbsa_code', input.parentMetro);
    }
    const { data: geos, error: geoErr } = await candidateQuery;
    if (geoErr || !geos?.length) return [];

    const ids = geos.map((g) => g.geography_id as string);
    const scoreById = new Map<string, number>();
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const batch = ids.slice(i, i + ID_CHUNK);
      const { data: rows } = await this.supabase
        .from('propertyiq_scores')
        .select('location_id, score')
        .eq('geography', input.geoLevel)
        .eq('score_type', SCORE_TYPE)
        .eq('score_date', latestDate)
        .in('location_id', batch);
      rows?.forEach((r) => {
        if (typeof r.score === 'number')
          scoreById.set(r.location_id as string, r.score);
      });
    }

    // A non-empty candidate pool that resolves zero scores means the score
    // fetch silently failed (RLS, transient error, date mismatch) — surface it
    // instead of returning "no peers" as if the market were one-of-a-kind.
    if (scoreById.size === 0) {
      this.logger.warn(
        `No scores resolved for ${ids.length} ${input.geoLevel} candidates at ${latestDate}; returning no peers`,
      );
      return [];
    }

    return geos
      .map((g) => {
        const score = scoreById.get(g.geography_id as string);
        if (typeof score !== 'number') return null;
        const householdCount = (g.population as number | null) ?? 0;
        const sizeDist =
          Math.abs(householdCount - input.householdCount) /
          Math.max(input.householdCount, 1);
        return {
          geoLevel: input.geoLevel,
          geoId: g.geography_id as string,
          name: g.name as string,
          score,
          householdCount,
          dist: Math.abs(score - input.score) + sizeDist * SIZE_DISTANCE_WEIGHT,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit)
      .map(({ dist, ...rest }) => rest);
  }
}
