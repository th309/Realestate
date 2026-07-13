/**
 * Push Controller
 *
 * REST endpoints for registering/removing Web Push subscriptions.
 * Protected by JwtAuthGuard — userId is extracted from the validated JWT.
 */

import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { PushSubscriptionsDataService } from './push-subscriptions.data';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto';

@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(private readonly subscriptions: PushSubscriptionsDataService) {}

  /**
   * Register (or refresh) a push subscription for the authenticated user.
   * POST /push/subscriptions
   */
  @Post('subscriptions')
  async subscribe(@AuthUserId() userId: string, @Body() dto: SubscribePushDto) {
    try {
      await this.subscriptions.upsert(
        userId,
        dto.endpoint,
        dto.keys.p256dh,
        dto.keys.auth,
        dto.userAgent,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to save push subscription: ${error instanceof Error ? error.message : error}`,
      );
      throw new HttpException(
        'Failed to save push subscription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Remove a push subscription for the authenticated user.
   * DELETE /push/subscriptions
   */
  @Delete('subscriptions')
  async unsubscribe(
    @AuthUserId() userId: string,
    @Body() dto: UnsubscribePushDto,
  ) {
    try {
      await this.subscriptions.removeByEndpoint(userId, dto.endpoint);
      return { success: true };
    } catch (error) {
      this.logger.error(
        `Failed to remove push subscription: ${error instanceof Error ? error.message : error}`,
      );
      throw new HttpException(
        'Failed to remove push subscription',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
