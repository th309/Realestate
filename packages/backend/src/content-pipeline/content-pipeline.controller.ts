import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { ContentPipelineService } from './content-pipeline.service';
import { PlatformManagerService } from './platform-manager.service';
import { PipelineSettingsService } from './pipeline-settings.service';
import { CreateRunDto } from './dto/create-run.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline')
export class ContentPipelineController {
  constructor(
    private readonly service: ContentPipelineService,
    private readonly platformManager: PlatformManagerService,
    private readonly settingsService: PipelineSettingsService,
  ) {}

  @Get('health')
  async health() {
    return { success: true, data: { status: 'ok' } };
  }

  @Get('dashboard')
  async dashboard() {
    return { success: true, data: await this.service.getDashboard() };
  }

  @Post('runs')
  async createRun(@Body() dto: CreateRunDto) {
    const result = await this.service.createRun(dto);
    return { success: true, data: result };
  }

  @Post('resolve-market')
  async resolveMarket(@Body() body: { query: string }) {
    const matches = await this.service.resolveMarket(body.query);
    return { success: true, data: { matches } };
  }

  @Get('runs/:id')
  async getRun(@Param('id') id: string) {
    return { success: true, data: await this.service.getRunDetail(id) };
  }

  @Get('runs/:id/asset-url')
  async getAssetUrl(@Param('id') id: string, @Query('kind') kind: string) {
    if (kind !== 'video_master' && kind !== 'audio') {
      throw new BadRequestException('kind must be video_master or audio');
    }
    return {
      success: true,
      data: await this.service.getAssetSignedUrl(id, kind),
    };
  }

  @Post('runs/:id/approve')
  async approve(@Param('id') id: string) {
    await this.service.approveRun(id);
    return { success: true, data: { status: 'publishing' } };
  }

  @Post('runs/:id/reject')
  async reject(@Param('id') id: string, @Body() body: { reason: string }) {
    await this.service.rejectRun(id, body.reason);
    return { success: true, data: { status: 'rejected' } };
  }

  @Post('runs/:id/retry')
  async retry(@Param('id') id: string) {
    await this.service.retryRun(id);
    return { success: true, data: { status: 'queued' } };
  }

  @Post('runs/:id/edit-script')
  async editScript(
    @Param('id') id: string,
    @Body() body: { variantId: 'A' | 'B'; newFullText: string },
  ) {
    await this.service.editScript(id, body.variantId, body.newFullText);
    return { success: true, data: { status: 'linting_voice' } };
  }

  @Get('review/queue')
  async reviewQueue() {
    return { success: true, data: await this.service.getReviewQueue() };
  }

  @Get('platforms')
  async platforms() {
    return {
      success: true,
      data: { platforms: await this.platformManager.getPlatformStatuses() },
    };
  }

  @Post('platforms/:platform/connect')
  async platformConnect(@Param('platform') platform: string) {
    return {
      success: true,
      data: await this.platformManager.startOAuth(platform),
    };
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

  @Post('pause')
  async pause() {
    return { success: true, data: await this.settingsService.pause() };
  }

  @Post('resume')
  async resume() {
    return { success: true, data: await this.settingsService.resume() };
  }
}
