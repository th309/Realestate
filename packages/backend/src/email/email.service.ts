import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import React from 'react';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

/**
 * Ensures the from address includes a display name.
 * Bare emails like "info@propertyiq.app" → "PropertyIQ <info@propertyiq.app>"
 * Already formatted like "PropertyIQ <noreply@...>" passes through unchanged.
 */
function normalizeFromEmail(from: string): string {
  if (from.includes('<')) return from;
  return `PropertyIQ <${from.trim()}>`;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  react?: React.ReactElement;
  userId?: string;
  emailType: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey: string | undefined;
  private readonly fromEmail: string;
  private readonly resend: Resend | null;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {
    this.resendApiKey = this.config.get('RESEND_API_KEY');
    this.fromEmail = normalizeFromEmail(
      this.config.get('EMAIL_FROM') || 'PropertyIQ <noreply@propertyiq.app>',
    );
    this.resend = this.resendApiKey ? new Resend(this.resendApiKey) : null;
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      if (this.resend) {
        const { error } = await this.resend.emails.send({
          from: this.fromEmail,
          to: [options.to],
          subject: options.subject,
          react: options.react,
          html: options.react ? undefined : options.html,
        });

        if (error) {
          this.logger.error(`Resend SDK error: ${JSON.stringify(error)}`);
          return false;
        }
      } else {
        this.logger.log(
          `[DEV] Would send email to ${options.to}: ${options.subject}`,
        );
      }

      await this.logEmail(options);
      return true;
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      return false;
    }
  }

  private async logEmail(options: SendEmailOptions): Promise<void> {
    await this.supabase.from('email_log').insert({
      user_id: options.userId,
      email_type: options.emailType,
      subject: options.subject,
      metadata: options.metadata || {},
    });
  }

  async getPreferences(userId: string) {
    const { data } = await this.supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Return defaults if no preferences set
    return (
      data || { weekly_digest: true, alert_emails: true, marketing: false }
    );
  }

  async updatePreferences(
    userId: string,
    updates: {
      weekly_digest?: boolean;
      alert_emails?: boolean;
      marketing?: boolean;
    },
  ) {
    const { data, error } = await this.supabase
      .from('email_preferences')
      .upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to update preferences:', error);
      return null;
    }
    return data;
  }
}
