import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { SupportService } from './support.service';

@Controller('api/support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Post('tickets')
  async createTicket(
    @Body() body: { issue_type: string; description: string; email_override?: string },
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
      emailOverride: body.email_override,
    });

    return { success: true };
  }
}
