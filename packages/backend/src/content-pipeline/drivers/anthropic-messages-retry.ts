/**
 * Anthropic `messages.create` sometimes fails with transient network errors
 * ("Connection error.", TLS resets, overloaded 529). Retries with backoff on top of
 * the SDK's built-in {@link Anthropic} `maxRetries`.
 *
 * {@link anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback} wraps this for
 * DeepSeek-first → Anthropic Cloud failover.
 */
import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  createAnthropicCloudClient,
  createDeepSeekAnthropicClient,
  resolveAnthropicFallbackModel,
  type ContentPipelineLlmBackend,
} from './content-pipeline-llm-client';

const logger = new Logger('AnthropicMessagesRetry');

export function isTransientAnthropicFailure(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? `${err.message} ${(err as Error & { cause?: unknown }).cause ?? ''}`
      : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('connection error')) return true;
  if (lower.includes('timeout')) return true;
  if (lower.includes('econnreset')) return true;
  if (lower.includes('etimedout')) return true;
  if (lower.includes('fetch failed')) return true;
  if (lower.includes('socket hang up')) return true;
  if (lower.includes('network error')) return true;

  const any = err as { status?: number; code?: string };
  if (any.status === 429 || any.status === 502 || any.status === 503)
    return true;
  if (any.status === 529) return true;
  if (any.code === 'ECONNRESET' || any.code === 'ETIMEDOUT') return true;

  return false;
}

export { createContentPipelineAnthropicClient } from './content-pipeline-llm-client';

type MessageCreateBody = Parameters<Anthropic['messages']['create']>[0];
type MessageCreateOptions = Parameters<Anthropic['messages']['create']>[1];

/**
 * Non-streaming `messages.create` only (content pipeline uses JSON/tool responses).
 */
export async function anthropicMessagesCreateWithRetry(
  client: Anthropic,
  params: MessageCreateBody,
  requestOptions?: MessageCreateOptions,
): Promise<Anthropic.Messages.Message> {
  if ((params as { stream?: boolean }).stream === true) {
    throw new Error(
      'anthropicMessagesCreateWithRetry requires non-streaming calls',
    );
  }

  const maxAttempts = Math.min(
    8,
    Math.max(1, Number(process.env.ANTHROPIC_MESSAGES_MAX_ATTEMPTS ?? '4')),
  );
  const baseDelayMs = Number(
    process.env.ANTHROPIC_RETRY_BASE_DELAY_MS ?? '1500',
  );

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const msg = await client.messages.create(params, requestOptions);
      return msg as Anthropic.Messages.Message;
    } catch (err) {
      lastErr = err;
      const transient = isTransientAnthropicFailure(err);
      if (!transient || attempt >= maxAttempts) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger.warn(
        `messages.create attempt ${attempt}/${maxAttempts} transient failure — ${(err as Error).message.slice(0, 140)}; retry in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Calls DeepSeek (Anthropic Messages shape) first; if that fails after retries and
 * Anthropic credentials exist, retries once on Anthropic Cloud with
 * {@link resolveAnthropicFallbackModel}.
 */
export async function anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback(
  params: MessageCreateBody,
  requestOptions?: MessageCreateOptions,
): Promise<{
  message: Anthropic.Messages.Message;
  backendUsed: ContentPipelineLlmBackend;
  modelUsed: string;
}> {
  if ((params as { stream?: boolean }).stream === true) {
    throw new Error(
      'anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback requires non-streaming calls',
    );
  }

  const explicitAnthropic =
    process.env.CONTENT_PIPELINE_LLM_PROVIDER?.trim().toLowerCase() ===
    'anthropic';
  const disableAnthropicFallback =
    process.env.CONTENT_PIPELINE_DISABLE_ANTHROPIC_FALLBACK?.trim() ===
      'true' ||
    process.env.CONTENT_PIPELINE_DISABLE_ANTHROPIC_FALLBACK?.trim() === '1';

  const tryAnthropicCloud = (): Promise<Anthropic.Messages.Message> =>
    anthropicMessagesCreateWithRetry(
      createAnthropicCloudClient(),
      params,
      requestOptions,
    );

  if (explicitAnthropic || !process.env.DEEPSEEK_API_KEY?.trim()) {
    const msg = await tryAnthropicCloud();
    return {
      message: msg,
      backendUsed: 'anthropic',
      modelUsed: String(params.model),
    };
  }

  try {
    const msg = await anthropicMessagesCreateWithRetry(
      createDeepSeekAnthropicClient(),
      params,
      requestOptions,
    );
    return {
      message: msg,
      backendUsed: 'deepseek',
      modelUsed: String(params.model),
    };
  } catch (firstErr) {
    if (disableAnthropicFallback || !process.env.ANTHROPIC_API_KEY?.trim()) {
      throw firstErr;
    }
    logger.warn(
      `DeepSeek messages.create failed (${(firstErr as Error).message.slice(0, 160)}…); falling back to Anthropic Cloud`,
    );
    const fbModel = resolveAnthropicFallbackModel();
    const fbParams = { ...params, model: fbModel };
    const msg = await anthropicMessagesCreateWithRetry(
      createAnthropicCloudClient(),
      fbParams,
      requestOptions,
    );
    return {
      message: msg,
      backendUsed: 'anthropic',
      modelUsed: fbModel,
    };
  }
}
