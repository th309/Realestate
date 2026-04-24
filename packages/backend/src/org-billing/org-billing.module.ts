import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { OrgAuditModule } from '../org-audit/org-audit.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { McpEntitlementsInvalidatorModule } from '../entitlements/mcp-entitlements-invalidator.module';
import { OrgBillingService } from './org-billing.service';
import { OrgBillingUsageService } from './org-billing-usage.service';
import { OrgBillingWebhookService } from './org-billing-webhook.service';
import { OrgDowngradeHandlerService } from './org-downgrade-handler.service';
import { OrgBillingController } from './org-billing.controller';

@Module({
  imports: [
    forwardRef(() => BillingModule),
    OrgAuditModule,
    OrganizationsModule,
    McpEntitlementsInvalidatorModule,
  ],
  controllers: [OrgBillingController],
  providers: [
    OrgBillingService,
    OrgBillingUsageService,
    OrgBillingWebhookService,
    OrgDowngradeHandlerService,
  ],
  exports: [
    OrgBillingService,
    OrgBillingUsageService,
    OrgBillingWebhookService,
    OrgDowngradeHandlerService,
  ],
})
export class OrgBillingModule {}
