/**
 * AI Insights Persistence Controller
 *
 * CRUD endpoints for saving/loading AI insight reports
 * and updating recommendation statuses.
 *
 * Routes:
 *   GET    /api/admin/analytics/insights          - List saved insights
 *   GET    /api/admin/analytics/insights/:id       - Get full insight
 *   POST   /api/admin/analytics/insights           - Save new insight
 *   PUT    /api/admin/analytics/insights/:id       - Update insight
 *   DELETE /api/admin/analytics/insights/:id       - Delete insight
 *   PUT    /api/admin/analytics/insights/:insightId/recommendations/:recId - Update rec status
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { AiInsightsPersistenceService } from './ai-insights-persistence.service';
import { parseRecommendationsFromMarkdown } from './recommendation-parser';
import {
  CreateInsightDto,
  UpdateInsightDto,
  UpdateRecommendationStatusDto,
} from './ai-insights-persistence.types';

/** Extract admin user ID from request (set by JwtAuthGuard via AdminGuard). */
function getAdminUserId(req: Request): string {
  const userId = (req as unknown as { userId?: string }).userId;
  if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
  return userId;
}

@UseGuards(AdminGuard)
@Controller('api/admin/analytics/insights')
export class AiInsightsPersistenceController {
  private readonly logger = new Logger(AiInsightsPersistenceController.name);

  constructor(private readonly persistence: AiInsightsPersistenceService) {}

  /** List saved insights (summary only). */
  @Get()
  async listInsights(@Req() req: Request) {
    const userId = getAdminUserId(req);
    try {
      return await this.persistence.getAll(userId);
    } catch (error) {
      this.logger.error(`Failed to list insights: ${error.message}`);
      // Return empty array on DB errors (e.g. table not yet created)
      // so the frontend renders a clean empty state instead of a 500
      return [];
    }
  }

  /** Get full insight with recommendations. */
  @Get(':id')
  async getInsight(@Req() req: Request, @Param('id') id: string) {
    const userId = getAdminUserId(req);
    const insight = await this.persistence.getById(userId, id);
    if (!insight) throw new NotFoundException('Insight not found');
    return insight;
  }

  /** Save a new insight report. Parses recommendations server-side. */
  @Post()
  async createInsight(@Req() req: Request, @Body() body: CreateInsightDto) {
    const userId = getAdminUserId(req);

    // If recommendations aren't provided, parse from markdown
    if (!body.recommendations || body.recommendations.length === 0) {
      body.recommendations = parseRecommendationsFromMarkdown(
        body.markdown_content,
      );
    }

    return this.persistence.create(userId, body);
  }

  /** Update insight metadata (title, pin). */
  @Put(':id')
  async updateInsight(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateInsightDto,
  ) {
    const userId = getAdminUserId(req);
    return this.persistence.update(userId, id, body);
  }

  /** Delete a saved insight. */
  @Delete(':id')
  async deleteInsight(@Req() req: Request, @Param('id') id: string) {
    const userId = getAdminUserId(req);
    await this.persistence.delete(userId, id);
    return { success: true };
  }

  /** Update a recommendation's status (implemented/dismissed/pending). */
  @Put(':insightId/recommendations/:recId')
  async updateRecommendationStatus(
    @Req() req: Request,
    @Param('insightId') insightId: string,
    @Param('recId') recId: string,
    @Body() body: UpdateRecommendationStatusDto,
  ) {
    const userId = getAdminUserId(req);
    const result = await this.persistence.updateRecommendationStatus(
      userId,
      insightId,
      recId,
      body.status,
    );
    if (!result) {
      throw new NotFoundException('Recommendation not found');
    }
    return result;
  }
}
