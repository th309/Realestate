/**
 * Preferences Module
 *
 * Provides user quiz preference storage, archetype mapping, and
 * personalized market match scoring.
 *
 * Exports PreferencesService and MarketMatchService so other modules
 * (e.g., InsightsModule, DashboardModule) can look up archetype IDs
 * and compute personalized match scores.
 */

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';
import { PreferencesService } from './preferences.service';
import { MarketMatchService } from './market-match.service';
import { PreferencesController } from './preferences.controller';

@Module({
  imports: [SupabaseModule, MetricResolutionModule],
  controllers: [PreferencesController],
  providers: [PreferencesService, MarketMatchService],
  exports: [PreferencesService, MarketMatchService],
})
export class PreferencesModule {}
