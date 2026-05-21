import { Test } from '@nestjs/testing';
import { AnalyzerService } from '../analyzer.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { GeographyChainService } from '../../metric-resolution/geography-chain.service';
import { ScoringService } from '../../scoring/scoring.service';
import { RentcastService } from '../../rentcast/rentcast.service';
import { AiProviderService } from '../../ai-provider/ai-provider.service';
import type { ResolvedMetric } from '../../metric-resolution/metric-resolution.types';

/**
 * Build a ResolvedMetric in the exact shape MetricResolutionService emits,
 * so the service-under-test sees realistic inputs rather than the simplified
 * `{value, source}` sketch from the plan template.
 */
function resolved(
  value: number | null,
  source: ResolvedMetric['source'],
): ResolvedMetric {
  return {
    value,
    date: value == null ? null : '2026-04-01',
    source,
    sourceGeoId: value == null ? null : 'X',
    sourceGeoLevel: value == null ? null : 'zip',
    isInherited: false,
    isFallback: false,
  };
}

describe('AnalyzerService.getMarketContext', () => {
  let service: AnalyzerService;
  let metricResolution: { resolveMetricBatch: jest.Mock };
  let geographyChain: { getInheritanceChain: jest.Mock };
  let scoringService: { getScore: jest.Mock };

  beforeEach(async () => {
    metricResolution = { resolveMetricBatch: jest.fn() };
    // Default: 78704 ZIP → Travis County → Austin Metro → TX → national.
    // Individual tests can override mockResolvedValue as needed.
    geographyChain = {
      getInheritanceChain: jest.fn().mockResolvedValue([
        { id: '78704', level: 'zip' },
        { id: '48453', level: 'county' },
        { id: '12420', level: 'metro' },
        { id: '48', level: 'state' },
        { id: 'national', level: 'national' },
      ]),
    };
    scoringService = { getScore: jest.fn() };
    const rentcastMock = {
      getPropertyRecord: jest.fn(),
      getValueEstimate: jest.fn(),
      getRentEstimate: jest.fn(),
    };
    const mod = await Test.createTestingModule({
      providers: [
        AnalyzerService,
        { provide: MetricResolutionService, useValue: metricResolution },
        { provide: GeographyChainService, useValue: geographyChain },
        { provide: ScoringService, useValue: scoringService },
        { provide: RentcastService, useValue: rentcastMock },
        { provide: AiProviderService, useValue: { stream: jest.fn() } },
      ],
    }).compile();
    service = mod.get(AnalyzerService);
  });

  it('returns full context when all sources resolve', async () => {
    metricResolution.resolveMetricBatch.mockResolvedValue({
      home_value: resolved(425_000, 'zillow'),
      rent_index: resolved(2_950, 'zillow'),
      market_heat: resolved(8.2, 'zillow'),
      net_migration: resolved(2_100, 'irs'),
    });
    scoringService.getScore.mockResolvedValue({
      location_id: '78704',
      location_name: 'Austin',
      geography: 'zip',
      median_price: 425_000,
      score_date: '2026-04-01',
      scores: {
        propertyiq: {
          score: 73,
          grade: 'GOOD',
          confidence: 90,
          confidence_level: 'A',
        },
      },
    });

    const ctx = await service.getMarketContext({ zip: '78704' });

    expect(ctx.geo_level).toBe('zip');
    expect(ctx.geo_id).toBe('78704');
    expect(ctx.home_value).toEqual({ value: 425_000, source: 'zillow' });
    expect(ctx.rent_index).toEqual({ value: 2_950, source: 'zillow' });
    expect(ctx.market_heat).toEqual({ value: 8.2, source: 'zillow' });
    expect(ctx.net_migration).toEqual({ value: 2_100, source: 'irs' });
    expect(ctx.piq_score).toEqual({ value: 73, label: 'GOOD' });
    expect(ctx.chain).toEqual({
      zip: '78704',
      county_fips: '48453',
      cbsa_code: '12420',
      state: '48',
    });

    expect(metricResolution.resolveMetricBatch).toHaveBeenCalledWith(
      [
        'home_value',
        'home_value_yoy',
        'rent_index',
        'market_heat',
        'net_migration',
      ],
      'zip',
      '78704',
    );
    expect(geographyChain.getInheritanceChain).toHaveBeenCalledWith(
      'zip',
      '78704',
    );
    expect(scoringService.getScore).toHaveBeenCalledWith('78704', 'zip');
  });

  it('returns nulls per-field when individual sources fail', async () => {
    metricResolution.resolveMetricBatch.mockResolvedValue({
      home_value: resolved(300_000, 'zillow'),
      rent_index: resolved(null, 'none'),
      market_heat: resolved(null, 'none'),
      net_migration: resolved(null, 'none'),
    });
    scoringService.getScore.mockRejectedValue(new Error('not found'));

    const ctx = await service.getMarketContext({ zip: '99999' });

    expect(ctx.home_value).toEqual({ value: 300_000, source: 'zillow' });
    expect(ctx.rent_index).toEqual({ value: null, source: null });
    expect(ctx.market_heat).toEqual({ value: null, source: null });
    expect(ctx.net_migration).toEqual({ value: null, source: null });
    expect(ctx.piq_score).toBeNull();
  });

  it('returns empty context when no geography is supplied', async () => {
    const ctx = await service.getMarketContext({});
    expect(ctx).toEqual({
      geo_level: null,
      geo_id: null,
      home_value: null,
      home_value_yoy: null,
      rent_index: null,
      market_heat: null,
      net_migration: null,
      piq_score: null,
      chain: null,
    });
    expect(metricResolution.resolveMetricBatch).not.toHaveBeenCalled();
    expect(geographyChain.getInheritanceChain).not.toHaveBeenCalled();
    expect(scoringService.getScore).not.toHaveBeenCalled();
  });

  it('skips PIQ score lookup for state-level requests (scoring engine is metro/county/zip only)', async () => {
    metricResolution.resolveMetricBatch.mockResolvedValue({
      home_value: resolved(350_000, 'zillow'),
      rent_index: resolved(2_100, 'zillow'),
      market_heat: resolved(null, 'none'),
      net_migration: resolved(50_000, 'irs'),
    });

    const ctx = await service.getMarketContext({ state: 'TX' });

    expect(ctx.geo_level).toBe('state');
    expect(ctx.geo_id).toBe('TX');
    expect(ctx.piq_score).toBeNull();
    expect(scoringService.getScore).not.toHaveBeenCalled();
  });

  it('returns nulls when the whole metric batch throws', async () => {
    metricResolution.resolveMetricBatch.mockRejectedValue(
      new Error('supabase down'),
    );
    scoringService.getScore.mockResolvedValue(null);

    const ctx = await service.getMarketContext({ county_fips: '48453' });

    expect(ctx.geo_level).toBe('county');
    expect(ctx.geo_id).toBe('48453');
    expect(ctx.home_value).toBeNull();
    expect(ctx.rent_index).toBeNull();
    expect(ctx.market_heat).toBeNull();
    expect(ctx.net_migration).toBeNull();
    expect(ctx.piq_score).toBeNull();
  });
});

describe('AnalyzerService.lookupProperty', () => {
  it('orchestrates 3 RentCast calls and consolidates into PropertyLookupDto', async () => {
    const rentcast = {
      getPropertyRecord: jest.fn().mockResolvedValue({
        beds: 3,
        baths: 2,
        sqft: 1450,
        yearBuilt: 1998,
        taxAssessment: 220_000,
        propertyType: 'Single Family',
      }),
      getValueEstimate: jest.fn().mockResolvedValue({
        value: 245_000,
        low: 230_000,
        high: 260_000,
        comps: [{ address: '125 Main St' }, { address: '127 Main St' }],
      }),
      getRentEstimate: jest.fn().mockResolvedValue({
        rent: 2_850,
        low: 2_700,
        high: 3_000,
        comps: [{ address: '129 Main St' }],
      }),
    };
    const service = new AnalyzerService(
      {} as any,
      {} as any,
      {} as any,
      rentcast as any,
      {} as any,
    );

    const r = await service.lookupProperty('123 Main St');

    expect(r.property_record).toEqual({
      beds: 3,
      baths: 2,
      sqft: 1450,
      yearBuilt: 1998,
      taxAssessment: 220_000,
      propertyType: 'Single Family',
    });
    expect(r.avm).toEqual({
      value: 245_000,
      low: 230_000,
      high: 260_000,
      comps_count: 2,
    });
    expect(r.rent).toEqual({
      value: 2_850,
      low: 2_700,
      high: 3_000,
      comps_count: 1,
    });
    expect(r.sales_comps).toHaveLength(2);
    expect(r.rental_comps).toHaveLength(1);
    expect(r.cache_age_days).toBe(0);
    expect(r.source).toBe('rentcast');
    expect(rentcast.getPropertyRecord).toHaveBeenCalledWith('123 Main St');
    expect(rentcast.getValueEstimate).toHaveBeenCalledWith('123 Main St');
    expect(rentcast.getRentEstimate).toHaveBeenCalledWith('123 Main St');
  });

  it('degrades to nulls on per-field failure (AVM rejects, rent succeeds)', async () => {
    const rentcast = {
      getPropertyRecord: jest.fn().mockResolvedValue({ beds: 3 }),
      getValueEstimate: jest.fn().mockRejectedValue(new Error('boom')),
      getRentEstimate: jest.fn().mockResolvedValue({
        rent: 2_850,
        low: 2_700,
        high: 3_000,
        comps: [],
      }),
    };
    const service = new AnalyzerService(
      {} as any,
      {} as any,
      {} as any,
      rentcast as any,
      {} as any,
    );

    const r = await service.lookupProperty('123 Main St');

    expect(r.property_record).toEqual({ beds: 3 });
    expect(r.avm).toBeNull();
    expect(r.rent?.value).toBe(2_850);
    expect(r.sales_comps).toEqual([]);
    expect(r.rental_comps).toEqual([]);
    expect(r.source).toBe('rentcast');
  });

  it('degrades all three fields when every RentCast call fails', async () => {
    const rentcast = {
      getPropertyRecord: jest.fn().mockRejectedValue(new Error('a')),
      getValueEstimate: jest.fn().mockRejectedValue(new Error('b')),
      getRentEstimate: jest.fn().mockRejectedValue(new Error('c')),
    };
    const service = new AnalyzerService(
      {} as any,
      {} as any,
      {} as any,
      rentcast as any,
      {} as any,
    );

    const r = await service.lookupProperty('999 Bad Address');

    expect(r.property_record).toBeNull();
    expect(r.avm).toBeNull();
    expect(r.rent).toBeNull();
    expect(r.sales_comps).toEqual([]);
    expect(r.rental_comps).toEqual([]);
    expect(r.source).toBe('rentcast');
  });
});
