/**
 * Shares Email Controller
 *
 * Handles email delivery of shareable market reports.
 * Kept separate from SharesController to respect file-size limits.
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { SharesService } from './shares.service';
import { EmailService } from '../email/email.service';

@Controller('analytics/shares')
export class SharesEmailController {
  private readonly logger = new Logger(SharesEmailController.name);

  constructor(
    private readonly sharesService: SharesService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Send a market share via email
   * POST /api/analytics/shares/market-email
   */
  @UseGuards(JwtAuthGuard)
  @Post('market-email')
  async sendMarketEmail(
    @AuthUserId() userId: string,
    @Body()
    body: { shareToken: string; recipientEmail: string; message?: string },
  ) {
    this.logger.log(`POST /analytics/shares/market-email for user ${userId}`);

    if (!body.shareToken || !body.recipientEmail) {
      throw new HttpException(
        'shareToken and recipientEmail are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.recipientEmail)) {
      throw new HttpException('Invalid email address', HttpStatus.BAD_REQUEST);
    }

    try {
      const share = await this.sharesService.getByToken(body.shareToken);
      if (!share || share.content_type !== 'market_share') {
        throw new HttpException('Share not found', HttpStatus.NOT_FOUND);
      }

      const market = share.content?.market;
      const geoName = market?.geoName || share.title || 'a market';
      const shareUrl = `${process.env.FRONTEND_URL || 'https://propertyiq.app'}/s/${body.shareToken}`;

      const scoreSection =
        market?.score != null
          ? `<p style="font-size:18px;color:#3949AB;font-weight:700;">PropertyIQ Score: ${Math.round(market.score)}</p>`
          : '';

      const metricsHtml = [
        market?.homeValue &&
          `<td style="padding:0 16px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1A237E;">${market.homeValue}</div><div style="font-size:12px;color:#64748b;">Home Value</div></td>`,
        market?.appreciation &&
          `<td style="padding:0 16px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1A237E;">${market.appreciation}</div><div style="font-size:12px;color:#64748b;">YoY Change</div></td>`,
        market?.dom &&
          `<td style="padding:0 16px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1A237E;">${market.dom}</div><div style="font-size:12px;color:#64748b;">Days on Mkt</div></td>`,
        market?.supply &&
          `<td style="padding:0 16px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1A237E;">${market.supply}</div><div style="font-size:12px;color:#64748b;">Supply</div></td>`,
      ]
        .filter(Boolean)
        .join('');

      const messageSection = body.message
        ? `<p style="font-size:14px;color:#475569;background:#f1f5f9;padding:12px 16px;border-radius:8px;margin:16px 0;">"${body.message}"</p>`
        : '';

      const html = `
        <div style="max-width:560px;margin:0 auto;font-family:Roboto,Arial,sans-serif;">
          <div style="background:linear-gradient(145deg,#1A237E,#3949AB);border-radius:16px;padding:32px;color:#fff;margin-bottom:24px;">
            <p style="font-size:13px;color:#C5CAE9;margin:0 0 16px;letter-spacing:0.02em;">● PropertyIQ <span style="color:#5C6BC0;margin-left:6px;">The IQ Behind Every Market</span></p>
            <h1 style="font-size:28px;font-weight:800;margin:0 0 4px;color:#fff;">${geoName}</h1>
            <p style="font-size:14px;color:#C5CAE9;margin:0;">Market Intelligence Report</p>
            ${scoreSection}
          </div>
          ${metricsHtml ? `<table style="margin:0 auto 24px;"><tr>${metricsHtml}</tr></table>` : ''}
          ${messageSection}
          <a href="${shareUrl}" style="display:block;text-align:center;background:#3949AB;color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;">View Market Report</a>
          <p style="text-align:center;font-size:12px;color:#5C6BC0;margin-top:24px;">Sent via <a href="https://propertyiq.app" style="color:#3949AB;font-weight:600;">PropertyIQ</a></p>
        </div>
      `;

      const sent = await this.emailService.sendEmail({
        to: body.recipientEmail,
        subject: `Check out ${geoName} on PropertyIQ`,
        html,
        emailType: 'market_share',
        userId,
        metadata: { shareToken: body.shareToken, geoName },
      });

      if (!sent) {
        throw new HttpException(
          'Failed to send email',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Market email failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
