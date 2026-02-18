import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { StripeService } from './stripe.service';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [SupabaseModule],
  providers: [StripeService, BillingService],
  controllers: [BillingController],
  exports: [BillingService, StripeService],
})
export class BillingModule {}
