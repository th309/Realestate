/**
 * Report Follow-Up Controller
 *
 * API endpoints for post-delivery engagement:
 * - GET  /api/reports/:id/follow-up       — alerts + market changes for a report
 * - POST /api/reports/:id/alerts/dismiss/:alertId — dismiss a triggered alert
 */

import {
  Controller,
  Get,
  Post,
  Param,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { ReportFollowUpService } from './report-follow-up.service';

@Controller('api/reports')
@UseGuards(JwtAuthGuard)
export class ReportFollowUpController {
  constructor(private readonly followUpService: ReportFollowUpService) {}

  /**
   * Get follow-up data for a report: alerts + market changes since generation.
   *
   * GET /api/reports/:id/follow-up
   */
  @Get(':id/follow-up')
  async getFollowUp(
    @Param('id') reportId: string,
    @AuthUserId() userId: string,
  ) {
    const followUp = await this.followUpService.getReportFollowUp(reportId);

    if (!followUp) {
      throw new HttpException('Report not found', HttpStatus.NOT_FOUND);
    }

    return followUp;
  }

  /**
   * Dismiss a specific alert.
   *
   * POST /api/reports/:id/alerts/dismiss/:alertId
   */
  @Post(':id/alerts/dismiss/:alertId')
  async dismissAlert(
    @Param('alertId') alertId: string,
    @AuthUserId() userId: string,
  ) {
    const dismissed = await this.followUpService.dismissAlert(alertId, userId);

    if (!dismissed) {
      throw new HttpException(
        'Alert not found or already dismissed',
        HttpStatus.NOT_FOUND,
      );
    }

    return { success: true };
  }
}
