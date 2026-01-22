/**
 * ML Workflow Module
 *
 * Provides endpoints for managing PropertyIQ ML workflow:
 * - Data export to Parquet
 * - Backtest data preparation
 * - Benchmark calculation
 * - AutoGluon feature analysis
 * - SHAP explanations
 * - Monthly report generation
 */

import { Module } from '@nestjs/common';
import { MLWorkflowController } from './ml-workflow.controller';
import { MLWorkflowService } from './ml-workflow.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [MLWorkflowController],
  providers: [MLWorkflowService],
  exports: [MLWorkflowService],
})
export class MLWorkflowModule {}
