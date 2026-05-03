import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ScoringService } from '../scoring/scoring.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { PeersService } from '../markets/peers.service';
import { MigrationService } from '../migration/migration.service';
import { EmploymentSectorsService } from '../employment-sectors/employment-sectors.service';
import { ListingPresentationNarrativeService } from './listing-presentation-narrative.service';

export interface GenerateInput {
  sessionId: string;
  persona: 'agent' | 'investor' | 'homebuyer';
  market: { geoLevel: string; geoId: string; name: string };
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

@Injectable()
export class ListingPresentationService {
  constructor(
    private scoring: ScoringService,
    private metrics: MetricResolutionService,
    private peers: PeersService,
    private migration: MigrationService,
    private sectors: EmploymentSectorsService,
    private narrative: ListingPresentationNarrativeService,
  ) {}

  async generate(input: GenerateInput): Promise<GeneratedReport> {
    const { market } = input;
    const reportId = `anon-rpt-${randomUUID()}`;

    // Parallel data fetches (each handles its own missing-data case).
    // Note: ScoringService.getScore takes (locationId, geography).
    const [score, metricsBatch, peersList, migrationFlows, sectorMix] =
      await Promise.all([
        (this.scoring.getScore as any)(market.geoId, market.geoLevel).catch(
          () => null,
        ),
        this.metrics
          .resolveMetricBatch(
            [
              'home_value',
              'rent_index',
              'dom_median',
              'pct_sold_above_list',
              'months_supply',
              'sale_to_list_ratio',
              'price_per_sqft',
              'household_income_median',
              'pct_bachelors_or_higher',
            ],

            market.geoLevel as any,
            market.geoId,
          )
          .catch(() => ({}) as Record<string, unknown>),
        this.peers
          .findPeers({
            geoLevel: market.geoLevel,
            geoId: market.geoId,
            score: 0,
            parentMetro: null,
            householdCount: 0,
          })
          .catch(() => []),
        this.migration
          .getTopInflows({ countyFips: market.geoId, limit: 5 })
          .catch(() => []),
        this.sectors
          .getTopSectors({ countyFips: market.geoId, topN: 5 })
          .catch(() => ({ sectors: [], totalEmployment: 0 })),
      ]);

    const structuredFacts = {
      score: score?.score,
      ...metricsBatch,
      peerCount: peersList.length,
      migrationCount: migrationFlows.length,
    };
    const ai = await this.narrative.generate({
      market,
      persona: input.persona,
      structuredFacts,
    });

    const sections: ReportSection[] = [
      {
        id: 'executive-summary',
        title: 'Executive summary',
        data: { score, thesis: ai.thesis },
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
        data: {},
        limitedData: false,
      },
      {
        id: 'forecast',
        title: 'Forecast',
        data: {},
        limitedData: false,
      },
      {
        id: 'peers',
        title: 'Comparable peers',
        data: peersList,
        limitedData: peersList.length === 0,
      },
      {
        id: 'migration',
        title: 'Migration & demographics',
        data: migrationFlows,
        limitedData: migrationFlows.length === 0,
      },
      {
        id: 'affordability',
        title: 'Affordability',
        data: {},
        limitedData: false,
      },
      {
        id: 'employment',
        title: 'Economic drivers',
        data: sectorMix,
        limitedData: sectorMix.sectors.length === 0,
      },
      {
        id: 'validation',
        title: 'Validated track record',
        data: {},
        limitedData: false,
      },
      {
        id: 'ai-strategy',
        title: 'Recommended seller strategy',
        data: ai,
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
