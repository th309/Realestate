import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { ContentPipelineQueriesService } from '../content-pipeline-queries.service';

/**
 * Per-format read endpoints. Currently just sample-videos; will grow as
 * we expose format-level read APIs (per-format performance summary,
 * per-format archetype affinity, etc).
 *
 * Split out from the main content-pipeline.controller (which is at the
 * file-size limit) so the formats domain has its own place to grow.
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/formats')
export class FormatsController {
  constructor(private readonly queries: ContentPipelineQueriesService) {}

  @Get('sample-videos')
  async sampleVideos() {
    return {
      success: true,
      data: { samples: await this.queries.getFormatSampleVideos() },
    };
  }
}
