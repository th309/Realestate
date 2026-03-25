import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OrgAuditModule } from '../org-audit/org-audit.module';
import { OrgBrandingService } from './org-branding.service';
import { OrgLogoService } from './org-logo.service';
import { CustomDomainService } from './custom-domain.service';
import { OrgBrandingController } from './org-branding.controller';
import { OrgBrandingPublicController } from './org-branding-public.controller';

@Module({
  imports: [OrganizationsModule, OrgAuditModule],
  controllers: [OrgBrandingController, OrgBrandingPublicController],
  providers: [OrgBrandingService, OrgLogoService, CustomDomainService],
  exports: [OrgBrandingService, CustomDomainService],
})
export class OrgBrandingModule {}
