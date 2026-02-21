/**
 * Recommendations Controller
 *
 * REST endpoint for "markets to watch" recommendations.
 * Protected by JwtAuthGuard — userId is extracted from the validated JWT.
 */

import {
  Controller,
  Get,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { RecommendationsService } from './recommendations.service';

@UseGuards(JwtAuthGuard)
@Controller('api/recommendations')
export class RecommendationsController {
  private readonly logger = new Logger(RecommendationsController.name);

  constructor(private readonly service: RecommendationsService) {}

  /**
   * GET /api/recommendations/markets-to-watch
   */
  @Get('markets-to-watch')
  async getMarketsToWatch(@AuthUserId() userId: string) {
    this.logger.log(`GET /api/recommendations/markets-to-watch for user ${userId}`);

    try {
      const data = await this.service.getMarketsToWatch(userId);
      return { data };
    } catch (error) {
      this.logger.error(
        `Failed to get markets-to-watch: ${error.message}`,
      );
      throw new HttpException(
        'Failed to generate recommendations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
