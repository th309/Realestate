// packages/backend/src/content-pipeline/copy-suggest/copy-suggest.service.spec.ts
import { BadRequestException } from '@nestjs/common';
import { CopySuggestService } from './copy-suggest.service';
import type { CostCapService } from '../auto-ideation/cost-cap.service';

// The one live dependency: every LLM call in the content pipeline routes
// through this helper, so mocking it keeps the whole test offline.
const mockLlmCall = jest.fn<Promise<unknown>, [unknown]>();
jest.mock('../drivers/anthropic-messages-retry', () => ({
  anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback: (
    params: unknown,
  ): Promise<unknown> => mockLlmCall(params),
}));

/** Anthropic pricing gives a non-zero cost without needing DeepSeek env rates. */
beforeAll(() => {
  delete process.env.DEEPSEEK_API_KEY;
  process.env.CONTENT_PIPELINE_LLM_PROVIDER = 'anthropic';
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

function llmResponse(input: Record<string, unknown>) {
  return {
    message: {
      content: [{ type: 'tool_use', name: 'emit_copy', input }],
      usage: { input_tokens: 900, output_tokens: 200 },
    },
    backendUsed: 'anthropic' as const,
    modelUsed: 'claude-sonnet-4-6',
  };
}

const GOOD_COPY = {
  hookHeadline: [
    'You lost that listing to better numbers',
    'Your client asked. You guessed.',
    'Three tabs and still no answer',
  ],
  featureTitle: [
    'Know a market in 10 seconds',
    'Walk in with the numbers ready',
    'Spot the shift before your competition',
  ],
  featureCallout: [
    'One score, every market',
    'Built for the listing appointment',
    'See momentum turn early',
  ],
  ctaHeadline: ['Look up your market free'],
};

let costCap: { canEnqueue: jest.Mock; recordSpend: jest.Mock };

function buildService() {
  costCap = {
    canEnqueue: jest.fn().mockResolvedValue({
      allowed: true,
      remainingUsd: 40,
      usdSpent: 10,
      usdCap: 50,
    }),
    recordSpend: jest.fn().mockResolvedValue(undefined),
  };
  return new CopySuggestService(costCap as unknown as CostCapService);
}

beforeEach(() => {
  mockLlmCall.mockReset();
});

describe('CopySuggestService shapes each field by its declaration', () => {
  it('returns an array per variant for the hook and a plain string for the closing line', async () => {
    mockLlmCall.mockResolvedValueOnce(llmResponse(GOOD_COPY));
    const service = buildService();

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    // hookHeadline declares variants: 3
    expect(Array.isArray(result.fields.hookHeadline)).toBe(true);
    expect(result.fields.hookHeadline).toHaveLength(3);
    // ctaHeadline declares neither variants nor repeating
    expect(typeof result.fields.ctaHeadline).toBe('string');
    expect(result.fields.ctaHeadline).toBe('Look up your market free');
    expect(result.degraded).toBeUndefined();
  });

  it('returns one value per feature for repeating fields, following itemCount', async () => {
    mockLlmCall.mockResolvedValueOnce(
      llmResponse({
        ...GOOD_COPY,
        featureTitle: ['Know a market in 10 seconds', 'Price it with proof'],
        featureCallout: ['One score, every market', 'Numbers before the pitch'],
      }),
    );
    const service = buildService();

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 2,
      context: {},
    });

    expect(result.fields.featureTitle).toHaveLength(2);
    expect(result.fields.featureCallout).toHaveLength(2);
    // Variants are independent of the feature count.
    expect(result.fields.hookHeadline).toHaveLength(3);
  });

  it('pads a short model response with empty strings so the form still renders every input', async () => {
    mockLlmCall.mockResolvedValueOnce(
      llmResponse({ ...GOOD_COPY, featureTitle: ['Know a market fast'] }),
    );
    const service = buildService();

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    expect(result.fields.featureTitle).toEqual(['Know a market fast', '', '']);
  });
});

describe('CopySuggestService enforces each field maxLength after the model answers', () => {
  it('truncates an over-long hook at a word boundary within its 90-character limit', async () => {
    const tooLong =
      'You lost that listing because someone else walked in with better numbers than you had ready that morning';
    expect(tooLong.length).toBeGreaterThan(90);

    mockLlmCall.mockResolvedValueOnce(
      llmResponse({
        ...GOOD_COPY,
        hookHeadline: [
          tooLong,
          GOOD_COPY.hookHeadline[1],
          GOOD_COPY.hookHeadline[2],
        ],
      }),
    );
    const service = buildService();

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    const hooks = result.fields.hookHeadline as string[];
    expect(hooks[0].length).toBeLessThanOrEqual(90);
    // Cut between words, and still a genuine prefix of what the model wrote.
    expect(tooLong.startsWith(hooks[0])).toBe(true);
    expect(hooks[0].endsWith(' ')).toBe(false);
    expect(tooLong[hooks[0].length]).toBe(' ');
  });

  it('holds every field to its own declared limit', async () => {
    mockLlmCall.mockResolvedValueOnce(
      llmResponse({
        hookHeadline: Array.from({ length: 3 }, () => 'word '.repeat(40)),
        featureTitle: Array.from({ length: 3 }, () => 'word '.repeat(40)),
        featureCallout: Array.from({ length: 3 }, () => 'word '.repeat(40)),
        ctaHeadline: ['word '.repeat(40)],
      }),
    );
    const service = buildService();

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    // Limits come from the format declaration: 90 / 60 / 80 / 70.
    for (const hook of result.fields.hookHeadline as string[]) {
      expect(hook.length).toBeLessThanOrEqual(90);
    }
    for (const title of result.fields.featureTitle as string[]) {
      expect(title.length).toBeLessThanOrEqual(60);
    }
    for (const callout of result.fields.featureCallout as string[]) {
      expect(callout.length).toBeLessThanOrEqual(80);
    }
    expect((result.fields.ctaHeadline as string).length).toBeLessThanOrEqual(
      70,
    );
  });
});

describe('CopySuggestService records what it spends', () => {
  it('reports a cost and writes it to the daily ledger', async () => {
    mockLlmCall.mockResolvedValueOnce(llmResponse(GOOD_COPY));
    const service = buildService();

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    expect(result.cost_usd).toBeGreaterThan(0);
    expect(costCap.recordSpend).toHaveBeenCalledTimes(1);

    const [recorded] = costCap.recordSpend.mock.calls[0] as [
      Array<{ provider: string; amount_usd: number }>,
    ];
    expect(recorded).toHaveLength(1);
    expect(recorded[0].provider).toBe('anthropic');
    expect(recorded[0].amount_usd).toBeCloseTo(result.cost_usd, 10);
  });

  it('checks the cap before calling the model, not after', async () => {
    mockLlmCall.mockResolvedValueOnce(llmResponse(GOOD_COPY));
    const service = buildService();

    await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    expect(costCap.canEnqueue).toHaveBeenCalledTimes(1);
    expect(costCap.canEnqueue.mock.invocationCallOrder[0]).toBeLessThan(
      mockLlmCall.mock.invocationCallOrder[0],
    );
    const [estimatedUsd] = costCap.canEnqueue.mock.calls[0] as [number];
    expect(estimatedUsd).toBeGreaterThan(0);
  });
});

describe('CopySuggestService degrades softly and never blocks authoring', () => {
  it('returns empty fields with a reason when the model call fails', async () => {
    mockLlmCall.mockRejectedValueOnce(new Error('connection error'));
    const service = buildService();

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    expect(result.degraded).toBe(true);
    expect(result.reason).toBeTruthy();
    expect(result.cost_usd).toBe(0);

    // Shape is preserved so the form still renders the right inputs...
    expect(result.fields.hookHeadline).toEqual(['', '', '']);
    expect(result.fields.featureTitle).toEqual(['', '', '']);
    expect(result.fields.featureCallout).toEqual(['', '', '']);
    expect(result.fields.ctaHeadline).toBe('');

    // ...and nothing was charged for a call that produced nothing.
    expect(costCap.recordSpend).not.toHaveBeenCalled();
  });

  it('invents no placeholder copy when it degrades', async () => {
    mockLlmCall.mockRejectedValueOnce(new Error('timeout'));
    const service = buildService();

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    const everyValue = Object.values(result.fields).flatMap((v) =>
      Array.isArray(v) ? v : [v],
    );
    expect(everyValue.length).toBeGreaterThan(0);
    expect(everyValue.every((v) => v === '')).toBe(true);
  });

  it('degrades without calling the model when the daily cap is spent', async () => {
    const service = buildService();
    costCap.canEnqueue.mockResolvedValue({
      allowed: false,
      remainingUsd: 0,
      usdSpent: 50,
      usdCap: 50,
    });

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    expect(result.degraded).toBe(true);
    expect(result.reason).toMatch(/cap/i);
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  it('degrades when the ledger itself cannot be read', async () => {
    const service = buildService();
    costCap.canEnqueue.mockRejectedValue(new Error('supabase unreachable'));

    const result = await service.suggest({
      formatKey: 'product_demo_vertical',
      itemCount: 3,
      context: {},
    });

    expect(result.degraded).toBe(true);
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  it('rejects a format that declares no copy fields, which is a caller error not an outage', async () => {
    const service = buildService();

    await expect(
      service.suggest({
        formatKey: 'grade_reveal',
        itemCount: 3,
        context: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockLlmCall).not.toHaveBeenCalled();
  });
});

describe('CopySuggestService passes operator context to the model', () => {
  it('includes typed product and feature names in the prompt', async () => {
    mockLlmCall.mockResolvedValueOnce(llmResponse(GOOD_COPY));
    const service = buildService();

    await service.suggest({
      formatKey: 'product_demo_horizontal',
      itemCount: 3,
      context: {
        productName: 'Market Screener',
        featureNames: ['Filter by PropertyIQ Score'],
        marketName: 'Cleveland, OH',
      },
    });

    const [params] = mockLlmCall.mock.calls[0] as [
      { messages: Array<{ content: string }>; tool_choice: { name: string } },
    ];
    const userPrompt = params.messages[0].content;
    expect(userPrompt).toContain('Market Screener');
    expect(userPrompt).toContain('Filter by PropertyIQ Score');
    expect(userPrompt).toContain('Cleveland, OH');
    expect(params.tool_choice.name).toBe('emit_copy');
  });
});
