import { Test } from '@nestjs/testing';
import { AiInsightsCache } from '../ai-insights.cache';
import { RedisService } from '../../redis/redis.service';

/**
 * Covers computeKey()'s wiring to the shared analyzer-core fingerprint
 * (buildAiInsightsFingerprint) — the fingerprint's own field-by-field
 * sensitivity is exhaustively covered by analyzer-core's
 * ai-cache-fingerprint*.test.ts files. This spec only proves computeKey():
 *   - produces distinct keys when DealInput / rental / flip / brrrr /
 *     grading / PIQ-by-geo / strategy / sectionId change,
 *   - is stable (same key) for logically-identical payloads,
 *   - honors the goal/projection sectionId gating (only 'batch' and the
 *     relevant single section fold those fields into the key).
 */
describe('AiInsightsCache.computeKey', () => {
  let cache: AiInsightsCache;

  const dealInput = {
    price: 425_000,
    rentMonthly: 2_950,
    taxAnnual: 6_400,
    insuranceAnnual: 1_400,
    financing: { downPaymentPct: 0.2, interestRatePct: 7.1, termYears: 30 },
  };

  const rental = {
    noiAnnual: 24_000,
    capRatePct: 5.6,
    cashOnCashPct: 8.2,
    dscr: 1.23,
    cashflowMonthly: 412,
    onePctRulePct: 0.69,
    totalCashInvested: 95_000,
    monthlyDebtService: 1_650,
  };

  const grading = {
    letter: 'B',
    finalGpa: 3.14,
    autoKills: [{ code: 'REFI_NOT_FINANCEABLE' }],
  };

  const basePayload = {
    input: dealInput,
    result: { rental },
    rentcast: { avm: { value: 430_000 } },
    piq: { geo_level: 'metro', geo_id: '35620' },
    piqByGeo: { metro: 73, county: 68, zip: 42 },
    grading,
    strategy: 'BUY_AND_HOLD',
    goal: 'cash_flow',
    projection: { finalEquity: 812_345 },
  };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        AiInsightsCache,
        { provide: RedisService, useValue: { getClient: jest.fn() } },
      ],
    }).compile();
    cache = mod.get(AiInsightsCache);
  });

  it('is deterministic for an identical payload', () => {
    const a = cache.computeKey({ ...basePayload }, 'batch');
    const b = cache.computeKey({ ...basePayload }, 'batch');
    expect(a).toBe(b);
  });

  it('differs by sectionId', () => {
    const batch = cache.computeKey(basePayload, 'batch');
    const projection = cache.computeKey(basePayload, 'projection');
    expect(batch).not.toBe(projection);
  });

  it('differs when the strategy changes', () => {
    const base = cache.computeKey(basePayload, 'batch');
    const brrrr = cache.computeKey(
      { ...basePayload, strategy: 'BRRRR' },
      'batch',
    );
    expect(base).not.toBe(brrrr);
  });

  it('differs when a PIQ-by-geo score changes', () => {
    const base = cache.computeKey(basePayload, 'batch');
    const changed = cache.computeKey(
      {
        ...basePayload,
        piqByGeo: { ...basePayload.piqByGeo, metro: 74 },
      },
      'batch',
    );
    expect(base).not.toBe(changed);
  });

  it('differs when a DealInput financing term changes (fingerprint coverage)', () => {
    const base = cache.computeKey(basePayload, 'batch');
    const changed = cache.computeKey(
      {
        ...basePayload,
        input: {
          ...dealInput,
          financing: { ...dealInput.financing, interestRatePct: 7.5 },
        },
      },
      'batch',
    );
    expect(base).not.toBe(changed);
  });

  it('differs when a flip-only result changes (fingerprint covers FlipResult)', () => {
    const flipPayload = {
      ...basePayload,
      result: {
        flip: {
          mao70: 280_000,
          wholetailMax: 320_000,
          projectedProfit: 45_000,
          projectedRoiPct: 24.5,
        },
      },
      strategy: 'FIX_AND_FLIP',
    };
    const base = cache.computeKey(flipPayload, 'batch');
    const changed = cache.computeKey(
      {
        ...flipPayload,
        result: {
          flip: { ...flipPayload.result.flip, projectedProfit: 45_500 },
        },
      },
      'batch',
    );
    expect(base).not.toBe(changed);
  });

  it('differs when a BRRRR-only result changes (fingerprint covers BrrrrResult)', () => {
    const brrrrPayload = {
      ...basePayload,
      result: {
        brrrr: {
          score: 7.3,
          refinanceCashOut: 300_000,
          remainingCashInDeal: 25_000,
          postRefiCashflowMonthly: 180,
          rating: 'STRONG',
        },
      },
      strategy: 'BRRRR',
    };
    const base = cache.computeKey(brrrrPayload, 'batch');
    const changed = cache.computeKey(
      {
        ...brrrrPayload,
        result: {
          brrrr: { ...brrrrPayload.result.brrrr, rating: 'EXCELLENT' },
        },
      },
      'batch',
    );
    expect(base).not.toBe(changed);
  });

  it('ignores the goal for sections other than batch/recommendation_analysis', () => {
    const a = cache.computeKey({ ...basePayload, goal: 'cash_flow' }, 'comps');
    const b = cache.computeKey({ ...basePayload, goal: 'fast_cash' }, 'comps');
    expect(a).toBe(b);
  });

  it('includes the goal for batch and recommendation_analysis', () => {
    const a = cache.computeKey({ ...basePayload, goal: 'cash_flow' }, 'batch');
    const b = cache.computeKey({ ...basePayload, goal: 'fast_cash' }, 'batch');
    expect(a).not.toBe(b);

    const c = cache.computeKey(
      { ...basePayload, goal: 'cash_flow' },
      'recommendation_analysis',
    );
    const d = cache.computeKey(
      { ...basePayload, goal: 'fast_cash' },
      'recommendation_analysis',
    );
    expect(c).not.toBe(d);
  });

  it('ignores the projection for sections other than batch/projection', () => {
    const a = cache.computeKey(
      { ...basePayload, projection: { finalEquity: 812_345 } },
      'comps',
    );
    const b = cache.computeKey(
      { ...basePayload, projection: { finalEquity: 900_000 } },
      'comps',
    );
    expect(a).toBe(b);
  });

  it('includes the projection for batch and the projection section', () => {
    const a = cache.computeKey(
      { ...basePayload, projection: { finalEquity: 812_345 } },
      'batch',
    );
    const b = cache.computeKey(
      { ...basePayload, projection: { finalEquity: 900_000 } },
      'batch',
    );
    expect(a).not.toBe(b);
  });

  it('starts with the ai-insights:<PROMPT_REVISION>:<sectionId> prefix', () => {
    const key = cache.computeKey(basePayload, 'batch');
    expect(key).toMatch(/^ai-insights:v\d+:batch:/);
  });
});
