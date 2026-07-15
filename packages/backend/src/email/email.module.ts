import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { UnsubscribeController } from './unsubscribe.controller';
import { DigestService } from './digest.service';
import { DripService } from './drip.service';
import { MonthlyDigestService } from './monthly-digest.service';
import { MonthlyDigestDataService } from './monthly-digest-data.service';
import { BehavioralTriggerService } from './behavioral-trigger.service';
import { EngagementTriggerService } from './engagement-trigger.service';
import { EmailTriggerDedupService } from './email-trigger-dedup.service';
import { InactiveUserTriggerService } from './inactive-user-trigger.service';
import { TrialLifecycleTriggerService } from './trial-lifecycle-trigger.service';

@Module({
  imports: [SupabaseModule, ConfigModule, PreferencesModule],
  controllers: [EmailController, UnsubscribeController],
  providers: [
    EmailService,
    DigestService,
    DripService,
    MonthlyDigestService,
    MonthlyDigestDataService,
    EmailTriggerDedupService,
    InactiveUserTriggerService,
    TrialLifecycleTriggerService,
    BehavioralTriggerService,
    EngagementTriggerService,
  ],
  exports: [
    EmailService,
    DripService,
    TrialLifecycleTriggerService,
    EngagementTriggerService,
  ],
})
export class EmailModule {}
