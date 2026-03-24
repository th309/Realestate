import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { StripeService } from './stripe.service';
import { BillingService } from './billing.service';
import { BillingWebhookService } from './billing-webhook.service';
import { BillingController } from './billing.controller';
import { OrgBillingModule } from '../org-billing/org-billing.module';

@Module({
  imports: [SupabaseModule, forwardRef(() => OrgBillingModule)],
  providers: [StripeService, BillingWebhookService, BillingService],
  controllers: [BillingController],
  exports: [BillingService, StripeService, BillingWebhookService],
})
export class BillingModule {}
