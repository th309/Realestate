import { Inject, Injectable } from '@nestjs/common';
import {
  PLATFORM_PUBLISHERS,
  PlatformPublisher,
} from './drivers/platform-publisher.interface';
import { PlatformCredentialsService } from './platform-credentials.service';
import { signState } from './oauth-state';

export interface PlatformStatus {
  platform: string;
  configured: boolean;
  supported: boolean;
  accountLabel: string | null;
  connectedAt: string | null;
  lastPublishedAt: string | null;
}

const ALL_PLATFORMS = [
  'youtube_shorts',
  'tiktok',
  'instagram_reels',
  'facebook_reels',
  'linkedin',
  'youtube_long',
] as const;

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

@Injectable()
export class PlatformManagerService {
  constructor(
    @Inject(PLATFORM_PUBLISHERS)
    private readonly publishers: PlatformPublisher[],
    private readonly creds: PlatformCredentialsService,
  ) {}

  async getPlatformStatuses(): Promise<PlatformStatus[]> {
    const registered = new Map(this.publishers.map((p) => [p.platform, p]));
    const rows = await Promise.all(
      ALL_PLATFORMS.map(async (platform): Promise<PlatformStatus> => {
        const pub = registered.get(platform);
        const cred = await this.creds.getActive(platform);
        return {
          platform,
          supported: Boolean(pub),
          configured: cred !== null,
          accountLabel: cred?.accountLabel ?? null,
          connectedAt: cred?.connectedAt.toISOString() ?? null,
          lastPublishedAt: null,
        };
      }),
    );
    return rows;
  }

  async startOAuth(platform: string): Promise<{ authUrl: string }> {
    if (platform !== 'youtube_shorts') {
      throw new Error(`platform ${platform} not yet wired for OAuth in P1`);
    }
    const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error('YOUTUBE_OAUTH_CLIENT_ID not configured');
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) throw new Error('APP_BASE_URL not configured');

    const redirectUri = encodeURIComponent(
      `${appBaseUrl}/api/admin/content-pipeline/platforms/${platform}/oauth-callback`,
    );
    const scope = encodeURIComponent(YOUTUBE_SCOPES.join(' '));
    const state = encodeURIComponent(signState(platform));

    const url =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${state}`;

    return { authUrl: url };
  }
}
