import { Injectable, Logger } from '@nestjs/common';
import { ContactFormNotification } from '@propertyiq/emails';
import React from 'react';
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

    const { data, error } = await this.supabase
      .getClient()
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

    const react = React.createElement(ContactFormNotification, {
      name: senderName,
      email: contactEmail,
      issueType: dto.issueType,
      description: dto.description,
    });

    const sent = await this.emailService.sendEmail({
      to: 'info@propertyiq.app',
      subject,
      react,
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
}
