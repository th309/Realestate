import {
  Body,
  Controller,
  Delete,
  Get,
  BadRequestException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { StyleReferenceService } from './style-reference.service';
import { StyleReferenceVideoIngestService } from './style-reference-video-ingest.service';
import {
  CreateStyleReferenceDto,
  IngestVideoUrlDto,
  UpdateStyleReferenceDto,
  UploadVideoDto,
} from '../dto/style-reference.dto';

// Matches the yt-dlp URL path's --max-filesize cap so uploads and URL ingests
// share one ceiling.
const UPLOAD_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

interface AuthenticatedRequest extends Request {
  userId?: string;
}

@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/style-references')
export class StyleReferenceController {
  constructor(
    private readonly svc: StyleReferenceService,
    private readonly videoIngest: StyleReferenceVideoIngestService,
  ) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const userId = req.userId ?? null;
    return {
      success: true,
      data: { references: await this.svc.list(userId) },
    };
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateStyleReferenceDto,
  ) {
    if (!req.userId) {
      throw new BadRequestException('authenticated admin userId missing');
    }
    return { success: true, data: await this.svc.create(req.userId, dto) };
  }

  @Post('upload-video')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: UPLOAD_VIDEO_MAX_BYTES } }),
  )
  async uploadVideo(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadVideoDto,
  ) {
    if (!req.userId) {
      throw new BadRequestException('authenticated admin userId missing');
    }
    if (!file) {
      throw new BadRequestException(
        'file is required (multipart/form-data field "file")',
      );
    }
    const cleanLabel = body.label.trim();
    if (!cleanLabel) {
      throw new BadRequestException('label is required');
    }
    try {
      return {
        success: true,
        data: await this.videoIngest.ingestVideoFromUpload(
          req.userId,
          file.buffer,
          cleanLabel,
        ),
      };
    } catch (err) {
      return { success: false, error: this.mapError(err) };
    }
  }

  @Post('ingest-video-url')
  async ingestVideoUrl(
    @Req() req: AuthenticatedRequest,
    @Body() body: IngestVideoUrlDto,
  ) {
    if (!req.userId) {
      throw new BadRequestException('authenticated admin userId missing');
    }
    const url = body.url.trim();
    const label = body.label.trim();
    if (!url || !label) {
      throw new BadRequestException('url and label are required');
    }
    try {
      return {
        success: true,
        data: await this.videoIngest.ingestVideoFromUrl(req.userId, url, label),
      };
    } catch (err) {
      return { success: false, error: this.mapError(err) };
    }
  }

  private mapError(err: unknown): string {
    const msg = (err as Error)?.message ?? String(err);
    if (msg.toLowerCase().includes('allowlist')) {
      return 'That URL is not from a supported source. Upload the file instead.';
    }
    if (
      msg.toLowerCase().includes('private') ||
      msg.toLowerCase().includes('geo')
    ) {
      return "Couldn't access this, it might be private or geo-blocked.";
    }
    if (
      msg.toLowerCase().includes('filesize') ||
      msg.toLowerCase().includes('too long')
    ) {
      return "Video is too long; we'll analyze just the first 5 minutes.";
    }
    return msg.slice(0, 300);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStyleReferenceDto,
  ) {
    return { success: true, data: await this.svc.update(id, dto) };
  }

  @Post(':id/re-extract')
  async reExtract(@Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.svc.reExtract(id) };
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.delete(id);
    return { success: true, data: { deleted: true } };
  }
}
