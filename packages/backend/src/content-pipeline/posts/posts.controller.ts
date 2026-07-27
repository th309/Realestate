import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Logger,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { PostsService } from './posts.service';
import { ListPostsQueryDto } from './dto/posts-query.dto';
import { UpdatePostCopyDto, UpdatePostStatusDto } from './dto/update-post.dto';
import { parseByteRange } from './posts-byte-range';
import { PostAutoSchedulerService } from '../scheduling/post-auto-scheduler.service';

/** The slice of the Express response the media route needs (no express import). */
interface ExpressResponseLike {
  status(code: number): unknown;
  setHeader(name: string, value: string): unknown;
}

/**
 * Admin posts API for the feed UI. Lists posts by status, moves them through the
 * lifecycle (approve/skip/etc. via updateStatus), and edits copy. Response
 * envelope matches sibling content-pipeline controllers ({ success, data }).
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/posts')
export class PostsController {
  private readonly logger = new Logger(PostsController.name);

  constructor(
    private readonly posts: PostsService,
    private readonly autoScheduler: PostAutoSchedulerService,
  ) {}

  @Get()
  async list(@Query() q: ListPostsQueryDto) {
    const [rows, counts] = await Promise.all([
      this.posts.listPosts({
        status: q.status,
        brandId: q.brandId,
        postType: q.postType,
        limit: q.limit,
        scheduledFrom: q.scheduledFrom,
        scheduledTo: q.scheduledTo,
        orderBy: q.orderBy,
      }),
      this.posts.countByStatus(q.brandId),
    ]);
    const posts = await Promise.all(
      rows.map((r) => this.posts.withSignedMedia(r)),
    );
    return { success: true, data: { posts, counts } };
  }

  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const post = await this.posts.getById(id);
    return { success: true, data: await this.posts.withSignedMedia(post) };
  }

  /**
   * Stream a post's rendered media SAME-ORIGIN so <img src> / <video src>
   * survive content blockers that filter supabase.co requests. Downloaded
   * server-side with the service-role client; the path is immutable per render,
   * so it caches 1h.
   *
   * Video cards answer Range requests with a 206 slice: browsers issue one
   * before playing an MP4, and a player that only ever gets 200 cannot seek.
   */
  @Get(':id/media/:order')
  @Header('Cache-Control', 'private, max-age=3600')
  async media(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('order', new ParseIntPipe()) order: number,
    @Req() req: { headers: Record<string, string | string[] | undefined> },
    @Res({ passthrough: true }) res: ExpressResponseLike,
  ): Promise<StreamableFile> {
    if (order < 0 || order > 40) {
      throw new BadRequestException('media order out of range');
    }
    const { bytes, contentType } = await this.posts.downloadMedia(id, order);

    const rangeHeader = req.headers.range;
    const range =
      typeof rangeHeader === 'string'
        ? parseByteRange(rangeHeader, bytes.length)
        : null;
    if (range) {
      const slice = bytes.subarray(range.start, range.end + 1);
      res.status(206);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader(
        'Content-Range',
        `bytes ${range.start}-${range.end}/${bytes.length}`,
      );
      return new StreamableFile(slice, {
        type: contentType,
        disposition: 'inline',
        length: slice.length,
      });
    }

    res.setHeader('Accept-Ranges', 'bytes');
    return new StreamableFile(bytes, {
      type: contentType,
      disposition: 'inline',
      length: bytes.length,
    });
  }

  /**
   * Approve a pending post (pending_review -> approved), then immediately try
   * to give it a publish slot. Auto-scheduling failure never fails this
   * request — the approval already succeeded, and the sweep cron
   * (AutoScheduleApprovedPostsCron) retries anything left approved-and-
   * unscheduled, so nothing can get stuck on a transient error here.
   */
  @Post(':id/approve')
  async approve(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.posts.updateStatus(id, 'approved');
    try {
      await this.autoScheduler.scheduleApprovedPost(id);
    } catch (err) {
      this.logger.warn(
        `auto-schedule failed for post ${id} right after approval, the sweep cron will retry: ${(err as Error).message}`,
      );
    }
    return { success: true, data: await this.posts.getById(id) };
  }

  /** Skip a post (any non-terminal state -> skipped). */
  @Post(':id/skip')
  async skip(@Param('id', new ParseUUIDPipe()) id: string) {
    return {
      success: true,
      data: await this.posts.updateStatus(id, 'skipped'),
    };
  }

  /** Generic lifecycle transition (validated against the transition map). */
  @Patch(':id/status')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostStatusDto,
  ) {
    return {
      success: true,
      data: await this.posts.updateStatus(id, dto.status, {
        scheduledAt: dto.scheduledAt,
        error: dto.error,
        platformPostId: dto.platformPostId,
      }),
    };
  }

  @Patch(':id/copy')
  async updateCopy(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostCopyDto,
  ) {
    return {
      success: true,
      data: await this.posts.updateCopy(id, dto.copy),
    };
  }
}
