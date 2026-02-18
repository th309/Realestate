import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AlertProcessorService } from './alert-processor.service';

@Module({
  imports: [SupabaseModule, EntitlementsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertProcessorService],
  exports: [AlertsService],
})
export class AlertsModule {}
