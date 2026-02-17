import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MarketSnapshotService } from './market-snapshot.service';

const VALID_GEO_TYPES = ['metro', 'county', 'zip', 'state'];

@ApiTags('market-snapshot')
@Controller('api/market-snapshot')
export class MarketSnapshotController {
  constructor(private readonly marketSnapshotService: MarketSnapshotService) {}

  @Get(':geoType/:geoId')
  @ApiOperation({ summary: 'Get all metric values + scores for a single region' })
  @ApiParam({ name: 'geoType', enum: VALID_GEO_TYPES })
  @ApiParam({ name: 'geoId', description: 'Region identifier (CBSA code, FIPS, ZIP, etc.)' })
  @ApiQuery({ name: 'state', required: false, description: 'State filter (for county/zip)' })
  async getSnapshot(
    @Param('geoType') geoType: string,
    @Param('geoId') geoId: string,
    @Query('state') state?: string,
  ) {
    if (!VALID_GEO_TYPES.includes(geoType)) {
      throw new HttpException(
        `Invalid geoType: ${geoType}. Must be one of: ${VALID_GEO_TYPES.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.marketSnapshotService.getSnapshot(
      geoType as 'metro' | 'county' | 'zip' | 'state',
      geoId,
      state,
    );
  }
}
