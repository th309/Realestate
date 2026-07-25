import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { PostsService } from './posts.service';
import { ListPostsQueryDto } from './dto/posts-query.dto';
import { UpdatePostCopyDto, UpdatePostStatusDto } from './dto/update-post.dto';

/**
 * Admin posts API for the feed UI. Lists posts by status, moves them through the
 * lifecycle (approve/skip/etc. via updateStatus), and edits copy. Response
 * envelope matches sibling content-pipeline controllers ({ success, data }).
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  async list(@Query() q: ListPostsQueryDto) {
    const [rows, counts] = await Promise.all([
      this.posts.listPosts({
        status: q.status,
        brandId: q.brandId,
        limit: q.limit,
        scheduledFrom: q.scheduledFrom,
        scheduledTo: q.scheduledTo,
        orderBy: q.orderBy,
      }),
      this.posts.countByStatus(q.brandId),
    ]);
    return { success: true, data: { posts: rows, counts } };
  }

  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.posts.getById(id) };
  }

  /** Approve a pending post (pending_review -> approved). */
  @Post(':id/approve')
  async approve(@Param('id', new ParseUUIDPipe()) id: string) {
    return {
      success: true,
      data: await this.posts.updateStatus(id, 'approved'),
    };
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
