/**
 * Tests for ZIP county inheritance backfill logic.
 * Verifies that missing demand_score/hotness_score are inherited from parent county.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from '../../scoring.service';
import { NormalizationService } from '../../normalization.service';
import { InheritanceService } from '../../inheritance.service';
import { MarketHealthService } from '../../market-health.service';
import { SUPABASE_CLIENT } from '../../../supabase/supabase.service';
import { LocationMetrics } from '../../scoring.types';

// Helper to build a mock Supabase chain that returns different data per table
function createMockSupabase(tableResponses: Record<string, any[]>) {
  const mock: any = {};
  let currentTable = '';

  mock.from = jest.fn((table: string) => {
    currentTable = table;
    return mock;
  });
  mock.select = jest.fn().mockReturnValue(mock);
  mock.eq = jest.fn().mockReturnValue(mock);
  mock.in = jest.fn().mockReturnValue(mock);
  mock.order = jest.fn().mockReturnValue(mock);
  mock.range = jest.fn().mockImplementation(() => {
    const data = tableResponses[currentTable] || [];
    return Promise.resolve({ data, error: null });
  });
  mock.limit = jest.fn().mockReturnValue(mock);
  mock.single = jest.fn().mockResolvedValue({ data: null });
  mock.upsert = jest.fn().mockResolvedValue({ error: null });
  mock.delete = jest.fn().mockReturnValue(mock);
  mock.insert = jest.fn().mockResolvedValue({ error: null });

  return mock;
}

describe('backfillFromCounty', () => {
  it('should backfill missing demand_score from parent county', async () => {
    const mockSupabase = createMockSupabase({
      geography_inheritance: [
        { geography_id: '90210', geography_type: 'zip', parent_county_fips: '06037' },
      ],
      realtor_county: [
        { county_fips: '06037', demand_score: 72, hotness_score: 65 },
      ],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();

    const service = module.get<ScoringService>(ScoringService);
    const locationsMap = new Map<string, LocationMetrics>();
    locationsMap.set('90210', {
      location_id: '90210',
      location_name: 'Beverly Hills',
      demand_score: undefined,  // missing
      hotness_score: undefined, // missing
      pending_ratio: 0.5,
      median_days_on_market: 30,
    });

    // Access private method via bracket notation
    await (service as any).backfillFromCounty(
      locationsMap,
      '2025-12-01',
      ['demand_score', 'hotness_score'],
    );

    const location = locationsMap.get('90210')!;
    expect(location.demand_score).toBe(72);
    expect(location.hotness_score).toBe(65);
    expect(location._inherited).toContain('demand_score');
    expect(location._inherited).toContain('hotness_score');
  });

  it('should NOT overwrite existing metric values', async () => {
    const mockSupabase = createMockSupabase({
      geography_inheritance: [
        { geography_id: '90210', geography_type: 'zip', parent_county_fips: '06037' },
      ],
      realtor_county: [
        { county_fips: '06037', demand_score: 72, hotness_score: 65 },
      ],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();

    const service = module.get<ScoringService>(ScoringService);
    const locationsMap = new Map<string, LocationMetrics>();
    locationsMap.set('90210', {
      location_id: '90210',
      location_name: 'Beverly Hills',
      demand_score: 88,         // already has value
      hotness_score: undefined,  // missing
      pending_ratio: 0.5,
      median_days_on_market: 30,
    });

    await (service as any).backfillFromCounty(
      locationsMap,
      '2025-12-01',
      ['demand_score', 'hotness_score'],
    );

    const location = locationsMap.get('90210')!;
    expect(location.demand_score).toBe(88);  // unchanged
    expect(location.hotness_score).toBe(65); // inherited
    expect(location._inherited).not.toContain('demand_score');
    expect(location._inherited).toContain('hotness_score');
  });

  it('should handle ZIP with no geography_inheritance entry', async () => {
    const mockSupabase = createMockSupabase({
      geography_inheritance: [],  // no mapping found
      realtor_county: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();

    const service = module.get<ScoringService>(ScoringService);
    const locationsMap = new Map<string, LocationMetrics>();
    locationsMap.set('99999', {
      location_id: '99999',
      location_name: 'Unknown ZIP',
      demand_score: undefined,
      hotness_score: undefined,
    });

    await (service as any).backfillFromCounty(
      locationsMap,
      '2025-12-01',
      ['demand_score', 'hotness_score'],
    );

    const location = locationsMap.get('99999')!;
    expect(location.demand_score).toBeUndefined();
    expect(location.hotness_score).toBeUndefined();
    expect(location._inherited).toBeUndefined();
  });

  it('should handle parent county also missing the metric', async () => {
    const mockSupabase = createMockSupabase({
      geography_inheritance: [
        { geography_id: '99998', geography_type: 'zip', parent_county_fips: '99001' },
      ],
      realtor_county: [
        { county_fips: '99001', demand_score: null, hotness_score: null },
      ],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        NormalizationService,
        InheritanceService,
        MarketHealthService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();

    const service = module.get<ScoringService>(ScoringService);
    const locationsMap = new Map<string, LocationMetrics>();
    locationsMap.set('99998', {
      location_id: '99998',
      location_name: 'Rural ZIP',
      demand_score: undefined,
      hotness_score: undefined,
    });

    await (service as any).backfillFromCounty(
      locationsMap,
      '2025-12-01',
      ['demand_score', 'hotness_score'],
    );

    const location = locationsMap.get('99998')!;
    expect(location.demand_score).toBeUndefined();
    expect(location.hotness_score).toBeUndefined();
    expect(location._inherited).toBeUndefined();
  });
});
