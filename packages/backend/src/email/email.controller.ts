import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { EmailService } from './email.service';

@UseGuards(JwtAuthGuard)
@Controller('api/email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Get('preferences')
  async getPreferences(@AuthUserId() userId: string) {
    return this.emailService.getPreferences(userId);
  }

  @Patch('preferences')
  async updatePreferences(
    @AuthUserId() userId: string,
    @Body()
    body: {
      weekly_digest?: boolean;
      alert_emails?: boolean;
      marketing?: boolean;
    },
  ) {
    const result = await this.emailService.updatePreferences(userId, body);
    if (!result) {
      throw new HttpException(
        'Failed to update preferences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return result;
  }
}
