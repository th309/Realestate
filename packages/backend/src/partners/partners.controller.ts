import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PartnersService } from './partners.service';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Controller('api/partners')
@UseGuards(OptionalJwtAuthGuard)
export class PartnersController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly entitlements: EntitlementsService,
  ) {}

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
    @Req() request?: any,
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

    // SECURITY: tier comes from the validated JWT identity (set by
    // OptionalJwtAuthGuard), never from a client `?user_tier` query. The old
    // query param let anyone request tier-restricted partner recommendations by
    // spoofing it — and omitting it skipped the tier filter entirely. Anonymous
    // callers resolve to `free`.
    const userId = request?.userId;
    const userTier = userId
      ? ((await this.entitlements.getUserTier(userId)) ?? 'free')
      : 'free';

    return this.partnersService.getRecommendationsForReport(contextTypes, {
      geographyType,
      geographyId,
      userTier,
    });
  }
}
