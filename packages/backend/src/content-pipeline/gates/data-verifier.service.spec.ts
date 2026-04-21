// packages/backend/src/content-pipeline/gates/data-verifier.service.spec.ts
import corpus from './__fixtures__/gate-a-corpus.json';
import { DataVerifierService } from './data-verifier.service';

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockImplementation(async ({ messages }: any) => {
        const scriptText: string = messages[0].content.split('\n\n')[1] ?? '';
        const numMatches = Array.from(
          scriptText.matchAll(/\$?([\d,]+(?:\.\d+)?)(?:%|\spercent)?/g),
        );
        return {
          content: [
            {
              type: 'tool_use',
              name: 'extract_claims',
              input: {
                claims: numMatches.map((m) => {
                  const quote = m[0];
                  let value = parseFloat(m[1].replace(/,/g, ''));
                  const following = scriptText.slice(
                    m.index + quote.length,
                    m.index + quote.length + 20,
                  );
                  const preceding20 = scriptText.slice(
                    Math.max(0, m.index - 20),
                    m.index,
                  );
                  // Multiplier suffixes: "$1 million", "2 thousand"
                  let hasMillion = false;
                  if (/^\s*million\b/i.test(following)) {
                    value *= 1_000_000;
                    hasMillion = true;
                  } else if (/^\s*billion\b/i.test(following)) {
                    value *= 1_000_000_000;
                    hasMillion = true;
                  } else if (/^\s*thousand\b/i.test(following)) {
                    value *= 1_000;
                  }

                  let category: string;
                  if (
                    quote.includes('%') ||
                    /percent/i.test(scriptText.slice(m.index, m.index + 30))
                  )
                    category = 'percentage';
                  else if (quote.startsWith('$') || hasMillion)
                    category = 'price';
                  else if (
                    /number\s+\d+|rank\s+\d+|#\d+|\brank\s+\d+/i.test(
                      preceding20 + quote,
                    )
                  )
                    category = 'ranking';
                  else if (
                    /score/i.test(preceding20) &&
                    !/\b(fell|rose|up|down|grew|dropped)\b/i.test(preceding20)
                  )
                    category = 'score';
                  else if (/202\d/.test(quote) || /20\d{2}/.test(quote))
                    category = 'date';
                  else category = 'count';

                  // Subject extraction: leading capitalized word for ranking
                  // claims, so the verifier can detect hallucinated rankings.
                  let subject = 'unknown';
                  if (category === 'ranking') {
                    const subj = scriptText.match(/^([A-Z][a-zA-Z]+)/);
                    if (subj) subject = subj[1];
                  }
                  return { quote, value, category, subject };
                }),
              },
            },
          ],
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      }),
    },
  })),
);

describe('DataVerifierService against 20-case corpus', () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = 'test';
  });

  for (const c of corpus.cases) {
    it(c.name, async () => {
      const svc = new DataVerifierService();
      const result = await svc.verify(c.script, c.payload);
      expect(result.passed).toBe(c.expectPass);
    });
  }
});
