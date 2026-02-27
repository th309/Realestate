import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { OverviewAnalyticsService } from './overview-analytics.service';
import { JourneyAnalyticsService } from './journey-analytics.service';
import { RetentionAnalyticsService } from './retention-analytics.service';
import { AcquisitionAnalyticsService } from './acquisition-analytics.service';
import { ConversionAnalyticsService } from './conversion-analytics.service';
import { FunnelEngineService } from './funnel-engine.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AnalyticsQueryDto,
  CreateAnnotationDto,
  CreateFunnelDto,
} from './dto/analytics-query.dto';
import type { AnalyticsFilters } from './user-analytics.types';

@UseGuards(AdminGuard)
@Controller('api/admin/analytics')
export class UserAnalyticsController {
  private readonly logger = new Logger(UserAnalyticsController.name);

  constructor(
    private readonly overview: OverviewAnalyticsService,
    private readonly journeys: JourneyAnalyticsService,
    private readonly retention: RetentionAnalyticsService,
    private readonly acquisition: AcquisitionAnalyticsService,
    private readonly conversion: ConversionAnalyticsService,
    private readonly funnelEngine: FunnelEngineService,
    private readonly supabase: SupabaseService,
  ) {}

  private parseFilters(query: AnalyticsQueryDto): {
    days: number;
    filters: AnalyticsFilters;
  } {
    const days = parseInt(query.days || '30', 10);
    const filters: AnalyticsFilters = {};
    if (query.tier) filters.tier = query.tier;
    if (query.device) filters.device = query.device;
    if (query.source) filters.source = query.source;
    if (query.startDate) filters.startDate = query.startDate;
    if (query.endDate) filters.endDate = query.endDate;
    return { days, filters };
  }

  @Get('overview')
  async getOverview(@Query() query: AnalyticsQueryDto) {
    const { days, filters } = this.parseFilters(query);
    return this.overview.getOverview(days, filters);
  }

  @Get('journeys')
  async getJourneys(@Query() query: AnalyticsQueryDto) {
    const { days, filters } = this.parseFilters(query);
    return this.journeys.getJourneys(days, filters);
  }

  @Get('retention')
  async getRetention(@Query() query: AnalyticsQueryDto) {
    const { days, filters } = this.parseFilters(query);
    return this.retention.getRetention(days, filters);
  }

  @Get('acquisition')
  async getAcquisition(@Query() query: AnalyticsQueryDto) {
    const { days, filters } = this.parseFilters(query);
    return this.acquisition.getAcquisition(days, filters);
  }

  @Get('conversion')
  async getConversion(@Query() query: AnalyticsQueryDto) {
    const { days, filters } = this.parseFilters(query);
    return this.conversion.getConversion(days, filters);
  }

  @Post('annotations')
  async createAnnotation(@Body() body: CreateAnnotationDto) {
    const client = this.supabase.getClient();
    const { error } = await client.from('analytics_annotations').insert({
      annotation_date: body.annotation_date,
      label: body.label,
      description: body.description || null,
    });
    if (error) throw new Error(`Failed to create annotation: ${error.message}`);
    return { success: true };
  }

  @Get('annotations')
  async getAnnotations(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const client = this.supabase.getClient();
    let q = client
      .from('analytics_annotations')
      .select('*')
      .order('annotation_date', { ascending: true });
    if (startDate) q = q.gte('annotation_date', startDate);
    if (endDate) q = q.lte('annotation_date', endDate);
    const { data } = await q;
    return data || [];
  }

  @Post('funnels')
  async createFunnel(@Body() body: CreateFunnelDto) {
    const client = this.supabase.getClient();
    const { error } = await client.from('funnel_definitions').insert({
      name: body.name,
      steps: body.steps,
    });
    if (error) throw new Error(`Failed to create funnel: ${error.message}`);
    return { success: true };
  }

  @Get('funnels/:id')
  async evaluateFunnel(@Param('id') id: string, @Query('days') days: string) {
    return this.funnelEngine.evaluateFunnel(id, parseInt(days || '30', 10));
  }
}
