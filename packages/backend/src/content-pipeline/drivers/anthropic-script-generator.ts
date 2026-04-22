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
    const promptPath = join(__dirname, '..', 'prompts', `${req.format}.md`);
    const template = readFileSync(promptPath, 'utf8');
    const userPrompt = template
      .replaceAll('{{canonical_name}}', req.resolvedMarket.canonical_name)
      .replaceAll('{{dataBundle}}', JSON.stringify(req.dataBundle, null, 2))
      .replaceAll('{{cta_text}}', req.ctaText)
      .replaceAll('{{shortLinkPlaceholder}}', '{{SHORT_LINK}}')
      .replaceAll('{{variantCount}}', String(req.variantCount));

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
