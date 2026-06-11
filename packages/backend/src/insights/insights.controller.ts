/**
 * Insights Controller
 *
 * Exposes endpoints for retrieving and batch-generating AI market insights,
 * and for generating monthly blog posts.
 *
 * GET  /api/insights/:geoLevel/:regionId  — Retrieve a single insight
 * POST /api/insights/generate-batch        — Trigger batch generation
 * POST /api/insights/blog/generate         — Generate monthly blog posts (admin)
 *
 * generate-batch and blog/generate are gated by AdminGuard — they trigger
 * paid Anthropic generations and must not be reachable by unauthenticated
 * traffic.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { InsightsService } from './insights.service';
import { BlogGeneratorService } from './blog-generator.service';
import { BlogPostType } from './blog-prompts';
import { AdminGuard } from '../common/guards/admin-auth.guard';

@Controller('api/insights')
export class InsightsController {
  constructor(
    private readonly insightsService: InsightsService,
    private readonly blogGenerator: BlogGeneratorService,
  ) {}

  @Get(':geoLevel/:regionId')
  async getInsight(
    @Param('geoLevel') geoLevel: string,
    @Param('regionId') regionId: string,
    @Query('type') insightType: string = 'market_take',
    @Query('archetype') archetypeId?: string,
  ) {
    const insight = await this.insightsService.getInsight(
      regionId,
      geoLevel,
      insightType,
      archetypeId,
    );

    if (!insight) {
      throw new HttpException('Insight not found', HttpStatus.NOT_FOUND);
    }

    return {
      content: insight.content,
      generated_at: insight.generated_at,
      model: insight.model,
    };
  }

  @Post('generate-batch')
  @UseGuards(AdminGuard)
  async generateBatch(@Body('geoLevel') geoLevel: string) {
    return this.insightsService.generateBatchInsights(geoLevel);
  }

  /**
   * Generate monthly blog posts. Optionally pass a `type` in the body to
   * generate a single post type instead of all three.
   *
   * Returns MDX content for admin review before publishing.
   */
  @Post('blog/generate')
  @UseGuards(AdminGuard)
  async generateBlogPosts(@Body('type') type?: BlogPostType) {
    if (type) {
      const post = await this.blogGenerator.generatePostByType(type);
      if (!post) {
        throw new HttpException(
          'Blog generation unavailable or unknown type',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      return { posts: [post] };
    }

    const posts = await this.blogGenerator.generateMonthlyPosts();
    if (posts.length === 0) {
      throw new HttpException(
        'Blog generation unavailable — AI client not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { posts };
  }
}
