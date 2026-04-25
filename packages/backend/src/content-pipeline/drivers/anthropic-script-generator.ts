// packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ScriptGenerator,
  ScriptGenerationRequest,
  ScriptGenerationResult,
  ScriptVariant,
} from './script-generator.interface';
import {
  RankingScript,
  RankingScriptSchema,
  validateScriptAgainstMarkets,
} from '../ranking/ranking-script.schema';

const SCRIPT_TOOL_SCHEMA = {
  name: 'emit_script',
  description: 'Emit structured script variants for rendering.',
  input_schema: {
    type: 'object',
    required: ['scripts'],
    properties: {
      scripts: {
        type: 'array',
        minItems: 1,
        maxItems: 2,
        items: {
          type: 'object',
          required: [
            'variantId',
            'hook',
            'body',
            'cta',
            'fullText',
            'sceneBreakdown',
          ],
          properties: {
            variantId: { type: 'string', enum: ['A', 'B'] },
            hook: { type: 'string' },
            body: { type: 'string' },
            cta: { type: 'string' },
            fullText: { type: 'string' },
            sceneBreakdown: {
              type: 'array',
              items: {
                type: 'object',
                required: ['sceneKey', 'text', 'durationHintSec'],
                properties: {
                  sceneKey: { type: 'string' },
                  text: { type: 'string' },
                  durationHintSec: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const RANKING_MAX_RETRIES = 2;

async function generateRankingScript(
  req: ScriptGenerationRequest,
  client: Anthropic,
): Promise<RankingScript> {
  const promptFile =
    req.format === 'top_10_ranking'
      ? 'top_10_ranking.md'
      : 'bottom_10_ranking.md';
  const promptTemplate = readFileSync(
    join(__dirname, '..', 'prompts', promptFile),
    'utf-8',
  );

  const params = req.dataBundle as any;
  const inputBlock = JSON.stringify(
    {
      metric: params.metric,
      scope: params.scope,
      geo_level: params.geo_level,
      direction: params.direction,
      resolved_markets: (params.resolved_markets as any[]).map(
        ({ rank, region_name, state, value, value_formatted }) => ({
          rank,
          region_name,
          state,
          value,
          value_formatted,
        }),
      ),
    },
    null,
    2,
  );

  let lastError = '';
  for (let attempt = 0; attempt <= RANKING_MAX_RETRIES; attempt++) {
    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: `${promptTemplate}\n\n# Input\n\n\`\`\`json\n${inputBlock}\n\`\`\``,
      },
    ];
    if (lastError) {
      messages.push({
        role: 'user',
        content: `Previous attempt failed validation:\n${lastError}\n\nReturn corrected JSON.`,
      });
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      messages,
    });

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
      lastError = `Schema errors: ${JSON.stringify(schemaResult.error.errors)}`;
      continue;
    }

    const contextErrors = validateScriptAgainstMarkets(
      schemaResult.data,
      params.resolved_markets,
    );
    if (contextErrors.length > 0) {
      lastError = `Context errors: ${contextErrors.join('; ')}`;
      continue;
    }

    return schemaResult.data;
  }

  throw new Error(
    `Ranking script generation failed after ${RANKING_MAX_RETRIES + 1} attempts: ${lastError}`,
  );
}

@Injectable()
export class AnthropicScriptGenerator implements ScriptGenerator {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');
    this.client = new Anthropic({ apiKey });
    this.model = process.env.SCRIPT_LLM_MODEL ?? 'claude-sonnet-4-6';
    this.systemPrompt = readFileSync(
      join(__dirname, '..', 'prompts', '_system.md'),
      'utf8',
    );
  }

  async generate(
    req: ScriptGenerationRequest,
  ): Promise<ScriptGenerationResult> {
    if (req.format === 'top_10_ranking' || req.format === 'bottom_10_ranking') {
      return generateRankingScript(
        req,
        this.client,
      ) as unknown as Promise<ScriptGenerationResult>;
    }

    const promptPath = join(__dirname, '..', 'prompts', `${req.format}.md`);
    const template = readFileSync(promptPath, 'utf8');
    const userPrompt = template
      .replaceAll('{{canonical_name}}', req.resolvedMarket.canonical_name)
      .replaceAll('{{dataBundle}}', JSON.stringify(req.dataBundle, null, 2))
      .replaceAll('{{cta_text}}', req.ctaText)
      .replaceAll('{{shortLinkPlaceholder}}', '{{SHORT_LINK}}')
      .replaceAll('{{variantCount}}', String(req.variantCount))
      .replaceAll(
        '{{video_duration_seconds}}',
        String(req.videoDurationSeconds),
      )
      .replaceAll('{{audio_budget_seconds}}', String(req.audioBudgetSeconds))
      .replaceAll('{{word_budget}}', String(req.wordBudget))
      .replaceAll('{{natural_wpm}}', String(req.naturalWpm));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: this.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [SCRIPT_TOOL_SCHEMA as unknown as Anthropic.Messages.Tool],
      tool_choice: { type: 'tool', name: 'emit_script' },
      messages: [{ role: 'user', content: userPrompt }],
    });

    const toolBlock = response.content.find((c) => c.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      throw new Error('ScriptGenerator did not receive a tool_use block');
    }
    const parsed = toolBlock.input as { scripts: ScriptVariant[] };

    const inputTokens =
      response.usage.input_tokens +
      (response.usage.cache_read_input_tokens ?? 0);
    const outputTokens = response.usage.output_tokens;
    const costUsd = (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000;

    return {
      scripts: parsed.scripts,
      cost: {
        provider: 'anthropic',
        amount_usd: costUsd,
        units: inputTokens + outputTokens,
        unit_type: 'tokens_input',
      },
      rawLLMResponse: response,
    };
  }
}
