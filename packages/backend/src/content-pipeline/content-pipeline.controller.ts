import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { ContentPipelineService } from './content-pipeline.service';

@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline')
export class ContentPipelineController {
  constructor(private readonly service: ContentPipelineService) {}

  @Get('health')
  async health() {
    return { success: true, data: { status: 'ok' } };
  }
}
