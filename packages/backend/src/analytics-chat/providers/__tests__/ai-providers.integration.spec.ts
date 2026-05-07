import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AnalyticsToolsService } from '../../analytics-tools.service';
import { AnthropicProvider } from '../anthropic.provider';
import { OpenAIProvider } from '../openai.provider';
import { ChatOptions } from '../../interfaces/ai-provider.interface';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Mock tools service
const mockToolsService = {
  executeTool: jest.fn().mockImplementation(async (name, args) => {
    console.log(`[MockTool] Executing ${name} with args:`, args);
    return {
      success: true,
      data: {
        message: 'This is a mock tool response',
        items: ['Item 1', 'Item 2'],
      },
    };
  }),
} as unknown as AnalyticsToolsService;

// Test timeout (APIs can be slow)
jest.setTimeout(60000);

describe('AI Providers Integration', () => {
  let anthropicProvider: AnthropicProvider;
  let openaiProvider: OpenAIProvider;
  // Computed once in beforeAll, read in tests — hoisted to describe scope
  let isDeepSeekProvider: boolean;

  const mockToolDefinition = {
    name: 'test_tool',
    description:
      'A test tool that returns a list of items. Use this when asked to test tools.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
    },
  };

  beforeAll(async () => {
    // Validation
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn(
        'SKIPPING ANTHROPIC TESTS: ANTHROPIC_API_KEY not found in .env',
      );
    }
    if (!process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
      console.warn(
        'SKIPPING OPENAI TESTS: OPENAI_API_KEY or DEEPSEEK_API_KEY not found in .env',
      );
    }

    // Setup Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      anthropicProvider = new AnthropicProvider(
        anthropicClient,
        mockToolsService,
      );
    }

    // Setup OpenAI / DeepSeek
    // Mirror the service's provider selection logic: only pass a custom baseURL for
    // DeepSeek/Novita (OpenAI-compatible at non-standard endpoints). Real OpenAI should
    // use the SDK default (https://api.openai.com/v1).
    const rawProvider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
    isDeepSeekProvider = rawProvider === 'deepseek' || rawProvider === 'novita';
    const apiKey = isDeepSeekProvider
      ? process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
      : process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
    const baseURL = isDeepSeekProvider
      ? process.env.AI_BASE_URL || 'https://api.deepseek.com/v1'
      : undefined;

    if (apiKey) {
      const openaiClient = new OpenAI({ apiKey, baseURL });
      openaiProvider = new OpenAIProvider(openaiClient, mockToolsService);
      console.log(
        `OpenAI Provider initialized | provider=${rawProvider} baseURL=${baseURL ?? '(sdk default)'}`,
      );
    }
  });

  describe('Anthropic Provider (Claude)', () => {
    it('should perform a basic chat', async () => {
      if (!anthropicProvider) return;

      const options: ChatOptions = {
        model: 'claude-sonnet-4-5-20250929',
        messages: [
          { role: 'user', content: 'Say "hello world" and nothing else.' },
        ],
        tools: [],
        systemPrompt: 'You are a helpful assistant.',
        conversationId: 'test-basic-chat',
      };

      const response = await anthropicProvider.chat(options);
      console.log('[Anthropic] Basic Chat Response:', response.content);
      expect(response.content).toBeDefined();
      expect(response.content.toLowerCase()).toContain('hello');
    });

    it('should use tools when requested', async () => {
      if (!anthropicProvider) return;

      const options: ChatOptions = {
        model: 'claude-sonnet-4-5-20250929',
        messages: [
          {
            role: 'user',
            content: 'Please use the test_tool to search for "apples".',
          },
        ],
        tools: [mockToolDefinition],
        systemPrompt:
          'You are a helpful assistant. If asked to use a tool, use it.',
        conversationId: 'test-tool-chat',
      };

      const response = await anthropicProvider.chat(options);
      console.log('[Anthropic] Tool Chat Response:', response.content);
      console.log('[Anthropic] Tools Used:', response.toolsUsed);

      expect(response.toolsUsed).toContain('test_tool');
      // We verify that executeTool was called
      expect(mockToolsService.executeTool).toHaveBeenCalledWith(
        'test_tool',
        expect.anything(),
      );
    });
  });

  describe('OpenAI Provider (DeepSeek/OpenAI)', () => {
    it('should perform a basic chat', async () => {
      if (!openaiProvider) return;

      // Use AI_MODEL from env if it's not a Claude model; fall back to the
      // provider-appropriate default (deepseek-chat vs gpt-4o).
      const defaultModel = isDeepSeekProvider ? 'deepseek-chat' : 'gpt-4o';
      let model = defaultModel;
      if (process.env.AI_MODEL && !process.env.AI_MODEL.includes('claude')) {
        model = process.env.AI_MODEL;
      }
      console.log(`[OpenAI] Testing with model: ${model}`);

      const options: ChatOptions = {
        model: model,
        messages: [
          { role: 'user', content: 'Say "hello world" and nothing else.' },
        ],
        tools: [],
        systemPrompt: 'You are a helpful assistant.',
        conversationId: 'test-basic-chat-openai',
      };

      try {
        const response = await openaiProvider.chat(options);
        console.log('[OpenAI] Basic Chat Response:', response.content);
        expect(response.content).toBeDefined();
        expect(response.content.toLowerCase()).toContain('hello');
      } catch (e) {
        console.error('[OpenAI] Basic Chat Failed:', e);
        throw e;
      }
    });

    it('should use tools when requested', async () => {
      if (!openaiProvider) return;

      const defaultModel = isDeepSeekProvider ? 'deepseek-chat' : 'gpt-4o';
      let model = defaultModel;
      if (process.env.AI_MODEL && !process.env.AI_MODEL.includes('claude')) {
        model = process.env.AI_MODEL;
      }

      const options: ChatOptions = {
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Please use the test_tool to search for "bananas".',
          },
        ],
        tools: [mockToolDefinition],
        systemPrompt:
          'You are a helpful assistant. If asked to use a tool, use it.',
        conversationId: 'test-tool-chat-openai',
      };

      try {
        const response = await openaiProvider.chat(options);
        console.log('[OpenAI] Tool Chat Response:', response.content);
        console.log('[OpenAI] Tools Used:', response.toolsUsed);

        expect(response.toolsUsed).toContain('test_tool');
        expect(mockToolsService.executeTool).toHaveBeenCalledWith(
          'test_tool',
          expect.objectContaining({ query: 'bananas' }),
        );
      } catch (e) {
        console.error('[OpenAI] Tool Chat Failed:', e);
        throw e;
      }
    });
  });
});
