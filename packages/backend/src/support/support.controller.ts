import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { SupportService } from './support.service';

interface CreateTicketBody {
  issue_type: string;
  description: string;
  email_override?: string;
  name?: string;
  email?: string;
}

@Controller('api/support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Post('tickets')
  async createTicket(
    @Body() body: CreateTicketBody,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-email') userEmail: string,
  ) {
    if (!body.issue_type || !body.description) {
      throw new BadRequestException('issue_type and description are required');
    }

    await this.service.createTicket({
      userId: userId || 'anonymous',
      userEmail: userEmail || '',
      issueType: body.issue_type,
      description: body.description,
      emailOverride: body.email_override || body.email,
      name: body.name,
    });

    return { success: true };
  }
}
