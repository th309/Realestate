import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmailService } from '../email/email.service';

interface CreateTicketDto {
  userId: string;
  userEmail: string;
  issueType: string;
  description: string;
  emailOverride?: string;
  name?: string;
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  async createTicket(dto: CreateTicketDto) {
    const contactEmail = dto.emailOverride || dto.userEmail;

    const { data, error } = await this.supabase.getClient()
      .from('support_tickets')
      .insert({
        user_id: dto.userId,
        user_email: contactEmail,
        issue_type: dto.issueType,
        description: dto.description,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create support ticket: ${error.message}`);
      throw error;
    }

    await this.sendNotificationEmail(dto, contactEmail);

    return data;
  }

  private async sendNotificationEmail(
    dto: CreateTicketDto,
    contactEmail: string,
  ): Promise<void> {
    const senderName = dto.name || 'Anonymous';
    const subject = `New Contact Form Submission: ${dto.issueType}`;
    const html = `
      <h2>New Contact Form Submission</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr><td style="padding:8px;font-weight:bold;">Name</td><td style="padding:8px;">${this.escapeHtml(senderName)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${this.escapeHtml(contactEmail)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;">Issue Type</td><td style="padding:8px;">${this.escapeHtml(dto.issueType)}</td></tr>
      </table>
      <h3>Message</h3>
      <p style="white-space:pre-wrap;">${this.escapeHtml(dto.description)}</p>
    `;

    const sent = await this.emailService.sendEmail({
      to: 'info@propertyiq.app',
      subject,
      html,
      emailType: 'contact_form_submission',
      metadata: {
        senderName,
        senderEmail: contactEmail,
        issueType: dto.issueType,
      },
    });

    if (!sent) {
      this.logger.warn('Failed to send contact form notification email');
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
