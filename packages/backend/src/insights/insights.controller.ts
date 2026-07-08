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
import type { GeoLevel, InsightType } from './insights.types';

const VALID_GEO_LEVELS: readonly GeoLevel[] = [
  'state',
  'metro',
  'county',
  'zip',
];
const VALID_INSIGHT_TYPES: readonly InsightType[] = [
  'market_take',
  'score_explanation',
  'trend_interpretation',
  'market_overview',
  'archetype_match',
  'market_outlook',
];
// Archetype ids are short slugs; bounding charset/length keeps arbitrary
// strings out of the market_insights cache-key space (archetype_id is part
// of the upsert conflict key).
const ARCHETYPE_ID_PATTERN = /^[a-z0-9_-]{1,64}$/i;
const VALID_BLOG_POST_TYPES: readonly BlogPostType[] = [
  'top_propertyiq_markets',
  'top_homebuyer_markets',
  'top_investor_markets',
  'biggest_score_movers',
];

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
    // ISR/SEO builds pass cachedOnly=1 to fetch a pre-generated narrative
    // WITHOUT ever triggering a paid AI generation (DeepSeek cost guardrail).
    @Query('cachedOnly') cachedOnly?: string,
  ) {
    if (!VALID_GEO_LEVELS.includes(geoLevel as GeoLevel)) {
      throw new HttpException(
        `Invalid geoLevel. Must be one of: ${VALID_GEO_LEVELS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!VALID_INSIGHT_TYPES.includes(insightType as InsightType)) {
      throw new HttpException(
        `Invalid type. Must be one of: ${VALID_INSIGHT_TYPES.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (archetypeId !== undefined && !ARCHETYPE_ID_PATTERN.test(archetypeId)) {
      throw new HttpException('Invalid archetype id', HttpStatus.BAD_REQUEST);
    }

    const cacheOnly = cachedOnly === '1' || cachedOnly === 'true';

    const insight = cacheOnly
      ? await this.insightsService.getCachedInsight(
          regionId,
          geoLevel,
          insightType,
          archetypeId,
        )
      : await this.insightsService.getInsight(
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
    if (!VALID_GEO_LEVELS.includes(geoLevel as GeoLevel)) {
      throw new HttpException(
        `Invalid geoLevel. Must be one of: ${VALID_GEO_LEVELS.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
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
    if (type !== undefined && !VALID_BLOG_POST_TYPES.includes(type)) {
      throw new HttpException(
        `Invalid type. Must be one of: ${VALID_BLOG_POST_TYPES.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }
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
