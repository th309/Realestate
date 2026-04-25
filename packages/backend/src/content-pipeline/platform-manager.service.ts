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
        const cred = await this.creds.getActive(platform);
        const appStatus = await this.appCreds.status(platform);
        return {
          platform,
          supported: Boolean(pub),
          configured: cred !== null,
          accountLabel: cred?.accountLabel ?? null,
          connectedAt: cred?.connectedAt.toISOString() ?? null,
          lastPublishedAt: null,
          appCredentials: appStatus,
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
