// packages/backend/src/content-pipeline/gates/brand-voice-linter.service.spec.ts
import corpus from './__fixtures__/gate-b-corpus.json';
import { BrandVoiceLinterService } from './brand-voice-linter.service';

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            name: 'judge_brand_voice',
            input: { score: 5, violations: [] },
          },
        ],
        usage: { input_tokens: 100, output_tokens: 20 },
      }),
    },
  })),
);

describe('BrandVoiceLinterService deterministic pass', () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test';
  });
  const svc = new BrandVoiceLinterService();

  for (const c of corpus.deterministic_fails) {
    it(`fails on ${c.name}`, async () => {
      expect((await svc.lint(c.script)).passed).toBe(false);
    });
  }
  for (const c of corpus.deterministic_passes) {
    it(`passes on ${c.name}`, async () => {
      expect((await svc.lint(c.script)).passed).toBe(true);
    });
  }
});
