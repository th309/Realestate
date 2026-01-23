/**
 * ML Workflow Module
 *
 * Provides endpoints for managing PropertyIQ ML workflow via the
 * PropertyIQ Analytics microservice:
 * - HomeReady scoring
 * - InvestorEdge scoring
 * - Backtesting
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MLWorkflowController } from './ml-workflow.controller';
import { MLWorkflowService } from './ml-workflow.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [MLWorkflowController],
  providers: [MLWorkflowService],
  exports: [MLWorkflowService],
})
export class MLWorkflowModule {}
