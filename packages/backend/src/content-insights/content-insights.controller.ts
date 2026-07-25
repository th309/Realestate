import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { ContentInsightsService } from './content-insights.service';
import { InsightsQueryDto } from './dto/insights-query.dto';

/**
 * Admin insights endpoints backing the content-pipeline /insights page. Guarded
 * like the sibling content-pipeline admin controllers; responses use the
 * `{ success, data }` envelope the frozen frontend contract expects.
 *
 * Route prefix `api/admin/content-pipeline/insights` is distinct from the AI
 * market-insights controller at `api/insights` — different feature.
 *
 * Wired via ContentInsightsModule (imported in app.module.ts).
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/insights')
export class ContentInsightsController {
  constructor(private readonly insights: ContentInsightsService) {}

  /** Reach/engagement/follower totals for the last `days` vs the prior window. */
  @Get('overview')
  async overview(@Query() query: InsightsQueryDto) {
    return {
      success: true,
      data: await this.insights.getOverview(query.days, query.brandId),
    };
  }

  /** Per-post performance for the last `days`, newest first. */
  @Get('posts')
  async posts(@Query() query: InsightsQueryDto) {
    return {
      success: true,
      data: {
        posts: await this.insights.getPosts(
          query.days,
          query.limit,
          query.brandId,
        ),
      },
    };
  }
}
