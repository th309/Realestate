import { Module } from '@nestjs/common';
import { UserAnalyticsModule } from '../user-analytics/user-analytics.module';
import { TrialExpirationCron } from './trial-expiration.cron';

/**
 * Scheduling module — home for cron jobs that don't naturally belong to a
 * feature module.
 *
 * Note: `ScheduleModule.forRoot()` is already registered globally in
 * `AppModule`, so we do NOT import it here (it can only be registered once).
 *
 * SupabaseModule is `@Global()`, so SUPABASE_CLIENT is available without
 * importing it explicitly.
 */
@Module({
  imports: [UserAnalyticsModule],
  providers: [TrialExpirationCron],
  exports: [TrialExpirationCron],
})
export class SchedulingModule {}
