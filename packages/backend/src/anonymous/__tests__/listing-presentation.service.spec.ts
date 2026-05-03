import { Test } from '@nestjs/testing';
import { ListingPresentationService } from '../listing-presentation.service';
import { ScoringService } from '../../scoring/scoring.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { PeersService } from '../../markets/peers.service';
import { MarketsService } from '../../markets/markets.service';
import { MigrationService } from '../../migration/migration.service';
import { EmploymentSectorsService } from '../../employment-sectors/employment-sectors.service';
import { ListingPresentationNarrativeService } from '../listing-presentation-narrative.service';

describe('ListingPresentationService', () => {
  let service: ListingPresentationService;
  let findPeersMock: jest.Mock;
  let getMarketCoreMock: jest.Mock;

  beforeEach(async () => {
    findPeersMock = jest.fn().mockResolvedValue([]);
    getMarketCoreMock = jest.fn().mockResolvedValue({
      score: 87,
      parentMetroCbsa: '39580',
      householdCount: 62000,
      name: 'Wake County, NC',
    });

    const module = await Test.createTestingModule({
      providers: [
        ListingPresentationService,
        {
          provide: ScoringService,
          useValue: {
            getScore: jest.fn().mockResolvedValue({
              score: 87,
              confidence: { level: 'A', percentage: 91 },
            }),
          },
        },
        {
          provide: MetricResolutionService,
          useValue: {
            resolveMetricBatch: jest
              .fn()
              .mockResolvedValue({ home_value: 651000, dom: 11 }),
          },
        },
        {
          provide: PeersService,
          useValue: { findPeers: findPeersMock },
        },
        {
          provide: MarketsService,
          useValue: { getMarketCore: getMarketCoreMock },
        },
        {
          provide: MigrationService,
          useValue: { getTopInflows: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: EmploymentSectorsService,
          useValue: {
            getTopSectors: jest
              .fn()
              .mockResolvedValue({ sectors: [], totalEmployment: 0 }),
          },
        },
        {
          provide: ListingPresentationNarrativeService,
          useValue: {
            generate: jest.fn().mockResolvedValue({
              thesis: 'x',
              strategy: 'y',
              actions: [],
              fallbackUsed: false,
            }),
          },
        },
      ],
    }).compile();
    service = module.get(ListingPresentationService);
  });

  it('returns a report with all 10 sections populated', async () => {
    const result = await service.generate({
      sessionId: 'sess-1',
      persona: 'agent',
      market: { geoLevel: 'city', geoId: 'cary-nc', name: 'Cary, NC' },
    });
    expect(result.report.sections).toHaveLength(10);
    expect(result.reportId).toMatch(/^anon-rpt-/);
    expect(result.watermark).toBeTruthy();
  });

  it('marks affected sections "limited data" when data sources are empty', async () => {
    const result = await service.generate({
      sessionId: 'sess-2',
      persona: 'agent',
      market: { geoLevel: 'zip', geoId: '99999', name: 'Tiny ZIP' },
    });
    const migrationSection = result.report.sections.find(
      (s) => s.id === 'migration',
    );
    expect(migrationSection?.limitedData).toBe(true);
  });

  it('back-fills source.score and parentMetro into findPeers (no garbage zeros)', async () => {
    await service.generate({
      sessionId: 'sess-3',
      persona: 'agent',
      market: {
        geoLevel: 'county',
        geoId: '37183',
        name: 'Wake County, NC',
      },
    });
    expect(findPeersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        score: 87,
        parentMetro: '39580',
        householdCount: 62000,
      }),
    );
  });

  it('marks migration + employment sections limited when geoLevel is not county', async () => {
    const result = await service.generate({
      sessionId: 'sess-4',
      persona: 'agent',
      market: { geoLevel: 'metro', geoId: '39580', name: 'Raleigh metro' },
    });
    expect(
      result.report.sections.find((s) => s.id === 'migration')?.limitedData,
    ).toBe(true);
    expect(
      result.report.sections.find((s) => s.id === 'employment')?.limitedData,
    ).toBe(true);
  });
});
