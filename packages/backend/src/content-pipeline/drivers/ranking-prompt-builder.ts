// packages/backend/src/content-pipeline/drivers/ranking-prompt-builder.ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { ScriptGenerationRequest } from './script-generator.interface';
import { getMetricThesis } from '../ranking/ranking-display-metadata';
import { buildPriorFeedbackBlock } from './ranking-prior-feedback-block';

/**
 * Assemble the full user-turn prompt for a ranking script: the format's
 * markdown template with timing constraints substituted, any prior gate
 * feedback, and the resolved-market JSON input block.
 */
export function buildRankingPrompt(req: ScriptGenerationRequest): string {
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

  return `${promptTemplate}${priorFeedbackBlock}\n\n# Input\n\n\`\`\`json\n${inputBlock}\n\`\`\``;
}
