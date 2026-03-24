/**
 * Organization Audit Controller
 *
 * REST endpoint for querying the organization audit log.
 * Route: GET /api/org/:slug/audit
 *
 * Currently guarded by JwtAuthGuard only.
 * TODO: Add OrgContextGuard and OrgAdminGuard after Task 4.
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  Logger,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import {
  OrgAuditService,
  AuditAction,
  AuditTargetType,
} from './org-audit.service';

// TODO: Replace with @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard) after Task 4
@UseGuards(JwtAuthGuard)
@Controller('api/org/:slug/audit')
export class OrgAuditController {
  private readonly logger = new Logger(OrgAuditController.name);

  constructor(private readonly auditService: OrgAuditService) {}

  @Get()
  async getAuditLog(
    @Param('slug') slug: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('action') action?: AuditAction,
    @Query('target_type') targetType?: AuditTargetType,
    @Req() req?: any,
  ) {
    // org.id will be populated by OrgContextGuard in Task 4.
    // For now, fall back to undefined which will return empty results.
    const organizationId: string | undefined = req?.org?.id;

    if (!organizationId) {
      this.logger.warn(
        `Audit query for slug "${slug}" has no org context — OrgContextGuard not yet active`,
      );
      return { entries: [], nextCursor: null };
    }

    return this.auditService.query({
      organizationId,
      cursor,
      limit,
      action,
      targetType,
    });
  }
}
