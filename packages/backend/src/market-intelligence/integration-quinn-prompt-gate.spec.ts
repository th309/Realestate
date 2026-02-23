/**
 * Market Intelligence Integration Tests: Flows 4-5
 *
 * 4. formatBriefingForPrompt output correctness
 * 5. Quinn intelligence gate (BRIEFING_GENERATION_ENABLED)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalyticsChatService } from '../analytics-chat/analytics-chat.service';
import { BriefingGeneratorService } from './briefing-generator.service';
import { RankingsCacheService } from './rankings-cache.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AppConfigService } from '../config/app-config.service';
import { AnalyticsToolsService } from '../analytics-chat/analytics-tools.service';
import { RedisService } from '../redis/redis.service';
import { MarketBriefing } from './market-intelligence.types';
import {
  createIntegrationSupabaseClient, createMockAppConfig,
} from './integration-test-helpers';

// ---------------------------------------------------------------------------
// Mock SDKs (required by AnalyticsChatService constructor)
// ---------------------------------------------------------------------------

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  }));
});

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({}));
});

// ---------------------------------------------------------------------------
// Shared provider factory for AnalyticsChatService tests
// ---------------------------------------------------------------------------

function buildAnalyticsChatProviders(
  overrides: Record<string, string | boolean> = {},
) {
  const supabaseClient = createIntegrationSupabaseClient();
  const mockAppConfig = createMockAppConfig(overrides);

  return [
    AnalyticsChatService,
    { provide: ConfigService, useValue: {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          AI_PROVIDER: 'anthropic',
          ANTHROPIC_API_KEY: 'test-key',
          QUINN_CACHE_WARM_ON_STARTUP: 'false',
        };
        return config[key] ?? defaultValue;
      }),
    }},
    { provide: AnalyticsToolsService, useValue: {
      getToolDefinitions: jest.fn().mockReturnValue([]),
      executeTool: jest.fn().mockResolvedValue({ success: true, data: {} }),
    }},
    { provide: SupabaseService, useValue: { getClient: () => supabaseClient } },
    { provide: RedisService, useValue: {
      isAvailable: jest.fn().mockReturnValue(false),
      get: jest.fn().mockResolvedValue(null),
      getStats: jest.fn().mockReturnValue({ hits: 0, misses: 0, hitRate: 0 }),
    }},
    { provide: AppConfigService, useValue: mockAppConfig },
    { provide: RankingsCacheService, useValue: {
      getRanking: jest.fn().mockResolvedValue(null),
    }},
    { provide: BriefingGeneratorService, useValue: {
      generateBriefingOnDemand: jest.fn().mockResolvedValue(undefined),
    }},
  ];
}

// ===========================================================================
// Flow 4: formatBriefingForPrompt Output Correctness
// ===========================================================================

describe('Flow 4: formatBriefingForPrompt produces correct prompt text', () => {
  const sampleBriefing: MarketBriefing = {
    id: 'briefing-001',
    geography_id: '31080',
    geography_type: 'metro',
    geography_name: 'Los Angeles-Long Beach-Anaheim, CA',
    generated_date: '2026-02-23',
    metrics_snapshot: {
      home_value: {
        value: 450000, formatted: '$450K', mom_change: null,
        yoy_change: null, date: '2026-01-15', source: 'zillow', is_inherited: false,
      },
      appreciation_yoy: {
        value: 4.2, formatted: '4.2%', mom_change: null,
        yoy_change: null, date: '2026-01-15', source: 'zillow', is_inherited: false,
      },
      vacancy_rate: {
        value: null, formatted: 'N/A', mom_change: null,
        yoy_change: null, date: null, source: 'census', is_inherited: false,
      },
    },
    scores: {},
    market_stance: 'weak_bullish',
    stance_signals: [
      { signal: 'strong_appreciation', direction: 'bullish', value: 4.2, threshold: 'appreciation_yoy > 3%' },
      { signal: 'population_growth', direction: 'bullish', value: 1.1, threshold: 'population_growth > 0.5%' },
    ],
    risk_flags: [
      {
        flag: 'affordability_squeeze', severity: 'medium',
        detail: 'Price-to-income ratio at 6.3, indicating affordability stress',
        metric_value: 6.3, threshold: 'price_to_income > 6.0',
      },
    ],
    narrative_summary: 'LA remains a strong market with 4.2% appreciation and growing population.',
    suggested_questions: [
      'How does LA compare to national trends?',
      'What are the top risk factors?',
      'Is now a good time to invest?',
    ],
    news_snapshot: [],
    metrics_count: 12,
    data_freshness_days: 39,
  };

  let chatService: AnalyticsChatService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: buildAnalyticsChatProviders({
        BRIEFING_GENERATION_ENABLED: 'true',
        RANKINGS_CACHE_ENABLED: 'false',
      }),
    }).compile();

    chatService = module.get<AnalyticsChatService>(AnalyticsChatService);
  });

  it('includes the geography name in the header', () => {
    const result = (chatService as any).formatBriefingForPrompt(sampleBriefing, []);
    expect(result).toContain('MARKET INTELLIGENCE BRIEFING: Los Angeles-Long Beach-Anaheim, CA');
  });

  it('includes market stance', () => {
    const result = (chatService as any).formatBriefingForPrompt(sampleBriefing, []);
    expect(result).toContain('Stance: weak_bullish');
  });

  it('includes stance signals with direction', () => {
    const result = (chatService as any).formatBriefingForPrompt(sampleBriefing, []);
    expect(result).toContain('strong_appreciation (bullish)');
    expect(result).toContain('population_growth (bullish)');
  });

  it('includes risk flag details', () => {
    const result = (chatService as any).formatBriefingForPrompt(sampleBriefing, []);
    expect(result).toContain('Price-to-income ratio at 6.3');
  });

  it('includes non-null metrics in the Key Metrics section', () => {
    const result = (chatService as any).formatBriefingForPrompt(sampleBriefing, []);
    expect(result).toContain('home_value: $450K');
    expect(result).toContain('appreciation_yoy: 4.2%');
    // vacancy_rate has null value, should NOT appear
    expect(result).not.toContain('vacancy_rate: N/A');
  });

  it('includes narrative summary', () => {
    const result = (chatService as any).formatBriefingForPrompt(sampleBriefing, []);
    expect(result).toContain('Analyst Summary: LA remains a strong market');
  });

  it('includes suggested questions', () => {
    const result = (chatService as any).formatBriefingForPrompt(sampleBriefing, []);
    expect(result).toContain('Suggested Follow-ups:');
    expect(result).toContain('How does LA compare to national trends?');
    expect(result).toContain('What are the top risk factors?');
    expect(result).toContain('Is now a good time to invest?');
  });

  it('includes fresh news when provided', () => {
    const freshNews = [
      { headline: 'LA rents hit record high', source_name: 'Reuters' },
      { headline: 'New construction in downtown', source_name: 'LAT' },
    ];

    const result = (chatService as any).formatBriefingForPrompt(sampleBriefing, freshNews);
    expect(result).toContain('Recent News:');
    expect(result).toContain('LA rents hit record high (Reuters)');
    expect(result).toContain('New construction in downtown (LAT)');
  });

  it('shows "None" for risk flags when there are none', () => {
    const noRiskBriefing = { ...sampleBriefing, risk_flags: [] };
    const result = (chatService as any).formatBriefingForPrompt(noRiskBriefing, []);
    expect(result).toContain('Risk Flags: None');
  });
});

// ===========================================================================
// Flow 5: Quinn Intelligence Gate (BRIEFING_GENERATION_ENABLED)
// ===========================================================================

describe('Flow 5: Quinn intelligence gate when BRIEFING_GENERATION_ENABLED=false', () => {
  let chatService: AnalyticsChatService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: buildAnalyticsChatProviders({
        BRIEFING_GENERATION_ENABLED: 'false',
      }),
    }).compile();

    chatService = module.get<AnalyticsChatService>(AnalyticsChatService);
  });

  it('returns offline message via chat() when intelligence is disabled', async () => {
    const result = await chatService.chat('conv-1', 'What are the best markets?');

    expect(result.response).toContain('Quinn is currently offline');
    expect(result.toolsUsed).toEqual([]);
  });

  it('yields offline message via chatStream() when intelligence is disabled', async () => {
    const chunks: Array<{ type: string; content: any }> = [];

    for await (const chunk of chatService.chatStream('conv-2', 'Top metros?')) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter(c => c.type === 'text');
    expect(textChunks.length).toBeGreaterThan(0);
    expect(textChunks[0].content).toContain('Quinn is currently offline');

    const doneChunks = chunks.filter(c => c.type === 'done');
    expect(doneChunks.length).toBe(1);
  });
});
