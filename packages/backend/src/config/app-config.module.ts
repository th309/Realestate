/**
 * AppConfig Module
 *
 * Provides AppConfigService for DB-first configuration with env var fallback.
 * Exports AppConfigService so other modules can inject it.
 */

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';

@Module({
  imports: [SupabaseModule],
  providers: [AppConfigService],
  controllers: [AppConfigController],
  exports: [AppConfigService],
})
export class AppConfigModule {}
