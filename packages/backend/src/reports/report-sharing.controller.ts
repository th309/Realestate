/**
 * Report Sharing Controller
 *
 * Share-link and conversation (AI chat) endpoints for reports. Split out of
 * ReportsController to keep it under CLAUDE.md's 300-line hard limit
 * (§1.3) — same same-prefix multi-controller pattern ReportFollowUpController
 * already uses in this module.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { writeSseGeneratorResponse } from '../common/sse-response-writer';
import { ReportsSharingService } from './reports-sharing.service';
import { SendMessageDto, CreateShareDto } from './dto/generate-report.dto';

@Controller('api/reports')
export class ReportSharingController {
  constructor(private readonly reportsSharing: ReportsSharingService) {}

  /**
   * Get a shared report (public)
   *
   * GET /reports/shared/:token
   */
  @Get('shared/:token')
  async getSharedReport(@Param('token') token: string) {
    const report = await this.reportsSharing.getSharedReport(token);
    if (!report) {
      throw new HttpException(
        'Shared report not found or expired',
        HttpStatus.NOT_FOUND,
      );
    }
    return report;
  }

  /**
   * Send a message in report conversation — streams the AI reply as
   * Server-Sent Events (see writeSseGeneratorResponse).
   *
   * POST /reports/:id/conversation
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/conversation')
  async sendMessage(
    @Param('id') reportId: string,
    @Body() dto: SendMessageDto,
    @AuthUserId() userId: string,
    @Res() res: Response,
  ): Promise<void> {
    await writeSseGeneratorResponse(
      res,
      this.reportsSharing.streamConversationMessage(
        reportId,
        userId,
        dto.content,
      ),
    );
  }

  /**
   * Get report conversation
   *
   * GET /reports/:id/conversation
   */
  @UseGuards(JwtAuthGuard)
  @Get(':id/conversation')
  async getConversation(
    @Param('id') reportId: string,
    @AuthUserId() userId: string,
  ) {
    return this.reportsSharing.getConversation(reportId, userId);
  }

  /**
   * Create a share link for a report
   *
   * POST /reports/:id/share
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/share')
  async createShare(
    @Param('id') reportId: string,
    @Body() dto: CreateShareDto,
    @AuthUserId() userId: string,
  ) {
    const shareToken = await this.reportsSharing.createShareLink(
      reportId,
      userId,
      dto.access_level || 'view',
      dto.expires_in_days,
    );

    return { share_token: shareToken };
  }
}
