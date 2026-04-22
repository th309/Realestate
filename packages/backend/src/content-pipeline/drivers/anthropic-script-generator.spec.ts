// packages/backend/src/content-pipeline/drivers/anthropic-script-generator.spec.ts
import { AnthropicScriptGenerator } from './anthropic-script-generator';

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
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
                    {
                      sceneKey: 'score_reveal',
                      text: '78',
                      durationHintSec: 7,
                    },
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
      }),
    },
  })),
);

describe('AnthropicScriptGenerator', () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('returns scripts with correct cost calculation', async () => {
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
    });
    expect(result.scripts).toHaveLength(1);
    expect(result.scripts[0].variantId).toBe('A');
    expect(result.cost.provider).toBe('anthropic');
    expect(result.cost.amount_usd).toBeGreaterThan(0);
  });
});
