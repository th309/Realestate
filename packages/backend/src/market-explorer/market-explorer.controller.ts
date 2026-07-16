import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { MarketExplorerService } from './market-explorer.service';
import { ScopeQueryDto, SCOPE_GEO_LEVELS } from './market-explorer.dto';
import { ScopeSeriesResponse } from './market-explorer.types';

@ApiTags('market-explorer')
@Controller('api/market-explorer')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MarketExplorerController {
  constructor(private readonly service: MarketExplorerService) {}

  @Get('scope/:geoLevel')
  @ApiOperation({
    summary:
      'One metric across all child regions of a scope, aligned to a shared monthly axis',
  })
  @ApiParam({ name: 'geoLevel', enum: [...SCOPE_GEO_LEVELS] })
  async getScope(
    @Param('geoLevel') geoLevel: string,
    @Query() dto: ScopeQueryDto,
  ): Promise<ScopeSeriesResponse> {
    const level = geoLevel.toLowerCase();
    if (!(SCOPE_GEO_LEVELS as readonly string[]).includes(level)) {
      throw new HttpException(
        `Invalid geoLevel: ${geoLevel}. Valid: ${SCOPE_GEO_LEVELS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.service.getScopeSeries(level, dto);
  }
}
