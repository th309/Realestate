/**
 * PropertyIQ Reports Controller
 *
 * API endpoints for report generation and retrieval. Sharing/conversation
 * endpoints live in report-sharing.controller.ts (CLAUDE.md §1.3 split).
 * Protected endpoints use JwtAuthGuard; template browsing is public.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { ReportsService } from './reports.service';
import { ReportTemplateCatalogService } from './report-template-catalog.service';
import { ReportsNarrativeRegenerationService } from './reports-narrative-regeneration.service';
import {
  GenerateReportDto,
  SaveBuilderTemplateDto,
} from './dto/generate-report.dto';
import { STATIC_SAMPLE_REPORT } from './static-sample-report';

@Controller('api/reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportTemplateCatalog: ReportTemplateCatalogService,
    private readonly reportsNarrativeRegeneration: ReportsNarrativeRegenerationService,
  ) {}

  /**
   * Get available report templates (public)
   *
   * GET /reports/templates
   */
  @Get('templates')
  async getTemplates() {
    // Public catalog — intentionally not filtered by a client-supplied tier
    // (the old `?tier=` was dead-plumbing the service already ignored).
    return this.reportTemplateCatalog.getTemplates();
  }

  /**
   * Get a specific template by slug (public)
   *
   * GET /reports/templates/:slug
   */
  @Get('templates/:slug')
  async getTemplate(@Param('slug') slug: string) {
    const template = await this.reportTemplateCatalog.getTemplateBySlug(slug);
    if (!template) {
      throw new HttpException(
        `Template not found: ${slug}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return template;
  }

  /**
   * Get the sample report (public — no auth required)
   *
   * GET /reports/sample
   */
  @Get('sample')
  async getSampleReport() {
    const SAMPLE_REPORT_ID = 'f4b04e7c-34cc-4e38-bdac-541fff06de1e';
    const report = await this.reportsService.getReport(SAMPLE_REPORT_ID);
    return report ?? STATIC_SAMPLE_REPORT;
  }

  /**
   * Generate a new report
   *
   * POST /reports/generate
   */
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generateReport(
    @Body() dto: GenerateReportDto,
    @AuthUserId() userId: string,
  ) {
    // Tier is resolved server-side from the validated userId downstream
    // (checkAccess → TierResolverService); never trust a client x-user-tier.
    const reportId = await this.reportsService.generateReport(userId, dto);
    return { report_id: reportId, status: 'generating' };
  }

  /**
   * Save the current report-builder layout as a private, user-owned template.
   *
   * POST /reports/builder-templates
   */
  @UseGuards(JwtAuthGuard)
  @Post('builder-templates')
  async saveBuilderTemplate(
    @Body() dto: SaveBuilderTemplateDto,
    @AuthUserId() userId: string,
  ) {
    return this.reportsService.saveBuilderTemplate(userId, dto);
  }

  /**
   * Get user's report history
   *
   * GET /reports/history
   */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getHistory(
    @AuthUserId() userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.reportsService.getReportHistory(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Stream generation progress via Server-Sent Events
   *
   * GET /reports/:id/progress
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/progress')
  async getProgress(
    @Param('id') id: string,
    @AuthUserId() userId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const interval = setInterval(async () => {
      try {
        const report = await this.reportsService.getReport(id, userId);
        if (report) {
          const payload = {
            status: report.status,
            generation_stage: report.generation_stage ?? null,
            generation_stage_detail: report.generation_stage_detail ?? null,
          };
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
          if (report.status === 'ready' || report.status === 'failed') {
            clearInterval(interval);
            res.end();
          }
        }
      } catch {
        clearInterval(interval);
        res.end();
      }
    }, 2000);

    res.on('close', () => {
      clearInterval(interval);
      res.end();
    });
  }

  /**
   * Get a specific report
   *
   * GET /reports/:id
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getReport(@Param('id') id: string, @AuthUserId() userId: string) {
    const report = await this.reportsService.getReport(id, userId);
    if (!report) {
      throw new HttpException('Report not found', HttpStatus.NOT_FOUND);
    }
    return report;
  }

  /**
   * Delete a report
   *
   * DELETE /reports/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteReport(@Param('id') id: string, @AuthUserId() userId: string) {
    const deleted = await this.reportsService.deleteReport(id, userId);
    if (!deleted) {
      throw new HttpException('Report not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  /**
   * Regenerate narratives after personalization inputs change
   *
   * POST /reports/:id/regenerate-narratives
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/regenerate-narratives')
  async regenerateNarratives(
    @Param('id') id: string,
    @Body() body: { user_inputs: Record<string, any> },
    @AuthUserId() userId: string,
  ) {
    return this.reportsNarrativeRegeneration.regenerateNarratives(
      id,
      userId,
      body.user_inputs,
    );
  }

  // Sharing, conversations, and share-link creation live in
  // ReportSharingController (report-sharing.controller.ts).
}
