import { Test } from '@nestjs/testing';
import { ContentDataService } from './content-data.service';
import { MarketsService } from '../../markets/markets.service';
import { ScoringService } from '../../scoring/scoring.service';
import { GeographyService } from '../../geography/geography.service';

describe('ContentDataService', () => {
  let service: ContentDataService;
  let geography: { search: jest.Mock };
  let markets: {
    getHomeValue: jest.Mock;
    getRent: jest.Mock;
    getDemographics: jest.Mock;
    getEconomic: jest.Mock;
    getTopCashflow: jest.Mock;
  };
  let scoring: {
    getScore: jest.Mock;
    getScoreWithHistory: jest.Mock;
    getTrendingMarkets: jest.Mock;
  };

  beforeEach(async () => {
    geography = { search: jest.fn() };
    markets = {
      getHomeValue: jest.fn(),
      getRent: jest.fn(),
      getDemographics: jest.fn(),
      getEconomic: jest.fn(),
      getTopCashflow: jest.fn(),
    };
    scoring = {
      getScore: jest.fn(),
      getScoreWithHistory: jest.fn(),
      getTrendingMarkets: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ContentDataService,
        { provide: GeographyService, useValue: geography },
        { provide: MarketsService, useValue: markets },
        { provide: ScoringService, useValue: scoring },
      ],
    }).compile();
    service = module.get(ContentDataService);
  });

  it('resolveMarket maps geography search results', async () => {
    geography.search.mockResolvedValue([
      {
        geography_level: 'metro',
        geo_id: '35620',
        canonical_name: 'New York NY',
        state: 'NY',
        population: 19000000,
      },
    ]);
    const result = await service.resolveMarket('new york');
    expect(result).toHaveLength(1);
    expect(result[0].canonical_name).toBe('New York NY');
    expect(result[0].geography).toBe('metro');
  });

  it('getMarketSnapshot aggregates null-safely across sources', async () => {
    markets.getHomeValue.mockResolvedValue({
      value: 600000,
      yoy_pct: 3.2,
      period_date: '2026-03-01',
    });
    markets.getRent.mockRejectedValue(new Error('no data'));
    markets.getDemographics.mockResolvedValue({
      population: 19000000,
      median_income: 85000,
      homeownership_pct: 62,
    });
    markets.getEconomic.mockResolvedValue({
      unemployment_rate: 4.1,
      job_growth_yoy_pct: 1.8,
    });
    scoring.getScore.mockResolvedValue({
      propertyiq_score: 72,
      grade: 'B',
      confidence: 'A',
    });

    const result = await service.getMarketSnapshot({
      geography: 'metro',
      id: '35620',
      canonical_name: 'NY',
    });
    expect(result.home_value?.value).toBe(600000);
    expect(result.rent).toBeNull();
    expect(result.score?.propertyiq_score).toBe(72);
  });

  it('getPropertyIQScore returns score with 12-month history', async () => {
    scoring.getScoreWithHistory.mockResolvedValue({
      geo: { geography: 'metro', id: '35620', canonical_name: 'NY' },
      score: 72,
      grade: 'B',
      label: 'GOOD',
      confidence_pct: 86,
      confidence_level: 'A',
      history: Array(12).fill({ date: '2026-03-01', score: 72 }),
    });
    const r = await service.getPropertyIQScore({
      geography: 'metro',
      id: '35620',
      canonical_name: 'NY',
    });
    expect(r.history).toHaveLength(12);
  });
});
