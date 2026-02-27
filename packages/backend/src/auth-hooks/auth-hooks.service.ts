import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import React from 'react';
import { EmailService } from '../email/email.service';
import { EmailVerification, PasswordReset } from '@propertyiq/emails';
import { SupabaseEmailHookPayload } from './auth-hooks.types';

interface EmailTemplate {
  subject: string;
  react: React.ReactElement;
}

@Injectable()
export class AuthHooksService {
  private readonly logger = new Logger(AuthHooksService.name);
  private readonly supabaseUrl: string;

  constructor(
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {
    this.supabaseUrl = this.config.getOrThrow<string>('SUPABASE_URL');
  }

  async handleEmailHook(payload: SupabaseEmailHookPayload): Promise<void> {
    const { user, email_data } = payload;
    const { token_hash, redirect_to, email_action_type } = email_data;

    const confirmationUrl = this.buildConfirmationUrl(
      token_hash,
      email_action_type,
      redirect_to,
    );

    const userName =
      (user.user_metadata?.full_name as string) || user.email.split('@')[0];

    const { subject, react } = this.buildEmailTemplate(
      email_action_type,
      userName,
      confirmationUrl,
    );

    const sent = await this.emailService.sendEmail({
      to: user.email,
      subject,
      react,
      userId: user.id,
      emailType: `auth_hook_${email_action_type}`,
      metadata: { email_action_type, redirect_to },
    });

    if (sent) {
      this.logger.log(`Sent ${email_action_type} email to ${user.email}`);
    } else {
      // Log but don't throw — we prefer no email over Supabase's default templates
      this.logger.error(
        `Failed to send ${email_action_type} email to ${user.email}`,
      );
    }
  }

  private buildConfirmationUrl(
    tokenHash: string,
    actionType: string,
    redirectTo: string,
  ): string {
    const verifyType = actionType === 'magic_link' ? 'magiclink' : actionType;
    const url = new URL(`${this.supabaseUrl}/auth/v1/verify`);
    url.searchParams.set('token', tokenHash);
    url.searchParams.set('type', verifyType);
    url.searchParams.set('redirect_to', redirectTo);
    return url.toString();
  }

  private buildEmailTemplate(
    actionType: string,
    name: string,
    confirmationUrl: string,
  ): EmailTemplate {
    switch (actionType) {
      case 'recovery':
        return {
          subject: 'Reset your PropertyIQ password',
          react: React.createElement(PasswordReset, {
            name,
            resetUrl: confirmationUrl,
            expiresIn: '1 hour',
          }),
        };

      case 'signup':
        return {
          subject: 'Verify your PropertyIQ email',
          react: React.createElement(EmailVerification, {
            name,
            verificationUrl: confirmationUrl,
          }),
        };

      case 'magic_link':
        return {
          subject: 'Your PropertyIQ sign-in link',
          react: React.createElement(EmailVerification, {
            name,
            verificationUrl: confirmationUrl,
          }),
        };

      case 'email_change':
        return {
          subject: 'Confirm your new email',
          react: React.createElement(EmailVerification, {
            name,
            verificationUrl: confirmationUrl,
          }),
        };

      case 'invite':
        return {
          subject: "You've been invited to PropertyIQ",
          react: React.createElement(EmailVerification, {
            name,
            verificationUrl: confirmationUrl,
          }),
        };

      default:
        this.logger.warn(
          `Unknown email action type: ${actionType}, using verification template`,
        );
        return {
          subject: 'PropertyIQ email verification',
          react: React.createElement(EmailVerification, {
            name,
            verificationUrl: confirmationUrl,
          }),
        };
    }
  }
}
