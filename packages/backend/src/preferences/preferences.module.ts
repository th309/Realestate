/**
 * Preferences Module
 *
 * Provides user quiz preference storage and archetype mapping.
 * Exports PreferencesService so other modules (e.g., InsightsModule)
 * can look up archetype IDs for personalized content generation.
 */

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PreferencesService } from './preferences.service';
import { PreferencesController } from './preferences.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
