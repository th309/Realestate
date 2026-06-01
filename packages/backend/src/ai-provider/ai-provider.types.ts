/**
 * AI Provider Types
 *
 * Model-agnostic type definitions for the unified AI provider abstraction.
 * Supports multiple LLM providers via OpenAI-compatible API format.
 */

export type AiProviderType =
  | 'deepseek'
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'custom';

export interface AiProviderConfig {
  provider: AiProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  maxRetries?: number;
}

export interface AiCompletionRequest {
  systemPrompt?: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
  /** Tag for grouping usage logs during model evaluation runs. */
  testRunId?: string;
  /** Section identifier for granular usage tracking (e.g., "executive_verdict"). */
  sectionId?: string;
  /** Associated report ID for linking usage to a specific report. */
  reportId?: string;
}

export interface AiCompletionResponse {
  content: string;
  model: string;
  provider: AiProviderType;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export interface ProviderPreset {
  baseUrl: string;
  defaultModel: string;
  defaultTemperature: number;
  envKeyName: string;
  supportsSystemPrompt: boolean;
  /** Available models for this provider, shown in admin UI dropdown. */
  availableModels: Array<{ id: string; label: string; context?: string }>;
}

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
 * Per-model pricing in USD per 1M tokens.
 * Used by AiUsageLogger to estimate cost from token counts.
 * Update when providers change pricing.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> =
  {
    // DeepSeek
    'deepseek-chat': { input: 0.27, output: 1.1 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
    // Anthropic
    'claude-opus-4-7': { input: 5.0, output: 25.0 },
    'claude-opus-4-6': { input: 5.0, output: 25.0 },
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5': { input: 0.8, output: 4.0 },
    // OpenAI
    'gpt-5.4': { input: 2.5, output: 10.0 },
    'gpt-5.4-pro': { input: 5.0, output: 20.0 },
    'gpt-4.1': { input: 2.0, output: 8.0 },
    'gpt-4.1-mini': { input: 0.4, output: 1.6 },
    'gpt-4.1-nano': { input: 0.1, output: 0.4 },
    o3: { input: 2.0, output: 8.0 },
    'o3-pro': { input: 20.0, output: 80.0 },
    'o4-mini': { input: 1.1, output: 4.4 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    // Google
    'gemini-3.1-pro-preview': { input: 1.25, output: 10.0 },
    'gemini-3.1-flash-lite-preview': { input: 0.02, output: 0.1 },
    'gemini-3-flash': { input: 0.1, output: 0.4 },
    'gemini-2.5-pro': { input: 1.25, output: 10.0 },
    'gemini-2.5-flash': { input: 0.15, output: 0.6 },
    'gemini-2.5-flash-lite': { input: 0.02, output: 0.1 },
  };

export const PROVIDER_PRESETS: Record<AiProviderType, ProviderPreset> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    defaultTemperature: 0.7,
    envKeyName: 'DEEPSEEK_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat (V3.2)', context: '128K' },
      {
        id: 'deepseek-reasoner',
        label: 'DeepSeek Reasoner (V3.2)',
        context: '128K',
      },
    ],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-haiku-4-5',
    defaultTemperature: 0.7,
    envKeyName: 'ANTHROPIC_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', context: '1M' },
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', context: '1M' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', context: '200K' },
      {
        id: 'claude-sonnet-4-5',
        label: 'Claude Sonnet 4.5',
        context: '200K',
      },
      {
        id: 'claude-haiku-4-5',
        label: 'Claude Haiku 4.5',
        context: '200K',
      },
    ],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5.4',
    defaultTemperature: 0.7,
    envKeyName: 'OPENAI_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      { id: 'gpt-5.4', label: 'GPT-5.4', context: '200K' },
      { id: 'gpt-5.4-pro', label: 'GPT-5.4 Pro', context: '200K' },
      { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', context: '200K' },
      { id: 'gpt-4.1', label: 'GPT-4.1', context: '1M' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', context: '1M' },
      { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', context: '1M' },
      { id: 'o3', label: 'o3 (Reasoning)', context: '200K' },
      { id: 'o3-pro', label: 'o3 Pro (Reasoning)', context: '200K' },
      { id: 'o4-mini', label: 'o4-mini (Reasoning)', context: '200K' },
      { id: 'gpt-4o', label: 'GPT-4o (Legacy)', context: '128K' },
    ],
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-pro',
    defaultTemperature: 0.7,
    envKeyName: 'GOOGLE_AI_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      {
        id: 'gemini-3.1-pro-preview',
        label: 'Gemini 3.1 Pro Preview',
        context: '1M',
      },
      {
        id: 'gemini-3.1-flash-lite-preview',
        label: 'Gemini 3.1 Flash Lite Preview',
        context: '1M',
      },
      { id: 'gemini-3-flash', label: 'Gemini 3 Flash', context: '1M' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', context: '1M' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', context: '1M' },
      {
        id: 'gemini-2.5-flash-lite',
        label: 'Gemini 2.5 Flash Lite',
        context: '1M',
      },
    ],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4-6',
    defaultTemperature: 0.7,
    envKeyName: 'OPENROUTER_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [
      {
        id: 'anthropic/claude-opus-4-7',
        label: 'Claude Opus 4.7',
        context: '1M',
      },
      {
        id: 'anthropic/claude-opus-4-6',
        label: 'Claude Opus 4.6',
        context: '1M',
      },
      {
        id: 'anthropic/claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        context: '200K',
      },
      { id: 'openai/gpt-5.4', label: 'GPT-5.4', context: '200K' },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', context: '1M' },
      { id: 'google/gemini-3-flash', label: 'Gemini 3 Flash', context: '1M' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', context: '128K' },
      {
        id: 'deepseek/deepseek-reasoner',
        label: 'DeepSeek Reasoner',
        context: '128K',
      },
    ],
  },
  custom: {
    baseUrl: '',
    defaultModel: '',
    defaultTemperature: 0.7,
    envKeyName: 'CUSTOM_AI_API_KEY',
    supportsSystemPrompt: true,
    availableModels: [],
  },
};
