/**
 * Organization Audit Controller
 *
 * REST endpoint for querying the organization audit log.
 * Route: GET /api/org/:slug/audit
 *
 * Guarded by JwtAuthGuard → OrgContextGuard → OrgAdminGuard.
 * Only org admins can view the audit log.
 */

import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { OrgContextGuard } from '../organizations/guards/org-context.guard';
import { OrgAdminGuard } from '../organizations/guards/org-admin.guard';
import {
  OrgAuditService,
  AuditAction,
  AuditTargetType,
} from './org-audit.service';

@UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
@Controller('api/org/:slug/audit')
export class OrgAuditController {
  constructor(private readonly auditService: OrgAuditService) {}

  @Get()
  async getAuditLog(
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('action') action?: AuditAction,
    @Query('target_type') targetType?: AuditTargetType,
    @Req() req?: any,
  ) {
    const organizationId: string = req.org.id;

    return this.auditService.query({
      organizationId,
      cursor,
      limit,
      action,
      targetType,
    });
  }
}
