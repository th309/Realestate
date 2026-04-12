import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { DigestService } from './digest.service';
import { DripService } from './drip.service';
import { MonthlyDigestService } from './monthly-digest.service';
import { MonthlyDigestDataService } from './monthly-digest-data.service';
import { BehavioralTriggerService } from './behavioral-trigger.service';

@Module({
  imports: [SupabaseModule, ConfigModule, PreferencesModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    DigestService,
    DripService,
    MonthlyDigestService,
    MonthlyDigestDataService,
    BehavioralTriggerService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
