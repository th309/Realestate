import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ScoringService } from '../scoring/scoring.service';
import { GeographyLevel } from '../scoring/formula-weights';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeoLevel as MetricGeoLevel } from '../metric-resolution/metric-resolution.types';
import { PeersService } from '../markets/peers.service';
import { MarketsService } from '../markets/markets.service';
import { MigrationService } from '../migration/migration.service';
import { EmploymentSectorsService } from '../employment-sectors/employment-sectors.service';
import { ListingPresentationNarrativeService } from './listing-presentation-narrative.service';
import { ListingPresentationSectionsService } from './listing-presentation-sections.service';
import { ListingPresentationPeersService } from './listing-presentation-peers.service';

export type GeoLevel =
  | 'metro'
  | 'county'
  | 'city'
  | 'zip'
  | 'state'
  | 'national';

export interface GenerateInput {
  sessionId: string;
  persona: 'agent' | 'investor' | 'homebuyer';
  market: { geoLevel: GeoLevel; geoId: string; name: string };
}

export interface ReportSection {
  id: string;
  title: string;
  data: unknown;
  limitedData: boolean;
}

export interface GeneratedReport {
  reportId: string;
  sessionId: string;
  watermark: string;
  expiresAt: string;
  claimable: boolean;
  report: { sections: ReportSection[] };
}

/** ScoringService.getScore only supports 'metro' | 'county' | 'zip'. */
function toScoringGeo(level: GeoLevel): GeographyLevel | null {
  if (level === 'metro' || level === 'county' || level === 'zip') return level;
  return null;
}

/** MetricResolutionService supports 'zip' | 'county' | 'metro' | 'state' | 'national'. */
function toMetricGeoLevel(level: GeoLevel): MetricGeoLevel | null {
  if (
    level === 'metro' ||
    level === 'county' ||
    level === 'zip' ||
    level === 'state' ||
    level === 'national'
  ) {
    return level;
  }
  return null;
}

@Injectable()
export class ListingPresentationService {
  constructor(
    private scoring: ScoringService,
    private metrics: MetricResolutionService,
    private peers: PeersService,
    private markets: MarketsService,
    private migration: MigrationService,
    private sectors: EmploymentSectorsService,
    private narrative: ListingPresentationNarrativeService,
    private sections: ListingPresentationSectionsService,
    private peersSection: ListingPresentationPeersService,
  ) {}

  async generate(input: GenerateInput): Promise<GeneratedReport> {
    const { market } = input;
    const reportId = `anon-rpt-${randomUUID()}`;

    // Migration + sectors APIs require a 5-digit county FIPS. Resolve upfront.
    // For non-county geos we skip those fetches and mark the sections limited.
    // (Phase 01 Task 13 will resolve a county FIPS from metro/zip via crosswalk.)
    const resolvedCountyFips: string | null =
      market.geoLevel === 'county' ? market.geoId : null;

    // -------- Wave 1: source attributes (sequential, used to back-fill peer ranking) --------
    const scoringGeo = toScoringGeo(market.geoLevel);
    const [score, marketCore] = await Promise.all([
      scoringGeo
        ? this.scoring.getScore(market.geoId, scoringGeo).catch(() => null)
        : Promise.resolve(null),
      this.markets
        .getMarketCore({ geoLevel: market.geoLevel, geoId: market.geoId })
        .catch(() => null),
    ]);

    // ScoreResult exposes the v4 demand-signal score under `scores.propertyiq.score`.
    // Tolerate a flat `{ score }` shape for adapters/tests that pre-flatten the value.
    const flattenedScore =
      (score as { score?: number } | null)?.score ??
      score?.scores?.propertyiq?.score ??
      null;
    const sourceScore = flattenedScore ?? marketCore?.score ?? 0;
    const parentMetro = marketCore?.parentMetroCbsa ?? null;
    const householdCount = marketCore?.householdCount ?? 0;
    // Resolve the display name once (real name from `geographies` via
    // marketCore, falling back to the client-passed name which may be the bare
    // geoId). Used by the AI narrative AND the trajectory section.
    const resolvedMarket = { ...market, name: marketCore?.name || market.name };

    // -------- Wave 2: data fetches in parallel using real source values --------
    const metricGeoLevel = toMetricGeoLevel(market.geoLevel);

    const [
      metricsBatch,
      peersList,
      migrationFlows,
      sectorMix,
      marketSeriesRaw,
    ] = await Promise.all([
      metricGeoLevel
        ? this.metrics
            .resolveMetricBatch(
              [
                'home_value',
                'rent_index',
                'days_on_market',
                'months_supply',
                'sale_to_list',
                'price_per_sqft',
                'median_income',
                'household_income_median',
                'pct_bachelors_or_higher',
              ],
              metricGeoLevel,
              market.geoId,
            )
            .catch(() => ({}) as Record<string, unknown>)
        : Promise.resolve({} as Record<string, unknown>),
      this.peers
        .findPeers({
          geoLevel: market.geoLevel,
          geoId: market.geoId,
          score: sourceScore,
          parentMetro,
          householdCount,
        })
        .catch(() => []),
      resolvedCountyFips
        ? this.migration
            .getTopInflows({ countyFips: resolvedCountyFips, limit: 5 })
            .catch(() => [])
        : Promise.resolve([]),
      resolvedCountyFips
        ? this.sectors
            .getTopSectors({ countyFips: resolvedCountyFips, topN: 5 })
            .catch(() => ({ sectors: [], totalEmployment: 0 }))
        : Promise.resolve({ sectors: [], totalEmployment: 0 }),
      this.sections.fetchMarketSeries(market.geoLevel, market.geoId),
    ]);

    const structuredFacts = {
      // Named for the scale so the model never reads it as "out of 10".
      propertyiqScore: flattenedScore,
      ...metricsBatch,
      peerCount: peersList.length,
      migrationCount: migrationFlows.length,
    };
    // Generate the AI narrative and enrich the peer cards with display metrics
    // in parallel — peer enrichment (extra metric fetches) hides under the AI
    // call, which is the long pole, so the finale doesn't get slower.
    const [ai, enrichedPeers] = await Promise.all([
      this.narrative.generate({
        market: resolvedMarket,
        persona: input.persona,
        structuredFacts,
      }),
      this.peersSection.buildPeers(peersList),
    ]);

    // -------- Wave 3: derived sections (trajectory + forecast need more fetches) --------
    const [trajectory, forecast] = await Promise.all([
      this.sections.buildTrajectory(resolvedMarket, marketSeriesRaw),
      this.sections.buildForecast(market, marketSeriesRaw),
    ]);
    const affordability = this.sections.buildAffordability(metricsBatch);
    const validation = this.sections.buildValidation(market.geoLevel);

    const sections: ReportSection[] = [
      {
        id: 'executive-summary',
        title: 'Executive summary',
        data: {
          score,
          verdict: ai.verdict,
          executiveSummary: ai.executiveSummary,
        },
        limitedData: !score,
      },
      {
        id: 'market-now',
        title: 'The market right now',
        data: metricsBatch,
        limitedData: Object.keys(metricsBatch).length < 4,
      },
      {
        id: 'trajectory-12mo',
        title: '12-month trajectory',
        data: trajectory,
        limitedData: trajectory.limitedData,
      },
      {
        id: 'forecast',
        title: 'Forecast',
        data: forecast,
        limitedData: forecast.limitedData,
      },
      {
        id: 'peers',
        title: 'Comparable peers',
        data: enrichedPeers,
        limitedData: enrichedPeers.length === 0,
      },
      {
        id: 'migration',
        title: 'Migration & demographics',
        data: migrationFlows,
        limitedData: !resolvedCountyFips || migrationFlows.length === 0,
      },
      {
        id: 'affordability',
        title: 'Affordability',
        data: affordability,
        limitedData: affordability.limitedData,
      },
      {
        id: 'employment',
        title: 'Economic drivers',
        data: sectorMix,
        limitedData: !resolvedCountyFips || sectorMix.sectors.length === 0,
      },
      {
        id: 'validation',
        title: 'Validated track record',
        data: validation,
        limitedData: false,
      },
      {
        id: 'ai-strategy',
        title: 'Recommended seller strategy',
        // verdict + executiveSummary live in the executive-summary section; the
        // strategy section carries only the distinct strategy prose + actions.
        data: {
          strategy: ai.strategy,
          actions: ai.actions,
          fallbackUsed: ai.fallbackUsed,
        },
        limitedData: ai.fallbackUsed,
      },
    ];

    return {
      reportId,
      sessionId: input.sessionId,
      watermark: 'PropertyIQ Demo · Sign up free to remove',
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      claimable: true,
      report: { sections },
    };
  }
}
