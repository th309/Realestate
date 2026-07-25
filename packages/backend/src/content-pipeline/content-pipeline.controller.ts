import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { ContentRunsService } from './content-runs.service';
import { ContentPipelineQueriesService } from './content-pipeline-queries.service';
import { PipelineSettingsService } from './pipeline-settings.service';
import { ContentDataService } from './data/content-data.service';
import { MetroHeroImageService } from './metro-hero-image.service';
import { PerformanceService } from './analytics/performance.service';
import { SuggestedRunsService } from './analytics/suggested-runs.service';
import { MoversResolveQueryDto } from './dto/movers-resolve.dto';
import {
  PerformanceOverviewQueryDto,
  PerformanceRunsQueryDto,
} from './dto/performance-query.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateFormatDefaultDto } from './dto/update-format-default.dto';
import { TriggerTestMagnetDto } from './dto/trigger-test-magnet.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { isContentFormat } from './dto/content-format';

/**
 * Content-pipeline admin: dashboard, performance, movers, settings, and misc
 * triggers. The RUN lifecycle routes (create/resolve + every runs/:id action)
 * live in ContentPipelineRunsController on the same prefix (split for §1.3).
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline')
export class ContentPipelineController {
  constructor(
    private readonly runs: ContentRunsService,
    private readonly queries: ContentPipelineQueriesService,
    private readonly settingsService: PipelineSettingsService,
    private readonly contentData: ContentDataService,
    private readonly metroHeroImages: MetroHeroImageService,
    private readonly performance: PerformanceService,
    private readonly suggestions: SuggestedRunsService,
  ) {}

  @Get('health')
  async health() {
    return { success: true, data: { status: 'ok' } };
  }

  @Get('dashboard')
  async dashboard(@Query() q: DashboardQueryDto) {
    return {
      success: true,
      data: await this.queries.getDashboard({ batchId: q.batchId }),
    };
  }

  @Get('movers/resolve')
  async resolveMovers(@Query() q: MoversResolveQueryDto) {
    const result = await this.contentData.getTopMovers(q.geo, q.windowDays, 25);
    return { success: true, data: result };
  }

  @Get('performance/overview')
  async performanceOverview(@Query() q: PerformanceOverviewQueryDto) {
    const sinceDays = q.sinceDays ?? 30;
    const [hero, conversion, hookPatterns, suggestedRuns] = await Promise.all([
      this.performance.getHeroCard(sinceDays),
      this.performance.getFormatConversion(sinceDays),
      this.performance.getHookPatterns(),
      this.suggestions.getSuggestions(),
    ]);
    return {
      success: true,
      data: {
        hero,
        formatConversion: conversion,
        hookPatterns,
        suggestedRuns,
      },
    };
  }

  @Get('performance/runs')
  async performanceRuns(@Query() q: PerformanceRunsQueryDto) {
    const rows = await this.performance.getRunsTable({
      sinceDays: q.sinceDays ?? 30,
      format: q.format,
      sort: q.sort,
      dir: q.dir,
      limit: q.limit,
    });
    return { success: true, data: { rows } };
  }

  /**
   * Long-form metro hero shots the operator can choose before submit (preview URLs only).
   */
  @Get('metro-hero-options/:cbsaCode')
  async metroHeroOptions(@Param('cbsaCode') cbsaCode: string) {
    const code = String(cbsaCode ?? '').trim();
    if (!/^\d{5}$/.test(code)) {
      throw new BadRequestException('cbsaCode must be a 5-digit CBSA code');
    }
    const options = this.metroHeroImages.listPublicOptionsForCbsa(code);
    return { success: true, data: { options } };
  }

  @Post('trigger-test-magnet')
  async triggerTestMagnet(
    @Req() req: { userId?: string },
    @Body() dto: TriggerTestMagnetDto,
  ) {
    if (!req.userId) {
      throw new BadRequestException('authenticated admin userId missing');
    }
    const result = await this.runs.triggerTestMagnet(req.userId, dto);
    return { success: true, data: result };
  }

  @Get('review/queue')
  async reviewQueue() {
    return { success: true, data: await this.queries.getReviewQueue() };
  }

  @Get('settings')
  async getSettings() {
    return { success: true, data: await this.settingsService.getSettings() };
  }

  @Patch('settings')
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return {
      success: true,
      data: await this.settingsService.updateSettings(dto),
    };
  }

  @Get('settings/voices')
  async voices() {
    return {
      success: true,
      data: { voices: await this.settingsService.getVoices() },
    };
  }

  @Patch('settings/formats/:format')
  async updateFormatDefault(
    @Param('format') format: string,
    @Body() dto: UpdateFormatDefaultDto,
  ) {
    if (!isContentFormat(format)) {
      throw new BadRequestException(`Unknown content format: ${format}`);
    }
    return {
      success: true,
      data: await this.settingsService.updateFormatDefault(format, dto),
    };
  }

  @Post('pause')
  async pause() {
    return { success: true, data: await this.settingsService.pause() };
  }

  @Post('resume')
  async resume() {
    return { success: true, data: await this.settingsService.resume() };
  }
}
