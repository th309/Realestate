import { Module } from '@nestjs/common';
import { OrgAuditService } from './org-audit.service';
import { OrgAuditController } from './org-audit.controller';
import { OrgContextGuard } from '../organizations/guards/org-context.guard';
import { OrgAdminGuard } from '../organizations/guards/org-admin.guard';

@Module({
  controllers: [OrgAuditController],
  providers: [OrgAuditService, OrgContextGuard, OrgAdminGuard],
  exports: [OrgAuditService],
})
export class OrgAuditModule {}
