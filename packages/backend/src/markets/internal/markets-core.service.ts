import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

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
   * Look up the core summary fields for one market: name, parent metro CBSA,
   * size. Returns null if the geography is unknown.
   *
   * Reads the `geographies` table directly. (The previous `geographies_with_scores`
   * view was never created, so this silently returned null for EVERY market —
   * which is why reports showed the bare geoId instead of the market name and
   * peer comparison came up empty.) Score is sourced from the scoring service by
   * callers; this lookup is for identity + peer-seeding.
   */
  async getMarketCore(input: { geoLevel: string; geoId: string }): Promise<{
    score: number | null;
    parentMetroCbsa: string | null;
    householdCount: number;
    name: string;
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('geographies')
        .select('name, cbsa_code, population')
        .eq('geography_type', input.geoLevel)
        .eq('geography_id', input.geoId)
        .maybeSingle();

      if (error) {
        console.warn('getMarketCore: geographies lookup failed', error.message);
        return null;
      }

      if (!data || !data.name) return null;

      return {
        score: null,
        // cbsa_code is the geo's own CBSA for metros and the containing metro's
        // CBSA for counties/zips — the seed PeersService needs.
        parentMetroCbsa: data.cbsa_code ?? null,
        // `geographies` has no household_count; population is the size proxy
        // used for peer size-distance ranking.
        householdCount: data.population ?? 0,
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
    // maybeSingle (not single): single() raises a PostgREST error on 0 rows.
    // A malformed id (wrong type/format vs the table's region_id keys) also makes
    // PostgREST error rather than return 0 rows. Treat error-or-empty as "not
    // found" so any bad/unknown id yields a clean 404 instead of a 500.
    const { data, error } = await this.supabase
      .from('markets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Market not found: ${id}`);
    }
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
