import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  userId?: string;
  emailType: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey: string | undefined;
  private readonly fromEmail: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {
    this.resendApiKey = this.config.get('RESEND_API_KEY');
    this.fromEmail =
      this.config.get('EMAIL_FROM') || 'PropertyIQ <noreply@propertyiq.io>';
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      if (this.resendApiKey) {
        // Use Resend API
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.fromEmail,
            to: [options.to],
            subject: options.subject,
            html: options.html,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          this.logger.error(`Resend API error: ${error}`);
          return false;
        }
      } else {
        // Dev mode: log only
        this.logger.log(
          `[DEV] Would send email to ${options.to}: ${options.subject}`,
        );
      }

      // Log the send
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
