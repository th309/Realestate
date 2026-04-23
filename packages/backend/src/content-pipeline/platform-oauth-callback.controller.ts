import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { google } from 'googleapis';
import { verifyState } from './oauth-state';
import { PlatformCredentialsService } from './platform-credentials.service';

@Controller('api/admin/content-pipeline/platforms')
export class PlatformOAuthCallbackController {
  private readonly logger = new Logger(PlatformOAuthCallbackController.name);

  constructor(private readonly creds: PlatformCredentialsService) {}

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
      return redirectTo(`error=state_invalid`);
    }

    if (platform !== 'youtube_shorts') {
      return redirectTo(`error=platform_not_supported`);
    }

    try {
      const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
      const appBaseUrl = process.env.APP_BASE_URL;
      if (!clientId || !clientSecret || !appBaseUrl)
        throw new Error('YOUTUBE_OAUTH_* env vars missing');

      const redirectUri = `${appBaseUrl}/api/admin/content-pipeline/platforms/${platform}/oauth-callback`;
      const oauth2 = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri,
      );
      const { tokens } = await oauth2.getToken(code);
      if (!tokens.refresh_token) {
        return redirectTo(`error=no_refresh_token_returned`);
      }
      oauth2.setCredentials(tokens);

      const yt = google.youtube({ version: 'v3', auth: oauth2 });
      const channelsRes = await yt.channels.list({
        mine: true,
        part: ['snippet'],
      });
      const items = channelsRes.data.items ?? [];
      if (items.length > 1) {
        this.logger.warn(
          `oauth-callback multiple_channels platform=${platform} count=${items.length} — using first`,
        );
      }
      const handle =
        items[0]?.snippet?.customUrl ?? items[0]?.snippet?.title ?? 'unknown';

      await this.creds.upsertActive(platform, handle, tokens.refresh_token);

      this.logger.log(
        `oauth-callback success platform=${platform} label=${handle}`,
      );
      return redirectTo(
        `connected=${encodeURIComponent(platform)}&label=${encodeURIComponent(handle)}`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(
        `oauth-callback code_exchange_failed platform=${platform} err=${msg}`,
      );
      return redirectTo(`error=${encodeURIComponent('code_exchange_failed')}`);
    }
  }
}
