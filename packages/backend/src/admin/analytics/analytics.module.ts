import { Module } from '@nestjs/common';
import { PaywallAnalyticsController } from './paywall-analytics.controller';
import { PaywallAnalyticsService } from './paywall-analytics.service';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [PaywallAnalyticsController],
  providers: [PaywallAnalyticsService],
  exports: [PaywallAnalyticsService],
})
export class AnalyticsModule {}
