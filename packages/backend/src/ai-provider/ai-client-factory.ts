/**
 * AI client + message construction helpers.
 *
 * Extracted from AiProviderService to keep that file under the line limit.
 * Pure/stateless except for the caller-owned client cache passed to
 * getOrCreateClient. Behavior is identical to the prior inline methods.
 */

import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  AiProviderConfig,
  AiCompletionRequest,
} from './ai-provider.types';

const PROVIDER_KEY_ENV_NAMES = [
  'DEEPSEEK_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GOOGLE_AI_API_KEY',
] as const;

/** Log which provider API keys are present at startup (SET/MISSING, no values). */
export function logProviderKeyStatus(
  configService: ConfigService,
  logger: Logger,
): void {
  const status = PROVIDER_KEY_ENV_NAMES.map(
    (k) => `${k}: ${configService.get(k) ? 'SET' : 'MISSING'}`,
  ).join(', ');
  logger.log(`API keys at startup: ${status}`);
}

/**
 * Build the messages array, handling system-prompt support per model.
 * deepseek-reasoner doesn't support a system role — prepend it to the user
 * message instead.
 */
export function buildMessages(
  config: AiProviderConfig,
  request: AiCompletionRequest,
): OpenAI.ChatCompletionMessageParam[] {
  const modelSupportsSystemRole = !config.model.includes('reasoner');

  if (request.systemPrompt && modelSupportsSystemRole) {
    return [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ];
  }

  if (request.systemPrompt && !modelSupportsSystemRole) {
    const combinedPrompt = `[System Instructions]\n${request.systemPrompt}\n\n[User Request]\n${request.userPrompt}`;
    return [{ role: 'user', content: combinedPrompt }];
  }

  return [{ role: 'user', content: request.userPrompt }];
}

/**
 * Get or create an OpenAI-compatible client, cached by provider+baseUrl key
 * in the caller-owned `clientCache`.
 */
export function getOrCreateClient(
  clientCache: Map<string, OpenAI>,
  config: AiProviderConfig,
  logger: Logger,
): OpenAI {
  const cacheKey = `${config.provider}::${config.baseUrl}`;
  const existing = clientCache.get(cacheKey);
  if (existing) return existing;

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    maxRetries: config.maxRetries ?? 2,
  });

  clientCache.set(cacheKey, client);
  logger.log(
    `OpenAI client created for ${config.provider} at ${config.baseUrl}`,
  );
  return client;
}
