import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';

export interface ScoreHeatmapMetro {
  id: string; // CBSA code
  name: string;
  lat: number;
  lon: number;
  pop: number | null;
  conf: string | null; // latest-month confidence level (A/B/C/F)
}

export interface ScoreHeatmapPayload {
  months: string[]; // ISO dates ascending, one per scored month
  metros: ScoreHeatmapMetro[];
  scores: number[][]; // scores[metroIdx][monthIdx], 1-99, 0 = no data
}

const HEATMAP_CACHE_KEY = 'heatmap:v1:metro';
const HEATMAP_TTL_SECONDS = 24 * 60 * 60; // scores change monthly; 24h is safe

@Injectable()
export class ScoringHeatmapService {
  private readonly logger = new Logger(ScoringHeatmapService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly redis: RedisService,
  ) {}

  /**
   * Full packed metro score history for the Market Momentum Map widget.
   * Redis read-through cache; degrades gracefully when Redis is absent
   * (getByKey returns null, setByKey is a no-op — see RedisService).
   */
  async getMetroHeatmap(): Promise<ScoreHeatmapPayload> {
    const cached = (await this.redis.getByKey(
      HEATMAP_CACHE_KEY,
    )) as ScoreHeatmapPayload | null;
    if (cached) return cached;

    const { data, error } = await this.supabase.rpc('get_metro_score_heatmap');
    if (error) throw error;

    const payload = data as ScoreHeatmapPayload;
    const wrote = await this.redis.setByKey(
      HEATMAP_CACHE_KEY,
      payload,
      HEATMAP_TTL_SECONDS,
    );
    if (wrote) {
      this.logger.log(
        `[Heatmap Cache] SET ${HEATMAP_CACHE_KEY} (TTL: ${HEATMAP_TTL_SECONDS}s)`,
      );
    }
    return payload;
  }
}
