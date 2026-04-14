import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { UserAnalyticsModule } from '../user-analytics/user-analytics.module';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [SupabaseModule, UserAnalyticsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
