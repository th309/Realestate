import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type Anthropic from '@anthropic-ai/sdk';
import { CostCapService } from '../auto-ideation/cost-cap.service';
import { recordDriverSpend } from '../orchestrator/job-handlers/record-driver-spend';
import { anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback } from '../drivers/anthropic-messages-retry';
import {
  estimateEmitScriptCostUsd,
  resolveContentPipelineLlmBackend,
  resolveDefaultScriptLlmModel,
} from '../drivers/content-pipeline-llm-client';
import {
  COPY_SUGGEST_FORMAT_KEYS,
  fieldIsMultiValued,
  getCopyFieldsForFormat,
  valueCountForField,
  type CopyFieldDeclaration,
} from './copy-field-declarations';
import { prepareFieldValue } from './copy-field-truncation';
import {
  COPY_SUGGEST_SYSTEM_PROMPT,
  buildCopySuggestToolSchema,
  buildCopySuggestUserPrompt,
  type CopySuggestContext,
} from './copy-suggest.prompt';

export interface CopySuggestResult {
  fields: Record<string, string | string[]>;
  cost_usd: number;
  /** True when no copy was generated; every field comes back empty. */
  degraded?: boolean;
  /** Operator-readable explanation, present only when degraded. */
  reason?: string;
}

/** Cheap call, but a runaway loop should still hit a ceiling. */
const MAX_OUTPUT_TOKENS = 1200;
/** Rough token estimate for the pre-flight cap check; ~4 chars per token. */
const CHARS_PER_TOKEN = 4;
/** No run exists yet at wizard time; recordDriverSpend logs this on failure. */
const PRE_RUN_LABEL = 'pre-run-wizard';

/**
 * Drafts the on-screen copy an operator lands on in the wizard's copy step.
 *
 * The point is that the form is never empty. An operator staring at four
 * blank boxes writes worse copy, more slowly, than one editing a draft — so
 * this runs before they type anything and everything it produces is
 * overwritable.
 *
 * That framing decides how failure works. Copy generation is an accelerator,
 * never a gate: if the model errors, times out, or the daily cost cap is
 * already spent, this returns 200 with empty fields and says why. It
 * deliberately does NOT fall back to canned copy, because a plausible-looking
 * default is the one failure mode an operator might ship without reading.
 */
@Injectable()
export class CopySuggestService {
  private readonly logger = new Logger(CopySuggestService.name);

  constructor(private readonly costCap: CostCapService) {}

  async suggest(params: {
    formatKey: string;
    itemCount: number;
    context: CopySuggestContext;
  }): Promise<CopySuggestResult> {
    const { formatKey, itemCount, context } = params;

    const fields = getCopyFieldsForFormat(formatKey);
    if (!fields || fields.length === 0) {
      // A contract error, not a generation failure: the caller asked for copy
      // for a format that declares none. Failing loudly is right here.
      throw new BadRequestException(
        `format "${formatKey}" declares no copy fields — formats with a copy step are: ${COPY_SUGGEST_FORMAT_KEYS.join(', ')}`,
      );
    }

    const systemPrompt = COPY_SUGGEST_SYSTEM_PROMPT;
    const userPrompt = buildCopySuggestUserPrompt({
      formatKey,
      fields,
      itemCount,
      context,
    });

    const capCheck = await this.checkDailyCap(systemPrompt, userPrompt);
    if (capCheck) return this.degraded(fields, itemCount, capCheck);

    try {
      const { parsed, costUsd, provider } = await this.callModel(
        formatKey,
        fields,
        itemCount,
        systemPrompt,
        userPrompt,
      );

      await recordDriverSpend(
        this.costCap,
        this.logger,
        'copy-suggest',
        PRE_RUN_LABEL,
        {
          provider,
          amount_usd: costUsd,
          units: 1,
          unit_type: 'requests',
        },
      );

      return {
        fields: this.enforceLimits(parsed, fields, itemCount, formatKey),
        cost_usd: costUsd,
      };
    } catch (err) {
      const message = (err as Error).message ?? 'unknown error';
      this.logger.error(
        `[COPY] copy-suggest FAILED format=${formatKey} items=${itemCount}: ${message}`,
      );
      return this.degraded(
        fields,
        itemCount,
        'Copy suggestions are unavailable right now. Write the fields yourself, or try again.',
      );
    }
  }

  /**
   * Pre-flight the daily USD cap the way every other paid step does. Returns
   * an operator-readable reason when blocked, or null to proceed.
   */
  private async checkDailyCap(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string | null> {
    const estimatedInputTokens = Math.ceil(
      (systemPrompt.length + userPrompt.length) / CHARS_PER_TOKEN,
    );
    const estimatedUsd = estimateEmitScriptCostUsd(
      resolveContentPipelineLlmBackend(),
      estimatedInputTokens,
      MAX_OUTPUT_TOKENS,
    );

    try {
      const { allowed, remainingUsd, usdCap } =
        await this.costCap.canEnqueue(estimatedUsd);
      if (allowed) return null;
      this.logger.warn(
        `[COPY] copy-suggest BLOCKED by daily cap est=$${estimatedUsd.toFixed(4)} remaining=$${remainingUsd.toFixed(4)} cap=$${usdCap.toFixed(2)}`,
      );
      return `Daily content spend cap reached. Copy suggestions are paused until tomorrow.`;
    } catch (err) {
      // The ledger being unreadable must not block authoring either.
      this.logger.error(
        `[COPY] copy-suggest cap check failed: ${(err as Error).message}`,
      );
      return 'Could not verify the content spend cap. Copy suggestions are paused.';
    }
  }

  private async callModel(
    formatKey: string,
    fields: CopyFieldDeclaration[],
    itemCount: number,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{
    parsed: Record<string, unknown>;
    costUsd: number;
    provider: string;
  }> {
    const model = resolveDefaultScriptLlmModel();
    const tool = buildCopySuggestToolSchema(fields, itemCount);

    this.logger.log(
      `[COPY] copy-suggest PRE format=${formatKey} model=${model} items=${itemCount} fields=${fields.length}`,
    );

    const { message, backendUsed, modelUsed } =
      await anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [tool as unknown as Anthropic.Messages.Tool],
        tool_choice: { type: 'tool', name: 'emit_copy' },
        messages: [{ role: 'user', content: userPrompt }],
      });

    const toolBlock = (message.content ?? []).find(
      (c) => c.type === 'tool_use',
    );
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      const blocks = (message.content ?? []).map((c) => c.type).join(',');
      throw new Error(
        `emit_copy returned no tool_use block (blocks=${blocks || 'none'})`,
      );
    }

    const usage = message.usage;
    const inputTokens =
      (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0);
    const outputTokens = usage?.output_tokens ?? 0;

    this.logger.log(
      `[COPY] copy-suggest POST backend=${backendUsed} model=${modelUsed} in_tokens=${inputTokens} out_tokens=${outputTokens}`,
    );

    return {
      parsed: (toolBlock.input ?? {}) as Record<string, unknown>,
      costUsd: estimateEmitScriptCostUsd(
        backendUsed,
        inputTokens,
        outputTokens,
      ),
      provider: backendUsed === 'deepseek' ? 'deepseek' : 'anthropic',
    };
  }

  /**
   * Sanitize, fit to maxLength, and reshape to the response contract:
   * arrays for fields declaring variants or repeating, plain strings
   * otherwise. Missing values become empty strings rather than gaps, so the
   * form always renders the right number of inputs.
   */
  private enforceLimits(
    parsed: Record<string, unknown>,
    fields: CopyFieldDeclaration[],
    itemCount: number,
    formatKey: string,
  ): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {};

    for (const field of fields) {
      const count = valueCountForField(field, itemCount);
      const raw = parsed[field.fieldId];
      const rawValues = Array.isArray(raw) ? raw : [raw];

      const values: string[] = [];
      for (let i = 0; i < count; i++) {
        const outcome = prepareFieldValue(rawValues[i], field.maxLength);
        if (outcome.truncated) {
          this.logger.warn(
            `[COPY] truncated format=${formatKey} field=${field.fieldId}[${i}] ${outcome.originalLength}->${outcome.value.length} chars (max=${field.maxLength})`,
          );
        }
        values.push(outcome.value);
      }

      out[field.fieldId] = fieldIsMultiValued(field)
        ? values
        : (values[0] ?? '');
    }

    return out;
  }

  /** Empty every field, keeping the shape the form expects. */
  private degraded(
    fields: CopyFieldDeclaration[],
    itemCount: number,
    reason: string,
  ): CopySuggestResult {
    const out: Record<string, string | string[]> = {};
    for (const field of fields) {
      out[field.fieldId] = fieldIsMultiValued(field)
        ? Array.from({ length: valueCountForField(field, itemCount) }, () => '')
        : '';
    }
    return { fields: out, cost_usd: 0, degraded: true, reason };
  }
}
