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

const RANKING_MAX_RETRIES = 2;
const RANKING_MODEL = 'claude-opus-4-7';

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
  client: Anthropic,
): Promise<ScriptGenerationResult> {
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

    const response = await client.messages.create({
      model: RANKING_MODEL,
      max_tokens: 4096,
      messages,
    });
    lastResponse = response;

    const textBlock = response.content[0];
    if (!textBlock || textBlock.type !== 'text') {
      lastError = 'Response did not contain a text block';
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (e) {
      lastError = `Could not parse JSON: ${(e as Error).message}`;
      continue;
    }

    const schemaResult = RankingScriptSchema.safeParse(parsed);
    if (!schemaResult.success) {
      lastError = `Schema errors: ${JSON.stringify(schemaResult.error.issues)}`;
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
      continue;
    }

    // Build the generic-shape envelope so text-only handlers don't branch.
    const variant = rankingToVariant(schemaResult.data, 'A');

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = (inputTokens * 15.0 + outputTokens * 75.0) / 1_000_000;

    return {
      scripts: [variant],
      cost: {
        provider: 'anthropic',
        amount_usd: costUsd,
        units: inputTokens + outputTokens,
        unit_type: 'tokens_input',
      },
      rawLLMResponse: lastResponse,
      ranking: schemaResult.data,
    };
  }

  throw new Error(
    `Ranking script generation failed after ${RANKING_MAX_RETRIES + 1} attempts: ${lastError}`,
  );
}
