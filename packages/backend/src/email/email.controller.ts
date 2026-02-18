import {
  Controller,
  Get,
  Patch,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('preferences')
  async getPreferences(@Headers('x-user-id') userId: string) {
    if (!userId)
      throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
    return this.emailService.getPreferences(userId);
  }

  @Patch('preferences')
  async updatePreferences(
    @Headers('x-user-id') userId: string,
    @Body()
    body: {
      weekly_digest?: boolean;
      alert_emails?: boolean;
      marketing?: boolean;
    },
  ) {
    if (!userId)
      throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
    const result = await this.emailService.updatePreferences(userId, body);
    if (!result)
      throw new HttpException(
        'Failed to update preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    return result;
  }
}
