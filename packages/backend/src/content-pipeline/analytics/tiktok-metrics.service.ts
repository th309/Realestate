import { Injectable } from '@nestjs/common';
import { PlatformCredentialsService } from '../platform-credentials.service';
import type { YouTubeMetricsResult } from './youtube-metrics.service';

interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

const TIKTOK_API_BASE = 'https://open.tiktokapis.com';

@Injectable()
export class TikTokMetricsService {
  constructor(private readonly creds: PlatformCredentialsService) {}

  async fetchMetrics(
    externalId: string,
    _window: '24h' | '7d' | '30d',
  ): Promise<YouTubeMetricsResult> {
    const accessToken = await this.getAccessToken();

    // TikTok Content Posting API IDs differ from public video IDs; we store
    // external_id as the ID returned by publish handler. Query endpoint expects
    // the publically_available_post_id.
    const res = await fetch(`${TIKTOK_API_BASE}/v2/video/query/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        filters: { video_ids: [externalId] },
        fields: [
          'id',
          'view_count',
          'like_count',
          'comment_count',
          'share_count',
          'total_time_watched',
        ],
      }),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`tiktok metrics failed: ${res.status} ${text}`);

    const json = JSON.parse(text) as any;
    const v = json?.data?.videos?.[0] ?? {};

    return {
      views: Number(v.view_count ?? 0),
      impressions: 0,
      watch_time_seconds: Math.round(Number(v.total_time_watched ?? 0)),
      avg_retention_pct: 0,
      likes: Number(v.like_count ?? 0),
      comments: Number(v.comment_count ?? 0),
      shares: Number(v.share_count ?? 0),
      follows_gained: 0,
      raw_payload: json,
    };
  }

  private async getAccessToken(): Promise<string> {
    const row = await this.creds.getActive('tiktok');
    if (!row) {
      throw new Error(
        'TikTok not connected. Visit /admin/content-pipeline/platforms and click Connect.',
      );
    }
    const res = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_OAUTH_CLIENT_KEY ?? '',
        client_secret: process.env.TIKTOK_OAUTH_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
        refresh_token: row.refreshToken,
      }).toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`tiktok token refresh failed: ${res.status} ${text}`);
    }
    const json = (await res.json()) as TikTokTokenResponse;
    return json.access_token;
  }
}

