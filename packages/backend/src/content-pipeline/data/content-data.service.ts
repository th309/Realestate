import { Inject, Injectable } from '@nestjs/common';
import { MarketsService } from '../../markets/markets.service';
import { ScoringService } from '../../scoring/scoring.service';
import { GeographyService } from '../../geography/geography.service';
import { GeoRef } from '../types';
import {
  MarketSnapshot,
  PropertyIQScoreResult,
  ResolvedMarket,
  TrendingMarketItem,
  CashflowMarketItem,
} from './content-data.types';

/**
 * Internal contracts the facade relies on. The real `MarketsService`,
 * `ScoringService`, and `GeographyService` do not yet expose all of these
 * methods. A future task (tracked in the content-pipeline implementation
 * plan, "Internal service discovery") will either add the matching methods
 * to those services or lift shared logic into dedicated helpers.
 *
 * For now the facade is typed against these minimal contracts so tests can
 * inject lightweight mocks and the production wiring can be adjusted without
 * leaking ad-hoc casts through the rest of the pipeline.
 */
interface MarketsFacade {
  getHomeValue(geo: GeoRef): Promise<MarketSnapshot['home_value']>;
  getRent(geo: GeoRef): Promise<MarketSnapshot['rent']>;
  getDemographics(geo: GeoRef): Promise<MarketSnapshot['demographics']>;
  getEconomic(geo: GeoRef): Promise<MarketSnapshot['economic']>;
  getTopCashflow(
    state: string,
    geography: GeoRef['geography'],
    limit: number,
  ): Promise<CashflowMarketItem[]>;
}

interface ScoringFacade {
  getScore(geo: GeoRef): Promise<MarketSnapshot['score']>;
  getScoreWithHistory(
    geo: GeoRef,
    months: number,
  ): Promise<PropertyIQScoreResult>;
  getTrendingMarkets(
    geography: GeoRef['geography'],
    direction: 'up' | 'down',
    limit: number,
  ): Promise<TrendingMarketItem[]>;
}

interface GeographyFacade {
  search(
    query: string,
    options: { limit: number },
  ): Promise<
    Array<{
      geography_level: GeoRef['geography'];
      geo_id: string;
      canonical_name: string;
      state?: string;
      population?: number | null;
    }>
  >;
}

/**
 * Facade that aggregates the internal data services the content pipeline
 * needs. Downstream pipeline stages (script generation, data verification,
 * rendering) depend on this service instead of wiring into every concrete
 * service one by one.
 */
@Injectable()
export class ContentDataService {
  private readonly markets: MarketsFacade;
  private readonly scoring: ScoringFacade;
  private readonly geography: GeographyFacade;

  constructor(
    @Inject(MarketsService) markets: MarketsService,
    @Inject(ScoringService) scoring: ScoringService,
    @Inject(GeographyService) geography: GeographyService,
  ) {
    this.markets = markets as unknown as MarketsFacade;
    this.scoring = scoring as unknown as ScoringFacade;
    this.geography = geography as unknown as GeographyFacade;
  }

  async resolveMarket(query: string): Promise<ResolvedMarket[]> {
    const results = await this.geography.search(query, { limit: 10 });
    return results.map((r) => ({
      geography: r.geography_level,
      id: r.geo_id,
      canonical_name: r.canonical_name,
      state: r.state,
      population: r.population ?? undefined,
    }));
  }

  async getMarketSnapshot(geo: GeoRef): Promise<MarketSnapshot> {
    const [homeValue, rent, demographics, economic, score] = await Promise.all([
      this.markets.getHomeValue(geo).catch(() => null),
      this.markets.getRent(geo).catch(() => null),
      this.markets.getDemographics(geo).catch(() => null),
      this.markets.getEconomic(geo).catch(() => null),
      this.scoring.getScore(geo).catch(() => null),
    ]);
    return { geo, home_value: homeValue, rent, demographics, economic, score };
  }

  async getPropertyIQScore(geo: GeoRef): Promise<PropertyIQScoreResult> {
    return this.scoring.getScoreWithHistory(geo, 12);
  }

  async getTrendingMarkets(
    geography: GeoRef['geography'],
    direction: 'up' | 'down',
    limit: number,
  ): Promise<TrendingMarketItem[]> {
    return this.scoring.getTrendingMarkets(geography, direction, limit);
  }

  async getTopCashflowMarkets(
    state: string,
    geography: GeoRef['geography'],
    limit: number,
  ): Promise<CashflowMarketItem[]> {
    return this.markets.getTopCashflow(state, geography, limit);
  }
}
