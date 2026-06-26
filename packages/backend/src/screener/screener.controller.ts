import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  HttpException,
  HttpStatus,
  ForbiddenException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import {
  ScreenerService,
  ScreenerResult,
  ScreenerMoversResult,
} from './screener.service';
import {
  ScreenerQueryDto,
  ScreenerMoversQueryDto,
  MOVER_WINDOWS,
} from './screener.dto';
import { OptionalJwtAuthGuard } from '../common/guards';
import { EntitlementsService } from '../entitlements/entitlements.service';

const VALID_GEO_LEVELS = ['metro', 'county', 'zip'] as const;
type GeoLevel = (typeof VALID_GEO_LEVELS)[number];

// ZIP-level screener data is a Pro feature (matches the UI GeoLockCard + the
// map's ZIP gating); enforced server-side so it can't be pulled via the API.
const PRO_TIERS = ['pro', 'enterprise', 'admin'];

@ApiTags('screener')
@Controller('api/screener')
@UseGuards(OptionalJwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ScreenerController {
  constructor(
    private readonly screenerService: ScreenerService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * ZIP-level data requires Pro/Enterprise. OptionalJwtAuthGuard sets
   * `req.userId` from the Bearer token (anonymous => undefined => treated free).
   */
  private async assertGeoAllowed(
    geo: GeoLevel,
    userId: string | undefined,
  ): Promise<void> {
    if (geo !== 'zip') return;
    const tier =
      (userId ? await this.entitlements.getUserTier(userId) : null) ?? 'free';
    if (!PRO_TIERS.includes(tier)) {
      throw new ForbiddenException(
        'ZIP-level market screening requires a Pro or Enterprise subscription.',
      );
    }
  }

  /**
   * GET /api/screener/:geo/movers
   *
   * Top gainers + losers by PropertyIQ Score change over `window`.
   */
  @Get(':geo/movers')
  @ApiOperation({
    summary: 'Top score gainers and losers for a geography level',
  })
  @ApiParam({ name: 'geo', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({ name: 'window', enum: [...MOVER_WINDOWS] })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async queryMovers(
    @Param('geo') geo: string,
    @Query() dto: ScreenerMoversQueryDto,
    @Req() req: Request & { userId?: string },
  ): Promise<ScreenerMoversResult> {
    const lower = geo.toLowerCase();
    if (!(VALID_GEO_LEVELS as readonly string[]).includes(lower)) {
      throw new HttpException(
        `Invalid geo: ${geo}. Valid values: ${VALID_GEO_LEVELS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertGeoAllowed(lower as GeoLevel, req.userId);
    return this.screenerService.queryMovers(lower as GeoLevel, dto);
  }

  /**
   * GET /api/screener/:geo
   *
   * Returns a paginated, filtered, sorted slice of screener_snapshot.
   */
  @Get(':geo')
  @ApiOperation({ summary: 'Query screener snapshot for a geography level' })
  @ApiParam({ name: 'geo', enum: ['metro', 'county', 'zip'] })
  @ApiQuery({
    name: 'state',
    required: false,
    description: '2-letter state code (e.g. TX)',
  })
  @ApiQuery({ name: 'scoreMin', required: false, type: Number })
  @ApiQuery({ name: 'scoreMax', required: false, type: Number })
  @ApiQuery({ name: 'capRateMin', required: false, type: Number })
  @ApiQuery({ name: 'capRateMax', required: false, type: Number })
  @ApiQuery({ name: 'monthsOfSupplyMin', required: false, type: Number })
  @ApiQuery({ name: 'monthsOfSupplyMax', required: false, type: Number })
  @ApiQuery({ name: 'overvaluedMin', required: false, type: Number })
  @ApiQuery({ name: 'overvaluedMax', required: false, type: Number })
  @ApiQuery({ name: 'medianPriceMin', required: false, type: Number })
  @ApiQuery({ name: 'medianPriceMax', required: false, type: Number })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: [
      'score',
      'median_price',
      'cap_rate',
      'gross_yield',
      'rent_to_price_ratio',
      'grm',
      'months_of_supply',
      'overvalued_pct',
      'region_name',
      'score_chg_1m',
      'score_chg_3m',
      'score_chg_6m',
      'score_chg_1y',
      'score_chg_3y',
      'score_chg_5y',
    ],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({
    name: 'changeWindow',
    required: false,
    enum: ['1m', '3m', '6m', '1y', '3y', '5y'],
  })
  @ApiQuery({ name: 'changeMin', required: false, type: Number })
  @ApiQuery({ name: 'changeMax', required: false, type: Number })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '0-based page index',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Rows per page (default 50, max 100)',
  })
  async queryScreener(
    @Param('geo') geo: string,
    @Query() dto: ScreenerQueryDto,
    @Req() req: Request & { userId?: string },
  ): Promise<ScreenerResult> {
    const lower = geo.toLowerCase();
    if (!(VALID_GEO_LEVELS as readonly string[]).includes(lower)) {
      throw new HttpException(
        `Invalid geo: ${geo}. Valid values: ${VALID_GEO_LEVELS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertGeoAllowed(lower as GeoLevel, req.userId);
    return this.screenerService.queryScreener(lower as GeoLevel, dto);
  }
}
