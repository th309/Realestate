import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrgAuditModule } from '../org-audit/org-audit.module';
import { EmailModule } from '../email/email.module';
import { McpEntitlementsInvalidatorModule } from '../entitlements/mcp-entitlements-invalidator.module';
import { OrganizationsController } from './organizations.controller';
import { MembersController } from './members.controller';
import { InvitesController } from './invites.controller';
import { OrganizationsService } from './organizations.service';
import { OrgSlugService } from './org-slug.service';
import { OrgReportStatsService } from './org-report-stats.service';
import { MembersService } from './members.service';
import { InvitesService } from './invites.service';
import { InviteEmailService } from './invite-email.service';
import { OrgContextGuard } from './guards/org-context.guard';
import { OrgAdminGuard } from './guards/org-admin.guard';
import { OrgMemberGuard } from './guards/org-member.guard';

@Module({
  imports: [
    OrgAuditModule,
    EmailModule,
    ConfigModule,
    McpEntitlementsInvalidatorModule,
  ],
  controllers: [OrganizationsController, MembersController, InvitesController],
  providers: [
    OrganizationsService,
    OrgSlugService,
    OrgReportStatsService,
    MembersService,
    InvitesService,
    InviteEmailService,
    OrgContextGuard,
    OrgAdminGuard,
    OrgMemberGuard,
  ],
  exports: [
    OrganizationsService,
    MembersService,
    InvitesService,
    OrgContextGuard,
    OrgAdminGuard,
    OrgMemberGuard,
  ],
})
export class OrganizationsModule {}
