import { Injectable, Logger } from '@nestjs/common';
import { ScoringService } from '../../scoring/scoring.service';
import { GeographyService } from '../../geography/geography.service';
import { MarketSnapshotService } from '../../market-snapshot/market-snapshot.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { GeoRef } from '../types';
import {
  MarketSnapshot,
  PropertyIQScoreResult,
  ResolvedMarket,
  TrendingMarketItem,
  CashflowMarketItem,
} from './content-data.types';
import {
  adaptMarketSnapshot,
  adaptPropertyIQScore,
  adaptResolvedMarket,
  emptyPropertyIQScoreResult,
} from './content-data-adapters';
import {
  fetchTopCashflowMarkets,
  fetchTrendingMarkets,
  ScoringGeo,
} from './content-data-queries';

/**
 * Facade that aggregates the internal data services the content pipeline
 * needs. Downstream pipeline stages (script generation, data verification,
 * rendering, lead-magnet generation) depend on this service instead of
 * wiring into every concrete service.
 *
 * No casts live here: every method delegates to a real service method or
 * to a helper in content-data-queries.ts / content-data-adapters.ts.
 */
@Injectable()
export class ContentDataService {
  private readonly logger = new Logger(ContentDataService.name);

  constructor(
    private readonly scoring: ScoringService,
    private readonly geography: GeographyService,
    private readonly marketSnapshot: MarketSnapshotService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Resolve a free-text market query (e.g. "Austin TX", "35620",
   * "Miami-Fort Lauderdale") into candidate geographies.
   */
  async resolveMarket(query: string): Promise<ResolvedMarket[]> {
    const rows = await this.geography.searchGeographies(query, undefined, 10);
    return rows
      .filter((r) =>
        ['state', 'metro', 'county', 'zip'].includes(r.geography_type),
      )
      .map(adaptResolvedMarket);
  }

  /**
   * Aggregate home value, rent, demographics, economic, and score data
   * for a single geography. Delegates to MarketSnapshotService for the
   * aggregation and ScoringService for the letter-grade confidence.
   */
  async getMarketSnapshot(geo: GeoRef): Promise<MarketSnapshot> {
    let raw: Awaited<ReturnType<MarketSnapshotService['getSnapshot']>> | null =
      null;
    try {
      raw = await this.marketSnapshot.getSnapshot(geo.geography, geo.id);
    } catch (err) {
      this.logger.warn(
        `getSnapshot failed for ${geo.geography}/${geo.id}: ${(err as Error).message}`,
      );
    }

    const confidence =
      raw?.scores.propertyiq != null
        ? await this.fetchConfidenceLetter(geo)
        : 'F';

    return adaptMarketSnapshot(geo, raw, confidence);
  }

  /**
   * Return a PropertyIQ score plus 12 months of history for the given geo.
   * Uses ScoringService.getScore with historyMonths=12.
   */
  async getPropertyIQScore(geo: GeoRef): Promise<PropertyIQScoreResult> {
    const scoringGeo = this.toScoringGeo(geo.geography);
    if (!scoringGeo) return emptyPropertyIQScoreResult(geo);

    const result = await this.scoring.getScore(geo.id, scoringGeo, undefined, {
      historyMonths: 12,
    });
    return adaptPropertyIQScore(geo, result);
  }

  /**
   * Return the top N markets whose PropertyIQ score moved the most
   * (up or down) compared to ~3 months earlier.
   */
  async getTrendingMarkets(
    geography: GeoRef['geography'],
    direction: 'up' | 'down',
    limit: number,
  ): Promise<TrendingMarketItem[]> {
    const scoringGeo = this.toScoringGeo(geography);
    if (!scoringGeo) return [];
    return fetchTrendingMarkets(
      this.supabase.getClient(),
      geography,
      scoringGeo,
      direction,
      limit,
    );
  }

  /**
   * Return the top N metros within a state ranked by rent-to-price
   * ratio. Non-metro levels are not yet implemented.
   */
  async getTopCashflowMarkets(
    state: string,
    geography: GeoRef['geography'],
    limit: number,
  ): Promise<CashflowMarketItem[]> {
    if (geography !== 'metro') {
      this.logger.warn(
        `getTopCashflowMarkets: only 'metro' is implemented, got '${geography}'`,
      );
      return [];
    }
    return fetchTopCashflowMarkets(this.supabase.getClient(), state, limit);
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private toScoringGeo(g: GeoRef['geography']): ScoringGeo | null {
    return g === 'state' ? null : g;
  }

  /**
   * Fetch only the letter-grade confidence for a geo. Used to enrich the
   * MarketSnapshotResponse.scores payload (which exposes score + grade
   * but not confidence_level).
   */
  private async fetchConfidenceLetter(geo: GeoRef): Promise<string> {
    const scoringGeo = this.toScoringGeo(geo.geography);
    if (!scoringGeo) return 'F';
    try {
      const r = await this.scoring.getScore(geo.id, scoringGeo);
      return r?.scores.propertyiq?.confidence_level ?? 'F';
    } catch {
      return 'F';
    }
  }
}
