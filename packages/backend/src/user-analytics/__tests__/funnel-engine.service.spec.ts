import { Test, TestingModule } from '@nestjs/testing';
import { FunnelEngineService } from '../funnel-engine.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RedisService } from '../../redis/redis.service';

const mockClient: any = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

const mockSupabase = { getClient: jest.fn(() => mockClient) };
const mockRedis = {
  getByKey: jest.fn().mockResolvedValue(null),
  setByKey: jest.fn().mockResolvedValue(undefined),
};

describe('FunnelEngineService — multi-event steps', () => {
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

  it('counts visitors who fired ANY any_of event at a multi-event step', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: {
        id: 'f1',
        steps: [
          { event_category: 'pageview', event_action: 'view' },
          {
            any_of: [
              { event_category: 'seo', event_action: 'conversion_bar_clicked' },
              { event_category: 'hero', event_action: 'cta_click' },
            ],
          },
        ],
      },
    });
    mockClient.gte.mockResolvedValueOnce({
      data: [
        { visitor_id: 'vA', event_category: 'pageview', event_action: 'view' },
        {
          visitor_id: 'vA',
          event_category: 'seo',
          event_action: 'conversion_bar_clicked',
        },
        { visitor_id: 'vB', event_category: 'pageview', event_action: 'view' },
        { visitor_id: 'vB', event_category: 'hero', event_action: 'cta_click' },
      ],
    });

    const result = await service.evaluateFunnel('f1', 7);

    expect(result[0].count).toBe(2);
    expect(result[1].count).toBe(2);
  });

  it('preserves backward compat for single-event steps', async () => {
    mockClient.single.mockResolvedValueOnce({
      data: {
        id: 'f2',
        steps: [
          { event_category: 'pageview', event_action: 'view' },
          { event_category: 'conversion', event_action: 'signup_start' },
        ],
      },
    });
    mockClient.gte.mockResolvedValueOnce({
      data: [
        { visitor_id: 'vA', event_category: 'pageview', event_action: 'view' },
        {
          visitor_id: 'vA',
          event_category: 'conversion',
          event_action: 'signup_start',
        },
      ],
    });

    const result = await service.evaluateFunnel('f2', 7);
    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(1);
  });
});
