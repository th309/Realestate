/**
 * Health Module
 *
 * Provides health check endpoints for monitoring data cards,
 * data sources, pipeline runs, and alerts.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PipelinesController } from './pipelines.controller';
import { DataCardsHealthService } from './data-cards-health.service';
import { DataSourcesHealthService } from './data-sources-health.service';
import { PipelineRunsService } from './pipeline-runs.service';
import { DataAlertsService } from './data-alerts.service';
import { DataFreshnessService } from './data-freshness.service';
import { HealthMonitorCron } from './health-monitor.cron';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [SupabaseModule, ConfigModule, EmailModule],
  controllers: [HealthController, PipelinesController],
  providers: [
    DataCardsHealthService,
    DataSourcesHealthService,
    PipelineRunsService,
    DataAlertsService,
    DataFreshnessService,
    HealthMonitorCron,
  ],
  exports: [
    DataCardsHealthService,
    DataSourcesHealthService,
    PipelineRunsService,
    DataAlertsService,
    DataFreshnessService,
  ],
})
export class HealthModule {}
