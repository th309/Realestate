/**
 * Unit tests for MarketResolutionService.
 *
 * Verifies:
 *   - geoId/zip → metro/zip normalization picks the right table
 *   - missing identifier returns {null, null} without hitting the DB
 *   - DB failures surface as nulls (never throw)
 *   - 5-min TTL cache: same identifier resolves the upstream service once
 *   - explicit context preempt is the caller's responsibility (NOT this
 *     service's) — verified indirectly via the grading service tests
 */
import { Test } from '@nestjs/testing';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { ScoringService } from '../../scoring/scoring.service';
import { MarketResolutionService } from '../market-resolution.service';

interface MockQueryBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  maybeSingle: jest.Mock;
}

function makeSupabaseStub(rowByTable: Record<string, unknown | null>) {
  const fromCalls: string[] = [];
  const builder = (table: string): MockQueryBuilder => {
    fromCalls.push(table);
    const chain: MockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: rowByTable[table] ?? null,
        error: null,
      }),
    };
    return chain;
  };
  return {
    from: jest.fn((table: string) => builder(table)),
    fromCalls,
  };
}

describe('MarketResolutionService', () => {
  let service: MarketResolutionService;
  let supabase: ReturnType<typeof makeSupabaseStub>;
  let scoring: { getScore: jest.Mock };

  beforeEach(async () => {
    supabase = makeSupabaseStub({
      realtor_metro: { median_days_on_market: 42 },
      realtor_zip: { median_days_on_market: 58 },
    });
    scoring = {
      getScore: jest.fn().mockResolvedValue({
        scores: { propertyiq: { score: 73, grade: 'GOOD' } },
      }),
    };

    const mod = await Test.createTestingModule({
      providers: [
        MarketResolutionService,
        { provide: SUPABASE_CLIENT, useValue: supabase },
        { provide: ScoringService, useValue: scoring },
      ],
    }).compile();

    service = mod.get(MarketResolutionService);
  });

  it('returns nulls and skips lookups when no identifier provided', async () => {
    const r = await service.resolve({});
    expect(r).toEqual({ marketDomDays: null, marketPiqScore: null });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(scoring.getScore).not.toHaveBeenCalled();
  });

  it('resolves DOM + PIQ for a CBSA geoId from realtor_metro + ScoringService', async () => {
    const r = await service.resolve({ marketGeoId: '35620' });
    expect(r.marketDomDays).toBe(42);
    expect(r.marketPiqScore).toBe(73);
    expect(supabase.fromCalls).toContain('realtor_metro');
    expect(scoring.getScore).toHaveBeenCalledWith('35620', 'metro');
  });

  it('resolves DOM + PIQ for a ZIP from realtor_zip', async () => {
    const r = await service.resolve({ marketZip: '95814' });
    expect(r.marketDomDays).toBe(58);
    expect(r.marketPiqScore).toBe(73);
    expect(supabase.fromCalls).toContain('realtor_zip');
    expect(scoring.getScore).toHaveBeenCalledWith('95814', 'zip');
  });

  it('caches per-identifier — second call within TTL does NOT re-query', async () => {
    await service.resolve({ marketGeoId: '35620' });
    const fromCallsBefore = supabase.from.mock.calls.length;
    const scoringCallsBefore = scoring.getScore.mock.calls.length;
    const r2 = await service.resolve({ marketGeoId: '35620' });
    expect(r2.marketDomDays).toBe(42);
    expect(r2.marketPiqScore).toBe(73);
    expect(supabase.from.mock.calls.length).toBe(fromCallsBefore);
    expect(scoring.getScore.mock.calls.length).toBe(scoringCallsBefore);
  });

  it('different identifiers do NOT collide in cache', async () => {
    await service.resolve({ marketGeoId: '35620' });
    await service.resolve({ marketZip: '95814' });
    // metro + zip = two distinct table calls
    expect(supabase.fromCalls).toEqual(
      expect.arrayContaining(['realtor_metro', 'realtor_zip']),
    );
    expect(scoring.getScore).toHaveBeenCalledTimes(2);
  });

  it('DOM null when row missing — does not throw', async () => {
    supabase = makeSupabaseStub({ realtor_metro: null });
    const mod = await Test.createTestingModule({
      providers: [
        MarketResolutionService,
        { provide: SUPABASE_CLIENT, useValue: supabase },
        { provide: ScoringService, useValue: scoring },
      ],
    }).compile();
    service = mod.get(MarketResolutionService);

    const r = await service.resolve({ marketGeoId: '35620' });
    expect(r.marketDomDays).toBeNull();
    expect(r.marketPiqScore).toBe(73);
  });

  it('PIQ null when ScoringService throws — does not throw', async () => {
    scoring.getScore.mockRejectedValueOnce(new Error('db unreachable'));
    const r = await service.resolve({ marketGeoId: '35620' });
    expect(r.marketDomDays).toBe(42);
    expect(r.marketPiqScore).toBeNull();
  });

  it('clearCache() forces re-query on next resolve', async () => {
    await service.resolve({ marketGeoId: '35620' });
    service.clearCache();
    await service.resolve({ marketGeoId: '35620' });
    expect(scoring.getScore).toHaveBeenCalledTimes(2);
  });

  it('lat/lng only — no-op until reverse-geocoder lands', async () => {
    const r = await service.resolve({ marketLat: 38.58, marketLng: -121.49 });
    expect(r).toEqual({ marketDomDays: null, marketPiqScore: null });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
