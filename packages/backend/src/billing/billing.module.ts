import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailModule } from '../email/email.module';
import { StripeService } from './stripe.service';
import { BillingService } from './billing.service';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingController } from './billing.controller';
import { OrgBillingModule } from '../org-billing/org-billing.module';
import { ReferralCreditService } from '../referrals/referral-credit.service';

@Module({
  imports: [SupabaseModule, EmailModule, forwardRef(() => OrgBillingModule)],
  providers: [StripeService, BillingWebhookService, BillingService, ReferralCreditService],
  controllers: [BillingController],
  exports: [BillingService, StripeService, BillingWebhookService, ReferralCreditService],
})
export class BillingModule {}
