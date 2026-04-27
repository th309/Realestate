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
  CashflowMarketItem,
} from './content-data.types';
import {
  adaptMarketSnapshot,
  adaptPropertyIQScore,
  adaptResolvedMarket,
  emptyPropertyIQScoreResult,
} from './content-data-adapters';
import { fetchTopCashflowMarkets, ScoringGeo } from './content-data-queries';
import {
  fetchTopMovers,
  fetchScoreMoverContext,
  type TopMoversResult,
  type ScoreMoverContext,
} from './score-mover-context.queries';
import type { ScoreMoverGeo, ScoreMoverWindowDays } from './score-mover-config';

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

    let confidenceLetter = 'F';
    let scoreExtras:
      | {
          history: Array<{ date: string; score: number }>;
          trend: 'up' | 'down' | 'stable';
          trend_change: number;
        }
      | undefined;

    if (raw?.scores.propertyiq != null) {
      const scoringGeo = this.toScoringGeo(geo.geography);
      if (scoringGeo) {
        try {
          const r = await this.scoring.getScore(geo.id, scoringGeo, undefined, {
            historyMonths: 12,
          });
          const piq = r?.scores.propertyiq;
          if (piq) {
            confidenceLetter = piq.confidence_level ?? 'F';
            const history = (piq.history?.data ?? [])
              .filter((p) => p.score != null)
              .map((p) => ({ date: p.date, score: p.score as number }));
            scoreExtras = {
              history,
              trend: piq.history?.trend ?? 'stable',
              trend_change:
                typeof piq.trend_change === 'number'
                  ? piq.trend_change
                  : typeof piq.history?.change === 'number'
                    ? piq.history.change
                    : 0,
            };
          } else {
            confidenceLetter = await this.fetchConfidenceLetter(geo);
          }
        } catch (err) {
          this.logger.warn(
            `getScore(history) failed for ${geo.geography}/${geo.id}: ${(err as Error).message}`,
          );
          confidenceLetter = await this.fetchConfidenceLetter(geo);
        }
      }
    }

    let snapshot = adaptMarketSnapshot(geo, raw, confidenceLetter);
    if (snapshot.score && scoreExtras) {
      snapshot = {
        ...snapshot,
        score: { ...snapshot.score, ...scoreExtras },
      };
    }
    return snapshot;
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
   * Return the top N PropertyIQ score gainers AND losers for a geography
   * level over the chosen window. Drops null/below-floor populations.
   * Returns `{ window: null, ... }` when no prior score date exists in the
   * window — callers should render the sparse-state UI rather than treating
   * empty arrays as "no movers".
   */
  async getTopMovers(
    geo: ScoreMoverGeo,
    windowDays: ScoreMoverWindowDays,
    limit = 25,
  ): Promise<TopMoversResult> {
    return fetchTopMovers(this.supabase.getClient(), geo, windowDays, limit);
  }

  /**
   * Per-market window-aware delta + window labels. Used by the orchestrator
   * data-fetch step when format = score_mover so the rendered video and
   * script reflect the exact window the operator chose.
   */
  async getScoreMoverContext(
    geoId: string,
    geo: ScoreMoverGeo,
    windowDays: ScoreMoverWindowDays,
  ): Promise<ScoreMoverContext | null> {
    return fetchScoreMoverContext(
      this.supabase.getClient(),
      geoId,
      geo,
      windowDays,
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
