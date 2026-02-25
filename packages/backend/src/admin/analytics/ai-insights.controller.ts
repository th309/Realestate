/**
 * AI Marketing Insights Controller
 *
 * SSE streaming endpoint for AI-generated growth recommendations
 * and a REST endpoint for growth goal progress tracking.
 *
 * Routes:
 *   GET /api/admin/analytics/ai-insights   - SSE stream of LLM analysis
 *   GET /api/admin/analytics/growth-progress - Growth goal progress data
 */

import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { AiInsightsService } from './ai-insights.service';
import {
  AiInsightsQueryDto,
  AiProvider,
  ChatMessage,
} from './ai-insights.types';

@UseGuards(AdminGuard)
@Controller('api/admin/analytics')
export class AiInsightsController {
  private readonly logger = new Logger(AiInsightsController.name);

  constructor(private readonly aiInsights: AiInsightsService) {}

  /**
   * SSE streaming endpoint for AI marketing insights.
   *
   * Accepts query params for time range, provider selection,
   * optional follow-up prompt, and conversation history.
   * Streams the LLM response as Server-Sent Events with typed chunks.
   *
   * GET /api/admin/analytics/ai-insights?days=30&provider=deepseek&prompt=...&history=...
   */
  @Get('ai-insights')
  async streamInsights(
    @Query() query: AiInsightsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const days = Number(query.days) || 30;
    const provider: AiProvider =
      query.provider === 'claude' ? 'claude' : 'deepseek';

    let history: ChatMessage[] = [];
    if (query.history) {
      try {
        history = JSON.parse(query.history);
      } catch {
        this.logger.warn('Invalid history JSON in query, ignoring');
      }
    }

    // Set SSE headers (matches analytics-chat pattern)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const stream = this.aiInsights.streamInsights({
        days,
        provider,
        prompt: query.prompt,
        history,
      });

      for await (const chunk of stream) {
        res.write(
          `data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`,
        );
      }

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (error) {
      this.logger.error('AI insights stream failed', error);
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          content: error.message || 'Stream failed',
        })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  /**
   * Growth goal progress (data-driven, no LLM call).
   *
   * Returns current paid user count, growth rate, milestone
   * statuses, and projected dates against the active goal.
   *
   * GET /api/admin/analytics/growth-progress
   */
  @Get('growth-progress')
  async getGrowthProgress() {
    try {
      return await this.aiInsights.getGrowthProgress();
    } catch (error) {
      this.logger.error('Growth progress fetch failed', error);
      throw new HttpException(
        'Failed to fetch growth progress',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
