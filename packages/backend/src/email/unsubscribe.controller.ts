import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { EmailService } from './email.service';
import {
  verifyUnsubscribeToken,
  type UnsubscribeStream,
} from './unsubscribe-token.util';

/** Upper bound on token length before the HMAC is computed — a valid token is
 *  well under 200 chars; this caps the work an unauthenticated caller can force. */
const MAX_TOKEN_LENGTH = 512;

/**
 * Public, unauthenticated email unsubscribe endpoint.
 *
 * Reached two ways:
 *   - GET  — a recipient clicks the footer "Unsubscribe" link → branded HTML page.
 *   - POST — a mailbox provider (Gmail/Yahoo/Microsoft) honors the
 *            `List-Unsubscribe` / `List-Unsubscribe-Post: One-Click` headers and
 *            posts server-side. RFC 8058: must succeed without user interaction.
 *
 * The opt-out itself is `email_preferences.marketing = false`, the same flag the
 * drip/behavioral/engagement/digest senders already honor via
 * `getMarketingOptOutIds`. Both verbs are idempotent.
 *
 * No auth guard: the only global APP_GUARD is the ThrottlerGuard (rate limit),
 * so this controller is public by default. We NEVER return 4xx/5xx for a bad
 * token — that would let a provider mark the email as failing one-click and hurt
 * sender reputation. Invalid/expired tokens still return 200 (friendly HTML for
 * GET, empty body for POST) and simply do not change any preference.
 */
@Controller('api/email/unsubscribe')
export class UnsubscribeController {
  private readonly logger = new Logger(UnsubscribeController.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async unsubscribeViaLink(
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const stream = await this.applyOptOut(token);
    res
      .status(200)
      .type('text/html')
      .send(stream ? this.confirmationPage(stream) : this.expiredPage());
  }

  @Post()
  async unsubscribeOneClick(
    @Query('token') queryToken: string | undefined,
    @Body() body: unknown,
    @Res() res: Response,
  ): Promise<void> {
    // One-click POST bodies arrive form-encoded (List-Unsubscribe=One-Click) or
    // occasionally with the token in the body; the query param is the primary
    // carrier since it is what we put in the header URL.
    const bodyToken =
      body && typeof body === 'object'
        ? ((body as Record<string, unknown>).token as string | undefined)
        : undefined;
    await this.applyOptOut(queryToken ?? bodyToken);
    // Always 200 with no body — do not leak token validity to the provider.
    res.status(200).send();
  }

  /**
   * Verifies the token and flips the opted-out stream's preference → false.
   * Returns the opted-out stream on success (so the page copy can name it), or
   * null otherwise. `marketing` covers the drip/behavioral/engagement/monthly
   * senders; `weekly_digest` is gated separately, so its link must flip that
   * column — flipping `marketing` would NOT stop the weekly digest.
   */
  private async applyOptOut(
    token: string | undefined,
  ): Promise<UnsubscribeStream | null> {
    // Bound the work an unauthenticated caller can force before the HMAC runs.
    if (!token || token.length > MAX_TOKEN_LENGTH) return null;

    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      // Missing secret is a server misconfiguration, not a recipient error.
      this.logger.error('Unsubscribe: JWT_SECRET not configured');
      return null;
    }

    const payload = verifyUnsubscribeToken(token, secret);
    if (!payload) return null;

    const updates =
      payload.stream === 'weekly_digest'
        ? { weekly_digest: false }
        : { marketing: false };
    const result = await this.emailService.updatePreferences(
      payload.userId,
      updates,
    );
    if (!result) {
      this.logger.error(
        `Unsubscribe: failed to update preferences for user ${payload.userId}`,
      );
      return null;
    }
    return payload.stream;
  }

  private confirmationPage(stream: UnsubscribeStream): string {
    const lead =
      stream === 'weekly_digest'
        ? `You&rsquo;ve been unsubscribed from the PropertyIQ weekly market
           digest. You won&rsquo;t receive the Monday summary going forward.`
        : `You&rsquo;ve been unsubscribed from PropertyIQ marketing emails. You
           won&rsquo;t receive onboarding tips, market digests, or promotional
           messages going forward.`;
    return this.htmlShell(
      'You&rsquo;re unsubscribed',
      lead,
      `Still want account and alert emails? Manage every preference any time from
       your account settings.`,
    );
  }

  private expiredPage(): string {
    return this.htmlShell(
      'This link has expired',
      `We couldn&rsquo;t process this unsubscribe link &mdash; it may have expired
       or already been used.`,
      `You can still turn off marketing emails any time by signing in and visiting
       your notification preferences.`,
    );
  }

  private htmlShell(title: string, lead: string, secondary: string): string {
    const base = (
      this.config.get<string>('EMAIL_LINK_BASE_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'https://propertyiq.app'
    ).replace(/\/+$/, '');
    const prefsUrl = `${base}/account/notifications`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} &middot; PropertyIQ</title>
</head>
<body style="font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#FAFBFF; margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFBFF; padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,0.08); overflow:hidden; max-width:520px; width:100%;">
          <tr>
            <td style="background-color:#3949AB; padding:24px 32px;">
              <span style="color:#ffffff; font-size:22px; font-weight:700; letter-spacing:-0.5px;">PropertyIQ</span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px;">
              <h1 style="margin:0 0 12px; font-size:24px; font-weight:700; color:#1A237E;">${title}</h1>
              <p style="margin:0 0 16px; font-size:16px; color:#424242; line-height:1.6;">${lead}</p>
              <p style="margin:0 0 24px; font-size:15px; color:#616161; line-height:1.6;">${secondary}</p>
              <a href="${prefsUrl}"
                 style="display:inline-block; background-color:#3949AB; color:#ffffff; padding:14px 28px; border-radius:100px; font-size:15px; font-weight:600; text-decoration:none; letter-spacing:0.2px;">
                Manage preferences
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px; border-top:1px solid #E8EAF6;">
              <p style="margin:0; font-size:12px; color:#9E9E9E; line-height:1.5;">
                PropertyIQ &middot; Republic Registered Agent LLC &middot; 20 S Charles St, Ste 403 &middot; Baltimore, MD 21201
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
