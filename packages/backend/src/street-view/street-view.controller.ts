import { Controller, Get, Query } from '@nestjs/common';
import { ResolveStreetViewDto } from './dto/resolve-street-view.dto';
import {
  StreetViewService,
  type StreetViewResolution,
} from './street-view.service';

@Controller('api/street-view')
export class StreetViewController {
  constructor(private readonly streetView: StreetViewService) {}

  @Get('resolve')
  async resolve(
    @Query() query: ResolveStreetViewDto,
  ): Promise<StreetViewResolution> {
    return this.streetView.resolve(query.lat, query.lon);
  }
}
