/**
 * Health Controller
 *
 * Exposes API endpoints for monitoring data health:
 * - GET /api/health - Simple healthcheck for Railway
 * - GET /api/health/data-cards - Check all 54 data card metrics
 * - GET /api/health/data-sources - Check data source availability
 * - GET /api/health/pipeline-runs - Get recent pipeline runs
 * - GET /api/health/data-alerts - Get active alerts
 * - POST /api/health/pipeline-status - Accept pipeline status reports (API key protected)
 * - POST /api/health/data-alerts/:id/acknowledge - Acknowledge an alert
 * - POST /api/health/data-alerts/:id/resolve - Resolve an alert
 * - POST /api/pipelines/:name/trigger - Trigger a pipeline manually
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  Inject,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { DataCardsHealthService } from './data-cards-health.service';
import { DataSourcesHealthService } from './data-sources-health.service';
import { PipelineRunsService } from './pipeline-runs.service';
import { DataAlertsService } from './data-alerts.service';
import { PipelineApiKeyGuard } from '../common/guards/pipeline-api-key.guard';
import { PipelineStatusDto } from './dto/pipeline-status.dto';

@ApiTags('health')
@Controller('api/health')
export class HealthController {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly dataCardsHealth: DataCardsHealthService,
    private readonly dataSourcesHealth: DataSourcesHealthService,
    private readonly pipelineRuns: PipelineRunsService,
    private readonly dataAlerts: DataAlertsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Simple healthcheck for Railway' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    const response: {
      status: string;
      timestamp: string;
      database?: string;
    } = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    // Quick database connectivity check
    try {
      const { error } = await this.supabase.from('markets').select('id').limit(1);
      response.database = error ? 'error' : 'connected';
    } catch {
      response.database = 'error';
    }

    return response;
  }

  @Get('data-cards')
  @ApiOperation({ summary: 'Check health of all data card metrics' })
  @ApiResponse({ status: 200, description: 'Health check results for all 54 metrics' })
  async checkDataCards() {
    return this.dataCardsHealth.checkAllMetrics();
  }

  @Get('data-sources')
  @ApiOperation({ summary: 'Check availability of data sources' })
  @ApiResponse({ status: 200, description: 'Health check results for all data sources' })
  async checkDataSources() {
    return this.dataSourcesHealth.checkAllSources();
  }

  @Get('pipeline-runs')
  @ApiOperation({ summary: 'Get recent pipeline runs' })
  @ApiQuery({ name: 'hours', required: false, description: 'Hours to look back (default: 72)' })
  @ApiResponse({ status: 200, description: 'List of recent pipeline runs' })
  async getPipelineRuns(@Query('hours') hours?: string) {
    const hoursNum = hours ? parseInt(hours, 10) : 72;
    return this.pipelineRuns.getRecentRuns(hoursNum);
  }

  @Post('pipeline-status')
  @HttpCode(200)
  @UseGuards(PipelineApiKeyGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Accept pipeline status report from import scripts' })
  @ApiResponse({ status: 200, description: 'Pipeline status recorded' })
  @ApiResponse({ status: 401, description: 'Invalid or missing pipeline API key' })
  async reportPipelineStatus(@Body() statusReport: PipelineStatusDto) {
    return this.pipelineRuns.recordPipelineStatus(statusReport);
  }

  @Get('data-alerts')
  @ApiOperation({ summary: 'Get data alerts' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'severity', required: false, description: 'Filter by severity' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by alert type' })
  @ApiResponse({ status: 200, description: 'List of data alerts' })
  async getDataAlerts(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('type') type?: string,
  ) {
    return this.dataAlerts.getAlerts({ status, severity, type });
  }

  @Post('data-alerts/:id/acknowledge')
  @HttpCode(200)
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged successfully' })
  async acknowledgeAlert(@Param('id') id: string, @Body() body?: { userId?: string }) {
    return this.dataAlerts.acknowledgeAlert(id, body?.userId);
  }

  @Post('data-alerts/:id/resolve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Resolve an alert' })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully' })
  async resolveAlert(
    @Param('id') id: string,
    @Body() body?: { userId?: string; notes?: string },
  ) {
    return this.dataAlerts.resolveAlert(id, body?.userId, body?.notes);
  }
}

@ApiTags('pipelines')
@Controller('api/pipelines')
export class PipelinesController {
  constructor(private readonly pipelineRuns: PipelineRunsService) {}

  @Post(':name/trigger')
  @HttpCode(200)
  @ApiOperation({ summary: 'Trigger a pipeline manually' })
  @ApiResponse({ status: 200, description: 'Pipeline trigger queued' })
  async triggerPipeline(@Param('name') name: string) {
    return this.pipelineRuns.triggerPipeline(name);
  }
}
