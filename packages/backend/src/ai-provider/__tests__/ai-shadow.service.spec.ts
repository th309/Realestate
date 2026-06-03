import { Test } from '@nestjs/testing';
import { AiShadowService } from '../ai-shadow.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';

const makeCtx = (overrides: Partial<any> = {}) => ({
  purpose: 'market_insight',
  requestId: '00000000-0000-0000-0000-000000000001',
  primaryConfig: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    apiKey: 'sk-x',
    baseUrl: 'https://api.deepseek.com/v1',
    shadowProvider: 'anthropic',
    shadowModel: 'claude-opus-4-7',
    shadowSampleRate: 1.0,
  },
  primaryResult: {
    content: 'primary output',
    usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    durationMs: 1234,
  },
  callArgs: { messages: [{ role: 'user', content: 'hi' }], options: {} },
  primaryFailedOver: false,
  ...overrides,
});

describe('AiShadowService gates', () => {
  let service: AiShadowService;
  let fireSpy: jest.SpyInstance;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        AiShadowService,
        { provide: SupabaseService, useValue: { getClient: () => ({}) } },
        {
          provide: ConfigService,
          useValue: { get: () => 'redis://localhost' },
        },
      ],
    }).compile();
    service = mod.get(AiShadowService);
    fireSpy = jest.spyOn(service as any, 'fireShadowCall').mockResolvedValue({
      content: 'shadow output',
      usage: { promptTokens: 50, completionTokens: 80, totalTokens: 130 },
      durationMs: 500,
    });
    jest.spyOn(service as any, 'insertLog').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'shadowGloballyEnabled').mockResolvedValue(true);
    jest.spyOn(service as any, 'dailyCeilingExceeded').mockResolvedValue(false);
    jest
      .spyOn(service as any, 'incrementDailyCost')
      .mockResolvedValue(undefined);
  });

  it('skips when shadowProvider is undefined', async () => {
    await service.runShadow(
      makeCtx({
        primaryConfig: {
          ...makeCtx().primaryConfig,
          shadowProvider: undefined,
        },
      }),
    );
    expect(fireSpy).not.toHaveBeenCalled();
  });

  it('skips when global enabled=false', async () => {
    (service as any).shadowGloballyEnabled.mockResolvedValue(false);
    await service.runShadow(makeCtx());
    expect(fireSpy).not.toHaveBeenCalled();
  });

  it('skips when primaryFailedOver=true', async () => {
    await service.runShadow(makeCtx({ primaryFailedOver: true }));
    expect(fireSpy).not.toHaveBeenCalled();
  });

  it('skips when daily ceiling exceeded', async () => {
    (service as any).dailyCeilingExceeded.mockResolvedValue(true);
    await service.runShadow(makeCtx());
    expect(fireSpy).not.toHaveBeenCalled();
  });

  it('skips when random > sample_rate', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.9);
    await service.runShadow(
      makeCtx({
        primaryConfig: { ...makeCtx().primaryConfig, shadowSampleRate: 0.5 },
      }),
    );
    expect(fireSpy).not.toHaveBeenCalled();
  });

  it('fires when random <= sample_rate', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.3);
    await service.runShadow(
      makeCtx({
        primaryConfig: { ...makeCtx().primaryConfig, shadowSampleRate: 0.5 },
      }),
    );
    expect(fireSpy).toHaveBeenCalledTimes(1);
  });
});
