import {
  createContentPipelineAnthropicClient,
  resolveContentPipelineLlmBackend,
  resolveDefaultScriptLlmModel,
} from './content-pipeline-llm-client';

describe('content-pipeline-llm-client', () => {
  let envSnapshot: {
    CONTENT_PIPELINE_LLM_PROVIDER?: string;
    DEEPSEEK_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    SCRIPT_LLM_MODEL?: string;
  };

  beforeAll(() => {
    envSnapshot = {
      CONTENT_PIPELINE_LLM_PROVIDER: process.env.CONTENT_PIPELINE_LLM_PROVIDER,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      SCRIPT_LLM_MODEL: process.env.SCRIPT_LLM_MODEL,
    };
  });

  afterEach(() => {
    for (const k of Object.keys(envSnapshot) as Array<
      keyof typeof envSnapshot
    >) {
      const v = envSnapshot[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('forces Anthropic when CONTENT_PIPELINE_LLM_PROVIDER=anthropic', () => {
    process.env.CONTENT_PIPELINE_LLM_PROVIDER = 'anthropic';
    delete process.env.DEEPSEEK_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'ak';
    delete process.env.SCRIPT_LLM_MODEL;
    expect(resolveContentPipelineLlmBackend()).toBe('anthropic');
    expect(resolveDefaultScriptLlmModel()).toBe('claude-sonnet-4-6');
  });

  it('defaults to DeepSeek when DEEPSEEK_API_KEY is set', () => {
    delete process.env.CONTENT_PIPELINE_LLM_PROVIDER;
    process.env.DEEPSEEK_API_KEY = 'dk';
    process.env.ANTHROPIC_API_KEY = 'ak';
    delete process.env.SCRIPT_LLM_MODEL;
    expect(resolveContentPipelineLlmBackend()).toBe('deepseek');
    expect(resolveDefaultScriptLlmModel()).toBe('deepseek-v4-pro');
  });

  it('creates client for DeepSeek with DeepSeek base URL', () => {
    process.env.CONTENT_PIPELINE_LLM_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'dk';
    const client = createContentPipelineAnthropicClient();
    expect(client.baseURL).toContain('deepseek.com');
  });

  it('maps deepseek-reasoner to tool-capable model (DeepSeek rejects tool_choice)', () => {
    delete process.env.CONTENT_PIPELINE_LLM_PROVIDER;
    process.env.DEEPSEEK_API_KEY = 'dk';
    process.env.ANTHROPIC_API_KEY = 'ak';
    process.env.SCRIPT_LLM_MODEL = 'deepseek-reasoner';
    expect(resolveDefaultScriptLlmModel()).toBe('deepseek-v4-pro');
  });
});
