// packages/backend/src/content-pipeline/gates/claim-extraction.ts
import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback } from '../drivers/anthropic-messages-retry';
import { resolveDefaultScriptLlmModel } from '../drivers/content-pipeline-llm-client';
import type { NumericClaim } from './gate.types';

const EXTRACT_TOOL = {
  name: 'extract_claims',
  description: 'Extract all numeric claims from a video script.',
  input_schema: {
    type: 'object',
    required: ['claims'],
    properties: {
      claims: {
        type: 'array',
        items: {
          type: 'object',
          required: ['quote', 'value', 'category', 'subject'],
          properties: {
            quote: { type: 'string' },
            value: { type: 'number' },
            category: {
              type: 'string',
              enum: [
                'price',
                'percentage',
                'score',
                'ranking',
                'count',
                'date',
                'duration',
              ],
            },
            subject: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

const EXTRACT_PROMPT_RULES =
  'Extract every factual numeric claim from this script. ' +
  'Rules for what is NOT a claim and should be OMITTED:\n' +
  '- Scale denominators (e.g., "out of 100", "out of 5", "on a 1 to 10 scale") are not factual claims about the subject. Only extract the score value, not the scale.\n' +
  '- Generic fractions or colloquial phrases like "one in five", "a third of", "half of" without a specific numeric subject.\n' +
  '- Numbers inside URLs, hashtags, or brand names.\n' +
  '- Vague relative time with no computable anchor from the data (e.g. "years ago" with no period in the bundle) — omit. If the script states a whole-month span that is clearly implied by two dated points in the narrative tied to the market data window, you may extract that integer as category "duration".\n' +
  '- For PropertyIQ score *point* moves, use category "score" (not "count") so values like a 15-point swing can align with deltas in the data.\n' +
  'Only extract numbers that assert a specific measurable fact (a price, percentage, score, ranking, count, duration, or date). If uncertain, omit.\n\n' +
  'Script:\n';

/**
 * Asks the LLM to pull every numeric claim out of a script so the gate can
 * check each one against the data bundle.
 */
export async function extractNumericClaims(
  scriptText: string,
  logger: Logger,
): Promise<NumericClaim[]> {
  // Long-form scripts need a larger output budget: the tool returns a JSON
  // array of claims; truncation yields `{}` or missing `claims` and crashes verify.
  const extractCap = Number(
    process.env.CONTENT_PIPELINE_EXTRACT_CLAIMS_MAX_TOKENS ?? '8192',
  );
  const extractShort = Number(
    process.env.CONTENT_PIPELINE_EXTRACT_CLAIMS_MAX_TOKENS_SHORT ?? '1500',
  );
  const wordCount = scriptText.split(/\s+/).filter(Boolean).length;
  const maxTokens =
    scriptText.length > 4000 || wordCount > 400 ? extractCap : extractShort;

  logger.log(
    `[V2] extractClaims PRE scriptChars=${scriptText.length} words≈${wordCount} max_tokens=${maxTokens}`,
  );

  const extractTimeoutMs = Number(
    process.env.CONTENT_PIPELINE_EXTRACT_CLAIMS_TIMEOUT_MS ?? '60000',
  );

  const { message: response } =
    await anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback(
      {
        model: resolveDefaultScriptLlmModel(),
        max_tokens: maxTokens,
        tools: [EXTRACT_TOOL as unknown as Anthropic.Messages.Tool],
        tool_choice: { type: 'tool', name: 'extract_claims' },
        messages: [
          {
            role: 'user',
            content: EXTRACT_PROMPT_RULES + scriptText,
          },
        ],
      },
      { timeout: extractTimeoutMs },
    );
  const toolBlock = response.content.find((c) => c.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') return [];
  const input = toolBlock.input as { claims?: NumericClaim[] };
  if (!Array.isArray(input.claims)) {
    logger.warn(
      '[V2] extractClaims: tool input missing or invalid `claims` array — treating as no claims',
    );
    return [];
  }
  return input.claims;
}
