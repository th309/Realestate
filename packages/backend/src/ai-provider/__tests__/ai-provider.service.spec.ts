import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiProviderService } from '../ai-provider.service';
import { SupabaseService } from '../../supabase/supabase.service';

// Mock OpenAI at module level
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

describe('AiProviderService', () => {
  let service: AiProviderService;
  let mockConfigGet: jest.Mock;
  let mockSupabaseSingle: jest.Mock;

  const buildMockSupabase = (singleResult: { data: any; error: any }) => {
    mockSupabaseSingle = jest.fn().mockResolvedValue(singleResult);
    return {
      getClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: mockSupabaseSingle,
              }),
            }),
          }),
        }),
      }),
    };
  };

  const buildModule = async (
    dbResult: { data: any; error: any },
    envOverrides: Record<string, string | undefined> = {},
  ) => {
    const defaultEnv: Record<string, string | undefined> = {
      AI_PROVIDER: 'deepseek',
      AI_MODEL: undefined,
      AI_BASE_URL: undefined,
      AI_TEMPERATURE: undefined,
      DEEPSEEK_API_KEY: 'test-deepseek-key',
      ANTHROPIC_API_KEY: undefined,
      OPENAI_API_KEY: undefined,
      ...envOverrides,
    };

    mockConfigGet = jest.fn((key: string) => defaultEnv[key]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProviderService,
        { provide: SupabaseService, useValue: buildMockSupabase(dbResult) },
        { provide: ConfigService, useValue: { get: mockConfigGet } },
      ],
    }).compile();

    service = module.get(AiProviderService);
  };

  const standardCompletionResponse = {
    choices: [{ message: { content: 'Hello from AI' } }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue(standardCompletionResponse);
  });

  describe('env-var fallback when DB has no config row', () => {
    beforeEach(async () => {
      await buildModule({ data: null, error: { code: 'PGRST116' } });
    });

    it('uses DEEPSEEK_API_KEY and default model from presets', async () => {
      const result = await service.complete('report_narrative', {
        userPrompt: 'Analyze this market',
        maxTokens: 1000,
      });

      expect(result.provider).toBe('deepseek');
      expect(result.model).toBe('deepseek-chat');
      expect(result.content).toBe('Hello from AI');
      expect(result.usage?.totalTokens).toBe(30);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('throws when no API key is available for the provider', async () => {
      await buildModule(
        { data: null, error: { code: 'PGRST116' } },
        { DEEPSEEK_API_KEY: undefined },
      );

      await expect(
        service.complete('report_narrative', {
          userPrompt: 'test',
          maxTokens: 100,
        }),
      ).rejects.toThrow(/No API key found/);
    });

    it('respects AI_PROVIDER env var to select provider', async () => {
      await buildModule(
        { data: null, error: { code: 'PGRST116' } },
        { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-openai-key' },
      );

      const result = await service.complete('test_purpose', {
        userPrompt: 'test',
        maxTokens: 100,
      });

      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-5.4');
    });
  });

  describe('DB config loading and 5-minute caching', () => {
    const dbConfig = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      api_key: 'db-anthropic-key',
      base_url: 'https://api.anthropic.com/v1',
      temperature: 0.5,
      max_retries: 3,
    };

    beforeEach(async () => {
      await buildModule({ data: dbConfig, error: null });
    });

    it('uses DB config when available', async () => {
      const result = await service.complete('report_narrative', {
        userPrompt: 'test',
        maxTokens: 100,
      });

      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-sonnet-4-20250514');
    });

    it('caches DB config and does not re-query within TTL', async () => {
      await service.complete('report_narrative', {
        userPrompt: 'first call',
        maxTokens: 100,
      });
      await service.complete('report_narrative', {
        userPrompt: 'second call',
        maxTokens: 100,
      });

      // DB should only be queried once (cached on second call)
      expect(mockSupabaseSingle).toHaveBeenCalledTimes(1);
    });

    it('uses different cache entries for different purposes', async () => {
      await service.complete('report_narrative', {
        userPrompt: 'call 1',
        maxTokens: 100,
      });
      await service.complete('research_brief', {
        userPrompt: 'call 2',
        maxTokens: 100,
      });

      // Each purpose triggers its own DB lookup
      expect(mockSupabaseSingle).toHaveBeenCalledTimes(2);
    });
  });

  describe('system prompt handling for reasoner vs non-reasoner models', () => {
    it('uses system role for standard models', async () => {
      await buildModule({
        data: {
          provider: 'deepseek',
          model: 'deepseek-chat',
          api_key: 'key',
          base_url: 'https://api.deepseek.com/v1',
          temperature: 0.7,
          max_retries: 2,
        },
        error: null,
      });

      await service.complete('test', {
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Hello',
        maxTokens: 100,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toEqual([
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ]);
    });

    it('prepends system prompt to user message for reasoner models', async () => {
      await buildModule({
        data: {
          provider: 'deepseek',
          model: 'deepseek-reasoner',
          api_key: 'key',
          base_url: 'https://api.deepseek.com/v1',
          temperature: 0.7,
          max_retries: 2,
        },
        error: null,
      });

      await service.complete('test', {
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Hello',
        maxTokens: 100,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].role).toBe('user');
      expect(callArgs.messages[0].content).toContain('[System Instructions]');
      expect(callArgs.messages[0].content).toContain(
        'You are a helpful assistant',
      );
      expect(callArgs.messages[0].content).toContain('Hello');
    });

    it('sends only user message when no system prompt is provided', async () => {
      await buildModule({ data: null, error: { code: 'PGRST116' } });

      await service.complete('test', {
        userPrompt: 'Hello',
        maxTokens: 100,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });
  });

  describe('cache invalidation', () => {
    beforeEach(async () => {
      await buildModule({
        data: {
          provider: 'deepseek',
          model: 'deepseek-chat',
          api_key: 'key',
          base_url: 'https://api.deepseek.com/v1',
          temperature: 0.7,
          max_retries: 2,
        },
        error: null,
      });
    });

    it('invalidates a specific purpose cache entry', async () => {
      await service.complete('report_narrative', {
        userPrompt: 'first',
        maxTokens: 100,
      });
      expect(mockSupabaseSingle).toHaveBeenCalledTimes(1);

      service.invalidateCache('report_narrative');

      await service.complete('report_narrative', {
        userPrompt: 'second',
        maxTokens: 100,
      });
      // Should re-query DB after invalidation
      expect(mockSupabaseSingle).toHaveBeenCalledTimes(2);
    });

    it('invalidates all cache entries when no purpose is given', async () => {
      await service.complete('purpose_a', {
        userPrompt: 'a',
        maxTokens: 100,
      });
      await service.complete('purpose_b', {
        userPrompt: 'b',
        maxTokens: 100,
      });
      expect(mockSupabaseSingle).toHaveBeenCalledTimes(2);

      service.invalidateCache();

      await service.complete('purpose_a', {
        userPrompt: 'a again',
        maxTokens: 100,
      });
      await service.complete('purpose_b', {
        userPrompt: 'b again',
        maxTokens: 100,
      });
      // Both should re-query after full invalidation
      expect(mockSupabaseSingle).toHaveBeenCalledTimes(4);
    });
  });

  describe('response format and error handling', () => {
    beforeEach(async () => {
      await buildModule({ data: null, error: { code: 'PGRST116' } });
    });

    it('passes json response_format when requested', async () => {
      await service.complete('test', {
        userPrompt: 'Return JSON',
        maxTokens: 100,
        responseFormat: 'json',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
    });

    it('does not include response_format for text mode', async () => {
      await service.complete('test', {
        userPrompt: 'Return text',
        maxTokens: 100,
        responseFormat: 'text',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.response_format).toBeUndefined();
    });

    it('re-throws API errors with context', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        service.complete('test', {
          userPrompt: 'test',
          maxTokens: 100,
        }),
      ).rejects.toThrow('Rate limit exceeded');
    });
  });
});
