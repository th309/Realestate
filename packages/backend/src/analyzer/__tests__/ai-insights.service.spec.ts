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
    expect(userPrompt).toContain('Geography: metro');
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
});
