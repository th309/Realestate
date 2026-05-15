import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiProviderService } from '../ai-provider.service';
import { SupabaseService } from '../../supabase/supabase.service';

// Mock OpenAI at module level (mirrors ai-provider.service.spec.ts pattern).
// Streaming tests inject a fake client directly via clientCache, so this
// constructor stub is just a no-op safety net.
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

describe('AiProviderService.stream()', () => {
  let service: AiProviderService;

  const buildMockSupabase = () => ({
    getClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
        // ai-usage-logger fires `.from('ai_usage_log').insert(...)`
        // fire-and-forget after each stream; keep it thenable.
        insert: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  });

  /**
   * Build a fake OpenAI client whose `chat.completions.create` returns an
   * async-iterable yielding the provided chunks. Returns the client and
   * the create-spy so tests can assert on call args.
   */
  const buildFakeClient = (chunks: any[]) => {
    const create = jest.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of chunks) yield chunk;
      },
    });
    return {
      client: { chat: { completions: { create } } },
      create,
    };
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Use env-fallback path: AI_PROVIDER=deepseek + DEEPSEEK_API_KEY=test-key.
    // Resolved config will be { provider: 'deepseek', baseUrl:
    // 'https://api.deepseek.com/v1', model: 'deepseek-chat', ... } so the
    // clientCache key for fake-client injection is
    // 'deepseek::https://api.deepseek.com/v1'.
    const env: Record<string, string | undefined> = {
      AI_PROVIDER: 'deepseek',
      AI_MODEL: undefined,
      AI_BASE_URL: undefined,
      AI_TEMPERATURE: undefined,
      DEEPSEEK_API_KEY: 'test-deepseek-key',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiProviderService,
        { provide: SupabaseService, useValue: buildMockSupabase() },
        { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
      ],
    }).compile();

    service = module.get(AiProviderService);
  });

  const cacheKey = 'deepseek::https://api.deepseek.com/v1';

  it('yields text deltas in order from a streamed sequence of chunks', async () => {
    const { client } = buildFakeClient([
      { choices: [{ delta: { content: 'Hello' } }] },
      { choices: [{ delta: { content: ', ' } }] },
      { choices: [{ delta: { content: 'world' } }] },
      { choices: [{ delta: { content: '!' } }] },
    ]);
    (service as any).clientCache.set(cacheKey, client);

    const collected: string[] = [];
    for await (const delta of service.stream('report_narrative', {
      userPrompt: 'Say hi',
      maxTokens: 100,
    })) {
      collected.push(delta);
    }

    expect(collected).toEqual(['Hello', ', ', 'world', '!']);
  });

  it('calls client.chat.completions.create with stream: true', async () => {
    const { client, create } = buildFakeClient([
      { choices: [{ delta: { content: 'ok' } }] },
    ]);
    (service as any).clientCache.set(cacheKey, client);

    // Drive the generator to completion so the create call is made.
    for await (const _ of service.stream('report_narrative', {
      userPrompt: 'test',
      maxTokens: 100,
    })) {
      // consume
    }

    expect(create).toHaveBeenCalledTimes(1);
    const callArgs = create.mock.calls[0][0];
    expect(callArgs.stream).toBe(true);
    expect(callArgs.model).toBe('deepseek-chat');
    expect(callArgs.max_tokens).toBe(100);
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'test' }]);
  });

  it('skips empty delta chunks (missing content, empty string, non-string)', async () => {
    const { client } = buildFakeClient([
      { choices: [{ delta: {} }] }, // no content key
      { choices: [{ delta: { content: 'A' } }] },
      { choices: [{ delta: { content: '' } }] }, // empty string
      { choices: [{ delta: { content: 'B' } }] },
      { choices: [{ delta: { content: null } }] }, // non-string
      { choices: [] }, // no choices
      { choices: [{ delta: { content: 'C' } }] },
      { choices: [{ delta: { content: 'D' } }], usage: { total_tokens: 5 } },
    ]);
    (service as any).clientCache.set(cacheKey, client);

    const collected: string[] = [];
    for await (const delta of service.stream('report_narrative', {
      userPrompt: 'test',
      maxTokens: 100,
    })) {
      collected.push(delta);
    }

    expect(collected).toEqual(['A', 'B', 'C', 'D']);
  });

  it('uses AiCompletionRequest shape (systemPrompt + userPrompt) and forwards both to messages', async () => {
    const { client, create } = buildFakeClient([
      { choices: [{ delta: { content: 'ok' } }] },
    ]);
    (service as any).clientCache.set(cacheKey, client);

    for await (const _ of service.stream('report_narrative', {
      systemPrompt: 'You are helpful',
      userPrompt: 'Greet me',
      maxTokens: 200,
    })) {
      // consume
    }

    const callArgs = create.mock.calls[0][0];
    expect(callArgs.messages).toEqual([
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Greet me' },
    ]);
    expect(callArgs.max_tokens).toBe(200);
    expect(callArgs.stream).toBe(true);
  });
});
