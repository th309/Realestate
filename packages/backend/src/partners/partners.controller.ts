import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { PartnersService } from './partners.service';

@Controller('api/partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  /**
   * Get partner recommendations for given context types.
   * Primarily for testing/admin use.
   *
   * GET /api/partners/recommendations?context_types=affordability,timing
   */
  @Get('recommendations')
  async getRecommendations(
    @Query('context_types') contextTypesParam?: string,
    @Query('geography_type') geographyType?: string,
    @Query('geography_id') geographyId?: string,
    @Query('user_tier') userTier?: string,
  ) {
    if (!contextTypesParam) {
      throw new HttpException(
        'context_types query parameter is required (comma-separated)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const contextTypes = contextTypesParam
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (contextTypes.length === 0) {
      throw new HttpException(
        'At least one context_type is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.partnersService.getRecommendationsForReport(contextTypes, {
      geographyType,
      geographyId,
      userTier,
    });
  }
}
