import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailModule } from '../email/email.module';
import { UserAnalyticsModule } from '../user-analytics/user-analytics.module';
import { McpEntitlementsInvalidatorModule } from '../entitlements/mcp-entitlements-invalidator.module';
import { StripeService } from './stripe.service';
import { BillingService } from './billing.service';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingUserSyncService } from './billing-user-sync.service';
import { BillingController } from './billing.controller';
import { TrialConversionService } from './trial-conversion.service';
import { OrgBillingModule } from '../org-billing/org-billing.module';
import { ReferralCreditService } from '../referrals/referral-credit.service';
import { TrialEndingNotificationService } from './trial-ending-notification.service';
import { PaymentFailedNotificationService } from './payment-failed-notification.service';

@Module({
  imports: [
    SupabaseModule,
    EmailModule,
    UserAnalyticsModule,
    McpEntitlementsInvalidatorModule,
    forwardRef(() => OrgBillingModule),
  ],
  providers: [
    StripeService,
    BillingWebhookService,
    BillingUserSyncService,
    BillingService,
    TrialConversionService,
    ReferralCreditService,
    TrialEndingNotificationService,
    PaymentFailedNotificationService,
  ],
  controllers: [BillingController],
  exports: [
    BillingService,
    StripeService,
    BillingWebhookService,
    ReferralCreditService,
  ],
})
export class BillingModule {}
