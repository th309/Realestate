import { Test } from '@nestjs/testing';
import { ContentDataService } from './content-data.service';
import { ScoringService } from '../../scoring/scoring.service';
import { GeographyService } from '../../geography/geography.service';
import { MarketSnapshotService } from '../../market-snapshot/market-snapshot.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('ContentDataService', () => {
  let service: ContentDataService;
  let geography: { searchGeographies: jest.Mock };
  let marketSnapshot: { getSnapshot: jest.Mock };
  let scoring: { getScore: jest.Mock };
  let supabase: { getClient: jest.Mock };

  beforeEach(async () => {
    geography = { searchGeographies: jest.fn() };
    marketSnapshot = { getSnapshot: jest.fn() };
    scoring = { getScore: jest.fn() };
    supabase = { getClient: jest.fn().mockReturnValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        ContentDataService,
        { provide: GeographyService, useValue: geography },
        { provide: MarketSnapshotService, useValue: marketSnapshot },
        { provide: ScoringService, useValue: scoring },
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();
    service = module.get(ContentDataService);
  });

  it('resolveMarket maps geography search results', async () => {
    geography.searchGeographies.mockResolvedValue([
      {
        geography_type: 'metro',
        geography_id: 'metro-35620',
        name: 'New York NY',
        cbsa_code: '35620',
        state_code: 'NY',
        population: 19000000,
      },
    ]);
    const result = await service.resolveMarket('new york');
    expect(result).toHaveLength(1);
    expect(result[0].canonical_name).toBe('New York NY');
    expect(result[0].geography).toBe('metro');
    expect(result[0].id).toBe('35620');
    expect(result[0].state).toBe('NY');
  });

  it('getMarketSnapshot adapts MarketSnapshotResponse into facade shape', async () => {
    marketSnapshot.getSnapshot.mockResolvedValue({
      success: true,
      geography: { id: '35620', name: 'NY', type: 'metro' },
      scores: {
        propertyiq: { score: 72, grade: 'B', components: {} },
      },
      metrics: {
        home_value: {
          value: 600000,
          date: '2026-03-01',
          source: 'zillow',
          sourceGeoId: '35620',
          sourceGeoLevel: 'metro',
          isInherited: false,
          isFallback: false,
        },
        home_value_yoy: {
          value: 3.2,
          date: '2026-03-01',
          source: 'realtor',
          sourceGeoId: '35620',
          sourceGeoLevel: 'metro',
          isInherited: false,
          isFallback: false,
        },
        population: {
          value: 19000000,
          date: '2024-01-01',
          source: 'census',
          sourceGeoId: '35620',
          sourceGeoLevel: 'metro',
          isInherited: false,
          isFallback: false,
        },
        median_income: {
          value: 85000,
          date: '2024-01-01',
          source: 'census',
          sourceGeoId: '35620',
          sourceGeoLevel: 'metro',
          isInherited: false,
          isFallback: false,
        },
        homeownership_rate: {
          value: 62,
          date: '2024-01-01',
          source: 'census',
          sourceGeoId: '35620',
          sourceGeoLevel: 'metro',
          isInherited: false,
          isFallback: false,
        },
        unemployment_rate: {
          value: 4.1,
          date: '2026-03-01',
          source: 'economic',
          sourceGeoId: '35620',
          sourceGeoLevel: 'metro',
          isInherited: false,
          isFallback: false,
        },
        job_growth: {
          value: 1.8,
          date: '2026-03-01',
          source: 'economic',
          sourceGeoId: '35620',
          sourceGeoLevel: 'metro',
          isInherited: false,
          isFallback: false,
        },
      },
      lastUpdated: '2026-03-01',
    });
    scoring.getScore.mockResolvedValue({
      scores: {
        propertyiq: {
          score: 72,
          grade: 'B',
          confidence: 86,
          confidence_level: 'A',
          trend_change: 1.5,
          history: {
            data: [
              { date: '2025-01-01', score: 70 },
              { date: '2025-06-01', score: 72 },
            ],
            months: 12,
            trend: 'up',
            change: 1.5,
          },
        },
      },
    });

    const result = await service.getMarketSnapshot({
      geography: 'metro',
      id: '35620',
      canonical_name: 'NY',
    });
    expect(result.home_value?.value).toBe(600000);
    expect(result.home_value?.yoy_pct).toBe(3.2);
    expect(result.rent).toBeNull();
    expect(result.demographics?.population).toBe(19000000);
    expect(result.economic?.unemployment_rate).toBe(4.1);
    expect(result.score?.propertyiq_score).toBe(72);
    expect(result.score?.confidence).toBe('A');
    expect(result.score?.history).toHaveLength(2);
    expect(result.score?.trend).toBe('up');
    expect(result.score?.trend_change).toBe(1.5);
    expect(scoring.getScore).toHaveBeenCalledWith('35620', 'metro', undefined, {
      historyMonths: 12,
    });
  });

  it('getMarketSnapshot returns all nulls when underlying service throws', async () => {
    marketSnapshot.getSnapshot.mockRejectedValue(new Error('boom'));

    const result = await service.getMarketSnapshot({
      geography: 'metro',
      id: '35620',
      canonical_name: 'NY',
    });
    expect(result.home_value).toBeNull();
    expect(result.rent).toBeNull();
    expect(result.demographics).toBeNull();
    expect(result.economic).toBeNull();
    expect(result.score).toBeNull();
  });

  it('getPropertyIQScore adapts ScoreResult into facade shape with 12-month history', async () => {
    scoring.getScore.mockResolvedValue({
      scores: {
        propertyiq: {
          score: 72,
          grade: 'B',
          confidence: 86,
          confidence_level: 'A',
          history: {
            data: Array(12)
              .fill(null)
              .map((_, i) => ({ date: `2025-${i + 1}-01`, score: 70 + i })),
            months: 12,
            trend: 'up',
            change: 2,
          },
        },
      },
    });
    const r = await service.getPropertyIQScore({
      geography: 'metro',
      id: '35620',
      canonical_name: 'NY',
    });
    expect(r.history).toHaveLength(12);
    expect(r.score).toBe(72);
    expect(r.label).toBe('GOOD');
    expect(r.confidence_level).toBe('A');
    expect(scoring.getScore).toHaveBeenCalledWith('35620', 'metro', undefined, {
      historyMonths: 12,
    });
  });

  it('getPropertyIQScore returns empty result for state-level geo', async () => {
    const r = await service.getPropertyIQScore({
      geography: 'state',
      id: 'California',
      canonical_name: 'California',
    });
    expect(r.score).toBe(0);
    expect(r.confidence_level).toBe('F');
    expect(scoring.getScore).not.toHaveBeenCalled();
  });

  it('getTopCashflowMarkets returns [] and warns for non-metro geo', async () => {
    const r = await service.getTopCashflowMarkets('TX', 'county', 10);
    expect(r).toEqual([]);
  });
});
