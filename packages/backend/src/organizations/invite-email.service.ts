/**
 * Invite Email Service
 *
 * Handles composing and sending organization invite emails.
 * Extracted from MembersService to keep file sizes under the 300-line limit.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';

@Injectable()
export class InviteEmailService {
  private readonly logger = new Logger(InviteEmailService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send an invite email to a prospective organization member.
   * Skips silently (with a log) if FRONTEND_URL is not configured.
   */
  async sendInviteEmail(
    email: string,
    orgName: string,
    token: string,
  ): Promise<void> {
    const appUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('NEXT_PUBLIC_APP_URL');
    if (!appUrl) {
      this.logger.error(
        'FRONTEND_URL or NEXT_PUBLIC_APP_URL is not configured',
      );
      return;
    }
    const inviteUrl = `${appUrl}/org/invite/${token}`;

    await this.emailService.sendEmail({
      to: email,
      subject: `You're invited to join ${orgName} on PropertyIQ`,
      html: [
        `<p>You've been invited to join <strong>${orgName}</strong> on PropertyIQ.</p>`,
        `<p><a href="${inviteUrl}">Accept Invitation</a></p>`,
        `<p>This invite expires in 7 days.</p>`,
      ].join(''),
      emailType: 'org_invite',
      metadata: { orgName, token },
    });
  }
}
