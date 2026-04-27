/**
 * Content pipeline LLM:
 * - **Try DeepSeek V4 first** when `DEEPSEEK_API_KEY` is set (unless `CONTENT_PIPELINE_LLM_PROVIDER=anthropic`).
 * - **Fall back to Anthropic Cloud** on failure when `ANTHROPIC_API_KEY` is set (same tools; model → `CONTENT_PIPELINE_ANTHROPIC_FALLBACK_MODEL` or `claude-sonnet-4-6`).
 * - Disable fallback: `CONTENT_PIPELINE_DISABLE_ANTHROPIC_FALLBACK=true`.
 *
 * Anthropic-only: set `CONTENT_PIPELINE_LLM_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`.
 */
import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

const logger = new Logger('ContentPipelineLlm');

export const DEEPSEEK_ANTHROPIC_BASE_URL_DEFAULT =
  'https://api.deepseek.com/anthropic';

/** Default when DeepSeek is the active backend and SCRIPT_LLM_MODEL is unset. */
export const DEFAULT_DEEPSEEK_SCRIPT_MODEL = 'deepseek-v4-flash';

/** DeepSeek models that reject forced tool_use / tool_choice on the Anthropic-compatible API. */
const DEEPSEEK_MODELS_WITHOUT_ANTHROPIC_TOOLS = new Set([
  'deepseek-reasoner',
]);

export type ContentPipelineLlmBackend = 'deepseek' | 'anthropic';

let bootLogged = false;

/**
 * DeepSeek first whenever `DEEPSEEK_API_KEY` is set. Else Anthropic if only that key exists.
 * Else nominal `deepseek` so deploys without keys get one clear error (add DEEPSEEK_API_KEY).
 */
export function resolveContentPipelineLlmBackend(): ContentPipelineLlmBackend {
  const explicit = process.env.CONTENT_PIPELINE_LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === 'anthropic') return 'anthropic';
  if (explicit === 'deepseek') return 'deepseek';

  if (process.env.DEEPSEEK_API_KEY?.trim()) return 'deepseek';
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  return 'deepseek';
}

function rawScriptModelFromEnv(): string {
  const override = process.env.SCRIPT_LLM_MODEL?.trim();
  if (override) return override;
  return resolveContentPipelineLlmBackend() === 'deepseek'
    ? DEFAULT_DEEPSEEK_SCRIPT_MODEL
    : 'claude-sonnet-4-6';
}

/**
 * Content pipeline always uses Anthropic-style tool_choice. Map incompatible DeepSeek models.
 */
export function coerceDeepSeekModelForAnthropicTools(requestedModel: string): string {
  if (resolveContentPipelineLlmBackend() !== 'deepseek') {
    return requestedModel;
  }
  const key = requestedModel.trim().toLowerCase();
  if (!DEEPSEEK_MODELS_WITHOUT_ANTHROPIC_TOOLS.has(key)) {
    return requestedModel;
  }
  const fallback =
    process.env.CONTENT_PIPELINE_DEEPSEEK_TOOL_MODEL_FALLBACK?.trim() ||
    DEFAULT_DEEPSEEK_SCRIPT_MODEL;
  logger.warn(
    `DeepSeek model "${requestedModel}" does not support tool_choice on this API — using "${fallback}" for scripted tools`,
  );
  return fallback;
}

export function resolveDefaultScriptLlmModel(): string {
  return coerceDeepSeekModelForAnthropicTools(rawScriptModelFromEnv());
}

export function resolveRankingScriptLlmModel(): string {
  const raw =
    process.env.RANKING_SCRIPT_LLM_MODEL?.trim() ?? rawScriptModelFromEnv();
  return coerceDeepSeekModelForAnthropicTools(raw);
}

export function resolveGateBVoiceJudgeModel(): string {
  const raw =
    process.env.GATE_B_JUDGE_MODEL?.trim() ?? rawScriptModelFromEnv();
  return coerceDeepSeekModelForAnthropicTools(raw);
}

function parseHttpTimeoutMs(): number {
  const raw = process.env.ANTHROPIC_HTTP_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === '') return 600_000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 30_000) {
    throw new Error(
      'ANTHROPIC_HTTP_TIMEOUT_MS must be a number >= 30000 when set',
    );
  }
  return n;
}

function parseSdkMaxRetries(): number {
  const raw = process.env.ANTHROPIC_SDK_MAX_RETRIES;
  if (raw === undefined || raw.trim() === '') return 4;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 10) {
    throw new Error(
      'ANTHROPIC_SDK_MAX_RETRIES must be an integer 0..10 when set',
    );
  }
  return Math.floor(n);
}

/** Model used when DeepSeek fails and we retry on Anthropic Cloud (tools are compatible). */
export function resolveAnthropicFallbackModel(): string {
  return (
    process.env.CONTENT_PIPELINE_ANTHROPIC_FALLBACK_MODEL?.trim() ??
    'claude-sonnet-4-6'
  );
}

/** DeepSeek Anthropic-compatible endpoint (no startup log — used by fallback helper too). */
export function createDeepSeekAnthropicClient(): Anthropic {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is required for the DeepSeek Anthropic-compatible API.',
    );
  }
  const baseURL =
    process.env.DEEPSEEK_ANTHROPIC_BASE_URL?.trim() ||
    DEEPSEEK_ANTHROPIC_BASE_URL_DEFAULT;
  return new Anthropic({
    apiKey,
    baseURL,
    timeout: parseHttpTimeoutMs(),
    maxRetries: parseSdkMaxRetries(),
  });
}

/** Anthropic Cloud (no startup log). */
export function createAnthropicCloudClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for Anthropic Cloud.');
  }
  return new Anthropic({
    apiKey,
    timeout: parseHttpTimeoutMs(),
    maxRetries: parseSdkMaxRetries(),
  });
}

/**
 * Primary client for services that still want a single SDK instance (tests, legacy).
 * Prefer {@link anthropicMessagesCreateDeepSeekFirstWithAnthropicFallback} for requests.
 */
export function createContentPipelineAnthropicClient(): Anthropic {
  const backend = resolveContentPipelineLlmBackend();

  if (backend === 'deepseek') {
    const baseURL =
      process.env.DEEPSEEK_ANTHROPIC_BASE_URL?.trim() ||
      DEEPSEEK_ANTHROPIC_BASE_URL_DEFAULT;
    if (!bootLogged) {
      bootLogged = true;
      logger.log(
        `Content pipeline LLM: DeepSeek first, Anthropic fallback when configured — baseURL=${baseURL} defaultModel=${DEFAULT_DEEPSEEK_SCRIPT_MODEL}`,
      );
    }
    try {
      return createDeepSeekAnthropicClient();
    } catch {
      throw new Error(
        'Content pipeline defaults to DeepSeek V4. Set DEEPSEEK_API_KEY in Railway. To use Claude only: CONTENT_PIPELINE_LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY.',
      );
    }
  }

  if (!bootLogged) {
    bootLogged = true;
    logger.log('Content pipeline LLM: Anthropic Cloud only');
  }
  try {
    return createAnthropicCloudClient();
  } catch {
    throw new Error(
      'CONTENT_PIPELINE_LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY. Or set DEEPSEEK_API_KEY for DeepSeek-first.',
    );
  }
}

export function estimateEmitScriptCostUsd(
  backend: ContentPipelineLlmBackend,
  inputTokens: number,
  outputTokens: number,
): number {
  if (backend === 'deepseek') {
    const inRate = Number(process.env.DEEPSEEK_LLM_INPUT_USD_PER_1M ?? '');
    const outRate = Number(process.env.DEEPSEEK_LLM_OUTPUT_USD_PER_1M ?? '');
    if (Number.isFinite(inRate) && Number.isFinite(outRate)) {
      return (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
    }
    return 0;
  }
  return (inputTokens * 3.0 + outputTokens * 15.0) / 1_000_000;
}

export function estimateRankingJsonCostUsd(
  backend: ContentPipelineLlmBackend,
  inputTokens: number,
  outputTokens: number,
): number {
  if (backend === 'deepseek') {
    return estimateEmitScriptCostUsd(backend, inputTokens, outputTokens);
  }
  return (inputTokens * 15.0 + outputTokens * 75.0) / 1_000_000;
}
