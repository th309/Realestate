import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  buildMessages,
  getOrCreateClient,
  logProviderKeyStatus,
} from '../ai-client-factory';
import type { AiProviderConfig } from '../ai-provider.types';

const SILENT_LOGGER = { log: () => {} } as unknown as Logger;

function config(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    apiKey: 'test-key',
    baseUrl: 'https://api.deepseek.com/v1',
    ...overrides,
  };
}

describe('buildMessages', () => {
  it('uses a separate system role for models that support it', () => {
    const messages = buildMessages(config(), {
      systemPrompt: 'SYS',
      userPrompt: 'USER',
      maxTokens: 100,
    });
    expect(messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USER' },
    ]);
  });

  it('folds the system prompt into the user message for reasoner models', () => {
    const messages = buildMessages(config({ model: 'deepseek-reasoner' }), {
      systemPrompt: 'SYS',
      userPrompt: 'USER',
      maxTokens: 100,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('SYS');
    expect(messages[0].content).toContain('USER');
  });

  it('sends only the user message when there is no system prompt', () => {
    const messages = buildMessages(config(), {
      userPrompt: 'USER',
      maxTokens: 100,
    });
    expect(messages).toEqual([{ role: 'user', content: 'USER' }]);
  });
});

describe('getOrCreateClient', () => {
  it('reuses the same client instance for an identical provider+baseUrl', () => {
    const cache = new Map<string, OpenAI>();
    const a = getOrCreateClient(cache, config(), SILENT_LOGGER);
    const b = getOrCreateClient(cache, config(), SILENT_LOGGER);
    expect(a).toBe(b);
    expect(cache.size).toBe(1);
  });

  it('creates distinct clients for different baseUrls', () => {
    const cache = new Map<string, OpenAI>();
    const a = getOrCreateClient(cache, config(), SILENT_LOGGER);
    const b = getOrCreateClient(
      cache,
      config({ provider: 'openai', baseUrl: 'https://api.openai.com/v1' }),
      SILENT_LOGGER,
    );
    expect(a).not.toBe(b);
    expect(cache.size).toBe(2);
  });
});

describe('logProviderKeyStatus', () => {
  it('reports SET for present keys and MISSING for absent ones', () => {
    const logs: string[] = [];
    const logger = { log: (m: string) => logs.push(m) } as unknown as Logger;
    const cfg = {
      get: (k: string) => (k === 'DEEPSEEK_API_KEY' ? 'present' : undefined),
    } as unknown as ConfigService;

    logProviderKeyStatus(cfg, logger);

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('DEEPSEEK_API_KEY: SET');
    expect(logs[0]).toContain('ANTHROPIC_API_KEY: MISSING');
  });
});
