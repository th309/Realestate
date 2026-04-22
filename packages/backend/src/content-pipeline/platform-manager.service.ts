import { Inject, Injectable } from '@nestjs/common';
import {
  PLATFORM_PUBLISHERS,
  PlatformPublisher,
} from './drivers/platform-publisher.interface';

export interface PlatformStatus {
  platform: string;
  configured: boolean;
  lastPublishedAt: string | null;
}

/**
 * Manages platform publisher credential status and OAuth connect flows.
 * P1 only implements youtube_shorts; other platforms throw.
 */
@Injectable()
export class PlatformManagerService {
  constructor(
    @Inject(PLATFORM_PUBLISHERS)
    private readonly publishers: PlatformPublisher[],
  ) {}

  async getPlatformStatuses(): Promise<PlatformStatus[]> {
    return this.publishers.map((p) => ({
      platform: p.platform,
      configured: p.isConfigured(),
      lastPublishedAt: null,
    }));
  }

  async startOAuth(platform: string): Promise<{ authUrl: string }> {
    if (platform === 'youtube_shorts') {
      const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
      if (!clientId) throw new Error('YouTube OAuth client not configured');
      const appBaseUrl = process.env.APP_BASE_URL;
      if (!appBaseUrl) throw new Error('APP_BASE_URL not configured');
      const redirectUri = encodeURIComponent(
        `${appBaseUrl}/admin/content-pipeline/platforms/oauth-callback/youtube`,
      );
      const scope = encodeURIComponent(
        'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      );
      const url =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${clientId}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=code` +
        `&scope=${scope}` +
        `&access_type=offline` +
        `&prompt=consent`;
      return { authUrl: url };
    }
    throw new Error(`platform ${platform} not yet wired for OAuth in P1`);
  }
}
