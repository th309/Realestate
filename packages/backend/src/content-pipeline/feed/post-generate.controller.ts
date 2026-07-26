import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { FeedService } from './feed.service';
import { GeneratePostDto } from './generate-post.dto';

/**
 * On-demand post generation for the feed UI. Lives on the posts base path but in
 * the content-pipeline module (not the posts sub-module) because it depends on
 * FeedService. Response envelope matches sibling controllers ({ success, data }).
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/posts')
export class PostGenerateController {
  constructor(private readonly feed: FeedService) {}

  /** POST /api/admin/content-pipeline/posts/generate — generate one post now. */
  @Post('generate')
  async generate(@Body() dto: GeneratePostDto) {
    try {
      const result = await this.feed.generateOnDemand({
        type: dto.type,
        platform: dto.platform,
        topic: dto.topic,
        marketQuery: dto.marketQuery,
        brandId: dto.brandId,
      });
      // The created post row (with signed mediaUrls) sits directly at `data`,
      // matching sibling posts endpoints; the frontend reads json.data as the post.
      if (!result.post) {
        return {
          success: false,
          error: result.outcome.reason ?? `generation ${result.outcome.status}`,
        };
      }
      return { success: true, data: result.post };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
