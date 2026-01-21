/**
 * Health Module
 *
 * Provides health check endpoints for monitoring data cards,
 * data sources, pipeline runs, and alerts.
 */

import { Module } from '@nestjs/common';
import { HealthController, PipelinesController } from './health.controller';
import { DataCardsHealthService } from './data-cards-health.service';
import { DataSourcesHealthService } from './data-sources-health.service';
import { PipelineRunsService } from './pipeline-runs.service';
import { DataAlertsService } from './data-alerts.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [HealthController, PipelinesController],
  providers: [
    DataCardsHealthService,
    DataSourcesHealthService,
    PipelineRunsService,
    DataAlertsService,
  ],
  exports: [
    DataCardsHealthService,
    DataSourcesHealthService,
    PipelineRunsService,
    DataAlertsService,
  ],
})
export class HealthModule {}
