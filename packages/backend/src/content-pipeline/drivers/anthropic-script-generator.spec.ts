// packages/backend/src/content-pipeline/drivers/anthropic-script-generator.spec.ts
import { AnthropicScriptGenerator } from './anthropic-script-generator';

// Shared mock so all instances use the same `create` spy
const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
);

const GRADE_REVEAL_RESPONSE = {
  content: [
    {
      type: 'tool_use',
      name: 'emit_script',
      input: {
        scripts: [
          {
            variantId: 'A',
            hook: "Cleveland's PropertyIQ Score just hit 78.",
            body: 'That is up 4 points YoY, with homes selling 8 percent above list.',
            cta: 'Get your free Market Snapshot at {{SHORT_LINK}}',
            fullText:
              "Cleveland's PropertyIQ Score just hit 78. That is up 4 points YoY. Get your free Market Snapshot at {{SHORT_LINK}}",
            sceneBreakdown: [
              {
                sceneKey: 'intro',
                text: 'Cleveland PropertyIQ Score',
                durationHintSec: 2,
              },
              { sceneKey: 'score_reveal', text: '78', durationHintSec: 7 },
              { sceneKey: 'stats', text: 'Up 4 YoY', durationHintSec: 8 },
              {
                sceneKey: 'cta',
                text: 'Get your Market Snapshot',
                durationHintSec: 3,
              },
            ],
          },
        ],
      },
    },
  ],
  usage: {
    input_tokens: 1200,
    output_tokens: 280,
    cache_read_input_tokens: 900,
  },
};

const RANKING_MARKETS = Array.from({ length: 5 }, (_, i) => ({
  rank: i + 1,
  region_id: `${10000 + i}`,
  region_name: `Metro ${i + 1}`,
  state: 'NY',
  value: 90 - i,
  value_formatted: `${90 - i}`,
}));

const RANKING_REQUEST = {
  format: 'top_10_ranking' as const,
  audience: 'mixed' as const,
  resolvedMarket: {
    geography: 'metro' as const,
    id: 'national',
    canonical_name: 'United States',
  },
  dataBundle: {
    direction: 'top',
    metric: { id: 'piq_score', label: 'PIQ Score', unit: '', format: 'index' },
    scope: { type: 'national', id: null, label: 'United States' },
    geo_level: 'metro',
    resolved_markets: RANKING_MARKETS,
  },
  variantCount: 1 as const,
  ctaText: '',
  videoDurationSeconds: 60,
  audioBudgetSeconds: 55,
  wordBudget: 130,
  naturalWpm: 140,
};

function buildValidRankingResponse() {
  return {
    usage: { input_tokens: 100, output_tokens: 50 },
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          hooks: [
            {
              id: 'data-led',
              intro_vo: 'Five metros nationally by PIQ Score.',
              subhead_text: 'Top to bottom',
            },
            {
              id: 'surprise-led',
              intro_vo: 'Two of these will surprise you.',
              subhead_text: 'Watch closely',
            },
          ],
          rows: RANKING_MARKETS.map((m, i) => ({
            rank: m.rank,
            vo: `Number ${['one', 'two', 'three', 'four', 'five'][i]}. ${m.region_name}, NY. ${m.value}.`,
            emphasis: 'name',
          })),
          outro_vo: 'PropertyIQ. Now you know.',
          outro_cta: 'Learn more at propertyiq.app.',
        }),
      },
    ],
  };
}

beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

beforeEach(() => {
  mockCreate.mockReset();
});

describe('AnthropicScriptGenerator — grade_reveal', () => {
  it('returns scripts with correct cost calculation', async () => {
    mockCreate.mockResolvedValueOnce(GRADE_REVEAL_RESPONSE);
    const gen = new AnthropicScriptGenerator();
    const result = await gen.generate({
      format: 'grade_reveal',
      audience: 'mixed',
      resolvedMarket: {
        geography: 'metro',
        id: '17140',
        canonical_name: 'Cleveland, OH',
      },
      dataBundle: { score: 78 },
      variantCount: 1,
      ctaText: 'Get your free Market Snapshot at ',
      videoDurationSeconds: 30,
      audioBudgetSeconds: 28,
      wordBudget: 65,
      naturalWpm: 140,
    });
    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0].variantId).toBe('A');
    expect(result.cost.provider).toBe('anthropic');
    expect(result.cost.amount_usd).toBeGreaterThan(0);
  });
});

describe('AnthropicScriptGenerator — ranking', () => {
  it('returns flattened envelope + structured ranking on first valid attempt', async () => {
    mockCreate.mockResolvedValueOnce(buildValidRankingResponse());
    const gen = new AnthropicScriptGenerator();
    const result = await gen.generate(RANKING_REQUEST as any);

    // Generic envelope (consumed by verify-data, lint-voice, synthesize-audio)
    expect(result.scripts).toHaveLength(1);
    const variant = result.scripts[0];
    expect(variant.variantId).toBe('A');
    expect(variant.hook).toContain('PIQ Score'); // from data-led intro_vo
    expect(variant.cta).toBe('Learn more at propertyiq.app.');
    expect(variant.fullText).toContain('PIQ Score');
    expect(variant.fullText).toContain('Learn more at propertyiq.app.');
    // hook + 5 rows + outro = 7 scenes
    expect(variant.sceneBreakdown.length).toBe(7);

    // Structured ranking preserved for ranking-aware handlers
    expect(result.ranking).toBeDefined();
    expect(result.ranking?.rows).toHaveLength(5);
    expect(result.ranking?.hooks).toHaveLength(2);

    // Cost computed from response.usage
    expect(result.cost.amount_usd).toBeGreaterThan(0);
    expect(result.cost.units).toBe(150);

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('throws after 3 failed attempts (1 + 2 retries)', async () => {
    const badResponse = {
      content: [{ type: 'text', text: JSON.stringify({ rows: [] }) }],
    };
    mockCreate.mockResolvedValue(badResponse);
    const gen = new AnthropicScriptGenerator();
    await expect(gen.generate(RANKING_REQUEST as any)).rejects.toThrow(
      /failed after/,
    );
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});
