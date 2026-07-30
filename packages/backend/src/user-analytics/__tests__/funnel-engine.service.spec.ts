/**
 * Funnel evaluation now happens in SQL (analytics_sequential_funnel), so these
 * assert the CONTRACT with that function rather than in-memory set logic.
 *
 * What changed and why: the old implementation fetched user_events into Node
 * with no bot filter, no ORDER BY and no `.range()`. PostgREST caps such a
 * fetch at 1,000 rows, so every saved funnel was evaluated against an arbitrary
 * 1,000 of ~127,000 events, counting crawler visitors as participants. Its
 * query error was also destructured away, so a failure produced an all-zero
 * funnel that read exactly like an honest one.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FunnelEngineService } from '../funnel-engine.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';

const mockClient: any = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  rpc: jest.fn(),
};

const mockSupabase = { getClient: jest.fn(() => mockClient) };
const mockRedis = {
  getByKey: jest.fn().mockResolvedValue(null),
  setByKey: jest.fn().mockResolvedValue(undefined),
};

const MULTI_STEP_FUNNEL = {
  id: 'f1',
  steps: [
    { event_category: 'pageview', event_action: 'view' },
    {
      label: 'Clicked a CTA',
      any_of: [
        { event_category: 'seo', event_action: 'conversion_bar_clicked' },
        { event_category: 'hero', event_action: 'cta_click' },
      ],
    },
  ],
};

describe('FunnelEngineService', () => {
  let service: FunnelEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.getByKey.mockResolvedValue(null);
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        FunnelEngineService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = mod.get(FunnelEngineService);
  });

  it('flattens a multi-event step into ORed category.action matchers', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: MULTI_STEP_FUNNEL,
      error: null,
    });
    mockClient.rpc.mockResolvedValueOnce({
      data: [
        { step_index: 0, visitors: 2 },
        { step_index: 1, visitors: 2 },
      ],
      error: null,
    });

    const result = await service.evaluateFunnel('f1', 30);

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'analytics_sequential_funnel',
      expect.objectContaining({
        p_steps: [
          ['pageview.view'],
          ['seo.conversion_bar_clicked', 'hero.cta_click'],
        ],
      }),
    );
    expect(result[1].count).toBe(2);
    expect(result[1].name).toBe('Clicked a CTA');
  });

  it('preserves backward compatibility for single-event steps', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: {
        id: 'f2',
        steps: [{ event_category: 'conversion', event_action: 'signup_start' }],
      },
      error: null,
    });
    mockClient.rpc.mockResolvedValueOnce({
      data: [{ step_index: 0, visitors: 11 }],
      error: null,
    });

    const result = await service.evaluateFunnel('f2', 30);

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'analytics_sequential_funnel',
      expect.objectContaining({ p_steps: [['conversion.signup_start']] }),
    );
    expect(result[0]).toMatchObject({
      name: 'conversion.signup_start',
      count: 11,
      rateFromFirst: 1,
    });
  });

  it('defaults to the human segment so crawlers are not counted as participants', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: MULTI_STEP_FUNNEL,
      error: null,
    });
    mockClient.rpc.mockResolvedValueOnce({ data: [], error: null });

    await service.evaluateFunnel('f1', 30);

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'analytics_sequential_funnel',
      expect.objectContaining({ p_traffic: 'human' }),
    );
  });

  it('throws instead of returning an all-zero funnel when the query fails', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: MULTI_STEP_FUNNEL,
      error: null,
    });
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'statement timeout' },
    });

    await expect(service.evaluateFunnel('f1', 30)).rejects.toThrow(
      /Funnel evaluation failed/,
    );
  });

  it('separates cache entries per traffic segment', async () => {
    mockClient.single.mockResolvedValue({
      data: MULTI_STEP_FUNNEL,
      error: null,
    });
    mockClient.rpc.mockResolvedValue({ data: [], error: null });

    await service.evaluateFunnel('f1', 30, 'human');
    await service.evaluateFunnel('f1', 30, 'bot');

    const [humanKey] = mockRedis.setByKey.mock.calls[0];
    const [botKey] = mockRedis.setByKey.mock.calls[1];
    expect(humanKey).not.toEqual(botKey);
  });
});
