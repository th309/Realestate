/**
 * Recommendations Controller
 *
 * REST endpoint for "markets to watch" recommendations.
 * User ID is extracted from the x-user-id header.
 */

import {
  Controller,
  Get,
  Headers,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';

@Controller('api/recommendations')
export class RecommendationsController {
  private readonly logger = new Logger(RecommendationsController.name);

  constructor(private readonly service: RecommendationsService) {}

  /**
   * GET /api/recommendations/markets-to-watch
   *
   * Returns a list of recommended markets based on the authenticated
   * user's watchlist and top PropertyIQ homeready scores.
   */
  @Get('markets-to-watch')
  async getMarketsToWatch(@Headers('x-user-id') userId: string) {
    this.logger.log(`GET /api/recommendations/markets-to-watch for user ${userId}`);

    if (!userId) {
      throw new HttpException(
        'x-user-id header is required',
        HttpStatus.UNAUTHORIZED,
      );
    }

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
