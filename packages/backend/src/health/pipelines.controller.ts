/**
 * Pipelines Controller
 *
 * Exposes admin-only API endpoints for pipeline management:
 * - POST /api/pipelines/:name/trigger - Trigger a pipeline manually
 */

import { Controller, Post, Param, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { PipelineRunsService } from './pipeline-runs.service';

@UseGuards(AdminGuard)
@ApiTags('pipelines')
@Controller('api/pipelines')
export class PipelinesController {
  constructor(private readonly pipelineRuns: PipelineRunsService) {}

  @Post(':name/trigger')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger a pipeline manually (admin only)' })
  @ApiResponse({ status: 200, description: 'Pipeline trigger queued' })
  @ApiResponse({ status: 403, description: 'Admin access denied' })
  async triggerPipeline(@Param('name') name: string) {
    return this.pipelineRuns.triggerPipeline(name);
  }
}
