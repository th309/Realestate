import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BenchmarksService } from './benchmarks.service';

const VALID_GEO_LEVELS = ['metro', 'county', 'zip'];

@ApiTags('benchmarks')
@Controller('api/benchmarks')
export class BenchmarksController {
  constructor(private readonly benchmarksService: BenchmarksService) {}

  @Get(':geoLevel/:geoId')
  @ApiOperation({
    summary:
      'Compare a geography\'s metric values against its parent geography',
  })
  @ApiParam({ name: 'geoLevel', enum: VALID_GEO_LEVELS })
  @ApiParam({
    name: 'geoId',
    description: 'Geography identifier (CBSA code, FIPS, ZIP, etc.)',
  })
  @ApiQuery({
    name: 'metrics',
    required: false,
    description:
      'Comma-separated list of metric IDs (e.g. cap_rate,gross_yield)',
  })
  async getBenchmarks(
    @Param('geoLevel') geoLevel: string,
    @Param('geoId') geoId: string,
    @Query('metrics') metricsParam?: string,
  ) {
    if (!VALID_GEO_LEVELS.includes(geoLevel)) {
      throw new HttpException(
        `Invalid geoLevel: ${geoLevel}. Must be one of: ${VALID_GEO_LEVELS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const metrics =
      metricsParam
        ?.split(',')
        .map((m) => m.trim())
        .filter(Boolean) || [];

    if (metrics.length === 0) {
      throw new HttpException(
        'At least one metric is required via the "metrics" query parameter',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.benchmarksService.getBenchmarks(
      geoLevel as 'metro' | 'county' | 'zip',
      geoId,
      metrics,
    );
  }
}
