// packages/backend/src/content-pipeline/drivers/anthropic-script-generator.ts
import { Injectable, Logger } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ScriptGenerator,
  ScriptGenerationRequest,
  ScriptGenerationResult,
  ScriptVariant,
} from './script-generator.interface';
import {
  generateRankingScript,
  buildPriorFeedbackBlock,
} from './anthropic-ranking-script';
import { anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback } from './anthropic-messages-retry';
import {
  estimateEmitScriptCostUsd,
  resolveDefaultScriptLlmModel,
} from './content-pipeline-llm-client';

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

/** Short scripts (grade_reveal, etc.) fit in ~2k output tokens; long-form is 1k+ words + JSON. */
function maxOutputTokensForRequest(req: ScriptGenerationRequest): number {
  const shortCap = Number(process.env.SCRIPT_LLM_MAX_TOKENS ?? '2000');
  const longCap = Number(process.env.SCRIPT_LLM_MAX_TOKENS_LONGFORM ?? '8192');
  if (req.format === 'long_form_deep_dive') return longCap;
  return shortCap;
}

function summarizeToolUseInput(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object')
    return { typeof: typeof raw, note: 'non-object tool input' };
  const o = raw as Record<string, unknown>;
  const scripts = o.scripts;
  const first =
    Array.isArray(scripts) && scripts.length > 0 ? scripts[0] : undefined;
  const firstObj =
    first && typeof first === 'object'
      ? (first as Record<string, unknown>)
      : undefined;
  return {
    topLevelKeys: Object.keys(o),
    scriptsCount: Array.isArray(scripts) ? scripts.length : null,
    firstVariantKeys:
      firstObj !== undefined ? Object.keys(firstObj).slice(0, 12) : null,
    fullTextChars:
      typeof firstObj?.fullText === 'string'
        ? (firstObj.fullText as string).length
        : null,
    sceneBreakdownLen: Array.isArray(firstObj?.sceneBreakdown)
      ? (firstObj.sceneBreakdown as unknown[]).length
      : null,
  };
}

@Injectable()
export class AnthropicScriptGenerator implements ScriptGenerator {
  private readonly logger = new Logger(AnthropicScriptGenerator.name);
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor() {
    this.model = resolveDefaultScriptLlmModel();
    this.systemPrompt = readFileSync(
      join(__dirname, '..', 'prompts', '_system.md'),
      'utf8',
    );
  }

  async generate(
    req: ScriptGenerationRequest,
  ): Promise<ScriptGenerationResult> {
    if (req.format === 'top_10_ranking' || req.format === 'bottom_10_ranking') {
      return generateRankingScript(req);
    }

    const promptPath = join(__dirname, '..', 'prompts', `${req.format}.md`);
    const template = readFileSync(promptPath, 'utf8');
    const filledTemplate = template
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
      .replaceAll('{{natural_wpm}}', String(req.naturalWpm))
      .replaceAll('{{window_label}}', req.windowLabel ?? 'this quarter');

    // Append script-repair feedback (if any) so the LLM addresses prior
    // gate violations on the next attempt. Empty for first attempts.
    const userPrompt = `${filledTemplate}${buildPriorFeedbackBlock(req.priorFeedback)}`;

    const maxTokens = maxOutputTokensForRequest(req);
    this.logger.log(
      `[PIPE] anthropic-script.generate PRE format=${req.format} model=${this.model} max_tokens=${maxTokens} wordBudget=${req.wordBudget} promptChars=${userPrompt.length} canonical=${req.resolvedMarket.canonical_name}`,
    );

    const {
      message: response,
      backendUsed,
      modelUsed,
    } = await anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback({
      model: this.model,
      max_tokens: maxTokens,
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

    const stopReason =
      'stop_reason' in response ? String(response.stop_reason) : undefined;
    const blockTypes = (response.content ?? [])
      .map((c) => c.type)
      .join(',');
    const u = response.usage;
    this.logger.log(
      `[PIPE] anthropic-script.generate POST stop_reason=${stopReason ?? 'n/a'} blocks=${blockTypes} out_tokens=${u?.output_tokens ?? 'n/a'} in_tokens=${u?.input_tokens ?? 'n/a'}`,
    );

    const toolBlock = (response.content ?? []).find(
      (c) => c.type === 'tool_use',
    );
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      this.logger.error(
        `[PIPE] anthropic-script.generate NO_TOOL_USE stop_reason=${stopReason} blocks=${blockTypes} rawPreview=${JSON.stringify(response.content).slice(0, 500)}`,
      );
      throw new Error('ScriptGenerator did not receive a tool_use block');
    }
    const parsed = toolBlock.input as { scripts?: ScriptVariant[] };

    this.logger.log(
      `[PIPE] anthropic-script.generate TOOL_INPUT ${JSON.stringify(summarizeToolUseInput(parsed))}`,
    );

    if (
      !parsed.scripts ||
      !Array.isArray(parsed.scripts) ||
      parsed.scripts.length === 0
    ) {
      const hint =
        stopReason === 'max_tokens'
          ? ' Model hit max_tokens (likely truncation). Raise SCRIPT_LLM_MAX_TOKENS_LONGFORM.'
          : '';
      this.logger.error(
        `[PIPE] anthropic-script.generate EMPTY_SCRIPTS stop_reason=${stopReason}${hint}`,
      );
      throw new Error(
        `emit_script returned no scripts — response was likely truncated (stop_reason=${stopReason ?? 'unknown'}). For long_form_deep_dive set SCRIPT_LLM_MAX_TOKENS_LONGFORM (default 8192).${hint}`,
      );
    }

    const inputTokens =
      (u?.input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0);
    const outputTokens = u?.output_tokens ?? 0;
    const costUsd = estimateEmitScriptCostUsd(
      backendUsed,
      inputTokens,
      outputTokens,
    );
    const costProvider = backendUsed === 'deepseek' ? 'deepseek' : 'anthropic';

    return {
      scripts: parsed.scripts,
      cost: {
        provider: costProvider,
        amount_usd: costUsd,
        units: inputTokens + outputTokens,
        unit_type: 'tokens_input',
      },
      rawLLMResponse: response,
      diagnostics: {
        provider: backendUsed,
        model: modelUsed,
        maxOutputTokensRequested: maxTokens,
        generationPath: 'emit_script',
        stopReason,
        usage: u
          ? {
              input_tokens: u.input_tokens,
              output_tokens: u.output_tokens,
              cache_read_input_tokens: u.cache_read_input_tokens ?? undefined,
              cache_creation_input_tokens:
                u.cache_creation_input_tokens ?? undefined,
            }
          : undefined,
        contentBlockTypes: (response.content ?? []).map((c) => c.type),
        toolInputSummary: summarizeToolUseInput(parsed),
      },
    };
  }
}
