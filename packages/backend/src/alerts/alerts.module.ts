import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { EmailModule } from '../email/email.module';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AlertProcessorService } from './alert-processor.service';
import { ThresholdAlertService } from './threshold-alert.service';
import { ThresholdAlertDataService } from './threshold-alert-data.service';

@Module({
  imports: [SupabaseModule, EntitlementsModule, EmailModule, ConfigModule],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertProcessorService,
    ThresholdAlertService,
    ThresholdAlertDataService,
  ],
  exports: [AlertsService],
})
export class AlertsModule {}
