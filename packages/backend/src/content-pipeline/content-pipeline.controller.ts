import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { ContentRunsService } from './content-runs.service';
import { ContentPipelineQueriesService } from './content-pipeline-queries.service';
import { RunActionsService } from './run-actions.service';
import { RunThumbnailService } from './run-thumbnail.service';
import { PipelineSettingsService } from './pipeline-settings.service';
import { ContentDataService } from './data/content-data.service';
import { MetroHeroImageService } from './metro-hero-image.service';
import { PerformanceService } from './analytics/performance.service';
import { SuggestedRunsService } from './analytics/suggested-runs.service';
import { CreateRunDto } from './dto/create-run.dto';
import { MoversResolveQueryDto } from './dto/movers-resolve.dto';
import {
  PerformanceOverviewQueryDto,
  PerformanceRunsQueryDto,
} from './dto/performance-query.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateFormatDefaultDto } from './dto/update-format-default.dto';
import { TriggerTestMagnetDto } from './dto/trigger-test-magnet.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { ResolveMarketQueryDto } from './dto/resolve-market-query.dto';
import { EditScriptDto } from './dto/edit-script.dto';
import { RejectRunDto, CancelRunDto } from './dto/run-reason.dto';
import { RegenerateThumbnailDto } from './dto/regenerate-thumbnail.dto';
import { isContentFormat } from './dto/content-format';

const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024; // 5MB

@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline')
export class ContentPipelineController {
  constructor(
    private readonly runs: ContentRunsService,
    private readonly queries: ContentPipelineQueriesService,
    private readonly actions: RunActionsService,
    private readonly thumbnails: RunThumbnailService,
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

  @Post('runs')
  async createRun(@Body() dto: CreateRunDto) {
    const result = await this.runs.createRun(dto);
    return { success: true, data: result };
  }

  @Post('resolve-market')
  async resolveMarket(@Body() body: ResolveMarketQueryDto) {
    const matches = await this.runs.resolveMarket(body.query);
    return { success: true, data: { matches } };
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

  @Get('runs/:id')
  async getRun(@Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.queries.getRunDetail(id) };
  }

  @Get('runs/:id/asset-url')
  async getAssetUrl(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('kind') kind: string,
  ) {
    if (kind !== 'video_master' && kind !== 'audio') {
      throw new BadRequestException('kind must be video_master or audio');
    }
    return {
      success: true,
      data: await this.queries.getAssetSignedUrl(id, kind),
    };
  }

  @Post('runs/:id/approve')
  async approve(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.actions.approveRun(id);
    return { success: true, data: { status: 'publishing' } };
  }

  @Post('runs/:id/reject')
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RejectRunDto,
  ) {
    await this.actions.rejectRun(id, body.reason);
    return { success: true, data: { status: 'rejected' } };
  }

  @Post('runs/:id/cancel')
  async cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CancelRunDto,
  ) {
    await this.actions.cancelRun(id, body?.reason);
    return { success: true, data: { status: 'cancelled' } };
  }

  @Post('runs/:id/retry')
  async retry(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.actions.retryRun(id);
    return { success: true, data: { status: 'queued' } };
  }

  @Post('runs/:id/edit-script')
  async editScript(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: EditScriptDto,
  ) {
    const data = await this.actions.editScript(
      id,
      body.variantId,
      body.newFullText,
    );
    return { success: true, data };
  }

  @Post('runs/:id/continue-pipeline')
  async continuePipeline(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.actions.resumePipelineFromReview(id);
    return { success: true, data };
  }

  @Post('runs/:id/thumbnail/regenerate')
  @HttpCode(202)
  async regenerateThumbnail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RegenerateThumbnailDto,
  ) {
    await this.thumbnails.regenerateThumbnail(id, body.frame);
    return {
      success: true,
      data: { queued: true, runId: id, frame: body.frame },
    };
  }

  @Post('runs/:id/thumbnail/replace')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: THUMBNAIL_MAX_BYTES } }),
  )
  async replaceThumbnail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(
        'file is required (multipart/form-data field "file")',
      );
    }
    const result = await this.thumbnails.replaceThumbnail(id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    });
    return { success: true, data: result };
  }

  @Delete('runs/:id')
  async deleteRun(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await this.actions.deleteRun(id);
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
