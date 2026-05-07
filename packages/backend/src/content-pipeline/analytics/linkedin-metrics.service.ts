import { Injectable } from '@nestjs/common';
import { PlatformCredentialsService } from '../platform-credentials.service';
import type { YouTubeMetricsResult } from './youtube-metrics.service';

const LI = 'https://api.linkedin.com/v2';
const RESTLI = '2.0.0';

@Injectable()
export class LinkedInMetricsService {
  constructor(private readonly creds: PlatformCredentialsService) {}

  async fetchMetrics(
    externalId: string,
    _window: '24h' | '7d' | '30d',
  ): Promise<YouTubeMetricsResult> {
    const row = await this.creds.getActive('linkedin');
    if (!row) {
      throw new Error(
        'LinkedIn not connected. Visit /admin/content-pipeline/platforms and click Connect.',
      );
    }

    const accessToken = row.refreshToken;
    // externalId is the returned `urn:li:share:...` from ugcPosts create.
    // The docs task suggests /ugcPosts/<share-id>?fields=statistics; in practice
    // share URNs can be resolved via ugcPosts endpoints as well.
    const encoded = encodeURIComponent(externalId);
    const res = await fetch(`${LI}/ugcPosts/${encoded}?projection=(statistics)`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': RESTLI,
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`linkedin metrics failed: ${res.status} ${text}`);

    const json = JSON.parse(text) as any;
    const stats = json?.statistics ?? {};
    const views = Number(stats?.viewCount ?? 0);
    const likes = Number(stats?.likeCount ?? 0);
    const comments = Number(stats?.commentCount ?? 0);

    return {
      views,
      impressions: 0,
      watch_time_seconds: 0,
      avg_retention_pct: 0,
      likes,
      comments,
      shares: 0,
      follows_gained: 0,
      raw_payload: json,
    };
  }
}

