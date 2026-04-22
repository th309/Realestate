import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';

export interface YouTubeMetricsResult {
  views: number;
  impressions: number;
  watch_time_seconds: number;
  avg_retention_pct: number;
  likes: number;
  comments: number;
  shares: number;
  follows_gained: number;
  raw_payload: unknown;
}

/**
 * Fetches per-video metrics from the YouTube Data API v3 (public statistics)
 * plus the YouTube Analytics API v2 (watch time, retention, subscribers
 * gained) for a given window. OAuth credentials come from environment
 * variables and use a long-lived refresh token.
 */
@Injectable()
export class YouTubeMetricsService {
  async fetchMetrics(
    videoId: string,
    window: '24h' | '7d' | '30d',
  ): Promise<YouTubeMetricsResult> {
    const oauth2 = new google.auth.OAuth2(
      process.env.YOUTUBE_OAUTH_CLIENT_ID,
      process.env.YOUTUBE_OAUTH_CLIENT_SECRET,
    );
    oauth2.setCredentials({
      refresh_token: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN,
    });

    const yt = google.youtube({ version: 'v3', auth: oauth2 });
    const ytAnalytics = google.youtubeAnalytics({
      version: 'v2',
      auth: oauth2,
    });

    const videoRes = await yt.videos.list({
      part: ['statistics'],
      id: [videoId],
    });
    const stats = videoRes.data.items?.[0]?.statistics ?? {};

    const today = new Date();
    const startDate = new Date(today);
    const daysBack = window === '24h' ? 1 : window === '7d' ? 7 : 30;
    startDate.setDate(startDate.getDate() - daysBack);

    let analytics: {
      watch_time_seconds?: number;
      avg_retention_pct?: number;
      follows_gained?: number;
    } = {};
    try {
      const analyticsRes = await ytAnalytics.reports.query({
        ids: 'channel==MINE',
        startDate: startDate.toISOString().slice(0, 10),
        endDate: today.toISOString().slice(0, 10),
        metrics:
          'views,estimatedMinutesWatched,averageViewPercentage,likes,comments,shares,subscribersGained',
        dimensions: 'video',
        filters: `video==${videoId}`,
      });
      const row = (analyticsRes.data.rows?.[0] ?? []) as Array<number>;
      analytics = {
        watch_time_seconds: Math.round((row[2] ?? 0) * 60),
        avg_retention_pct: row[3] ?? 0,
        follows_gained: row[7] ?? 0,
      };
    } catch {
      // analytics API may return empty for videos under 24h old
    }

    return {
      views: parseInt(stats.viewCount ?? '0', 10),
      impressions: 0, // YouTube API does not expose impressions to all accounts
      watch_time_seconds: analytics.watch_time_seconds ?? 0,
      avg_retention_pct: analytics.avg_retention_pct ?? 0,
      likes: parseInt(stats.likeCount ?? '0', 10),
      comments: parseInt(stats.commentCount ?? '0', 10),
      shares: 0, // not exposed per-video via Data API
      follows_gained: analytics.follows_gained ?? 0,
      raw_payload: { statistics: stats, analytics },
    };
  }
}
