import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  PLATFORM_PUBLISHERS,
  PlatformPublisher,
} from './drivers/platform-publisher.interface';
import { PlatformCredentialsService } from './platform-credentials.service';
import {
  PlatformAppCredentialsService,
  type AppCredentialStatus,
} from './platform-app-credentials.service';
import { buildOAuthUrl } from './oauth/oauth-urls';
import { platformRedirectUri } from './oauth/oauth-urls';

export interface PlatformStatus {
  platform: string;
  configured: boolean;
  supported: boolean;
  accountLabel: string | null;
  connectedAt: string | null;
  lastPublishedAt: string | null;
  /** App-credential status — drives the Configure dialog in the admin UI. */
  appCredentials: AppCredentialStatus;
  /**
   * When set, this row shares OAuth + app credentials with another platform.
   * Example: `youtube_long` mirrors `youtube_shorts` (one Google channel).
   */
  mirrorsPlatform: string | null;
}

const ALL_PLATFORMS = [
  'youtube_shorts',
  'tiktok',
  'instagram_reels',
  'facebook_reels',
  'linkedin',
  'youtube_long',
] as const;

@Injectable()
export class PlatformManagerService {
  private readonly logger = new Logger(PlatformManagerService.name);

  constructor(
    @Inject(PLATFORM_PUBLISHERS)
    private readonly publishers: PlatformPublisher[],
    private readonly creds: PlatformCredentialsService,
    private readonly appCreds: PlatformAppCredentialsService,
  ) {}

  async getPlatformStatuses(): Promise<PlatformStatus[]> {
    const registered = new Map(this.publishers.map((p) => [p.platform, p]));
    const rows = await Promise.all(
      ALL_PLATFORMS.map(async (platform): Promise<PlatformStatus> => {
        const pub = registered.get(platform);
        const mirrorsShorts = platform === 'youtube_long';
        const credSource = mirrorsShorts ? 'youtube_shorts' : platform;
        const cred = await this.creds.getActive(credSource);
        const appStatus = await this.appCreds.status(credSource);
        return {
          platform,
          supported: Boolean(pub),
          configured: cred !== null,
          accountLabel: cred?.accountLabel ?? null,
          connectedAt: cred?.connectedAt.toISOString() ?? null,
          lastPublishedAt: null,
          appCredentials: appStatus,
          mirrorsPlatform: mirrorsShorts ? 'youtube_shorts' : null,
        };
      }),
    );
    return rows;
  }

  async startOAuth(platform: string): Promise<{ authUrl: string }> {
    const authUrl = await buildOAuthUrl(platform, this.appCreds);
    // Log the EXACT redirect_uri we're sending so the operator can diff
    // it byte-for-byte against what's registered on the platform side
    // when an error like "redirect_uri does not match registered value"
    // shows up. LinkedIn / Meta / TikTok all do strict matching.
    const redirectUri = platformRedirectUri(platform);
    this.logger.log(
      `[OAUTH-START] platform=${platform} redirect_uri=${redirectUri}`,
    );
    this.logger.log(`[OAUTH-START] platform=${platform} authUrl=${authUrl}`);
    return { authUrl };
  }
}
