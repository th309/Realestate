import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { MetricsQueryService } from './services/metrics-query.service';
import { QueryMetricsDto } from './dto/query-metrics.dto';
import { AlertActionParamsDto } from './dto/alert-action.dto';

@Controller('api/admin/metrics')
@UseGuards(AdminGuard)
export class AdminMetricsController {
  constructor(private readonly queryService: MetricsQueryService) {}

  @Get('hero-stats')
  async getHeroStats() {
    const data = await this.queryService.getHeroStats();
    return { success: true, data };
  }

  @Get('health-history')
  async getHealthHistory(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      'admin_health_snapshots',
      query.from,
      query.to,
      query.source_name ? { source_name: query.source_name } : undefined,
    );
    return { success: true, data };
  }

  @Get('pipeline-history')
  async getPipelineHistory(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      'admin_health_snapshots',
      query.from,
      query.to,
    );
    return { success: true, data };
  }

  @Get('api-performance')
  async getApiPerformance(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      'admin_api_metrics',
      query.from,
      query.to,
      query.endpoint ? { endpoint: query.endpoint } : undefined,
    );
    return { success: true, data };
  }

  @Get('cache-performance')
  async getCachePerformance(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      'admin_cache_metrics',
      query.from,
      query.to,
    );
    return { success: true, data };
  }

  @Get('alerts')
  async getAlerts(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.getAlerts({
      severity: query.severity,
      status: query.status as 'active' | 'resolved' | undefined,
      from: query.from,
      to: query.to,
    });
    return { success: true, data };
  }

  @Post('alerts/:id/acknowledge')
  async acknowledgeAlert(@Param() params: AlertActionParamsDto) {
    const data = await this.queryService.acknowledgeAlert(params.id);
    return { success: true, data };
  }

  @Post('alerts/:id/resolve')
  async resolveAlert(@Param() params: AlertActionParamsDto) {
    const data = await this.queryService.resolveAlert(params.id);
    return { success: true, data };
  }

  @Get('score-history')
  async getScoreHistory(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      'admin_score_snapshots',
      query.from,
      query.to,
      query.score_type ? { score_type: query.score_type } : undefined,
    );
    return { success: true, data };
  }

  @Get('user-history')
  async getUserHistory(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      'admin_user_snapshots',
      query.from,
      query.to,
    );
    return { success: true, data };
  }

  @Get('page-views')
  async getPageViews(@Query() query: QueryMetricsDto) {
    const data = await this.queryService.queryTimeSeries(
      'admin_page_views',
      query.from,
      query.to,
    );
    return { success: true, data };
  }

  @Get('coverage')
  async getCoverage() {
    const data = await this.queryService.getCoverage();
    return { success: true, data };
  }
}
