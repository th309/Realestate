import {
  Controller,
  Get,
  Header,
  HttpException,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  ScoringHeatmapService,
  ScoreHeatmapPayload,
} from './scoring-heatmap.service';

/**
 * Public (ungated) packed score history powering the Market Momentum Map
 * widget. `heatmap/:geography` is a literal 2-segment path on api/scores —
 * safe beside ScoringController's `:geography/:locationId` catch-all because
 * this controller is registered BEFORE it in ScoringModule.
 */
@ApiTags('scores')
@Controller('api/scores')
export class ScoringHeatmapController {
  constructor(private readonly heatmapService: ScoringHeatmapService) {}

  @Get('heatmap/:geography')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({
    summary:
      'Full packed PropertyIQ score history (all months, all regions) for heatmap widgets',
  })
  @ApiParam({ name: 'geography', enum: ['metro'] })
  async getHeatmap(
    @Param('geography') geography: string,
  ): Promise<ScoreHeatmapPayload> {
    if (geography !== 'metro') {
      throw new HttpException(
        `Unsupported geography '${geography}' — only 'metro' is available`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.heatmapService.getMetroHeatmap();
  }
}
