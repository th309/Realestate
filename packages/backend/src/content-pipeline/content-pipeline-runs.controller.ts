import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { CreateRunDto } from './dto/create-run.dto';
import { ResolveMarketQueryDto } from './dto/resolve-market-query.dto';
import { EditScriptDto } from './dto/edit-script.dto';
import { RejectRunDto, CancelRunDto } from './dto/run-reason.dto';
import { RegenerateThumbnailDto } from './dto/regenerate-thumbnail.dto';

const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Content-pipeline RUN lifecycle: create/resolve + every runs/:id action.
 * Extracted from ContentPipelineController to keep both files under the §1.3
 * limit. Shares the AdminGuard + `api/admin/content-pipeline` prefix (NestJS
 * allows multiple controllers per prefix) with NO path changes, so neither
 * controller's routes shadow the other's (the sibling has no bare `:id`
 * catch-all at the root — verified during the split).
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline')
export class ContentPipelineRunsController {
  constructor(
    private readonly runs: ContentRunsService,
    private readonly queries: ContentPipelineQueriesService,
    private readonly actions: RunActionsService,
    private readonly thumbnails: RunThumbnailService,
  ) {}

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
}
