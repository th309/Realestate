/**
 * Analyzer Share-via-Email Controller
 *
 * Sends a transactional email containing a link to a shared analyzer report.
 * Mirrors the market-share email pattern but is scoped to analyzer share
 * tokens (produced by AnalyzerPersistenceService.save()) so the resolver and
 * branding rules stay analyzer-specific. Kept in its own file to keep
 * AnalyzerController under the file-size limit.
 */

import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { AnalyzerPersistenceService } from './analyzer.persistence.service';
import { EmailService } from '../email/email.service';

interface SendBody {
  shareToken: string;
  recipientEmail: string;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

@Controller('api/analyzer/share')
export class AnalyzerShareEmailController {
  private readonly logger = new Logger(AnalyzerShareEmailController.name);

  constructor(
    private readonly persistence: AnalyzerPersistenceService,
    private readonly emailService: EmailService,
  ) {}

  /** POST /api/analyzer/share/email */
  @UseGuards(JwtAuthGuard)
  @Post('email')
  async sendEmail(
    @AuthUserId() userId: string,
    @Body() body: SendBody,
  ): Promise<{ success: boolean; error?: string }> {
    if (!body.shareToken || !body.recipientEmail) {
      throw new HttpException(
        'shareToken and recipientEmail are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!SHARE_TOKEN_RE.test(body.shareToken)) {
      throw new HttpException('Invalid share token', HttpStatus.BAD_REQUEST);
    }
    if (!EMAIL_RE.test(body.recipientEmail)) {
      throw new HttpException('Invalid email address', HttpStatus.BAD_REQUEST);
    }

    try {
      const row = await this.persistence.getShared(body.shareToken);
      if (!row) {
        throw new HttpException('Share not found', HttpStatus.NOT_FOUND);
      }
      const branding = await this.persistence.getSharedBranding(
        body.shareToken,
      );

      const heading =
        row.label || `${row.address_city ?? ''}, ${row.address_state ?? ''}`;
      const accentColor = branding?.accent_color || '#3949AB';
      const orgName = branding?.org_name || 'PropertyIQ';
      const showPoweredBy = branding?.powered_by_visible !== false;
      const shareUrl = `${process.env.FRONTEND_URL || 'https://propertyiq.app'}/shared/analysis/${body.shareToken}`;

      const messageSection = body.message
        ? `<p style="font-size:14px;color:#475569;background:#f1f5f9;padding:12px 16px;border-radius:8px;margin:16px 0;">"${escapeHtml(body.message)}"</p>`
        : '';

      const poweredBy = showPoweredBy
        ? `<p style="text-align:center;font-size:12px;color:#94a3b8;margin-top:24px;">Sent via <a href="https://propertyiq.app" style="color:#3949AB;font-weight:600;">PropertyIQ</a></p>`
        : '';

      const html = `
        <div style="max-width:560px;margin:0 auto;font-family:Roboto,Arial,sans-serif;">
          <div style="background:linear-gradient(145deg,${darken(accentColor)},${accentColor});border-radius:16px;padding:32px;color:#fff;margin-bottom:24px;">
            <p style="font-size:13px;color:#C5CAE9;margin:0 0 16px;letter-spacing:0.02em;">${escapeHtml(orgName)}</p>
            <h1 style="font-size:24px;font-weight:800;margin:0 0 4px;color:#fff;">${escapeHtml(heading)}</h1>
            <p style="font-size:14px;color:#C5CAE9;margin:0;">Deal Analysis</p>
          </div>
          ${messageSection}
          <a href="${shareUrl}" style="display:block;text-align:center;background:${accentColor};color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none;font-weight:600;font-size:16px;">View Full Analysis</a>
          <p style="text-align:center;font-size:12px;color:#64748b;margin-top:16px;">The link includes interactive grading, strategy comparison, and a downloadable PDF.</p>
          ${poweredBy}
        </div>
      `;

      const sent = await this.emailService.sendEmail({
        to: body.recipientEmail,
        subject: `${orgName}: Deal Analysis for ${heading}`,
        html,
        emailType: 'analyzer_share',
        userId,
        metadata: { shareToken: body.shareToken, heading },
      });

      if (!sent) {
        throw new HttpException(
          'Failed to send email',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return { success: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : 'send failed';
      this.logger.error(`analyzer share email failed: ${msg}`);
      return { success: false, error: msg };
    }
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Approximate "10% darker" sibling of a hex color, used for the gradient header. */
function darken(hex: string): string {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 26);
  const g = Math.max(0, ((n >> 8) & 0xff) - 26);
  const b = Math.max(0, (n & 0xff) - 26);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
