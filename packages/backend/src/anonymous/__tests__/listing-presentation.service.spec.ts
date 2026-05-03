import { Test } from '@nestjs/testing';
import { ListingPresentationService } from '../listing-presentation.service';
import { ScoringService } from '../../scoring/scoring.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { PeersService } from '../../markets/peers.service';
import { MigrationService } from '../../migration/migration.service';
import { EmploymentSectorsService } from '../../employment-sectors/employment-sectors.service';
import { ListingPresentationNarrativeService } from '../listing-presentation-narrative.service';

describe('ListingPresentationService', () => {
  let service: ListingPresentationService;

  beforeEach(async () => {
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
          useValue: { findPeers: jest.fn().mockResolvedValue([]) },
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
});
