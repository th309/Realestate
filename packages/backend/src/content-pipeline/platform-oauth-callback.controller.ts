import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { verifyState } from './oauth-state';
import { PlatformCredentialsService } from './platform-credentials.service';
import { PlatformAppCredentialsService } from './platform-app-credentials.service';
import { exchangeForPlatform } from './oauth/oauth-handlers';

const SUPPORTED_PLATFORMS = new Set([
  'youtube_shorts',
  'tiktok',
  'instagram_reels',
  'facebook_reels',
  'linkedin',
]);

@Controller('api/admin/content-pipeline/platforms')
export class PlatformOAuthCallbackController {
  private readonly logger = new Logger(PlatformOAuthCallbackController.name);

  constructor(
    private readonly creds: PlatformCredentialsService,
    private readonly appCreds: PlatformAppCredentialsService,
  ) {}

  @Get(':platform/oauth-callback')
  async callback(
    @Param('platform') platform: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontend = process.env.FRONTEND_URL ?? process.env.APP_BASE_URL ?? '';
    const redirectTo = (qs: string) =>
      res.redirect(302, `${frontend}/admin/content-pipeline/platforms?${qs}`);

    if (providerError) {
      this.logger.warn(
        `oauth-callback provider_error platform=${platform} err=${providerError}`,
      );
      return redirectTo(`error=${encodeURIComponent(providerError)}`);
    }
    if (!code || !state) {
      return redirectTo('error=missing_code_or_state');
    }
    try {
      verifyState(decodeURIComponent(state), platform);
    } catch (err) {
      this.logger.warn(
        `oauth-callback state_invalid platform=${platform} err=${(err as Error).message}`,
      );
      return redirectTo('error=state_invalid');
    }
    if (!SUPPORTED_PLATFORMS.has(platform)) {
      return redirectTo('error=platform_not_supported');
    }

    try {
      const { accountLabel, refreshToken } = await exchangeForPlatform(
        platform,
        code,
        this.appCreds,
      );
      await this.creds.upsertActive(platform, accountLabel, refreshToken);
      this.logger.log(
        `oauth-callback success platform=${platform} label=${accountLabel}`,
      );
      return redirectTo(
        `connected=${encodeURIComponent(platform)}&label=${encodeURIComponent(accountLabel)}`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(
        `oauth-callback exchange_failed platform=${platform} err=${msg}`,
      );
      return redirectTo(
        `error=${encodeURIComponent(`exchange_failed:${msg.slice(0, 80)}`)}`,
      );
    }
  }
}
