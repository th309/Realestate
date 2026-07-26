/**
 * Ranking Script Generation
 *
 * Calls Anthropic with the ranking-specific prompt + retry-on-validation loop,
 * then flattens the structured RankingScript into the generic ScriptVariant
 * envelope so text-only downstream handlers (verify-data, lint-voice,
 * synthesize-audio) can consume `metadata.scripts[0].fullText` without
 * branching on format. The structured RankingScript is preserved alongside
 * via ScriptGenerationResult.ranking for ranking-aware handlers
 * (render-video, publishers).
 */

import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  ScriptGenerationRequest,
  ScriptGenerationResult,
} from './script-generator.interface';
import {
  RankingScriptSchema,
  validateScriptAgainstMarkets,
} from '../ranking/ranking-script.schema';
import { anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback } from './anthropic-messages-retry';
import {
  estimateRankingJsonCostUsd,
  resolveRankingScriptLlmModel,
} from './content-pipeline-llm-client';
import { buildRankingPrompt } from './ranking-prompt-builder';
import { rankingToVariant } from './ranking-script-to-variant';

const RANKING_MAX_RETRIES = 2;
const RANKING_MAX_TOKENS = 4096;

const rankingLogger = new Logger('AnthropicRankingScript');

export async function generateRankingScript(
  req: ScriptGenerationRequest,
): Promise<ScriptGenerationResult> {
  const rankingModel = resolveRankingScriptLlmModel();
  rankingLogger.log(
    `[PIPE] ranking.generate START format=${req.format} model=${rankingModel} wordBudget=${req.wordBudget} canonical=${req.resolvedMarket.canonical_name}`,
  );
  const prompt = buildRankingPrompt(req);
  const params = req.dataBundle as Record<string, unknown>;

  let lastError = '';
  let lastResponse: Anthropic.Messages.Message | null = null;
  for (let attempt = 0; attempt <= RANKING_MAX_RETRIES; attempt++) {
    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: prompt,
      },
    ];
    if (lastError) {
      messages.push({
        role: 'user',
        content: `Previous attempt failed validation:\n${lastError}\n\nReturn corrected JSON.`,
      });
    }

    const userChars = messages.reduce(
      (n, m) =>
        n +
        (typeof m.content === 'string'
          ? m.content.length
          : JSON.stringify(m.content).length),
      0,
    );
    rankingLogger.log(
      `[PIPE] ranking.generate PRE_ATTEMPT attempt=${attempt + 1}/${RANKING_MAX_RETRIES + 1} model=${rankingModel} max_tokens=${RANKING_MAX_TOKENS} userChars=${userChars}`,
    );

    const {
      message: response,
      backendUsed,
      modelUsed,
    } = await anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback({
      model: rankingModel,
      max_tokens: RANKING_MAX_TOKENS,
      messages,
    });
    lastResponse = response;

    const stopReason =
      'stop_reason' in response ? String(response.stop_reason) : undefined;
    const blockTypes = response.content.map((c) => c.type).join(',');
    const usage = response.usage;
    rankingLogger.log(
      `[PIPE] ranking.generate POST_ATTEMPT attempt=${attempt + 1} stop_reason=${stopReason ?? 'n/a'} blocks=${blockTypes} out_tokens=${usage?.output_tokens ?? 'n/a'} in_tokens=${usage?.input_tokens ?? 'n/a'}`,
    );

    if (!response.content?.length) {
      lastError = 'Response content array was empty';
      rankingLogger.warn(
        `[PIPE] ranking.generate EMPTY_CONTENT attempt=${attempt + 1}`,
      );
      continue;
    }

    const textBlock = response.content[0];
    if (!textBlock || textBlock.type !== 'text') {
      lastError = `Response did not contain a text block (got ${blockTypes})`;
      rankingLogger.warn(
        `[PIPE] ranking.generate NO_TEXT_BLOCK attempt=${attempt + 1} blocks=${blockTypes}`,
      );
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (e) {
      lastError = `Could not parse JSON: ${(e as Error).message}`;
      rankingLogger.warn(
        `[PIPE] ranking.generate JSON_PARSE_FAIL attempt=${attempt + 1} ${lastError}`,
      );
      continue;
    }

    const schemaResult = RankingScriptSchema.safeParse(parsed);
    if (!schemaResult.success) {
      lastError = `Schema errors: ${JSON.stringify(schemaResult.error.issues)}`;
      rankingLogger.warn(
        `[PIPE] ranking.generate SCHEMA_FAIL attempt=${attempt + 1} issues=${schemaResult.error.issues.length}`,
      );
      continue;
    }

    const contextErrors = validateScriptAgainstMarkets(
      schemaResult.data,
      params.resolved_markets as Array<{
        rank: number;
        region_name: string;
        state: string;
      }>,
    );
    if (contextErrors.length > 0) {
      lastError = `Context errors: ${contextErrors.join('; ')}`;
      rankingLogger.warn(
        `[PIPE] ranking.generate CONTEXT_FAIL attempt=${attempt + 1} ${lastError}`,
      );
      continue;
    }

    // Build the generic-shape envelope so text-only handlers don't branch.
    const variant = rankingToVariant(schemaResult.data, 'A');

    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const costUsd = estimateRankingJsonCostUsd(
      backendUsed,
      inputTokens,
      outputTokens,
    );
    const costProvider = backendUsed === 'deepseek' ? 'deepseek' : 'anthropic';

    rankingLogger.log(
      `[PIPE] ranking.generate SUCCESS attempt=${attempt + 1} hooks=${schemaResult.data.hooks?.length ?? 0} rows=${schemaResult.data.rows?.length ?? 0}`,
    );

    return {
      scripts: [variant],
      cost: {
        provider: costProvider,
        amount_usd: costUsd,
        units: inputTokens + outputTokens,
        unit_type: 'tokens_input',
      },
      rawLLMResponse: lastResponse,
      ranking: schemaResult.data,
      diagnostics: {
        provider: backendUsed,
        model: modelUsed,
        maxOutputTokensRequested: RANKING_MAX_TOKENS,
        generationPath: 'ranking_json',
        successfulAttempt: attempt + 1,
        maxRankingRetries: RANKING_MAX_RETRIES,
        stopReason:
          lastResponse && 'stop_reason' in lastResponse
            ? String(lastResponse.stop_reason)
            : undefined,
        usage: usage
          ? {
              input_tokens: usage.input_tokens,
              output_tokens: usage.output_tokens,
              cache_read_input_tokens:
                usage.cache_read_input_tokens ?? undefined,
              cache_creation_input_tokens:
                usage.cache_creation_input_tokens ?? undefined,
            }
          : undefined,
        contentBlockTypes: response.content.map((c) => c.type),
      },
    };
  }

  rankingLogger.error(
    `[PIPE] ranking.generate EXHAUSTED_RETRIES lastError=${lastError}`,
  );
  throw new Error(
    `Ranking script generation failed after ${RANKING_MAX_RETRIES + 1} attempts: ${lastError}`,
  );
}
