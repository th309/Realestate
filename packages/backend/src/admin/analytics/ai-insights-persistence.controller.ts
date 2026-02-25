/**
 * AI Insights Persistence Controller
 *
 * CRUD endpoints for saving/loading AI insight reports,
 * updating recommendation statuses, and generating/executing
 * implementation plans.
 *
 * Routes:
 *   GET    /api/admin/analytics/insights          - List saved insights
 *   GET    /api/admin/analytics/insights/:id       - Get full insight
 *   POST   /api/admin/analytics/insights           - Save new insight
 *   PUT    /api/admin/analytics/insights/:id       - Update insight
 *   DELETE /api/admin/analytics/insights/:id       - Delete insight
 *   PUT    /api/admin/analytics/insights/:insightId/recommendations/:recId - Update rec status
 *   POST   /api/admin/analytics/insights/:insightId/recommendations/:recId/plan - Generate plan (SSE)
 *   POST   /api/admin/analytics/insights/:insightId/recommendations/:recId/execute - Execute plan
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Res,
  Req,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { AiInsightsPersistenceService } from './ai-insights-persistence.service';
import { RecommendationExecutorService } from './recommendation-executor.service';
import { parseRecommendationsFromMarkdown } from './recommendation-parser';
import {
  CreateInsightDto,
  UpdateInsightDto,
  UpdateRecommendationStatusDto,
  ImplementationPlan,
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

  constructor(
    private readonly persistence: AiInsightsPersistenceService,
    private readonly executor: RecommendationExecutorService,
  ) {}

  /** List saved insights (summary only). */
  @Get()
  async listInsights(@Req() req: Request) {
    const userId = getAdminUserId(req);
    return this.persistence.getAll(userId);
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

  /** Generate an implementation plan for a recommendation (SSE stream). */
  @Post(':insightId/recommendations/:recId/plan')
  async generatePlan(
    @Req() req: Request,
    @Param('insightId') insightId: string,
    @Param('recId') recId: string,
    @Res() res: Response,
  ) {
    const userId = getAdminUserId(req);
    const insight = await this.persistence.getById(userId, insightId);
    if (!insight) throw new NotFoundException('Insight not found');

    const rec = insight.recommendations.find((r) => r.id === recId);
    if (!rec) throw new NotFoundException('Recommendation not found');

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      let fullResponse = '';
      const stream = this.executor.generatePlanStream(rec, insight.title);

      for await (const chunk of stream) {
        fullResponse += chunk;
        res.write(
          `data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`,
        );
      }

      // Parse and send the final structured plan
      let plan: ImplementationPlan;
      try {
        const cleaned = fullResponse
          .replace(/^```(?:json)?\s*/m, '')
          .replace(/\s*```\s*$/m, '')
          .trim();
        plan = JSON.parse(cleaned);
      } catch {
        plan = {
          action_type: 'manual',
          summary: 'Could not parse plan from AI response.',
          risk_level: 'medium',
          manual_steps: [
            {
              step_number: 1,
              description: fullResponse.slice(0, 500),
            },
          ],
        };
      }

      res.write(
        `data: ${JSON.stringify({ type: 'plan', content: plan })}\n\n`,
      );
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (error) {
      this.logger.error('Plan generation failed', error);
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          content: error.message || 'Plan generation failed',
        })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  /** Execute a DB change plan. */
  @Post(':insightId/recommendations/:recId/execute')
  async executePlan(
    @Req() req: Request,
    @Param('insightId') insightId: string,
    @Param('recId') recId: string,
    @Body() body: { plan: ImplementationPlan },
  ) {
    const userId = getAdminUserId(req);

    // Verify the insight and rec exist
    const insight = await this.persistence.getById(userId, insightId);
    if (!insight) throw new NotFoundException('Insight not found');

    const rec = insight.recommendations.find((r) => r.id === recId);
    if (!rec) throw new NotFoundException('Recommendation not found');

    if (body.plan.action_type !== 'db_change') {
      throw new HttpException(
        'Only db_change plans can be auto-executed',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.executor.executePlan(body.plan);

    // If successful, mark recommendation as implemented
    if (result.success) {
      await this.persistence.updateRecommendationStatus(
        userId,
        insightId,
        recId,
        'implemented',
      );
    }

    return result;
  }
}
