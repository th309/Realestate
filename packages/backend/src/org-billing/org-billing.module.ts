import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OrgAuditModule } from '../org-audit/org-audit.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { OrgBillingService } from './org-billing.service';
import { OrgBillingWebhookService } from './org-billing-webhook.service';
import { OrgBillingController } from './org-billing.controller';

@Module({
  imports: [
    forwardRef(() => BillingModule),
    OrgAuditModule,
    OrganizationsModule,
  ],
  controllers: [OrgBillingController],
  providers: [OrgBillingService, OrgBillingWebhookService],
  exports: [OrgBillingService, OrgBillingWebhookService],
})
export class OrgBillingModule {}
