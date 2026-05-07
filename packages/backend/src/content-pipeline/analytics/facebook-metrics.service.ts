import { Injectable } from '@nestjs/common';
import { PlatformCredentialsService } from '../platform-credentials.service';
import type { YouTubeMetricsResult } from './youtube-metrics.service';

const GRAPH = 'https://graph.facebook.com/v21.0';

@Injectable()
export class FacebookMetricsService {
  constructor(private readonly creds: PlatformCredentialsService) {}

  async fetchMetrics(
    externalId: string,
    _window: '24h' | '7d' | '30d',
  ): Promise<YouTubeMetricsResult> {
    const row = await this.creds.getActive('facebook_reels');
    if (!row) {
      throw new Error(
        'Facebook not connected. Visit /admin/content-pipeline/platforms and click Connect.',
      );
    }

    const accessToken = row.refreshToken;
    const params = new URLSearchParams({
      metric:
        'post_video_views,post_reactions_like_total,post_comments,post_shares',
      access_token: accessToken,
    });
    const res = await fetch(`${GRAPH}/${externalId}/insights?${params.toString()}`);
    const text = await res.text();
    if (!res.ok) throw new Error(`facebook metrics failed: ${res.status} ${text}`);

    const json = JSON.parse(text) as any;
    const byName = new Map<string, number>();
    for (const item of json?.data ?? []) {
      const name = item?.name as string | undefined;
      const value = item?.values?.[0]?.value;
      if (name) byName.set(name, Number(value ?? 0));
    }

    return {
      views: byName.get('post_video_views') ?? 0,
      impressions: 0,
      watch_time_seconds: 0,
      avg_retention_pct: 0,
      likes: byName.get('post_reactions_like_total') ?? 0,
      comments: byName.get('post_comments') ?? 0,
      shares: byName.get('post_shares') ?? 0,
      follows_gained: 0,
      raw_payload: json,
    };
  }
}

