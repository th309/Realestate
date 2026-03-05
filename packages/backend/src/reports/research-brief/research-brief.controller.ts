/**
 * Research Brief Controller
 *
 * API endpoints for the custom research brief generation pipeline:
 * - POST /clarify — get scoping questions for a research topic
 * - POST /generate — run the full research + narrative pipeline
 *
 * All endpoints require authentication.
 */

import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards';
import { AuthUserId } from '../../common/decorators';
import { ResearchBriefService } from './research-brief.service';
import { ResearchClarifyDto, ResearchGenerateDto } from './research-brief.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/reports/research')
export class ResearchBriefController {
  private readonly logger = new Logger(ResearchBriefController.name);

  constructor(private readonly researchBriefService: ResearchBriefService) {}

  /**
   * Generate clarifying questions to scope a research topic.
   *
   * POST /api/reports/research/clarify
   */
  @Post('clarify')
  async getClarifyingQuestions(
    @Body() dto: ResearchClarifyDto,
    @AuthUserId() userId: string,
  ) {
    this.logger.log(`Research clarify request from user ${userId}`);

    const availability = this.researchBriefService.isAvailable();
    if (!availability.research) {
      throw new HttpException(
        'Research service is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const questions =
      await this.researchBriefService.generateClarifyingQuestions(
        dto.question,
        dto.context,
      );

    return { questions };
  }

  /**
   * Execute full research pipeline: data gathering + narrative generation.
   *
   * POST /api/reports/research/generate
   *
   * Returns the complete research brief with narrative and supporting data.
   * This is a long-running request (10-60s) due to multi-step AI pipeline.
   */
  @Post('generate')
  async generateResearchBrief(
    @Body() dto: ResearchGenerateDto,
    @AuthUserId() userId: string,
  ) {
    this.logger.log(`Research generate request from user ${userId}`);

    const availability = this.researchBriefService.isAvailable();
    if (!availability.research || !availability.narrative) {
      throw new HttpException(
        'Research service is not fully configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const startTime = Date.now();

    try {
      // Step 1: Execute research (Claude tool-use loop)
      this.logger.log('Starting research execution...');
      const research = await this.researchBriefService.executeResearch(
        dto.question,
        dto.clarifying_answers,
        dto.context,
      );
      this.logger.log(
        `Research execution done: ${research.toolCallCount} tool calls in ${research.durationMs}ms`,
      );

      // Step 2: Enrich with direct news fetch (same pattern as HomeReady/InvestorEdge)
      this.logger.log('Enriching research data with news...');
      const enrichedData = await this.researchBriefService.enrichWithNews(
        research.researchData,
      );

      // Step 3: Generate narrative (DeepSeek)
      this.logger.log('Starting narrative generation...');
      const clarifyingContext = dto.clarifying_answers
        ? JSON.stringify(dto.clarifying_answers)
        : undefined;

      const narrative = await this.researchBriefService.generateNarrative(
        dto.question,
        enrichedData,
        clarifyingContext,
      );
      this.logger.log(`Narrative generation done (${narrative.length} chars)`);

      const totalDurationMs = Date.now() - startTime;
      this.logger.log(
        `Research brief completed in ${totalDurationMs}ms ` +
          `(${research.toolCallCount} tool calls)`,
      );

      return {
        narrative,
        research_data: research.researchData,
        tool_call_count: research.toolCallCount,
        duration_ms: totalDurationMs,
      };
    } catch (error: any) {
      this.logger.error(
        `Research brief generation failed: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Research brief generation failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
