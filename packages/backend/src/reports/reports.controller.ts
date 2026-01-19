/**
 * PropertyIQ Reports Controller
 *
 * API endpoints for report generation, retrieval, and sharing.
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
  Headers,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  GenerateReportDto,
  SendMessageDto,
  CreateShareDto,
} from './dto/generate-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Get available report templates
   *
   * GET /reports/templates
   */
  @Get('templates')
  async getTemplates(@Query('tier') tier?: string) {
    return this.reportsService.getTemplates(tier);
  }

  /**
   * Get a specific template by slug
   *
   * GET /reports/templates/:slug
   */
  @Get('templates/:slug')
  async getTemplate(@Param('slug') slug: string) {
    const template = await this.reportsService.getTemplateBySlug(slug);
    if (!template) {
      throw new HttpException(
        `Template not found: ${slug}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return template;
  }

  /**
   * Generate a new report
   *
   * POST /reports/generate
   */
  @Post('generate')
  async generateReport(
    @Body() dto: GenerateReportDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
    }

    const reportId = await this.reportsService.generateReport(userId, dto);
    return { report_id: reportId, status: 'generating' };
  }

  /**
   * Get user's report history
   *
   * GET /reports/history
   */
  @Get('history')
  async getHistory(
    @Headers('x-user-id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!userId) {
      throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
    }

    return this.reportsService.getReportHistory(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * Get a specific report
   *
   * GET /reports/:id
   */
  @Get(':id')
  async getReport(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
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
  @Delete(':id')
  async deleteReport(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
    }

    const deleted = await this.reportsService.deleteReport(id, userId);
    if (!deleted) {
      throw new HttpException('Report not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  /**
   * Send a message in report conversation
   *
   * POST /reports/:id/conversation
   */
  @Post(':id/conversation')
  async sendMessage(
    @Param('id') reportId: string,
    @Body() dto: SendMessageDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
    }

    return this.reportsService.sendConversationMessage(
      reportId,
      userId,
      dto.content,
    );
  }

  /**
   * Get report conversation
   *
   * GET /reports/:id/conversation
   */
  @Get(':id/conversation')
  async getConversation(
    @Param('id') reportId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.reportsService.getConversation(reportId, userId);
  }

  /**
   * Create a share link for a report
   *
   * POST /reports/:id/share
   */
  @Post(':id/share')
  async createShare(
    @Param('id') reportId: string,
    @Body() dto: CreateShareDto,
    @Headers('x-user-id') userId: string,
  ) {
    if (!userId) {
      throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
    }

    const shareToken = await this.reportsService.createShareLink(
      reportId,
      userId,
      dto.access_level || 'view',
      dto.expires_in_days,
    );

    return { share_token: shareToken };
  }

  /**
   * Get a shared report (public)
   *
   * GET /reports/shared/:token
   */
  @Get('shared/:token')
  async getSharedReport(@Param('token') token: string) {
    const report = await this.reportsService.getSharedReport(token);
    if (!report) {
      throw new HttpException(
        'Shared report not found or expired',
        HttpStatus.NOT_FOUND,
      );
    }
    return report;
  }
}
