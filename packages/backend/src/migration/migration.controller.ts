import {
  Controller,
  Get,
  Param,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MigrationService } from './migration.service';
import { GetFlowsParamsDto, GetFlowsQueryDto } from './dto/get-flows.dto';

@Controller('api/migration')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MigrationController {
  constructor(private readonly service: MigrationService) {}

  @Get('flows/:source/:fips')
  async getFlows(
    @Param() params: GetFlowsParamsDto,
    @Query() query: GetFlowsQueryDto,
  ) {
    return this.service.getFlows(
      params.source,
      params.fips,
      query.direction,
      query.limit,
    );
  }
}
