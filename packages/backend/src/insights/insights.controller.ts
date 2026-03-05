/**
 * Insights Controller
 *
 * Exposes endpoints for retrieving and batch-generating AI market insights.
 *
 * GET  /api/insights/:geoLevel/:regionId  — Retrieve a single insight
 * POST /api/insights/generate-batch        — Trigger batch generation
 *
 * Note: generate-batch will get an AdminGuard in Task 7 (entitlements).
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
} from '@nestjs/common';
import { InsightsService } from './insights.service';

@Controller('api/insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

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
  async generateBatch(@Body('geoLevel') geoLevel: string) {
    return this.insightsService.generateBatchInsights(geoLevel);
  }
}
