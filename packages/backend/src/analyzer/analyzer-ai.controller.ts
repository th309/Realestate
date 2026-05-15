/**
 * AnalyzerAiController — AI-powered analyzer endpoints.
 *
 * Split out from `AnalyzerController` to keep both files under the 300-line
 * file-size cap. Hosts the verdict (legacy SSE), section annotations (JSON),
 * and header verdict streams (SSE). All three are Pro-gated via the shared
 * `AnalyzerTierGate`.
 *
 * Mounted under the same `/api/analyzer` prefix as `AnalyzerController` —
 * Nest happily allows multiple controllers to share a base path so long as
 * the full route paths don't collide.
 */
import {
  Body,
  Controller,
  Logger,
  Post,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { AnalyzerService } from './analyzer.service';
import { AiInsightsService } from './ai-insights.service';
import { AnalyzerTierGate } from './analyzer-tier-gate.service';
import { AiVerdictRequestDto } from './dto/ai-verdict.dto';
import {
  AiInsightsBodyDto,
  AiInsightsSectionBodyDto,
  AIAnnotationDto,
} from './dto/ai-insights.dto';

@Controller('api/analyzer')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AnalyzerAiController {
  private readonly logger = new Logger(AnalyzerAiController.name);

  constructor(
    private readonly service: AnalyzerService,
    private readonly aiInsights: AiInsightsService,
    private readonly tierGate: AnalyzerTierGate,
  ) {}

  /**
   * POST /api/analyzer/ai-verdict
   *
   * Streams an AI-generated deal verdict via Server-Sent Events.
   * Pro-gated: anonymous users are blocked by FreePreviewMiddleware,
   * logged-in users hit `requirePro` for a 403 on non-Pro tiers.
   *
   * Response is `text/event-stream`; each chunk is
   * `data: {"chunk":"..."}\n\n`. Stream terminates with `data: [DONE]\n\n`.
   * Errors mid-stream are emitted as `data: {"error":"..."}\n\n` before
   * the connection ends.
   */
  @Post('ai-verdict')
  @UseGuards(JwtAuthGuard)
  async aiVerdict(
    @AuthUserId() userId: string,
    @Body() body: AiVerdictRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.tierGate.requirePro(userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of this.service.streamAiVerdict(body)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }

  /**
   * POST /api/analyzer/ai-insights/section
   *
   * Returns a cached-or-fresh 1-2 sentence AI annotation for one of the
   * analyzer's non-header sections (projection, expense_waterfall,
   * sensitivity, comps, market_context, after_tax). Pro-gated.
   *
   * The response is JSON — section annotations are short, deterministic
   * once cached, and consumed by static UI panels, so SSE adds no value
   * here. Streaming is reserved for the header verdict below.
   */
  @Post('ai-insights/section')
  @UseGuards(JwtAuthGuard)
  async sectionInsight(
    @AuthUserId() userId: string,
    @Body() body: AiInsightsSectionBodyDto,
  ): Promise<AIAnnotationDto> {
    await this.tierGate.requirePro(userId);
    return this.aiInsights.complete(body.payload, body.id);
  }

  /**
   * POST /api/analyzer/ai-insights/header
   *
   * Streams the header buy/negotiate/pass verdict via Server-Sent Events.
   * Pro-gated. Mirrors `ai-verdict` framing — `data: {"chunk":"..."}\n\n`
   * per token, terminated by `data: [DONE]\n\n`. Errors mid-stream are
   * emitted as `data: {"error":"..."}\n\n` before the connection ends.
   */
  @Post('ai-insights/header')
  @UseGuards(JwtAuthGuard)
  async headerInsight(
    @AuthUserId() userId: string,
    @Body() body: AiInsightsBodyDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.tierGate.requirePro(userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of this.aiInsights.stream(body.payload)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }
}
