import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ScreenerService, ScreenerResult } from './screener.service';
import { ScreenerQueryDto } from './screener.dto';

const VALID_GEO_LEVELS = ['metro', 'county', 'zip'] as const;
type GeoLevel = (typeof VALID_GEO_LEVELS)[number];

@ApiTags('screener')
@Controller('api/screener')
export class ScreenerController {
  constructor(private readonly screenerService: ScreenerService) {}

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
    ],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
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
  ): Promise<ScreenerResult> {
    const lower = geo.toLowerCase();
    if (!(VALID_GEO_LEVELS as readonly string[]).includes(lower)) {
      throw new HttpException(
        `Invalid geo: ${geo}. Valid values: ${VALID_GEO_LEVELS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.screenerService.queryScreener(lower as GeoLevel, dto);
  }
}
