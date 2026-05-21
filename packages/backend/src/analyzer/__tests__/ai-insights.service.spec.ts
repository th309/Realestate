import { Test } from '@nestjs/testing';
import { AiInsightsService, InsightPayload } from '../ai-insights.service';
import { AiInsightsCache } from '../ai-insights.cache';
import { AiProviderService } from '../../ai-provider/ai-provider.service';

describe('AiInsightsService', () => {
  let service: AiInsightsService;
  let cache: {
    get: jest.Mock;
    set: jest.Mock;
    computeKey: jest.Mock;
  };
  let provider: { complete: jest.Mock; stream: jest.Mock };

  const samplePayload: InsightPayload = {
    input: {
      price: 425_000,
      rentMonthly: 2_950,
      taxAnnual: 6_400,
    },
    result: {
      monthlyCashFlow: 412,
      capRate: 0.064,
      coc: 0.082,
    },
    rentcast: {
      avm: { value: 432_000 },
      rent: { value: 2_900 },
      property_record: { sqft: 1_700 },
      sales_comps: [
        { address: '123 Oak St', price: 420_000, sqft: 1_650, distance: 0.4 },
        { address: '456 Elm Ave', price: 435_000, sqft: 1_780, distance: 0.6 },
      ],
      rental_comps: [{ address: '789 Pine Rd', rent: 2_875 }],
    },
    piq: {
      geo_level: 'metro',
      geo_id: '35620',
      piq_score: { value: 73, label: 'GOOD' },
      home_value: { value: 432_000, source: 'zillow' },
      home_value_yoy: { value: 6.2, source: 'realtor' },
      rent_index: { value: 2_950, source: 'zillow' },
      market_heat: { value: 8.2, source: 'realtor' },
      net_migration: { value: 2_100, source: 'irs' },
    },
    piqByGeo: { metro: 73, county: 68, zip: 42 },
  };

  beforeEach(async () => {
    cache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      computeKey: jest.fn().mockReturnValue('test-key'),
    };
    provider = {
      complete: jest.fn(),
      stream: jest.fn(),
    };

    const mod = await Test.createTestingModule({
      providers: [
        AiInsightsService,
        { provide: AiInsightsCache, useValue: cache },
        { provide: AiProviderService, useValue: provider },
      ],
    }).compile();
    service = mod.get(AiInsightsService);
  });

  it('returns cached text without calling provider on cache hit', async () => {
    cache.get.mockResolvedValue({
      text: 'cached verdict',
      threadId: 'thread-123',
      citedFacts: ['piq=73'],
    });

    const result = await service.complete(samplePayload, 'header_verdict');

    expect(result).toEqual({
      text: 'cached verdict',
      threadId: 'thread-123',
      citedFacts: ['piq=73'],
      cacheHit: true,
    });
    expect(provider.complete).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('on cache miss assembles prompt, calls provider, sets cache, returns cacheHit:false', async () => {
    cache.get.mockResolvedValue(null);
    provider.complete.mockResolvedValue({
      content: 'fresh verdict from provider',
      model: 'claude-haiku-4-5',
      provider: 'anthropic',
      durationMs: 142,
    });

    const result = await service.complete(samplePayload, 'header_verdict');

    expect(result.text).toBe('fresh verdict from provider');
    expect(result.cacheHit).toBe(false);
    expect(typeof result.threadId).toBe('string');
    expect(result.citedFacts).toEqual([]);

    expect(provider.complete).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith('test-key', {
      text: 'fresh verdict from provider',
      threadId: result.threadId,
      citedFacts: [],
    });
  });

  it('assembled prompt includes all four context blocks', async () => {
    cache.get.mockResolvedValue(null);
    provider.complete.mockResolvedValue({
      content: 'ok',
      model: 'm',
      provider: 'anthropic',
      durationMs: 1,
    });

    await service.complete(samplePayload, 'header_verdict');

    const call = provider.complete.mock.calls[0];
    const request = call[1];
    const userPrompt = request.userPrompt as string;

    expect(userPrompt).toContain('DEAL INPUT:');
    expect(userPrompt).toContain('COMPUTED METRICS');
    expect(userPrompt).toContain('SUBJECT PROPERTY:');
    expect(userPrompt).toContain('PROPERTY DATA (RentCast):');
    expect(userPrompt).toContain('MARKET CONTEXT (PropertyIQ):');
    // Sanity: numeric values from the payload should appear in the assembled prompt
    expect(userPrompt).toContain('425000');
    expect(userPrompt).toContain('123 Oak St');
    expect(userPrompt).toContain('73');
    // Subject $/sqft = 425000 / 1700 = 250
    expect(userPrompt).toContain('$250');
    // Comp $/sqft annotated inline on each comp line: 420000/1650 = 255
    expect(userPrompt).toContain('1650sqft');
    expect(userPrompt).toContain('$255/sqft');
    // Subject monthly rent + RentCast estimate surfaced for rent comparison
    expect(userPrompt).toContain('Underwritten monthly rent: $2950');
    expect(userPrompt).toContain('RentCast rent estimate: $2900');
    // Rental comp lines include rent and (mi)
    expect(userPrompt).toContain('789 Pine Rd $2875/mo');
    // Price appreciation YoY surfaced with source
    expect(userPrompt).toContain('Price appreciation YoY: 6.2%');
    expect(userPrompt).toContain('Geography resolved to: metro');
    // PIQ SCORE BY GEOGRAPHY block surfaces all three levels with caveats
    expect(userPrompt).toContain('PIQ SCORE BY GEOGRAPHY:');
    expect(userPrompt).toContain('Metro (most stable');
    expect(userPrompt).toContain('73');
    expect(userPrompt).toContain('County (moderate sample');
    expect(userPrompt).toContain('ZIP (small sample');
    expect(request.systemPrompt).toContain('real-estate analyst');
  });

  it('uses analyzer_section_annotation purpose for non-header sections', async () => {
    cache.get.mockResolvedValue(null);
    provider.complete.mockResolvedValue({
      content: 'section note',
      model: 'm',
      provider: 'anthropic',
      durationMs: 1,
    });

    await service.complete(samplePayload, 'projection');

    expect(provider.complete).toHaveBeenCalledWith(
      'analyzer_section_annotation',
      expect.objectContaining({
        systemPrompt: expect.any(String),
        userPrompt: expect.any(String),
        maxTokens: 200,
      }),
    );
  });

  it('uses analyzer_header_verdict purpose for header_verdict section', async () => {
    cache.get.mockResolvedValue(null);
    provider.complete.mockResolvedValue({
      content: 'verdict',
      model: 'm',
      provider: 'anthropic',
      durationMs: 1,
    });

    await service.complete(samplePayload, 'header_verdict');

    expect(provider.complete).toHaveBeenCalledWith(
      'analyzer_header_verdict',
      expect.objectContaining({
        systemPrompt: expect.any(String),
        userPrompt: expect.any(String),
        maxTokens: 200,
      }),
    );
  });

  describe('completeAllSections (batched)', () => {
    const validBatchJson = JSON.stringify({
      recommendation_analysis: 'This is a B grade buy and hold deal.',
      projection: 'Principal paydown drives most of the 30-year wealth.',
      expense_waterfall: 'Debt service eats 58 percent of gross rent.',
      sensitivity: 'Rent and rate are the two biggest swing inputs.',
      comps: 'Price per sqft sits in the middle of the comp range.',
      after_tax: 'Depreciation lifts after-tax cashflow by roughly 18 percent.',
    });

    it('on cache miss: fires ONE provider call, returns all 6 sections, caches the raw JSON', async () => {
      cache.get.mockResolvedValue(null);
      provider.complete.mockResolvedValue({
        content: validBatchJson,
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        durationMs: 980,
      });

      const result = await service.completeAllSections(samplePayload);

      expect(provider.complete).toHaveBeenCalledTimes(1);
      expect(provider.complete).toHaveBeenCalledWith(
        'analyzer_section_annotation',
        expect.objectContaining({ maxTokens: 2000 }),
      );

      expect(result.recommendation_analysis.text).toBe(
        'This is a B grade buy and hold deal.',
      );
      expect(result.projection.text).toBe(
        'Principal paydown drives most of the 30-year wealth.',
      );
      expect(result.expense_waterfall.text).toContain('Debt service');
      expect(result.sensitivity.text).toContain('Rent and rate');
      expect(result.comps.text).toContain('comp range');
      expect(result.after_tax.text).toContain('Depreciation');

      for (const id of [
        'recommendation_analysis',
        'projection',
        'expense_waterfall',
        'sensitivity',
        'comps',
        'after_tax',
      ] as const) {
        expect(result[id].cacheHit).toBe(false);
        expect(typeof result[id].threadId).toBe('string');
      }

      expect(cache.set).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({ text: validBatchJson }),
      );
    });

    it('on cache hit: skips provider, returns cached sections with cacheHit:true', async () => {
      cache.get.mockResolvedValue({
        text: validBatchJson,
        threadId: 'cached-thread',
        citedFacts: [],
      });

      const result = await service.completeAllSections(samplePayload);

      expect(provider.complete).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();

      expect(result.projection.text).toBe(
        'Principal paydown drives most of the 30-year wealth.',
      );
      expect(result.projection.cacheHit).toBe(true);
      expect(result.projection.threadId).toBe('cached-thread');
    });

    it('tolerates markdown code-fence wrapping around the JSON', async () => {
      cache.get.mockResolvedValue(null);
      provider.complete.mockResolvedValue({
        content: '```json\n' + validBatchJson + '\n```',
        model: 'm',
        provider: 'anthropic',
        durationMs: 1,
      });

      const result = await service.completeAllSections(samplePayload);
      expect(result.projection.text).toContain('Principal paydown');
    });

    it('tolerates a leading prose preamble before the JSON object', async () => {
      cache.get.mockResolvedValue(null);
      provider.complete.mockResolvedValue({
        content: `Sure, here is the JSON:\n\n${validBatchJson}`,
        model: 'm',
        provider: 'anthropic',
        durationMs: 1,
      });

      const result = await service.completeAllSections(samplePayload);
      expect(result.projection.text).toContain('Principal paydown');
    });

    it('does NOT cache when JSON parse fails — returns empty sections', async () => {
      cache.get.mockResolvedValue(null);
      provider.complete.mockResolvedValue({
        content: 'this is not JSON at all',
        model: 'm',
        provider: 'anthropic',
        durationMs: 1,
      });

      const result = await service.completeAllSections(samplePayload);

      expect(result.projection.text).toBe('');
      expect(result.recommendation_analysis.text).toBe('');
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('does NOT request response_format json from provider', async () => {
      cache.get.mockResolvedValue(null);
      provider.complete.mockResolvedValue({
        content: validBatchJson,
        model: 'm',
        provider: 'anthropic',
        durationMs: 1,
      });

      await service.completeAllSections(samplePayload);
      const request = provider.complete.mock.calls[0][1];
      expect(request.responseFormat).toBeUndefined();
    });

    it('fills missing keys in the model response with empty strings', async () => {
      cache.get.mockResolvedValue(null);
      provider.complete.mockResolvedValue({
        content: JSON.stringify({
          projection: 'present',
          comps: 'also present',
        }),
        model: 'm',
        provider: 'anthropic',
        durationMs: 1,
      });

      const result = await service.completeAllSections(samplePayload);
      expect(result.projection.text).toBe('present');
      expect(result.comps.text).toBe('also present');
      expect(result.recommendation_analysis.text).toBe('');
      expect(result.expense_waterfall.text).toBe('');
      expect(result.sensitivity.text).toBe('');
      expect(result.after_tax.text).toBe('');
    });
  });
});
