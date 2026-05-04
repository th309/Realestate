import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { GEOGRAPHIES_WITH_SCORES_VIEW } from '../constants';

/**
 * Internal service handling core market lookups and platform-wide stats.
 * Not exported from MarketsModule — invoked through the MarketsService facade.
 */
@Injectable()
export class MarketsCoreService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Look up the core summary fields for one market: score, parent metro CBSA,
   * household count, name. Returns null if the geography is unknown.
   *
   * Used by the peers endpoint to seed `PeersService.findPeers`. Score may be
   * null for markets that haven't been scored yet (newly ingested geographies);
   * callers must handle the null case before passing to peer ranking.
   *
   * TODO(phase-01-task-13): see GEOGRAPHIES_WITH_SCORES_VIEW comment for the
   * view-shape reconciliation.
   */
  async getMarketCore(input: { geoLevel: string; geoId: string }): Promise<{
    score: number | null;
    parentMetroCbsa: string | null;
    householdCount: number;
    name: string;
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from(GEOGRAPHIES_WITH_SCORES_VIEW)
        .select('geo_id, name, score, household_count, parent_metro_cbsa')
        .eq('geo_level', input.geoLevel)
        .eq('geo_id', input.geoId)
        .maybeSingle();

      if (error) {
        // Likely missing view/table — degrade gracefully (Phase 01 Task 13).
        console.warn(
          'getMarketCore: geographies_with_scores lookup failed',
          error.message,
        );
        return null;
      }

      if (!data) return null;

      return {
        score: data.score ?? null,
        parentMetroCbsa: data.parent_metro_cbsa ?? null,
        householdCount: data.household_count ?? 0,
        name: data.name,
      };
    } catch (err) {
      console.warn('getMarketCore: unexpected error', err);
      return null;
    }
  }

  async getMarkets(limit = 100, offset = 0) {
    const { data, error, count } = await this.supabase
      .from('markets')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { data, count };
  }

  async getMarketById(id: string) {
    const { data, error } = await this.supabase
      .from('markets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async getMarketStats() {
    // Use geographies table for counts
    const { count: totalMarkets } = await this.supabase
      .from('markets')
      .select('*', { count: 'exact', head: true });

    const { count: totalStates } = await this.supabase
      .from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'state');

    const { count: totalCounties } = await this.supabase
      .from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'county');

    const { count: totalMetros } = await this.supabase
      .from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'metro');

    const { count: totalZips } = await this.supabase
      .from('geographies')
      .select('*', { count: 'exact', head: true })
      .eq('geography_type', 'zip');

    return {
      totalMarkets,
      totalStates,
      totalCounties,
      totalMetros,
      totalZips,
    };
  }
}
