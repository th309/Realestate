import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreateTicketDto {
  userId: string;
  userEmail: string;
  issueType: string;
  description: string;
  emailOverride?: string;
}

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async createTicket(dto: CreateTicketDto) {
    const { data, error } = await this.supabase.getClient()
      .from('support_tickets')
      .insert({
        user_id: dto.userId,
        user_email: dto.emailOverride || dto.userEmail,
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

    return data;
  }
}
