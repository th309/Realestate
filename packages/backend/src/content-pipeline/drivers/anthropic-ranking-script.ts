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
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ScriptGateFeedback,
  ScriptGenerationRequest,
  ScriptGenerationResult,
  ScriptVariant,
} from './script-generator.interface';
import {
  RankingScript,
  RankingScriptSchema,
  validateScriptAgainstMarkets,
} from '../ranking/ranking-script.schema';
import { getMetricThesis } from '../ranking/ranking-display-metadata';
import { anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback } from './anthropic-messages-retry';
import {
  estimateRankingJsonCostUsd,
  resolveRankingScriptLlmModel,
} from './content-pipeline-llm-client';

const RANKING_MAX_RETRIES = 2;
const RANKING_MAX_TOKENS = 4096;

const rankingLogger = new Logger('AnthropicRankingScript');

/**
 * Build a "Previous attempt feedback" block from gate violations recorded by
 * earlier script-repair attempts. Returns empty string when there's no prior
 * feedback so the prompt stays clean for first attempts.
 */
export function buildPriorFeedbackBlock(
  feedback: ScriptGateFeedback[] | undefined,
): string {
  if (!feedback || feedback.length === 0) return '';
  const lines: string[] = [];
  for (const entry of feedback) {
    lines.push(`\n## Attempt — ${entry.gate}`);
    for (const v of entry.violations) {
      const quote = v.quote ? `"${v.quote}"` : '(no quote)';
      lines.push(`- ${quote} — ${v.issue}`);
    }
  }
  return [
    '',
    '# Previous attempt feedback',
    '',
    'Earlier scripts failed the listed gate(s) on the violations below. Address each one. Do not introduce new violations of the same kind.',
    ...lines,
    '',
  ].join('\n');
}

/**
 * Flatten a RankingScript into a generic ScriptVariant envelope.
 * Variants A/B map to the two hook openers; body, outro, cta are shared.
 */
export function rankingToVariant(
  script: RankingScript,
  variantId: 'A' | 'B',
): ScriptVariant {
  const hookIndex = variantId === 'A' ? 0 : 1;
  const hook = script.hooks[hookIndex] ?? script.hooks[0];

  const body = script.rows.map((r) => r.vo).join(' ');
  const fullText = [
    hook.intro_vo,
    body,
    script.outro_vo,
    script.outro_cta,
  ].join(' ');

  // Words→seconds at ~140 wpm narration pace, 0.5s granularity.
  const wordsToSec = (text: string): number =>
    Math.max(
      1,
      Math.round((text.split(/\s+/).filter(Boolean).length / 2.33) * 2) / 2,
    );

  const sceneBreakdown = [
    {
      sceneKey: 'hook',
      text: hook.intro_vo,
      durationHintSec: wordsToSec(hook.intro_vo),
    },
    ...script.rows.map((r) => ({
      sceneKey: `rank-${r.rank}`,
      text: r.vo,
      durationHintSec: wordsToSec(r.vo),
    })),
    {
      sceneKey: 'outro',
      text: `${script.outro_vo} ${script.outro_cta}`,
      durationHintSec:
        wordsToSec(script.outro_vo) + wordsToSec(script.outro_cta),
    },
  ];

  return {
    variantId,
    hook: hook.intro_vo,
    body,
    cta: script.outro_cta,
    fullText,
    sceneBreakdown,
  };
}

export async function generateRankingScript(
  req: ScriptGenerationRequest,
): Promise<ScriptGenerationResult> {
  const rankingModel = resolveRankingScriptLlmModel();
  rankingLogger.log(
    `[PIPE] ranking.generate START format=${req.format} model=${rankingModel} wordBudget=${req.wordBudget} canonical=${req.resolvedMarket.canonical_name}`,
  );
  const promptFile =
    req.format === 'top_10_ranking'
      ? 'top_10_ranking.md'
      : 'bottom_10_ranking.md';
  const rawTemplate = readFileSync(
    join(__dirname, '..', 'prompts', promptFile),
    'utf-8',
  );
  // Substitute the timing-constraint placeholders the same way the single-
  // market path does. Without this, the ranking prompt has no concrete word
  // budget and consistently overflows the audio-duration gate on the first
  // attempt — forcing the script-repair loop to do work the prompt should
  // have prevented.
  const promptTemplate = rawTemplate
    .replaceAll('{{audio_budget_seconds}}', String(req.audioBudgetSeconds))
    .replaceAll('{{word_budget}}', String(req.wordBudget))
    .replaceAll('{{natural_wpm}}', String(req.naturalWpm));

  const params = req.dataBundle as Record<string, unknown>;
  const metric = params.metric as { id: string };
  const metricThesis = getMetricThesis(metric.id);
  const inputBlock = JSON.stringify(
    {
      metric: params.metric,
      metric_thesis: metricThesis,
      scope: params.scope,
      geo_level: params.geo_level,
      direction: params.direction,
      resolved_markets: (
        params.resolved_markets as Array<Record<string, unknown>>
      ).map(({ rank, region_name, state, value, value_formatted }) => ({
        rank,
        region_name,
        state,
        value,
        value_formatted,
      })),
    },
    null,
    2,
  );

  const priorFeedbackBlock = buildPriorFeedbackBlock(req.priorFeedback);

  let lastError = '';
  let lastResponse: Anthropic.Messages.Message | null = null;
  for (let attempt = 0; attempt <= RANKING_MAX_RETRIES; attempt++) {
    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: `${promptTemplate}${priorFeedbackBlock}\n\n# Input\n\n\`\`\`json\n${inputBlock}\n\`\`\``,
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
