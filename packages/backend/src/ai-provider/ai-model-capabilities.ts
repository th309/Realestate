/**
 * AI Model Capabilities
 *
 * Per-model behavioral predicates used by the completion/stream executors to
 * adapt the request to a model's quirks: sampling-parameter rejection,
 * json_object support, and reasoning-token budgeting.
 *
 * Extracted from ai-provider.types.ts to keep that file under the 300-line
 * limit (CLAUDE.md §1.3). Type-only import of AiProviderType, so there is no
 * runtime import cycle.
 */

import type { AiProviderType } from './ai-provider.types';

/**
 * Models that reject sampling parameters (`temperature`, `top_p`, `top_k`).
 * Sending them yields HTTP 400. Add new model IDs here as Anthropic releases them.
 * See: shared/model-migration.md → Migrating to Opus 4.7.
 */
const ANTHROPIC_NO_SAMPLING_MODELS = new Set<string>(['claude-opus-4-7']);

export function modelRejectsSamplingParams(
  provider: AiProviderType,
  model: string,
): boolean {
  if (provider !== 'anthropic' && provider !== 'openrouter') return false;
  const bareId = model.startsWith('anthropic/') ? model.slice(10) : model;
  return ANTHROPIC_NO_SAMPLING_MODELS.has(bareId);
}

/**
 * Whether a provider accepts OpenAI-style `response_format: { type: 'json_object' }`.
 *
 * Anthropic's OpenAI-compatible endpoint rejects `json_object` — it only accepts
 * `'json_schema'` (which requires a full schema we do not supply per narrative
 * section), returning `400 response_format.type: Input should be 'json_schema'`.
 * For Anthropic we omit response_format and rely on the prompt's JSON instructions
 * plus downstream parsing. DeepSeek / OpenAI support json_object natively.
 */
export function providerSupportsJsonObjectFormat(
  provider: AiProviderType,
): boolean {
  return provider !== 'anthropic';
}

/**
 * Models that emit chain-of-thought "reasoning" tokens which COUNT toward the
 * completion-token budget (OpenAI-compatible APIs bill `reasoning_content` as
 * completion tokens). For these models `max_tokens` must include headroom for
 * reasoning ON TOP of the desired answer length — otherwise short-budget
 * sections come back EMPTY because reasoning consumes the entire budget before
 * a single answer token is emitted.
 *
 * Observed: deepseek-v4-pro starved `executive_verdict` (max_tokens 300) and
 * `verdict_and_actions` (2000) to empty strings while large sections (4000+)
 * rendered fine. The OpenAI o-series and deepseek-reasoner behave the same way.
 */
export function modelUsesReasoningTokens(
  _provider: AiProviderType,
  model: string,
): boolean {
  const bareId = model.includes('/') ? model.split('/').pop()! : model;
  if (/^o\d/i.test(bareId)) return true; // o3, o3-pro, o4-mini …
  if (bareId.includes('reasoner')) return true; // deepseek-reasoner
  if (bareId.startsWith('deepseek-v4')) return true; // deepseek-v4-pro (reasoning)
  return false;
}

/**
 * Token headroom reserved for `reasoning_content` on reasoning models, added on
 * top of the caller's requested answer budget. Generous enough to cover the
 * reasoning these bounded narrative tasks produce (typically 0.5–2.5k tokens)
 * while never truncating the answer. `max_tokens` is only a CAP, so raising it
 * never lengthens output — it only prevents reasoning from starving the answer.
 */
export const REASONING_TOKEN_HEADROOM = 4000;

/**
 * Resolve the effective `max_tokens` to send for a model: the caller's answer
 * budget plus reasoning headroom for reasoning models, unchanged otherwise.
 */
export function resolveMaxTokens(
  provider: AiProviderType,
  model: string,
  requestedMaxTokens: number,
): number {
  return modelUsesReasoningTokens(provider, model)
    ? requestedMaxTokens + REASONING_TOKEN_HEADROOM
    : requestedMaxTokens;
}
