import { Module } from '@nestjs/common';
import { OrgAuditModule } from '../org-audit/org-audit.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrgContextGuard } from './guards/org-context.guard';
import { OrgAdminGuard } from './guards/org-admin.guard';
import { OrgMemberGuard } from './guards/org-member.guard';

@Module({
  imports: [OrgAuditModule],
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    OrgContextGuard,
    OrgAdminGuard,
    OrgMemberGuard,
  ],
  exports: [
    OrganizationsService,
    OrgContextGuard,
    OrgAdminGuard,
    OrgMemberGuard,
  ],
})
export class OrganizationsModule {}
