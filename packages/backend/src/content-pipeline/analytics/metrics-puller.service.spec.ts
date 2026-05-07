import { Test } from '@nestjs/testing';
import { MetricsPullerService } from './metrics-puller.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { YouTubeMetricsService } from './youtube-metrics.service';
import { TikTokMetricsService } from './tiktok-metrics.service';
import { InstagramMetricsService } from './instagram-metrics.service';
import { FacebookMetricsService } from './facebook-metrics.service';
import { LinkedInMetricsService } from './linkedin-metrics.service';

describe('MetricsPullerService', () => {
  let svc: MetricsPullerService;
  let insertSpy: jest.Mock;

  beforeEach(async () => {
    insertSpy = jest.fn().mockResolvedValue({ error: null });
    const supabase = {
      getClient: () => ({
        from: jest.fn().mockImplementation((tbl: string) => {
          if (tbl === 'platform_posts')
            return {
              select: () => ({
                eq: () => ({
                  gte: () => ({
                    lt: () =>
                      Promise.resolve({
                        data: [
                          {
                            id: 'p1',
                            platform: 'youtube_shorts',
                            external_id: 'abc123',
                            created_at: new Date().toISOString(),
                            short_link_id: null,
                          },
                        ],
                      }),
                  }),
                }),
              }),
            };
          if (tbl === 'content_metrics')
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null }),
                  }),
                }),
              }),
              insert: insertSpy,
            };
          return {};
        }),
      }),
    };
    const youtube = {
      fetchMetrics: jest.fn().mockResolvedValue({
        views: 1200,
        impressions: 0,
        watch_time_seconds: 0,
        avg_retention_pct: 0,
        likes: 30,
        comments: 2,
        shares: 0,
        follows_gained: 1,
        raw_payload: {},
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        MetricsPullerService,
        { provide: SupabaseService, useValue: supabase },
        { provide: YouTubeMetricsService, useValue: youtube },
        { provide: TikTokMetricsService, useValue: { fetchMetrics: jest.fn() } },
        {
          provide: InstagramMetricsService,
          useValue: { fetchMetrics: jest.fn() },
        },
        { provide: FacebookMetricsService, useValue: { fetchMetrics: jest.fn() } },
        { provide: LinkedInMetricsService, useValue: { fetchMetrics: jest.fn() } },
      ],
    }).compile();
    svc = module.get(MetricsPullerService);
  });

  it('pulls 24h metrics and inserts a content_metrics row', async () => {
    const count = await svc.pullWindow('24h');
    expect(count).toBe(1);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        platform_post_id: 'p1',
        pulled_at_window: '24h',
        views: 1200,
      }),
    );
  });
});
